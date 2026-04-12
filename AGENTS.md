# 自动化助手 / 协作者约束（与 `.cursor/rules` 对齐）

本文件**在 Git 中跟踪**，供无法读取本地 `.cursor/` 的环境（CI、其他克隆、部分 Agent）同步关键约束。详细措辞以仓库内 **`.cursor/rules/*.mdc`** 为准。

## Git：永不进入版本库的路径

以下路径**不得** `git add` / `commit` / `push`，**无例外**：

- 任意 **`docs/`** 目录（含 `05-san-storm/docs/` 等）
- **`.cursor/`**、**`.kiro/`**

**禁止**使用 **`git add -f`**（或等价方式）绕过 `.gitignore` 将上述路径纳入提交。用户未用**单独一句原话**明确要求「把某 docs 文件提交入库」时，一律不对 docs 使用 `-f`。

**助手不得修改任意 `.gitignore` 文件**（任何情况下均由用户自行编辑；助手只可口头给出建议片段）。

提交前应对 `git status` 做核对；避免在仓库根不经筛选地 `git add -A` / `git add .` 后直接提交。

## 设计文档（05-san-storm）

**San Storm 设计文档的规范路径是 `05-san-storm/docs/`**（例如 `05-san-storm/docs/00-base/01-DATABASE_DESIGN.md`），**不是**仓库根目录的 `docs/`。`.gitignore` 常忽略 docs，**Glob / 搜索为空不得当作「没有文档」**；应直接 `Read` 上述前缀下的路径或用终端在 `05-san-storm\docs` 内查找。

对 `05-san-storm/docs/` 下既有 **`*.md`**：**必须先读取原文**再在原文上修订；**禁止**未读全文即用新内容**整文件覆盖**同一编号/主题文档。Glob 搜不到 docs **不代表**文件不存在；以用户给出的路径或 `Read` 结果为准。

**禁止**在用户未用原话明示「允许新建」时，在 `05-san-storm/docs/` 下**新建**任何 `.md`；缺失文件应提示用户，而非自动创建。

## San Storm 大地图 · 实现备忘（可追溯）

- **新野底栏（`WorldMap.jsx` 硬编码 `san_1_city_3_xinye` 等）**：当前为 **测试 / 开发锚点**（攻城、配额、探索、城况刷新等多处默认挂靠）。**非产品终态**。颍川郡战略格网等功能已复用同一套城防 UI（`WorldMapCityInfoBlock` / 驻地编组 / 披挂）时，应在代码侧把入口与数据依赖 **泛化为「当前选中城或郡内城点」**；**待无业务再依赖该常量后**，可删除新野专用底栏模块。细节与文档位置见 `05-san-storm/docs/10-core-system/13-1-CITY_SYSTEM.md` **§8.4.1**（若本地有该节）。
