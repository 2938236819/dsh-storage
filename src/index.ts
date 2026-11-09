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
import type {} from '@deepseek-ai/dsh-session';
import Schema from '@deepseek-ai/schemastery';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseBackend, type DatabaseProvider } from './backends/database.js';
import { backfillAll, type BackfillSummary, LAST_USAGE_KEY } from './backfill.js';
import { compressionSnapshot } from './compaction.js';
import {
  configToUrl,
  defaultConfigPath,
  dshHome,
  loadConfig,
  defaultDevice,
  saveConfig as saveConfigFile,
  tzOffsetMinutes,
  watchConfig,
  type SyncConfig,
} from './config.js';
import { createTables, ensureDeviceColumn, type CreateTableResult } from './ddl.js';
import {
  ConfigError,
  HealthMonitor,
  probeDatabase,
  testConnection,
  type ConnectionTestResult,
  type HealthStatus,
} from './health.js';
import { drainToasts, wireNotifications, type StorageToast } from './notify.js';
import { registerMemoryTools } from './memory-tools.js';
import { mergeToolResult, projectEvent, toolResultCallId, usageSampleOf } from './projector.js';
import { registerStatusRoute } from './status-route.js';
import type { MessageRow } from './types.js';

export const name = 'dsh-storage';

// Event-tap only: no hard service dependency. Add 'sessionPersistence' to
// `inject` if you want fail-fast when persistence is not composed.
export const inject = [] as string[];

export const Config = Schema.object({
  enabled: Schema.boolean().default(false),
  database: Schema.object({
    enabled: Schema.boolean().default(false),
    provider: Schema.union(['mysql', 'postgresql', 'sqlite', 'sqlserver'] as const).default(
      'sqlite',
    ),
    url: Schema.string().role('secret').default(''),
    timezone: Schema.string().default('+08:00'),
  }),
});

export interface StoragePluginConfig {
  enabled: boolean;
  database: { enabled: boolean; provider: DatabaseProvider; url: string; timezone?: string };
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
  saveConfig(cfg: SyncConfig): { config: SyncConfig };
  /** Panel 「补传」 (T6): replay gap events from local session logs. */
  backfill(): Promise<BackfillSummary>;
  /** Toast notifications newer than the cursor (client polling, T6). */
  toasts(payload: { sinceId?: number }): StorageToast[];
}

/** One database the mirror writes to, derived from the effective sync config. */
interface MirrorTarget {
  provider: DatabaseProvider;
  url: string;
  timezone?: string;
  /** Device identifier stamped on rows written through this mirror. */
  device: string;
}

/** Lifecycle handle for one wired mirror (backends + event taps). */
interface MirrorHandle {
  archiveSession(sessionId: string): Promise<string | null>;
  dispose(): Promise<void>;
}

/** Per-session live rollup used to maintain the session row. */
interface SessionAccum {
  messageCount: number;
  totalTokens: number;
  title?: string;
  firstMessageAt?: Date;
  lastMessageAt?: Date;
  /** Existing history-row metadata, preserved verbatim across our writes. */
  metadata: Record<string, unknown>;
  /**
   * The highest committed usage event sequence and its sample. Session event
   * sequences are ordered, so this bounded high-water mark rejects redelivery
   * without retaining every seen ID; different attempts on one step still add.
   * Persisted in the row's metadata as `dsh-storage:lastUsage` (namespaced —
   * other writers' fields survive).
   */
  usageSample?: { key: string; input: number; output: number };
}

/** Metadata key for our usage bookkeeping — namespaced so other writers' fields never collide with it. */
const TOKEN_BASELINE_KEY = 'dsh-storage:token-baseline';
const ARCHIVE_IN_PROGRESS = 'dsh-storage:archive-in-progress';

/**
 * The patched @prisma/adapter-mariadb (pnpm patch) reads this global when
 * serializing Date args: the stock adapter hard-codes UTC on writes and
 * ignores its `timezone` option, so we hand it the config's offset instead.
 */
const TZ_OFFSET_GLOBAL_KEY = '__DSH_STORAGE_TZ_OFFSET_MIN__';
let tzWarningLogged = false;

