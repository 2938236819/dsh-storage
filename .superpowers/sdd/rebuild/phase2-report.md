# Phase 2 Report — AI Memory Query Tools (`memory_search` / `memory_read`)

Date: 2026-11-06 · Branch: `feat/rebuild`

## 1. Research: model-tool registration contract (verified, not guessed)

**Contract (one line):** a DSH plugin registers model tools via the cordis `tools` service from
`@deepseek-ai/dsh-tools`: `ctx.inject(['tools'], (toolCtx) => { const tools = toolCtx.get('tools');
for (const def of defs) toolCtx.effect(() => tools.register(def)); })`, where a definition is
`{ name, description, parameters: <plain JSON Schema>, output: { schema, render(args, value) → [{type:'text',text}] },
execute(args, exec) }` (`exec.signal` available; `timeoutMs` optional). Tool names are **flat global strings**
(`remote_list_hosts` style — no `mcp__` prefixing, no namespace derivation; scoped/per-agent registration
exists via `agent.ctx` but is unnecessary here).

Verified file paths:

1. **dsh-tools (host)** — app bundle, extracted via `npx @electron/asar` from
   `"/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"` →
   `dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js` (+ `lib/shared-DTdn5dXO.js`):
   - `ToolsService extends Service` (`static inject = ["systemPrompt"]`); `register(definition, options)`
     requires `output { schema, render }` (throws `tool "X" must declare output { schema, render, ... }`),
     validates schema with `assertSupportedJsonSchema`, rejects reserved name `run_code`, returns the
     unregistering disposer; registration inserts into a scoped `ToolLayer.tools` NamedEntries and emits
     `tools/change`. Global names are plain strings; duplicate names in one scope fail.
   - NOTE: `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-tools` is a **broken symlink** into a deleted
     `~/deepseek-harness` checkout — the asar is the only on-disk source for the package.
2. **Working plugin idiom** — `~/.dsh/profiles/desktop/node_modules/ds-harness-remote/dist/remote-tools.js`
   (read in full): `ctx.inject(['tools'], (toolCtx) => { const tools = toolCtx.get('tools');
   for (const definition of [...]) toolCtx.effect(() => tools.register(definition)); })` with plain
   JSON-Schema `parameters` (`{type:'object', properties, required, additionalProperties:false}`) and
   `output.render: (_args, value) => [{type:'text', text: JSON.stringify(value)}]`. This is exactly the
   shape we implemented.
3. **dsh-sql reference** — `https://unpkg.com/dsh-sql@latest/package.json`: same plugin envelope
   (`dsh.bundle.patch` + cordis patch insert), no client-side tool wiring needed — confirms model tools
   are host-side only.

**Param binding detail (argTypes)** — verified in installed adapter sources at
`node_modules/@prisma/adapter-{mariadb,pg,mssql,libsql}/dist/*.js` (7.9.1, + generated 7.10.1 clients):
every adapter maps args as `mapArg(arg, query.argTypes[i])`; **mssql dereferences `argType.scalarType`
unconditionally** and mariadb/pg touch `argType.scalarType` for string args — binding without argTypes
throws (matches the existing ddl.ts comment). The argType shape is the Prisma client runtime record
`{ scalarType: 'string'|'int'|'float'|…, arity: 'scalar'|'list' }` (found in `@prisma/client` runtime
serialization code), **not** the numeric `ColumnTypeEnum`. We always pass aligned argTypes and never
bind `Date` objects (ISO strings; `since` uses a `T00:00:00` delimiter so sqlite TEXT comparison works).
All four adapters' `queryRaw` return `{ columnNames, rows: value[][] }` — normalized uniformly.

**Conclusion: contract is unambiguous — no NEEDS_CONTEXT.**

## 2. Implementation

