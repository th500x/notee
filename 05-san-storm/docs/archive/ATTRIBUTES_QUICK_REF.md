# 角色属性点系统 - 快速参考

## 📋 文档概述

本文档详细说明游戏中所有角色（玩家角色和NPC武将）的属性点分配规则，包括总属性点计算、类型分配、稀有度影响、阶段修正等核心机制。

**最后更新**：2026-02-07  
**文档版本**：v2.0.0

---

## 🎯 核心属性

### 7大基础属性

| 属性 | 英文 | 图标 | 说明 | 影响 |
|------|------|------|------|------|
| 运气 | luck | 🎲 | 随机事件成功率 | 闪避率、暴击率、掉落率、事件触发 |
| 勇气 | courage | 💪 | 战斗意志 | 伤害加成、暴击率、士气恢复、抗压能力 |
| 统率 | command | ⚔️ | 指挥能力 | 防御力、部队上限、战术效果 |
| 武力 | combat | 🗡️ | 战斗能力 | 基础伤害、防御力 |
| 智力 | intelligence | 📚 | 谋略能力 | 计谋伤害、计谋成功率、科技研发 |
| 政治 | politics | 🏛️ | 内政能力 | 资源产出、外交效果 |
| 魅力 | charisma | ✨ | 个人魅力 | 招募成功率、忠诚度 |

### 特殊属性

| 属性 | 英文 | 图标 | 说明 | 范围 |
|------|------|------|------|------|
| 奋战值 | morale | 🔥 | 战斗状态 | 0-100% |

**奋战值说明**：
- 初始值：50%（中立状态）
- 提升：连胜、获得奖励、完成任务
- 降低：连败、受伤、资源不足
- 影响：战斗力、技能效果、属性加成

---

## 📊 总属性点计算

### 基础公式

```
总属性点 = 基础点数 × 阶段修正
```

### 基础点数（按稀有度和类型）

| 稀有度 | 英文 | 图标 | military/strategist | balanced |
|--------|------|------|---------------------|----------|
| 核心 | core | 🌟 | 50-60 | 52-62 |
| 传奇 | legendary | 💎 | 56-60 | 58-62 |
| 史诗 | epic | 💜 | 52-56 | 54-58 |
| 稀有 | rare | 💙 | 48-52 | 50-54 |
| 普通 | common | ⚪ | 44-48 | 46-50 |

**说明**：
- **balanced（文武双全）** 类型总属性点比其他类型高2点
- **military（武官）** 和 **strategist（军师）** 类型总属性点相同
- 范围表示该稀有度的属性点浮动区间

### 阶段修正

| 阶段 | 英文 | 修正 | 说明 |
|------|------|------|------|
| 茅庐 | early | -5% | 年轻时期，尚未成熟 |
| 巅峰 | peak | 100% | 角色最强时期，无修正 |
| 不惑 | late | -10% | 年老时期，体力下降 |
| 卒 | dead | -20% | 已故，实力大幅下降 |

**计算示例**：

```javascript
// 示例1：传奇武将，巅峰期，military类型
基础点数 = 58 (56-60范围内)
阶段修正 = 100%
总属性点 = 58 × 100% = 58.0

// 示例2：史诗武将，茅庐期，balanced类型
基础点数 = 55 (54-58范围内)
阶段修正 = 95% (-5%)
总属性点 = 55 × 95% = 52.25

// 示例3：史诗武将，不惑期，strategist类型
基础点数 = 54 (52-56范围内)
阶段修正 = 90% (-10%)
总属性点 = 54 × 90% = 48.6

// 示例4：史诗武将，卒期，military类型
基础点数 = 54 (52-56范围内)
阶段修正 = 80% (-20%)
总属性点 = 54 × 80% = 43.2
```

---

## 🎭 角色类型与属性分配

### 三种角色类型

