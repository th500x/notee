# 13-3 卡池系统（前端展示与卡牌尺寸契约）

## 1. 功能范围

- **将领卡池**、**部队卡池**共用同一套全屏抽屉 UI：`game/src/components/game/CardPoolDrawer.jsx`。
- 预览列表从 `/config/characters`、`/config/troops` 拉取配置（经势力过滤后与抽卡候选一致），按稀有度分组展示。
- 缩略图规格：**逻辑尺寸 256×384 px**，外层容器 **128×192 px**，内层 **`transform: scale(0.5)`**、`transform-origin: top left`（与编组军营等处一致）。

## 2. 卡牌组件尺寸契约（与将领卡对齐）

共享组件位于 `shared/components/card/`：

| 组件 | 外框 | 超长内容 |
|------|------|----------|
| **CharacterCard** | `w-[256px] h-[384px]` 固定 | 正面 `overflow-hidden`，内容限制在牌面内 |
| **TroopCard** | `w-[256px] h-[384px]` 固定（与 CharacterCard 一致） | 标题区 + 立绘区固定高度；**技能 / 相性·地形 / 描述** 置于 **`flex-1 min-h-0 overflow-y-auto`** 区域，在牌内纵向滚动，**不得**再撑破 384 高度 |

历史问题：部队卡曾使用 `min-h-[384px]` 且无固定外框，长描述会导致缩略网格在竖屏错位、溢出。现已与将领卡统一为 **固定 384 高**。

## 3. 缩略 / 列表场景：关闭 hover 放大

`TroopCard` / `CharacterCard` 默认含 `hover:scale-105`，在 **0.5 倍缩略格** 或窄屏下易造成裁切溢出。

新增可选 prop：**`disableHoverScale`**（默认 `false`）。在以下场景传 **`disableHoverScale`**（或 JSX 简写 `disableHoverScale`）：

- `CardPoolDrawer`：列表缩略图、抽取结果弹窗内缩略图
- `GarrisonBackpack` / `GarrisonLineup` / `GarrisonGeneralNotRecruited`：背包与选卡抽屉中的缩略图
- `LineupTab`：编组左侧/中央缩放将领卡、换卡列表、详情浮层内缩放展示、`TroopCardCropped` 内嵌部队卡

全屏居中 **100% 预览**（未套 scale 的浮层）可不传，保持默认 hover（可选；当前已在部分缩放浮层中一并关闭以统一触控体验）。

## 4. 相关文件

| 路径 | 说明 |
|------|------|
| `game/src/components/game/CardPoolDrawer.jsx` | 卡池抽屉 |
| `game/src/hooks/useCardPool.js` | 次数、保底、银两校验 |
| `game/src/services/cardPoolApi.js` | 抽卡 API |
| `backend/services/cardPoolService.js` | 服务端抽卡与保底逻辑 |
| `shared/components/card/TroopCard.jsx` | 部队牌（固定高 + 牌内滚动） |
| `shared/components/card/CharacterCard.jsx` | 将领牌（`disableHoverScale`） |

## 5. 修订记录

- **2026-04**：部队卡固定 384×256 与将领卡一致；卡池/编组/驻守等缩略场景统一 `disableHoverScale`，修复手机竖屏部队卡池版式异常。
