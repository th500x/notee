# 真三风云 - 技术架构文档

## 📋 文档概述

本文档定义了游戏的技术架构、代码组织、数据结构和开发规范。

**最后更新**：2026-02-06  
**文档版本**：v1.0.0

---

## 🏗️ 项目结构

### 目录组织

```
05-san-storm/
├── public/                          # 静态资源
│   ├── data/                        # 数据文件
│   │   ├── shared/                  # 共享数据（跨赛季）
│   │   │   ├── characters.json      # 所有武将数据
│   │   │   ├── positions.json       # 官职系统数据
│   │   │   ├── troops.json          # 部队卡数据
│   │   │   └── skills.json          # 技能数据
│   │   └── seasons/                 # 赛季专属数据
│   │       ├── s1/                  # S1赛季数据
│   │       │   ├── factions.json    # 势力配置
│   │       │   ├── servers.json     # 服务器列表
│   │       │   └── events.json      # 赛季事件
│   │       └── s2/                  # S2赛季数据（未来）
│   └── assets/                      # 静态资源
│       ├── images/                  # 图片资源
│       └── icons/                   # 图标资源
│
├── src/
│   ├── main.jsx                     # 应用入口
│   ├── App.jsx                      # 根组件
│   │
│   ├── pages/                       # 页面组件
│   │   ├── Home.jsx                 # 首页（游戏选择）
│   │   ├── ServerSelect.jsx         # 服务器选择
│   │   ├── Characters.jsx           # 武将列表
│   │   ├── CharacterDetail.jsx      # 武将详情
│   │   ├── Factions.jsx             # 势力展示
│   │   ├── Positions.jsx            # 官职系统
│   │   └── About.jsx                # 关于页面
│   │
│   ├── components/                  # 通用组件
│   │   ├── layout/                  # 布局组件
│   │   │   ├── Header.jsx           # 页头
│   │   │   ├── Footer.jsx           # 页脚
│   │   │   ├── Sidebar.jsx          # 侧边栏
│   │   │   └── Navigation.jsx       # 导航栏
│   │   │
│   │   ├── character/               # 角色相关组件
│   │   │   ├── CharacterCard.jsx    # 武将卡片
│   │   │   ├── CharacterList.jsx    # 武将列表
│   │   │   ├── AttributeBar.jsx     # 属性条
│   │   │   ├── AttributeDisplay.jsx # 属性展示
│   │   │   └── StageTag.jsx         # 生涯标签
│   │   │
│   │   ├── faction/                 # 势力相关组件
│   │   │   ├── FactionCard.jsx      # 势力卡片
│   │   │   ├── FactionList.jsx      # 势力列表
│   │   │   └── FactionBadge.jsx     # 势力徽章
│   │   │
│   │   ├── position/                # 官职相关组件
│   │   │   ├── PositionCard.jsx     # 官职卡片
│   │   │   ├── PositionList.jsx     # 官职列表
│   │   │   └── PositionBadge.jsx    # 官职徽章
│   │   │
│   │   ├── server/                  # 服务器相关组件
│   │   │   ├── ServerCard.jsx       # 服务器卡片
│   │   │   ├── ServerList.jsx       # 服务器列表
│   │   │   └── ServerStatus.jsx     # 服务器状态
│   │   │
│   │   └── common/                  # 通用组件
│   │       ├── Button.jsx           # 按钮
│   │       ├── Card.jsx             # 卡片
│   │       ├── Modal.jsx            # 模态框
│   │       ├── Loading.jsx          # 加载动画
│   │       ├── ErrorBoundary.jsx    # 错误边界
│   │       └── SearchBar.jsx        # 搜索栏
│   │
│   ├── hooks/                       # 自定义Hooks
│   │   ├── useCharacters.js         # 武将数据Hook
│   │   ├── useFactions.js           # 势力数据Hook
│   │   ├── usePositions.js          # 官职数据Hook
│   │   ├── useServers.js            # 服务器数据Hook
│   │   ├── useFilter.js             # 筛选Hook
│   │   └── useSort.js               # 排序Hook
│   │
│   ├── services/                    # 数据服务层
│   │   ├── api/                     # API服务
│   │   │   ├── characterService.js  # 武将数据服务
│   │   │   ├── factionService.js    # 势力数据服务
│   │   │   ├── positionService.js   # 官职数据服务
│   │   │   └── serverService.js     # 服务器数据服务
│   │   │
│   │   └── storage/                 # 本地存储服务
│   │       ├── localStorage.js      # LocalStorage封装
│   │       └── sessionStorage.js    # SessionStorage封装
│   │
│   ├── utils/                       # 工具函数
│   │   ├── dataLoader.js            # 数据加载器
│   │   ├── calculator.js            # 属性计算器
│   │   ├── formatter.js             # 格式化工具
│   │   ├── validator.js             # 验证工具
│   │   └── constants.js             # 常量定义
│   │
│   ├── config/                      # 配置文件
│   │   ├── routes.js                # 路由配置
│   │   ├── theme.js                 # 主题配置
│   │   └── api.js                   # API配置
│   │
│   ├── styles/                      # 样式文件
│   │   ├── index.css                # 全局样式
│   │   ├── variables.css            # CSS变量
│   │   └── tailwind.css             # Tailwind配置
│   │
│   └── types/                       # 类型定义（JSDoc）
│       ├── character.js             # 角色类型
│       ├── faction.js               # 势力类型
│       ├── position.js              # 官职类型
│       └── server.js                # 服务器类型
│
├── tools/                           # 开发工具
│   ├── csv-to-json.js               # CSV转JSON工具
│   ├── data-validator.js            # 数据验证工具
│   └── README.md                    # 工具说明
│
├── docs/                            # 文档目录
│   ├── ARCHITECTURE.md              # 本文档
│   ├── MILESTONES.md                # 里程碑规划
│   ├── CHARACTER_ATTRIBUTES.md      # 角色属性系统
│   └── ...                          # 其他文档
│
├── index.html                       # HTML入口
├── vite.config.js                   # Vite配置
├── tailwind.config.js               # Tailwind配置
├── package.json                     # 项目配置
└── README.md                        # 项目说明
```