| 类型 | 英文 | 特点 | 偏重属性 | 代表人物 |
|------|------|------|----------|----------|
| 武官 | military | 武力型，擅长战斗 | command + combat | 关羽、张飞、吕布、赵云 |
| 军师 | strategist | 智力型，擅长谋略 | intelligence + politics + charisma | 诸葛亮、郭嘉、荀彧、贾诩 |
| 文武双全 | balanced | 全能型，文武兼备 | 均衡发展 | 曹操、周瑜、陆逊、司马懿 |

### 属性分配规则

#### 1. Military（武官型）

**属性特点**：
- ⚔️ **统率** - 高
- 🗡️ **武力** - 高
- 📚 **智力** - 中低
- 🏛️ **政治** - 低
- ✨ **魅力** - 中
- 🎲 **运气** - 中
- 💪 **勇气** - 高

#### 2. Strategist（军师型）

**属性特点**：
- 📚 **智力** - 高
- 🏛️ **政治** - 高
- ✨ **魅力** - 高
- ⚔️ **统率** - 中
- 🗡️ **武力** - 低
- 🎲 **运气** - 中
- 💪 **勇气** - 中低

#### 3. Balanced（文武双全）

**核心规则**：
```
无严格比例要求，属性较为均衡
总属性点比其他类型高2点
```

**属性特点**：
- 所有属性较为均衡
- 没有明显短板
- 总属性点更高（+2点优势）

**示例：曹操（传奇，巅峰）**
```javascript
{
  luck: 7.5,
  courage: 8.0,
  command: 9.6,
  combat: 7.8,
  intelligence: 9.0,
  politics: 9.2,
  charisma: 9.6,
  
  // 总计
  total: 60.7 // 比同稀有度的military/strategist高2点
}
```

---

## 🎮 玩家角色属性系统

### 玩家角色特点

**与NPC武将的区别**：
- ✅ **可成长** - 可以升级提升属性
- ✅ **可晋升** - 可以晋升官职获得加成
- ✅ **可装备** - 可以装备道具提升属性
- ✅ **初始较弱** - 初始属性点较低（44-48点）

### 玩家角色属性范围

**稀有度固定为 common（普通）**：

| 类型 | 总属性点范围 | 说明 |
|------|-------------|------|
| military | 44-48 | 武官型玩家 |
| strategist | 44-48 | 军师型玩家 |
| balanced | 46-50 | 文武双全型玩家 |

**阶段固定为 peak（巅峰）**：
- 玩家角色始终处于巅峰期
- 无阶段修正（100%）

### 玩家角色创建

**3次随机 × 3个方案 = 9个方案**：

详见 `CHARACTER_CREATION_SYSTEM.md` 中的完整说明。

**方案类型**：

| 方案 | 类型 | 偏高属性 | 总属性点 |
|------|------|---------|---------|
| A型 | balanced | 运气+勇气 | 46-50 |
| B型 | military | 统率+武力 | 44-48 |
| C型 | strategist | 智力+政治+魅力 | 44-48 |

---

## 📈 属性成长系统

### 玩家角色成长

**升级成长**：
- 每升1级：随机获得 0.1-0.3 属性点
- 属性点可自由分配
- 最高等级：100级
- 最大成长：10-30点

**官职加成**：
- 不同官职提供不同属性加成
- 详见 `POSITION_SYSTEM.md`

**装备加成**：
- 武器、防具、饰品提供属性加成
- 详见 `ITEM_CARD_SYSTEM.md`（待创建）

### NPC武将成长

**固定属性**：
- NPC武将属性固定，不会成长
- 但可以通过装备、官职获得加成

---

## 🔢 属性计算公式

### 最终属性计算

```javascript
最终属性 = 基础属性 + 成长属性 + 官职加成 + 装备加成 + 临时加成
```

**示例：玩家角色**
```javascript
{
  // 基础属性（创建时）
  baseCommand: 6.8,
  
  // 成长属性（升级获得）
  growthCommand: 2.5, // 50级 × 0.05/级
  
  // 官职加成（大将军）
  positionCommand: 3.0, // +30%
  
  // 装备加成（青龙偃月刀）
  equipmentCommand: 1.5,
  
  // 临时加成（技能、buff）
  tempCommand: 2.0,
  
  // 最终统率
  finalCommand: 6.8 + 2.5 + 3.0 + 1.5 + 2.0 = 15.8
}
```

