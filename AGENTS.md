# 自动化助手 / 协作者约束（与 `.cursor/rules` 对齐）

本文件**在 Git 中跟踪**，供无法读取本地 `.cursor/` 的环境（CI、其他克隆、部分 Agent）同步关键约束。详细措辞以仓库内 **`.cursor/rules/*.mdc`** 为准。

## 子代理模型

调用子代理时 **`model` 默认 `inherit`（与主代理同一模型）**；未获用户当轮明文指定前，**禁止**自行换用其他模型。完整条款见 **`.cursor/rules/subagent-model-inherit.mdc`**。

## P0：05-san-storm · Vite 前端禁止 import 共享 `.cjs`（防白屏）

**游戏端**（Vite + React）**不得** `import { … } from '@shared/.../foo.cjs'`，也**不得**在 `game/src/utils/*Display.js` 里 `export { … } from '…cjs'` 转 re-export——运行时报 `does not provide an export named …`，整页白屏（三公府银粮兑换等已多次复发）。

**正确做法**：后端用 `require('…/foo.cjs')`；前端用 `shared/utils/foo.js`（ESM 双文件），或在 `game/src/utils/` 写**纯 ESM 算法副本**（如 `sanGongResourceExchangeDisplay.js`）。交付前搜 `from '@shared/` 且含 `.cjs`，并刷新游戏页或 `vite build`。完整条款见 **`.cursor/rules/san-storm-shared-cjs-esm-boundary.mdc`**。

## P0：禁止语义替代式静默回退

**不得**在「专用逻辑失败」时**悄悄**改用**另一业务语义**的路径（例如 PVP 大本营解析失败却改用目标城心寻路）；须**早失败**并暴露根因。完整条款见 **`.cursor/rules/notee-code-quality-and-debugging.mdc`**（**P0（T0）** 节与 **§1**）。

## Git：永不进入版本库的路径

以下路径**不得** `git add` / `commit` / `push`，**无例外**：

- 任意 **`docs/`** 目录（含 `05-san-storm/docs/` 等）
- **`.cursor/`**、**`.kiro/`**
- **`02-2-tales/`**（辅助 `02-tale-historical` 的本地小说创作工作室；不上网站、不同步 GitHub）

**禁止**使用 **`git add -f`**（或等价方式）绕过 `.gitignore` 将上述路径纳入提交。用户未用**单独一句原话**明确要求「把某 docs 文件提交入库」时，一律不对 docs 使用 `-f`。

**`.gitignore` 默认不由助手改动，但用户在对话中明确许可后可改**（含提交其创建/删除/重命名）；未获许可时只给建议片段。注意：`docs/`、`.cursor/`、`.kiro/` 的永久排除入库仍为绝对无例外，不得借改 `.gitignore` 纳入这些目录。

提交前应对 `git status` 做核对；避免在仓库根不经筛选地 `git add -A` / `git add .` 后直接提交。

## 设计文档（05-san-storm）

**San Storm 设计文档的规范路径是 `05-san-storm/docs/`**（例如 `05-san-storm/docs/00-shared-core/00-base/01-DATABASE_DESIGN.md`），**不是**仓库根目录的 `docs/`。`.gitignore` 常忽略 docs，**Glob / 搜索为空不得当作「没有文档」**；应直接 `Read` 上述前缀下的路径或用终端在 `05-san-storm\docs` 内查找。

对 `05-san-storm/docs/` 下既有 **`*.md`**：**必须先读取原文**再在原文上修订；**禁止**未读全文即用新内容**整文件覆盖**同一编号/主题文档。Glob 搜不到 docs **不代表**文件不存在；以用户给出的路径或 `Read` 结果为准。

**改代码与文档对齐**：当改动落在已有文档描述过的 San Storm 模块时，**同一轮任务内**应同步修订对应 **`05-san-storm/docs/`** 既有 `.md`（版本/更新日志按该文习惯）；细则见仓库 **`.cursor/rules/san-storm-design-docs-path-and-authorization.mdc`**（仍禁止擅自新建、未读覆盖）。

**禁止**在用户未用原话明示「允许新建」时，在 `05-san-storm/docs/` 下**新建**任何 `.md`；缺失文件应提示用户，而非自动创建。

## San Storm 大地图 · 实现备忘（可追溯）

- **大地图城防入口**：攻城配额、势力战况、攻打与驻地编组等已挂在 **颍川战略格 tooltip**（`StrategicCityTooltipPanel` + `WorldMapCityInfoBlock`），按 **当前格点 `city_id`** 拉取，不再使用底栏或单城硬编码。实现备忘仍见 `05-san-storm/docs/10-core-system/13-1-CITY_SYSTEM.md` **§8.4.1**（若本地有该节）。
- **颍川合并图 `public/data/worldmap/san_1_jun_yingchuan_merged.json`**：底板与道路层（`roadCells` / `roadConnectivity`）在同一文件。日常用管理端 **郡战略图工坊**（`/jun-strategic-map-workshop`，`POST /api/admin/world-map/jun-workshop/save`）写入。旧四象限「三国地图」/`generate-merged-map` / `worldmap-merge-yingchuan.mjs` 已归档至 `05-san-storm/_archive/san-guo-di-tu/`，**勿再**用旧脚本覆盖 Meowa 成果。
- **双机 / 换电脑后配置库**：在 `05-san-storm/backend` 执行 `node database/import-all.js`（JSON→MySQL 全量 + 导入后抽检，含 **san_0 楚汉将领** 与招贤池）。勿只跑单模块 import 除非明确只需该模块。
