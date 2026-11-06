/**
 * AI-accessible memory query tools (Phase 2): `memory_search` / `memory_read`.
 *
 * Registration contract (verified against the running DSH runtime):
 * - `@deepseek-ai/dsh-tools` exposes a cordis `tools` service whose
 *   `register(definition)` inserts into the scoped tool layer; the definition
 *   is `{ name, description, parameters (plain JSON Schema), output: { schema,
 *   render(args, value) }, execute(args, exec), timeoutMs? }` (ToolsService
 *   inside the app bundle; working plugin idiom: ds-harness-remote
 *   `dist/remote-tools.js` → `ctx.inject(['tools'], (toolCtx) =>
 *   toolCtx.effect(() => tools.register(definition)))`).
 * - Tool names are flat global strings (`remote_list_hosts` style), so these
 *   tools are `memory_search` / `memory_read`.
 *
 * Read-only SELECTs over the same connection config the mirror uses
 * (createAdapter / configToUrl / loadConfig). Connections are disposed after
 * every call. All user input is parameter-bound; LIKE wildcards in user
 * keywords are escaped with an explicit `ESCAPE '~'` clause (works on all
 * four providers — avoids backslash, which MySQL also treats as a string
 * literal escape).
 *
 * Raw adapter binding detail (verified in @prisma/adapter-{mariadb,pg,mssql,libsql}
 * 7.9.1 sources): each adapter maps `query.args[i]` through
 * `mapArg(arg, query.argTypes[i])`, and the mssql adapter dereferences
 * `argType.scalarType` unconditionally — binding any argument without
 * argTypes throws (the ddl.ts comment describes this). The argType shape is
 * the client runtime's `{ scalarType, arity }` record ('string' | 'int' |
 * …, 'scalar' | 'list'), not the numeric ColumnTypeEnum. We therefore always
 * pass argTypes and never bind Date objects (ISO strings compare correctly
 * against DATETIME/TIMESTAMP/TEXT created_at on every provider).
 *
 * @module dsh-storage/memory-tools
 */
import { type DatabaseProvider } from './backends/database.js';
import { type SyncConfig } from './config.js';
/** Minimal cordis/tool surface we rely on — the package does not depend on dsh-tools types. */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render(args: unknown, value: unknown): Array<{
            type: string;
            text: string;
        }>;
    };
    execute(args: any, exec: {
        signal?: AbortSignal;
    }): Promise<unknown>;
}
export interface ToolRegistrarContext {
    inject(services: string[], callback: (ctx: ToolContext) => void): unknown;
}
export interface ToolContext {
    get(service: string): unknown;
    effect(factory: () => unknown): unknown;
}
/** One raw adapter query: `?` placeholders + positionally aligned args/argTypes. */
export interface RawQuery {
    sql: string;
    args: unknown[];
    argTypes: Array<{
        scalarType: string;
        arity: 'scalar';
    }>;
}
/**
 * Adapter connection from `createAdapter(...).connect()` (ddl.ts seam).
 * All four adapters' `queryRaw` return `{ columnNames, rows: unknown[][] }`.
 */
export interface RawConnection {
    queryRaw?(query: RawQuery): Promise<unknown>;
    executeRaw(query: RawQuery): Promise<unknown>;
    dispose?(): Promise<void>;
}
/**
 * Escape LIKE wildcards in user input for use with `ESCAPE '~'`:
 * `~` (the escape character itself), `%` and `_`. Everything else stays
 * literal, so keywords match plain substrings.
 */
export declare function escapeLike(value: string): string;
/** Split a free-text query into non-empty keyword terms. */
export declare function splitKeywords(query: string): string[];
export interface SearchPlanOptions {
    query: string;
    device?: 'all' | 'current';
    limit?: number;
    since?: string;
}
export interface SearchPlan {
    sql: string;
    args: unknown[];
    argTypes: Array<{
        scalarType: string;
        arity: 'scalar';
    }>;
}
/**
 * Build the memory_search SELECT. Keywords OR across user+model rows
 * (no type filter); `device:'current'` binds the configured device id;
 * `since` (YYYY-MM-DD) filters `created_at >=` with an ISO 'T' delimiter so
 * the string comparison also matches sqlite's TEXT timestamps.
 */
export declare function buildSearchSql(provider: DatabaseProvider, opts: SearchPlanOptions, deviceId?: string): SearchPlan;
export interface ReadPlanOptions {
    sessionId: string;
    around?: string;
    limit?: number;
}
/**
 * Build the memory_read SELECT. With `around` (ISO datetime) the window is
 * the `limit` most recent rows at-or-before the instant, reversed to
 * chronological order below; without it, the first `limit` rows.
 */
export declare function buildReadSql(provider: DatabaseProvider, opts: ReadPlanOptions): SearchPlan;
/**
 * Normalize adapter query results to row objects. The 7.9.1 adapters return
 * `{ columnNames, rows: value[][] }`; tests and older shapes may already
 * produce arrays of objects.
 */
export declare function normalizeRows(result: unknown): Array<Record<string, unknown>>;
/** First-index snippet ≤ max chars centered on the earliest keyword hit. */
export declare function snippetOf(content: string, keywords: string[], max?: number): string;
export interface SearchHit {
    session_id: string;
    device: string | null;
    type: string;
    created_at: string;
    snippet: string;
}
export interface ReadMessage {
    role: string;
    type: string;
    created_at: string;
    content: string;
}
/** Shape the memory_search result list. */
export declare function toSearchHits(rows: Array<Record<string, unknown>>, keywords: string[]): SearchHit[];
/** Shape the memory_read conversation window. */
export declare function toReadMessages(rows: Array<Record<string, unknown>>, max?: number): ReadMessage[];
/** Friendly unconfigured-config error (shown to the model). */
export declare function notConfiguredError(reason?: string): Error;
/** Load the sync config and reject unless sync is enabled and complete. */
export declare function requireConfig(configPath?: string): SyncConfig;
/** Open a one-shot read-only adapter connection; caller disposes. */
export declare function connectReadOnly(config: SyncConfig): Promise<RawConnection>;
/** Run one SELECT over the connection and return row objects. */
export declare function runSelect(connection: RawConnection, query: RawQuery): Promise<Array<Record<string, unknown>>>;
export interface MemoryToolsDeps {
    /** Config path override (tests); defaults to $DSH_HOME/dsh-storage.json. */
    configPath?: string;
    /** Connection factory override (tests): receives the resolved sync config. */
    connect?: (config: SyncConfig) => Promise<RawConnection>;
}
/**
 * Build the two tool definitions. `deps.connect` defaults to a real
 * read-only adapter connection created from the sync config and disposed
 * after each execution.
 */
export declare function createMemoryTools(deps?: MemoryToolsDeps): ToolDefinition[];
/**
 * Register the memory tools on the host `tools` service (dsh-tools):
 * `ctx.inject(['tools'], (toolCtx) => toolCtx.effect(() => tools.register(def)))`
 * — the ds-harness-remote idiom. Tools are host-side only; nothing client-side.
 */
export declare function registerMemoryTools(ctx: ToolRegistrarContext, deps?: MemoryToolsDeps): void;
