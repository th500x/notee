# 赛季系统设计

## 概述

**真三风云**采用赛季制（版本制），每个赛季提供不同的游戏内容和体验。

### 赛季特点

每个赛季的主要差异：
- ✅ **大地图** - 不同的地理区域和地形
- ✅ **城市系统** - 不同的城市数量和分布
- ✅ **武将池** - 历史上该时期的武将及其状态
- ✅ **兵种系统** - 不同时期的兵种和装备
- ✅ **新模块** - 可能新增的游戏玩法

### 赛季周期

- **赛季时长**: 3-6个月
- **赛季间隔**: 1-2周（准备期）
- **数据继承**: 部分数据可继承到下赛季

---

## 目录结构设计

### 推荐结构

```
05-san-storm/
├── src/
│   ├── seasons/                    # 赛季数据目录
│   │   ├── s1/                     # 第一赛季（黄巾之乱）
│   │   │   ├── config.js           # 赛季配置
│   │   │   ├── map/                # 地图数据
│   │   │   │   ├── mapData.js      # 地图配置
│   │   │   │   ├── cities.js       # 城市数据
│   │   │   │   └── regions.js      # 区域数据
│   │   │   ├── characters/         # 武将数据
│   │   │   │   ├── index.js        # 武将总导出
│   │   │   │   ├── heroes.js       # 英雄武将
│   │   │   │   └── generals.js     # 普通武将
│   │   │   ├── troops/             # 兵种数据
│   │   │   │   ├── index.js
│   │   │   │   └── troopTypes.js   # 兵种配置
│   │   │   ├── events/             # 赛季专属事件
│   │   │   │   └── seasonEvents.js
│   │   │   └── assets/             # 赛季资源
│   │   │       ├── images/         # 图片资源
│   │   │       ├── audio/          # 音频资源
│   │   │       └── ui/             # UI资源
│   │   │
│   │   ├── s2/                     # 第二赛季（董卓之乱）
│   │   │   └── ...                 # 同上结构
│   │   │
│   │   ├── s3/                     # 第三赛季（群雄割据）
│   │   │   └── ...
│   │   │
│   │   └── seasonManager.js        # 赛季管理器
│   │
│   ├── data/                       # 通用数据（跨赛季）
│   │   ├── events/                 # 通用事件
│   │   ├── items/                  # 通用物品
│   │   └── skills/                 # 通用技能
│   │
│   └── systems/                    # 游戏系统（跨赛季）
│       ├── eventSystem.js
│       ├── battleSystem.js
│       └── ...
│
└── public/                         # 公共资源
    └── seasons/                    # 赛季资源（CDN）
        ├── s1/
        │   ├── map.png
        │   ├── characters/
        │   └── ui/
        └── s2/
            └── ...
```

---

## 赛季配置示例

### S1 赛季配置

```javascript
// src/seasons/s1/config.js

export const S1_CONFIG = {
  // 基础信息
  id: 's1',
  name: '黄巾之乱',
  version: '0.1.0',
  
  // 时间设置
  timeline: {
    historicalYear: 184,  // 公元184年
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    duration: 180,  // 天数
  },
  
  // 地图配置
  map: {
    id: 'map_s1_china_184',
    name: '东汉末年',
    size: { width: 2000, height: 1500 },
    regions: 13,  // 十三州
    cities: 89,   // 城市数量
    terrainTypes: ['平原', '山地', '水域', '森林'],
  },
  
  // 武将配置
  characters: {
    total: 150,
    legendary: 10,  // 传说武将（刘备、曹操等）
    epic: 30,       // 史诗武将
    rare: 50,       // 稀有武将
    common: 60,     // 普通武将
  },
  
  // 兵种配置
  troops: {
    types: ['步兵', '弓兵', '骑兵', '枪兵'],
    maxTier: 3,  // 最高阶级
  },
  
  // 势力配置
  factions: [
    { id: 'han', name: '汉室', color: '#FFD700' },
    { id: 'yellow_turban', name: '黄巾军', color: '#FFFF00' },
    { id: 'warlords', name: '诸侯', color: '#808080' },
  ],
  
  // 赛季特色
  features: {
    yellowTurbanRebellion: true,  // 黄巾起义事件
    imperialCourt: true,          // 朝廷系统
    warlordRise: false,           // 诸侯崛起（S2开启）
  },
  
  // 新手引导
  tutorial: {
    enabled: true,
    startLocation: '涿郡',
    initialLevel: 1,
  },
  
  // 资源路径
  assets: {
    basePath: '/seasons/s1',
    map: '/seasons/s1/map.png',
    characters: '/seasons/s1/characters',
    ui: '/seasons/s1/ui',
  },
  
  // 赛季奖励
  rewards: {
    rankRewards: true,
    seasonPass: true,
    exclusiveItems: ['S1专属称号', 'S1纪念武器'],
  },
};
```

