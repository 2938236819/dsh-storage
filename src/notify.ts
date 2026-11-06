/**
 * 同步中断/恢复通知 (Task 6): the host side records toast notifications on
 * HealthMonitor transitions; the browser client (src/client/toast.tsx) polls
 * them through the status bridge and renders a React portal independent of
 * the settings panel. The monitor already guarantees transitions only
 * (same-state results never re-fire), so each record is a real state change.
 */

export interface StorageToast {
    id: number;
    kind: 'interrupted' | 'recovered';
    text: string;
    /** Secondary line (recovery backfill hint). */
    hint?: string;
    createdAt: number;
}
/** Minimal monitor surface wireNotifications needs (satisfied by HealthMonitor). */
export interface ToastCapableMonitor {
    onTransition(cb: (to: string, from: string, status: {
        lastError?: string;
    }) => void): () => void;
}

const MAX_TOASTS = 20;
let nextId = 1;
const toasts: StorageToast[] = [];

/** 中断 toast: good → bad. */
export function notifyGoodToBad(lastError?: string): StorageToast {
    return push({
        kind: 'interrupted',
        // No "点击查看" suffix: the toast's click only dismisses — the DSH host
        // exposes no navigation API reachable from the body-mounted portal, so
        // the copy must not promise a click-through.
        text: `⚠️ 会话同步中断：${lastError ?? '未知错误'}`,
    });
}

/** 恢复 toast: bad → good, with a backfill hint for the gap. */
export function notifyBadToGood(): StorageToast {
    return push({
        kind: 'recovered',
        text: '✅ 会话同步已恢复',
        hint: '如中断期间有新会话，可在设置面板点「补传」补齐',
    });
}

function push(record: Omit<StorageToast, 'id' | 'createdAt'>): StorageToast {
    const toast = { ...record, id: nextId++, createdAt: Date.now() };
    toasts.push(toast);
    if (toasts.length > MAX_TOASTS)
        toasts.splice(0, toasts.length - MAX_TOASTS);
    return toast;
}

/** Records newer than `sinceId` (polling cursor for the client). */
export function drainToasts(sinceId = 0): StorageToast[] {
    return toasts.filter((toast) => toast.id > sinceId);
}

/** Test/reset hook: drop all history. */
export function clearToasts(): void {
    toasts.length = 0;
}

/**
 * Wire the toast records onto a monitor's transitions. Good→bad strictly
 * means ok → down (a config error was never "good"); bad→good covers
 * down → ok and config-error → ok.
 */
export function wireNotifications(monitor: ToastCapableMonitor): () => void {
    return monitor.onTransition((to, from, status) => {
        if (to === 'down' && from === 'ok')
            notifyGoodToBad(status?.lastError);
        else if (to === 'ok' && (from === 'down' || from === 'config-error'))
            notifyBadToGood();
    });
}
