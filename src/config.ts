/**
 * Standalone sync configuration persisted as JSON at
 * `$DSH_HOME/dsh-storage.json` (DSH_HOME env var, default ~/.dsh).
 *
 * The settings panel writes this file; the backend watches it to rebuild
 * database connections without a restart. Loading never throws: corrupt or
 * wrong-shape files fall back to defaults with an error flag.
 */
import { chmodSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { hostname, homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

export type SyncConfig = {
    enabled: boolean;
    provider: 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    timezone: string;
    /** Identifier stamped on mirrored rows so several machines can share one database. */
    device: string;
};

/**
 * Default device identifier: the OS hostname, truncated to the column width
 * (VARCHAR(100)). Empty hostnames (theoretically possible) fall back to a
 * stable placeholder so rows are never stamped with ''.
 */
export function defaultDevice(): string {
    const name = hostname().trim().slice(0, 100);
    return name || 'unknown-device';
}

export const DEFAULT_CONFIG: SyncConfig = {
    enabled: false,
    provider: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    user: '',
    password: '',
    database: '',
    timezone: '+08:00',
    device: defaultDevice(),
};

/** Resolve the DSH home directory: $DSH_HOME or ~/.dsh. */
export function dshHome(): string {
    return process.env.DSH_HOME || join(homedir(), '.dsh');
}

export function defaultConfigPath(): string {
    return join(dshHome(), 'dsh-storage.json');
}

/**
 * Parse a config timezone string ('+08:00', '-05:00', '+05:30', 'Z'/'UTC')
 * into signed minutes east of UTC. Invalid or absent input → 0 (the caller
 * decides whether to warn). This mirrors what the patched
 * @prisma/adapter-mariadb reads via globalThis.__DSH_STORAGE_TZ_OFFSET_MIN__.
 */
export function tzOffsetMinutes(tz: string): number {
    if (tz === 'UTC' || tz === 'Z')
        return 0;
    const m = /^[+-](\d{2}):(\d{2})$/.exec(tz);
    if (!m)
        return 0;
    const sign = tz[0] === '-' ? -1 : 1;
    return sign * (Number(m[1]) * 60 + Number(m[2]));
}

/** Valid TCP port for the form: a finite integer in [0, 65535] (0 allowed for sqlite configs). */
export function isValidPort(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 65535
    );
}

/**
 * First shape problem with a candidate sync config, or undefined when valid.
 * Field-specific reasons keep RPC rejections honest ('cfg.port must be…'
 * instead of a generic 'requires a cfg object').
 */
export function syncConfigProblem(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null)
        return 'cfg must be an object';
    const c = value as Record<string, unknown>;
    if (typeof c.enabled !== 'boolean')
        return 'cfg.enabled must be a boolean';
    if (
        c.provider !== 'mysql' &&
        c.provider !== 'postgresql' &&
        c.provider !== 'sqlite' &&
        c.provider !== 'sqlserver'
    )
        return 'cfg.provider must be one of mysql/postgresql/sqlite/sqlserver';
    if (typeof c.host !== 'string')
        return 'cfg.host must be a string';
    if (!isValidPort(c.port))
        return 'cfg.port must be an integer between 0 and 65535 (NaN/empty is not a port)';
    if (typeof c.user !== 'string')
        return 'cfg.user must be a string';
    if (typeof c.password !== 'string')
        return 'cfg.password must be a string';
    if (typeof c.database !== 'string')
        return 'cfg.database must be a string';
    if (typeof c.timezone !== 'string')
        return 'cfg.timezone must be a string';
    // `device` is deliberately NOT validated: configs written before this
    // field existed (and hand-edited files) load with the hostname default
    // instead of surfacing a missing-field error.
    return undefined;
}

function isSyncConfig(value: unknown): value is SyncConfig {
    return syncConfigProblem(value) === undefined;
}

export function loadConfig(path: string = defaultConfigPath()): {
    config: SyncConfig;
    error?: 'parse' | 'missing-field';
} {
    try {
        const raw = readFileSync(path, 'utf-8');
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return { config: { ...DEFAULT_CONFIG }, error: 'parse' };
        }
        if (!isSyncConfig(parsed)) {
            return { config: { ...DEFAULT_CONFIG }, error: 'missing-field' };
        }
        return { config: withDevice(parsed) };
    } catch {
        // Missing or unreadable file → plain defaults, no error.
        return { config: { ...DEFAULT_CONFIG } };
    }
}

/**
 * Fill in a missing/empty `device` on a validated config (pre-device JSON
 * files load without a missing-field error; the hostname default stamps
 * their rows). A stored non-empty string wins — that is the multi-device case.
 */
function withDevice(c: SyncConfig): SyncConfig {
    const device = typeof c.device === 'string' ? c.device.trim().slice(0, 100) : '';
    return device ? { ...c, device } : { ...c, device: defaultDevice() };
}

/**
 * Atomic write: temp file in the same directory + rename. The file holds the
 * database password, so it is created owner-only (0600) — writeFileSync's
 * mode is masked by umask, so chmod the temp file explicitly before rename
 * (rename keeps the temp file's mode, so rewrites stay 0600 too).
 */
export function saveConfig(c: SyncConfig, path: string = defaultConfigPath()): void {
    const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
}

/** Watch the config file; bursts are debounced (300ms). Returns a disposer. */
export function watchConfig(path: string, cb: (c: SyncConfig) => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watcher = watch(dirname(path), (event, filename) => {
        if (filename !== basename(path))
            return;
        if (event !== 'change' && event !== 'rename')
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            cb(loadConfig(path).config);
        }, 300);
    });
    return () => {
        if (timer)
            clearTimeout(timer);
        watcher.close();
    };
}

/** Percent-encode a URL component (protects / : @ % etc.). */
function enc(s: string): string {
    return encodeURIComponent(s);
}

/** Build a connection URL from discrete form fields; sqlite → file:<path>. */
export function configToUrl(c: SyncConfig): string {
    // Percent-encode each path segment: spaces/?/#/% would otherwise be parsed
    // as URL structure (query/fragment) or misread by the sqlite adapter.
    if (c.provider === 'sqlite')
        return `file:${c.database.split('/').map(enc).join('/')}`;
    const auth = c.user || c.password ? `${enc(c.user)}:${enc(c.password)}@` : '';
    return `${c.provider}://${auth}${c.host}:${c.port}/${enc(c.database)}`;
}
