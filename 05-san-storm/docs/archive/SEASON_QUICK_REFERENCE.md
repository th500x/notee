# 赛季系统快速参考

## 📋 文件清单

### 已创建文件

```
05-san-storm/
├── SEASON_SYSTEM.md                    # 赛季系统完整设计文档
├── SEASON_QUICK_REFERENCE.md           # 本文件（快速参考）
└── src/
    └── seasons/
        ├── README.md                   # 赛季系统使用指南
        ├── seasonManager.js            # 赛季管理器（核心）
        └── s1/                         # S1赛季：黄巾之乱
            ├── config.js               # S1配置
            └── map/
                ├── mapData.js          # 地图数据
                └── cities.js           # 城市数据（15个示例）
```

### 待创建文件

```
src/seasons/s1/
├── characters/
│   ├── index.js                        # 武将总导出
│   ├── heroes.js                       # 传说武将（刘备、曹操等）
│   └── generals.js                     # 普通武将
├── troops/
│   ├── index.js                        # 兵种总导出
│   └── troopTypes.js                   # 兵种配置
└── events/
    └── seasonEvents.js                 # S1专属事件
```

---

## 🎯 核心概念

### 赛季制度

| 赛季 | 名称 | 历史时期 | 时间 | 特色 |
|------|------|---------|------|------|
| S1 | 黄巾之乱 | 公元184年 | 2026.03-08 | 黄巾起义、朝廷征召 |
| S2 | 董卓之乱 | 公元189年 | 2026.09-2027.02 | 讨董联盟、诸侯崛起 |
| S3 | 群雄割据 | 公元194年 | 2027.03-08 | 三国雏形、战略联盟 |

### 赛季差异

每个赛季独立的内容：
- ✅ 大地图（不同区域和地形）
- ✅ 城市系统（数量和分布）
- ✅ 武将池（历史时期的武将及状态）
- ✅ 兵种系统（不同时期的兵种）
- ✅ 专属事件（赛季特色事件）
- ✅ 新模块（可能新增的玩法）

### 数据继承

| 数据类型 | 继承比例 | 说明 |
|---------|---------|------|
| 金币 | 30% | 部分继承 |
| 宝石 | 100% | 完全继承 |
| 抽卡武将 | 100% | 完全继承 |
| 成就 | 100% | 完全继承 |
| 等级 | 0% | 重置为1级 |
| 城市 | 0% | 不继承 |
| 部队 | 0% | 不继承 |

---

## 🚀 快速使用

### 获取当前赛季

```javascript
import { seasonManager } from './src/seasons/seasonManager.js';

const season = seasonManager.getCurrentSeason();
console.log(season.name);  // "黄巾之乱"
```

### 加载赛季资源

```javascript
const assets = await seasonManager.loadSeasonAssets('s1');

// 使用资源
const map = assets.map;
const cities = assets.cities;
const characters = assets.characters;
```

### 检查赛季状态

```javascript
// 是否激活
const isActive = seasonManager.isSeasonActive('s1');

// 剩余时间
const time = seasonManager.getSeasonTimeRemaining('s1');
console.log(`剩余 ${time.days} 天`);
```

---

## 📁 S1 赛季数据

### 基础信息

```javascript
{
  id: 's1',
  name: '黄巾之乱',
  historicalYear: 184,
  duration: 183天,
  
  // 内容规模
  regions: 13,      // 十三州
  cities: 89,       // 城市
  characters: 150,  // 武将
  troopTypes: 4,    // 兵种类型
}
```

### 十三州

1. 幽州 - 北方边境，多产战马
2. 冀州 - 中原腹地，人口众多
3. 青州 - 东部沿海，商业发达
4. 徐州 - 交通要道，兵家必争
5. 扬州 - 江南富庶之地
6. 荆州 - 长江中游，水陆要冲
7. 益州 - 天府之国，易守难攻
8. 凉州 - 西北边陲，民风彪悍
9. 并州 - 北方重镇，多出名将
10. 司州 - 京畿之地，朝廷所在
11. 豫州 - 中原要地，四战之地
12. 兖州 - 中原腹地，人口稠密
13. 交州 - 南方边陲，瘴气弥漫

### 主要城市（已创建）

| 城市 | 州 | 等级 | 人口 | 特色 |
|------|---|------|------|------|
| 洛阳 | 司州 | 6 | 20万 | 东汉都城 |
| 长安 | 司州 | 5 | 15万 | 西汉旧都 |
| 邺城 | 冀州 | 5 | 12万 | 袁绍根据地 |
| 成都 | 益州 | 5 | 13万 | 天府之国 |
| 襄阳 | 荆州 | 5 | 11万 | 水陆要冲 |
| 建业 | 扬州 | 4 | 10万 | 孙氏根据地 |
| 涿郡 | 幽州 | 3 | 5万 | 刘备故乡 |

