# 据点（城市）系统 (City System)

## 文档信息
- **文档编号**: 15-CITY_SYSTEM
- **系统类型**: 核心系统
- **创建日期**: 2026-02-09
- **最后更新**: 2026-02-09
- **状态**: 📝 设计中

## 一、系统概述

### 1.1 系统定位
据点系统是游戏的核心战略要素，玩家通过占领、建设和管理城市来发展势力，获取资源，扩张领土。

### 1.2 设计目标
- 🏰 **战略价值** - 城市是战略要地，控制城市就控制区域
- 💰 **资源产出** - 城市提供金币、粮食、兵力等资源
- 🏗️ **建设发展** - 通过建设提升城市功能和产出
- ⚔️ **军事要塞** - 城市是防御据点和进攻基地
- 🎯 **目标导向** - 占领特定城市推进游戏进程

### 1.3 系统特点
- ✅ **历史真实** - 基于三国时期真实城市
- ✅ **层次分明** - 大城、中城、小城、关隘等不同等级
- ✅ **功能多样** - 资源、军事、政治、文化等多种功能
- ✅ **动态变化** - 城市状态随战争和建设动态变化

## 二、城市分类

### 2.1 按规模分类

#### 大城（一级城市）
**特点**:
- 🏛️ 州郡治所
- 👥 人口众多
- 💰 资源丰富
- 🛡️ 防御坚固

**示例**:
```javascript
{
  id: "city_luoyang",
  name: "洛阳",
  type: "major_city",
  level: 1,
  region: "司隶",
  position: { x: 500, y: 300 },
  
  // 基础属性
  population: 100000,
  prosperity: 90,
  defense: 100,
  loyalty: 80,
  
  // 资源产出（每回合）
  production: {
    gold: 1000,
    food: 800,
    wood: 500,
    iron: 300,
    recruitment: 100 // 可招募兵力
  },
  
  // 特殊属性
  isCapital: true,
  culturalValue: 100,
  strategicValue: 100,
  
  // 建筑槽位
  buildingSlots: 8,
  buildings: []
}
```

**S1赛季大城列表**:
- 洛阳（司隶）- 汉室都城
- 长安（司隶）- 西部重镇
- 邺城（冀州）- 袁绍根据地
- 许昌（豫州）- 曹操根据地
- 成都（益州）- 刘璋根据地
- 建业（扬州）- 孙坚根据地

#### 中城（二级城市）
**特点**:
- 🏘️ 郡县治所
- 👥 人口适中
- 💰 资源稳定
- 🛡️ 防御中等

**示例**:
```javascript
{
  id: "city_xuzhou",
  name: "徐州",
  type: "medium_city",
  level: 2,
  region: "徐州",
  position: { x: 600, y: 400 },
  
  population: 50000,
  prosperity: 70,
  defense: 70,
  loyalty: 70,
  
  production: {
    gold: 500,
    food: 400,
    wood: 300,
    iron: 200,
    recruitment: 50
  },
  
  buildingSlots: 6,
  buildings: []
}
```

#### 小城（三级城市）
**特点**:
- 🏠 县城、镇
- 👥 人口较少
- 💰 资源有限
- 🛡️ 防御薄弱

**示例**:
```javascript
{
  id: "city_xiaopei",
  name: "小沛",
  type: "small_city",
  level: 3,
  region: "徐州",
  position: { x: 620, y: 420 },
  
  population: 20000,
  prosperity: 50,
  defense: 40,
  loyalty: 60,
  
  production: {
    gold: 200,
    food: 200,
    wood: 150,
    iron: 100,
    recruitment: 20
  },
  
  buildingSlots: 4,
  buildings: []
}
```

#### 关隘（特殊据点）
**特点**:
- ⛰️ 地势险要
- 🛡️ 防御极强
- ⚔️ 战略要地
- 💰 资源较少

**示例**:
```javascript
{
  id: "pass_hulao",
  name: "虎牢关",
  type: "pass",
  level: 2,
  region: "司隶",
  position: { x: 480, y: 320 },
  
  population: 5000,
  prosperity: 30,
  defense: 150, // 防御力极高
  loyalty: 90,
  
  production: {
    gold: 100,
    food: 50,
    wood: 50,
    iron: 50,
    recruitment: 30
  },
  
  // 关隘特性
  passBonus: {
    defenseMultiplier: 2.0, // 防守方战力翻倍
    terrainAdvantage: 50 // 地形优势
  },
  
  buildingSlots: 2,
  buildings: []
}
```

