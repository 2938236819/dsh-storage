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
import { createAdapter } from './backends/database.js';
import { configToUrl, loadConfig, defaultConfigPath } from './config.js';
/** argType record for one bound value (see module docstring). */
function argTypeOf(value) {
    if (typeof value === 'number')
        return Number.isInteger(value) ? { scalarType: 'int', arity: 'scalar' } : { scalarType: 'float', arity: 'scalar' };
    return { scalarType: 'string', arity: 'scalar' };
}
/** Build the query envelope: placeholders derive from the bound args. */
function rawQuery(sql, args) {
    return { sql, args, argTypes: args.map(argTypeOf) };
}
/**
 * Escape LIKE wildcards in user input for use with `ESCAPE '~'`:
 * `~` (the escape character itself), `%` and `_`. Everything else stays
 * literal, so keywords match plain substrings.
 */
export function escapeLike(value) {
    return value.replace(/[~%_]/g, (ch) => `~${ch}`);
}
/** Split a free-text query into non-empty keyword terms. */
export function splitKeywords(query) {
    return query.split(/\s+/).filter((term) => term.length > 0);
}
/** Clamp limit to the [1, 100] band. */
function clampLimit(value, fallback) {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
    return Math.min(100, Math.max(1, n));
}
/**
 * Build the memory_search SELECT. Keywords OR across user+model rows
 * (no type filter); `device:'current'` binds the configured device id;
 * `since` (YYYY-MM-DD) filters `created_at >=` with an ISO 'T' delimiter so
 * the string comparison also matches sqlite's TEXT timestamps.
 */
export function buildSearchSql(provider, opts, deviceId) {
    const keywords = splitKeywords(opts.query);
    const limit = clampLimit(opts.limit, 20);
    const args = [];
    const likeTerms = keywords.map((keyword) => {
        args.push(`%${escapeLike(keyword)}%`);
        return `content LIKE ? ESCAPE '~'`;
    });
    const conditions = ['deleted_at IS NULL', 'content IS NOT NULL'];
    if (likeTerms.length > 0)
        conditions.push(`(${likeTerms.join(' OR ')})`);
    if (opts.device === 'current') {
        conditions.push('device = ?');
        args.push(deviceId ?? '');
    }
    if (opts.since) {
        conditions.push('created_at >= ?');
        args.push(`${opts.since}T00:00:00`);
    }
    const columns = 'session_id, device, type, content, created_at';
    const where = conditions.join(' AND ');
    // sqlserver has no LIMIT — TOP n (n is our clamped number, safe to inline).
    const sql = provider === 'sqlserver'
        ? `SELECT TOP ${limit} ${columns} FROM ai_messages WHERE ${where} ORDER BY created_at DESC, id DESC`
        : `SELECT ${columns} FROM ai_messages WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`;
    if (provider !== 'sqlserver')
        args.push(limit);
    return { sql, args, argTypes: args.map(argTypeOf) };
}
/**
 * Build the memory_read SELECT. Both cases fetch the newest-first (DESC)
 * `limit`-row window — with `around`, at-or-before the instant; without it,
 * the most recent `limit` rows of the session. The executor always reverses
 * the rows to chronological order before handing them to the model.
 */
export function buildReadSql(provider, opts) {
    const limit = clampLimit(opts.limit, 30);
    const args = [opts.sessionId];
    let where = 'session_id = ? AND deleted_at IS NULL';
    if (opts.around) {
        where += ' AND created_at <= ?';
        args.push(opts.around);
    }
    const columns = 'type, content, created_at';
    const sql = provider === 'sqlserver'
        ? `SELECT TOP ${limit} ${columns} FROM ai_messages WHERE ${where} ORDER BY created_at DESC, id DESC`
        : `SELECT ${columns} FROM ai_messages WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`;
    args.push(limit);
    return { sql, args, argTypes: args.map(argTypeOf) };
}
/**
 * Normalize adapter query results to row objects. The 7.9.1 adapters return
 * `{ columnNames, rows: value[][] }`; tests and older shapes may already
 * produce arrays of objects.
 */
