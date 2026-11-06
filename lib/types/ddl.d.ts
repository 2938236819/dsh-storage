import { type SyncConfig } from './config.js';
export type CreateTableResult = 'ok' | `fail:${string}`;
/**
 * MySQL DDL — captured from Prisma 7.9 `db push` of
 * prisma/schema.mysql.prisma (MySQL 8.4) via SHOW CREATE TABLE. Column
 * types must match the schema exactly: char(36) ids, varchar lengths,
 * longtext content, json columns, timestamp(0) message timestamps,
 * datetime(6) history timestamps. ai_chat_histories is created first —
 * ai_messages carries a foreign key into it.
 */
export declare const MYSQL_DDL: string[];
/**
 * SQLite DDL — captured from Prisma 7.9 `db push` of
 * prisma/schema.sqlite.prisma (sqlite_master dump), converted to
 * IF NOT EXISTS forms. The histories table precedes the FK-carrying
 * messages table.
 */
export declare const SQLITE_DDL: string[];
/** Embedded DDL statements for a provider; undefined → prisma-CLI fallback. */
export declare function ddlStatementsFor(provider: SyncConfig['provider']): readonly string[] | undefined;
/**
 * Create the ai_messages / ai_chat_histories tables for `cfg.provider`.
 * mysql/sqlite run embedded idempotent DDL over the adapter connection;
 * postgresql/sqlserver shell out to `prisma db push` against the packaged
 * schema variant (requires the prisma CLI — a devDependency).
 */
export declare function createTables(cfg: SyncConfig): Promise<CreateTableResult>;
