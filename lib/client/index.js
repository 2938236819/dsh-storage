/**
 * Browser half of dsh-storage: registers the settings panel into the DSH
 * settings page (`settings.section` slot) and reaches the host plugin's
 * dshStorageStatus service through the connection generic-RPC channel
 * /dsh-storage (registered host-side in src/status-route.ts).
 *
 * Module shape follows the reference client plugins (dsh-pet, dsh-video-skin,
 * ds-harness-remote): a `window.__ModuleLoader__.load({ id, factory })` call
 * whose factory receives the page's `require` — React comes from the host
 * page, never bundled. Built by esbuild into the single-file lib/client.js.
 */
import { makeStoragePanel } from './panel.js';
import { makeToastHost } from './toast.js';
const MODULE_ID = '@wfm-cn/dsh-storage';
const STATUS_CHANNEL = '/dsh-storage';
function unwrap(envelope) {
    if (envelope && envelope.ok === true)
        return envelope.value;
    const message = envelope?.error?.message || '请求失败';
    throw new Error(message);
}
function makeFactory() {
    return (require) => {
        const React = require('react');
        const StoragePanel = makeStoragePanel(React);
        const ToastHost = makeToastHost(React, require('react-dom'));
        /** Client backed by the page's connection service. */
        function makeClient(ctx) {
            const call = (endpoint, payload = {}) => ctx.connection.rpc.call(STATUS_CHANNEL, endpoint, payload).then(unwrap);
            return {
                snapshot: () => call('snapshot'),
                testConnection: (cfg) => call('testConnection', { cfg }),
                createTables: (cfg) => call('createTables', { cfg }),
                getConfig: () => call('getConfig'),
                saveConfig: (cfg) => call('saveConfig', { cfg }),
                backfill: () => call('backfill'),
                toasts: (payload) => call('toasts', payload),
            };
        }
        /**
         * Toast portal (Task 6): mounted on document.body at client entry —
         * independent of the settings section, so sync-interruption /
         * recovery notifications appear even when the panel is closed.
         */
        function mountToasts(client) {
            if (typeof document === 'undefined')
                return;
            const clientApi = require('react-dom/client');
            if (!clientApi || typeof clientApi.createRoot !== 'function')
                return;
            const host = document.createElement('div');
            host.className = 'dsh-storage-toast-root';
            document.body.appendChild(host);
            const root = clientApi.createRoot(host);
            root.render(React.createElement(ToastHost, { client }));
        }
        function apply(ctx) {
            const client = makeClient(ctx);
            mountToasts(client);
            if (!ctx.slots || typeof ctx.slots.inject !== 'function')
                return;
            ctx.slots.inject('settings.section', () => ctx.slots.register({
                name: 'settings.section',
                id: 'dsh-storage',
                order: 60,
                label: () => '会话存储镜像',
                inject: () => ({ client }),
            }, StoragePanel));
        }
        const module = { exports: {} };
        module.exports.apply = apply;
        module.exports.inject = ['slots', 'connection'];
        return module.exports;
    };
}
const loader = globalThis.__ModuleLoader__;
if (typeof loader === 'object' && loader !== null && typeof loader.load === 'function') {
    loader.load({ id: MODULE_ID, factory: makeFactory() });
}