---

## 🎯 设计原则

### 1. 关注点分离

**页面层（Pages）**：
- 只负责页面布局和路由
- 不包含业务逻辑
- 调用Hooks获取数据

**组件层（Components）**：
- 纯展示组件
- 接收props，渲染UI
- 不直接访问数据

**Hooks层（Hooks）**：
- 封装数据获取逻辑
- 封装状态管理
- 可复用的业务逻辑

**服务层（Services）**：
- 数据获取和处理
- API调用封装
- 数据缓存管理

**工具层（Utils）**：
- 纯函数
- 无副作用
- 可测试

### 2. 数据流向

```
数据文件（JSON）
    ↓
服务层（Services）- 加载和缓存数据
    ↓
Hooks层（Hooks）- 封装数据逻辑
    ↓
页面层（Pages）- 使用Hooks获取数据
    ↓
组件层（Components）- 接收props渲染UI
```

### 3. 共享资源 vs 赛季专属

**共享资源**（跨赛季通用）：
- 武将数据（characters.json）
- 官职系统（positions.json）
- 部队卡（troops.json）
- 技能数据（skills.json）

**赛季专属**（每个赛季不同）：
- 势力配置（s1/factions.json）
- 服务器列表（s1/servers.json）
- 赛季事件（s1/events.json）

**数据路径规范**：
```javascript
// 共享资源
/data/shared/characters.json
/data/shared/positions.json

// 赛季专属
/data/seasons/s1/factions.json
/data/seasons/s1/servers.json
```

### 4. 用户数据分离

**里程碑1**（纯前端）：
- 使用LocalStorage存储用户偏好
- 不涉及用户账号数据

**里程碑2+**（需要后端）：
- 用户数据按赛季分库
- 避免单表数据过大

```
数据库结构（未来）：
├── users/                  # 用户账号表（全局）
├── s1_characters/          # S1赛季角色数据
├── s1_progress/            # S1赛季进度数据
├── s2_characters/          # S2赛季角色数据
└── s2_progress/            # S2赛季进度数据
```

---

## 📊 数据结构规范

### 武将数据（characters.json）