### 2.2 按功能分类

#### 经济城市
- 💰 高金币产出
- 🏪 商业繁荣
- 📈 贸易中心

#### 军事城市
- ⚔️ 高兵力招募
- 🏰 强大防御
- 🎖️ 军事训练

#### 文化城市
- 📚 高文化值
- 🎓 人才培养
- 🏛️ 科技研究

#### 资源城市
- 🌾 高粮食产出
- 🪵 高木材产出
- ⛏️ 高铁矿产出

## 三、城市属性系统

### 3.1 基础属性

```javascript
const cityAttributes = {
  // 人口
  population: {
    current: 50000,
    max: 100000,
    growthRate: 0.02, // 每回合增长2%
    effects: {
      // 人口影响资源产出
      goldBonus: 0.5,  // 每1000人口+0.5金币
      foodConsumption: 0.1 // 每1000人口消耗0.1粮食
    }
  },
  
  // 繁荣度
  prosperity: {
    current: 70,
    max: 100,
    effects: {
      // 繁荣度影响产出和忠诚
      productionBonus: 0.7, // 70%产出加成
      loyaltyBonus: 0.35 // 35%忠诚加成
    }
  },
  
  // 防御力
  defense: {
    base: 50,
    buildings: 30, // 建筑加成
    garrison: 20, // 驻军加成
    total: 100
  },
  
  // 忠诚度
  loyalty: {
    current: 80,
    max: 100,
    decayRate: -1, // 每回合-1（敌对势力）
    effects: {
      // 忠诚度低于50可能叛变
      rebellionRisk: 0.1 // 10%叛变风险
    }
  }
};
```

### 3.2 资源产出

```javascript
const cityProduction = {
  // 基础产出
  base: {
    gold: 500,
    food: 400,
    wood: 300,
    iron: 200,
    recruitment: 50
  },
  
  // 建筑加成
  buildingBonus: {
    gold: 200,    // 市场+200
    food: 100,    // 农田+100
    wood: 50,     // 伐木场+50
    iron: 50,     // 矿场+50
    recruitment: 20 // 兵营+20
  },
  
  // 繁荣度加成
  prosperityBonus: {
    multiplier: 1.7 // 70%繁荣度 = 1.7倍
  },
  
  // 最终产出
  final: {
    gold: Math.floor((500 + 200) * 1.7),
    food: Math.floor((400 + 100) * 1.7),
    wood: Math.floor((300 + 50) * 1.7),
    iron: Math.floor((200 + 50) * 1.7),
    recruitment: Math.floor((50 + 20) * 1.7)
  }
};
```

## 四、建筑系统

### 4.1 建筑类型

#### 经济建筑

**市场**
```javascript
{
  id: "building_market",
  name: "市场",
  type: "economic",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 1000,
    wood: 500,
    buildTime: 2 // 2回合
  },
  
  effects: {
    goldProduction: 200,
    prosperityBonus: 10
  },
  
  upgradeCost: {
    gold: 2000,
    wood: 1000,
    buildTime: 3
  },
  
  upgradeEffects: {
    goldProduction: 300,
    prosperityBonus: 15
  }
}
```

**农田**
```javascript
{
  id: "building_farm",
  name: "农田",
  type: "economic",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 800,
    wood: 400,
    buildTime: 2
  },
  
  effects: {
    foodProduction: 100,
    populationGrowth: 0.01
  }
}
```

#### 军事建筑

**兵营**
```javascript
{
  id: "building_barracks",
  name: "兵营",
  type: "military",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 1500,
    wood: 800,
    iron: 500,
    buildTime: 3
  },
  
  effects: {
    recruitmentBonus: 20,
    trainingSpeed: 0.1, // 训练速度+10%
    troopQuality: 5 // 部队质量+5
  }
}
```

