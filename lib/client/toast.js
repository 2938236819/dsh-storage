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
/** Default poll interval; transitions are rare, this only carries toasts. */
export const TOAST_POLL_MS = 5_000;
/** How long a toast stays on screen. */
export const TOAST_DISPLAY_MS = 8_000;
export function makeToastHost(React, ReactDOM) {
    const h = React.createElement;
    function ToastHost(props) {
        const pollMs = props.pollMs ?? TOAST_POLL_MS;
        const [visible, setVisible] = React.useState([]);
        const cursor = React.useRef(0);
        const dismiss = (id) => setVisible((prev) => prev.filter((t) => t.id !== id));
        React.useEffect(() => {
            let disposed = false;
            const timers = new Set();
            const poll = () => {
                props.client
                    .toasts({ sinceId: cursor.current })
                    .then((records) => {
                    if (disposed || records.length === 0)
                        return;
                    for (const record of records)
                        cursor.current = Math.max(cursor.current, record.id);
                    setVisible((prev) => [...prev, ...records]);
                    for (const record of records) {
                        const timer = setTimeout(() => {
                            timers.delete(timer);
                            dismiss(record.id);
                        }, TOAST_DISPLAY_MS);
                        timers.add(timer);
                    }
                })
                    .catch(() => {
                    // The bridge being down must not break the page; next poll retries.
                });
            };
            poll();
            const timer = setInterval(poll, pollMs);
            return () => {
                disposed = true;
                clearInterval(timer);
                for (const t of timers)
                    clearTimeout(t);
            };
        }, [props.client, pollMs]);
        return ReactDOM.createPortal(h('div', { className: 'dsh-storage-toasts', 'data-testid': 'dsh-storage-toasts' }, ...visible.map((toast) => h('div', {
            key: toast.id,
            className: `dsh-storage-toast dsh-storage-toast-${toast.kind}`,
            role: 'status',
            onClick: () => dismiss(toast.id),
        }, h('span', { className: 'dsh-storage-toast-text' }, toast.text), toast.hint === undefined
            ? null
            : h('span', { className: 'dsh-storage-toast-hint' }, toast.hint)))), document.body);
    }
    ToastHost.displayName = 'DshStorageToasts';
    return ToastHost;
}
