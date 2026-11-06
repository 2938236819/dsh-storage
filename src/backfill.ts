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
import { spawn } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { mergeToolResult, projectEvent, toolResultCallId, usageSampleOf } from './projector.js';
import type { MessageRow, StorageBackend } from './types.js';

/** Exactly the event types the live tap mirrors (see index.ts session/event). */
export const MIRROR_EVENT_TYPES = [
    'user/message',
    'assistant/message',
    'assistant/attempt',
    'tool/result',
    'turn/end',
    'session/title',
    'compaction/end',
] as const;

type MirrorEventType = (typeof MIRROR_EVENT_TYPES)[number];

interface MirrorEvent {
    type: string;
    seq?: number;
    time?: number;
    data?: Record<string, unknown>;
}

/**
 * Events that produce or update message rows. The database-side watermark is
 * the newest message row, so gap detection keys on these; log-only events
 * (turn/end, session/title, ...) ride along from `fromSeq` during replay but
 * cannot themselves indicate missing rows — otherwise a trailing title event
 * would keep its session permanently "gapped".
 */
const ROW_EVENT_TYPES = ['user/message', 'assistant/message', 'tool/result'];

/** Metadata key for the usage high-water mark — shared with the live tap. */
export const LAST_USAGE_KEY = 'dsh-storage:lastUsage';

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

interface LogFile {
    file: string;
    mtime: Date;
}

interface SessionLog extends LogFile {
    sessionId: string;
}

/* ------------------------------------------------------------------ *
 * Session log reading (plain / zstd)
 * ------------------------------------------------------------------ */

const LOG_BASENAME = 'session.v4.jsonl';

/** Marker: the candidate binary is not installed on this machine. */
class BinaryMissingError extends Error {
}

function runDecompressor(binary: string, file: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const child = spawn(binary, ['-dc', file], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        let stderr = '';
        child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf-8');
        });
        child.on('error', (error: NodeJS.ErrnoException) => {
            reject(error.code === 'ENOENT' ? new BinaryMissingError() : error);
        });
        child.on('close', (code) => {
            if (code === 0)
                resolve(Buffer.concat(chunks));
            else
                reject(new Error(`${binary} -dc exited with ${code}: ${stderr.trim()}`));
        });
    });
}

/**
 * Read one session log as text. Plain files are read directly; `.zstd` files
 * are decompressed through the first available system binary.
 */
export async function readSessionLogText(
    file: string,
    binaries: readonly string[] = ['zstd', 'unzstd', 'zstdcat'],
): Promise<string> {
    if (!file.endsWith('.zstd'))
        return readFile(file, 'utf-8');
    for (const binary of binaries) {
        try {
            return (await runDecompressor(binary, file)).toString('utf-8');
        } catch (error) {
            if (!(error instanceof BinaryMissingError))
                throw error;
        }
    }
    throw new Error(`cannot read ${file}: no zstd binary found (tried ${binaries.join(', ')}) — install zstd to backfill compressed sessions`);
}

/** Parse JSONL lines into event objects; malformed lines are skipped. */
export function parseSessionEvents(text: string): MirrorEvent[] {
    const events: MirrorEvent[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line)
            continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string')
                events.push(parsed);
        } catch {
            // Torn tail lines (a crash mid-write) must not kill the replay.
        }
    }
    return events;
}

function isMirrorEvent(event: unknown): event is MirrorEvent {
    return MIRROR_EVENT_TYPES.includes((event as MirrorEvent | undefined)?.type as MirrorEventType);
}

/** The log file inside `dir` when one exists: plain first, then `.zstd`. */
async function logIn(dir: string): Promise<LogFile | undefined> {
    for (const name of [LOG_BASENAME, `${LOG_BASENAME}.zstd`]) {
        const file = join(dir, name);
        try {
            const info = await stat(file);
            if (info.isFile())
                return { file, mtime: info.mtime };
        } catch {
            // try the next filename
        }
    }
    return undefined;
}

/**
 * Enumerate session logs. Real DSH layout is
 * `<sessionsDir>/<workspace-dir>/<session-id>/session.v4.jsonl[.zstd]`
 * (two levels); a log directly under a child directory is also accepted so
 * a flattened sessions dir keeps working.
 */
