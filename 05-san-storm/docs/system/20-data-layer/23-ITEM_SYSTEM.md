# 物品系统

## 📋 文档概述

本文档定义游戏中的所有物品类型、属性和获取方式。所有物品以**卡牌形式**展现。

**最后更新**: 2026-02-09  
**文档版本**: v2.0.0  
**状态**: 🔄 整理中

---

## 📋 数据持久化

**赛季数据**: 🔄 每赛季重置
- 所有装备和道具在赛季结束时清空
- 下个赛季需要重新获取

**跨赛季保留**:
- ❌ 装备不保留
- ❌ 道具不保留
- ✅ 物品图鉴记录保留（见24-ACCOUNT_SYSTEM.md）

---

## 🎴 物品分类

### 1. 装备类 (Equipment)

#### 1.1 武器 (Weapon) ⚔️

**属性加成**:
- 物理攻击: +0.5 ~ +3.0
- 法术攻击: +0.5 ~ +3.0
- 特殊效果: 暴击率、吸血等

**示例 - 青龙偃月刀**:
```javascript
{
  id: 'item_weapon_0001',
  name: '青龙偃月刀',
  type: 'weapon',
  rarity: 'legendary',
  
  attributes: {
    physicalAttack: 2.5,  // +2.5物理攻击
    critRate: 0.1,        // +10%暴击率
  },
  
  specialEffect: {
    name: '青龙之怒',
    description: '攻击时有20%概率造成1.5倍伤害',
    trigger: 'onAttack',
    probability: 0.2,
    effect: { damageMultiplier: 1.5 }
  },
  
  requirements: {
    combat: 9.0,  // 需要武力≥9.0
  }
}
```

---

#### 1.2 防具 (Armor) 🛡️

**属性加成**:
- 物理防御: +0.5 ~ +3.0
- 法术防御: +0.5 ~ +3.0
- 生命值: +10 ~ +50

**示例 - 白银狮子甲**:
```javascript
{
  id: 'item_armor_0001',
  name: '白银狮子甲',
  type: 'armor',
  rarity: 'epic',
  
  attributes: {
    physicalDefense: 2.0,  // +2.0物理防御
    hp: 30,                // +30生命值
  },
  
  specialEffect: {
    name: '狮子守护',
    description: '受到致命伤害时，有30%概率保留1点生命',
    trigger: 'onLethalDamage',
    probability: 0.3,
  }
}
```

---

#### 1.3 辅助 (Accessory) ✨

**包含类型**:
- 饰品（戒指、项链、玉佩等）
- 座驾（赤兔马、的卢等）
- 其他辅助道具

**属性加成**:
- 各种属性小幅加成
- 移动力加成（座驾类）
- 特殊效果: 经验加成、掉落加成等

**示例1 - 玉玺（饰品）**:
```javascript
{
  id: 'item_accessory_0001',
  name: '玉玺',
  type: 'accessory',
  category: 'jewelry',  // 饰品
  rarity: 'legendary',
  
  attributes: {
    charisma: 1.5,    // +1.5魅力
    politics: 1.0,    // +1.0政治
  },
  
  specialEffect: {
    name: '天命所归',
    description: '招募武将成功率+20%',
    effect: { recruitBonus: 0.2 }
  }
}
```

**示例2 - 赤兔马（座驾）**:
```javascript
{
  id: 'item_accessory_0002',
  name: '赤兔马',
  type: 'accessory',
  category: 'mount',  // 座驾
  rarity: 'legendary',
  
  attributes: {
    movement: 3,      // +3移动力
    speed: 2.0,       // +2.0速度
  },
  
  specialEffect: {
    name: '赤兔冲锋',
    description: '移动后攻击伤害+50%',
    trigger: 'afterMove',
    effect: { damageBonus: 0.5 }
  },
  
  requirements: {
    combat: 8.0,  // 需要武力≥8.0
  }
}
```

---

### 2. 称号类 (Title) 👑

**作用**:
- 改变玩家称号显示
- 提供属性加成
- 提供特殊效果

**示例 - 万人敌**:
```javascript
{
  id: 'item_title_0001',
  name: '万人敌',
  type: 'title',
  rarity: 'epic',
  
  displayName: '【万人敌】',  // 显示在角色名前
  
  attributes: {
    combat: 1.0,      // +1.0武力
    courage: 1.0,     // +1.0勇气
  },
  
  specialEffect: {
    name: '威震敌胆',
    description: '战斗开始时，敌方士气-1.0',
    trigger: 'battleStart',
    effect: { enemyMoraleDebuff: 1.0 }
  },
  
  requirements: {
    combat: 9.0,      // 需要武力≥9.0
    courage: 9.0,     // 需要勇气≥9.0
  }
}
```

---

### 3. 成就类 (Achievement) 🏆

**作用**:
- 记录玩家成就
- 提供永久属性加成
- 解锁特殊内容

**数据持久化**: ✅ 跨赛季永久保留（见24-ACCOUNT_SYSTEM.md）