---

## 📋 属性验证工具

### 验证函数

```javascript
/**
 * 验证角色属性是否符合规则
 * @param {Object} character - 角色对象
 * @returns {Object} - 验证结果
 */
function validateCharacterAttributes(character) {
  const {
    rarity,
    stage,
    characterType,
    luck,
    courage,
    command,
    combat,
    intelligence,
    politics,
    charisma,
  } = character;
  
  // 1. 计算总属性点
  const total = luck + courage + command + combat + intelligence + politics + charisma;
  
  // 2. 获取期望范围
  const expectedRange = getExpectedAttributeRange(rarity, stage, characterType);
  
  // 3. 验证总属性点
  if (total < expectedRange.min || total > expectedRange.max) {
    return {
      valid: false,
      message: `总属性点 ${total} 不在期望范围 ${expectedRange.min}-${expectedRange.max} 内`,
    };
  }
  
  // 4. 验证类型分配
  if (characterType === 'military') {
    const militarySum = command + combat;
    const intellectSum = intelligence + politics + charisma;
    const ratio = militarySum / intellectSum;
    
    if (ratio < 1.2 || ratio > 1.5) {
      return {
        valid: false,
        message: `武官型属性比例 ${ratio.toFixed(2)} 不在 1.2-1.5 范围内`,
      };
    }
  } else if (characterType === 'strategist') {
    const intellectSum = intelligence + politics + charisma;
    const militarySum = command + combat;
    const ratio = intellectSum / militarySum;
    
    if (ratio < 1.2 || ratio > 1.5) {
      return {
        valid: false,
        message: `军师型属性比例 ${ratio.toFixed(2)} 不在 1.2-1.5 范围内`,
      };
    }
  }
  
  return {
    valid: true,
    message: '属性验证通过',
    total: total,
  };
}

/**
 * 获取期望属性范围
 */
function getExpectedAttributeRange(rarity, stage, characterType) {
  // 基础范围
  const baseRanges = {
    core: { military: [50, 60], strategist: [50, 60], balanced: [52, 62] },
    legendary: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
    epic: { military: [52, 56], strategist: [52, 56], balanced: [54, 58] },
    rare: { military: [48, 52], strategist: [48, 52], balanced: [50, 54] },
    common: { military: [44, 48], strategist: [44, 48], balanced: [46, 50] },
  };
  
  // 阶段修正
  const stageModifiers = {
    peak: 1.0,
    early: 0.95,
    late: 0.90,
  };
  
  const [min, max] = baseRanges[rarity][characterType];
  const modifier = stageModifiers[stage];
  
  return {
    min: min * modifier,
    max: max * modifier,
  };
}
```

### 使用示例

```javascript
// 验证关羽的属性
const guanyu = {
  name: '关羽',
  rarity: 'legendary',
  stage: 'peak',
  characterType: 'military',
  luck: 7.0,
  courage: 9.6,
  command: 9.0,
  combat: 9.7,
  intelligence: 7.6,
  politics: 6.5,
  charisma: 8.5,
};

const result = validateCharacterAttributes(guanyu);
console.log(result);
// {
//   valid: false,
//   message: '武官型属性比例 0.83 不在 1.2-1.5 范围内'
// }
```

---

## 🎯 设计原则

### 1. 平衡性

- ✅ **总属性点控制** - 通过稀有度和阶段控制总属性点
- ✅ **类型差异** - 不同类型有不同的属性分配规则
- ✅ **成长空间** - 玩家角色有成长空间，NPC武将固定

### 2. 多样性

- ✅ **三种类型** - military、strategist、balanced
- ✅ **五种稀有度** - common、rare、epic、legendary、core
- ✅ **三种阶段** - early、peak、late

### 3. 真实性

- ✅ **历史还原** - 根据历史人物特点设计属性
- ✅ **阶段变化** - 年轻时期和年老时期有不同表现
- ✅ **个性化** - 每个角色都有独特的属性分配

