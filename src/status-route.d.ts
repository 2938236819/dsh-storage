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
export declare const STATUS_CHANNEL = "/dsh-storage";
/**
 * Register the /dsh-storage channel. Wire order mirrors ds-harness-remote's
 * control route: an authenticated webServer prefix route when both services
 * allow it, otherwise connection.rpc.handle for logical carriers.
 */
export declare function registerStatusRoute(ctx: Context, service: StatusService): (() => void) | undefined;
