/// <reference lib="dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ReactModule from 'react';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import {
  backfillResultView,
  buildSaveConfig,
  createResultView,
  DEFAULT_TIMEZONES,
  isValidPort,
  makeStoragePanel,
  statusView,
  testResultView,
} from './panel.js';

afterEach(() => {
  cleanup();
});

function makeClient(overrides: Record<string, any> = {}) {
  return {
    snapshot: vi.fn(async () => ({ state: 'ok', retryCount: 0 })),
    testConnection: vi.fn(async () => 'ok'),
    createTables: vi.fn(async () => 'ok'),
    getConfig: vi.fn(async () => ({ config: { ...baseCfg } })),
    saveConfig: vi.fn(async () => ({})),
    backfill: vi.fn(async () => ({ sessions: 1, replayed: 2, skipped: 3, errors: [] })),
    toasts: vi.fn(async () => []),
    ...overrides,
  };
}

const baseCfg = {
  enabled: true,
  provider: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  user: 'u',
  password: 'p',
  database: 'db',
  timezone: '+08:00',
};

function renderPanel(client = makeClient(), pollMs = 30_000) {
  // The factory takes the React module; useState etc. are accessed off it.
  const Panel = makeStoragePanel(ReactModule);
  return { client, ...render(createElement(Panel, { client, pollMs })) };
}

describe('panel helpers', () => {
  it('isValidPort accepts finite integers 0..65535 only', () => {
    expect(isValidPort(3306)).toBe(true);
    expect(isValidPort(0)).toBe(true);
    expect(isValidPort(-1)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(NaN)).toBe(false);
    expect(isValidPort(1.5)).toBe(false);
    expect(isValidPort('3306')).toBe(false);
  });

  it('buildSaveConfig omits an invalid port, keeps a valid one', () => {
    expect((buildSaveConfig({ ...baseCfg, port: 1 }) as { port?: number }).port).toBe(1);
    expect((buildSaveConfig({ ...baseCfg }) as { port?: number }).port).toBe(3306);
    const saved = buildSaveConfig({ ...baseCfg, port: undefined });
    expect('port' in saved).toBe(false);
    expect(saved.database).toBe('db');
  });

  it('statusView: ok shows mirrored count and 最近成功', () => {
    const view = statusView({ state: 'ok', retryCount: 0, mirroredTotal: 42, lastOkAt: new Date(2020, 0, 1, 7, 5, 9).getTime() });
    expect(view).toMatchObject({ tone: 'ok', label: '运行正常', details: ['已镜像 42 条', '最近成功 07:05:09'] });
  });

  it('statusView: down shows retries and down-state 最近成功 (— when none)', () => {
    expect(statusView({ state: 'down', retryCount: 3 }).details).toContain('最近成功 —');
    const view = statusView({ state: 'down', retryCount: 2, lastError: 'ECONNREFUSED', lastOkAt: 1 });
    expect(view.tone).toBe('bad');
    expect(view.label).toBe('连接中断');
    expect(view.details).toContain('已重试 2 次');
    expect(view.details).toContain('ECONNREFUSED');
  });

  it('statusView: disabled and config-error', () => {
    expect(statusView({ state: 'disabled', retryCount: 0 })).toMatchObject({ tone: 'idle', label: '未启用', details: [] });
    const view = statusView({ state: 'config-error', retryCount: 0, lastError: 'bad json' });
    expect(view).toMatchObject({ tone: 'bad', label: '配置错误' });
    expect(view.details).toEqual(['bad json']);
  });

  it('three-state connection-test copy', () => {
    expect(testResultView('ok')).toEqual({ tone: 'ok', label: '连接成功' });
    expect(testResultView('no-tables').tone).toBe('warn');
    expect(testResultView('no-tables').label).toContain('建表');
    expect(testResultView('fail:timeout')).toEqual({ tone: 'bad', label: '连接失败：timeout' });
  });

  it('create/backfill result copy', () => {
    expect(createResultView('ok')).toEqual({ tone: 'ok', label: '建表完成' });
    expect(createResultView('fail:x').label).toBe('建表失败：x');
    expect(backfillResultView({ sessions: 1, replayed: 2, skipped: 3, errors: [] }).tone).toBe('ok');
    const partial = backfillResultView({ sessions: 2, replayed: 0, skipped: 0, errors: ['a'] });
    expect(partial.tone).toBe('warn');
    expect(partial.label).toContain('1 个会话失败');
  });

  it('keeps custom timezones as the first option', () => {
    expect(DEFAULT_TIMEZONES[0]).toBe('+08:00');
  });
});