---

## 赛季管理器

```javascript
// src/seasons/seasonManager.js

import { S1_CONFIG } from './s1/config.js';
// import { S2_CONFIG } from './s2/config.js';
// import { S3_CONFIG } from './s3/config.js';

class SeasonManager {
  constructor() {
    this.seasons = new Map();
    this.currentSeason = null;
    this.loadSeasons();
  }

  /**
   * 加载所有赛季配置
   */
  loadSeasons() {
    this.seasons.set('s1', S1_CONFIG);
    // this.seasons.set('s2', S2_CONFIG);
    // this.seasons.set('s3', S3_CONFIG);
  }

  /**
   * 获取当前赛季
   */
  getCurrentSeason() {
    if (this.currentSeason) {
      return this.currentSeason;
    }

    // 根据日期自动判断当前赛季
    const now = new Date();
    
    for (const [id, config] of this.seasons) {
      const start = new Date(config.timeline.startDate);
      const end = new Date(config.timeline.endDate);
      
      if (now >= start && now <= end) {
        this.currentSeason = config;
        return config;
      }
    }

    // 默认返回最新赛季
    return this.getLatestSeason();
  }

  /**
   * 获取最新赛季
   */
  getLatestSeason() {
    const seasons = Array.from(this.seasons.values());
    return seasons[seasons.length - 1];
  }

  /**
   * 获取指定赛季
   */
  getSeason(seasonId) {
    return this.seasons.get(seasonId);
  }

  /**
   * 检查赛季是否激活
   */
  isSeasonActive(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) return false;

    const now = new Date();
    const start = new Date(season.timeline.startDate);
    const end = new Date(season.timeline.endDate);

    return now >= start && now <= end;
  }

  /**
   * 获取赛季剩余时间
   */
  getSeasonTimeRemaining(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) return null;

    const now = new Date();
    const end = new Date(season.timeline.endDate);
    const remaining = end - now;

    if (remaining <= 0) return { ended: true };

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return {
      ended: false,
      days,
      hours,
      totalMs: remaining,
    };
  }

  /**
   * 动态加载赛季资源
   */
  async loadSeasonAssets(seasonId) {
    const season = this.seasons.get(seasonId);
    if (!season) throw new Error(`Season ${seasonId} not found`);

    // 动态导入赛季模块
    const modules = await Promise.all([
      import(`./s${seasonId.slice(1)}/map/mapData.js`),
      import(`./s${seasonId.slice(1)}/characters/index.js`),
      import(`./s${seasonId.slice(1)}/troops/index.js`),
    ]);

    return {
      map: modules[0].default,
      characters: modules[1].default,
      troops: modules[2].default,
    };
  }

  /**
   * 获取所有赛季列表
   */
  getAllSeasons() {
    return Array.from(this.seasons.values()).map(season => ({
      id: season.id,
      name: season.name,
      version: season.version,
      startDate: season.timeline.startDate,
      endDate: season.timeline.endDate,
      isActive: this.isSeasonActive(season.id),
    }));
  }
}

// 导出单例
export const seasonManager = new SeasonManager();
```

---

## S1 赛季详细配置

### 地图数据

