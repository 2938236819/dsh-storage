/**
 * Settings-panel component for dsh-storage (会话存储).
 *
 * Authored against the reference client plugins (dsh-pet / dsh-video-skin):
 * the browser half receives React from the host module loader inside the
 * __ModuleLoader__ factory, so the component is built through a factory that
 * takes the React module — no module-scope React import survives into the
 * bundle. All RPC goes through the injected `client` (connection rpc; see
 * src/client/index.ts), which keeps this file render-pure and testable with
 * a fake client.
 *
 * Visual design: DSH-native sectioned rounded cards (matched to the DSH
 * account-settings screen) — var(--dsw-alias-*) tokens only, applied through
 * inline style objects so no CSS file ships with the bundle.
 */

import { makeDropdown } from './select.js';

export const DEFAULT_TIMEZONES = ['+08:00', '+00:00', '+09:00', '-05:00', '-08:00', '+05:30'];

/** Mirrors config.ts isValidPort — kept local so no node builtins enter the browser bundle. */
export function isValidPort(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535;
}

/**
 * The cfg object to persist: the port is sent only when it is a valid
 * integer — a cleared/garbage port field is omitted so the RPC rejects it
 * with an honest per-field error instead of building a host:NaN URL.
 */
export function buildSaveConfig<T extends { port?: number }>(cfg: T): T | Omit<T, 'port'> {
    if (isValidPort(cfg.port))
        return cfg;
    const { port: _omitted, ...rest } = cfg;
    return rest;
}

/* ------------------------------------------------------------------ *
 * DSH design tokens (alias layer, with safe fallbacks)
 * ------------------------------------------------------------------ */

const TOKEN = {
    bgCard: 'var(--dsw-alias-bg-layer-1)',
    bgControl: 'var(--dsw-alias-bg-multi-select)',
    border: '1px solid var(--dsw-alias-border-l2)',
    radiusCard: '12px',
    radiusControl: '8px',
    labelPrimary: 'var(--dsw-alias-label-primary)',
    labelSecondary: 'var(--dsw-alias-label-secondary)',
    labelTertiary: 'var(--dsw-alias-label-tertiary)',
    accent: 'var(--dsw-alias-state-business-primary)',
    ok: 'var(--dsw-alias-state-ok, #34c759)',
    warn: 'var(--dsw-alias-state-warn, #d9a410)',
    error: 'var(--dsw-alias-state-error-primary)',
} as const;

/** Tone of a status/pill view — drives the banner dot and result pills. */
export type Tone = 'ok' | 'warn' | 'bad' | 'idle';

const TONE_COLOR: Record<Tone, string> = {
    ok: TOKEN.ok,
    warn: TOKEN.warn,
    bad: TOKEN.error,
    idle: TOKEN.labelTertiary,
};

/** Tinted pill background per tone (low-alpha overlay of the tone color). */
const TONE_PILL_BG: Record<Tone, string> = {
    ok: 'color-mix(in srgb, var(--dsw-alias-state-ok, #34c759) 14%, transparent)',
    warn: 'color-mix(in srgb, var(--dsw-alias-state-warn, #d9a410) 16%, transparent)',
    bad: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 14%, transparent)',
    idle: 'var(--dsw-alias-bg-multi-select)',
};

/** One sectioned card: rounded surface, DSH layer-1 background. */
const cardStyle: Record<string, string | number> = {
    background: TOKEN.bgCard,
    border: TOKEN.border,
    borderRadius: TOKEN.radiusCard,
    padding: '16px 18px',
    boxSizing: 'border-box',
};

/** 12px section caption above card content. */
const captionStyle: Record<string, string | number> = {
    fontSize: 12,
    lineHeight: '16px',
    color: TOKEN.labelTertiary,
    margin: 0,
    marginBottom: 10,
};

/** Form row: label left, control right; 12px vertical rhythm. */
const rowStyle: Record<string, string | number> = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 32,
};

