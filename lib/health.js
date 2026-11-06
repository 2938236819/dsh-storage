/**
 * Health monitor for the sync backend: a small state machine around a probe
 * (connect + SELECT 1 + table existence check) with exponential-backoff
 * retries, plus the one-shot `testConnection` used by the settings panel.
 */
import { createAdapter } from './backends/database.js';
import { configToUrl } from './config.js';
/** Thrown by the probe when the sync config itself is unusable — no retries until it is fixed. */
export class ConfigError extends Error {
}
/**
 * States: 'disabled' (not started) → 'ok'/'down' on probe results, or
 * 'config-error' when the probe reports a ConfigError (retries suspended
 * until an explicit `recheck()`). Same-state results never re-fire
 * transition callbacks.
 */
export class HealthMonitor {
    probe;
    options;
    state = 'disabled';
    lastOkAt;
    lastError;
    retryCount = 0;
    running = false;
    timer;
    listeners = new Set();
    constructor(probe, options = {}) {
        this.probe = probe;
        this.options = options;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        void this.runProbe();
    }
    stop() {
        this.running = false;
        this.clearTimer();
        this.retryCount = 0;
        this.lastError = undefined;
        this.lastOkAt = undefined;
        this.transition('disabled');
    }
    snapshot() {
        return {
            state: this.state,
            ...(this.lastOkAt !== undefined ? { lastOkAt: this.lastOkAt } : {}),
            ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
            retryCount: this.retryCount,
        };
    }
    onTransition(cb) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }
    /** Run one probe cycle immediately (re-arms after a config error). */
    async recheck() {
        if (!this.running)
            return;
        this.clearTimer();
        await this.runProbe();
    }
    clearTimer() {
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
    async runProbe() {
        try {
            await this.probe();
            if (this.running)
                this.onSuccess();
        }
        catch (error) {
            if (this.running)
                this.onFailure(error);
        }
    }
    onSuccess() {
        this.lastOkAt = Date.now();
        this.lastError = undefined;
        this.retryCount = 0;
        this.transition('ok');
        this.scheduleRetry(this.options.intervalMs ?? 30_000);
    }
    onFailure(error) {
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
    scheduleRetry(delayMs) {
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.timer = undefined;
            void this.runProbe();
        }, delayMs);
    }
    transition(to) {
        const from = this.state;
        if (from === to)
            return;
        this.state = to;
        const snapshot = this.snapshot();
        for (const cb of [...this.listeners])
            cb(to, from, snapshot);
    }
}
function tableCheck(provider) {
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
function humanizeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|connection refused/i.test(message))
        return 'connection refused';
    if (/access denied|ER_ACCESS_DENIED_ERROR|authentication failed|password authentication|login failed/i.test(message))
        return 'authentication denied (check user/password)';
    if (/ER_BAD_DB_ERROR|unknown database|database .* does not exist|no such file/i.test(message))
        return 'database not found';
    return message;
}
/** Build an adapter from the config, connect, SELECT 1, check tables, dispose. */
async function connectAndCheck(cfg) {
    const factory = (await createAdapter({
        provider: cfg.provider,
        url: configToUrl(cfg),
        timezone: cfg.timezone,
    }));
    const connection = await factory.connect();
    try {
        await connection.queryRaw({ sql: 'SELECT 1', args: [] });
        const tables = await connection.queryRaw({ sql: tableCheck(cfg.provider), args: [] });
        return tables.rows.length > 0 ? 'ok' : 'no-tables';
    }
    finally {
        await connection.dispose?.().catch((error) => {
            console.error('[dsh-storage] connection dispose failed:', error);
        });
    }
}
/** Probe for HealthMonitor: resolves when the database is live and migrated. */
export async function probeDatabase(cfg) {
    let result;
    try {
        result = await connectAndCheck(cfg);
    }
    catch (error) {
        throw new Error(humanizeError(error));
    }
    if (result === 'no-tables')
        throw new Error('ai_messages table missing — run dsh-storage migrations first');
}
/** One-shot panel test: never throws — every failure maps to 'fail:<reason>'. */
export async function testConnection(cfg) {
    try {
        return await connectAndCheck(cfg);
    }
    catch (error) {
        return `fail:${humanizeError(error)}`;
    }
}