### 4. 可扩展性

- ✅ **成长系统** - 支持升级、官职、装备加成
- ✅ **临时加成** - 支持技能、buff、debuff
- ✅ **动态计算** - 最终属性动态计算

---

## 📊 数据示例

### 示例1：传奇武将（巅峰期）

```json
{
  "id": "char_san_1102",
  "name": "关羽",
  "rarity": "legendary",
  "stage": "peak",
  "characterType": "military",
  "luck": 7.0,
  "courage": 9.6,
  "command": 9.0,
  "combat": 9.7,
  "intelligence": 7.6,
  "politics": 6.5,
  "charisma": 8.5,
  "total": 57.9,
  "morale": 85
}
```

### 示例2：史诗武将（茅庐期）

```json
{
  "id": "char_san_1103",
  "name": "张飞",
  "rarity": "epic",
  "stage": "early",
  "characterType": "military",
  "luck": 5.0,
  "courage": 9.8,
  "command": 8.5,
  "combat": 9.6,
  "intelligence": 3.0,
  "politics": 2.5,
  "charisma": 6.5,
  "total": 44.9,
  "morale": 90,
  "note": "茅庐期，总属性点 = 基础点数 × 95%"
}
```

### 示例3：史诗武将（不惑期）

```json
{
  "id": "char_san_1501",
  "name": "董卓",
  "rarity": "epic",
  "stage": "late",
  "characterType": "military",
  "luck": 4.0,
  "courage": 7.5,
  "command": 8.0,
  "combat": 7.0,
  "intelligence": 6.5,
  "politics": 5.0,
  "charisma": 3.5,
  "total": 41.5,
  "morale": 50,
  "note": "不惑期，总属性点 = 基础点数 × 90%"
}
```

### 示例4：玩家角色（普通）

```json
{
  "id": "player_char_0001",
  "name": "刘玄德",
  "rarity": "common",
  "stage": "peak",
  "characterType": "military",
  "luck": 5.2,
  "courage": 5.0,
  "command": 6.8,
  "combat": 6.5,
  "intelligence": 5.0,
  "politics": 5.2,
  "charisma": 5.0,
  "total": 44.7,
  "morale": 50,
  "note": "玩家角色，可成长"
}
```

---

## 🔄 属性调整建议

### 当前数据问题

根据验证，当前 `characters.json` 中的部分角色属性不符合规则：

**问题1：关羽（military类型）**
```
武力组：command(9.0) + combat(9.7) = 18.7
智力组：intelligence(7.6) + politics(6.5) + charisma(8.5) = 22.6
比例：18.7 / 22.6 = 82.7%
❌ 不符合规则（应该是120%-150%）
```

**建议调整**：
```json
{
  "name": "关羽",
  "command": 9.0,
  "combat": 9.7,
  "intelligence": 6.0,  // 降低
  "politics": 5.0,      // 降低
  "charisma": 8.5,
  "luck": 7.0,
  "courage": 9.6,
  "total": 54.8
}
```

**问题2：曹操（balanced类型）**
```
总属性点：60.7
期望范围：58-62
✅ 符合规则
```

### 批量调整工具

```javascript
/**
 * 批量调整角色属性
 */
function adjustCharacterAttributes(characters) {
  return characters.map(char => {
    const validation = validateCharacterAttributes(char);
    
    if (!validation.valid) {
      console.log(`调整 ${char.name}: ${validation.message}`);
      return adjustSingleCharacter(char);
    }
    
    return char;
  });
}

/**
 * 调整单个角色属性
 */
function adjustSingleCharacter(char) {
  // 根据类型调整属性分配
  if (char.characterType === 'military') {
    // 降低智力组属性，提升武力组属性
    // ...
  } else if (char.characterType === 'strategist') {
    // 降低武力组属性，提升智力组属性
    // ...
  }
  
  return char;
}
```

---

## 📝 总结

### 核心要点

1. **总属性点** = 基础点数（稀有度+类型） × 阶段修正
2. **balanced类型** 比其他类型高2点
3. **玩家角色** 初始较弱但可成长