```javascript
// src/seasons/s1/map/mapData.js

export const S1_MAP = {
  id: 'map_s1_china_184',
  name: '东汉末年',
  historicalYear: 184,
  
  // 地图尺寸
  dimensions: {
    width: 2000,
    height: 1500,
    scale: 1,
  },
  
  // 十三州
  regions: [
    { id: 'youzhou', name: '幽州', color: '#4A90E2' },
    { id: 'jizhou', name: '冀州', color: '#7ED321' },
    { id: 'qingzhou', name: '青州', color: '#F5A623' },
    { id: 'xuzhou', name: '徐州', color: '#BD10E0' },
    { id: 'yangzhou', name: '扬州', color: '#50E3C2' },
    { id: 'jingzhou', name: '荆州', color: '#B8E986' },
    { id: 'yizhou', name: '益州', color: '#F8E71C' },
    { id: 'liangzhou', name: '凉州', color: '#D0021B' },
    { id: 'bingzhou', name: '并州', color: '#9013FE' },
    { id: 'sizhou', name: '司州', color: '#4A4A4A' },
    { id: 'yuzhou', name: '豫州', color: '#417505' },
    { id: 'yanzhou', name: '兖州', color: '#8B572A' },
    { id: 'jiaozhou', name: '交州', color: '#FF6B6B' },
  ],
  
  // 地形类型
  terrains: {
    plain: { name: '平原', moveCost: 1, defenseBonus: 0 },
    mountain: { name: '山地', moveCost: 2, defenseBonus: 0.3 },
    forest: { name: '森林', moveCost: 1.5, defenseBonus: 0.2 },
    water: { name: '水域', moveCost: 3, defenseBonus: 0 },
    city: { name: '城市', moveCost: 1, defenseBonus: 0.5 },
  },
};
```

### 城市数据

```javascript
// src/seasons/s1/map/cities.js

export const S1_CITIES = [
  // 幽州
  {
    id: 'city_zhuojun',
    name: '涿郡',
    region: 'youzhou',
    position: { x: 800, y: 300 },
    level: 3,
    population: 50000,
    garrison: 5000,
    specialties: ['马匹', '粮食'],
    historicalEvents: ['桃园结义'],
    initialOwner: 'han',
  },
  {
    id: 'city_jixian',
    name: '蓟县',
    region: 'youzhou',
    position: { x: 850, y: 250 },
    level: 4,
    population: 80000,
    garrison: 8000,
    specialties: ['铁矿', '木材'],
    historicalEvents: [],
    initialOwner: 'han',
  },
  
  // 冀州
  {
    id: 'city_yecheng',
    name: '邺城',
    region: 'jizhou',
    position: { x: 750, y: 450 },
    level: 5,
    population: 120000,
    garrison: 15000,
    specialties: ['粮食', '布匹'],
    historicalEvents: ['袁绍崛起'],
    initialOwner: 'han',
  },
  
  // ... 更多城市（总共89个）
];
```

### 武将数据

```javascript
// src/seasons/s1/characters/heroes.js

export const S1_HEROES = [
  // 传说级武将
  {
    id: 'char_liubei',
    name: '刘备',
    rarity: 'legendary',
    
    // 基础属性
    factors: {
      combat: 75,
      intelligence: 80,
      charisma: 95,
      politics: 85,
      command: 88,
    },
    
    // S1状态
    status: {
      age: 23,
      title: '织席贩履',
      faction: null,  // 尚未起兵
      location: '涿郡',
      troops: 0,
    },
    
    // 技能
    skills: [
      { id: 'skill_benevolence', name: '仁德', type: 'passive' },
      { id: 'skill_inspire', name: '激励', type: 'active' },
    ],
    
    // 羁绊
    bonds: [
      { character: 'char_guanyu', name: '桃园结义', bonus: { loyalty: 20 } },
      { character: 'char_zhangfei', name: '桃园结义', bonus: { loyalty: 20 } },
    ],
    
    // 历史事件
    historicalEvents: ['桃园结义', '讨伐黄巾'],
  },
  
  {
    id: 'char_caocao',
    name: '曹操',
    rarity: 'legendary',
    
    factors: {
      combat: 72,
      intelligence: 92,
      charisma: 85,
      politics: 90,
      command: 95,
    },
    
    status: {
      age: 29,
      title: '骑都尉',
      faction: 'han',
      location: '洛阳',
      troops: 3000,
    },
    
    skills: [
      { id: 'skill_treachery', name: '奸雄', type: 'passive' },
      { id: 'skill_ambition', name: '雄心', type: 'active' },
    ],
    
    bonds: [],
    
    historicalEvents: ['讨伐黄巾', '刺杀董卓'],
  },
  
  // ... 更多传说武将
];
```

