/**
 * Settings-panel component for dsh-storage (会话存储镜像).
 *
 * Authored against the reference client plugins (dsh-pet / dsh-video-skin):
 * the browser half receives React from the host module loader inside the
 * __ModuleLoader__ factory, so the component is built through a factory that
 * takes the React module — no module-scope React import survives into the
 * bundle. All RPC goes through the injected `client` (connection rpc; see
 * src/client/index.ts), which keeps this file render-pure and testable with
 * a fake client.
 */
import type { SyncConfig } from '../config.js';
import type { BackfillSummary } from '../backfill.js';
/** Shapes mirrored from the host (type-only imports — erased in the bundle). */
export interface HealthStatus {
    state: 'ok' | 'down' | 'disabled' | 'config-error';
    lastOkAt?: number;
    lastError?: string;
    retryCount: number;
    mirroredTotal?: number;
}
export type TestResult = 'ok' | 'no-tables' | `fail:${string}`;
/** Promise-based panel API; the client entry implements it over connection rpc. */
export interface StorageClient {
    snapshot(): Promise<HealthStatus>;
    testConnection(cfg: SyncConfig): Promise<TestResult>;
    createTables(cfg: SyncConfig): Promise<'ok' | `fail:${string}`>;
    getConfig(): Promise<{
        config: SyncConfig;
        error?: 'parse' | 'missing-field';
    }>;
    saveConfig(cfg: SyncConfig): Promise<unknown>;
    backfill(): Promise<BackfillSummary>;
}
export declare const DEFAULT_TIMEZONES: string[];
/** Mirrors config.ts isValidPort — kept local so no node builtins enter the browser bundle. */
export declare function isValidPort(value: unknown): value is number;
/**
 * The cfg object to persist: the port is sent only when it is a valid
 * integer — a cleared/garbage port field is omitted so the RPC rejects it
 * with an honest per-field error instead of building a host:NaN URL.
 */
export declare function buildSaveConfig(cfg: SyncConfig): SyncConfig;
/** Structural React surface the factory needs (satisfied by react 18). */
export interface ReactLike {
    createElement: any;
    useState: <S>(initial: S) => [S, (value: S | ((prev: S) => S)) => void];
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void;
}
export type Tone = 'ok' | 'warn' | 'bad' | 'idle';
/** Status-light copy per HealthStatus.state. */
export declare function statusView(status: HealthStatus): {
    tone: Tone;
    label: string;
    details: string[];
};
/** Three-state connection-test copy: green ok / yellow no-tables / red fail. */
export declare function testResultView(result: TestResult): {
    tone: Tone;
    label: string;
};
export declare function createResultView(result: 'ok' | `fail:${string}`): {
    tone: Tone;
    label: string;
};
/** 补传 summary copy: green when clean, yellow when some sessions failed. */
export declare function backfillResultView(summary: BackfillSummary): {
    tone: Tone;
    label: string;
};
export interface PanelProps {
    client: StorageClient;
    /** Status poll interval; default 30s per the task brief. */
    pollMs?: number;
}
export declare function makeStoragePanel(React: ReactLike): {
    (props: PanelProps): any;
    displayName: string;
};
