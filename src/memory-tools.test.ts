import { describe, expect, it, vi } from 'vitest';
import {
  buildReadSql,
  buildSearchSql,
  createMemoryTools,
  escapeLike,
  normalizeRows,
  notConfiguredError,
  registerMemoryTools,
  requireConfig,
  type RawConnection,
  type ToolDefinition,
} from './memory-tools.js';
import { DEFAULT_CONFIG, saveConfig, type SyncConfig } from './config.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const configDir = (config: SyncConfig): string => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-storage-mem-'));
  dirs.push(dir);
  saveConfig(config, join(dir, 'dsh-storage.json'));
  return dir;
};

const enabledConfig: SyncConfig = {
  ...DEFAULT_CONFIG,
  enabled: true,
  provider: 'mysql',
  user: 'u',
  password: 'p',
  database: 'db',
  device: 'host-a',
};

/** Fake adapter connection recording executed queries. */
function fakeConnection(rows: Array<Record<string, unknown>> = []): RawConnection & { queries: any[] } {
  const queries: any[] = [];
  return {
    queries,
    async queryRaw(query: any) {
      queries.push(query);
      return { columnNames: Object.keys(rows[0] ?? {}), rows: rows.map((r) => Object.values(r)) };
    },
    async executeRaw() {
      return 0;
    },
    async dispose() {},
  };
}

