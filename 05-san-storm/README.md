# 真三风云 (San Storm)

一款基于三国题材的策略战棋游戏

**最后更新**: 2026-02-21  
**文档版本**: v2.0.0

---

## 📚 快速导航

### 核心路线图
- **[docs/00-base/01-SEASON_SYSTEM.md](./docs/00-base/01-SEASON_SYSTEM.md)** - 赛季系统设计（S1-S9完整规划）
- **[docs/00-base/00-MILESTONES_S1.md](./docs/00-base/00-MILESTONES_S1.md)** - S1开发里程碑和进度

### 开发指南
- **[docs/00-base/03-CODE_GUIDE.md](./docs/00-base/03-CODE_GUIDE.md)** - 代码规范
- **[docs/00-base/04-ID_NAMING_GUIDE.md](./docs/00-base/04-ID_NAMING_GUIDE.md)** - ID命名规范（含术语规范）
- **[docs/00-base/02-SERVER_GUIDE.md](./docs/00-base/02-SERVER_GUIDE.md)** - 服务器开发指南

### 系统文档

#### 核心系统层（10-core-system）- 游戏逻辑
- **[docs/10-core-system/11-FACTION_SYSTEM_S1.md](./docs/10-core-system/11-FACTION_SYSTEM_S1.md)** - 势力系统（S1）
- **[docs/10-core-system/12-AI_FACTION_SYSTEM.md](./docs/10-core-system/12-AI_FACTION_SYSTEM.md)** - AI势力系统
- **[docs/10-core-system/13-AI_PLAYER_SYSTEM.md](./docs/10-core-system/13-AI_PLAYER_SYSTEM.md)** - AI玩家系统
- **[docs/10-core-system/14-PLAYER_SYSTEM.md](./docs/10-core-system/14-PLAYER_SYSTEM.md)** - 玩家系统
- **[docs/10-core-system/15-CITY_SYSTEM.md](./docs/10-core-system/15-CITY_SYSTEM.md)** - 城市系统
- **[docs/10-core-system/16-EVENT_SYSTEM.md](./docs/10-core-system/16-EVENT_SYSTEM.md)** - 事件系统
- **[docs/10-core-system/17-QUEST_SYSTEM.md](./docs/10-core-system/17-QUEST_SYSTEM.md)** - 任务系统
- **[docs/10-core-system/18-COMBAT_SYSTEM.md](./docs/10-core-system/18-COMBAT_SYSTEM.md)** - 战斗系统

#### 数据层（20-data-layer）- 静态数据
- **[docs/20-data-layer/21-CHARACTER_SYSTEM.md](./docs/20-data-layer/21-CHARACTER_SYSTEM.md)** - 将领系统
- **[docs/20-data-layer/22-TROOP_SYSTEM.md](./docs/20-data-layer/22-TROOP_SYSTEM.md)** - 部队系统（含克制、适应性、特殊单位）
- **[docs/20-data-layer/23-ITEM_SYSTEM.md](./docs/20-data-layer/23-ITEM_SYSTEM.md)** - 物品系统
- **[docs/20-data-layer/24-CARD_SYSTEM.md](./docs/20-data-layer/24-CARD_SYSTEM.md)** - 卡牌系统

#### 前端层（30-frontend）- UI展示
- **[docs/30-frontend/31-CHAT_SYSTEM.md](./docs/30-frontend/31-CHAT_SYSTEM.md)** - 聊天系统
- **[docs/30-frontend/32-USER_MANAGEMENT_SYSTEM.md](./docs/30-frontend/32-USER_MANAGEMENT_SYSTEM.md)** - 用户管理系统
- **[docs/30-frontend/33-TROOP_FORMATION_SYSTEM.md](./docs/30-frontend/33-TROOP_FORMATION_SYSTEM.md)** - 部队编组系统
- **[docs/30-frontend/34-BATCH_ID_SYSTEM.md](./docs/30-frontend/34-BATCH_ID_SYSTEM.md)** - 批量ID系统