/** Publish the config timezone offset for the patched mariadb adapter. */
function publishTzOffset(tz: string | undefined): void {
  const minutes = tzOffsetMinutes(tz ?? '');
  (globalThis as Record<string, unknown>)[TZ_OFFSET_GLOBAL_KEY] = minutes;
  const wellFormed = tz !== undefined && (tz === 'UTC' || tz === 'Z' || /^[+-]\d{2}:\d{2}$/.test(tz));
  if (!wellFormed && !tzWarningLogged) {
    tzWarningLogged = true;
    console.error(
      `[dsh-storage] invalid timezone ${JSON.stringify(tz ?? '')} — assuming UTC offset 0`,
    );
  }
}

/** Shape-guarded restore of our usage sample from arbitrary metadata. */
function usageSampleOfMetadata(value: unknown): SessionAccum['usageSample'] {
  const v = value as { key?: unknown; input?: unknown; output?: unknown } | null;
  return v &&
    typeof v.key === 'string' &&
    typeof v.input === 'number' &&
    typeof v.output === 'number'
    ? { key: v.key, input: v.input, output: v.output }
    : undefined;
}

export function apply(ctx: Context, config: StoragePluginConfig): void {
  // Lifecycle: this cordis fork has no 'ready'/'dispose' events — startup
  // work goes in ctx.effect() (runs immediately at plugin load; the returned
  // disposer runs on fiber unload at shutdown). Event taps verified against
  // @deepseek-ai/dsh-session@0.1.6-alpha.2: session/event(session, event),
  // session/disposed(session), and the awaited session/flush(session)
  // durability checkpoint. The type-only import above registers the event
  // names; handler params stay `any` because storage also mirrors
  // plugin-owned event types (e.g. session/title) it does not depend on.
  // Health monitor: probes the sync config's database (connect + SELECT 1 +
  // ai_messages existence) with exponential-backoff retries. The probe
  // re-reads $DSH_HOME/dsh-storage.json on every run, so config edits and
  // corruption are picked up without a restart. Provided before the enabled
  // guard so the panel can always query status (state stays 'disabled'
  // while sync is off). enabled:false is handled by stopping the monitor
  // (true 'disabled' state) — only a broken config surfaces as
  // 'config-error'.
  const monitor = new HealthMonitor(async () => {
    const { config: syncConfig, error } = loadConfig();
    if (error)
      throw new ConfigError(`sync config invalid (${error})`);
    await probeDatabase(syncConfig);
  });
  // Toast notifications (Task 6): good→bad / bad→good transitions are
  // recorded host-side and drained by the browser toast portal through the
  // status bridge. Mounted for the plugin's whole lifetime (like the monitor).
  ctx.effect(() => wireNotifications(monitor));
  ctx.effect(() => {
    // The monitor lifecycle follows the sync config alone — always evaluated
    // at plugin load (regardless of enabled flags) and re-evaluated on every
    // config edit via T3's watchConfig (300ms debounce). Without this,
    // starting disabled would leave the status stuck at 'disabled' forever
    // after the user enables sync: enabled:false → monitor stopped with the
    // true 'disabled' state; enabled:true (or a broken config, surfaced as
    // config-error) → probe/recheck.
    let monitorRunning = false;
    const evaluate = () => {
      const { config: syncConfig, error } = loadConfig();
      if (!error && !syncConfig.enabled) {
        monitor.stop();
        monitorRunning = false;
        return;
      }
      if (monitorRunning)
        void monitor.recheck();
      else {
        monitorRunning = true;
        monitor.start();
      }
    };
    evaluate();
    const unwatch = watchConfig(defaultConfigPath(), evaluate);
    return () => {
      unwatch();
      monitor.stop();
      monitorRunning = false;
    };
  });
  const statusService: DshStorageStatusService = {
    snapshot() {
      const current = monitor.snapshot();
      // Minimal config-error re-arm: the next snapshot call re-reads the
      // config and recovers once it parses and connects again.
      if (current.state === 'config-error')
        void monitor.recheck();
      return current;
    },
    testConnection(cfg) {
      return testConnection(cfg);
    },
    createTables,
    getConfig: () => loadConfig(),
    saveConfig(cfg) {
      saveConfigFile(cfg);
      return { config: cfg };
    },
    toasts(payload) {
      return drainToasts(payload?.sinceId ?? 0);
    },
    async backfill() {
      const { config: cfg, error } = loadConfig();
      if (error)
        throw new Error(`sync config invalid (${error})`);
      // A one-shot backend from the current config — backfill works even
      // while the live mirror is disabled or its connection was rebuilt.
      const backend = new DatabaseBackend({
        provider: cfg.provider,
        url: configToUrl(cfg),
        timezone: cfg.timezone,
        device: cfg.device,
      });
      await backend.init();
      try {
        return await backfillAll(join(dshHome(), 'sessions'), backend);
      }
      finally {
        await backend.close?.().catch(() => {});
      }
    },
  };
  ctx.provide('dshStorageStatus', statusService);
  // Phase 2: AI memory tools (memory_search / memory_read) — host-side only,
  // registered on the dsh-tools service; a disabled/unconfigured sync config
  // surfaces as a friendly error at call time, never at registration.
  // Browser bridge (Task 5): the settings panel client calls this over the
  // connection generic-RPC channel. Optional services — profiles without a
  // web carrier simply skip the route.
  ctx.effect(() => {
    const dispose = registerStatusRoute(ctx, statusService);
    return () => dispose?.();
  });
  // Phase 2: AI memory tools (memory_search / memory_read) — host-side only.
  // MUST come after the status route + mirror wiring above: on profiles where
  // the 'tools' service never resolves, cordis leaves this sub-plugin fiber
  // pending forever and — in a buggy fork of cordis — can even fail it, which
  // used to abort apply() before the route/mirror registrations (panel 405 +
  // silent no-mirroring). try/catch + late ordering isolate that blast radius.
  try {
    registerMemoryTools(ctx as unknown as Parameters<typeof registerMemoryTools>[0]);
  } catch (error) {
    console.error('[dsh-storage] memory tools registration failed (continuing without them):', error);
  }
  // C1: the mirror derives its effective config from the same source the
  // panel/health/backfill use — $DSH_HOME/dsh-storage.json. The JSON file
  // wins whenever it exists (enabled:false in JSON means OFF, even when a
  // legacy yaml block is enabled); the cordis yaml Config is only a compat
  // fallback for pre-panel installs whose JSON file does not exist yet —
  // exactly the state the switch runbook leaves users in after deleting the
  // hand-written yaml block. Config edits rebuild the mirror without a
  // restart: the watcher disposes the old backends + event tap and
  // reconstructs them from the new file.
  let mirror: MirrorHandle | undefined;
  let activeTarget: MirrorTarget | undefined;
  let desiredTarget: MirrorTarget | undefined;
  let switching = false;
  const settleMirror = () => {
    if (switching || sameMirrorTarget(activeTarget, desiredTarget))
      return;
    if (mirror) {
      // Tear the old mirror down first (drain pending writes, close
      // backends); settleMirror re-runs and wires the next target once the
      // teardown has landed.
      switching = true;
      const old = mirror;
      mirror = undefined;
      activeTarget = undefined;
      void old
        .dispose()
        .catch(() => {})
        .then(() => {
          switching = false;
          settleMirror();
        });
      return;
    }
    if (desiredTarget) {
      mirror = startMirror(ctx, desiredTarget);
      activeTarget = desiredTarget;
    }
  };
  // The archive service outlives mirror rebuilds — it delegates to whichever
  // mirror instance is currently wired.
  ctx.provide('dshStorage', {
    archiveSession(sessionId) {
      return mirror?.archiveSession(sessionId) ?? Promise.resolve(null);
    },
  } satisfies DshStorageService);
  const evaluateMirror = () => {
    desiredTarget = computeMirrorTarget(config);
    // Keep the adapter's timezone global in sync with the effective config —
    // set at load and re-set whenever the watcher fires with a changed
    // timezone (MirrorTarget equality already includes timezone).
    publishTzOffset(desiredTarget?.timezone ?? config.database?.timezone);
    settleMirror();
  };
  evaluateMirror();
  ctx.effect(() => {
    const unwatch = watchConfig(defaultConfigPath(), evaluateMirror);
    return () => unwatch();
  });
}

