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
export {};
