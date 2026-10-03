# 自动化助手 / 协作者约束（与 `.cursor/rules` 对齐）

本文件**在 Git 中跟踪**，供无法读取本地 `.cursor/` 的环境（CI、其他克隆、部分 Agent）同步关键约束。详细措辞以仓库内 **`.cursor/rules/*.mdc`** 为准。

## 子代理模型

调用子代理时 **`model` 默认 `inherit`（与主代理同一模型）**；未获用户当轮明文指定前，**禁止**自行换用其他模型。完整条款见 **`.cursor/rules/subagent-model-inherit.mdc`**。

## 已迁出本仓库（2026-09-29）

- **`33-san-storm`** 与 **`02-2-tales`** 在 notee 的上一级目录，不再是本仓库的子项目。不要在 notee 里查找、修改或把它们加回本仓库。
- **`02-tale-historical`** 已删除，主页不再挂入口。

## P0：禁止语义替代式静默回退

**不得**在「专用逻辑失败」时**悄悄**改用**另一业务语义**的路径（例如 PVP 大本营解析失败却改用目标城心寻路）；须**早失败**并暴露根因。完整条款见 **`.cursor/rules/notee-code-quality-and-debugging.mdc`**（**P0（T0）** 节与 **§1**）。

## Git：永不进入版本库的路径

以下路径**不得** `git add` / `commit` / `push`，**无例外**：

- 任意 **`docs/`** 目录
- **`.cursor/`**、**`.kiro/`**

**禁止**使用 **`git add -f`**（或等价方式）绕过 `.gitignore` 将上述路径纳入提交。用户未用**单独一句原话**明确要求「把某 docs 文件提交入库」时，一律不对 docs 使用 `-f`。

**`.gitignore` 默认不由助手改动，但用户在对话中明确许可后可改**（含提交其创建/删除/重命名）；未获许可时只给建议片段。注意：`docs/`、`.cursor/`、`.kiro/` 的永久排除入库仍为绝对无例外，不得借改 `.gitignore` 纳入这些目录。

提交前应对 `git status` 做核对；避免在仓库根不经筛选地 `git add -A` / `git add .` 后直接提交。

## Notee 网页后端（2026-09-29）

- 全站网页后端由仓库根 **`ecosystem.config.cjs`** 启动：`00-notee-backend`（端口 **3000**，代码在 `08-life-resume/backend`）与 **`00-eth-worker`**（入口 `workers/00-eth-worker.cjs`）。
- 库名是 **`00_notee`**，对象存储桶名是 **`00-notee`**（曼谷 `oss-ap-southeast-7`）。租赁库名是 **`06_rental`**，照片桶是 **`06-rental`**。今日一句库名是 **`10_notee_go`**。
- 管理员密钥是 `ADMIN_JWT_SECRET`，账号密钥是 `JWT_SECRET`，不能相同。
- 留言板与 `01` 新闻后端已撤。新闻页读静态 JSON。独立 PM2：`06` 用 `06-rental-tracking/ecosystem.config.cjs`（端口 3006）；**App 侧** `10` 用 `10-notee-go/ecosystem.config.cjs`（端口 3010）。
- 主页子项目为 `01`、`03-lost-pearls`、`06`、`07`、`08`；`10` 为 App 今日一句。`02-tale-historical` 已删除。`33-san-storm` 不再由本站托管。
