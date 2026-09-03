# database/schema — 基线 DDL 占位目录

**状态**：占位（2026-05-29）· **尚无** in-repo 全量 `CREATE TABLE` 脚本  
**权威 DDL 语义**：`docs/00/00-base/01-database-split/` 各分册  
**增量变更**：`../migrations/*.sql` + `../../scripts/apply-pending-local-ddl.js`

---

## 为何为空

M2 实装期数据库已在 **生产 / 开发** 环境建表完毕；仓库内以 **增量迁移** 维护结构变更，**未**将全量基线 SQL 拆入本目录。

`01-database-split/83-migration.md` 曾写「按本目录顺序导入」，为 **01 分册拆分时的规划表述**，与当前运维路径不一致 — 已改为以本文为准。

---

## 当前新环境 / 本地重建路径

| 场景 | 做法 |
|------|------|
| **对齐已有库**（推荐） | 生产 `mysqldump --no-data` → 保存为 `33-san-storm/prod_schema.sql`（**不入 git**）→ `database/tools/rebuild-local-from-prod-schema.cmd` |
| **局部补缺** | `database/scripts/apply-local-schema-gaps.ps1`（部分 runtime 表）→ 再跑 `apply-pending-local-ddl.js` |
| **配置数据** | `database/import-*.js`（CSV/JSON 流水线，见 83-migration §4） |

`migrations/` 中约半数 SQL 为 **历史一次性** 脚本，**禁止**对全新空库盲跑整个目录；已有库以 `MIGRATION_FILES` 批跑为准。

---

## 未来定稿后（本目录职责）

数据库结构 **全部定稿** 后，在此按依赖顺序维护 **可重复执行的基线 DDL**（例如 `00-preamble.sql`、`10-account.sql` …），供绿库一次性导入；届时同步更新 `83-migration.md` §1 步骤 2。

在此之前：**不必**提前生成 50 表全量 SQL；以 mysqldump 基线 + 增量迁移即可。
