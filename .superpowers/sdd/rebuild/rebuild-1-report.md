# Rebuild 1 Report — src/config.ts, health.ts, index.ts, backends/database.ts, configs

Branch: `feat/rebuild` (repo: dsh-storage). Ground truth: `lib/*.js` (untouched; verified byte-identical output).

## Modules reconstructed

| Module | Source of truth | Result |
|---|---|---|
| `src/config.ts` | Reconstructed from `lib/config.js` + `lib/types/config.d.ts` (SyncConfig, DEFAULT_CONFIG, dshHome, defaultConfigPath, isValidPort, syncConfigProblem, loadConfig w/ parse & missing-field flags, atomic 0o600 saveConfig, 300ms-debounce watchConfig, configToUrl with segment encoding) | **lib/config.js byte-identical** |
| `src/backends/database.ts` | Upstream + fork fix: added exported `parseMysqlUrl` (URL parse, port conditional, decodeURIComponent w/ raw-% passthrough), `DatabaseBackendConfig.timezone?: string`, mysql branch passes `{...parseMysqlUrl(url), timezone: config.timezone ?? '+08:00'}` to PrismaMariaDb. **Also found and restored a second fork addition missed by the brief:** `DatabaseBackend.latestPerSession()` (aiMessage groupBy watermark for backfill gap detection) — lib has it, upstream src didn't | **lib/backends/database.js byte-identical** |
| `src/health.ts` | From `lib/health.js`: ConfigError, HealthMonitor (backoff 1s·2^n cap 60s, same-state no refire, config-error suspends retries until recheck(), snapshot/onTransition disposer), probeDatabase/testConnection with humanizeError | **lib/health.js byte-identical** |
| `src/index.ts` | Rewrote from `lib/index.js` (637 lines): startMirror() factory + MirrorHandle (stop: taps off → pending allSettled → maps clear → backends close, idempotent), computeMirrorTarget (JSON file wins; broken/enabled:false → OFF; yaml fallback only when no JSON file), evaluateMirror/settleMirror serial rebuild state machine, watchConfig integration, `dshStorageStatus` provide (snapshot/testConnection/createTables/getConfig/saveConfig/toasts/backfill), null-safe `dshStorage` archiveSession delegate, event whitelist tap, monitor lifecycle effect | **lib/index.js byte-identical** |
| `src/types.ts` | Upstream + fork's `latestPerSession?()` added to StorageBackend (present in lib/types/types.d.ts) | lib/types/types.d.ts byte-identical |
| `src/projector.ts`, `src/compaction.ts` | Verified upstream-verbatim compile to byte-identical lib output — kept as-is | byte-identical |

## Configs / build

- Recreated `tsconfig.json` (ES2022/NodeNext/strict, includes tests for `typecheck`, excludes `src/generated`) and `tsconfig.build.json` (rootDir src → outDir lib, declarationDir lib/types, excludes tests, `src/client`, `src/generated` — **lib/generated is never clobbered**).
- Copied upstream `scripts/prisma-generate.mjs` (was missing locally); added `pnpm.onlyBuiltDependencies` (@prisma/engines, prisma, esbuild) so installs run them; added `.gitignore`; package.json scripts unchanged. `prisma generate` runs and writes to `src/generated` only.
- `npm test` needs `pnpm-lock.yaml` (committed).

## Build & test results

- `tsc -p tsconfig.build.json`: **passes**; all 7 in-scope emitted JS files byte-identical to `lib/` (config, health, index, backends/database, projector, compaction, types); `lib/types/{index,types,backends/database}.d.ts` byte-identical too.
- `npm run build`: **fails at the final `build:client` esbuild step only** — `src/client/` does not exist (explicitly a later task). Prisma-generate and tsc steps pass. Note: tsc re-emits `lib/types/{config,health}.d.ts` without their leading file-comments (cosmetic); I restored the two tracked lib files from git so lib stays pristine — any future full build will reclobber those two headers until the sources carry declaration-attached comments.
- `npm test`: **85/86 tests pass, 2 known/expected failures** (not weakened):
  1. `src/index.test.ts` — suite fails to load: `Cannot find module './backfill.js'` (also notify/ddl/status-route). Those src modules are later tasks; I added **declaration-only stubs** (`src/{backfill,ddl,notify,status-route}.d.ts`, exact copies of `lib/types/*.d.ts`) so tsc compiles, but vitest needs real runtime modules.
  2. `src/backends/database.test.ts > builds the mysql adapter from a mariadb:// url` — stale **upstream** test expecting the old URI-string construction; the fork intentionally switched to discrete params + timezone (this is the fork fix itself). Test should be updated by the fork's own tests in a later task.

## Cosmetic deviations (behavior-identical)

- `lib/types/config.d.ts` / `lib/types/health.d.ts`: tsc drops the leading file-comment when it precedes imports, so emitted d.ts lacks the 8/5-line header (lib JS output still has it; JS is byte-identical).
- Indentation of my sources follows upstream 2-space style; tsc output matched lib byte-for-byte regardless.

## Concerns

- index.test.ts will stay red until tasks for backfill/notify/ddl/status-route land (runtime modules).
- The stale upstream mysql-adapter test asserts the exact behavior the fork fixes; left failing on purpose.
- prisma clients regenerated locally with prisma 7.10.1 into `src/generated` (gitignored, excluded from build); shipped `lib/generated` untouched.

Commits: see branch `feat/rebuild` (reconstruction + configs in one commit).