### 下一步工作

- [ ] 验证所有现有角色属性
- [ ] 调整不符合规则的角色
- [ ] 创建属性生成工具
- [ ] 创建属性验证工具
- [ ] 完善成长系统设计

---

**让每个角色都有独特的属性分配！** 🎮

**文档作者**：Kiro AI  
**最后更新**：2026-02-06  
**文档版本**：v1.0.0

---

## ⚔️ 战斗计算公式

### 闪避与命中系统

**闪避率计算**：
```javascript
闪避率 = 运气 / 100
```

**命中率计算**：
```javascript
命中率 = 100% - 敌方闪避率
```

**示例**：
- 运气7.0的武将：闪避率 = 7%
- 运气8.8的武将：闪避率 = 8.8%
- 攻击运气8.8的武将：命中率 = 91.2%

---

### 物理伤害系统

**基础物理伤害**：
```javascript
基础物理伤害 = 武力 × 10
```

**最终物理伤害**：
```javascript
最终物理伤害 = 基础物理伤害 × (1 + 勇气/20) × (1 + (奋战值-50)/100)
```

**示例**：
- 武力9.1，勇气9.6，奋战值85%
- 基础伤害 = 91
- 最终伤害 = 91 × 1.48 × 1.35 = 181.8

---

### 计谋伤害系统

**基础计谋伤害**：
```javascript
基础计谋伤害 = 智力 × 10
```

**最终计谋伤害**：
```javascript
最终计谋伤害 = 基础计谋伤害 × (1 + 运气/20)
```

**示例**：
- 智力10.0，运气7.0
- 基础计谋伤害 = 100
- 最终计谋伤害 = 100 × 1.35 = 135

**说明**：
- 计谋伤害**只考虑智力**，不受政治和魅力影响
- 运气影响计谋伤害（类似勇气影响物理伤害）
- 计谋伤害不受奋战值影响

---

### 暴击系统

**暴击率**：
```javascript
暴击率 = (勇气 + 运气) / 20
```

**暴击伤害**：
```javascript
暴击伤害 = 最终伤害 × 2
```

**示例**：
- 勇气9.6 + 运气7.0 = 16.6
- 暴击率 = 83%
- 暴击伤害 = 181.8 × 2 = 363.6

**说明**：
- 物理攻击和计谋攻击都可以暴击
- 暴击率由勇气和运气共同决定

---

### 防御系统

**物理防御力**：
```javascript
物理防御力 = 统率 × 5 + 武力 × 3
```

**物理伤害减免**：
```javascript
物理伤害减免 = 物理防御力 / (物理防御力 + 100)
```

**实际物理伤害**：
```javascript
实际物理伤害 = 物理攻击伤害 × (1 - 物理伤害减免)
```

**示例**：
- 统率9.0，武力9.1
- 物理防御力 = 72.3
- 伤害减免 = 42%
- 受到100点攻击 → 实际伤害58点

---

**计谋防御力**：
```javascript
计谋防御力 = 智力 × 8
```

**计谋伤害减免**：
```javascript
计谋伤害减免 = 计谋防御力 / (计谋防御力 + 100)
```

**实际计谋伤害**：
```javascript
实际计谋伤害 = 计谋攻击伤害 × (1 - 计谋伤害减免)
```

**示例**：
- 智力10.0
- 计谋防御力 = 80
- 伤害减免 = 44%
- 受到100点计谋攻击 → 实际伤害56点

**说明**：
- 计谋防御**只由智力决定**，不受政治和魅力影响
- 智力高的武将既能造成高计谋伤害，也能抵御计谋攻击

---

### 技能伤害类型

**物理技能**：
- 使用物理伤害公式
- 基于武力、勇气、奋战值
- 受物理防御影响
- 示例：突击、冲锋、斩击

**计谋技能**：
- 使用计谋伤害公式
- 基于智力、运气
- 受计谋防御影响
- 示例：火攻、离间、混乱、落雷

---

**详细战斗系统请参考**：`COMBAT_SYSTEM.md`

**最后更新**：2026-02-07