### 兵种数据

```javascript
// src/seasons/s1/troops/troopTypes.js

export const S1_TROOPS = {
  // 步兵系
  infantry: {
    tier1: {
      id: 'troop_militia',
      name: '民兵',
      type: 'infantry',
      tier: 1,
      cost: { gold: 50, food: 20 },
      stats: {
        hp: 100,
        attack: 15,
        defense: 10,
        speed: 3,
      },
      counters: [],
      weakTo: ['cavalry'],
    },
    tier2: {
      id: 'troop_swordsman',
      name: '刀盾兵',
      type: 'infantry',
      tier: 2,
      cost: { gold: 100, food: 40 },
      stats: {
        hp: 150,
        attack: 25,
        defense: 20,
        speed: 3,
      },
      counters: ['spearman'],
      weakTo: ['cavalry'],
    },
    tier3: {
      id: 'troop_heavy_infantry',
      name: '重装步兵',
      type: 'infantry',
      tier: 3,
      cost: { gold: 200, food: 80 },
      stats: {
        hp: 250,
        attack: 40,
        defense: 35,
        speed: 2,
      },
      counters: ['spearman', 'archer'],
      weakTo: ['cavalry'],
    },
  },
  
  // 弓兵系
  archer: {
    tier1: {
      id: 'troop_archer',
      name: '弓箭手',
      type: 'archer',
      tier: 1,
      cost: { gold: 80, food: 30 },
      stats: {
        hp: 80,
        attack: 20,
        defense: 5,
        speed: 3,
        range: 3,
      },
      counters: ['infantry'],
      weakTo: ['cavalry'],
    },
    // ... tier2, tier3
  },
  
  // 骑兵系
  cavalry: {
    tier1: {
      id: 'troop_light_cavalry',
      name: '轻骑兵',
      type: 'cavalry',
      tier: 1,
      cost: { gold: 150, food: 60 },
      stats: {
        hp: 120,
        attack: 30,
        defense: 15,
        speed: 6,
      },
      counters: ['archer', 'infantry'],
      weakTo: ['spearman'],
    },
    // ... tier2, tier3
  },
  
  // 枪兵系
  spearman: {
    tier1: {
      id: 'troop_spearman',
      name: '长枪兵',
      type: 'spearman',
      tier: 1,
      cost: { gold: 90, food: 35 },
      stats: {
        hp: 110,
        attack: 18,
        defense: 12,
        speed: 3,
      },
      counters: ['cavalry'],
      weakTo: ['infantry', 'archer'],
    },
    // ... tier2, tier3
  },
};
```

---

## 赛季专属事件

```javascript
// src/seasons/s1/events/seasonEvents.js

export const S1_EVENTS = [
  {
    id: 'event_s1_001',
    seasonId: 's1',
    type: 'historical',
    title: '黄巾起义',
    
    trigger: {
      seasonOnly: 's1',  // 仅S1可触发
      locations: ['任意'],
      minLevel: 1,
      probability: 0.5,
      context: ['season_start'],
    },
    
    description: '张角率领黄巾军起义，天下大乱。朝廷征召天下豪杰讨伐黄巾，你是否愿意响应？',
    
    options: [
      {
        id: 'option_a',
        text: '响应朝廷，讨伐黄巾',
        outcomes: [
          {
            condition: { type: 'always' },
            onSuccess: {
              type: 'text_reward',
              text: '你加入了讨伐黄巾的队伍，开始了你的征战之路！',
              rewards: {
                exp: 2000,
                gold: 1000,
                troops: 500,
                title: '讨贼义士',
              },
            },
          },
        ],
      },
      {
        id: 'option_b',
        text: '保持中立，观望局势',
        outcomes: [
          {
            condition: { type: 'always' },
            onSuccess: {
              type: 'text',
              text: '你选择暂时观望，等待更好的时机。',
              rewards: { exp: 500 },
            },
          },
        ],
      },
    ],
    
    metadata: {
      author: '策划组',
      version: '1.0',
      tags: ['黄巾起义', 'S1专属'],
      difficulty: 'normal',
      rarity: 'epic',
    },
  },
  
  // ... 更多S1专属事件
];
```

