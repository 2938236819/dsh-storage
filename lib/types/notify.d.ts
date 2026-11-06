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
/** 中断 toast: good → bad. */
export declare function notifyGoodToBad(lastError?: string): StorageToast;
/** 恢复 toast: bad → good, with a backfill hint for the gap. */
export declare function notifyBadToGood(): StorageToast;
/** Records newer than `sinceId` (polling cursor for the client). */
export declare function drainToasts(sinceId?: number): StorageToast[];
/** Test/reset hook: drop all history. */
export declare function clearToasts(): void;
/**
 * Wire the toast records onto a monitor's transitions. Good→bad strictly
 * means ok → down (a config error was never "good"); bad→good covers
 * down → ok and config-error → ok.
 */
export declare function wireNotifications(monitor: ToastCapableMonitor): () => void;