#### 美术资源层（90-assets）- 美术资源
- **[docs/90-assets/91-MAP_SYSTEM.md](./docs/90-assets/91-MAP_SYSTEM.md)** - 地图系统（含美术、配色、瓦片、数据结构）
- **[docs/90-assets/92-COMBAT_EFFECTS.md](./docs/90-assets/92-COMBAT_EFFECTS.md)** - 战斗特效
- **[docs/90-assets/98-TROOP_ICON_PROMPTS_GUFENGXL.md](./docs/90-assets/98-TROOP_ICON_PROMPTS_GUFENGXL.md)** - 部队图标提示词（古风XL）
- **[docs/90-assets/99-PROMPT_QUICK_COPY.md](./docs/90-assets/99-PROMPT_QUICK_COPY.md)** - 提示词快速复制
- **[docs/90-assets/99-TASTYRICE_PROMPT_GUIDE.md](./docs/90-assets/99-TASTYRICE_PROMPT_GUIDE.md)** - TastyRice提示词指南
- **[docs/90-assets/99-TROOP_ICON_DESIGN.md](./docs/90-assets/99-TROOP_ICON_DESIGN.md)** - 部队图标设计

#### 开发工具（tools）- 数据处理工具
- **[docs/tools/](./docs/tools/)** - CSV转JSON工具、数据验证工具、美术工具

---

## 📋 文档组织结构

### 按架构分层

```
文档目录（docs/）
├── 00-base/             # 基础开发指南（路线规划、开发规范）
├── 10-core-system/      # 核心系统层（游戏逻辑）
├── 20-data-layer/       # 数据层（静态数据）
├── 30-frontend/         # 前端层（UI展示）
├── 90-assets/           # 美术资源层（美术资源）
└── tools/               # 开发工具（数据处理、美术工具）
```

### 编号规则

- **00-09**: 基础开发指南 - 路线规划和开发规范
- **10-19**: 核心系统层 - 服务器端运行的游戏逻辑
- **20-29**: 数据层 - 静态数据和数据结构定义
- **30-39**: 前端层 - 用户界面和交互
- **90-99**: 美术资源层 - 美术资源制作和管理
- **tools**: 开发工具 - CSV转JSON、数据验证、美术工具

---

## 🎯 当前状态

### 里程碑1：基础框架与卡牌化（70%完成）
- ✅ 基础框架搭建
- ✅ 数据系统完成
- ✅ 部分卡牌化（2/7）
- 🔄 完善部队卡牌
- 🔄 其他元素卡牌化

### 里程碑2：部队编组系统（新增）
- ✅ M2验证模块创建
- ✅ 武将+部队卡组合机制
- ✅ 实时战力计算系统
- ✅ 一键自动编组功能
- ✅ 临时占位符图标系统

详见 [docs/00-base/00-MILESTONES_S1.md](./docs/00-base/00-MILESTONES_S1.md)

---

## 🎮 游戏特色

### 赛季制运营
每个赛季对应不同历史时期（3-6个月），不同的地图、城市、武将池、兵种

### 当前赛季：S1 - 黄巾之乱
- **历史时期**: 公元184年
- **特色**: 黄巾起义、朝廷征召、诸侯初现
- **地图**: 东汉十三州，89座城市
- **武将**: 150名
- **兵种**: 4类基础兵种，3个阶级

详见 [docs/00-base/01-SEASON_SYSTEM.md](./docs/00-base/01-SEASON_SYSTEM.md)

---

## 🔄 系统间关系

### 数据流向

```
前端层（UI展示）
    ↕ API调用
核心系统层（游戏逻辑）
    ↕ 数据读取
数据层（静态数据）
```

### 依赖关系

```
前端层
├── 依赖 → 核心系统层（API）
└── 依赖 → 数据层（展示数据）

核心系统层
└── 依赖 → 数据层（读取数据）

数据层
└── 无依赖（独立存在）
```

---

## 📊 数据持久化说明

### 🔄 赛季重置（每赛季清空）
- **将领系统**: 将领卡赛季结束清空，图鉴记录保留
- **部队系统**: 白色/蓝色清空，紫色/橙色保留
- **物品系统**: 所有装备和道具清空

### ✅ 永久保留（跨赛季）
- **账号系统**: 成就、称号、高级部队卡、将领图鉴