```javascript
{
  "characters": [
    {
      // 基础信息
      "id": "char_san_1101",           // ID格式：char_{系列}_{赛季势力编号}
      "name": "刘备",                   // 角色名
      "rarity": "legendary",            // 稀有度：legendary/epic/rare/common
      "faction": "刘备",                // 所属势力
      "season": "S1",                   // 所属赛季
      "age": 28,                        // 当前年龄
      "stage": "巅峰",                  // 生涯：茅庐/巅峰/不惑
      
      // 特殊属性
      "luck": 8.5,                      // 运气（0.0-10.0）
      "courage": 7.5,                   // 勇气（0.0-10.0）
      
      // 核心五维
      "command": 8.8,                   // 统率（0.0-10.0）
      "combat": 7.5,                    // 武力（0.0-10.0）
      "intelligence": 8.0,              // 智力（0.0-10.0）
      "politics": 8.5,                  // 政治（0.0-10.0）
      "charisma": 9.9,                  // 魅力（0.0-10.0）
      
      // 动态属性（初始值）
      "morale": 50,                     // 奋战值（0-100）
      
      // 扩展信息
      "skills": ["仁德", "激励"],       // 技能列表
      "bonds": ["桃园"],                // 羁绊列表
      "biography": "先主传",            // 传记
      "description": "汉室宗亲，仁德之君" // 描述
    }
  ]
}
```

### 势力数据（s1/factions.json）

```javascript
{
  "season": "S1",
  "factions": [
    {
      "id": "faction_s1_0001",
      "code": 1,
      "name": "刘备",
      "leader": "刘备",
      "icon": "🐉",
      "color": "#FF6B6B",
      "style": "机缘",
      "playerType": "好人",
      "maxPlayers": 30,
      "difficulty": 3,
      "description": "汉室宗亲，仁德之君",
      "bonuses": {
        "charmBonus": 0.10,
        "defenseBonus": 0.5
      },
      "features": [
        "势力魅力值+10%",
        "武将防御力+0.5"
      ]
    }
  ]
}
```

### 官职数据（positions.json）

```javascript
{
  "positions": [
    {
      "id": "position_general",
      "name": "大将军",
      "level": 8,
      "icon": "⭐⭐⭐",
      "rank": 1,
      "requirement": "势力排名第1",
      "bonuses": {
        "resourceBonus": 0.5,
        "prestigeBonus": 0.5
      },
      "permissions": [
        "管理联盟",
        "宣战权限"
      ],
      "color": "#FFD700"
    }
  ]
}
```

### 服务器数据（s1/servers.json）

```javascript
{
  "season": "S1",
  "servers": [
    {
      "id": "server_s1_001",
      "name": "S1-01 七雄争霸",
      "season": "S1",
      "maxPlayers": 500,
      "activePlayerCount": 156,
      "onlinePlayerCount": 89,
      "status": "popular",
      "openedAt": "2026-02-01T00:00:00Z"
    }
  ]
}
```

---

## 🔧 核心服务

### 数据加载服务（dataLoader.js）

```javascript
/**
 * 数据加载器
 * 负责从JSON文件加载数据，并提供缓存机制
 */

// 缓存对象
const cache = new Map();

/**
 * 加载共享数据
 * @param {string} resource - 资源名称（characters/positions/troops/skills）
 * @returns {Promise<Object>} 数据对象
 */
export async function loadSharedData(resource) {
  const cacheKey = `shared_${resource}`;
  
  // 检查缓存
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 加载数据
  const response = await fetch(`/data/shared/${resource}.json`);
  const data = await response.json();
  
  // 存入缓存
  cache.set(cacheKey, data);
  
  return data;
}

/**
 * 加载赛季数据
 * @param {string} season - 赛季标识（s1/s2/s3）
 * @param {string} resource - 资源名称（factions/servers/events）
 * @returns {Promise<Object>} 数据对象
 */
export async function loadSeasonData(season, resource) {
  const cacheKey = `${season}_${resource}`;
  
  // 检查缓存
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 加载数据
  const response = await fetch(`/data/seasons/${season}/${resource}.json`);
  const data = await response.json();
  
  // 存入缓存
  cache.set(cacheKey, data);
  
  return data;
}

/**
 * 清除缓存
 * @param {string} key - 缓存键（可选，不传则清除全部）
 */
export function clearCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
```

---

## 🎨 样式规范

