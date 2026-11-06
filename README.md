# @wfm-cn/dsh-storage

![dsh-storage preview](preview.png)

DSH（DeepSeek Harness）会话存储镜像插件：把 `session/event` 事件流实时投影到关系数据库（`ai_messages` / `ai_chat_histories` 两张表，支持 MySQL / PostgreSQL / SQLite / SQL Server），**不替换** DSH 本地持久化——本地文件仍是权威数据源，本插件只做镜像。

本包是 [`@amaster.ai/dsh-storage`](https://github.com/TGYD-helige/dsh-plugins) 0.1.40（MIT）的 fork，修复了上游的 MySQL 建连 bug 并新增设置面板、健康监控与断档补传。表结构与确定性主键算法与上游完全一致，可零迁移直接接管上游写入过的库。

## 主要功能

- **设置页面板**：DSH 设置页内配置数据库（类型/主机/端口/用户/密码/库名/时区），保存即生效（写入 `~/.dsh/dsh-storage.json`，后端热重建连接），无需编辑 yaml、无需重启。
- **测试连接**：面板一键测试，三态结果——🟢 连接成功且表就绪 / 🟡 连接成功但表不存在（引导一键建表）/ 🔴 连接失败（给出人话错误：地址不通、密码错、库不存在等）。
- **一键建表**：MySQL/SQLite 内嵌 DDL 直接执行；PostgreSQL/SQL Server 走打包 schema 的 `prisma db push` 路线（见"已知限制"）。
- **健康监控 + 通知**：启动自检 + 30s 周期探测；状态好→坏时右上角弹出 `⚠️ 会话同步中断：<原因>`（仅一次，不骚扰）；坏→好时弹 `✅ 同步已恢复` 并可一键补传。写入失败按 1s 起指数退避（至 60s）自动重试，队列数据不丢。
- **断档补传**：镜像中断期间本地 session 日志仍完整；面板"补传"按钮对比本地会话与库内数据的时间差，将缺失事件重放入库。补传与主键确定性哈希配合，重复执行不会产生重复行。

## 相对上游 0.1.40 的修复

1. **MySQL 建连 bug（关键修复）**：上游 mysql provider 用 URL 字符串直接构造 mariadb 适配器，必然连接池超时。本包将 URL 拆解为离散参数（host/port/user/password/database）传给 `PrismaMariaDb` 适配器。
2. **时区配置化**：新增 `timezone` 配置项（默认 `'+08:00'`），建连时传给驱动；时间戳按配置时区写入，读库无需心算偏移。

## 安全提示：密码为明文存储

数据库密码以**明文**保存在 `~/.dsh/dsh-storage.json` 中（与 DSH 自身配置文件同权限级别）。请：

- 强烈建议为镜像创建**专用最小权限账号**：仅需目标库的 `SELECT / INSERT / UPDATE / CREATE`（建表后可收回 `CREATE`）权限，不要使用 root 等高权限账号；
- 确保该文件的读取权限仅限当前用户（`chmod 600`）。

## 安装

```sh
dsh plugin --profile <profile> add @wfm-cn/dsh-storage
```

运行时 peer 依赖：`@prisma/client`（**Prisma 7**）及所用数据库的驱动适配器：

| Provider | Adapter peer |
| --- | --- |
| `mysql` | `@prisma/adapter-mariadb` |
| `postgresql` | `@prisma/adapter-pg` |
| `sqlite` | `@prisma/adapter-libsql` |
| `sqlserver` | `@prisma/adapter-mssql` |

PrismaClient 已按 provider 预生成并随包发布，使用方**无需 `prisma generate`**。建表可用面板"建表"按钮（MySQL/SQLite 内嵌 DDL），或手动：

```sh
npx prisma db push --schema node_modules/@wfm-cn/dsh-storage/prisma/schema.mysql.prisma --url "mysql://user:pass@host:3306/agent"
# schema.postgresql.prisma / schema.sqlite.prisma / schema.sqlserver.prisma 同理
```

## 配置

推荐方式：安装后在 DSH 设置页的「会话存储镜像」面板中配置并启用（持久化为 `~/.dsh/dsh-storage.json`）。

配置项一览（`dsh-storage.json`）：

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| `enabled` | 是否启用同步 | `false` |
| `provider` | `mysql` \| `postgresql` \| `sqlite` \| `sqlserver` | `mysql` |
| `host` / `port` | 主机与端口（sqlite 忽略） | `127.0.0.1` / 3306 |
| `user` / `password` | 账号（见上方安全提示）/ 明文密码 | 空 |
| `database` | 库名；sqlite 时为文件路径 | 空 |
| `timezone` | 写入时间戳所用时区，IANA 命名偏移（如 `'+08:00'`、`'-05:00'`） | `'+08:00'` |

插件注册段（`cordis.patch.yml`，通常由 plugin 安装器维护）：

```yaml
- insert:
    - id: storage-mirror
      name: '@wfm-cn/dsh-storage'
```

## 从 @amaster.ai/dsh-storage 切换

表结构、主键哈希算法与上游 0.1.40 完全一致——**同样的表、同样的确定性 id，零迁移、零重复**。步骤：

1. 备份 `~/.dsh/profiles/<profile>/cordis.patch.yml`；
2. 停用并卸载 `@amaster.ai/dsh-storage`（DSH 插件管理操作）；
3. 若 `cordis.patch.yml` 中仍有手写的 storage-mirror 配置块，删除之；
4. 安装本包：`dsh plugin --profile <profile> add @wfm-cn/dsh-storage`（本地路径亦可：`dsh plugin add /path/to/dsh-storage`）；
5. 重启 DSH；
6. 设置页面板：填入原有数据库参数（与旧插件写入的是同一个库，直接沿用），测试连接 → 建表检查（表已存在应显示绿）→ 启用；
7. 验证：行数与切换前一致、`SELECT COUNT(*) = COUNT(DISTINCT id) FROM ai_messages`（无重复）、新消息持续入库、新行 `created_at` ≈ 本地北京时间。

详细操作手册见 [`scripts/switch-from-amaster.md`](scripts/switch-from-amaster.md)。

## 数据模型

- **`ai_messages`** — 用户/模型消息行，含 `thoughts`、`tokens`、`tool_calls`、`agent_id`、`metadata` JSON 列与软删除。`tool/result` 按调用 ID 更新对应模型行的 `tool_calls` 条目，不产生 `type=tool` 行。消息行主键为 `(session_id, message id)` 的确定性哈希，重复投影按 upsert 原位更新，不产生重复行。与上游一致，无 `user_id` 列（租户信息在 `session_id` 中）。
- **`ai_chat_histories`** — 会话级汇总（消息数、token 总量、首/末消息时间）。归档操作（`ctx.get('dshStorage').archiveSession(sessionId)`）可将当前消息事务性地挂到历史行下，归档后的汇总仍可查询。

镜像为无抛出缝隙：数据库错误带 `[dsh-storage]` 前缀记日志，绝不逃逸进 agent 循环；本地 DSH 持久化始终是权威数据源。成功的原生压缩事件同时写入 `utility_compressor` 快照消息（source 兼容的 `Content[]`）。完整投影语义（工具结果合并、thoughts 签名、压缩快照续读等）与上游 0.1.40 一致，详见上游文档。

## AI 记忆查询工具（Phase 2）

插件在宿主 `tools` 服务上注册两个只读的模型工具（host-side，无需客户端配合），让 AI 能检索/回忆镜像到数据库的历史对话（跨设备记忆）：

- **`memory_search`** — `{ query, device?: 'all'|'current', limit?, since? }`：关键词（SQL LIKE OR 语义，通配符已转义）搜索 `ai_messages` 用户+模型行，返回 `{session_id, device, type, created_at, snippet(≤160)}`，按时间倒序。
- **`memory_read`** — `{ session_id, around?, limit? }`：按 `created_at` 返回该会话的对话上下文（`around` 时为该时刻及之前的窗口，恢复正序），每条内容截断 ≤500 字符。

两个工具复用同步配置（`$DSH_HOME/dsh-storage.json`）：同步未配置/未启用时返回友好错误提示（引导到「会话存储」面板）。每次调用创建一次性只读连接（仅 SELECT），用完即释放；所有用户输入参数化绑定（显式 argTypes，兼容 adapter 7.9.1/7.10+），LIKE 通配符用 `ESCAPE '~'` 转义。

## 已知限制

- **PostgreSQL / SQL Server 建表需要 prisma CLI**：面板"建表"按钮的嵌入式 DDL 仅覆盖 MySQL 与 SQLite；pg/mssql 走 `prisma db push` 路线，失败时会明确提示需要 prisma CLI（或用上文的 `npx prisma db push` 手动建表）。
- **乱序事件的水位盲区**：补传的缺口检测以库内最新消息行为水位。若某事件因乱序晚到且早于水位，该事件不会被补传捕捉（确定性主键保证它不重复，但可能缺失）。实践中事件按序到达，影响范围有限。
- **补传与实时镜像交错时的汇总回归**：`ai_chat_histories` 的消息计数在补传重放与实时写入交错时可能偏移（行级 upsert 幂等，`ai_messages` 本身不受影响）。极端情况下计数偏差可用补传完成后的会话最后一条事件自愈。
- 升级上游版本前请先比对 prisma schema：本包表结构对应上游 0.1.40。

## Compatibility

事件载荷依赖 pre-release 的 dsh API；升级 dsh 前请检查 `src/` 中的 `TODO(verify)` 标记。固定版本组合见根仓库 compat matrix（上游）。

## License

MIT。fork 自 [@amaster.ai/dsh-storage](https://github.com/TGYD-helige/dsh-plugins) 0.1.40（MIT），上游版权声明保留于 [LICENSE](LICENSE)。

---

# English

A session storage mirror plugin for DSH (DeepSeek Harness): projects the `session/event` stream into MySQL/PostgreSQL/SQLite/SQL Server (`ai_messages` / `ai_chat_histories`) without replacing dsh's local persistence — local files stay authoritative; this is a mirror.

This package is a fork of [`@amaster.ai/dsh-storage`](https://github.com/TGYD-helige/dsh-plugins) 0.1.40 (MIT). Fixes vs upstream:

1. **MySQL adapter bug (critical)**: upstream built the mariadb adapter from a URL string, which always pool-times out. This fork passes discrete params (host/port/user/password/database) to `PrismaMariaDb`.
2. **Configurable timezone**: new `timezone` config (default `'+08:00'`) passed to the driver at connect time.

Additions: settings panel (configure in the DSH UI, hot-reload without restart), three-state test connection, one-click table creation (embedded DDL for MySQL/SQLite), health monitoring with toast notifications (down/up transitions, exponential-backoff retries that never drop the queue), and gap backfill that replays locally-logged events idempotently after an outage.

**Security note**: the database password is stored in plaintext in `~/.dsh/dsh-storage.json`. Use a dedicated least-privilege account (SELECT/INSERT/UPDATE/CREATE on the target database only) and `chmod 600` the file.

**Switching from @amaster.ai/dsh-storage**: same tables, same deterministic ids, zero migration — uninstall the old plugin, install this one, restart DSH, configure the same database in the panel, verify `SELECT COUNT(*) = COUNT(DISTINCT id) FROM ai_messages`. Full runbook: [`scripts/switch-from-amaster.md`](scripts/switch-from-amaster.md).

**Known limitations**: pg/mssql table creation requires the prisma CLI (embedded DDL covers MySQL/SQLite only); out-of-order events older than the database watermark are not backfilled; backfill/live interleave can skew `ai_chat_histories` message counts (message rows themselves stay idempotent). Schema corresponds to upstream 0.1.40 — diff schemas before adopting later upstream versions.

MIT license; upstream copyright attribution retained in [LICENSE](LICENSE).