**城墙**
```javascript
{
  id: "building_wall",
  name: "城墙",
  type: "military",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 2000,
    wood: 1000,
    iron: 800,
    buildTime: 4
  },
  
  effects: {
    defenseBonus: 30,
    garrisonCapacity: 500 // 驻军容量+500
  }
}
```

**箭塔**
```javascript
{
  id: "building_tower",
  name: "箭塔",
  type: "military",
  level: 1,
  maxLevel: 3,
  
  cost: {
    gold: 1000,
    wood: 600,
    iron: 400,
    buildTime: 2
  },
  
  effects: {
    defenseBonus: 20,
    rangedAttack: 50 // 远程攻击力
  }
}
```

#### 文化建筑

**学府**
```javascript
{
  id: "building_academy",
  name: "学府",
  type: "cultural",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 2000,
    wood: 1000,
    buildTime: 4
  },
  
  effects: {
    culturalValue: 20,
    researchSpeed: 0.1, // 科技研究+10%
    talentAttraction: 5 // 人才吸引力+5
  }
}
```

**寺庙**
```javascript
{
  id: "building_temple",
  name: "寺庙",
  type: "cultural",
  level: 1,
  maxLevel: 3,
  
  cost: {
    gold: 1500,
    wood: 800,
    buildTime: 3
  },
  
  effects: {
    loyaltyBonus: 10,
    culturalValue: 15,
    populationHappiness: 5
  }
}
```

#### 资源建筑

**伐木场**
```javascript
{
  id: "building_lumbermill",
  name: "伐木场",
  type: "resource",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 600,
    buildTime: 2
  },
  
  effects: {
    woodProduction: 50
  }
}
```

**矿场**
```javascript
{
  id: "building_mine",
  name: "矿场",
  type: "resource",
  level: 1,
  maxLevel: 5,
  
  cost: {
    gold: 800,
    wood: 400,
    buildTime: 2
  },
  
  effects: {
    ironProduction: 50
  }
}
```

### 4.2 建筑队列

```javascript
const buildingQueue = {
  cityId: "city_luoyang",
  queue: [
    {
      buildingId: "building_market",
      action: "build", // build, upgrade, demolish
      startTime: "2026-02-09 10:00:00",
      endTime: "2026-02-09 12:00:00",
      remainingTime: 7200, // 秒
      cost: {
        gold: 1000,
        wood: 500
      }
    },
    {
      buildingId: "building_barracks",
      action: "upgrade",
      level: 2,
      startTime: "2026-02-09 12:00:00",
      endTime: "2026-02-09 15:00:00",
      remainingTime: 18000
    }
  ],
  maxQueueSize: 3 // 最多3个建筑任务
};
```

## 五、城市占领系统

### 5.1 占领条件

```javascript
const captureConditions = {
  // 军事占领
  military: {
    method: "siege", // 围城
    requirements: {
      defeatGarrison: true, // 击败驻军
      breakDefense: true, // 突破防御
      minTroops: 1000 // 最少1000兵力
    },
    duration: 3, // 围城3回合
    loyaltyPenalty: -30 // 忠诚度-30
  },
  
  // 和平接管
  peaceful: {
    method: "diplomacy",
    requirements: {
      loyalty: 20, // 忠诚度低于20
      influence: 80, // 影响力高于80
      noGarrison: true // 无驻军
    },
    duration: 1,
    loyaltyPenalty: -10
  },
  
  // 叛变
  rebellion: {
    method: "revolt",
    trigger: {
      loyalty: 30, // 忠诚度低于30
      prosperity: 40, // 繁荣度低于40
      duration: 5 // 持续5回合
    },
    chance: 0.3 // 30%概率
  }
};
```

### 5.2 占领流程

