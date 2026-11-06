/**
 * Table creation for the settings panel's 「建表」 button.
 *
 * The DDL is EMBEDDED in the package (brief: “SQL 内嵌于包”): `prisma` is a
 * devDependency, so end users don't have the CLI — shelling out to
 * `npx prisma db push` would download prisma from the network at
 * button-click (slow, offline-fail). Instead, the statements prisma emits
 * were captured locally (Prisma 7.9 `prisma db push` against a throwaway
 * database per provider) and are executed over the same driver-adapter
 * connection path the health probe uses (`createAdapter` → `connect()` →
 * raw execution) — no prisma CLI, no network, no generated client.
 *
 * Providers with embedded DDL: mysql, sqlite (captured from
 * prisma/schema.{mysql,sqlite}.prisma). postgresql/sqlserver fall back to
 * the packaged-schema `prisma db push` route; on failure the `fail:`
 * message states that the prisma CLI is required.
 *
 * Every failure maps to a `fail:<reason>` string; this never throws.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAdapter } from './backends/database.js';
import { defaultDevice, configToUrl } from './config.js';
/**
 * MySQL DDL — captured from Prisma 7.9 `db push` of
 * prisma/schema.mysql.prisma (MySQL 8.4) via SHOW CREATE TABLE. Column
 * types must match the schema exactly: char(36) ids, varchar lengths,
 * longtext content, json columns, timestamp(0) message timestamps,
 * datetime(6) history timestamps. ai_chat_histories is created first —
 * ai_messages carries a foreign key into it.
 */
