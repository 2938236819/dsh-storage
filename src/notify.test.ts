import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  clearToasts,
  drainToasts,
  notifyBadToGood,
  notifyGoodToBad,
  wireNotifications,
} from './notify.js';

describe('notify', () => {
  beforeEach(() => clearToasts());
  afterEach(() => vi.restoreAllMocks());

  it('interrupted toast carries the last error', () => {
    const toast = notifyGoodToBad('connection refused');
    expect(toast.kind).toBe('interrupted');
    expect(toast.text).toBe('⚠️ 会话同步中断：connection refused');
    expect(toast.hint).toBeUndefined();
  });

  it('interrupted toast falls back to 未知错误', () => {
    expect(notifyGoodToBad().text).toBe('⚠️ 会话同步中断：未知错误');
  });

  it('recovered toast copy with backfill hint', () => {
    const toast = notifyBadToGood();
    expect(toast.kind).toBe('recovered');
    expect(toast.text).toBe('✅ 会话同步已恢复');
    expect(toast.hint).toContain('「补传」');
  });

  it('drainToasts returns only records newer than the cursor', () => {
    const first = notifyGoodToBad('a');
    const second = notifyBadToGood();
    expect(drainToasts().map((t) => t.id)).toEqual([first.id, second.id]);
    expect(drainToasts(first.id)).toEqual([second]);
    expect(drainToasts(second.id)).toEqual([]);
  });

  it('caps the history at 20 records', () => {
    for (let i = 0; i < 25; i++) notifyGoodToBad(String(i));
    expect(drainToasts()).toHaveLength(20);
    clearToasts();
    expect(drainToasts()).toEqual([]);
  });

  it('wires ok → down as an interruption with the monitor error', () => {
    let cb: (...args: [string, string, { lastError?: string }?]) => void = () => {};
    const monitor = {
      onTransition: vi.fn((hook: (...args: any[]) => void) => {
        cb = hook;
        return () => {};
      }),
    };
    wireNotifications(monitor);
    cb('down', 'ok', { lastError: 'boom' });
    expect(drainToasts().map((t) => t.text)).toEqual(['⚠️ 会话同步中断：boom']);
  });

  it('never fires for config-error → down (never was good)', () => {
    let cb: (...args: any[]) => void = () => {};
    wireNotifications({
      onTransition: (hook) => {
        cb = hook;
        return () => {};
      },
    });
    cb('down', 'config-error');
    expect(drainToasts()).toEqual([]);
  });

  it('wires down → ok and config-error → ok as recovery', () => {
    let cb: (...args: any[]) => void = () => {};
    wireNotifications({
      onTransition: (hook) => {
        cb = hook;
        return () => {};
      },
    });
    cb('ok', 'down');
    cb('ok', 'config-error');
    expect(drainToasts().filter((t) => t.kind === 'recovered')).toHaveLength(2);
    cb('ok', 'ok');
    cb('down', 'disabled');
    expect(drainToasts().filter((t) => t.kind === 'recovered')).toHaveLength(2);
  });
});