### Tailwind配置

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 稀有度颜色
        legendary: '#FFD700',  // 传说-金色
        epic: '#9C27B0',       // 史诗-紫色
        rare: '#2196F3',       // 稀有-蓝色
        common: '#4CAF50',     // 普通-绿色
        
        // 属性颜色
        luck: '#FFD700',       // 运气-金色
        courage: '#FF4444',    // 勇气-红色
        command: '#9C27B0',    // 统率-紫色
        combat: '#F44336',     // 武力-红色
        intelligence: '#2196F3', // 智力-蓝色
        politics: '#4CAF50',   // 政治-绿色
        charisma: '#E91E63',   // 魅力-粉色
        
        // 势力颜色
        'faction-liubei': '#FF6B6B',
        'faction-caocao': '#4ECDC4',
        'faction-sunquan': '#95E1D3',
      },
    },
  },
  plugins: [],
};
```

### CSS变量

```css
/* src/styles/variables.css */
:root {
  /* 稀有度颜色 */
  --color-legendary: #FFD700;
  --color-epic: #9C27B0;
  --color-rare: #2196F3;
  --color-common: #4CAF50;
  
  /* 属性颜色 */
  --color-luck: #FFD700;
  --color-courage: #FF4444;
  --color-command: #9C27B0;
  --color-combat: #F44336;
  --color-intelligence: #2196F3;
  --color-politics: #4CAF50;
  --color-charisma: #E91E63;
  
  /* 间距 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* 圆角 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}
```

---

## 🔄 状态管理

### 里程碑1（简单状态）

使用React Hooks + Context：
- useState - 组件内部状态
- useContext - 跨组件共享状态
- 不使用Redux（过度设计）

### 未来扩展

如果状态复杂度增加，考虑：
- Zustand（轻量级状态管理）
- Redux Toolkit（复杂状态管理）

---

## 🧪 代码规范

### 命名规范

**文件命名**：
- 组件：PascalCase（CharacterCard.jsx）
- 工具：camelCase（dataLoader.js）
- 常量：UPPER_SNAKE_CASE（API_BASE_URL）

**变量命名**：
- 组件：PascalCase（CharacterCard）
- 函数：camelCase（loadCharacters）
- 常量：UPPER_SNAKE_CASE（MAX_PLAYERS）
- 私有：_camelCase（_internalFunction）

**路径引用**：
- 使用相对路径：`../components/CharacterCard`
- 或配置别名：`@/components/CharacterCard`

### 注释规范

```javascript
/**
 * 加载武将数据
 * 
 * @description 从JSON文件加载所有武将数据，并提供缓存机制
 * @returns {Promise<Array>} 武将数据数组
 * @throws {Error} 加载失败时抛出错误
 * 
 * @example
 * const characters = await loadCharacters();
 * console.log(characters.length); // 70
 */
export async function loadCharacters() {
  // 实现代码
}
```

### 错误处理

```javascript
try {
  const data = await loadCharacters();
  return data;
} catch (error) {
  console.error('加载武将数据失败:', error);
  // 返回默认值或抛出错误
  throw new Error('数据加载失败，请刷新页面重试');
}
```

---

## 🚀 性能优化

### 数据加载优化

1. **懒加载**：按需加载数据
2. **缓存**：避免重复请求
3. **预加载**：提前加载关键数据

### 渲染优化

1. **React.memo**：避免不必要的重渲染
2. **useMemo**：缓存计算结果
3. **useCallback**：缓存函数引用
4. **虚拟滚动**：大列表优化

---

## 📝 开发流程

### 1. 数据准备
- 转换CSV为JSON
- 验证数据格式
- 放入对应目录

### 2. 服务层开发
- 实现数据加载服务
- 实现数据缓存
- 编写单元测试

### 3. Hooks开发
- 封装数据获取逻辑
- 封装筛选排序逻辑
- 提供统一接口

### 4. 组件开发
- 开发展示组件
- 确保组件纯净
- 添加PropTypes

### 5. 页面开发
- 组装组件
- 调用Hooks
- 处理路由

### 6. 测试和优化
- 功能测试
- 性能测试
- 用户体验优化

---

## 🎯 里程碑1交付清单

### 功能清单
- [ ] 游戏主页
- [ ] 服务器选择页面
- [ ] 武将列表页面
- [ ] 武将详情页面
- [ ] 势力展示页面
- [ ] 官职系统页面
- [ ] 筛选和排序功能
- [ ] 响应式设计

### 质量清单
- [ ] 代码注释完整
- [ ] 无console错误
- [ ] 数据加载正常
- [ ] 页面切换流畅
- [ ] 移动端适配良好

---

**让我们开始构建真三风云！** 🎮💪