function sameMirrorTarget(a: MirrorTarget | undefined, b: MirrorTarget | undefined): boolean {
  return (
    a === b ||
    (a?.provider === b?.provider &&
      a?.url === b?.url &&
      a?.timezone === b?.timezone &&
      a?.device === b?.device)
  );
}

/**
 * The mirror's effective target. When ~/.dsh/dsh-storage.json exists it wins
 * outright — a panel-configured install must mirror from the panel's config,
 * and enabled:false there must actually stop mirroring; the yaml Config only
 * drives the mirror when no JSON file exists (legacy pre-panel installs).
 * A present-but-broken JSON file disables the mirror (the health monitor
 * surfaces the parse error as 'config-error').
 */
function computeMirrorTarget(config: StoragePluginConfig): MirrorTarget | undefined {
  const path = defaultConfigPath();
  if (existsSync(path)) {
    const { config: syncConfig, error } = loadConfig(path);
    if (error || !syncConfig.enabled)
      return undefined;
    return {
      provider: syncConfig.provider,
      url: configToUrl(syncConfig),
      timezone: syncConfig.timezone,
      device: syncConfig.device,
    };
  }
  if (!config.enabled || !config.database.enabled || !config.database.url)
    return undefined;
  return {
    provider: config.database.provider,
    url: config.database.url,
    timezone: config.database.timezone,
    device: defaultDevice(),
  };
}

