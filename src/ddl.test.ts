import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTables, ddlStatementsFor, MYSQL_DDL, SQLITE_DDL } from './ddl.js';
import type { SyncConfig } from './config.js';

const execFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile }));

const adapterMocks = vi.hoisted(() => ({ connect: vi.fn(), executeRaw: vi.fn(), dispose: vi.fn() }));
vi.mock('./backends/database.js', () => ({
  createAdapter: vi.fn(async () => ({
    connect: adapterMocks.connect,
  })),
}));

const mysqlConfig = (overrides: Partial<SyncConfig> = {}): SyncConfig => ({
  enabled: true,
  provider: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  user: 'u',
  password: 'p',
  database: 'db',
  timezone: '+08:00',
  ...overrides,
});

beforeEach(() => {
  adapterMocks.connect.mockReset().mockResolvedValue({
    executeRaw: adapterMocks.executeRaw,
    dispose: adapterMocks.dispose.mockResolvedValue(undefined),
  });
  adapterMocks.executeRaw.mockReset().mockResolvedValue(undefined);
  adapterMocks.dispose.mockReset().mockResolvedValue(undefined);
  execFile.mockReset();
});

describe('ddl', () => {
  it('exposes embedded statements only for mysql and sqlite', () => {
    expect(ddlStatementsFor('mysql')).toBe(MYSQL_DDL);
    expect(ddlStatementsFor('sqlite')).toBe(SQLITE_DDL);
    expect(ddlStatementsFor('postgresql')).toBeUndefined();
    expect(ddlStatementsFor('sqlserver')).toBeUndefined();
  });

  it('mysql DDL creates histories first (ai_messages carries the FK)', () => {
    expect(MYSQL_DDL).toHaveLength(2);
    expect(MYSQL_DDL[0]).toContain('CREATE TABLE IF NOT EXISTS `ai_chat_histories`');
    expect(MYSQL_DDL[1]).toContain('CREATE TABLE IF NOT EXISTS `ai_messages`');
    expect(MYSQL_DDL[1]).toContain('FOREIGN KEY (`history_id`) REFERENCES `ai_chat_histories`');
  });

  it('runs the embedded mysql DDL over the adapter connection', async () => {
    await expect(createTables(mysqlConfig())).resolves.toBe('ok');
    expect(adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql)).toEqual([...MYSQL_DDL]);
    expect(adapterMocks.dispose).toHaveBeenCalledTimes(1);
  });

  it('maps embedded-DDL failures to fail:<reason> without throwing', async () => {
    adapterMocks.executeRaw.mockRejectedValue(new Error('table exists'));
    const result = await createTables(mysqlConfig());
    expect(result).toBe('fail:table exists');
    expect(adapterMocks.dispose).toHaveBeenCalledTimes(1);
  });

  it('sqlite runs its embedded DDL with IF NOT EXISTS forms', async () => {
    await expect(createTables(mysqlConfig({ provider: 'sqlite', database: '/tmp/x.sqlite' }))).resolves.toBe('ok');
    expect(adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql)).toEqual([...SQLITE_DDL]);
    expect(SQLITE_DDL.every((stmt) => stmt.includes('IF NOT EXISTS'))).toBe(true);
  });

  it('falls back to prisma db push for postgresql and maps CLI failure to fail:', async () => {
    execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(new Error('command not found: npx'), '', '');
    });
    const result = await createTables(mysqlConfig({ provider: 'postgresql' }));
    expect(result).toContain('fail:postgresql 建表需要 prisma CLI');
    expect(execFile.mock.calls[0][1]).toEqual([
      'prisma', 'db', 'push',
      '--schema', expect.stringContaining('schema.postgresql.prisma'),
      '--url', 'postgresql://u:p@127.0.0.1:3306/db',
      '--accept-data-loss',
    ]);
  });
});
