# `created_at` / `updated_at` 使用审计与精简清单

生成方式：扫描 `backend/database/migrations/*.sql` 中含 `created_at` 或 `updated_at` 的表定义，并与 `05-san-storm/backend/**/*.js` 中的列名引用交叉比对（未扫前端 `game/`：当前无直接引用）。  
若线上库表来自历史脚本或 `01-database-split/` 与迁移不一致，删列前请以 **实际 `SHOW CREATE TABLE`** 为准。

---

## 1. 总览

| 分级 | 含义 |
|------|------|
| **保留** | 查询/排序/索引/业务逻辑/脚本显式依赖，删列会破坏功能或性能。 |
| **谨慎** | 业务未用列做逻辑，但 API 通过 `SELECT *` 或 `...row` 把列透出；删列需改 DTO。 |
| **可评估删除** | 迁移中有列，JS 无列名引用；查询多为固定列清单或格式化函数已剔除时间列。 |
| **仅历史** | `cities` 的 `created_at`/`updated_at` 已由 `drop-cities-created-updated-at.sql` 删除；勿再依赖。 |

---

## 2. 必须保留（勿删列）

执行精简时 **跳过** 下列表（或仅改文档描述，不动列）。

| 表名 | 原因 | 代码入口（代表） |
|------|------|------------------|
| `players` | `updated_at = NOW()`；查询带 `created_at` | `models/Player.js` |
| `texts` | 列表 `ORDER BY created_at`；复合索引含 `created_at` | `services/textsService.js` |
| `chats` | 限流/按日计数/排序依赖 `created_at`；索引 | `services/chatService.js` |
| `wars` | `ORDER BY created_at DESC` 取最新活跃战事 | `routes/cities.js` |
| `faction_bulletins` | 公告流水 `ORDER BY id DESC`；`created_at` 供展示/排查 | `services/factionBulletinService.js` |
| `memorial_images` | 查询与更新使用 `created_at` | `routes/memorial.js` |
| `temp_character_creation` | 多处 `updated_at = CURRENT_TIMESTAMP`；调试脚本读两列 | `services/playerCreationService.js`, `check-progress.js` |
| `temp_character_ranking` | **`created_at`**（首次插入）+ **`updated_at`**（刷新与 **14 天 TTL 清理**）；`KEY idx_updated_at` | `services/characterRankService.js`；老库补列见 `migrations/add-temp-character-ranking-snapshots-created-at.sql`（表名仍为旧名时先执行，再 `rename-temp-character-ranking-snapshots-to-temp-character-ranking.sql`） |
| `temp_event_ranking` | **`created_at`** + **`updated_at`**（`ON UPDATE`，冻结 `UPDATE` 会刷新）；活动快照 TTL 仍看 **`expires_at`** | `services/rankingService.js`；老库补 `updated_at` 见 `migrations/add-temp-ranking-snapshots-updated-at.sql` |
| `player_statistics` | API 返回 `createdAt`/`updatedAt` | `services/playerStatisticsService.js` |
| `servers` | 运维脚本展示 `created_at` | `database/scripts/query-servers.js` |

---

## 3. 谨慎处理（删列前先改 API / 查询）

| 表名 | 说明 | 建议动作 |
|------|------|----------|
| `config_texts` | `configTextService.rowToApi` 使用 `{ ...row }`，会把 `created_at`/`updated_at` 原样带给管理端 | 若删列：在 `rowToApi` 中显式返回字段白名单，或 `delete` 两键后再删库列。 |
| `player_garrison` | `garrisonService` 多处 `SELECT *`，时间列会进内存（**未见**下游使用） | 若删列：可改为显式列清单；或确认前端/日志未依赖后再删。 |
| `config_characters` / `config_equipment` | `configService` 使用 `SELECT *`，但 `formatCharacterData` / `formatEquipmentData` **未**输出时间列 | 删列对当前 JSON API 影响小；仍建议删前全局搜 `character_id` 行对象是否被直接序列化。 |

---

## 4. 可评估删除（迁移中有列，当前后端无列名业务依赖）

删列时的 **通用步骤**（每条执行一遍）：

1. [ ] `SHOW CREATE TABLE \`表名\`` 确认列存在且无外键/触发器依赖。  
2. [ ] 新增迁移：`ALTER TABLE ... DROP COLUMN created_at`, `DROP COLUMN updated_at`（若仅有 `created_at` 则只删一列）。  
3. [ ] 同步更新 `05-san-storm/docs/00-base/01-database-split/` 对应分册表结构。  
4. [ ] 若有 `SELECT *` 或 admin 全量返回，按第 3 节处理后再上线迁移。  
5. [ ] 在测试库跑导入脚本 / 核心接口冒烟。

| 表名 | 迁移参考 | 备注 |
|------|-----------|------|
| `config_campaigns` | `create-config-campaigns.sql` | `campaignService` 仅 SELECT 固定列，无时间列。 |
| ~~`config_events`~~ | **已移除** `created_at`/`updated_at` | 见 `migrations/drop-config-events-created-updated-at.sql`；`import-events-data.js` 从不写这两列。 |
| `config_achievements` | `fix-titles-achievements.sql` | 成就配置读取走属性/奖励字段，未见对时间列引用。 |
| `ai_players` | `create-runtime-tables-from-design-doc-01-1.sql` | 当前 **无** `backend/**/*.js` 引用该表名。 |
| `factions`（运行时势力表，非 `config_factions`） | 同上 | 当前 **无** JS 引用；与创角用的 `config_factions` 区分。 |
| `legions` | 同上 | 仅见 `chatService` 按 `legion_id` 取 `legion_name`，无时间列。 |
| `raids` | 同上 | 当前 **无** JS 引用。 |
| `player_garrison_slots` | `create-player-garrison-slots.sql` | 当前 **无** `player_garrison_slots` 的 JS 引用（可能预留或未接线）。 |

---

## 5. 仅 `created_at`（无 `updated_at` 或逻辑未用）

（当前无常驻条目；`temp_event_ranking` 已含 `updated_at`，见第 2 节。）

---

## 6. 设计文档与迁移中常见、但本清单未单独列出的 `config_*`

若实际库中 **`config_characters`、`config_troops`、`config_skills`、`config_bonds`、`config_items`、`config_equipment`、`config_factions`、`config_positions`、`config_titles`** 等仍含 `created_at`/`updated_at`（多见于历史全量建表或设计文档），且：

- 导入脚本 **INSERT 未写** 这两列（依赖默认），且  
- 业务查询为 **固定列** 或 **format 函数不暴露** 时间列，

则与 **第 4 节「可评估删除」** 同属一类：删列前同样执行第 4 节通用步骤，并特别注意 **`SELECT *`**（如 `cityService` 对 `config_troops` / `config_characters`）——删列无功能影响，但不要在别处假设列存在。

---

## 7. 复扫命令（日后更新本清单）

在仓库根目录：

```bash
rg "created_at|updated_at" 05-san-storm/backend/database/migrations --glob "*.sql"
rg "created_at|updated_at" 05-san-storm/backend --glob "*.js"
```

---

*本文件为审计快照；表结构以数据库与迁移为准。*