### 兵种系统

```javascript
步兵系: 民兵 → 刀盾兵 → 重装步兵
弓兵系: 弓箭手 → 强弩手 → 神射手
骑兵系: 轻骑兵 → 重骑兵 → 铁骑
枪兵系: 长枪兵 → 重枪兵 → 精锐枪兵
```

### 势力

- 汉室 - 东汉朝廷
- 黄巾军 - 张角领导的起义军
- 地方诸侯 - 各地割据势力

---

## 🎮 开发指南

### 添加武将数据

```javascript
// src/seasons/s1/characters/heroes.js

export const S1_HEROES = [
  {
    id: 'char_liubei',
    name: '刘备',
    rarity: 'legendary',
    factors: {
      combat: 75,
      intelligence: 80,
      charisma: 95,
    },
    status: {
      age: 23,
      location: '涿郡',
      faction: null,
    },
    // ...
  },
];
```

### 添加兵种数据

```javascript
// src/seasons/s1/troops/troopTypes.js

export const S1_TROOPS = {
  infantry: {
    tier1: {
      id: 'troop_militia',
      name: '民兵',
      cost: { gold: 50, food: 20 },
      stats: { hp: 100, attack: 15 },
    },
  },
};
```

### 添加赛季事件

```javascript
// src/seasons/s1/events/seasonEvents.js

export const S1_EVENTS = [
  {
    id: 'event_s1_001',
    seasonId: 's1',
    title: '黄巾起义',
    trigger: {
      seasonOnly: 's1',  // 仅S1可触发
      // ...
    },
    // ...
  },
];
```

---

## 📊 开发进度

### S1 赛季

- [x] 赛季配置
- [x] 地图数据
- [x] 城市数据（15个示例）
- [ ] 武将数据（0/150）
- [ ] 兵种数据（0/12）
- [ ] 赛季事件（0/50）

### S2 赛季

- [ ] 赛季配置
- [ ] 地图数据
- [ ] 城市数据
- [ ] 武将数据
- [ ] 兵种数据
- [ ] 赛季事件

### S3 赛季

- [ ] 赛季配置
- [ ] 地图数据
- [ ] 城市数据
- [ ] 武将数据
- [ ] 兵种数据
- [ ] 赛季事件

---

## 🔗 相关文档

| 文档 | 说明 |
|------|------|
| [SEASON_SYSTEM.md](./SEASON_SYSTEM.md) | 赛季系统完整设计 |
| [src/seasons/README.md](./src/seasons/README.md) | 赛季系统使用指南 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 游戏整体架构 |
| [QUICK_START.md](./QUICK_START.md) | 事件系统快速开始 |
| [ROADMAP.md](./ROADMAP.md) | 开发路线图 |

---

## ✅ 下一步

### 立即可做

1. **创作事件内容**
   - 在 `src/data/events/historical/three-kingdoms.js` 中添加通用事件
   - 在 `src/seasons/s1/events/seasonEvents.js` 中添加S1专属事件

2. **完善S1数据**
   - 创建武将数据文件
   - 创建兵种数据文件
   - 补充更多城市数据

### 未来规划

1. **S1完整开发**（当前）
   - 完成150个武将数据
   - 完成12个兵种配置
   - 创作50+赛季事件

2. **S2规划设计**（3个月后）
   - 设计S2地图变化
   - 规划新增武将
   - 设计新兵种

3. **S3概念设计**（6个月后）
   - 三国鼎立格局
   - 新增外交系统
   - 新增间谍系统

---

## 💡 设计优势

1. **内容分阶段** - 降低开发压力，每个赛季专注一个历史时期
2. **持续更新** - 保持玩家活跃，每3-6个月新内容
3. **历史还原** - 符合三国历史进程，增强代入感
4. **资源优化** - 按需加载，节省带宽和内存
5. **可扩展性** - 易于添加新赛季，架构清晰

---

## 🎉 总结

赛季系统已经完整搭建！你现在可以：

1. ✅ 使用 `seasonManager` 管理赛季
2. ✅ 在 S1 配置基础上添加内容
3. ✅ 创作赛季专属事件
4. ✅ 规划未来赛季内容

专注于S1的内容创作，其他赛季可以后续逐步开发！🚀