---

## 🛠️ 技术栈

### 前端
React 18 + Vite + TailwindCSS + Canvas/Pixi.js

### 后端（后期）
Node.js + Express + Socket.io + PostgreSQL + Redis

### 部署
Vercel（前端） + 自有服务器（后端）

详见 [docs/00-base/03-CODE_GUIDE.md](./docs/00-base/03-CODE_GUIDE.md)

---

## 📂 项目结构

```
05-san-storm/
├── public/                          # 静态资源
│   ├── data/                        # 数据文件
│   │   ├── shared/                  # 共享数据（跨赛季）
│   │   │   ├── characters.json      # 所有武将数据
│   │   │   ├── positions.json       # 官职系统数据
│   │   │   ├── troops.json          # 部队卡数据
│   │   │   ├── skills.json          # 技能数据
│   │   │   └── bonds.json           # 羁绊数据
│   │   └── seasons/                 # 赛季专属数据
│   │       ├── s1/                  # S1赛季数据
│   │       │   ├── factions.json    # 势力配置
│   │       │   └── servers.json     # 服务器列表
│   │       └── s2/                  # S2赛季数据（未来）
│   └── assets/                      # 静态资源
│       ├── troops/                  # 部队图片
│       └── icons/                   # 图标资源
│
├── src/
│   ├── main.jsx                     # 应用入口
│   ├── App.jsx                      # 根组件
│   │
│   ├── components/                  # UI组件
│   │   ├── character/               # 将领相关组件
│   │   ├── faction/                 # 势力相关组件
│   │   ├── formation/               # 部队编组相关组件（M2验证模块）
│   │   ├── position/                # 官职相关组件
│   │   ├── server/                  # 服务器相关组件
│   │   ├── troop/                   # 部队相关组件
│   │   ├── auth/                    # 认证相关组件
│   │   └── common/                  # 通用组件
│   │
│   ├── hooks/                       # 自定义Hooks
│   │   ├── useCharacters.js         # 武将数据Hook
│   │   ├── useFactions.js           # 势力数据Hook
│   │   ├── usePositions.js          # 官职数据Hook
│   │   ├── useServers.js            # 服务器数据Hook
│   │   ├── useTroops.js             # 部队数据Hook
│   │   ├── useSkills.js             # 技能数据Hook
│   │   └── useBonds.js              # 羁绊数据Hook
│   │
│   ├── seasons/                     # 赛季配置
│   │   ├── s1/                      # S1赛季
│   │   │   ├── config.js            # 赛季配置
│   │   │   ├── factions.js          # 势力数据
│   │   │   └── map/                 # 地图数据
│   │   └── seasonManager.js         # 赛季管理器
│   │
│   ├── data/                        # 前端数据
│   │   ├── events/                  # 事件数据
│   │   │   ├── historical/          # 历史事件
│   │   │   ├── fictional/           # 虚构事件
│   │   │   └── daily/               # 日常事件
│   │   ├── skills/                  # 技能数据库
│   │   └── eventConfig.js           # 事件配置
│   │
│   ├── systems/                     # 游戏系统
│   │   └── eventSystem.js           # 事件系统
│   │
│   ├── utils/                       # 工具函数
│   │   ├── dataLoader.js            # 数据加载器
│   │   ├── factorCalculator.js      # 因子计算器
│   │   ├── probabilityEngine.js     # 概率引擎
│   │   └── constants.js             # 常量定义
│   │
│   └── styles/                      # 样式文件
│       └── index.css                # 全局样式
│
├── docs/                            # 文档
│   ├── 00-base/                     # 基础开发指南
│   │   ├── 00-MILESTONES_S1.md      # S1里程碑
│   │   ├── 01-SEASON_SYSTEM.md      # 赛季系统
│   │   ├── 02-SERVER_GUIDE.md       # 服务器指南
│   │   ├── 03-CODE_GUIDE.md         # 代码规范
│   │   └── 04-ID_NAMING_GUIDE.md    # ID命名规范（含术语规范）
│   │
│   ├── 10-core-system/              # 核心系统层
│   │   ├── 11-FACTION_SYSTEM_S1.md  # 势力系统
│   │   ├── 12-AI_FACTION_SYSTEM.md  # AI势力系统
│   │   ├── 13-AI_PLAYER_SYSTEM.md   # AI玩家系统
│   │   ├── 14-PLAYER_SYSTEM.md      # 玩家系统
│   │   ├── 15-CITY_SYSTEM.md        # 城市系统
│   │   ├── 16-EVENT_SYSTEM.md       # 事件系统
│   │   ├── 17-QUEST_SYSTEM.md       # 任务系统
│   │   └── 18-COMBAT_SYSTEM.md      # 战斗系统
│   │
│   ├── 20-data-layer/               # 数据层
│   │   ├── 21-CHARACTER_SYSTEM.md   # 将领系统
│   │   ├── 22-TROOP_SYSTEM.md       # 部队系统（含克制、适应性、特殊单位）
│   │   ├── 23-ITEM_SYSTEM.md        # 物品系统
│   │   └── 24-CARD_SYSTEM.md        # 卡牌系统
│   │
│   ├── 30-frontend/                 # 前端层
│   │   ├── 31-CHAT_SYSTEM.md        # 聊天系统
│   │   ├── 32-USER_MANAGEMENT_SYSTEM.md  # 用户管理系统
│   │   ├── 33-TROOP_FORMATION_SYSTEM.md  # 部队编组系统
│   │   └── 34-BATCH_ID_SYSTEM.md    # 批量ID系统
│   │
│   ├── 90-assets/                   # 美术资源层
│   │   ├── 91-MAP_SYSTEM.md         # 地图系统（含美术、配色、瓦片、数据结构）
│   │   ├── 92-COMBAT_EFFECTS.md     # 战斗特效
│   │   ├── 98-TROOP_ICON_PROMPTS_GUFENGXL.md  # 部队图标提示词
│   │   ├── 99-PROMPT_QUICK_COPY.md  # 提示词快速复制
│   │   ├── 99-TASTYRICE_PROMPT_GUIDE.md  # TastyRice提示词指南
│   │   └── 99-TROOP_ICON_DESIGN.md  # 部队图标设计
│   │
│   └── tools/                       # 开发工具
│       ├── character-csv-to-json.cjs  # 武将CSV转JSON
│       ├── troop-csv-to-json.cjs      # 部队CSV转JSON
│       ├── faction-csv-to-json.cjs    # 势力CSV转JSON
│       ├── skill-csv-to-json.cjs      # 技能CSV转JSON
│       ├── bond-csv-to-json.cjs       # 羁绊CSV转JSON
│       ├── *-template.csv             # 各类CSV模板
│       ├── generate-floor-tiles.html  # 地板瓦片生成器
│       ├── generate-text-overlay.html # 文字叠加生成器
│       ├── gif-to-spritesheet.html    # GIF转精灵图
│       ├── detect-system-fonts.html   # 系统字体检测
│       └── read-font-name.html        # 字体名称读取
│
├── index.html                       # HTML入口
├── vite.config.js                   # Vite配置
├── tailwind.config.js               # Tailwind配置
└── package.json                     # 项目配置
```

