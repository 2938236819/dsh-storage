# Changelog

## 0.3.3 (2026-11-10)

### Fixed (Critical)
- 状态路由改用 ctx.inject 等待 webServer/connection 组合完成后再注册：修复插件 apply 先于宿主服务组合时路由被永久跳过的问题（面板 HTTP 405 + 镜像静默不工作的根因）。
## 0.3.2 (2026-11-09)

### Fixed (Critical)
- 修复注册顺序缺陷：profiles 缺少 tools 服务时，memory tools 注入会中断插件 apply，导致设置面板 RPC 405、镜像静默停止。现在路由/镜像注册先行且受 try/catch 隔离，tools 缺失只影响记忆查询工具本身。
## 0.3.1 (2026-11-06)

### Changed
- memory_search / memory_read 工具描述加入硬约束：仅当用户明确要求查询历史/跨设备记忆时才调用，防止 AI 自动触发读取导致会话混淆。
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
