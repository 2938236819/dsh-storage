export type SyncConfig = {
    enabled: boolean;
    provider: 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    timezone: string;
};
export declare const DEFAULT_CONFIG: SyncConfig;
/** Resolve the DSH home directory: $DSH_HOME or ~/.dsh. */
export declare function dshHome(): string;
export declare function defaultConfigPath(): string;
/**
 * Parse a config timezone string ('+08:00', '-05:00', '+05:30', 'Z'/'UTC')
 * into signed minutes east of UTC. Invalid or absent input → 0 (the caller
 * decides whether to warn). This mirrors what the patched
 * @prisma/adapter-mariadb reads via globalThis.__DSH_STORAGE_TZ_OFFSET_MIN__.
 */
export declare function tzOffsetMinutes(tz: string): number;
/** Valid TCP port for the form: a finite integer in [0, 65535] (0 allowed for sqlite configs). */
export declare function isValidPort(value: unknown): value is number;
/**
 * First shape problem with a candidate sync config, or undefined when valid.
 * Field-specific reasons keep RPC rejections honest ('cfg.port must be…'
 * instead of a generic 'requires a cfg object').
 */
export declare function syncConfigProblem(value: unknown): string | undefined;
export declare function loadConfig(path?: string): {
    config: SyncConfig;
    error?: 'parse' | 'missing-field';
};
/**
 * Atomic write: temp file in the same directory + rename. The file holds the
 * database password, so it is created owner-only (0600) — writeFileSync's
 * mode is masked by umask, so chmod the temp file explicitly before rename
 * (rename keeps the temp file's mode, so rewrites stay 0600 too).
 */
export declare function saveConfig(c: SyncConfig, path?: string): void;
/** Watch the config file; bursts are debounced (300ms). Returns a disposer. */
export declare function watchConfig(path: string, cb: (c: SyncConfig) => void): () => void;
/** Build a connection URL from discrete form fields; sqlite → file:<path>. */
export declare function configToUrl(c: SyncConfig): string;
