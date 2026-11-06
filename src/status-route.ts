/**
 * Host→browser bridge for the settings panel: exposes the dshStorageStatus
 * service over the DSH connection generic-RPC channel `/dsh-storage`.
 *
 * Pattern verified against the installed reference plugins (ds-harness-remote
 * `registerControlRoute`, dsh-video-skin settings.section client): the browser
 * client calls `ctx.connection.rpc.call('/dsh-storage', endpoint, payload)`,
 * which POSTs `{type:'client-request', rpcId, method, payload}` to
 * `/<channel>/<endpoint>` and expects `{type:'server-response', rpcId,
 * result:{ok:true,value}|{ok:false,error:{code,message,details}}}`. When the
 * webServer service is available we serve that path with a prefix route
 * (guarded by `connection.requestRejection` for authentication); otherwise we
 * fall back to `connection.rpc.handle` for in-process carriers. Both halves
 * stay optional (`ctx.get`), so profiles without a web carrier simply skip
 * the bridge.
 */

import type { Context } from '@deepseek-ai/cordis';
import { syncConfigProblem } from './config.js';
import type { SyncConfig } from './config.js';
import type { CreateTableResult } from './ddl.js';
import type { ConnectionTestResult, HealthStatus } from './health.js';
import type { BackfillSummary } from './backfill.js';
import type { StorageToast } from './notify.js';

/** The surface bridged to the browser panel. */
export interface StatusService {
    snapshot(): HealthStatus;
    testConnection(cfg: SyncConfig): Promise<ConnectionTestResult>;
    createTables(cfg: SyncConfig): Promise<CreateTableResult>;
    getConfig(): {
        config: SyncConfig;
        error?: 'parse' | 'missing-field';
    };
    saveConfig(cfg: SyncConfig): {
        config: SyncConfig;
    };
    /** Panel 「补传」: replay missing events from local session logs. */
    backfill(): Promise<BackfillSummary>;
    /** Toast notifications newer than the cursor (client polling). */
    toasts(payload: {
        sinceId?: number;
    }): StorageToast[];
}
export const STATUS_CHANNEL = '/dsh-storage';
const ENDPOINT_SEGMENT = /^[A-Za-z0-9_$.-]+$/;
interface RouteRequest {
    url?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterableIterator<unknown>;
}

interface RouteResponse {
    writeHead(status: number, headers?: Record<string, string>): unknown;
    end(body?: string): unknown;
}

interface RpcError {
    code: string;
    message: string;
    details: Record<string, never>;
}

interface Ok<T> { ok: true; value: T }
interface Err { ok: false; error: RpcError }
type RpcResult<T> = Ok<T> | Err;

function badRequest(message: string): Err {
    return { ok: false, error: { code: 'gateway/bad-request', message, details: {} } };
}
/**
 * Guard for cfg-taking endpoints. Rejections name the offending field (via
 * syncConfigProblem) so a cleared/NaN port surfaces as 'cfg.port must be…',
 * not a misleading generic 'requires a cfg object'.
 */
