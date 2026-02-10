# 赛季系统使用指南

## 目录结构

```
seasons/
├── seasonManager.js       # 赛季管理器（核心）
├── s1/                    # S1赛季：黄巾之乱
│   ├── config.js          # 赛季配置
│   ├── map/               # 地图数据
│   │   ├── mapData.js     # 地图配置
│   │   └── cities.js      # 城市数据
│   ├── characters/        # 武将数据（待创建）
│   ├── troops/            # 兵种数据（待创建）
│   └── events/            # 赛季专属事件（待创建）
├── s2/                    # S2赛季（未来）
└── s3/                    # S3赛季（未来）
```

## 快速开始

### 1. 获取当前赛季

```javascript
import { seasonManager } from './seasonManager.js';

// 获取当前激活的赛季
const currentSeason = seasonManager.getCurrentSeason();

console.log(currentSeason.name);  // "黄巾之乱"
console.log(currentSeason.id);    // "s1"
```

### 2. 加载赛季资源

```javascript
// 动态加载赛季资源
const assets = await seasonManager.loadSeasonAssets('s1');

console.log(assets.map);         // 地图数据
console.log(assets.cities);      // 城市数据
console.log(assets.characters);  // 武将数据
console.log(assets.troops);      // 兵种数据
```

### 3. 检查赛季状态

```javascript
// 检查赛季是否激活
const isActive = seasonManager.isSeasonActive('s1');

// 获取赛季剩余时间
const timeRemaining = seasonManager.getSeasonTimeRemaining('s1');
console.log(`剩余 ${timeRemaining.days} 天 ${timeRemaining.hours} 小时`);
```

### 4. 赛季结算

```javascript
// 赛季结束时
const result = await seasonManager.seasonEnd('s1', playerData);

console.log(result.seasonRewards);    // 赛季奖励
console.log(result.inheritedData);    // 可继承数据
```

### 5. 新赛季开始

```javascript
// 开始新赛季
const newPlayerData = await seasonManager.seasonStart('s2', inheritedData);

console.log(newPlayerData.seasonId);  // "s2"
console.log(newPlayerData.gold);      // 继承的金币 + 初始金币
```

## 添加新赛季

### 步骤1：创建赛季目录

```bash
mkdir -p src/seasons/s2/map
mkdir -p src/seasons/s2/characters
mkdir -p src/seasons/s2/troops
mkdir -p src/seasons/s2/events
```

### 步骤2：创建赛季配置

```javascript
// src/seasons/s2/config.js

export const S2_CONFIG = {
  id: 's2',
  name: '董卓之乱',
  version: '2.0.0',
  
  timeline: {
    historicalYear: 189,
    startDate: '2026-09-01',
    endDate: '2027-02-28',
  },
  
  // ... 其他配置
};
```

### 步骤3：注册赛季

```javascript
// src/seasons/seasonManager.js

import { S2_CONFIG } from './s2/config.js';

loadSeasons() {
  this.seasons.set('s1', S1_CONFIG);
  this.seasons.set('s2', S2_CONFIG);  // 添加这行
}
```

### 步骤4：创建赛季数据

按照S1的结构创建：
- `map/mapData.js` - 地图数据
- `map/cities.js` - 城市数据
- `characters/index.js` - 武将数据
- `troops/index.js` - 兵种数据
- `events/seasonEvents.js` - 赛季专属事件

## 赛季配置说明

### 基础信息

```javascript
{
  id: 's1',              // 赛季ID（唯一）
  name: '黄巾之乱',      // 赛季名称
  subtitle: '...',       // 副标题
  version: '0.1.0',      // 版本号
}
```

### 时间设置

```javascript
timeline: {
  historicalYear: 184,           // 历史年份
  historicalPeriod: '东汉末年',  // 历史时期
  startDate: '2026-03-01',       // 开始日期
  endDate: '2026-08-31',         // 结束日期
  duration: 183,                 // 持续天数
}
```

### 地图配置

```javascript
map: {
  id: 'map_s1_china_184',
  name: '东汉末年',
  size: { width: 2000, height: 1500 },
  regions: 13,   // 区域数量
  cities: 89,    // 城市数量
  terrainTypes: ['平原', '山地', '水域', '森林', '丘陵'],
}
```

### 武将配置

```javascript
characters: {
  total: 150,
  legendary: 10,  // 传说武将
  epic: 30,       // 史诗武将
  rare: 50,       // 稀有武将
  common: 60,     // 普通武将
}
```

### 兵种配置

```javascript
troops: {
  types: ['步兵', '弓兵', '骑兵', '枪兵'],
  maxTier: 3,  // 最高阶级
  specialUnits: [],  // 特殊兵种
}
```

