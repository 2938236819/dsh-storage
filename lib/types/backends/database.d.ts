/**
 * MySQL/PostgreSQL/SQLite/SQL Server backend via Prisma 7. The clients are
 * pre-generated at package build time (`pnpm generate`, see
 * scripts/prisma-generate.mjs) from the schema variants in prisma/ and
 * shipped compiled in lib/generated — consumers never run `prisma generate`.
 *
 * Prisma 7 requires a driver adapter per database; `@prisma/client` and the
 * adapter for your provider are optional peer dependencies (sqlite uses
 * `@prisma/adapter-libsql` — no native build scripts, unlike
 * `@prisma/adapter-better-sqlite3`). Table creation
 * (`prisma db push` / migrations) uses the shipped schema variant with the
 * connection URL in the user's prisma.config.ts.
 */
import type { MessageRow, SessionRow, StorageBackend } from '../types.js';
export type DatabaseProvider = 'mysql' | 'postgresql' | 'sqlite' | 'sqlserver';
export interface DatabaseBackendConfig {
    provider: DatabaseProvider;
    /** Full connection URL, e.g. mysql://user:pass@host:3306/dbname, file:/data/dsh.db */
    url: string;
    /**
     * IANA-named offset for the mariadb driver's `timezone` option (e.g.
     * '+08:00'), applied when writing DATETIME columns. Only used by mysql.
     */
    timezone?: string;
    /**
     * Device identifier stamped on every ai_messages / ai_chat_histories row
     * this backend writes, so several machines can share one database.
     * Falls back to the OS hostname when unset.
     */
    device?: string;
}
/**
 * Parse mysql://user:password@host[:port]/database into discrete connection
 * options for the mariadb driver adapter. Passing the URI string itself
 * pool-times-out in production (verified against a real MySQL 8.4);
 * discrete host/port/user/password/database options work. Components are
 * percent-decoded — credentials with @ : / arrive encoded in the URL.
 */
export declare function parseMysqlUrl(url: string): {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
};
export declare function createAdapter(config: DatabaseBackendConfig): Promise<unknown>;
export declare class DatabaseBackend implements StorageBackend {
    private config;
    readonly name = "database";
    private prisma;
    constructor(config: DatabaseBackendConfig);
    /** Device identifier stamped on rows written through this backend. */
    private get device();
    private client;
    /** Load the pre-generated client for the configured provider (seam for tests). */
    protected loadClient(): Promise<any>;
    init(): Promise<void>;
    /** JSON column value, text-serialized on SQL Server (no Prisma Json type). */
    private jsonField;
    private toDbData;
    private writeMessage;
    upsertMessage(row: MessageRow): Promise<void>;
    readMessages(sessionId: string, messageId: string): Promise<MessageRow[]>;
    readToolCallMessages(sessionId: string, callId: string): Promise<MessageRow[]>;
    private readRows;
    readSession(sessionId: string): Promise<SessionRow | null>;
    /**
     * Max created_at per session over active message rows — the database-side
     * watermark for backfill gap detection (sessions with newer local logs
     * have missing events).
     */
    latestPerSession(): Promise<Map<string, Date>>;
    private writeSession;
    upsertSession(row: SessionRow): Promise<void>;
    upsertEvent(message: MessageRow | null, session: SessionRow): Promise<void>;
    archiveSession(sessionId: string): Promise<string | null>;
    close(): Promise<void>;
}
