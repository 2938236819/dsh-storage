# Rebuild-2 Report — source reconstruction + settings panel restyle

Branch: `feat/rebuild` · Commits: `413ab68` (host-side reconstruction), `620cfc6` (client restyle + tests)

## Job A — reconstructed sources (ground truth: lib/*.js)

- `src/notify.ts`, `src/backfill.ts`, `src/ddl.ts`, `src/status-route.ts` — reconstructed from compiled output; `npm run build` output for all four is **byte-identical** to the previous `lib/*.js` (`cmp` clean), including the elided-comment quirks tsc applies at erased declarations.
- The `.d.ts` stubs (`src/{notify,backfill,ddl,status-route}.d.ts`) are deleted; all four are real `.ts` now.
- `src/client/{index.ts,panel.tsx,toast.tsx}` — reconstructed from `lib/client/*.js` with the Job B restyle applied directly to the sources (no bare-look intermediate committed).
- `src/index.test.ts`: root cause of the 46 failures was **not** the stubs — the mirror derives its config from `$DSH_HOME/dsh-storage.json`, and a real DSH home leaked into tests. Fixed by isolating `process.env.DSH_HOME` to a fresh temp dir per test (`mkdtempSync`); all 49 pass unchanged. Backend-config expectation updated for the added `timezone` field.
- `src/backends/database.test.ts`: stale "builds the mysql adapter from a mariadb:// url" test replaced — now asserts discrete decoded options `{host, port, user, password, database}` + `timezone: '+08:00'` passed to `PrismaMariaDb` (encoded credentials `u%40x:p%2Fw` decoded), matching `src/backends/database.ts` and `lib/backends/database.js`.

## Job B — DSH-native card restyle (src/client, inline style objects only)

