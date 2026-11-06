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
export declare const MYSQL_DDL: readonly string[];
/**
 * SQLite DDL — captured from Prisma 7.9 `db push` of
 * prisma/schema.sqlite.prisma (sqlite_master dump), converted to
 * IF NOT EXISTS forms. The histories table precedes the FK-carrying
 * messages table.
 */
export declare const SQLITE_DDL: readonly string[];
/** Embedded DDL statements for a provider; undefined → prisma-CLI fallback. */
export declare function ddlStatementsFor(provider: SyncConfig['provider']): readonly string[] | undefined;
/**
 * Create the ai_messages / ai_chat_histories tables for `cfg.provider`.
 * mysql/sqlite run embedded idempotent DDL over the adapter connection;
 * postgresql/sqlserver shell out to `prisma db push` against the packaged
 * schema variant (requires the prisma CLI — a devDependency).
 */
export declare function createTables(cfg: SyncConfig): Promise<CreateTableResult>;
