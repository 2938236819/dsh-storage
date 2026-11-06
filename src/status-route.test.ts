import { describe, expect, it, vi } from 'vitest';
import { clearToasts, notifyGoodToBad } from './notify.js';
import { registerStatusRoute, STATUS_CHANNEL } from './status-route.js';
import type { StatusService } from './status-route.js';

function fakeCtx(connection: unknown, webServer?: unknown) {
  return {
    get(name: string) {
      if (name === 'connection')
        return connection;
      if (name === 'webServer')
        return webServer;
      return undefined;
    },
  } as any;
}

const service = (overrides: Partial<StatusService> = {}): StatusService => ({
  snapshot: vi.fn(() => ({ state: 'ok' as const, retryCount: 0 })),
  testConnection: vi.fn(async () => 'ok' as const),
  createTables: vi.fn(async () => 'ok' as const),
  getConfig: vi.fn(() => ({ config: {} as any })),
  saveConfig: vi.fn((cfg) => ({ config: cfg as any })),
  backfill: vi.fn(async () => ({ sessions: 0, replayed: 0, skipped: 0, errors: [] })),
  toasts: vi.fn(() => []),
  ...overrides,
});

/** Registers via the in-process rpc fallback and returns the dispatch handler. */
function rpcHandler(service: StatusService) {
  let handler: ((endpoint: string, payload: unknown) => Promise<unknown>) | undefined;
  const dispose = registerStatusRoute(fakeCtx({
    rpc: {
      handle: vi.fn((_channel, h) => {
        handler = h;
        return () => {};
      }),
    },
  }), service);
  expect(dispose).toBeTypeOf('function');
  expect(handler).toBeTypeOf('function');
  return { handler: handler!, dispose: dispose! };
}

const okEnvelope = (value: unknown) => ({ ok: true, value });

describe('status-route', () => {
  it('uses the channel /dsh-storage', () => {
    expect(STATUS_CHANNEL).toBe('/dsh-storage');
  });

  it('returns undefined without a connection', () => {
    expect(registerStatusRoute(fakeCtx(undefined), service())).toBeUndefined();
  });

  it('returns undefined when the connection has neither webServer nor rpc.handle', () => {
    expect(registerStatusRoute(fakeCtx({}), service())).toBeUndefined();
  });

  it('dispatches simple endpoints and wraps results in ok envelopes', async () => {
    const svc = service();
    const { handler } = rpcHandler(svc);
    await expect(handler('snapshot', {})).resolves.toEqual(okEnvelope(svc.snapshot()));
    await expect(handler('getConfig', {})).resolves.toEqual(okEnvelope({ config: {} }));
    await expect(handler('backfill', {})).resolves.toEqual(
      okEnvelope({ sessions: 0, replayed: 0, skipped: 0, errors: [] }),
    );
    await expect(handler('toasts', { sinceId: 3 })).resolves.toEqual(okEnvelope([]));
    expect(svc.toasts).toHaveBeenCalledWith({ sinceId: 3 });
  });

  it('guards cfg endpoints with per-field errors', async () => {
    const { handler } = rpcHandler(service());
    await expect(handler('testConnection', { cfg: { enabled: true, provider: 'mysql', host: 'h', user: 'u', password: 'p', database: 'd', timezone: '+08:00', port: 'x' } })).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'gateway/bad-request',
        message: expect.stringContaining('cfg.port must be'),
      }),
    });
    await expect(handler('saveConfig', 'nope')).resolves.toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('cfg must be an object') },
    });
    const svc = service();
    const h2 = rpcHandler(svc).handler;
    await expect(h2('createTables', {
      cfg: { enabled: true, provider: 'sqlite', host: '', port: 0, user: '', password: '', database: 'x', timezone: '+08:00' },
    })).resolves.toMatchObject({ ok: true });
  });

  it('rejects a non-numeric toasts sinceId as bad request', async () => {
    const { handler } = rpcHandler(service());
    await expect(handler('toasts', { sinceId: 'x' })).resolves.toMatchObject({
      ok: false,
      error: { message: 'toasts sinceId must be a number' },
    });
    await expect(handler('toasts', {})).resolves.toMatchObject({ ok: true });
  });

  it('rejects unknown endpoints', async () => {
    const { handler } = rpcHandler(service());
    await expect(handler('nope', {})).resolves.toMatchObject({
      ok: false,
      error: { code: 'gateway/bad-request' },
    });
  });

  it('maps handler exceptions to gateway/internal instead of throwing', async () => {
    const { handler } = rpcHandler(service({
      backfill: vi.fn(async () => {
        throw new Error('db gone');
      }),
    }));
    await expect(handler('backfill', {})).resolves.toEqual({
      ok: false,
      error: { code: 'gateway/internal', message: 'db gone', details: {} },
    });
  });

  it('drains real toasts through the bridge', async () => {
    clearToasts();
    const toast = notifyGoodToBad('boom');
    const { handler } = rpcHandler(service({ toasts: (p) => [toast].filter((t) => t.id > (p.sinceId ?? 0)) }));
    await expect(handler('toasts', { sinceId: 0 })).resolves.toEqual(okEnvelope([toast]));
    await expect(handler('toasts', { sinceId: toast.id })).resolves.toEqual(okEnvelope([]));
    clearToasts();
  });
});
