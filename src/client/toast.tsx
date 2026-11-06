/**
 * Sync-status toast notifications (Task 6): a standalone React portal the
 * client entry mounts on document.body — independent of the settings panel
 * section, so toasts appear even when the panel is closed. The host records
 * toasts on HealthMonitor transitions (src/notify.ts); this component polls
 * them through the status bridge with a `sinceId` cursor.
 *
 * Factory pattern like panel.tsx: React (and react-dom's createPortal) come
 * from the host page's module loader, never bundled. Visuals share the
 * settings panel's DSH-native card vocabulary (rounded card, border-l2,
 * alias label colors) plus a subtle shadow.
 */

/** Default poll interval; transitions are rare, this only carries toasts. */
export const TOAST_POLL_MS = 5_000;

/** How long a toast stays on screen. */
export const TOAST_DISPLAY_MS = 8_000;

export function makeToastHost(React: any, ReactDOM: any) {
    const h = React.createElement;

    const cardStyle: Record<string, string | number> = {
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '12px',
        padding: '10px 14px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        maxWidth: 360,
        cursor: 'pointer',
    };

    const kindAccent: Record<string, string> = {
        interrupted: 'var(--dsw-alias-state-error-primary)',
        recovered: 'var(--dsw-alias-state-ok, #34c759)',
    };

    function ToastHost(props: { client: { toasts(payload: { sinceId?: number }): Promise<any[]> }; pollMs?: number }) {
        const pollMs = props.pollMs ?? TOAST_POLL_MS;
        const [visible, setVisible] = (React as any).useState([]);
        const cursor = React.useRef(0);
        const dismiss = (id: any) => setVisible((prev: any[]) => prev.filter((t) => t.id !== id));
        React.useEffect(() => {
            let disposed = false;
            const timers = new Set<ReturnType<typeof setTimeout>>();
            const poll = () => {
                props.client
                    .toasts({ sinceId: cursor.current })
                    .then((records: any[]) => {
                        if (disposed || records.length === 0)
                            return;
                        for (const record of records)
                            cursor.current = Math.max(cursor.current, record.id);
                        setVisible((prev: any[]) => [...prev, ...records]);
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
        return ReactDOM.createPortal(h('div', {
            style: {
                position: 'fixed',
                right: 16,
                bottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                zIndex: 9999,
            },
            'data-testid': 'dsh-storage-toasts',
        }, ...visible.map((toast: any) => h('div', {
            key: toast.id,
            style: { ...cardStyle, borderLeft: `3px solid ${kindAccent[toast.kind] ?? 'var(--dsw-alias-border-l2)'}` },
            className: `dsh-storage-toast dsh-storage-toast-${toast.kind}`,
            role: 'status',
            onClick: () => dismiss(toast.id),
        }, h('div', { style: { color: 'var(--dsw-alias-label-primary)' } }, toast.text), toast.hint === undefined
            ? null
            : h('div', {
                style: {
                    fontSize: 12,
                    marginTop: 4,
                    color: 'var(--dsw-alias-label-secondary)',
                },
            }, toast.hint)))), (globalThis as any).document.body);
    }
    ToastHost.displayName = 'DshStorageToasts';
    return ToastHost;
}
