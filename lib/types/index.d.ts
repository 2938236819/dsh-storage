/**
 * dsh-storage — mirrors the dsh session event stream into the ai_messages /
 * ai_chat_histories tables (MySQL/PostgreSQL/SQLite/SQL Server).
 *
 * Design: dsh's own session persistence (JSONL/SQLite) stays authoritative.
 * This plugin taps `session/event` (the same seam the built-in persistence
 * coordinator uses) and projects events into MessageRow / SessionRow shaped
 * after the source project's ai_messages / ai_chat_histories tables.
 *
 * A2A task state (task metadata in Redis, workspace archives in GCS) is NOT
 * here — that belongs to the A2A layer, see dsh-a2a's TaskStore backends.
 *
 * Resume caveat (docs/subsystems/persistence.md): constructor seeds do not
 * emit events. On agent resume, only events >= `session.firstLiveSeq` fire
 * on this stream — historical rows must come from the database itself, not
 * from replaying the tap.
 *
 * @module dsh-storage
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { type DatabaseProvider } from './backends/database.js';
import { type BackfillSummary } from './backfill.js';
import { type SyncConfig } from './config.js';
import { type CreateTableResult } from './ddl.js';
import { type ConnectionTestResult, type HealthStatus } from './health.js';
import { type StorageToast } from './notify.js';
export declare const name = "dsh-storage";
export declare const inject: string[];
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    database: Schema<Schemastery.ObjectS<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        provider: Schema<"mysql" | "postgresql" | "sqlite" | "sqlserver", "mysql" | "postgresql" | "sqlite" | "sqlserver", "defined">;
        url: Schema<string, string, "defined">;
        timezone: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        provider: Schema<"mysql" | "postgresql" | "sqlite" | "sqlserver", "mysql" | "postgresql" | "sqlite" | "sqlserver", "defined">;
        url: Schema<string, string, "defined">;
        timezone: Schema<string, string, "defined">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    database: Schema<Schemastery.ObjectS<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        provider: Schema<"mysql" | "postgresql" | "sqlite" | "sqlserver", "mysql" | "postgresql" | "sqlite" | "sqlserver", "defined">;
        url: Schema<string, string, "defined">;
        timezone: Schema<string, string, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enabled: Schema<boolean, boolean, "defined">;
        provider: Schema<"mysql" | "postgresql" | "sqlite" | "sqlserver", "mysql" | "postgresql" | "sqlite" | "sqlserver", "defined">;
        url: Schema<string, string, "defined">;
        timezone: Schema<string, string, "defined">;
    }>>, "plain">;
}>>, "plain">;
export interface StoragePluginConfig {
    enabled: boolean;
    database: {
        enabled: boolean;
        provider: DatabaseProvider;
        url: string;
        timezone?: string;
    };
}
/** Explicit write API for a consumer's session-clear flow. */
export interface DshStorageService {
    archiveSession(sessionId: string): Promise<string | null>;
}
/** Status/health RPC for the settings panel (Task 5) and notifications (Task 6). */
export interface DshStorageStatusService {
    snapshot(): HealthStatus;
    testConnection(cfg: SyncConfig): Promise<ConnectionTestResult>;
    /** Panel 「建表」: provider-appropriate DDL via packaged prisma schemas. */
    createTables(cfg: SyncConfig): Promise<CreateTableResult>;
    /** Panel form load/persist — the file the backend watches (T3). */
    getConfig(): {
        config: SyncConfig;
        error?: 'parse' | 'missing-field';
    };
    saveConfig(cfg: SyncConfig): {
        config: SyncConfig;
    };
    /** Panel 「补传」 (T6): replay gap events from local session logs. */
    backfill(): Promise<BackfillSummary>;
    /** Toast notifications newer than the cursor (client polling, T6). */
    toasts(payload: {
        sinceId?: number;
    }): StorageToast[];
}
export declare function apply(ctx: Context, config: StoragePluginConfig): void;
