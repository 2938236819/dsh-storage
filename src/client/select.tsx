/**
 * DSH-native dropdown (custom select) for dsh-storage.
 *
 * Replaces native <select> elements whose OS-rendered popup clashes with
 * the dark DSH UI. Same factory pattern as panel.tsx: built through a
 * factory that takes the React module so no module-scope React import
 * survives into the bundle, and styled with var(--dsw-alias-*) tokens
 * through inline style objects (no CSS file ships with the bundle).
 *
 * The popover is rendered with `position: fixed` anchored to the
 * trigger's rect — the settings cards never clip it, and no portal
 * plumbing is needed. Only one dropdown is open at a time: opening one
 * broadcasts a window event that closes any other open instance.
 *
 * Presentation only: it renders the same options and reports the chosen
 * value through onChange; no config handling lives here.
 */

/** Window event name used to close every other open dropdown instance. */
const OPEN_EVENT = 'dsh-storage-select-open';

/** Shared trigger style — mirrors the previous <select> control style. */
const triggerStyle: Record<string, string | number> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    background: 'var(--dsw-alias-bg-multi-select)',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '8px',
    padding: '4px 10px',
    fontSize: 13,
    color: 'var(--dsw-alias-label-primary)',
    outline: 'none',
    minWidth: 0,
    width: 220,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
};

/** Elevated popover surface, fixed under the trigger. */
const popoverStyle: Record<string, string | number> = {
    position: 'fixed',
    background: 'var(--dsw-alias-bg-layer-1)',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: '12px',
    padding: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
    zIndex: 1000,
    boxSizing: 'border-box',
};

/** One option row. */
function itemStyle(highlighted: boolean): Record<string, string | number> {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        background: highlighted ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
        whiteSpace: 'nowrap',
    };
}

export interface DropdownProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    testId?: string;
    disabled?: boolean;
}

/**
 * Builds the Dropdown component against the host-provided React module.
 * Keyboard: Enter/Space toggles, ArrowDown/ArrowUp move the highlight,
 * Enter selects the highlighted item, Escape closes. Outside click
 * closes. The selected item shows a ✓ on the right.
 */
export function makeDropdown(React: any) {
    const h: any = React.createElement;

    return function Dropdown(props: DropdownProps) {
        const [open, setOpen] = (React as any).useState(false);
        const [active, setActive] = (React as any).useState(0);
        const triggerRef = (React as any).useRef<any>(null);
        const [rect, setRect] = (React as any).useState<{ left: number; top: number; width: number } | null>(null);

        const close = React.useCallback(() => setOpen(false), []);

        // One popover at a time: another instance opening closes this one.
        React.useEffect(() => {
            if (!open)
                return;
            const onOtherOpen = () => setOpen(false);
            const onDown = (event: MouseEvent) => {
                const node = triggerRef.current;
                if (node && event.target instanceof Node && node.contains(event.target))
                    return;
                // Clicks inside the fixed popover are not DOM children of the
                // trigger, so they must not count as "outside" either.
                const target = event.target as Element | null;
                if (target && target.closest('[data-dsh-select-popover]'))
                    return;
                setOpen(false);
            };
            const onKey = (event: KeyboardEvent) => {
                if (event.key === 'Escape')
                    setOpen(false);
            };
            window.addEventListener(OPEN_EVENT, onOtherOpen);
            window.addEventListener('mousedown', onDown);
            window.addEventListener('keydown', onKey);
            return () => {
                window.removeEventListener(OPEN_EVENT, onOtherOpen);
                window.removeEventListener('mousedown', onDown);
                window.removeEventListener('keydown', onKey);
            };
        }, [open]);

        const toggle = () => {
            if (open) {
                setOpen(false);
                return;
            }
            const node = triggerRef.current;
            const box = node !== null && typeof node.getBoundingClientRect === 'function'
                ? node.getBoundingClientRect()
                : { left: 0, top: 0, bottom: 0, width: 0 };
            setRect({ left: box.left, top: box.bottom + 4, width: box.width });
            setActive(Math.max(0, props.options.indexOf(props.value)));
            window.dispatchEvent(new window.Event(OPEN_EVENT));
            setOpen(true);
        };

        const onTriggerKeyDown = (event: any) => {
            // Enter/Space toggle — preventDefault stops the browser from also
            // synthesizing a button click, which would toggle twice.
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
                return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!open) {
                    toggle();
                    return;
                }
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const count = props.options.length;
                setActive((prev: number) => (prev + delta + count) % count);
            }
        };

        const select = (value: string) => {
            props.onChange(value);
            setOpen(false);
        };

        const onPopoverKeyDown = (event: any) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                const count = props.options.length;
                setActive((prev: number) => (prev + delta + count) % count);
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const value = props.options[active];
                if (value !== undefined)
                    select(value);
            }
        };

        return h('div', { style: { position: 'relative', display: 'inline-block' } },
            h('button', {
                type: 'button',
                ref: triggerRef,
                style: triggerStyle,
                'data-testid': props.testId,
                'aria-haspopup': 'listbox',
                'aria-expanded': open ? 'true' : 'false',
                disabled: props.disabled === true,
                onClick: toggle,
                onKeyDown: onTriggerKeyDown,
            },
            h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, props.value),
            h('span', { 'aria-hidden': 'true', style: { color: 'var(--dsw-alias-label-tertiary)' } }, '▾')),
            open
                ? h('div', {
                    role: 'listbox',
                    'data-dsh-select-popover': '',
                    'data-testid': props.testId === undefined ? undefined : `${props.testId}-listbox`,
                    style: {
                        ...popoverStyle,
                        minWidth: rect === null ? 220 : rect.width,
                        left: rect === null ? 0 : rect.left,
                        top: rect === null ? 0 : rect.top,
                    },
                    onKeyDown: onPopoverKeyDown,
                },
                props.options.map((option, index) => h('div', {
                    key: option,
                    role: 'option',
                    'aria-selected': option === props.value ? 'true' : 'false',
                    'data-testid': props.testId === undefined ? undefined : `${props.testId}-option-${option}`,
                    style: itemStyle(option === props.value || index === active),
                    onMouseEnter: () => setActive(index),
                    onClick: () => select(option),
                },
                h('span', null, option),
                option === props.value
                    ? h('span', { 'aria-hidden': 'true', style: { color: 'var(--dsw-alias-label-primary)' } }, '✓')
                    : null)))
                : null);
    };
}