---

## 数据继承系统

### 可继承数据

```javascript
// src/seasons/seasonManager.js

class SeasonManager {
  /**
   * 赛季结算
   */
  async seasonEnd(seasonId, playerData) {
    const season = this.seasons.get(seasonId);
    if (!season) return null;

    // 计算赛季奖励
    const rewards = this.calculateSeasonRewards(playerData);

    // 确定可继承数据
    const inheritedData = {
      // 可继承
      account: {
        username: playerData.username,
        totalPlayTime: playerData.totalPlayTime,
        achievements: playerData.achievements,
      },
      
      // 部分继承
      resources: {
        gold: Math.floor(playerData.gold * 0.3),  // 30%金币
        gems: playerData.gems,  // 100%宝石
      },
      
      // 特殊物品继承
      items: playerData.items.filter(item => 
        item.transferable === true
      ),
      
      // 武将继承（仅限抽卡获得的）
      characters: playerData.characters.filter(char => 
        char.source === 'gacha'
      ),
      
      // 不继承
      // - 等级（重置为1）
      // - 赛季专属物品
      // - 城市归属
      // - 部队
    };

    return {
      seasonRewards: rewards,
      inheritedData,
    };
  }

  /**
   * 新赛季开始
   */
  async seasonStart(newSeasonId, inheritedData) {
    const newSeason = this.seasons.get(newSeasonId);
    if (!newSeason) throw new Error('Season not found');

    // 创建新赛季玩家数据
    const newPlayerData = {
      // 继承的数据
      ...inheritedData,
      
      // 新赛季数据
      seasonId: newSeasonId,
      level: 1,
      exp: 0,
      location: newSeason.tutorial.startLocation,
      
      // 新赛季初始资源
      gold: inheritedData.resources.gold + 1000,
      food: 5000,
      troops: [],
      cities: [],
    };

    return newPlayerData;
  }
}
```

---

## 未来赛季规划

### S2: 董卓之乱 (公元189年)

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
  
  // 新特性
  features: {
    yellowTurbanRebellion: false,  // 黄巾已平
    imperialCourt: true,
    warlordRise: true,             // 诸侯崛起
    coalitionWar: true,            // 讨董联盟
  },
  
  // 新增内容
  newContent: {
    characters: 50,  // 新增50个武将
    cities: 10,      // 新增10个城市
    troops: ['虎豹骑', '西凉铁骑'],  // 新兵种
    systems: ['联盟系统'],  // 新模块
  },
};
```

### S3: 群雄割据 (公元194年)

```javascript
export const S3_CONFIG = {
  id: 's3',
  name: '群雄割据',
  version: '3.0.0',
  
  timeline: {
    historicalYear: 194,
    startDate: '2027-03-01',
    endDate: '2027-08-31',
  },
  
  features: {
    warlordRise: true,
    threeKingdomsFormation: true,  // 三国雏形
    strategicAlliance: true,       // 战略联盟
  },
  
  newContent: {
    characters: 80,
    cities: 15,
    troops: ['青州兵', '丹阳兵'],
    systems: ['外交系统', '间谍系统'],
  },
};
```

---

## 资源管理策略

### 按需加载

```javascript
// 只加载当前赛季资源
async function loadCurrentSeasonAssets() {
  const currentSeason = seasonManager.getCurrentSeason();
  
  // 动态导入
  const assets = await seasonManager.loadSeasonAssets(currentSeason.id);
  
  return assets;
}
```

### CDN部署

```
public/seasons/
├── s1/
│   ├── map.png (2MB)
│   ├── characters/ (10MB)
│   └── ui/ (5MB)
├── s2/
│   └── ... (未来部署)
└── s3/
    └── ... (未来部署)
