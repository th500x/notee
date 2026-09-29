# content/ · 正式攻略正文

本目录是网站将来要渲染的**正文数据源**（Markdown + 各章 `images/`）。

- 项目计划、调查笔记 → 仍在 `docs/`
- 攻略正文、配图 → 写在这里

## 约定

| 项 | 说明 |
|---|---|
| 游戏目录 | `games/01-acs/`、`games/02-…/`（编号与 `docs/01-…` 对齐） |
| 基础章 | `basics/*.md` + 同级 `basics/images/` |
| 进阶章 | `advanced/*.md`（站内中文称「进阶」）+ `advanced/images/` |
| 终局章 | `endgame/*.md`（站内中文称「终局」）+ `endgame/images/` |
| 配图引用 | 相对路径，如 `![说明](./images/gameplay-01-ui.webp)` |
| 文件名 | 说人话：`schools-符修.webp`，避免 `IMG_8832.jpg` |

文首可用 YAML 小档案（`title` / `updated` / `platform` / `sources`），便于以后做列表页。