---

## 🏗️ 技术架构

### 设计原则

#### 1. 关注点分离
- **组件层（Components）**: 纯展示组件，接收props渲染UI
- **Hooks层（Hooks）**: 封装数据获取和业务逻辑
- **服务层（Services）**: 数据加载、API调用、缓存管理
- **工具层（Utils）**: 纯函数，无副作用，可测试

#### 2. 数据流向
```
数据文件（JSON）
    ↓
服务层（Services）- 加载和缓存数据
    ↓
Hooks层（Hooks）- 封装数据逻辑
    ↓
组件层（Components）- 接收props渲染UI
```

#### 3. 数据分类

**共享资源**（跨赛季通用）:
- 武将数据（characters.json）
- 官职系统（positions.json）
- 部队卡（troops.json）
- 技能数据（skills.json）
- 羁绊数据（bonds.json）

**赛季专属**（每个赛季不同）:
- 势力配置（s1/factions.json）
- 服务器列表（s1/servers.json）

**数据路径规范**:
```javascript
// 共享资源
/data/shared/characters.json
/data/shared/positions.json

// 赛季专属
/data/seasons/s1/factions.json
/data/seasons/s1/servers.json
```

### 核心服务

#### 数据加载器（dataLoader.js）
```javascript
// 加载共享数据
export async function loadSharedData(resource) {
  const response = await fetch(`/data/shared/${resource}.json`);
  return await response.json();
}

// 加载赛季数据
export async function loadSeasonData(season, resource) {
  const response = await fetch(`/data/seasons/${season}/${resource}.json`);
  return await response.json();
}
```