const rowLabelStyle: Record<string, string | number> = {
    fontSize: 13,
    color: TOKEN.labelSecondary,
};

const controlStyle: Record<string, string | number> = {
    background: TOKEN.bgControl,
    border: TOKEN.border,
    borderRadius: TOKEN.radiusControl,
    padding: '4px 10px',
    fontSize: 13,
    color: TOKEN.labelPrimary,
    outline: 'none',
    minWidth: 0,
};

const primaryButtonStyle: Record<string, string | number> = {
    borderRadius: TOKEN.radiusControl,
    padding: '6px 14px',
    fontSize: 13,
    border: 'none',
    background: TOKEN.accent,
    color: 'var(--dsw-alias-label-contrast, #fff)',
    cursor: 'pointer',
};

const quietButtonStyle: Record<string, string | number> = {
    borderRadius: TOKEN.radiusControl,
    padding: '6px 14px',
    fontSize: 13,
    background: 'transparent',
    border: TOKEN.border,
    color: TOKEN.labelPrimary,
    cursor: 'pointer',
};

const disabledOverlay: Record<string, string | number> = { opacity: 0.5, cursor: 'default' };

/** Tinted inline pill for test/create/backfill results. */
function pillStyle(tone: Tone): Record<string, string | number> {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: '999px',
        padding: '3px 10px',
        fontSize: 12,
        background: TONE_PILL_BG[tone],
        color: TONE_COLOR[tone],
        margin: 0,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
    };
}

/** Status-light copy per HealthStatus.state. */
export function statusView(status: {
    state: 'ok' | 'down' | 'disabled' | 'config-error';
    mirroredTotal?: number;
    lastOkAt?: number;
    lastError?: string;
    retryCount: number;
}): { tone: Tone; label: string; details: string[] } {
    const details: string[] = [];
    switch (status.state) {
        case 'ok':
            if (status.mirroredTotal !== undefined)
                details.push(`已镜像 ${status.mirroredTotal} 条`);
            if (status.lastOkAt !== undefined)
                details.push(`最近成功 ${formatTime(status.lastOkAt)}`);
            return { tone: 'ok', label: '运行正常', details };
        case 'down':
            details.push(`已重试 ${status.retryCount} 次`);
            details.push(`最近成功 ${status.lastOkAt !== undefined ? formatTime(status.lastOkAt) : '—'}`);
            if (status.lastError !== undefined)
                details.push(status.lastError);
            return { tone: 'bad', label: '连接中断', details };
        case 'disabled':
            return { tone: 'idle', label: '未启用', details };
        case 'config-error':
            if (status.lastError !== undefined)
                details.push(status.lastError);
            return { tone: 'bad', label: '配置错误', details };
    }
}

