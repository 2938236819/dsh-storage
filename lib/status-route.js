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
import { syncConfigProblem } from './config.js';
export const STATUS_CHANNEL = '/dsh-storage';
const ENDPOINT_SEGMENT = /^[A-Za-z0-9_$.-]+$/;
function badRequest(message) {
    return { ok: false, error: { code: 'gateway/bad-request', message, details: {} } };
}
/**
 * Guard for cfg-taking endpoints. Rejections name the offending field (via
 * syncConfigProblem) so a cleared/NaN port surfaces as 'cfg.port must be…',
 * not a misleading generic 'requires a cfg object'.
 */
function cfgGuard(endpoint, cfg) {
    const problem = syncConfigProblem(cfg);
    return problem === undefined
        ? { cfg: cfg }
        : { error: { code: 'gateway/bad-request', message: `${endpoint}: ${problem}`, details: {} } };
}
/** Dispatch one endpoint; never throws — failures become ok:false results. */
async function dispatch(service, endpoint, payload) {
    const body = (typeof payload === 'object' && payload !== null ? payload : {});
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
function endpointFromPath(pathname) {
    if (!pathname.startsWith(`${STATUS_CHANNEL}/`))
        return undefined;
    const endpoint = pathname.slice(STATUS_CHANNEL.length + 1);
    if (!ENDPOINT_SEGMENT.test(endpoint))
        return undefined;
    return endpoint;
}
function parseClientRequest(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const v = value;
    if (v.type !== 'client-request' || typeof v.rpcId !== 'string' || typeof v.method !== 'string')
        return undefined;
    return { type: 'client-request', rpcId: v.rpcId, method: v.method, payload: v.payload };
}
function writeJson(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}
function fullResponse(rpcId, result) {
    return { type: 'server-response', rpcId, result };
}
/**
 * Register the /dsh-storage channel. Wire order mirrors ds-harness-remote's
 * control route: an authenticated webServer prefix route when both services
 * allow it, otherwise connection.rpc.handle for logical carriers.
 */
export function registerStatusRoute(ctx, service) {
    const connection = ctx.get('connection');
    if (!connection)
        return undefined;
    const handler = (endpoint, payload) => dispatch(service, endpoint, payload);
    const webServer = ctx.get('webServer');
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
                    const chunks = [];
                    for await (const chunk of req) {
                        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
