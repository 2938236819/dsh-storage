import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTables, ddlStatementsFor, ensureDeviceColumn, MYSQL_DDL, SQLITE_DDL } from './ddl.js';
import type { SyncConfig } from './config.js';

const execFile = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile }));

const adapterMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  dispose: vi.fn(),
}));
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
  device: 'test-host',
  ...overrides,
});

beforeEach(() => {
  adapterMocks.connect.mockReset().mockResolvedValue({
    executeRaw: adapterMocks.executeRaw,
    queryRaw: adapterMocks.queryRaw,
    dispose: adapterMocks.dispose.mockResolvedValue(undefined),
  });
  adapterMocks.executeRaw.mockReset().mockResolvedValue(undefined);
  // Default queryRaw sequence: device columns present, no unstamped rows →
  // the migration is a no-op.
  adapterMocks.queryRaw.mockReset().mockImplementation(() => {
    const call = adapterMocks.queryRaw.mock.calls.length; // 1-based during the call
    return Promise.resolve(call === 1 ? [[{ n: 2 }]] : [[{ n: 0 }]]);
  });
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
    expect(MYSQL_DDL[0]).toContain('`device` varchar(100)');
    expect(MYSQL_DDL[1]).toContain('`device` varchar(100)');
  });

  it('runs the embedded mysql DDL over the adapter connection', async () => {
    await expect(createTables(mysqlConfig())).resolves.toBe('ok');
    expect(adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql)).toEqual([...MYSQL_DDL]);
    // One connection per phase: DDL + device-column check.
    expect(adapterMocks.dispose).toHaveBeenCalledTimes(2);
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

  it('falls back to prisma db push for postgresql and maps CLI failure to fail:', async () => {    execFile.mockImplementation((_cmd, _args, _opts, cb) => {
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

  describe('ensureDeviceColumn', () => {
    it('is a no-op when both columns exist and no rows are unstamped', async () => {
      adapterMocks.queryRaw
        .mockResolvedValueOnce([[{ n: 2 }]]) // device columns present
        .mockResolvedValueOnce([[{ n: 0 }]]); // no NULL-device rows
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      expect(adapterMocks.executeRaw).not.toHaveBeenCalled();
      expect(adapterMocks.dispose).toHaveBeenCalledTimes(1);
    });

    it('adds the columns and stamps pre-feature rows when missing', async () => {
      adapterMocks.queryRaw
        .mockResolvedValueOnce([[{ n: 0 }]])
        .mockResolvedValueOnce([[{ n: 2118 }]]);
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      const statements = adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql);
      expect(statements).toEqual([
        'ALTER TABLE `ai_messages` ADD COLUMN `device` varchar(100) NULL',
        'ALTER TABLE `ai_chat_histories` ADD COLUMN `device` varchar(100) NULL',
        "UPDATE `ai_messages` SET `device` = 'test-host' WHERE `device` IS NULL",
        "UPDATE `ai_chat_histories` SET `device` = 'test-host' WHERE `device` IS NULL",
      ]);
      // The mariadb adapter cannot take bound parameters outside the prisma
      // engine — the device is embedded as a sanitized literal.
      expect(adapterMocks.executeRaw.mock.calls[2][0].args).toEqual([]);
    });

    it('stamps rows on databases whose columns already exist but were never backfilled', async () => {
      adapterMocks.queryRaw.mockReset()
        .mockImplementationOnce(async () => [[{ n: 2 }]])
        .mockImplementationOnce(async () => ({ columnNames: ['n'], rows: [['45']] }));
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      const statements = adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql);
      expect(statements).toEqual([
        "UPDATE `ai_messages` SET `device` = 'test-host' WHERE `device` IS NULL",
        "UPDATE `ai_chat_histories` SET `device` = 'test-host' WHERE `device` IS NULL",
      ]);
    });

    it('adds the columns when only one table has them (partial migration)', async () => {
      adapterMocks.queryRaw
        .mockResolvedValueOnce([[{ n: 1 }]])
        .mockResolvedValueOnce([[{ n: 0 }]]);
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      expect(adapterMocks.executeRaw).toHaveBeenCalledTimes(2);
    });

    it('uses information_schema via executeRaw when queryRaw is unavailable', async () => {
      adapterMocks.connect.mockResolvedValue({
        executeRaw: adapterMocks.executeRaw
          .mockResolvedValueOnce([{ n: 2 }]) // column count
          .mockResolvedValueOnce([{ n: 0 }]), // unstamped count
        dispose: adapterMocks.dispose,
      });
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      expect(adapterMocks.executeRaw.mock.calls[0][0].sql).toContain('information_schema.columns');
      expect(adapterMocks.executeRaw.mock.calls).toHaveLength(2);
    });

    it('maps migration failures to fail:<reason> without throwing', async () => {
      adapterMocks.queryRaw.mockResolvedValue([[{ n: 0 }]]);
      adapterMocks.executeRaw.mockRejectedValue(new Error('locked table'));
      await expect(ensureDeviceColumn({ ...mysqlConfig(), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('fail:locked table');
    });

    it('skips non-mysql providers entirely', async () => {
      await expect(ensureDeviceColumn({ ...mysqlConfig({ provider: 'sqlite', database: '/tmp/x.sqlite' }), url: 'mysql://u:p@127.0.0.1:3306/db' }, 'test-host')).resolves.toBe('ok');
      expect(adapterMocks.connect).not.toHaveBeenCalled();
    });

    it('runs the migration as part of createTables when the columns are missing', async () => {
      adapterMocks.queryRaw
        .mockResolvedValueOnce([[{ n: 0 }]])
        .mockResolvedValueOnce([[{ n: 0 }]]);
      await expect(createTables(mysqlConfig())).resolves.toBe('ok');
      const statements = adapterMocks.executeRaw.mock.calls.map(([q]) => q.sql);
      expect(statements.slice(0, 2)).toEqual([...MYSQL_DDL]);
      expect(statements).toContain('ALTER TABLE `ai_messages` ADD COLUMN `device` varchar(100) NULL');
    });
  });
});

describe('sqlString', () => {
  it('strips quote/backtick/backslash/NUL characters and truncates to the column width', async () => {
    const { sqlString } = await import('./ddl.js');
    expect(sqlString("Mac'Book`Pro\\x")).toBe('MacBookProx');
    expect(sqlString('a\u0000b')).toBe('ab');
    expect(sqlString('x'.repeat(200))).toHaveLength(100);
    expect(sqlString('MacBook-Pro.local')).toBe('MacBook-Pro.local');
  });
});