export const MYSQL_DDL = [
    `CREATE TABLE IF NOT EXISTS \`ai_chat_histories\` (
  \`id\` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`session_id\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`title\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`summary\` text COLLATE utf8mb4_unicode_ci,
  \`message_count\` int NOT NULL DEFAULT '0',
  \`total_tokens\` bigint NOT NULL DEFAULT '0',
  \`first_message_at\` datetime(6) DEFAULT NULL,
  \`last_message_at\` datetime(6) DEFAULT NULL,
  \`metadata\` json DEFAULT NULL,
  \`deleted_at\` datetime(6) DEFAULT NULL,
  \`device\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_chat_history_session\` (\`session_id\`),
  KEY \`idx_chat_history_deleted\` (\`deleted_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`ai_messages\` (
  \`id\` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`session_id\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`history_id\` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`content\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  \`thoughts\` json DEFAULT NULL,
  \`model\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`tokens\` json DEFAULT NULL,
  \`tool_calls\` json DEFAULT NULL,
  \`agent_id\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`metadata\` json DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`deleted_at\` timestamp NULL DEFAULT NULL,
  \`device\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_session\` (\`session_id\`),
  KEY \`idx_history\` (\`history_id\`),
  KEY \`idx_created\` (\`created_at\`),
  KEY \`idx_deleted\` (\`deleted_at\`),
  KEY \`idx_agent\` (\`agent_id\`),
  KEY \`idx_session_agent_type_created\` (\`session_id\`,\`agent_id\`,\`type\`,\`created_at\`),
  KEY \`idx_tool_call_lookup\` (\`session_id\`,\`history_id\`,\`deleted_at\`,\`type\`,\`created_at\`,\`id\`),
  KEY \`idx_archive_recovery\` (\`session_id\`,\`deleted_at\`,\`updated_at\`,\`id\`),
  CONSTRAINT \`ai_messages_history_id_fkey\` FOREIGN KEY (\`history_id\`) REFERENCES \`ai_chat_histories\` (\`id\`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
/**
 * SQLite DDL — captured from Prisma 7.9 `db push` of
 * prisma/schema.sqlite.prisma (sqlite_master dump), converted to
 * IF NOT EXISTS forms. The histories table precedes the FK-carrying
 * messages table.
 */
export const SQLITE_DDL = [
    `CREATE TABLE IF NOT EXISTS "ai_chat_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" BIGINT NOT NULL DEFAULT 0,
    "first_message_at" DATETIME,
    "last_message_at" DATETIME,
    "metadata" JSONB,
    "deleted_at" DATETIME,
    "device" TEXT
)`,
    `CREATE TABLE IF NOT EXISTS "ai_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "history_id" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "thoughts" JSONB,
    "model" TEXT,
    "tokens" JSONB,
    "tool_calls" JSONB,
    "agent_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    "device" TEXT,
    CONSTRAINT "ai_messages_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "ai_chat_histories" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
)`,
    `CREATE INDEX IF NOT EXISTS "idx_session" ON "ai_messages"("session_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_history" ON "ai_messages"("history_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_created" ON "ai_messages"("created_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_deleted" ON "ai_messages"("deleted_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_agent" ON "ai_messages"("agent_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_session_agent_type_created" ON "ai_messages"("session_id", "agent_id", "type", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "idx_tool_call_lookup" ON "ai_messages"("session_id", "history_id", "deleted_at", "type", "created_at", "id")`,
    `CREATE INDEX IF NOT EXISTS "idx_archive_recovery" ON "ai_messages"("session_id", "deleted_at", "updated_at", "id")`,
    `CREATE INDEX IF NOT EXISTS "idx_chat_history_session" ON "ai_chat_histories"("session_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_chat_history_deleted" ON "ai_chat_histories"("deleted_at")`,
];
const EMBEDDED_DDL = {
    mysql: MYSQL_DDL,
    sqlite: SQLITE_DDL,
};
/** Embedded DDL statements for a provider; undefined → prisma-CLI fallback. */
export function ddlStatementsFor(provider) {
    return EMBEDDED_DDL[provider];
}
/** Create the tables by running the embedded DDL over a driver adapter. */
async function runEmbeddedDdl(cfg, statements) {
    let connection;
    try {
        const factory = (await createAdapter({
            provider: cfg.provider,
            url: configToUrl(cfg),
            timezone: cfg.timezone,
        }));
        connection = await factory.connect();
        for (const statement of statements) {
            await connection.executeRaw({ sql: statement, args: [] });
        }
        return 'ok';
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `fail:${message.slice(0, 300)}`;
    }
    finally {
        await connection?.dispose?.().catch((error) => {
            console.error('[dsh-storage] connection dispose failed:', error);
        });
    }
}
/* ------------------------------------------------------------------ *
 * Device-column migration (multi-device shared database support).
 * ------------------------------------------------------------------ */
const DEVICE_MIGRATION_DDL = [
    'ALTER TABLE `ai_messages` ADD COLUMN `device` varchar(100) NULL',
    'ALTER TABLE `ai_chat_histories` ADD COLUMN `device` varchar(100) NULL',
];
/**
 * Ensure both tables carry the nullable `device` column, then stamp every
 * still-NULL row with `device` (the current machine's identifier — at
 * migration time this machine owns all pre-feature rows). Executed by the
 * panel's 「建表」 (createTables) and once per mirror startup; a no-op when
 * the columns already exist (cheap information_schema check). mysql only —
 * the other providers gain the column via their prisma schema `db push`.
 *
 * Returns 'ok' or a `fail:<reason>` string; never throws.
 */
export async function ensureDeviceColumn(cfg, device = defaultDevice()) {
    if (cfg.provider !== 'mysql')
        return 'ok';
    let connection;
    try {
        const factory = (await createAdapter({
            provider: cfg.provider,
            url: cfg.url,
            timezone: cfg.timezone,
        }));
        connection = await factory.connect();
        // How many of the two tables already have `device`? One aggregate
        // query over information_schema — cheap on every mirror start.
        const present = countOf(await runQuery(connection, `SELECT COUNT(*) AS n FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND column_name = 'device'
                    AND table_name IN ('ai_messages', 'ai_chat_histories')`));
        if (present < DEVICE_MIGRATION_DDL.length) {
            for (const statement of DEVICE_MIGRATION_DDL)
                await connection.executeRaw({ sql: statement, args: [] });
        }
        // Stamp pre-feature rows with this machine's identifier (NULL means
        // "unknown/pre-feature" only until the owner migrates). Rows written
        // after the feature always carry their writer's device, so this only
        // ever touches pre-feature rows — including databases whose columns
        // were created earlier (e.g. by prisma db push) but never stamped.
        const unstamped = countOf(await runQuery(connection, `SELECT (SELECT COUNT(*) FROM \`ai_messages\` WHERE \`device\` IS NULL)
                   + (SELECT COUNT(*) FROM \`ai_chat_histories\` WHERE \`device\` IS NULL) AS n`));
        if (unstamped > 0) {
            // The mariadb adapter's executeRaw indexes query.argTypes[i], which
            // only the prisma engine populates — a direct adapter call with
            // bound parameters throws. Inline a sanitized literal instead
            // (device identifiers are hostnames; quotes/backticks/NUL are
            // stripped before embedding).
            const literal = sqlString(device);
            for (const table of ['ai_messages', 'ai_chat_histories'])
                await connection.executeRaw({
                    sql: `UPDATE \`${table}\` SET \`device\` = '${literal}' WHERE \`device\` IS NULL`,
                    args: [],
                });
        }
        return 'ok';
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `fail:${message.slice(0, 300)}`;
    }
    finally {
        await connection?.dispose?.().catch((error) => {
            console.error('[dsh-storage] connection dispose failed:', error);
        });
    }
}
/**
 * Sanitize a device identifier for direct embedding into the migration SQL
 * (no bound parameters — see ensureDeviceColumn). Strips quote, backslash,
 * backtick and NUL characters and truncates to the column width; the value
 * is still wrapped in single quotes at the call site.
 */
export function sqlString(device) {
    return device.replace(/['"\\`\u0000]/g, '').slice(0, 100);
}
/** Run a read query over the adapter connection (queryRaw when available). */
async function runQuery(connection, sql) {
    const query = { sql, args: [] };
    return connection.queryRaw ? connection.queryRaw(query) : connection.executeRaw(query);
}
/**
 * Read the scalar COUNT(*) out of an adapter query result. Shapes seen in the
 * wild: a plain array of row objects ([[{n:2}]]) and the mariadb adapter's
 * result set ({ columnNames, rows } with positional row arrays).
 */
function countOf(rows) {
    let data = rows;
    if (data && typeof data === 'object' && !Array.isArray(data))
        data = data.rows ?? data;
    const first = Array.isArray(data) ? data[0] : data;
    if (Array.isArray(first))
        return countOf(first);
    if (first && typeof first === 'object') {
        const value = Object.values(first)[0];
        const count = Number(value);
        return Number.isFinite(count) ? count : 0;
    }
    return Number(first) || 0;
}
/* ------------------------------------------------------------------ *
 * prisma-CLI fallback (postgresql / sqlserver — no embedded DDL yet).
 * ------------------------------------------------------------------ */
/** The package's prisma/ directory: lib/../prisma installed, src/../prisma in dev. */
function prismaDir() {
    return join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma');
}
function run(args, opts) {
    return new Promise((resolve) => {
        execFile('npx', args, { cwd: opts.cwd, timeout: opts.timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
            // execFile reports a nonzero exit as an Error carrying the streams.
            if (error && typeof error.code !== 'number') {
                resolve({ code: -1, stdout: String(stdout ?? ''), stderr: String(stderr ?? error.message) });
                return;
            }
            resolve({
                code: error ? Number(error.code) : 0,
                stdout: String(stdout ?? ''),
                stderr: String(stderr ?? ''),
            });
        });
    });
}
/** First non-empty line of the prisma CLI output, for a short fail: reason. */
function firstReason(parts) {
    for (const part of parts) {
        for (const line of part.split('\n')) {
            const trimmed = line.trim();
            if (trimmed)
                return trimmed.slice(0, 300);
        }
    }
    return 'unknown prisma db push failure';
}
/**
 * Create the ai_messages / ai_chat_histories tables for `cfg.provider`.
 * mysql/sqlite run embedded idempotent DDL over the adapter connection;
 * postgresql/sqlserver shell out to `prisma db push` against the packaged
 * schema variant (requires the prisma CLI — a devDependency).
 */
export async function createTables(cfg) {
    const statements = ddlStatementsFor(cfg.provider);
    if (statements) {
        const created = await runEmbeddedDdl(cfg, statements);
        if (created !== 'ok')
            return created;
        // Fresh tables may predate the device column on an existing database —
        // run the migration after the DDL (it is a no-op when columns exist).
        return ensureDeviceColumn({ provider: cfg.provider, url: configToUrl(cfg), timezone: cfg.timezone });
    }
    const provider = cfg.provider;
    const schema = join(prismaDir(), `schema.${provider}.prisma`);
    try {
        const { code, stdout, stderr } = await run(['prisma', 'db', 'push', '--schema', schema, '--url', configToUrl(cfg), '--accept-data-loss'], { cwd: prismaDir(), timeoutMs: 120_000 });
        if (code === 0)
            return 'ok';
        return `fail:${provider} 建表需要 prisma CLI（开发依赖，未随包分发）——${firstReason([stderr, stdout])}`;
    }
    catch (error) {
        return `fail:${provider} 建表需要 prisma CLI（开发依赖，未随包分发）——${error instanceof Error ? error.message : String(error)}`;
    }
}