```javascript
class CityCapture {
  /**
   * 发起围城
   */
  startSiege(attacker, city) {
    // 检查条件
    if (attacker.troops < city.defense) {
      return { success: false, reason: '兵力不足' };
    }
    
    // 创建围城状态
    city.siegeStatus = {
      attacker: attacker.id,
      startTurn: game.currentTurn,
      duration: 3,
      progress: 0
    };
    
    return { success: true };
  }
  
  /**
   * 围城进度
   */
  updateSiege(city) {
    if (!city.siegeStatus) return;
    
    const turnsElapsed = game.currentTurn - city.siegeStatus.startTurn;
    city.siegeStatus.progress = turnsElapsed / city.siegeStatus.duration;
    
    // 围城期间效果
    city.loyalty -= 5; // 每回合-5忠诚
    city.prosperity -= 10; // 每回合-10繁荣
    
    // 围城完成
    if (turnsElapsed >= city.siegeStatus.duration) {
      this.completeCapture(city);
    }
  }
  
  /**
   * 完成占领
   */
  completeCapture(city) {
    const attacker = game.getPlayer(city.siegeStatus.attacker);
    
    // 转移所有权
    city.owner = attacker.id;
    city.loyalty = 50; // 重置忠诚度
    city.siegeStatus = null;
    
    // 奖励
    attacker.addPrestige(city.strategicValue);
    
    // 事件通知
    game.triggerEvent('city_captured', {
      city: city,
      attacker: attacker
    });
  }
}
```

## 六、城市管理

### 6.1 驻军系统

```javascript
const garrisonSystem = {
  cityId: "city_luoyang",
  
  // 驻军部队
  garrison: [
    {
      characterId: "char_guan_yu",
      troops: [
        { troopId: "troop_heavy_infantry", count: 500 },
        { troopId: "troop_cavalry", count: 300 }
      ]
    }
  ],
  
  // 驻军容量
  capacity: {
    base: 1000,
    buildingBonus: 500, // 兵营+500
    total: 1500
  },
  
  // 驻军效果
  effects: {
    defenseBonus: 50, // 防御+50
    loyaltyBonus: 10, // 忠诚+10
    maintenanceCost: 100 // 维护费用
  }
};
```

### 6.2 太守系统

```javascript
const governorSystem = {
  cityId: "city_luoyang",
  
  // 太守
  governor: {
    characterId: "char_cao_cao",
    appointedTurn: 1,
    
    // 太守加成
    bonuses: {
      // 基于太守属性
      goldBonus: 0.2, // 政治/10 = 20%
      loyaltyBonus: 0.15, // 魅力/10 = 15%
      defenseBonus: 0.1, // 统帅/10 = 10%
      
      // 基于太守技能
      specialBonus: {
        type: "economic",
        value: 0.3 // 经济技能+30%
      }
    }
  },
  
  // 太守任期
  term: {
    duration: 12, // 12回合
    remainingTurns: 10
  }
};
```

### 6.3 城市事件

```javascript
const cityEvents = [
  {
    id: "event_plague",
    name: "瘟疫爆发",
    type: "disaster",
    probability: 0.05,
    effects: {
      population: -0.2, // 人口-20%
      prosperity: -30,
      loyalty: -10
    },
    duration: 3,
    solution: {
      cost: { gold: 5000 },
      effect: "减轻50%损失"
    }
  },
  {
    id: "event_harvest",
    name: "丰收",
    type: "blessing",
    probability: 0.1,
    effects: {
      food: 1000,
      prosperity: 10,
      loyalty: 5
    },
    duration: 1
  },
  {
    id: "event_merchant",
    name: "商队到访",
    type: "opportunity",
    probability: 0.15,
    effects: {
      gold: 500,
      prosperity: 5
    },
    choice: {
      accept: { gold: 500, prosperity: 5 },
      reject: { loyalty: 5 }
    }
  }
];
```

## 七、城市UI设计

### 7.1 城市详情界面

```
┌─────────────────────────────────────────┐
│  洛阳                            [X]    │
│  大城 | 司隶 | 汉室                     │
├─────────────────────────────────────────┤
│  [概览] [建筑] [驻军] [生产]           │
├─────────────────────────────────────────┤
│                                         │
│  基础信息:                              │
│  • 人口: 100,000 / 150,000             │
│  • 繁荣度: 90 / 100                    │
│  • 防御力: 100                         │
│  • 忠诚度: 80 / 100                    │
│                                         │
│  资源产出 (每回合):                     │
│  • 💰 金币: +1,000                     │
│  • 🌾 粮食: +800                       │
│  • 🪵 木材: +500                       │
│  • ⛏️ 铁矿: +300                       │
│  • ⚔️ 兵力: +100                       │
│                                         │
│  太守: 曹操                             │
│  驻军: 关羽 (800人)                    │
│                                         │
│  [任命太守] [调动驻军] [建设]          │
│                                         │
└─────────────────────────────────────────┘
```