function formatTime(ms: number): string {
    const date = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Three-state connection-test copy: green ok / yellow no-tables / red fail. */
export function testResultView(result: string): { tone: Tone; label: string } {
    if (result === 'ok')
        return { tone: 'ok', label: '连接成功' };
    if (result === 'no-tables')
        return { tone: 'warn', label: '已连通，但数据表缺失——点「建表」' };
    const reason = result.startsWith('fail:') ? result.slice('fail:'.length) : String(result);
    return { tone: 'bad', label: `连接失败：${reason}` };
}

export function createResultView(result: string): { tone: Tone; label: string } {
    if (result === 'ok')
        return { tone: 'ok', label: '建表完成' };
    const reason = result.slice('fail:'.length);
    return { tone: 'bad', label: `建表失败：${reason}` };
}

/** 补传 summary copy: green when clean, yellow when some sessions failed. */
export function backfillResultView(summary: {
    sessions: number;
    replayed: number;
    skipped: number;
    errors: string[];
}): { tone: Tone; label: string } {
    const base = `补传完成：${summary.sessions} 个会话，${summary.replayed} 条事件，${summary.skipped} 条重复跳过`;
    if (summary.errors.length === 0)
        return { tone: 'ok', label: base };
    return { tone: 'warn', label: `${base}（${summary.errors.length} 个会话失败）` };
}

export interface StorageClient {
    snapshot(): Promise<Record<string, unknown>>;
    testConnection(cfg: unknown): Promise<string>;
    createTables(cfg: unknown): Promise<string>;
    getConfig(): Promise<{ config: Record<string, unknown>; error?: 'parse' | 'missing-field' }>;
    saveConfig(cfg: unknown): Promise<unknown>;
    backfill(): Promise<unknown>;
    toasts(payload: { sinceId?: number }): Promise<unknown[]>;
}

/** One labeled form row: label left, control right. */
export function makeStoragePanel(React: any) {
    const h: any = React.createElement;
    const Dropdown = makeDropdown(React);


    /** One labeled form row: label left, control right. */
    function fieldRow(label: string, control: any, key: string) {
        return h('div', { style: rowStyle, key },
            h('span', { style: rowLabelStyle }, label),
            control);
    }

    function StoragePanel(props: { client: StorageClient; pollMs?: number }) {
        const client = props.client;
        const pollMs = props.pollMs ?? 30_000;
        const [cfg, setCfg] = (React as any).useState(null);
        const [configError, setConfigError] = React.useState(null);
        const [snapshot, setSnapshot] = (React as any).useState(null);
        const [testResult, setTestResult] = React.useState(null);
        const [createResult, setCreateResult] = React.useState(null);
        const [backfillResult, setBackfillResult] = (React as any).useState(null);
        const [busy, setBusy] = React.useState(null);
        const [saved, setSaved] = React.useState(false);
        // Latest in-effect refreshStatus, so action handlers can re-sync the
        // status banner without re-triggering the poll effect.
        const refreshRef = React.useRef<() => void>(() => { });

        // Initial config load + status poll (30s).
        React.useEffect(() => {
            let disposed = false;
            client
                .getConfig()
                .then((loaded: any) => {
                    if (!disposed) {
                        setCfg(loaded.config);
                        setConfigError(loaded.error === 'parse' ? '配置文件损坏，已加载默认值' : null);
                    }
                })
                .catch((error: unknown) => {
                    if (!disposed)
                        setConfigError(String(error));
                });
            const refreshStatus = () => {
                client
                    .snapshot()
                    .then((next: any) => {
                        if (!disposed)
                            setSnapshot(next);
                    })
                    .catch(() => { });
            };
            refreshRef.current = refreshStatus;
            refreshStatus();
            const timer = setInterval(refreshStatus, pollMs);
            return () => {
                disposed = true;
                clearInterval(timer);
            };
        }, [client, pollMs]);

        /**
         * Re-fetch the status snapshot once, after `delayMs`. The backend
         * state machine transitions a few hundred ms after a config write
         * (watchConfig debounce → monitor stop/start), so a post-save refresh
         * waits out that debounce instead of racing it.
         */
        const scheduleStatusRefresh = (delayMs: number) => {
            setTimeout(() => { refreshRef.current(); }, delayMs);
        };

        if (cfg === null) {
            return h('div', { style: cardStyle, 'data-testid': 'dsh-storage-loading' },
                configError === null ? '加载中…' : configError);
        }

        const isSqlite = cfg.provider === 'sqlite';
        const set = (patch: Record<string, unknown>) => {
            setCfg({ ...cfg, ...patch });
            setSaved(false);
        };
        const runTest = () => {
            setBusy('test');
            setTestResult(null);
            client
                .testConnection(cfg)
                .then(setTestResult)
                .catch((error: unknown) => setTestResult(`fail:${String(error)}`))
                .finally(() => {
                    setBusy(null);
                    refreshRef.current();
                });
        };
        const runCreate = () => {
            setBusy('create');
            setCreateResult(null);
            client
                .createTables(cfg)
                .then(setCreateResult)
                .catch((error: unknown) => setCreateResult(`fail:${String(error)}`))
                .finally(() => setBusy(null));
        };
        const runSave = () => {
            setBusy('save');
            client
                .saveConfig(buildSaveConfig(cfg))
                .then(() => setSaved(true))
                .then(() => {
                    // Backend state transitions land after the watchConfig
                    // debounce (~300ms); wait it out, then refresh the banner.
                    scheduleStatusRefresh(400);
                })
                .catch((error: unknown) => setConfigError(String(error)))
                .finally(() => setBusy(null));
        };
        const runBackfill = () => {
            setBusy('backfill');
            setBackfillResult(null);
            client
                .backfill()
                .then(setBackfillResult)
                .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    setBackfillResult(`fail:${message}`);
                })
                .finally(() => setBusy(null));
        };

        const status = snapshot === null ? null : statusView(snapshot as any);
        const test = testResult === null ? null : testResultView(testResult);
        const created = createResult === null ? null : createResultView(createResult);
        const backfilled = backfillResult === null
            ? null
            : typeof backfillResult === 'string'
                ? { tone: 'bad' as Tone, label: `补传失败：${backfillResult.slice('fail:'.length)}` }
                : backfillResultView(backfillResult as any);

        const textControl = (extra: Record<string, unknown>) => ({
            type: 'text',
            style: { ...controlStyle, width: 220 },
            ...extra,
        });

        const checkboxControl = (extra: Record<string, unknown>) => h('input', {
            type: 'checkbox',
            ...extra,
        });

        // DSH-native dropdown replaces the OS-rendered <select> popup;
        // onChange reports the chosen value directly (no synthetic event).
        const selectControl = (testId: string, value: string, options: string[], onPick: (value: string) => void) =>
            h(Dropdown, { value, options, onChange: onPick, testId });

        return h('div', {
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
            },
        },
        // Status banner — first card: colored dot + compact text row.
        h('div', { style: cardStyle, 'data-testid': 'dsh-storage-status' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                h('span', {
                    style: {
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: snapshot === null
                            ? TOKEN.labelTertiary
                            : TONE_COLOR[status!.tone],
                        flexShrink: 0,
                    },
                    'data-testid': 'dsh-storage-light',
                    'data-state': snapshot === null ? 'loading' : snapshot.state,
                }),
                h('span', {
                    style: {
                        fontSize: 13,
                        color: snapshot === null
                            ? TOKEN.labelTertiary
                            : status!.tone === 'idle'
                                ? TOKEN.labelTertiary
                                : TOKEN.labelPrimary,
                    },
                }, status === null ? '…' : status.label),
                status === null
                    ? null
                    : status.details.map((detail, index) => h('span', {
                        key: index,
                        style: { fontSize: 12, color: TOKEN.labelTertiary },
                    }, detail)),
                configError === null ? null : h('span', {
                    style: { fontSize: 12, color: TONE_COLOR.bad },
                }, configError))),
        // Connection settings card.
        h('div', { style: cardStyle, 'data-testid': 'dsh-storage-form' },
            h('p', { style: captionStyle }, '连接设置'),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
                fieldRow('启用同步', checkboxControl({
                    checked: cfg.enabled,
                    'data-testid': 'dsh-storage-enabled',
                    onChange: (e: any) => set({ enabled: e.target.checked }),
                }), 'enabled'),
                fieldRow('数据库类型', selectControl('dsh-storage-provider', cfg.provider,
                    ['mysql', 'postgresql', 'sqlite', 'sqlserver'], (value) => set({ provider: value })), 'provider'),
                ...(isSqlite
                    ? [
                        fieldRow('数据库文件路径', h('input', textControl({
                            value: cfg.database,
                            'data-testid': 'dsh-storage-path',
                            placeholder: '/absolute/path/to/dsh-storage.sqlite',
                            onChange: (e: any) => set({ database: e.target.value }),
                        })), 'database'),
                    ]
                    : [
                        fieldRow('主机', h('input', textControl({
                            value: cfg.host,
                            'data-testid': 'dsh-storage-host',
                            onChange: (e: any) => set({ host: e.target.value }),
                        })), 'host'),
                        fieldRow('端口', h('input', {
                            type: 'number',
                            style: { ...controlStyle, width: 220 },
                            value: cfg.port ?? '',
                            'data-testid': 'dsh-storage-port',
                            // A cleared/invalid field is "unset" (undefined), never 0
                            // or NaN — buildSaveConfig omits it from the saved cfg.
                            onChange: (e: any) => {
                                const parsed = e.target.value === '' ? NaN : Number(e.target.value);
                                set({ port: isValidPort(parsed) ? parsed : undefined });
                            },
                        }), 'port'),
                        fieldRow('数据库', h('input', textControl({
                            value: cfg.database,
                            'data-testid': 'dsh-storage-database',
                            onChange: (e: any) => set({ database: e.target.value }),
                        })), 'database'),
                    ]),
                fieldRow('用户名', h('input', textControl({
                    value: cfg.user,
                    'data-testid': 'dsh-storage-user',
                    autoComplete: 'off',
                    onChange: (e: any) => set({ user: e.target.value }),
                })), 'user'),
                fieldRow('密码', h('input', {
                    type: 'password',
                    style: { ...controlStyle, width: 220 },
                    value: cfg.password,
                    'data-testid': 'dsh-storage-password',
                    autoComplete: 'new-password',
                    onChange: (e: any) => set({ password: e.target.value }),
                }), 'password'),
                fieldRow('时区', selectControl('dsh-storage-timezone', cfg.timezone,
                    // A custom stored timezone becomes an option instead of silently
                    // displaying '+08:00' — which would mislead on the next save.
                    DEFAULT_TIMEZONES.includes(cfg.timezone)
                        ? DEFAULT_TIMEZONES
                        : [cfg.timezone, ...DEFAULT_TIMEZONES],
                    (value) => set({ timezone: value })), 'timezone'))),
        // Actions + results card.
        h('div', { style: cardStyle },
            h('p', { style: captionStyle }, '操作'),
            h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                h('button', {
                    type: 'button',
                    style: {
                        ...primaryButtonStyle,
                        ...(busy !== null ? disabledOverlay : {}),
                    },
                    'data-testid': 'dsh-storage-save',
                    disabled: busy !== null,
                    onClick: runSave,
                }, busy === 'save' ? '保存中…' : saved ? '已保存' : '保存'),
                h('button', {
                    type: 'button',
                    style: {
                        ...quietButtonStyle,
                        ...(busy !== null ? disabledOverlay : {}),
                    },
                    'data-testid': 'dsh-storage-test',
                    disabled: busy !== null,
                    onClick: runTest,
                }, busy === 'test' ? '测试中…' : '测试连接'),
                h('button', {
                    type: 'button',
                    style: {
                        ...quietButtonStyle,
                        ...(busy !== null ? disabledOverlay : {}),
                    },
                    'data-testid': 'dsh-storage-create',
                    disabled: busy !== null,
                    onClick: runCreate,
                }, busy === 'create' ? '建表中…' : '建表'),
                h('button', {
                    type: 'button',
                    style: {
                        ...quietButtonStyle,
                        ...(busy !== null ? disabledOverlay : {}),
                    },
                    'data-testid': 'dsh-storage-backfill',
                    disabled: busy !== null,
                    onClick: runBackfill,
                }, busy === 'backfill' ? '补传中…' : '补传')),
            test === null ? null : h('div', { style: { marginTop: 12 } },
                h('p', { style: pillStyle(test.tone), 'data-testid': 'dsh-storage-test-result' }, test.label)),
            created === null ? null : h('div', { style: { marginTop: 12 } },
                h('p', { style: pillStyle(created.tone), 'data-testid': 'dsh-storage-create-result' }, created.label)),
            backfilled === null ? null : h('div', { style: { marginTop: 12 } },
                h('p', { style: pillStyle(backfilled.tone), 'data-testid': 'dsh-storage-backfill-result' }, backfilled.label))));
    }
    StoragePanel.displayName = 'DshStoragePanel';
    return StoragePanel;
}
