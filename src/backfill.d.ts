/**
 * 断档补传 (gap backfill): after the mirror was down for a while, local
 * session logs (`$DSH_HOME/sessions/<workspace-dir>/<session-id>/session.v4
 * .jsonl` or its `.zstd` twin) hold events that never reached the database.
 *
 * computeGap picks the sessions whose latest local activity (file mtime) is
 * newer than what the database already has; replayEvents re-feeds the missing
 * events through the same projector the live tap uses, with idempotent
 * semantics — rows whose deterministic id already exists are skipped, so
 * running a backfill twice never duplicates data.
 *
 * zstd: fflate/gzip inflate cannot decode zstd frames — decompression shells
 * out to the system `zstd` binary (`zstd -dc`, falling back to `unzstd` /
 * `zstdcat`). When none of them exists the read fails with a clear error
 * naming the requirement (verified on macOS: /opt/homebrew/bin/zstd).
 */
import type { StorageBackend } from './types.js';
/** Exactly the event types the live tap mirrors (see index.ts session/event). */
export declare const MIRROR_EVENT_TYPES: readonly ["user/message", "assistant/message", "assistant/attempt", "tool/result", "turn/end", "session/title", "compaction/end"];
/** Metadata key for the usage high-water mark — shared with the live tap. */
export declare const LAST_USAGE_KEY = "dsh-storage:lastUsage";
/** One session with missing events: replay starts at `fromSeq` (inclusive). */
export interface BackfillGap {
    sessionId: string;
    fromSeq: number;
}
export interface BackfillSummary {
    /** Sessions whose events were replayed (excludes reported errors). */
    sessions: number;
    /** Message rows written by this run. */
    replayed: number;
    /** Events already present in the database (idempotent skips). */
    skipped: number;
    /** Per-session failures — one entry per session that could not be replayed. */
    errors: string[];
}
/**
 * Read one session log as text. Plain files are read directly; `.zstd` files
 * are decompressed through the first available system binary.
 */
export declare function readSessionLogText(file: string, binaries?: readonly string[]): Promise<string>;
/** Parse JSONL lines into event objects; malformed lines are skipped. */
export declare function parseSessionEvents(text: string): any[];
interface SessionLog {
    sessionId: string;
    file: string;
    mtime: Date;
}
/**
 * Enumerate session logs. Real DSH layout is
 * `<sessionsDir>/<workspace-dir>/<session-id>/session.v4.jsonl[.zstd]`
 * (two levels); a log directly under a child directory is also accepted so
 * a flattened sessions dir keeps working.
 */
export declare function listSessionLogs(sessionsDir: string): Promise<SessionLog[]>;
/**
 * Select sessions whose latest local activity (log mtime) is newer than the
 * database's last mirrored activity. Sessions absent from the database are
 * selected for a full replay (fromSeq 0) — but only when their log holds at
 * least one row-producing event; a log-only session mirrors no rows and its
 * "gap" would never converge. For known sessions `fromSeq` is the sequence
 * of the first row-producing event newer than the DB watermark.
 */
export declare function computeGap(sessionsDir: string, dbLatestPerSession: Map<string, Date>): Promise<BackfillGap[]>;
/** computeGap + replayEvents in one call, for the panel button. */
export declare function backfillAll(sessionsDir: string, backend: StorageBackend & {
    latestPerSession?(): Promise<Map<string, Date>>;
}): Promise<BackfillSummary>;
/**
 * Replay the missing events of each gap through the projector into the
 * backend. Idempotent: message rows whose deterministic id already exists
 * are skipped without error, and the session rollup is never double-counted.
 */
export declare function replayEvents(gaps: BackfillGap[], sessionsDir: string, backend: StorageBackend): Promise<BackfillSummary>;
export {};
