/**
 * Sync-status toast notifications (Task 6): a standalone React portal the
 * client entry mounts on document.body — independent of the settings panel
 * section, so toasts appear even when the panel is closed. The host records
 * toasts on HealthMonitor transitions (src/notify.ts); this component polls
 * them through the status bridge with a `sinceId` cursor.
 *
 * Factory pattern like panel.tsx: React (and react-dom's createPortal) come
 * from the host page's module loader, never bundled.
 */
import type { StorageToast } from '../notify.js';
export interface ToastClient {
    toasts(payload: {
        sinceId: number;
    }): Promise<StorageToast[]>;
}
/** Default poll interval; transitions are rare, this only carries toasts. */
export declare const TOAST_POLL_MS = 5000;
/** How long a toast stays on screen. */
export declare const TOAST_DISPLAY_MS = 8000;
export interface ReactLike {
    createElement: any;
    useState: <S>(initial: S) => [S, (value: S | ((prev: S) => S)) => void];
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void;
    useRef: <T>(initial: T) => {
        current: T;
    };
}
export interface PortalDom {
    createPortal: (node: any, container: Element) => any;
}
export declare function makeToastHost(React: ReactLike, ReactDOM: PortalDom): {
    (props: {
        client: ToastClient;
        pollMs?: number;
    }): any;
    displayName: string;
};
