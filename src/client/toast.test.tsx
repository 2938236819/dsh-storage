/// <reference lib="dom" />
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import * as ReactModule from 'react';
import * as ReactDOM from 'react-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { makeToastHost, TOAST_DISPLAY_MS, TOAST_POLL_MS } from './toast.js';

const interrupted = {
  id: 1,
  kind: 'interrupted',
  text: '⚠️ 会话同步中断：boom',
  createdAt: 1,
};
const recovered = {
  id: 2,
  kind: 'recovered',
  text: '✅ 会话同步已恢复',
  hint: '如中断期间有新会话，可在设置面板点「补传」补齐',
  createdAt: 2,
};

function makeClient(records: any[]) {
  return {
    toasts: vi.fn(async ({ sinceId }: { sinceId?: number }) =>
      records.filter((r) => r.id > (sinceId ?? 0))),
  };
}

function renderToasts(records: any[]) {
  const ToastHost = makeToastHost(ReactModule, ReactDOM);
  const client = makeClient(records);
  render(createElement(ToastHost, { client }));
  return client;
}

beforeEach(() => {
  vi.stubGlobal('setInterval', vi.fn(() => 0));
  vi.stubGlobal('clearInterval', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('toast host', () => {
  it('poll interval and display duration constants', () => {
    expect(TOAST_POLL_MS).toBe(5_000);
    expect(TOAST_DISPLAY_MS).toBe(8_000);
  });

  it('renders the interrupt copy ⚠️ 会话同步中断：…', async () => {
    renderToasts([interrupted]);
    expect(await screen.findByTestId('dsh-storage-toasts')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('⚠️ 会话同步中断：boom');
  });

  it('renders the recovery copy ✅ 会话同步已恢复 with the 补传 hint', async () => {
    renderToasts([recovered]);
    const host = await screen.findByTestId('dsh-storage-toasts');
    expect(host.textContent).toContain('✅ 会话同步已恢复');
    expect(host.textContent).toContain('「补传」');
  });

  it('polls with a sinceId cursor and accumulates records', async () => {
    const client = makeClient([interrupted, recovered]);
    const ToastHost = makeToastHost(ReactModule, ReactDOM);
    render(createElement(ToastHost, { client }));
    await vi.waitFor(() => {
      expect(client.toasts).toHaveBeenCalledWith({ sinceId: 0 });
      expect(screen.getAllByRole('status')).toHaveLength(2);
    });
  });

  it('clicking a toast dismisses it', async () => {
    renderToasts([interrupted]);
    const toast = await screen.findByRole('status');
    fireEvent.click(toast);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