/**
 * Wire one mirror instance against `target`: backend construction, the
 * session/event tap, and durability checkpoints. The projector internals are
 * unchanged from upstream — this factory only owns their lifecycle so the
 * config watcher can dispose and reconstruct everything on config changes.
 */
function startMirror(ctx: Context, target: MirrorTarget): MirrorHandle {
  const backends = [
    new DatabaseBackend({
      provider: target.provider,
      url: target.url,
      timezone: target.timezone,
      device: target.device,
    }),
  ];

  const sessions = new Map<string, SessionAccum>();
  const toolCallMessages = new Map<string, Map<string, string>>();
  const TOOL_CALL_CACHE_LIMIT = 1000;

  function rememberToolCalls(sessionId: string, row: MessageRow | null): void {
    if (row?.type !== 'model' || !Array.isArray(row.toolCalls)) return;
    for (const call of row.toolCalls) {
      if (typeof call?.id !== 'string') continue;
      const calls = toolCallMessages.get(sessionId) ?? new Map<string, string>();
      // Bound each session's cache; Map iteration evicts the oldest insertion first.
      if (!calls.has(call.id) && calls.size >= TOOL_CALL_CACHE_LIMIT) {
        const oldest = calls.keys().next().value;
        if (oldest !== undefined) calls.delete(oldest);
      }
      calls.set(call.id, row.id);
      toolCallMessages.set(sessionId, calls);
    }
  }

  async function readToolResultRows(
    session: any,
    sessionId: string,
    event: any,
  ): Promise<MessageRow[]> {
    const callId = toolResultCallId(event);
    if (!callId) return [];
    let messageId = toolCallMessages.get(sessionId)?.get(callId);
    if (!messageId && typeof session?.deriveMessages === 'function') {
      const messages = session.deriveMessages();
      for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (
          message.role === 'assistant' &&
          typeof message.id === 'string' &&
          Array.isArray(message.content) &&
          message.content.some((block: any) => block?.type === 'tool-call' && block.id === callId)
        ) {
          messageId = message.id;
          break;
        }
      }
    }
    if (messageId) {
      const rows = await backends[0].readMessages(sessionId, messageId);
      if (
        rows.some(
          (row) =>
            Array.isArray(row.toolCalls) && row.toolCalls.some((call) => call?.id === callId),
        )
      )
        return rows;
    }
    // Cold resume and eviction fall back to bounded database candidate pages.
    const rows = await backends[0].readToolCallMessages(sessionId, callId);
    for (const row of rows) rememberToolCalls(sessionId, row);
    return rows;
  }

  // Row writes are fire-and-forget during the run, but tracked so the
  // session/flush checkpoint and shutdown can drain them — a one-shot
  // (headless) run would otherwise lose the tail events to process exit.
  const pending = new Set<Promise<void>>();

  function track(task: Promise<void>): Promise<void> {
    pending.add(task);
    void task.then(
      () => pending.delete(task),
      () => pending.delete(task),
    );
    return task;
  }

  function guard(call: (backend: (typeof backends)[number]) => Promise<void>): Promise<void> {
    // Mirroring must never break the agent loop: log and swallow.
    return Promise.all(
      backends.map((backend) =>
        call(backend).catch((error) =>
          console.error(`[dsh-storage] ${backend.name} error:`, error),
        ),
      ),
    ).then(() => {});
  }

  // All sessions share init and its retry delay; queued events wait rather than skip the barrier.
  let started: Promise<void> | undefined;
  let retryAt = 0;
  /** Device-column migration runs once per mirror instance, after init. */
  let migrated = false;

  function ensureStarted(): Promise<void> {
    if (!started) {
      const attempt = track(
        (async () => {
          const delay = retryAt - Date.now();
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          await Promise.all(backends.map((backend) => backend.init?.()));
          if (!migrated) {
            migrated = true;
            // Cheap information_schema check + ALTER/UPDATE only when the
            // device column is missing (multi-device shared database).
            const result = await ensureDeviceColumn(target, target.device);
            if (result !== 'ok')
              console.error(`[dsh-storage] device column migration: ${result}`);
          }
        })(),
      );
      started = attempt;
      void attempt.catch(() => {
        if (started === attempt) {
          retryAt = Date.now() + 1000;
          started = undefined;
        }
      });
    }
    return started;
  }

  function fanout(call: (backend: (typeof backends)[number]) => Promise<void>): Promise<void> {
    // Event failures reject into the per-session queue, which is the no-throw
    // boundary. Swallowing here would make a partial write look committed.
    return track(ensureStarted().then(() => Promise.all(backends.map(call)).then(() => {})));
  }

  // Per-session serialization: all event processing for one session runs
  // through a promise chain, so rollup writes complete in event order
  // (latest-wins — concurrent absolute snapshots must not land out of order)
  // and the first event of an unknown session seeds its accumulator from the
  // stored row before any write (resume: constructor seeds are not re-emitted,
  // so history must come from the database, not from zero).
  const chains = new Map<string, Promise<void>>();
  type ToolResultBatch = { events: any[]; index: number };
  const toolBatches = new Map<string, ToolResultBatch>();

  function enqueue(sessionId: string, task: () => Promise<void>): void {
    // Backend work checks init inside mirrorEvent; cleanup needs only queue ordering.
    const next = (chains.get(sessionId) ?? Promise.resolve())
      .then(task)
      .catch((error) => console.error('[dsh-storage] mirror task error:', error));
    chains.set(sessionId, next);
    track(next);
  }

  async function seedAccum(sessionId: string): Promise<SessionAccum> {
    // "Row not found" (a new session) is the only zero-seed case. A read
    // failure is NOT "not found": fail the task so the next event re-seeds,
    // instead of accumulating from zero and overwriting the stored rollup.
    let readFailure: unknown;
    for (const backend of backends) {
      try {
        const row = await backend.readSession?.(sessionId);
        if (row) {
          return {
            messageCount: row.messageCount,
            totalTokens: row.totalTokens,
            title: row.title ?? undefined,
            firstMessageAt: row.firstMessageAt ?? undefined,
            lastMessageAt: row.lastMessageAt ?? undefined,
            // Preserve every existing metadata field; we only own our key.
            // The baseline distinguishes cumulative active totals from a
            // restart's fresh-segment deltas during archive recovery.
            metadata: { [TOKEN_BASELINE_KEY]: row.totalTokens, ...(row.metadata ?? {}) },
            usageSample: usageSampleOfMetadata(row.metadata?.[LAST_USAGE_KEY]),
          };
        }
      } catch (error) {
        readFailure ??= error;
        console.error(`[dsh-storage] ${backend.name} error:`, error);
      }
    }
    if (readFailure) throw readFailure;
    return { messageCount: 0, totalTokens: 0, metadata: { [TOKEN_BASELINE_KEY]: 0 } };
  }

  void ensureStarted().catch((error) => console.error('[dsh-storage] database error:', error));

  function archiveSession(sessionId: string): Promise<string | null> {
    toolBatches.delete(sessionId);
    // Join the same per-session chain as event writes, then discard the old
    // in-memory rollup only after the database transaction commits.
    const archived = (chains.get(sessionId) ?? Promise.resolve())
      .then(() => ensureStarted())
      .then(async () => {
        const accum = sessions.get(sessionId);
        if (accum && !accum.metadata[ARCHIVE_IN_PROGRESS]) {
          // Freeze inside the session queue: all earlier events have now
          // committed, and this first baseline survives every retry until
          // the archive actually succeeds.
          accum.metadata[TOKEN_BASELINE_KEY] = accum.totalTokens;
          accum.metadata[ARCHIVE_IN_PROGRESS] = true;
        }
        const id = await backends[0].archiveSession(sessionId);
        sessions.delete(sessionId);
        toolCallMessages.delete(sessionId);
        return id;
      });
    const settled = archived.then(
      () => {},
      () => {},
    );
    chains.set(sessionId, settled);
    track(settled);
    return archived;
  }

  async function mirrorEvent(
    session: any,
    event: any,
    snapshot: MessageRow | null,
    batch?: ToolResultBatch,
  ): Promise<void> {
    await ensureStarted();
    const sessionId: string = session?.id ?? 'unknown';
    if (snapshot) {
      await fanout((backend) => backend.upsertMessage(snapshot));
      return;
    }
    const stored = sessions.get(sessionId) ?? (await seedAccum(sessionId));
    sessions.set(sessionId, stored);
    // Stage every change on a copy. The live accumulator advances only
    // after the message + rollup transaction commits.
    const accum: SessionAccum = { ...stored, metadata: { ...stored.metadata } };

    let row: MessageRow | null = projectEvent(session, event, sessionId);
    if (row && session.header?.createdAt !== undefined) {
      row.metadata = { ...row.metadata, sessionCreatedAt: session.header.createdAt };
    }
    const storedRows =
      event?.type === 'tool/result'
        ? await readToolResultRows(session, sessionId, event)
        : row
          ? await backends[0].readMessages(sessionId, row.id)
          : [];
    let processedThrough = batch?.index;
    if (event?.type === 'tool/result') {
      row = mergeToolResult(event, storedRows);
      while (
        row &&
        batch &&
        processedThrough !== undefined &&
        processedThrough + 1 < batch.events.length
      ) {
        const following = batch.events[processedThrough + 1];
        const callId = toolResultCallId(following);
        if (
          !callId ||
          !Array.isArray(row.toolCalls) ||
          !row.toolCalls.some((call: any) => call?.id === callId)
        )
          break;
        row = mergeToolResult(following, [row]);
        processedThrough++;
      }
    }
    const existing = row && storedRows.find((stored) => stored.id === row?.id);
    if (event?.type === 'assistant/message' && row && existing && Array.isArray(row.toolCalls)) {
      row.toolCalls = row.toolCalls.map((call: any) => {
        const previous = Array.isArray(existing.toolCalls)
          ? existing.toolCalls.find((stored: any) => stored?.id === call?.id)
          : undefined;
        return previous && 'result' in previous
          ? {
              ...call,
              result: previous.result,
              ...(previous.error ? { error: previous.error } : {}),
            }
          : call;
      });
    }
    if (!row && event?.type === 'tool/result') {
      console.error('[dsh-storage] no matching model tool call for result');
    }
    if (row && !existing && event?.type !== 'tool/result') {
      accum.messageCount += 1;
      accum.firstMessageAt ??= row.createdAt;
      accum.lastMessageAt = row.createdAt;
    }

    // Every settled attempt/message is one model call; retries on the same
    // step are additive rather than replacement snapshots.
    const sampled = usageSampleOf(event);
    let usageDelta = 0;
    if (sampled) {
      const sequence = Number(sampled.key);
      const previous = Number(accum.usageSample?.key);
      const duplicate =
        Number.isSafeInteger(sequence) && Number.isSafeInteger(previous) && sequence <= previous;
      if (!duplicate) {
        usageDelta = sampled.sample.input + sampled.sample.output;
        accum.usageSample = { key: sampled.key, ...sampled.sample };
        accum.totalTokens += usageDelta;
      }
    }

    // Latest-wins title snapshot (log-only `session/title` event; payload
    // { title, messageSeqs, source } verified against dsh-session-title@0.1.6-alpha.2).
    if (event?.type === 'session/title' && typeof event.data?.title === 'string') {
      accum.title = event.data.title;
    }

    if (row || usageDelta !== 0 || event?.type === 'turn/end' || event?.type === 'session/title') {
      // Merge our bookkeeping into the existing metadata instead of
      // replacing the column — other fields (present or future) survive.
      const metadata = {
        ...accum.metadata,
        ...(accum.usageSample ? { [LAST_USAGE_KEY]: accum.usageSample } : {}),
      };
      const sessionRow = {
        sessionId,
        title: accum.title ?? null,
        messageCount: accum.messageCount,
        totalTokens: accum.totalTokens,
        firstMessageAt: accum.firstMessageAt ?? null,
        lastMessageAt: accum.lastMessageAt ?? null,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      };
      await fanout((backend) => backend.upsertEvent(row, sessionRow));
    }
    // Advance only after commit so a failed merged write cannot skip later results.
    if (batch && processedThrough !== undefined) batch.index = processedThrough;
    sessions.set(sessionId, accum);
    rememberToolCalls(sessionId, row);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const offEvent = ctx.on('session/event', (session: any, event: any) => {
    if (
      ![
        'user/message',
        'assistant/message',
        'assistant/attempt',
        'tool/result',
        'turn/end',
        'session/title',
        'compaction/end',
      ].includes(event?.type)
    )
      return;
    let snapshot: MessageRow | null;
    try {
      // Capture the committed surface now; queued writes must not observe later steps.
      snapshot = compressionSnapshot(session, event);
    } catch (error) {
      console.error('[dsh-storage] compaction snapshot error:', error);
      return;
    }
    if (event.type === 'compaction/end' && !snapshot) return;
    const sessionId: string = session?.id ?? 'unknown';
    if (event.type === 'tool/result') {
      const pendingBatch = toolBatches.get(sessionId);
      if (pendingBatch && pendingBatch.events.length < 32) {
        pendingBatch.events.push(event);
        return;
      }
      const batch: ToolResultBatch = { events: [event], index: 0 };
      toolBatches.set(sessionId, batch);
      enqueue(sessionId, async () => {
        if (toolBatches.get(sessionId) === batch) toolBatches.delete(sessionId);
        for (; batch.index < batch.events.length; batch.index++) {
          try {
            await mirrorEvent(session, batch.events[batch.index], null, batch);
          } catch (error) {
            console.error('[dsh-storage] mirror task error:', error);
          }
        }
      });
    } else {
      toolBatches.delete(sessionId);
      enqueue(sessionId, () => mirrorEvent(session, event, snapshot));
    }
  });

  const offDisposed = ctx.on('session/disposed', (session: any) => {
    const sessionId: string = session?.id ?? 'unknown';
    toolBatches.delete(sessionId);
    // The delete must run inside the session's chain — a synchronous delete
    // here races the queued event tasks (the map may not even have the entry
    // yet at emit time, and queued tasks would keep growing the accumulator
    // the dispose was meant to drop).
    enqueue(sessionId, async () => {
      sessions.delete(sessionId);
      toolCallMessages.delete(sessionId);
    });
    // Delete the chain entry only once it has settled AND is still the same
    // entry — deleting earlier would let a recreated session race the
    // orphaned writes; skipping the delete when a new task has since chained
    // on preserves order.
    const chain = chains.get(sessionId);
    chain?.finally(() => {
      if (chains.get(sessionId) === chain) chains.delete(sessionId);
    });
  });

  // Durability checkpoint: wait only for this session. Shutdown still drains
  // the global pending set; an unrelated slow session must not block this one.
  const offFlush = ctx.on('session/flush', async (session: any) => {
    toolBatches.delete(session?.id ?? 'unknown');
    const chain = chains.get(session?.id ?? 'unknown');
    if (chain) {
      await chain;
      return;
    }
    try {
      await ensureStarted();
    } catch (error) {
      console.error('[dsh-storage] database error:', error);
    }
  });

  // Teardown runs both on config-driven rebuilds (dispose()) and fiber unload
  // (the effect below); the stopped flag makes it idempotent so a rebuilt-away
  // mirror is never closed twice.
  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped)
      return;
    stopped = true;
    offEvent();
    offDisposed();
    offFlush();
    toolBatches.clear();
    await Promise.allSettled([...pending]);
    sessions.clear();
    toolCallMessages.clear();
    await guard(async (backend) => backend.close?.());
  };
  ctx.effect(() => () => stop());
  return { archiveSession, dispose: stop };
}