export async function listSessionLogs(sessionsDir: string): Promise<SessionLog[]> {
    let entries;
    try {
        entries = await readdir(sessionsDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const logs: SessionLog[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const workspaceDir = join(sessionsDir, entry.name);
        const direct = await logIn(workspaceDir);
        if (direct) {
            logs.push({ sessionId: entry.name, ...direct });
            continue;
        }
        let sessionDirs;
        try {
            sessionDirs = await readdir(workspaceDir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const session of sessionDirs) {
            if (!session.isDirectory())
                continue;
            const log = await logIn(join(workspaceDir, session.name));
            if (log)
                logs.push({ sessionId: session.name, ...log });
        }
    }
    return logs;
}

/* ------------------------------------------------------------------ *
 * Gap computation
 * ------------------------------------------------------------------ */

/**
 * Select sessions whose latest local activity (log mtime) is newer than the
 * database's last mirrored activity. Sessions absent from the database are
 * selected for a full replay (fromSeq 0) — but only when their log holds at
 * least one row-producing event; a log-only session mirrors no rows and its
 * "gap" would never converge. For known sessions `fromSeq` is the sequence
 * of the first row-producing event newer than the DB watermark.
 */
export async function computeGap(
    sessionsDir: string,
    dbLatestPerSession: Map<string, Date>,
): Promise<BackfillGap[]> {
    const gaps: BackfillGap[] = [];
    for (const log of await listSessionLogs(sessionsDir)) {
        const dbDate = dbLatestPerSession.get(log.sessionId);
        // Watermark filter FIRST, on stat() data alone: non-candidates must
        // never pay for a (potentially zstd-decompressing) log read — a stale
        // or unreadable log of an up-to-date session is silently skipped.
        if (dbDate && log.mtime.getTime() <= dbDate.getTime())
            continue;
        const events = parseSessionEvents(await readSessionLogText(log.file));
        const rowEvents = events.filter((event) => ROW_EVENT_TYPES.includes(event?.type));
        if (!dbDate) {
            if (rowEvents.length > 0)
                gaps.push({ sessionId: log.sessionId, fromSeq: 0 });
            continue;
        }
        const dbTime = dbDate.getTime();
        const firstMissing = rowEvents.find((event) => typeof event.time === 'number' && event.time > dbTime);
        if (!firstMissing)
            continue; // nothing row-backed is missing
        gaps.push({
            sessionId: log.sessionId,
            fromSeq: typeof firstMissing.seq === 'number' ? firstMissing.seq : 0,
        });
    }
    return gaps;
}

/** computeGap + replayEvents in one call, for the panel button. */
export async function backfillAll(
    sessionsDir: string,
    backend: StorageBackend & { latestPerSession?(): Promise<Map<string, Date>> },
): Promise<BackfillSummary> {
    await backend.init?.();
    const dbLatest = (await backend.latestPerSession?.()) ?? new Map();
    return replayEvents(await computeGap(sessionsDir, dbLatest), sessionsDir, backend);
}

/* ------------------------------------------------------------------ *
 * Replay
 * ------------------------------------------------------------------ */

interface UsageSample {
    key: string;
    input: number;
    output: number;
}

/* ------------------------------------------------------------------ *
 * Replay
 * ------------------------------------------------------------------ */
/** Shape-guarded restore of the usage sample from stored metadata. */
function usageSampleOfMetadata(value: unknown): UsageSample | undefined {
    const v = value as Partial<UsageSample> | null;
    return v &&
        typeof v.key === 'string' &&
        typeof v.input === 'number' &&
        typeof v.output === 'number'
        ? { key: v.key, input: v.input, output: v.output }
        : undefined;
}

/** Whether the stored row already carries this call's result. */
function hasResult(rows: MessageRow[], callId: string): boolean {
    return rows.some((row) => Array.isArray(row.toolCalls) &&
        (row.toolCalls as Array<{ id?: string } & Record<string, unknown>>).some((call) => call?.id === callId && 'result' in call));
}

interface ReplayAccum {
    messageCount: number;
    totalTokens: number;
    title?: string;
    firstMessageAt?: Date;
    lastMessageAt?: Date;
    metadata: Record<string, unknown>;
    usageSample?: UsageSample;
}

/**
 * Replay the missing events of each gap through the projector into the
 * backend. Idempotent: message rows whose deterministic id already exists
 * are skipped without error, and the session rollup is never double-counted.
 */
export async function replayEvents(
    gaps: BackfillGap[],
    sessionsDir: string,
    backend: StorageBackend,
): Promise<BackfillSummary> {
    const summary: BackfillSummary = { sessions: 0, replayed: 0, skipped: 0, errors: [] };
    await backend.init?.();
    const logs = new Map((await listSessionLogs(sessionsDir)).map((log) => [log.sessionId, log]));
    for (const gap of gaps) {
        const log = logs.get(gap.sessionId);
        if (!log) {
            summary.errors.push(`${gap.sessionId}: session log not found under ${sessionsDir}`);
            continue;
        }
        summary.sessions++;
        try {
            await replayOne(gap, log.file, backend, summary);
        } catch (error) {
            summary.errors.push(`${gap.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return summary;
}

async function replayOne(
    gap: BackfillGap,
    file: string,
    backend: StorageBackend,
    summary: BackfillSummary,
): Promise<void> {
    const events = parseSessionEvents(await readSessionLogText(file)).filter((event) => isMirrorEvent(event) && typeof event.seq === 'number' && event.seq >= gap.fromSeq);
    // Seed the rollup from the stored row, exactly like the live tap on resume.
    const stored = (await backend.readSession?.(gap.sessionId)) ?? null;
    const accum: ReplayAccum = {
        messageCount: stored?.messageCount ?? 0,
        totalTokens: stored?.totalTokens ?? 0,
        title: stored?.title ?? undefined,
        firstMessageAt: stored?.firstMessageAt ?? undefined,
        lastMessageAt: stored?.lastMessageAt ?? undefined,
        metadata: { ...(stored?.metadata ?? {}) },
        usageSample: usageSampleOfMetadata(stored?.metadata?.[LAST_USAGE_KEY]),
    };
    for (const event of events) {
        let row: MessageRow | null = null;
        if (event.type === 'tool/result') {
            const callId = toolResultCallId(event);
            const rows = callId ? await backend.readToolCallMessages(gap.sessionId, callId) : [];
            if (callId && rows.length > 0 && hasResult(rows, callId)) {
                summary.skipped++; // already merged on a previous replay
            } else {
                row = mergeToolResult(event, rows);
                if (row) {
                    await backend.upsertMessage(row);
                    summary.replayed++;
                }
            }
        } else {
            row = projectEvent(null, event, gap.sessionId);
            if (row) {
                const existing = await backend.readMessages(gap.sessionId, row.id);
                if (existing.length > 0) {
                    summary.skipped++; // deterministic id already stored
                    row = null;
                } else {
                    accum.messageCount += 1;
                    accum.firstMessageAt ??= row.createdAt;
                    accum.lastMessageAt = row.createdAt;
                    summary.replayed++;
                }
            }
        }
        // Usage rollup with the same redelivery-dedup key as the live tap.
        let usageDelta = 0;
        const sampled = usageSampleOf(event);
        if (sampled) {
            const sequence = Number(sampled.key);
            const previous = Number(accum.usageSample?.key);
            const duplicate = Number.isSafeInteger(sequence) && Number.isSafeInteger(previous) && sequence <= previous;
            if (!duplicate) {
                usageDelta = sampled.sample.input + sampled.sample.output;
                accum.usageSample = { key: sampled.key, ...sampled.sample };
                accum.totalTokens += usageDelta;
            }
        }
        if (event.type === 'session/title' && typeof (event.data as { title?: unknown } | undefined)?.title === 'string') {
            accum.title = (event.data as { title: string }).title;
        }
        if (row || usageDelta !== 0 || event.type === 'turn/end' || event.type === 'session/title') {
            const metadata = {
                ...accum.metadata,
                ...(accum.usageSample ? { [LAST_USAGE_KEY]: accum.usageSample } : {}),
            };
            const sessionRow = {
                sessionId: gap.sessionId,
                title: accum.title ?? null,
                messageCount: accum.messageCount,
                totalTokens: accum.totalTokens,
                firstMessageAt: accum.firstMessageAt ?? null,
                lastMessageAt: accum.lastMessageAt ?? null,
                ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
            };
            if (row)
                await backend.upsertEvent(row, sessionRow);
            else
                await backend.upsertSession(sessionRow);
        }
    }
}