- Cards: `var(--dsw-alias-bg-layer-1)`, 1px `--dsw-alias-border-l2`, radius 12px, padding 16px 18px, stacked with 14px gap.
- Status banner is the first card: 8px colored dot (ok green `--dsw-alias-state-ok` fallback #34c759, down/config-error `--dsw-alias-state-error-primary`, disabled tertiary) + 13px label + 12px tertiary details; down-state keeps 已重试 N 次 / 最近成功 —.
- 连接设置 card with 12px caption + rows (13px secondary label left, control right); inputs/selects use `--dsw-alias-bg-multi-select`, radius 8px, padding 4px 10px, 13px.
- 操作 card: 保存 = primary accent (`--dsw-alias-state-business-primary`), 测试连接/建表/补传 quiet (transparent + border-l2), radius 8px, padding 6px 14px.
- Test/create/backfill results render as tinted inline pills (radius 999px): 连接成功 / 已连通，但数据表缺失——点「建表」 / 连接失败：reason.
- Toasts (toast.tsx): same card vocabulary + subtle shadow, tone-colored left border, body-mounted portal.
- Section label changed to 「会话存储」 (controller ruling; old bundle's 会话存储镜像 dropped — verified absent from the new bundle).
- No CSS files/frameworks: all styles are inline style objects with alias tokens + safe fallbacks.

## Verification

- `npm run build` (prisma generate + tsc + esbuild) ✅; `npx tsc --noEmit` covers `src/client` too ✅.
- `lib/notify.js`, `lib/backfill.js`, `lib/ddl.js`, `lib/status-route.js` rebuilt **byte-identical** to their predecessors.
- `npm run build:client`: bundle 11,788 bytes (was 8,935) — grew only from inline styles; React stays external, syntax-checked with `node --check`, section label verified inside.
- `npm test`: **191 passed / 191** across 10 files.

### New tests (all previously lost with their sources)

| File | Covers |
|---|---|
| `src/notify.test.ts` (10) | toast copy ⚠️ 会话同步中断：… / ✅ 会话同步已恢复, 20-record cap, sinceId cursor, ok→down only, down→ok & config-error→ok recovery |
| `src/backfill.test.ts` (13) | watermark-first gap skip, log-only session exclusion, fromSeq at first missing row event, JSONL torn-line tolerance, zstd missing-binary error naming the requirement, two-level + flattened log layout, replay + idempotent second run (skips, no double rollup), per-session error reporting |
| `src/ddl.test.ts` (6) | embedded mysql/sqlite statements executed in order over the adapter connection + dispose, `fail:` mapping (never throws), postgresql → `prisma db push` fallback with prisma-CLI fail message |
| `src/status-route.test.ts` (9) | rpc.handle registration, per-field cfg guard errors, sinceId validation, unknown endpoint, gateway/internal mapping, real toast drain |
| `src/client/panel.test.tsx` (15) | port validation, buildSaveConfig omits cleared port, three-state statusView incl. down-state 最近成功 —, three-state test-copy, rendered cards with alias tokens, cleared-port save without `port`, result pills |
| `src/client/toast.test.tsx` (5) | toast poll cursor, interrupted/recovered copy with 补传 hint, click-dismiss |

## Concerns / notes

1. `lib/types/{config,health,backfill}.d.ts` lost their leading doc comments (tsc attaches header comments to erased leading declarations in the reconstructed files); the `.js` outputs are byte-identical, only declaration comments changed.
2. `client.js` grew ~32% (8.9→11.5 KB) purely from the inline style objects — still small, React external.
3. `registerStatusRoute`'s webServer/connection surfaces are typed structurally against the cordis globals; behavior is byte-identical but a type-level drift in the host could need alignment.
4. Panel visual layout (cards/pills) is verified via style assertions in jsdom, not against a live DSH screenshot — a visual pass in the running harness is still worthwhile.

## Status-refresh fix (ad5aa43, 2026-11-06)

**Issue:** toggling 启用同步 + 保存 updated config but the status banner (state light) stayed stale until the 30s poll or a remount.

**Fix (src/client/panel.tsx):**
- Extracted the snapshot fetch into `refreshStatus()` inside the poll effect, published via a `refreshRef` so action handlers re-sync the banner without restarting the poll effect.
- After a successful `saveConfig`: `scheduleStatusRefresh(400)` — a single delayed re-fetch that waits out the backend watchConfig debounce (~300ms) before one deterministic refresh.
- After a completed test-connection (`finally`): immediate `refreshRef.current()`.
- 30s interval unchanged.

**Tests (src/client/panel.test.tsx):**
- Save: fake timers assert snapshot called once at mount, still once right after save, twice after advancing 400ms, three times after a further 30s (exactly one poll tick) — ordering proven without waiting for the poll.
- Test-connection: snapshot re-called immediately (2 calls) after the pill renders, no save involved.

**Verification:** `npm test` 199/199 (11 files), `npm run build` and `npm run build:client` green.

**Note:** dropdown work (src/client/select.tsx + select.test.tsx) is still UNCOMMITTED and was actively being written by another agent during this fix (files mtime 10:47). I fixed only trivial parse errors (stray `)`) in select.test.tsx to unblock the suite; its remaining content and select.tsx were left untouched and uncommitted, per the mid-progress rule. Committed files: panel.tsx, panel.test.tsx only (explicit paths).

## Dropdown: native <select> → DSH-native custom dropdown

**Scope**: presentation only — same options/values, same `set({ provider | timezone })` flow, no RPC/save changes.

- **`src/client/select.tsx` (new)**: `makeDropdown(React)` factory (same pattern as panel — no module-scope React import in the bundle). Trigger matches the old control style (`--dsw-alias-bg-multi-select`, 1px `--dsw-alias-border-l2`, radius 8px, 4px 10px, 13px label-primary, ▾ chevron). Popover: `--dsw-alias-bg-layer-1`, radius 12px, padding 6px, shadow `0 8px 24px rgba(0,0,0,.4)`, rendered `position: fixed` anchored to the trigger rect (cards have no overflow clipping; no portal needed), min-width = trigger width. Items 8px 12px / radius 8px / 13px, hover/active bg `--dsw-alias-interactive-bg-hover`, selected item gets a ✓ in label-primary.
- **Behavior**: click toggles; closes on outside mousedown, Escape, item click; Enter/Space (preventDefault — no double-toggle from the button's synthetic click) open, ArrowDown/Up move the highlight (wrapping), Enter selects; `aria-haspopup=listbox`, `aria-expanded`, `role=listbox/option` + `aria-selected`. Only one popover open at a time via a window `dsh-storage-select-open` event that closes other instances.
- **`src/client/panel.tsx`**: both selects (数据库类型 / 时区) now use the Dropdown; `selectControl` helper re-signatured (testId, value, options, onPick). Custom stored timezone still prepended to `DEFAULT_TIMEZONES` — unchanged.
- **Tests**: new `src/client/select.test.tsx` (6): closed render, open → items → select → onChange + ✓, Escape/outside-click close, keyboard Enter/arrows/Enter, one-open-at-a-time, custom timezone first-option + ✓ placement. Existing panel tests untouched (they query by testid, no select-role queries existed); panel renders green against the new component.
- **Verification**: `npm test` 199 passed / 199 (11 files); `npm run build` + `npm run build:client` green, `lib/client.js` 14.7 KB rebuilt.
- **Note**: jsdom's zero rects mean fixed-position coordinates are untested; visual placement should get one live-harness pass. `git status` also carries unrelated working-tree changes (deleted `src/*.d.ts`, extra panel.test case) — not committed with this task.

## tz-offset

Plugin now publishes `globalThis.__DSH_STORAGE_TZ_OFFSET_MIN__` for the pnpm-patched
@prisma/adapter-mariadb (which ignores its `timezone` option on writes).

- `src/config.ts`: new `tzOffsetMinutes(tz)` — `/^[+-](\d{2}):(\d{2})$/` plus `'UTC'`/`'Z'` → 0; invalid/absent → 0.
- `src/index.ts`: `publishTzOffset()` sets the global in `evaluateMirror()` (initial load + every `watchConfig` fire; re-set only when the effective timezone string changes). Effective tz = mirror target's timezone, falling back to the yaml `config.database.timezone` when the JSON file is absent/disabled. Invalid/absent values log once (module-level flag) and map to 0.
- Tests: `src/config.test.ts` (+480/-300/0/330/invalid cases), `src/index.test.ts` new case asserting `apply()` sets the global (330 for '+05:30') with cleanup.
- Full suite 204 passed (12 files); `npm run build` green.
