import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeGap,
  LAST_USAGE_KEY,
  listSessionLogs,
  MIRROR_EVENT_TYPES,
  parseSessionEvents,
  readSessionLogText,
  replayEvents,
} from './backfill.js';
import type { StorageBackend } from './types.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-storage-backfill-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeLog(sessionId: string, lines: unknown[], workspace = 'ws') {
  const sessionDir = join(dir, workspace, sessionId);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(sessionDir, 'session.v4.jsonl'),
    lines.map((line) => JSON.stringify(line)).join('\n') + '\n',
  );
  return join(sessionDir, 'session.v4.jsonl');
}

const userEvent = (id: string, seq: number, time: number) => ({
  type: 'user/message',
  seq,
  time,
  data: {
    id,
    role: 'user',
    content: [{ type: 'text', text: `msg-${id}` }],
    source: { kind: 'user' },
  },
});

function fakeBackend(): StorageBackend & {
  messages: Map<string, any>;
  sessions: Map<string, any>;
  latest: Map<string, Date>;
} {
  const messages = new Map<string, any>();
  const sessions = new Map<string, any>();
  const latest = new Map<string, Date>();
  return {
    name: 'fake',
    messages,
    sessions,
    latest,
    async latestPerSession() {
      return latest;
    },
    async readSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async readMessages(sessionId, messageId) {
      const row = messages.get(`${sessionId}:${messageId}`);
      return row ? [row] : [];
    },
    async readToolCallMessages() {
      return [];
    },
    async upsertMessage(row) {
      messages.set(`${row.sessionId}:${row.id}`, row);
    },
    async upsertSession(row) {
      sessions.set(row.sessionId, row);
    },
    async upsertEvent(message, session) {
      if (message)
        messages.set(`${message.sessionId}:${message.id}`, message);
      sessions.set(session.sessionId, session);
    },
    async archiveSession() {
      return null;
    },
  };
}

describe('backfill: log reading', () => {
  it('lists logs two levels deep and directly under a child dir', async () => {
    writeLog('s1', []);
    // Flattened layout: the log sits directly under the child directory.
    mkdirSync(join(dir, 'flat'), { recursive: true });
    writeFileSync(join(dir, 'flat', 'session.v4.jsonl'), '');
    const logs = await listSessionLogs(dir);
    expect(logs.map((l) => l.sessionId).sort()).toEqual(['flat', 's1']);
  });

  it('returns [] for a missing sessions dir', async () => {
    await expect(listSessionLogs(join(dir, 'nope'))).resolves.toEqual([]);
  });

  it('parses JSONL, skipping malformed lines', () => {
    const events = parseSessionEvents(
      ['{"type":"user/message","seq":1}', 'not json', '', '{"type":"other"}'].join('\n'),
    );
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(1);
  });

  it('reads .zstd logs through the first available binary (fake)', async () => {
    // A non-zstd filename with a .zstd suffix and no real binaries: the error
    // must name the requirement instead of being swallowed.
    const file = join(dir, 'compressed.v4.jsonl.zstd');
    writeFileSync(file, 'garbage');
    await expect(readSessionLogText(file, [])).rejects.toThrow(/no zstd binary found/);
  });

  it('reads plain files directly', async () => {
    const file = writeLog('plain', [{ type: 'user/message', seq: 1 }]);
    await expect(readSessionLogText(file)).resolves.toContain('user/message');
  });
});

describe('backfill: computeGap', () => {
  it('selects unknown sessions only when their log holds row events', async () => {
    writeLog('rows', [userEvent('m1', 1, 1700000000000)]);
    writeLog('logonly', [{ type: 'turn/end', seq: 1, time: 1700000000000 }]);
    const gaps = await computeGap(dir, new Map());
    expect(gaps).toEqual([{ sessionId: 'rows', fromSeq: 0 }]);
  });

  it('skips sessions whose log mtime is not newer than the watermark (first)', async () => {
    const file = writeLog('uptodate', [userEvent('m1', 1, 1700000000000)]);
    const watermark = new Date(Date.now() + 60_000);
    utimesSync(file, watermark, watermark);
    const gaps = await computeGap(dir, new Map([['uptodate', watermark]]));
    expect(gaps).toEqual([]);
  });

  it('starts at the first row event newer than the DB watermark', async () => {
    const file = writeLog('s1', [
      userEvent('m1', 1, 1000),
      { type: 'session/title', seq: 2, time: 1500, data: { title: 't' } },
      userEvent('m2', 3, 2000),
    ]);
    const dbTime = new Date(1500);
    utimesSync(file, new Date(), new Date());
    const gaps = await computeGap(dir, new Map([['s1', dbTime]]));
    expect(gaps).toEqual([{ sessionId: 's1', fromSeq: 3 }]);
  });

  it('skips known sessions with nothing row-backed missing', async () => {
    const file = writeLog('s1', [
      userEvent('m1', 1, 1000),
      { type: 'turn/end', seq: 2, time: 5000 },
    ]);
    utimesSync(file, new Date(), new Date());
    const gaps = await computeGap(dir, new Map([['s1', new Date(2000)]]));
    expect(gaps).toEqual([]);
  });

  it('mirrors exactly the live tap event types', () => {
    expect(MIRROR_EVENT_TYPES).toEqual([
      'user/message',
      'assistant/message',
      'assistant/attempt',
      'tool/result',
      'turn/end',
      'session/title',
      'compaction/end',
    ]);
  });
});

describe('backfill: replayEvents', () => {
  it('replays missing events through the projector (watermark rollup)', async () => {
    writeLog('s1', [
      userEvent('m1', 1, 1000),
      {
        type: 'assistant/message',
        seq: 2,
        time: 1100,
        data: {
          turn: 0,
          step: 0,
          message: {
            id: 'a1',
            role: 'assistant',
            content: [{ type: 'text', text: 'hi' }],
            source: { kind: 'model', provider: 'deepseek', model: 'deepseek-chat' },
          },
          usage: { inputTokens: 5, outputTokens: 7 },
        },
      },
    ]);
    const backend = fakeBackend();
    const summary = await replayEvents([{ sessionId: 's1', fromSeq: 0 }], dir, backend);
    expect(summary.errors).toEqual([]);
    expect(summary.sessions).toBe(1);
    expect(summary.replayed).toBe(2);
    const session = backend.sessions.get('s1');
    expect(session.messageCount).toBe(2);
    expect(session.totalTokens).toBe(12);
    expect(session.metadata[LAST_USAGE_KEY]).toMatchObject({ input: 5, output: 7 });
  });

  it('is idempotent: replaying twice skips already-stored rows', async () => {
    writeLog('s1', [userEvent('m1', 1, 1000)]);
    const backend = fakeBackend();
    const first = await replayEvents([{ sessionId: 's1', fromSeq: 0 }], dir, backend);
    expect(first.skipped).toBe(0);
    const second = await replayEvents([{ sessionId: 's1', fromSeq: 0 }], dir, backend);
    expect(second.replayed).toBe(0);
    expect(second.skipped).toBe(1);
    expect(backend.messages.size).toBe(1);
    // The session rollup is not double-counted.
    expect(backend.sessions.get('s1').messageCount).toBe(1);
  });

  it('reports per-session failures and missing logs', async () => {
    const backend = fakeBackend();
    const summary = await replayEvents([{ sessionId: 'ghost', fromSeq: 0 }], dir, backend);
    expect(summary.replayed).toBe(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('ghost');
  });
});