describe('rendered panel', () => {
  it('renders the three cards and loads the stored config', async () => {
    const { client } = renderPanel();
    expect(await screen.findByTestId('dsh-storage-form')).toBeTruthy();
    expect(client.getConfig).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dsh-storage-status')).toBeTruthy();
  });

  it('shows the status banner per snapshot state, down-state 最近成功 included', async () => {
    renderPanel(makeClient({
      snapshot: vi.fn(async () => ({ state: 'down', retryCount: 4, lastError: 'boom' })),
    }));
    const banner = await screen.findByTestId('dsh-storage-status');
    expect(banner.textContent).toContain('连接中断');
    expect(banner.textContent).toContain('已重试 4 次');
    expect(banner.textContent).toContain('最近成功 —');
  });

  it('renders the DSH card design: dsw-alias tokens inline', async () => {
    renderPanel();
    const form = await screen.findByTestId('dsh-storage-form');
    const style = form.getAttribute('style') ?? '';
    expect(style).toContain('--dsw-alias-bg-layer-1');
    expect(style).toContain('border-radius');
    expect(screen.getByTestId('dsh-storage-save').getAttribute('style')).toContain('--dsw-alias-state-business-primary');
    expect(screen.getByTestId('dsh-storage-test').getAttribute('style')).toContain('--dsw-alias-border-l2');
  });

  it('a cleared port field saves a cfg without the port', async () => {
    const { client } = renderPanel();
    await screen.findByTestId('dsh-storage-form');
    const port = screen.getByTestId('dsh-storage-port') as HTMLInputElement;
    fireEvent.change(port, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('dsh-storage-save'));
    await vi.waitFor(() => expect(client.saveConfig).toHaveBeenCalled());
    expect('port' in (client.saveConfig.mock.calls[0] as any[])[0]).toBe(false);
  });

  it('test connection renders the inline result pill per tone', async () => {
    renderPanel(makeClient({ testConnection: vi.fn(async () => 'no-tables') }));
    await screen.findByTestId('dsh-storage-form');
    fireEvent.click(screen.getByTestId('dsh-storage-test'));
    const pill = await screen.findByTestId('dsh-storage-test-result');
    expect(pill.textContent).toContain('数据表缺失');
    expect(pill.getAttribute('style')).toContain('999px');
  });

  it('a rejected testConnection surfaces 连接失败：reason', async () => {
    renderPanel(makeClient({ testConnection: vi.fn(async () => {
      throw new Error('nope');
    }) }));
    await screen.findByTestId('dsh-storage-form');
    fireEvent.click(screen.getByTestId('dsh-storage-test'));
    const pill = await screen.findByTestId('dsh-storage-test-result');
    expect(pill.textContent).toBe('连接失败：Error: nope');
  });

  it('backfill renders the summary pill', async () => {
    renderPanel();
    await screen.findByTestId('dsh-storage-form');
    fireEvent.click(screen.getByTestId('dsh-storage-backfill'));
    const pill = await screen.findByTestId('dsh-storage-backfill-result');
    expect(pill.textContent).toContain('补传完成：1 个会话，2 条事件，3 条重复跳过');
  });

  it('a successful save re-fetches the snapshot without waiting for the poll', async () => {
    vi.useFakeTimers();
    try {
      const { client } = renderPanel();
      // Initial mount snapshot + post-save refresh; the 30s poll stays silent.
      await vi.advanceTimersByTimeAsync(0);
      expect(client.snapshot).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByTestId('dsh-storage-save'));
      await vi.advanceTimersByTimeAsync(0);
      expect(client.saveConfig).toHaveBeenCalledTimes(1);
      expect(client.snapshot).toHaveBeenCalledTimes(1); // still stale
      // Backend lands after the watchConfig debounce; refresh waits ~400ms.
      await vi.advanceTimersByTimeAsync(400);
      expect(client.snapshot).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(client.snapshot).toHaveBeenCalledTimes(3); // only one poll tick since
    } finally {
      vi.useRealTimers();
    }
  });

  it('a completed test-connection re-fetches the snapshot immediately', async () => {
    const { client } = renderPanel();
    await screen.findByTestId('dsh-storage-form');
    expect(client.snapshot).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('dsh-storage-test'));
    await vi.waitFor(() => expect(client.snapshot).toHaveBeenCalledTimes(2));
    expect(client.saveConfig).not.toHaveBeenCalled();
  });
});