### 势力配置

```javascript
factions: [
  { 
    id: 'han', 
    name: '汉室', 
    color: '#FFD700',
    description: '东汉朝廷',
  },
  // ... 更多势力
]
```

### 赛季特色

```javascript
features: {
  yellowTurbanRebellion: true,  // 黄巾起义
  imperialCourt: true,          // 朝廷系统
  warlordRise: false,           // 诸侯崛起（S2开启）
}
```

### 资源路径

```javascript
assets: {
  basePath: '/seasons/s1',
  map: '/seasons/s1/map.png',
  characters: '/seasons/s1/characters',
  ui: '/seasons/s1/ui',
}
```

### 数据继承规则

```javascript
inheritance: {
  gold: 0.3,        // 30%金币继承
  gems: 1.0,        // 100%宝石继承
  items: 'selective',  // 选择性继承
  characters: 'gacha_only',  // 仅抽卡武将
  level: 0,         // 等级不继承
}
```

## 赛季数据管理

### 通用数据 vs 赛季数据

**通用数据**（`src/data/`）：
- 跨赛季复用
- 事件系统配置
- 通用物品、技能
- 游戏系统逻辑

**赛季数据**（`src/seasons/s*/`）：
- 赛季专属
- 地图、城市
- 武将、兵种
- 赛季专属事件

### 数据加载策略

```javascript
// 只加载当前赛季数据
const currentSeason = seasonManager.getCurrentSeason();
const assets = await seasonManager.loadSeasonAssets(currentSeason.id);

// 不加载其他赛季数据，节省内存
```

### 资源部署

```
public/seasons/
├── s1/
│   ├── map.png (2MB)
│   ├── characters/ (10MB)
│   └── ui/ (5MB)
├── s2/ (未来部署)
└── s3/ (未来部署)
```

## 最佳实践

### 1. 赛季独立性

每个赛季应该独立开发和测试：

```javascript
// ✅ 好的做法
import { S1_CONFIG } from './s1/config.js';
import { S1_MAP } from './s1/map/mapData.js';

// ❌ 避免跨赛季引用
import { S2_CHARACTERS } from './s2/characters/index.js';  // 在S1中不要这样做
```

### 2. 配置驱动

使用配置而不是硬编码：

```javascript
// ✅ 好的做法
const maxTier = currentSeason.troops.maxTier;

// ❌ 避免硬编码
const maxTier = 3;  // 不同赛季可能不同
```

### 3. 按需加载

只加载需要的资源：

```javascript
// ✅ 好的做法
const currentAssets = await seasonManager.loadSeasonAssets(currentSeason.id);

// ❌ 避免加载所有赛季
const allAssets = await Promise.all([
  seasonManager.loadSeasonAssets('s1'),
  seasonManager.loadSeasonAssets('s2'),
  seasonManager.loadSeasonAssets('s3'),
]);
```

### 4. 数据继承规则

明确哪些数据可以继承：

```javascript
// 可继承
- 账号信息
- 宝石（付费货币）
- 抽卡获得的武将
- 成就

// 不可继承
- 等级
- 经验
- 赛季专属物品
- 城市归属
- 部队
```

## 常见问题

### Q: 如何测试新赛季？

A: 修改赛季配置的日期，或者直接调用：

```javascript
const testSeason = seasonManager.getSeason('s2');
const assets = await seasonManager.loadSeasonAssets('s2');
```

### Q: 如何处理赛季切换？

A: 使用赛季管理器的结算和开始方法：

```javascript
// 1. 结算当前赛季
const result = await seasonManager.seasonEnd('s1', playerData);

// 2. 保存结算结果
await saveSeasonResult(result);

// 3. 开始新赛季
const newData = await seasonManager.seasonStart('s2', result.inheritedData);
```

### Q: 如何添加赛季专属事件？

A: 在赛季事件文件中添加，并设置 `seasonOnly` 标记：

```javascript
{
  id: 'event_s1_001',
  seasonId: 's1',
  trigger: {
    seasonOnly: 's1',  // 仅S1可触发
    // ...
  },
  // ...
}
```

### Q: 赛季资源如何优化？

A: 
1. 使用CDN部署静态资源
2. 图片压缩和懒加载
3. 按需加载赛季数据
4. 缓存当前赛季资源

## 下一步

1. 完善S1赛季数据（武将、兵种、事件）
2. 测试赛季切换流程
3. 规划S2赛季内容
4. 优化资源加载性能

详见 [SEASON_SYSTEM.md](../../SEASON_SYSTEM.md)