### 命名规范

**文件命名**:
- 组件: PascalCase（CharacterCard.jsx）
- 工具: camelCase（dataLoader.js）
- 常量: UPPER_SNAKE_CASE（API_BASE_URL）

**ID命名**:
- 武将: `char_san_1101`（char_{系列}_{赛季势力编号}）
- 势力: `faction_1101`（faction_{赛季势力编号}）
- 部队: `troop_san_1101`（troop_{系列}_{赛季势力编号}）
- 技能: `skill_1_5001`（skill_{类型}_{稀有度编号}）

详见 [docs/00-base/04-ID_NAMING_GUIDE.md](./docs/00-base/04-ID_NAMING_GUIDE.md)

### 术语规范

**统一术语**:
- ✅ 将领（character）- 不用"武将"、"英雄"、"hero"
- ✅ 士气（morale）- 不用"奋战值"
- ✅ 树林（forest）- 不用"森林"

详见 [docs/00-base/04-ID_NAMING_GUIDE.md](./docs/00-base/04-ID_NAMING_GUIDE.md) 术语规范章节

### 性能优化

1. **数据加载优化**: 懒加载、缓存、预加载
2. **渲染优化**: React.memo、useMemo、useCallback
3. **大列表优化**: 虚拟滚动

---

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

---

## 👥 使用说明

### 新成员入职流程
1. 阅读 [docs/00-base/00-MILESTONES_S1.md](./docs/00-base/00-MILESTONES_S1.md) 了解项目进度
2. 阅读 [docs/00-base/01-SEASON_SYSTEM.md](./docs/00-base/01-SEASON_SYSTEM.md) 了解赛季设计
3. 阅读 [docs/00-base/03-CODE_GUIDE.md](./docs/00-base/03-CODE_GUIDE.md) 了解代码规范
4. 浏览文档目录了解各系统设计

### 日常开发参考
- 代码规范: [docs/00-base/03-CODE_GUIDE.md](./docs/00-base/03-CODE_GUIDE.md)
- ID命名与术语: [docs/00-base/04-ID_NAMING_GUIDE.md](./docs/00-base/04-ID_NAMING_GUIDE.md)
- 服务器开发: [docs/00-base/02-SERVER_GUIDE.md](./docs/00-base/02-SERVER_GUIDE.md)
- 系统文档: 按层级分类的系统设计文档（10-core-system, 20-data-layer, 30-frontend, 90-assets）

### 数据导入工具
项目提供CSV转JSON工具，方便批量导入数据：

```bash
# 导入武将数据
node docs/tools/character-csv-to-json.cjs

# 导入部队数据
node docs/tools/troop-csv-to-json.cjs

# 导入势力数据
node docs/tools/faction-csv-to-json.cjs

# 导入技能数据
node docs/tools/skill-csv-to-json.cjs

# 导入羁绊数据
node docs/tools/bond-csv-to-json.cjs
```

CSV模板文件位于 `docs/tools/*-template.csv`

### 美术工具
项目提供HTML美术工具，用于生成和处理美术资源：

- **地板瓦片生成器**: `docs/tools/generate-floor-tiles.html`
- **文字叠加生成器**: `docs/tools/generate-text-overlay.html`
- **GIF转精灵图**: `docs/tools/gif-to-spritesheet.html`
- **系统字体检测**: `docs/tools/detect-system-fonts.html`
- **字体名称读取**: `docs/tools/read-font-name.html`

---

## 📖 更多信息

查看各个系统文档了解详细设计和实现。

**最后更新**: 2026-02-21