**示例 - 首杀成就**:
```javascript
{
  id: 'item_achievement_0001',
  name: '首杀',
  type: 'achievement',
  category: 'combat',  // 战斗类成就
  rarity: 'common',
  
  description: '击杀第一个敌人',
  
  reward: {
    achievementPoints: 10,  // 成就点数
    attributes: {
      combat: 0.1,  // 永久+0.1武力
    }
  },
  
  unlockCondition: {
    type: 'killEnemy',
    count: 1,
  }
}
```

**示例 - 百人斩**:
```javascript
{
  id: 'item_achievement_0002',
  name: '百人斩',
  type: 'achievement',
  category: 'combat',
  rarity: 'rare',
  
  description: '累计击杀100名敌人',
  
  reward: {
    achievementPoints: 50,
    attributes: {
      combat: 0.5,
      courage: 0.3,
    },
    title: 'item_title_0010',  // 解锁称号
  },
  
  unlockCondition: {
    type: 'killEnemy',
    count: 100,
  }
}
```

---

### 4. 角色类 (Character) 👤

**作用**:
- 武将卡牌
- 可上阵参与战斗
- 可装备物品

**数据持久化**: 🔄 赛季重置，图鉴记录保留

**示例 - 关羽武将卡**:
```javascript
{
  id: 'item_character_0001',
  name: '关羽',
  type: 'character',
  rarity: 'legendary',
  
  // 基础属性（来自21-CHARACTER_SYSTEM.md）
  baseAttributes: {
    luck: 7.0,
    courage: 9.6,
    command: 9.0,
    combat: 9.7,
    intelligence: 7.6,
    politics: 6.5,
    charisma: 8.5,
  },
  
  // 技能
  skills: ['skill_001', 'skill_002'],
  
  // 羁绊
  bonds: ['bond_001'],
  
  // 装备槽位（8个，比玩家多1个部队槽）
  equipmentSlots: {
    weapon: null,
    armor: null,
    accessory1: null,
    accessory2: null,
    title: null,
    troop1: null,  // 部队槽1
    troop2: null,  // 部队槽2（武将专属）
  },
  
  // 获取方式
  obtainMethods: ['抽卡', '事件奖励'],
}
```

**玩家角色 vs 武将卡**:

| 特性 | 玩家角色 | 武将卡 |
|------|---------|--------|
| 装备槽数 | 7个 | 8个 |
| 部队槽数 | 1个 | 2个 |
| 属性 | 可成长 | 固定 |
| 获取方式 | 创建角色 | 抽卡/事件 |
| 数量 | 1个 | 可收集多个 |

---

### 5. 部队类 (Troop) 🪖

**核心设计**:
- 部队是物品卡牌
- 角色装备部队后才能带兵
- 每个部队有独立属性

**详细说明**: 见 [22-TROOP_SYSTEM.md](./22-TROOP_SYSTEM.md)

**数据持久化**: 🔄 部分保留
- ✅ 紫色/橙色部队卡跨赛季保留
- ❌ 白色/蓝色部队卡赛季结束清空

**示例 - 无当飞军**:
```javascript
{
  id: 'item_troop_0001',
  name: '无当飞军',
  type: 'troop',
  category: 'infantry',  // 步兵
  rarity: 'epic',
  
  // 部队基础属性
  troopAttributes: {
    morale: 9.0,          // 士气9.0（精锐）
    attack: 7.5,          // 攻击力7.5
    defense: 8.0,         // 防御力8.0
    movement: 2,          // 移动力2
    capacity: 500,        // 兵力上限500
  },
  
  // 特殊技能
  specialSkill: {
    name: '山地作战',
    description: '在山地地形时，防御力+2.0',
    trigger: 'onMountainTerrain',
    effect: { defenseBonus: 2.0 }
  },
  
  // 装备需求
  requirements: {
    command: 7.0,  // 需要统率≥7.0才能装备
  },
  
  // 维护成本
  maintenance: {
    gold: 50,      // 每回合消耗50金币
    food: 100,     // 每回合消耗100粮食
  }
}
```

---

## 🎯 装备系统

### 装备槽位

**玩家角色**（7个装备槽）:
```javascript
const playerEquipment = {
  weapon: null,      // 武器槽
  armor: null,       // 防具槽
  accessory1: null,  // 辅助槽1（饰品或座驾）
  accessory2: null,  // 辅助槽2（饰品或座驾）
  title: null,       // 称号槽
  troop: null,       // 部队槽（1个）
};
```

**历史武将角色**（8个装备槽）:
```javascript
const heroEquipment = {
  weapon: null,      // 武器槽
  armor: null,       // 防具槽
  accessory1: null,  // 辅助槽1
  accessory2: null,  // 辅助槽2
  title: null,       // 称号槽
  troop1: null,      // 部队槽1
  troop2: null,      // 部队槽2（武将专属）
};
```

### 装备规则

1. **唯一性** - 每个槽位只能装备一个道具
2. **需求检查** - 装备前检查角色属性是否满足
3. **属性叠加** - 装备属性直接加到角色属性上
4. **部队必需** - 没有装备部队卡，角色无法参与战斗
5. **武将优势** - 历史武将可装备2支部队，战斗力更强

