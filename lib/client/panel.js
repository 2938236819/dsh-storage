/**
 * Settings-panel component for dsh-storage (会话存储镜像).
 *
 * Authored against the reference client plugins (dsh-pet / dsh-video-skin):
 * the browser half receives React from the host module loader inside the
 * __ModuleLoader__ factory, so the component is built through a factory that
 * takes the React module — no module-scope React import survives into the
 * bundle. All RPC goes through the injected `client` (connection rpc; see
 * src/client/index.ts), which keeps this file render-pure and testable with
 * a fake client.
 */
export const DEFAULT_TIMEZONES = ['+08:00', '+00:00', '+09:00', '-05:00', '-08:00', '+05:30'];
/** Mirrors config.ts isValidPort — kept local so no node builtins enter the browser bundle. */
export function isValidPort(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535;
}
/**
 * The cfg object to persist: the port is sent only when it is a valid
 * integer — a cleared/garbage port field is omitted so the RPC rejects it
 * with an honest per-field error instead of building a host:NaN URL.
 */
export function buildSaveConfig(cfg) {
    if (isValidPort(cfg.port))
        return cfg;
    const { port: _omitted, ...rest } = cfg;
    return rest;
}
/** Status-light copy per HealthStatus.state. */
export function statusView(status) {
    const details = [];
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
function formatTime(ms) {
    const date = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
/** Three-state connection-test copy: green ok / yellow no-tables / red fail. */
export function testResultView(result) {
    if (result === 'ok')
        return { tone: 'ok', label: '连接成功' };
    if (result === 'no-tables')
        return { tone: 'warn', label: '已连通，但数据表缺失——点「建表」' };
    const reason = result.startsWith('fail:') ? result.slice('fail:'.length) : String(result);
    return { tone: 'bad', label: `连接失败：${reason}` };
}
export function createResultView(result) {
    if (result === 'ok')
        return { tone: 'ok', label: '建表完成' };
    const reason = result.slice('fail:'.length);
    return { tone: 'bad', label: `建表失败：${reason}` };
}
/** 补传 summary copy: green when clean, yellow when some sessions failed. */
export function backfillResultView(summary) {
    const base = `补传完成：${summary.sessions} 个会话，${summary.replayed} 条事件，${summary.skipped} 条重复跳过`;
    if (summary.errors.length === 0)
        return { tone: 'ok', label: base };
    return { tone: 'warn', label: `${base}（${summary.errors.length} 个会话失败）` };
}
const FIELD_STYLE = 'dsh-storage-field';
const TONE_CLASS = {
    ok: 'dsh-storage-tone-ok',
    warn: 'dsh-storage-tone-warn',
    bad: 'dsh-storage-tone-bad',
    idle: 'dsh-storage-tone-idle',
};
export function makeStoragePanel(React) {
    const h = React.createElement;
    function StoragePanel(props) {
        const client = props.client;
        const pollMs = props.pollMs ?? 30_000;
        const [cfg, setCfg] = React.useState(null);
        const [configError, setConfigError] = React.useState(null);
        const [snapshot, setSnapshot] = React.useState(null);
        const [testResult, setTestResult] = React.useState(null);
        const [createResult, setCreateResult] = React.useState(null);
        const [backfillResult, setBackfillResult] = React.useState(null);
        const [busy, setBusy] = React.useState(null);
        const [saved, setSaved] = React.useState(false);
        // Initial config load + status poll (30s).
        React.useEffect(() => {
            let disposed = false;
            client
                .getConfig()
                .then((loaded) => {
                if (!disposed) {
                    setCfg(loaded.config);
                    setConfigError(loaded.error === 'parse' ? '配置文件损坏，已加载默认值' : null);
                }
            })
                .catch((error) => {
                if (!disposed)
                    setConfigError(String(error));
            });
            const refresh = () => {
                client
                    .snapshot()
                    .then((next) => {
                    if (!disposed)
                        setSnapshot(next);
                })
                    .catch(() => { });
            };
            refresh();
            const timer = setInterval(refresh, pollMs);
            return () => {
                disposed = true;
                clearInterval(timer);
            };
        }, [client, pollMs]);
        if (cfg === null) {
            return h('div', { className: 'dsh-storage-panel', 'data-testid': 'dsh-storage-loading' }, configError === null ? '加载中…' : configError);
        }
        const isSqlite = cfg.provider === 'sqlite';
        const set = (patch) => {
            setCfg({ ...cfg, ...patch });
            setSaved(false);
        };
        const runTest = () => {
            setBusy('test');
            setTestResult(null);
            client
                .testConnection(cfg)
                .then(setTestResult)
                .catch((error) => setTestResult(`fail:${String(error)}`))
                .finally(() => setBusy(null));
        };
        const runCreate = () => {
            setBusy('create');
            setCreateResult(null);
            client
                .createTables(cfg)
                .then(setCreateResult)
                .catch((error) => setCreateResult(`fail:${String(error)}`))
                .finally(() => setBusy(null));
        };
        const runSave = () => {
            setBusy('save');
            client
                .saveConfig(buildSaveConfig(cfg))
                .then(() => setSaved(true))
                .catch((error) => setConfigError(String(error)))
                .finally(() => setBusy(null));
        };
        const runBackfill = () => {
            setBusy('backfill');
            setBackfillResult(null);
            client
                .backfill()
                .then(setBackfillResult)
                .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                setBackfillResult(`fail:${message}`);
            })
                .finally(() => setBusy(null));
        };
        const status = snapshot === null ? null : statusView(snapshot);
        const test = testResult === null ? null : testResultView(testResult);
        const created = createResult === null ? null : createResultView(createResult);
        const backfilled = backfillResult === null
            ? null
            : typeof backfillResult === 'string'
                ? { tone: 'bad', label: `补传失败：${backfillResult.slice('fail:'.length)}` }
                : backfillResultView(backfillResult);
        const field = (label, control, key) => h('label', { className: FIELD_STYLE, key }, h('span', { className: 'dsh-storage-label' }, label), control);
        return h('div', { className: 'dsh-storage-panel' }, 
        // Status light.
        h('div', { className: 'dsh-storage-status', 'data-testid': 'dsh-storage-status' }, h('span', {
            className: `dsh-storage-light ${status === null ? '' : TONE_CLASS[status.tone]}`,
            'data-testid': 'dsh-storage-light',
            'data-state': snapshot === null ? 'loading' : snapshot.state,
        }, status === null ? '…' : status.label), status === null
            ? null
            : status.details.map((detail, index) => h('span', { className: 'dsh-storage-detail', key: index }, detail)), configError === null ? null : h('span', { className: 'dsh-storage-detail' }, configError)), 
        // Form.
        h('div', { className: 'dsh-storage-form', 'data-testid': 'dsh-storage-form' }, field('启用同步', h('input', {
            type: 'checkbox',
            checked: cfg.enabled,
            'data-testid': 'dsh-storage-enabled',
            onChange: (e) => set({ enabled: e.target.checked }),
        }), 'enabled'), field('数据库类型', h('select', {
            value: cfg.provider,
            'data-testid': 'dsh-storage-provider',
            onChange: (e) => set({ provider: e.target.value }),
        }, ['mysql', 'postgresql', 'sqlite', 'sqlserver'].map((provider) => h('option', { key: provider, value: provider }, provider))), 'provider'), ...(isSqlite
            ? [
                field('数据库文件路径', h('input', {
                    type: 'text',
                    value: cfg.database,
                    'data-testid': 'dsh-storage-path',
                    placeholder: '/absolute/path/to/dsh-storage.sqlite',
                    onChange: (e) => set({ database: e.target.value }),
                }), 'database'),
            ]
            : [
                field('主机', h('input', {
                    type: 'text',
                    value: cfg.host,
                    'data-testid': 'dsh-storage-host',
                    onChange: (e) => set({ host: e.target.value }),
                }), 'host'),
                field('端口', h('input', {
                    type: 'number',
                    value: cfg.port ?? '',
                    'data-testid': 'dsh-storage-port',
                    // A cleared/invalid field is "unset" (undefined), never 0
                    // or NaN — buildSaveConfig omits it from the saved cfg.
                    onChange: (e) => {
                        const parsed = e.target.value === '' ? NaN : Number(e.target.value);
                        set({ port: isValidPort(parsed) ? parsed : undefined });
                    },
                }), 'port'),
                field('数据库', h('input', {
                    type: 'text',
                    value: cfg.database,
                    'data-testid': 'dsh-storage-database',
                    onChange: (e) => set({ database: e.target.value }),
                }), 'database'),
            ]), field('用户名', h('input', {
            type: 'text',
            value: cfg.user,
            'data-testid': 'dsh-storage-user',
            autoComplete: 'off',
            onChange: (e) => set({ user: e.target.value }),
        }), 'user'), field('密码', h('input', {
            type: 'password',
            value: cfg.password,
            'data-testid': 'dsh-storage-password',
            autoComplete: 'new-password',
            onChange: (e) => set({ password: e.target.value }),
        }), 'password'), field('时区', h('select', {
            value: cfg.timezone,
            'data-testid': 'dsh-storage-timezone',
            onChange: (e) => set({ timezone: e.target.value }),
        }, 
        // A custom stored timezone becomes an option instead of silently
        // displaying '+08:00' — which would mislead on the next save.
        (DEFAULT_TIMEZONES.includes(cfg.timezone)
            ? DEFAULT_TIMEZONES
            : [cfg.timezone, ...DEFAULT_TIMEZONES]).map((tz) => h('option', { key: tz, value: tz }, tz))), 'timezone')), 
        // Actions.
        h('div', { className: 'dsh-storage-actions' }, h('button', {
            type: 'button',
            'data-testid': 'dsh-storage-save',
            disabled: busy !== null,
            onClick: runSave,
        }, busy === 'save' ? '保存中…' : saved ? '已保存' : '保存配置'), h('button', {
            type: 'button',
            'data-testid': 'dsh-storage-test',
            disabled: busy !== null,
            onClick: runTest,
        }, busy === 'test' ? '测试中…' : '测试连接'), h('button', {
            type: 'button',
            'data-testid': 'dsh-storage-create',
            disabled: busy !== null,
            onClick: runCreate,
        }, busy === 'create' ? '建表中…' : '建表'), h('button', {
            type: 'button',
            'data-testid': 'dsh-storage-backfill',
            disabled: busy !== null,
            onClick: runBackfill,
        }, busy === 'backfill' ? '补传中…' : '补传')), 
        // Result lines.
        test === null
            ? null
            : h('p', { className: `dsh-storage-result ${TONE_CLASS[test.tone]}`, 'data-testid': 'dsh-storage-test-result' }, test.label), created === null
            ? null
            : h('p', {
                className: `dsh-storage-result ${TONE_CLASS[created.tone]}`,
                'data-testid': 'dsh-storage-create-result',
            }, created.label), backfilled === null
            ? null
            : h('p', {
                className: `dsh-storage-result ${TONE_CLASS[backfilled.tone]}`,
                'data-testid': 'dsh-storage-backfill-result',
            }, backfilled.label));
    }
    StoragePanel.displayName = 'DshStoragePanel';
    return StoragePanel;
}