- `src/memory-tools.ts` (new):
  - `escapeLike` (`~`,`%`,`_` escaped for `ESCAPE '~'` — backslash-free, works on all 4 providers),
    `splitKeywords`, `clampLimit` [1,100].
  - `buildSearchSql(provider, {query, device, limit, since}, deviceId?)`: OR'd `content LIKE ? ESCAPE '~'`
    per keyword, `deleted_at IS NULL AND content IS NOT NULL`, no type filter (user+model rows),
    `device = ?` bound to config device when scope `current`, `created_at >= 'since T00:00:00'`,
    `ORDER BY created_at DESC, id DESC LIMIT ?` (sqlserver: `SELECT TOP n`, no LIMIT).
  - `buildReadSql`: session window ordered `created_at DESC, id DESC`; with `around` it fetches the
    ≤limit newest rows at-or-before the instant and the executor reverses to chronology.
  - `normalizeRows` (columnNames/rows zip), `snippetOf` (≤160, whitespace-collapsed, hit-anchored),
    `toSearchHits`, `toReadMessages` (role user/model→user/assistant, content ≤500 + `…`),
    `requireConfig` / `notConfiguredError` (bilingual friendly error, "请先在设置的「会话存储」面板配置").
  - `createMemoryTools(deps)` builds the two definitions (bilingual descriptions explaining when to use:
    查询/回忆之前的对话、跨设备记忆); `deps.connect`/`deps.configPath` are test seams. Each execution:
    requireConfig → `createAdapter(configToUrl(cfg))` → `connect()` → SELECT → **`dispose()` in finally**.
  - `registerMemoryTools(ctx, deps)` — the verified `ctx.inject(['tools'], …)` idiom, tolerant of a
    missing tools service (logs, skips).
- `src/index.ts`: one line — `registerMemoryTools(...)` right after `ctx.provide('dshStorageStatus', …)`.
  Always registered; disabled/unconfigured sync errors only at call time. Mirror/panel behavior untouched.
- Reused `createAdapter` / `configToUrl` / `loadConfig` / `saveConfig`; **no new dependencies**.
- README.md: new section 「AI 记忆查询工具（Phase 2）」.

## 3. Tests (`src/memory-tools.test.ts`, vitest — 28 new tests)

- Tool registration shape (names, schema, required args, output.render JSON envelope) and the
  `ctx.inject(['tools'])` registration flow with a fake registrar (per-tool `effect`); absent-service path.
- `escapeLike`, SQL building: OR'd LIKE terms with escaped/bound patterns, device filter only for
  `current` (binds config device), since bound, limit clamp, sqlserver TOP vs LIMIT, argTypes alignment.
- memory_read: ordering/window args, around-window reversal, role mapping, ≤500 truncation,
  empty-session short-circuit.
- Disabled/corrupt config → friendly error (`/会话存储/`, `/损坏/`) surfaced through `tool.execute`.
- Execution through a fake adapter connection: query envelope captured (patterns escaped, argTypes
  aligned), `dispose` seam exercised.
- No real-DB integration test added (would need a live MySQL; the raw-adapter binding shapes above were
  verified by reading the installed 7.9.1 adapter sources instead).

## 4. Evidence

- `npm test`: **13 files / 245 tests passed** (incl. 28 new).
- `npm run build`: green (`prisma generate` ×4 + `tsc -p tsconfig.build.json` + esbuild client 15.0kb).
- `npm run typecheck`: fails on **pre-existing** client errors (`src/client/panel.tsx`, `select.tsx` —
  TS2347), reproduced identically on `main` via `git stash`; not introduced by this change.
- Commit on `feat/rebuild` (branch created from `main`; the task prompt's branch did not exist yet).

## 5. Concerns / notes

- `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-tools` symlink is broken; if the host ever resolves
  plugin `ctx.inject(['tools'])` differently than the packaged runtime, registration would log-and-skip
  (graceful degradation built in).
- Fulltext index not used (spec: optional future); LIKE over `content` is fine at personal scale.
- Archived history rows (`history_id` non-null) are intentionally included in search (memory recall),
  while readToolCallMessages-style active-only filtering was not applied.
- `memory_read` with `around` returns the ≤limit window ending at the instant (not ±half-window);
  simple and provider-portable, documented in the tool description.