---

## 💎 稀有度系统

| 稀有度 | 颜色 | 代码 | 掉落率 | 属性加成范围 |
|--------|------|------|--------|-------------|
| 普通 | 灰色 | #9E9E9E | 60% | +0.5 ~ +1.0 |
| 稀有 | 蓝色 | #2196F3 | 25% | +1.0 ~ +1.5 |
| 史诗 | 紫色 | #9C27B0 | 10% | +1.5 ~ +2.5 |
| 传说 | 金色 | #FFD700 | 5% | +2.5 ~ +3.0 |

---

## 📊 数据结构

### 物品卡牌基础结构

```javascript
const itemCard = {
  // 基础信息
  id: 'item_weapon_0001',
  name: '青龙偃月刀',
  type: 'weapon',  // weapon, armor, accessory, title, achievement, character, troop
  category: 'melee',  // 细分类别
  rarity: 'legendary',  // common, rare, epic, legendary
  
  // 描述
  description: '关羽的专属武器，削铁如泥',
  
  // 属性加成（装备类）
  attributes: {
    physicalAttack: 2.5,
    critRate: 0.1,
  },
  
  // 部队属性（部队类）
  troopAttributes: {
    morale: 9.0,
    attack: 7.5,
    defense: 8.0,
    movement: 2,
    capacity: 500,
  },
  
  // 特殊效果
  specialEffect: {
    name: '青龙之怒',
    description: '攻击时有20%概率造成1.5倍伤害',
    trigger: 'onAttack',
    probability: 0.2,
    effect: { damageMultiplier: 1.5 }
  },
  
  // 装备需求
  requirements: {
    combat: 9.0,
    command: 7.0,
  },
  
  // 维护成本（部队类）
  maintenance: {
    gold: 50,
    food: 100,
  },
  
  // 获取方式
  obtainMethods: ['抽卡', '事件奖励', '商店购买'],
};
```

---

## 🎨 UI 设计

### 卡牌展示

```
┌─────────────────────────────┐
│  ⭐⭐⭐⭐⭐ [传说]          │
│                             │
│     [卡牌图片]              │
│                             │
│  【青龙偃月刀】             │
│  ━━━━━━━━━━━━━━━━━━━━━   │
│  ⚔️ 武器 · 近战             │
│                             │
│  物理攻击: +2.5             │
│  暴击率: +10%               │
│                             │
│  💡 青龙之怒                │
│  攻击时有20%概率            │
│  造成1.5倍伤害              │
│                             │
│  需求: 武力≥9.0             │
└─────────────────────────────┘
```

---

## 💡 设计理念

### 1. 卡牌化优势

- ✅ **统一管理** - 所有物品都是卡牌，易于管理
- ✅ **收集乐趣** - 玩家有收集卡牌的动力
- ✅ **抽卡系统** - 可以做抽卡玩法，增加付费点
- ✅ **灵活搭配** - 不同卡牌组合产生不同效果

### 2. 数值压缩

- ✅ **统一范围** - 所有属性0.0-10.0
- ✅ **易于理解** - 玩家容易判断强弱
- ✅ **避免膨胀** - 不会出现数值爆炸

### 3. 装备槽位差异

| 角色类型 | 装备槽数 | 部队槽数 | 说明 |
|---------|---------|---------|------|
| 玩家角色 | 7个 | 1个 | 基础战斗力 |
| 历史武将 | 8个 | 2个 | 更强战斗力 |

### 4. 跨赛季保留

- ✅ **成就** - 永久保留，提供长期目标
- ✅ **高级部队卡** - 紫色/橙色保留，奖励投入
- ❌ **装备** - 赛季重置，保持新鲜感
- ❌ **武将卡** - 赛季重置，但图鉴记录保留

---

## 📝 物品类型总结

| 类型 | 编号 | 说明 | 数据持久化 |
|------|------|------|-----------|
| 1. 装备类 | 1.1-1.3 | 武器、防具、辅助（含座驾） | 🔄 赛季重置 |
| 2. 称号类 | 2 | 改变称号和提供加成 | 🔄 赛季重置 |
| 3. 成就类 | 3 | 记录成就，永久加成 | ✅ 永久保留 |
| 4. 角色类 | 4 | 武将卡牌 | 🔄 赛季重置 |
| 5. 部队类 | 5 | 部队卡牌 | 🔄 部分保留 |

---

## 🔗 相关文档

- **[21-CHARACTER_SYSTEM.md](./21-CHARACTER_SYSTEM.md)** - 角色系统（武将数据）
- **[22-TROOP_SYSTEM.md](./22-TROOP_SYSTEM.md)** - 部队系统（详细说明）
- **[24-ACCOUNT_SYSTEM.md](./24-ACCOUNT_SYSTEM.md)** - 账号系统（成就、称号）（待创建）
- **[18-COMBAT_SYSTEM.md](../10-core-system/18-COMBAT_SYSTEM.md)** - 战斗系统（上阵规则）

---

**文档维护者**: Kiro AI  
**创建日期**: 2026-02-09  
**文档版本**: v2.0.0
