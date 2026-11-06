/**
 * Health monitor for the sync backend: a small state machine around a probe
 * (connect + SELECT 1 + table existence check) with exponential-backoff
 * retries, plus the one-shot `testConnection` used by the settings panel.
 */
import { createAdapter } from './backends/database.js';
import { configToUrl, type SyncConfig } from './config.js';

export type HealthStatus = {
    state: 'ok' | 'down' | 'disabled' | 'config-error';
    lastOkAt?: number;
    lastError?: string;
    retryCount: number;
    mirroredTotal?: number;
};

/** Thrown by the probe when the sync config itself is unusable — no retries until it is fixed. */
export class ConfigError extends Error {
}

type TransitionCallback = (
    to: HealthStatus['state'],
    from: HealthStatus['state'],
    status: HealthStatus,
) => void;

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
export class HealthMonitor {
    private readonly probe: () => Promise<void>;
    private readonly options: HealthMonitorOptions;
    private state: HealthStatus['state'] = 'disabled';
    private lastOkAt: number | undefined;
    private lastError: string | undefined;
    private retryCount = 0;
    private running = false;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private readonly listeners = new Set<TransitionCallback>();

    constructor(probe: () => Promise<void>, options: HealthMonitorOptions = {}) {
        this.probe = probe;
        this.options = options;
    }

    start(): void {
        if (this.running)
            return;
        this.running = true;
        void this.runProbe();
    }

    stop(): void {
        this.running = false;
        this.clearTimer();
        this.retryCount = 0;
        this.lastError = undefined;
        this.lastOkAt = undefined;
        this.transition('disabled');
    }

    snapshot(): HealthStatus {
        return {
            state: this.state,
            ...(this.lastOkAt !== undefined ? { lastOkAt: this.lastOkAt } : {}),
            ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
            retryCount: this.retryCount,
        };
    }

    onTransition(cb: TransitionCallback): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    /** Run one probe cycle immediately (re-arms after a config error). */
    async recheck(): Promise<void> {
        if (!this.running)
            return;
        this.clearTimer();
        await this.runProbe();
    }

    private clearTimer(): void {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    private async runProbe(): Promise<void> {
        try {
            await this.probe();
            if (this.running)
                this.onSuccess();
        } catch (error) {
            if (this.running)
                this.onFailure(error);
        }
    }

    private onSuccess(): void {
        this.lastOkAt = Date.now();
        this.lastError = undefined;
        this.retryCount = 0;
        this.transition('ok');
        this.scheduleRetry(this.options.intervalMs ?? 30_000);
    }

    private onFailure(error: unknown): void {
        this.lastError = error instanceof Error ? error.message : String(error);
        if (error instanceof ConfigError) {
            // The config is unusable — retrying cannot help until it is fixed.
            this.retryCount = 0;
            this.transition('config-error');
            return;
        }
        this.transition('down');
        // Exponential backoff: 1s → 2s → 4s → ... capped at 60s.
        this.scheduleRetry(Math.min(1000 * 2 ** this.retryCount, 60_000));
        this.retryCount += 1;
    }

    private scheduleRetry(delayMs: number): void {
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.runProbe();
        }, delayMs);
    }

    private transition(to: HealthStatus['state']): void {
        const from = this.state;
        if (from === to)
            return;
        this.state = to;
        const snapshot = this.snapshot();
        for (const cb of [...this.listeners])
            cb(to, from, snapshot);
    }
}

function tableCheck(provider: SyncConfig['provider']): string {
    switch (provider) {
        case 'mysql':
            return `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ai_messages'`;
        case 'postgresql':
            return `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_messages'`;
        case 'sqlite':
            return `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'ai_messages'`;
        case 'sqlserver':
            return `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ai_messages'`;
    }
}

/** Collapse driver errors into stable, human-readable messages. */
function humanizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|connection refused/i.test(message))
        return 'connection refused';
    if (/access denied|ER_ACCESS_DENIED_ERROR|authentication failed|password authentication|login failed/i.test(message))
        return 'authentication denied (check user/password)';
    if (/ER_BAD_DB_ERROR|unknown database|database .* does not exist|no such file/i.test(message))
        return 'database not found';
    return message;
}

interface RawConnection {
    queryRaw(q: { sql: string; args: unknown[] }): Promise<{ rows: unknown[] }>;
    dispose?(): Promise<void>;
}

/** Build an adapter from the config, connect, SELECT 1, check tables, dispose. */
async function connectAndCheck(
    cfg: SyncConfig,
): Promise<'ok' | 'no-tables'> {
    const factory = (await createAdapter({
        provider: cfg.provider,
        url: configToUrl(cfg),
        timezone: cfg.timezone,
    })) as { connect(): Promise<RawConnection> };
    const connection = await factory.connect();
    try {
        await connection.queryRaw({ sql: 'SELECT 1', args: [] });
        const tables = await connection.queryRaw({ sql: tableCheck(cfg.provider), args: [] });
        return tables.rows.length > 0 ? 'ok' : 'no-tables';
    } finally {
        await connection.dispose?.().catch((error: unknown) => {
            console.error('[dsh-storage] connection dispose failed:', error);
        });
    }
}

/** Probe for HealthMonitor: resolves when the database is live and migrated. */
export async function probeDatabase(cfg: SyncConfig): Promise<void> {
    let result: 'ok' | 'no-tables';
    try {
        result = await connectAndCheck(cfg);
    } catch (error) {
        throw new Error(humanizeError(error));
    }
    if (result === 'no-tables')
        throw new Error('ai_messages table missing — run dsh-storage migrations first');
}

export type ConnectionTestResult = 'ok' | 'no-tables' | `fail:${string}`;

/** One-shot panel test: never throws — every failure maps to 'fail:<reason>'. */
export async function testConnection(cfg: SyncConfig): Promise<ConnectionTestResult> {
    try {
        return await connectAndCheck(cfg);
    } catch (error) {
        return `fail:${humanizeError(error)}`;
    }
}
