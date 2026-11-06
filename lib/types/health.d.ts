/**
 * Health monitor for the sync backend: a small state machine around a probe
 * (connect + SELECT 1 + table existence check) with exponential-backoff
 * retries, plus the one-shot `testConnection` used by the settings panel.
 */
import { type SyncConfig } from './config.js';
export type HealthStatus = {
    state: 'ok' | 'down' | 'disabled' | 'config-error';
    lastOkAt?: number;
    lastError?: string;
    retryCount: number;
    mirroredTotal?: number;
};
/** Thrown by the probe when the sync config itself is unusable — no retries until it is fixed. */
export declare class ConfigError extends Error {
}
type TransitionCallback = (to: HealthStatus['state'], from: HealthStatus['state'], status: HealthStatus) => void;
export interface HealthMonitorOptions {
    /** Re-probe interval while healthy (default 30s). */
    intervalMs?: number;
}
/**
 * States: 'disabled' (not started) → 'ok'/'down' on probe results, or
 * 'config-error' when the probe reports a ConfigError (retries suspended
 * until an explicit `recheck()`). Same-state results never re-fire
 * transition callbacks.
 */
export declare class HealthMonitor {
    private readonly probe;
    private readonly options;
    private state;
    private lastOkAt;
    private lastError;
    private retryCount;
    private running;
    private timer;
    private readonly listeners;
    constructor(probe: () => Promise<void>, options?: HealthMonitorOptions);
    start(): void;
    stop(): void;
    snapshot(): HealthStatus;
    onTransition(cb: TransitionCallback): () => void;
    /** Run one probe cycle immediately (re-arms after a config error). */
    recheck(): Promise<void>;
    private clearTimer;
    private runProbe;
    private onSuccess;
    private onFailure;
    private scheduleRetry;
    private transition;
}
/** Probe for HealthMonitor: resolves when the database is live and migrated. */
export declare function probeDatabase(cfg: SyncConfig): Promise<void>;
export type ConnectionTestResult = 'ok' | 'no-tables' | `fail:${string}`;
/** One-shot panel test: never throws — every failure maps to 'fail:<reason>'. */
export declare function testConnection(cfg: SyncConfig): Promise<ConnectionTestResult>;
export {};