```

### 缓存策略

```javascript
// 缓存当前赛季资源
const CACHE_STRATEGY = {
  currentSeason: {
    cache: 'force-cache',
    maxAge: 86400,  // 1天
  },
  previousSeason: {
    cache: 'no-cache',  // 不缓存
  },
};
```

---

## 总结

### 赛季系统优势

1. **内容分阶段** - 降低开发压力
2. **持续更新** - 保持玩家活跃
3. **历史还原** - 符合三国历史进程
4. **资源优化** - 按需加载，节省带宽
5. **可扩展性** - 易于添加新赛季

### 开发优先级

1. **S1完整开发** (当前)
2. **S2规划设计** (3个月后)
3. **S3概念设计** (6个月后)

### 注意事项

- ✅ 每个赛季独立目录
- ✅ 通用系统跨赛季复用
- ✅ 资源按需加载
- ✅ 数据继承规则清晰
- ✅ 赛季切换平滑过渡

现在你可以专注于S1的内容创作了！🎮


---

## 🗺️ 完整赛季路线图（S1-S9）

### 赛季时间表

| 赛季 | 名称 | 历史年份 | 运营时间 | 核心事件 | 时长 |
|------|------|---------|---------|---------|------|
| **S1** | 黄巾之乱 | 公元184年 | 2026.03-08 | 黄巾起义、朝廷征召 | 6个月 |
| **S2** | 董卓之乱 | 公元189年 | 2026.09-2027.02 | 讨董联盟、诸侯崛起 | 6个月 |
| **S3** | 群雄割据 | 公元194年 | 2027.03-08 | 三国雏形、战略联盟 | 6个月 |
| **S4** | 官渡之战 | 公元200年 | 2027.09-2028.02 | 袁曹决战、北方统一 | 6个月 |
| **S5** | 赤壁之战 | 公元208年 | 2028.03-08 | 孙刘联盟、火烧赤壁 | 6个月 |
| **S6** | 三国鼎立 | 公元220年 | 2028.09-2029.02 | 魏蜀吴立、三分天下 | 6个月 |
| **S7** | 诸葛北伐 | 公元228年 | 2029.03-08 | 六出祁山、蜀汉悲歌 | 6个月 |
| **S8** | 司马崛起 | 公元249年 | 2029.09-2030.02 | 高平陵变、司马掌权 | 6个月 |
| **S9** | 三国归晋 | 公元280年 | 2030.03-08 | 晋灭东吴、天下一统 | 6个月 |

**总计**：9个赛季，4.5年运营周期

---

## 📋 快速参考

### 核心API

```javascript
// 获取当前赛季
const season = seasonManager.getCurrentSeason();

// 加载赛季资源
const assets = await seasonManager.loadSeasonAssets('s1');

// 检查赛季状态
const isActive = seasonManager.isSeasonActive('s1');
const timeRemaining = seasonManager.getSeasonTimeRemaining('s1');
```

### S1赛季数据

**基础信息**：
- 历史年份：公元184年
- 区域：十三州
- 城市：89座
- 武将：150名
- 兵种：4类×3阶=12种

**主要城市**：
- 洛阳（司州）- 东汉都城
- 长安（司州）- 西汉旧都
- 邺城（冀州）- 袁绍根据地
- 成都（益州）- 天府之国
- 襄阳（荆州）- 水陆要冲
- 建业（扬州）- 孙氏根据地
- 涿郡（幽州）- 刘备故乡

**势力**：
- 汉室 - 东汉朝廷
- 黄巾军 - 张角领导的起义军
- 地方诸侯 - 各地割据势力

---

## 📝 更新日志

### v2.0.0 (2026-02-09)
- ✅ 整合完整9赛季路线图（SEASON_ROADMAP.md）
- ✅ 添加S4-S9赛季详细设计
- ✅ 添加赛季难度曲线
- ✅ 添加商业化策略
- ✅ 添加快速参考（SEASON_QUICK_REFERENCE.md）
- ✅ 添加核心API使用示例

### v1.0.0 (2026-02-06)
- ✅ 创建赛季系统设计文档
- ✅ 定义S1-S3赛季配置
- ✅ 实现赛季管理器
- ✅ 创建S1地图和城市数据

---

**最后更新**：2026-02-09
**文档版本**：v2.0.0