export function normalizeRows(result) {
    if (Array.isArray(result))
        return result.filter((row) => row && typeof row === 'object');
    if (result && typeof result === 'object') {
        const { columnNames, rows } = result;
        if (Array.isArray(columnNames) && Array.isArray(rows))
            return rows
                .filter((row) => Array.isArray(row))
                .map((row) => Object.fromEntries(columnNames.map((name, i) => [name, row[i]])));
    }
    return [];
}
/** ISO string for a timestamp cell (mariadb already maps to ISO strings). */
function isoOf(value) {
    if (value instanceof Date)
        return value.toISOString();
    return typeof value === 'string' ? value : String(value ?? '');
}
/** First-index snippet ≤ max chars centered on the earliest keyword hit. */
export function snippetOf(content, keywords, max = 160) {
    const text = content.replace(/\s+/g, ' ').trim();
    let start = 0;
    for (const keyword of keywords) {
        const index = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (index > 20) {
            start = Math.max(0, index - 40);
            break;
        }
    }
    const snippet = text.slice(start, start + (start > 0 ? max - 1 : max));
    return start > 0 ? `…${snippet}` : snippet;
}
/** Shape the memory_search result list. */
export function toSearchHits(rows, keywords) {
    return rows.map((row) => ({
        session_id: String(row.session_id ?? ''),
        device: row.device == null ? null : String(row.device),
        type: String(row.type ?? ''),
        created_at: isoOf(row.created_at),
        snippet: snippetOf(String(row.content ?? ''), keywords),
    }));
}
/** Shape the memory_read conversation window. */
export function toReadMessages(rows, max = 500) {
    return rows.map((row) => {
        const type = String(row.type ?? '');
        const content = String(row.content ?? '');
        const truncated = content.length > max ? `${content.slice(0, max - 1)}…` : content;
        return {
            role: type === 'user' ? 'user' : type === 'model' ? 'assistant' : type,
            type,
            created_at: isoOf(row.created_at),
            content: truncated,
        };
    });
}
/** Friendly unconfigured-config error (shown to the model). */
export function notConfiguredError(reason) {
    return new Error(`会话存储未配置或未启用 (session storage not configured${reason ? `: ${reason}` : ''}) — 请先在设置的「会话存储」面板配置并启用同步 / configure and enable sync in the 会话存储 settings panel first.`);
}
/** Load the sync config and reject unless sync is enabled and complete. */
export function requireConfig(configPath = defaultConfigPath()) {
    const { config, error } = loadConfig(configPath);
    if (error === 'parse')
        throw notConfiguredError('配置文件损坏 config file unparseable');
    if (error === 'missing-field')
        throw notConfiguredError('配置字段缺失 missing fields');
    if (!config.enabled || !config.database)
        throw notConfiguredError('未启用 disabled');
    return config;
}
/** Open a one-shot read-only adapter connection; caller disposes. */
export async function connectReadOnly(config) {
    const factory = (await createAdapter({
        provider: config.provider,
        url: configToUrl(config),
        timezone: config.timezone,
    }));
    return factory.connect();
}
/** Run one SELECT over the connection and return row objects. */
export async function runSelect(connection, query) {
    if (typeof connection.queryRaw !== 'function')
        throw new Error('dsh-storage adapter connection does not support queryRaw');
    return normalizeRows(await connection.queryRaw(query));
}
const TOOL_NAMES = { search: 'memory_search', read: 'memory_read' };
/** Output envelope: model-visible text is the JSON of the result value. */
function jsonOutput(schema) {
    return {
        schema,
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    };
}
function objectSchema(properties, required) {
    return { type: 'object', properties, required, additionalProperties: false };
}
const stringProp = (description) => ({ type: 'string', description });
const intProp = (description) => ({ type: 'integer', description });
/**
 * Build the two tool definitions. `deps.connect` defaults to a real
 * read-only adapter connection created from the sync config and disposed
 * after each execution.
 */