### 7.2 建筑界面

```
┌─────────────────────────────────────────┐
│  洛阳 - 建筑                            │
├─────────────────────────────────────────┤
│  建筑槽位: 5 / 8                        │
│                                         │
│  已建建筑:                              │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 市场 │ │ 兵营 │ │ 城墙 │           │
│  │ Lv.3 │ │ Lv.2 │ │ Lv.4 │           │
│  └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐                    │
│  │ 农田 │ │ 学府 │                    │
│  │ Lv.2 │ │ Lv.1 │                    │
│  └──────┘ └──────┘                    │
│                                         │
│  可建建筑:                              │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 箭塔 │ │ 矿场 │ │ 寺庙 │           │
│  │ 1000 │ │ 800  │ │ 1500 │           │
│  └──────┘ └──────┘ └──────┘           │
│                                         │
│  建筑队列:                              │
│  • 市场升级 Lv.4 (剩余2回合)           │
│                                         │
└─────────────────────────────────────────┘
```

### 7.3 大地图城市标记

```
大地图上的城市显示:

🏛️ 洛阳 (大城)
   • 所属: 汉室
   • 防御: 100
   • 驻军: 1000

🏘️ 徐州 (中城)
   • 所属: 刘备
   • 防御: 70
   • 驻军: 500

🏠 小沛 (小城)
   • 所属: 吕布
   • 防御: 40
   • 驻军: 200

⛰️ 虎牢关 (关隘)
   • 所属: 董卓
   • 防御: 150
   • 驻军: 800
```

## 八、与其他系统的关联

### 8.1 与势力系统

```javascript
// 城市影响势力实力
function calculateFactionPower(faction) {
  const cities = faction.getCities();
  
  return {
    territory: cities.length,
    population: cities.reduce((sum, c) => sum + c.population, 0),
    income: cities.reduce((sum, c) => sum + c.production.gold, 0),
    military: cities.reduce((sum, c) => sum + c.garrison.length, 0)
  };
}
```

### 8.2 与战斗系统

```javascript
// 攻城战
function siegeBattle(attacker, city) {
  const defender = city.garrison;
  
  // 防御方优势
  const defenseBonus = city.defense + city.buildings.wall.bonus;
  
  // 战斗
  const result = combat.battle(attacker, defender, {
    terrain: 'siege',
    defenseBonus: defenseBonus
  });
  
  if (result.attackerWin) {
    captureCity(attacker, city);
  }
}
```

### 8.3 与任务系统

```javascript
// 占领城市触发任务进度
function onCityCapture(player, city) {
  questSystem.updateProgress(player, 'capture_city', {
    cityId: city.id,
    cityType: city.type
  });
}
```

## 九、里程碑规划

### 里程碑1 (当前)
- ❌ 据点系统未实现
- 📝 完成系统设计文档

### 里程碑2
- ✅ 实现基础城市系统
- ✅ 城市数据和地图
- ✅ 基础建筑系统
- ✅ 城市占领机制

### 里程碑3
- ✅ 完整建筑系统
- ✅ 太守和驻军系统
- ✅ 城市事件系统
- ✅ 高级管理功能

## 十、相关文档

- [11-FACTION_SYSTEM.md](./11-FACTION_SYSTEM.md) - 势力系统
- [14-PLAYER_SYSTEM.md](./14-PLAYER_SYSTEM.md) - 玩家系统
- [16-EVENT_SYSTEM.md](./16-EVENT_SYSTEM.md) - 事件系统
- [17-QUEST_SYSTEM.md](./17-QUEST_SYSTEM.md) - 任务系统
- [18-COMBAT_SYSTEM.md](./18-COMBAT_SYSTEM.md) - 战斗系统
- [96-MAP_ART_STRATEGY.md](../../base/96-MAP_ART_STRATEGY.md) - 地图美术策略

---

**文档状态**: 📝 设计中  
**下一步**: 设计城市数据结构和地图布局