function cfgGuard(endpoint: string, cfg: unknown): { cfg: SyncConfig } | { error: RpcError } {
    const problem = syncConfigProblem(cfg);
    return problem === undefined
        ? { cfg: cfg as SyncConfig }
        : { error: { code: 'gateway/bad-request', message: `${endpoint}: ${problem}`, details: {} } };
}
/** Dispatch one endpoint; never throws — failures become ok:false results. */
async function dispatch(service: StatusService, endpoint: string, payload: unknown): Promise<RpcResult<unknown>> {
    const body = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    try {
        switch (endpoint) {
            case 'snapshot':
                return { ok: true, value: service.snapshot() };
            case 'testConnection': {
                const guarded = cfgGuard('testConnection', body.cfg);
                if ('error' in guarded)
                    return { ok: false, error: guarded.error };
                return { ok: true, value: await service.testConnection(guarded.cfg) };
            }
            case 'createTables': {
                const guarded = cfgGuard('createTables', body.cfg);
                if ('error' in guarded)
                    return { ok: false, error: guarded.error };
                return { ok: true, value: await service.createTables(guarded.cfg) };
            }
            case 'getConfig':
                return { ok: true, value: service.getConfig() };
            case 'saveConfig': {
                const guarded = cfgGuard('saveConfig', body.cfg);
                if ('error' in guarded)
                    return { ok: false, error: guarded.error };
                return { ok: true, value: service.saveConfig(guarded.cfg) };
            }
            case 'backfill':
                return { ok: true, value: await service.backfill() };
            case 'toasts':
                if (body.sinceId !== undefined && typeof body.sinceId !== 'number')
                    return badRequest('toasts sinceId must be a number');
                return { ok: true, value: service.toasts({ sinceId: body.sinceId }) };
            default:
                return badRequest(`unknown endpoint ${JSON.stringify(endpoint)}`);
        }
    }
    catch (error) {
        return {
            ok: false,
            error: {
                code: 'gateway/internal',
                message: error instanceof Error ? error.message : String(error),
                details: {},
            },
        };
    }
}
function endpointFromPath(pathname: string): string | undefined {
    if (!pathname.startsWith(`${STATUS_CHANNEL}/`))
        return undefined;
    const endpoint = pathname.slice(STATUS_CHANNEL.length + 1);
    if (!ENDPOINT_SEGMENT.test(endpoint))
        return undefined;
    return endpoint;
}
function parseClientRequest(value: unknown): { type: string; rpcId: string; method: string; payload: unknown } | undefined {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const v = value as Record<string, unknown>;
    if (v.type !== 'client-request' || typeof v.rpcId !== 'string' || typeof v.method !== 'string')
        return undefined;
    return { type: 'client-request', rpcId: v.rpcId, method: v.method, payload: v.payload };
}
function writeJson(res: { writeHead(s: number, h?: Record<string, string>): unknown; end(b: string): unknown }, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}
function fullResponse(rpcId: string, result: unknown) {
    return { type: 'server-response', rpcId, result };
}
/**
 * Register the /dsh-storage channel. Wire order mirrors ds-harness-remote's
 * control route: an authenticated webServer prefix route when both services
 * allow it, otherwise connection.rpc.handle for logical carriers.
 */
export function registerStatusRoute(ctx: Context, service: StatusService): (() => void) | undefined {
    const connection = ctx.get('connection') as {
        requestRejection?: (req: RouteRequest) => number | undefined;
        rpc?: { handle(channel: string, handler: (endpoint: string, payload: unknown) => Promise<unknown>, opts?: { authority?: string }): () => void };
    } | undefined;
    if (!connection)
        return undefined;
    const handler = (endpoint: string, payload: unknown) => dispatch(service, endpoint, payload);
    const webServer = ctx.get('webServer') as {
        register(opts: { kind: string; path: string; handler: (req: RouteRequest, res: RouteResponse) => Promise<void> }): () => void;
    } | undefined;
    if (webServer !== undefined && connection.requestRejection !== undefined) {
        const dispose = webServer.register({
            kind: 'prefix',
            path: STATUS_CHANNEL,
            handler: async (req, res) => {
                const rejection = connection.requestRejection?.(req);
                if (rejection !== undefined) {
                    res.writeHead(rejection);
                    res.end(rejection === 401 ? 'unauthorized' : 'forbidden');
                    return;
                }
                const endpoint = endpointFromPath(new URL(req.url ?? '/', 'http://dsh.internal').pathname);
                if (req.method !== 'POST' || endpoint === undefined) {
                    writeJson(res, 404, 'not found');
                    return;
                }
                const contentType = Array.isArray(req.headers?.['content-type'])
                    ? req.headers['content-type'][0]
                    : req.headers?.['content-type'];
                if ((contentType ?? '').split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
                    writeJson(res, 415, 'content type must be application/json');
                    return;
                }
                let body;
                try {
                    const chunks: Buffer[] = [];
                    for await (const chunk of req) {
                        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
                    }
                    body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                }
                catch {
                    writeJson(res, 400, 'body is not JSON');
                    return;
                }
                const message = parseClientRequest(body);
                if (message === undefined || message.method !== endpoint) {
                    writeJson(res, 200, fullResponse('invalid-request', badRequest('invalid client-request message')));
                    return;
                }
                try {
                    writeJson(res, 200, fullResponse(message.rpcId, await handler(endpoint, message.payload)));
                }
                catch (error) {
                    res.writeHead(500);
                    res.end(`handler failure: ${String(error)}`);
                }
            },
        });
        return () => void dispose();
    }
    const rpcHandle = connection.rpc?.handle;
    if (rpcHandle === undefined)
        return undefined;
    const dispose = rpcHandle(STATUS_CHANNEL, handler, { authority: 'loopback' });
    return () => void dispose();
}