export function createMemoryTools(deps = {}) {
    const connect = deps.connect ?? connectReadOnly;
    const configPath = deps.configPath;
    const withConnection = async (exec, run) => {
        if (exec.signal?.aborted)
            throw new Error('memory query aborted');
        const config = requireConfig(configPath);
        const connection = await connect(config);
        try {
            return await run(connection, config);
        }
        finally {
            await connection.dispose?.().catch((error) => {
                console.error('[dsh-storage] memory tool dispose failed:', error);
            });
        }
    };
    return [
        {
            name: TOOL_NAMES.search,
            description: '【仅当用户明确要求查询历史/跨设备记忆时才调用，不要主动调用】搜索远程会话记忆库（跨设备的历史对话）/ Search the mirrored session memory store (cross-device conversation history). ' +
                'Keywords match user AND assistant message content (SQL LIKE, OR semantics). ' +
                'Use when recalling previous conversations, facts, decisions, or what was said on any device. ' +
                'Returns {session_id, device, type, created_at, snippet} ordered newest-first; follow up with memory_read for context.',
            parameters: objectSchema({
                query: stringProp('关键词，空格分隔多个词 / keywords, space-separated (AND-free OR matching)'),
                device: {
                    type: 'string',
                    enum: ['all', 'current'],
                    description: "'all'（默认）搜索所有设备写入的行；'current' 仅限本机设备 / scope of device-stamped rows, default all",
                },
                limit: intProp('返回条数上限，默认 20，最大 100 / max hits, default 20, max 100'),
                since: stringProp('可选，仅返回该日期（YYYY-MM-DD）之后的记录 / optional lower date bound YYYY-MM-DD'),
            }, ['query']),
            output: jsonOutput({
                type: 'object',
                properties: {
                    hits: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                session_id: { type: 'string' },
                                // The host validator (dsh-tools assertSupportedJsonSchema) rejects
                                // array-form `type` and `anyOf`; `oneOf` is the supported nullable form.
                                device: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                                type: { type: 'string' },
                                created_at: { type: 'string' },
                                snippet: { type: 'string' },
                            },
                            required: ['session_id', 'type', 'created_at', 'snippet'],
                        },
                    },
                },
                required: ['hits'],
            }),
            execute: (args, exec) => withConnection(exec, async (connection, config) => {
                const query = typeof args?.query === 'string' ? args.query : '';
                const keywords = splitKeywords(query);
                if (keywords.length === 0)
                    return { hits: [] };
                const plan = buildSearchSql(config.provider, {
                    query,
                    ...(args?.device === 'current' ? { device: 'current' } : {}),
                    ...(typeof args?.limit === 'number' ? { limit: args.limit } : {}),
                    ...(typeof args?.since === 'string' && args.since ? { since: args.since } : {}),
                }, config.device);
                const rows = await runSelect(connection, plan);
                return { hits: toSearchHits(rows, keywords) };
            }),
        },
        {
            name: TOOL_NAMES.read,
            description: '【仅当用户明确要求查询历史/跨设备记忆时才调用，不要主动调用】读取远程记忆库中某次会话的对话上下文 / Read the conversation context of one session from the remote memory store. ' +
                'Use after memory_search to see what happened around a hit: messages are returned in chronological order ' +
                '(with `around`, the window ends at that instant; without it, the most recent `limit` messages), ' +
                'each truncated to ≤500 chars. Read-only.',
            parameters: objectSchema({
                session_id: stringProp('memory_search 返回的 session_id / session id from memory_search'),
                around: stringProp('可选，ISO 日期时间；返回该时刻（含）之前的窗口 / optional ISO datetime center'),
                limit: intProp('返回消息条数上限，默认 30，最大 100 / max messages, default 30, max 100'),
            }, ['session_id']),
            output: jsonOutput({
                type: 'object',
                properties: {
                    session_id: { type: 'string' },
                    messages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                role: { type: 'string' },
                                type: { type: 'string' },
                                created_at: { type: 'string' },
                                content: { type: 'string' },
                            },
                            required: ['role', 'type', 'created_at', 'content'],
                        },
                    },
                },
                required: ['session_id', 'messages'],
            }),
            execute: (args, exec) => withConnection(exec, async (connection, config) => {
                const sessionId = typeof args?.session_id === 'string' ? args.session_id : '';
                if (!sessionId)
                    return { session_id: '', messages: [] };
                const plan = buildReadSql(config.provider, {
                    sessionId,
                    ...(typeof args?.around === 'string' && args.around ? { around: args.around } : {}),
                    ...(typeof args?.limit === 'number' ? { limit: args.limit } : {}),
                });
                const rows = await runSelect(connection, plan);
                // Both windows (with and without `around`) were fetched newest-first;
                // the model always receives chronological (ascending) order.
                return {
                    session_id: sessionId,
                    messages: toReadMessages([...rows].reverse()),
                };
            }),
        },
    ];
}
/**
 * Register the memory tools on the host `tools` service (dsh-tools):
 * `ctx.inject(['tools'], (toolCtx) => toolCtx.effect(() => tools.register(def)))`
 * — the ds-harness-remote idiom. Tools are host-side only; nothing client-side.
 */
export function registerMemoryTools(ctx, deps = {}) {
    ctx.inject(['tools'], (toolCtx) => {
        const tools = toolCtx.get('tools');
        if (!tools || typeof tools.register !== 'function') {
            console.error('[dsh-storage] tools service missing — memory tools not registered');
            return;
        }
        for (const definition of createMemoryTools(deps))
            toolCtx.effect(() => tools.register(definition));
    });
}