describe('escapeLike', () => {
  it('escapes ~, % and _ for use with ESCAPE ~', () => {
    expect(escapeLike('50%')).toBe('50~%');
    expect(escapeLike('a_b')).toBe('a~_b');
    expect(escapeLike('~x')).toBe('~~x');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('buildSearchSql', () => {
  it('ORs one LIKE term per keyword and binds escaped patterns', () => {
    const plan = buildSearchSql('mysql', { query: '部署  k8s' });
    expect(plan.sql).toContain("content LIKE ? ESCAPE '~' OR content LIKE ? ESCAPE '~'");
    expect(plan.args[0]).toBe('%部署%');
    expect(plan.args[1]).toBe('%k8s%');
    expect(plan.sql.endsWith('ORDER BY created_at DESC, id DESC LIMIT ?')).toBe(true);
    expect(plan.args[plan.args.length - 1]).toBe(20);
    expect(plan.argTypes).toHaveLength(plan.args.length);
    expect(plan.argTypes.every((t) => t.arity === 'scalar')).toBe(true);
  });

  it('filters by the device id when scope is current', () => {
    const plan = buildSearchSql('mysql', { query: 'x', device: 'current' }, 'host-a');
    expect(plan.sql).toContain('device = ?');
    expect(plan.args).toContain('host-a');
  });

  it('does not filter by device for scope all', () => {
    const plan = buildSearchSql('mysql', { query: 'x', device: 'all' }, 'host-a');
    expect(plan.sql).not.toContain('device = ?');
  });

  it('adds a since bound and clamps limit', () => {
    const plan = buildSearchSql('sqlite', { query: 'x', since: '2026-11-01', limit: 5000 });
    expect(plan.sql).toContain('created_at >= ?');
    expect(plan.args).toContain('2026-11-01T00:00:00');
    expect(plan.args[plan.args.length - 1]).toBe(100);
  });

  it('uses TOP for sqlserver instead of LIMIT', () => {
    const plan = buildSearchSql('sqlserver', { query: 'x', limit: 5 });
    expect(plan.sql).toContain('SELECT TOP 5');
    expect(plan.sql).not.toContain('LIMIT');
  });

  it('keeps base conditions (deleted_at null, content present, no type filter)', () => {
    const plan = buildSearchSql('postgresql', { query: 'x' });
    expect(plan.sql).toContain('deleted_at IS NULL');
    expect(plan.sql).toContain('content IS NOT NULL');
    expect(plan.sql).not.toMatch(/type\s*=/);
  });
});

describe('buildReadSql', () => {
  it('selects chronological window for a session', () => {
    const plan = buildReadSql('mysql', { sessionId: 's1', limit: 10 });
    expect(plan.sql).toContain('session_id = ? AND deleted_at IS NULL');
    expect(plan.args).toEqual(['s1', 10]);
  });

  it('windows at-or-before the around instant (desc) for centering', () => {
    const plan = buildReadSql('postgresql', { sessionId: 's1', around: '2026-11-06T10:00:00' });
    expect(plan.sql).toContain('created_at <= ?');
    expect(plan.sql).toContain('ORDER BY created_at DESC, id DESC');
    expect(plan.args).toEqual(['s1', '2026-11-06T10:00:00', 30]);
  });

  it('uses TOP for sqlserver', () => {
    const plan = buildReadSql('sqlserver', { sessionId: 's1' });
    expect(plan.sql).toContain('SELECT TOP 30');
    expect(plan.sql).not.toContain('LIMIT');
  });
});

describe('normalizeRows', () => {
  it('zips adapter columnNames/rows arrays into objects', () => {
    expect(
      normalizeRows({ columnNames: ['session_id', 'created_at'], rows: [['s1', '2026-01-01']] }),
    ).toEqual([{ session_id: 's1', created_at: '2026-01-01' }]);
  });

  it('passes through arrays of objects and returns [] for junk', () => {
    expect(normalizeRows([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(normalizeRows(null)).toEqual([]);
    expect(normalizeRows({ rows: 'nope' })).toEqual([]);
  });
});

describe('tool definitions and registration shape', () => {
  it('exposes memory_search and memory_read with model-facing schema', () => {
    const tools = createMemoryTools();
    expect(tools.map((t) => t.name)).toEqual(['memory_search', 'memory_read']);
    for (const tool of tools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description).toContain('记忆');
      expect(tool.parameters).toMatchObject({ type: 'object' });
      expect(typeof tool.output.render).toBe('function');
      expect(typeof tool.execute).toBe('function');
    }
    const search = tools[0] as ToolDefinition;
    expect(search.parameters).toMatchObject({
      required: ['query'],
      properties: { query: { type: 'string' }, device: { enum: ['all', 'current'] } },
    });
    expect((tools[1] as ToolDefinition).parameters).toMatchObject({ required: ['session_id'] });
  });

  it('output.render serializes the value as text', () => {
    const [tool] = createMemoryTools();
    expect(tool.output.render({}, { hits: [] })).toEqual([{ type: 'text', text: '{"hits":[]}' }]);
  });

  it('registers through ctx.inject(["tools"]) with per-tool effects', () => {
    const register = vi.fn();
    const effects: Array<() => unknown> = [];
    const ctx = {
      inject(services: string[], cb: (toolCtx: any) => void) {
        expect(services).toEqual(['tools']);
        cb({
          get: () => ({ register }),
          effect: (factory: () => unknown) => void effects.push(factory),
        });
      },
    };
    registerMemoryTools(ctx as any);
    expect(register).not.toHaveBeenCalled();
    for (const factory of effects) factory();
    expect(register).toHaveBeenCalledTimes(2);
    expect(register.mock.calls.map((c) => (c[0] as ToolDefinition).name)).toEqual([
      'memory_search',
      'memory_read',
    ]);
  });

  it('logs and skips when the tools service is absent', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = { inject(_s: string[], cb: (toolCtx: any) => void) { cb({ get: () => undefined, effect: () => {} }); } };
    expect(() => registerMemoryTools(ctx as any)).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('disabled/unconfigured config → friendly error', () => {
  it('requireConfig rejects sync disabled with panel hint', () => {
    const dir = configDir({ ...enabledConfig, enabled: false });
    expect(() => requireConfig(join(dir, 'dsh-storage.json'))).toThrowError(/会话存储/);
  });

  it('requireConfig rejects a corrupt config file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-storage-mem-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'dsh-storage.json'), '{oops');
    expect(() => requireConfig(join(dir, 'dsh-storage.json'))).toThrowError(/损坏/);
  });

  it('notConfiguredError is bilingual', () => {
    expect(notConfiguredError().message).toContain('settings panel');
  });

  it('tool execute surfaces the friendly error when sync is off', async () => {
    const dir = configDir({ ...enabledConfig, enabled: false });
    const [search] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json') });
    await expect(search.execute({ query: 'x' }, {})).rejects.toThrowError(/会话存储/);
  });
});

describe('memory_search execution', () => {
  const rows = [
    {
      session_id: 's1',
      device: 'host-a',
      type: 'user',
      content: '请帮我部署 k8s 集群',
      created_at: '2026-11-06T10:00:00+00:00',
    },
  ];

  it('runs the plan and disposes the connection', async () => {
    const dir = configDir(enabledConfig);
    const connection = fakeConnection(rows);
    const connect = vi.fn(async () => connection);
    const [search] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json'), connect });
    const result: any = await search.execute({ query: 'k8s' }, {});
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ device: 'host-a' }));
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ session_id: 's1', device: 'host-a', type: 'user' });
    expect(result.hits[0].snippet).toContain('k8s');
    expect(result.hits[0].snippet.length).toBeLessThanOrEqual(160);
    // LIKE pattern was escaped and bound, device not filtered for 'all'.
    expect(connection.queries[0].args[0]).toBe('%k8s%');
    expect(connection.queries[0].sql).not.toContain('device = ?');
    // argTypes aligned with args (adapter 7.9.1+ requirement).
    expect(connection.queries[0].argTypes).toHaveLength(connection.queries[0].args.length);
  });

  it('binds the configured device for scope current and an empty query short-circuits', async () => {
    const dir = configDir(enabledConfig);
    const connection = fakeConnection(rows);
    const [search] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json'), connect: async () => connection });
    await search.execute({ query: 'x', device: 'current' }, {});
    expect(connection.queries[0].args).toContain('host-a');
    expect(connection.queries).toHaveLength(1);
    const empty: any = await search.execute({ query: '   ' }, {});
    expect(empty).toEqual({ hits: [] });
    expect(connection.queries).toHaveLength(1);
  });
});

describe('memory_read execution', () => {
  const rows = [
    { type: 'user', content: '你好', created_at: '2026-11-06T09:00:00+00:00' },
    { type: 'model', content: '你好！有什么可以帮你？'.repeat(60), created_at: '2026-11-06T09:00:05+00:00' },
  ];

  it('returns chronological role-mapped messages with ≤500-char contents', async () => {
    const dir = configDir(enabledConfig);
    const connection = fakeConnection(rows);
    const [, read] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json'), connect: async () => connection });
    const result: any = await read.execute({ session_id: 's1' }, {});
    expect(result.session_id).toBe('s1');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ role: 'user', type: 'user', content: '你好' });
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content.length).toBeLessThanOrEqual(500);
    expect(result.messages[1].content.endsWith('…')).toBe(true);
  });

  it('reverses the around window to chronological order', async () => {
    const dir = configDir(enabledConfig);
    const connection = fakeConnection([rows[1], rows[0]]);
    const [, read] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json'), connect: async () => connection });
    const result: any = await read.execute({ session_id: 's1', around: '2026-11-06T09:00:10' }, {});
    expect(result.messages[0].content).toBe('你好');
    expect(connection.queries[0].args).toEqual(['s1', '2026-11-06T09:00:10', 30]);
  });

  it('returns an empty window for a missing session_id arg', async () => {
    const dir = configDir(enabledConfig);
    const connection = fakeConnection(rows);
    const [, read] = createMemoryTools({ configPath: join(dir, 'dsh-storage.json'), connect: async () => connection });
    expect(await read.execute({}, {})).toEqual({ session_id: '', messages: [] });
    expect(connection.queries).toHaveLength(0);
  });
});
