# Changelog

## 0.2.0 (2026-11-06)

Fork of [`@amaster.ai/dsh-storage`](https://github.com/TGYD-helige/dsh-plugins) 0.1.40 (MIT), published as `@wfm-cn/dsh-storage`. Table schema and deterministic primary-key hashing are unchanged from upstream 0.1.40 — an existing upstream-written database is taken over with zero migration and zero duplication.

### Fixed (vs upstream 0.1.40)

- **MySQL adapter connection failure (critical)**: upstream constructed the mariadb driver adapter from a URL string, which always ended in a pool timeout. The adapter now receives discrete params (host/port/user/password/database) parsed from the config. (`src/backends/database.ts`)
- **Timezone**: timestamps were written as bare UTC values. New `timezone` config (default `'+08:00'`) is passed to the driver at connect time; rows land in the configured zone.

### Added (vs upstream 0.1.40)

- **Settings panel**: configure the mirror in the DSH settings UI (provider/host/port/user/password/database/timezone). Persists to `~/.dsh/dsh-storage.json`; the backend watches the file and rebuilds connections without a restart. (`src/client/`)
- **Test connection**: three-state check (ok + tables ready / ok + tables missing / failed with a human-readable reason) over a real RPC probe. (`src/health.ts`)
- **One-click table creation**: embedded DDL for MySQL and SQLite executed over the same driver-adapter path (no prisma CLI, no network); PostgreSQL/SQL Server fall back to the packaged-schema `prisma db push` route. (`src/ddl.ts`)
- **Health monitoring + notifications**: startup self-check and 30s periodic probe with exponential-backoff retries (1s→60s) that never drop the queue; toast notifications on down/up transitions. (`src/health.ts`, `src/notify.ts`, `src/status-route.ts`)
- **Gap backfill**: after an outage, the panel replays locally-logged session events through the same projector; deterministic ids make replay idempotent. (`src/backfill.ts`)

### Notes

- Registration renamed: `cordis.patch.yml` now registers `@wfm-cn/dsh-storage` (id stays `storage-mirror`).
- Known limitations documented in README: pg/mssql table creation needs the prisma CLI; out-of-order events below the database watermark are not backfilled; backfill/live interleave can skew `ai_chat_histories` message counts.
