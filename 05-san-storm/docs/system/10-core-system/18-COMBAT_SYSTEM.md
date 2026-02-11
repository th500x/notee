# 战斗系统 - 完整设计文档

## 📋 文档概述

本文档详细说明《真三风云》的战斗系统，包括伤害计算、命中闪避、暴击系统等核心机制。

**最后更新**：2026-02-09  
**文档版本**：v2.1.0

---

## ⚔️ 战斗核心机制

### 1. 攻击流程

```
发起攻击 → 命中判定 → 伤害计算 → 暴击判定 → 最终伤害
```

---

## 🎯 命中与闪避系统

### 基础公式

```javascript
// 闪避率计算
闪避率 = 运气 / 100

// 命中率计算
命中率 = 100% - 敌方闪避率

// 最终命中判定
随机数 = Math.random() // 0-1之间
if (随机数 < 命中率) {
  攻击命中
} else {
  攻击闪避
}
```

### 示例计算

#### 示例1：普通武将
```javascript
// 攻击方：关羽
运气 = 7.0
闪避率 = 7.0 / 100 = 7%

// 防守方：张飞
运气 = 6.8
闪避率 = 6.8 / 100 = 6.8%

// 关羽攻击张飞
命中率 = 100% - 6.8% = 93.2%
// 有93.2%的概率命中，6.8%的概率被闪避
```

#### 示例2：高运气武将
```javascript
// 攻击方：赵云
运气 = 8.8
闪避率 = 8.8 / 100 = 8.8%

// 防守方：普通士兵
运气 = 5.0
闪避率 = 5.0 / 100 = 5%

// 赵云攻击士兵
命中率 = 100% - 5% = 95%
// 有95%的概率命中
```

#### 示例3：低运气武将
```javascript
// 攻击方：张飞
运气 = 6.8
闪避率 = 6.8 / 100 = 6.8%

// 防守方：太史慈（高运气）
运气 = 7.4
闪避率 = 7.4 / 100 = 7.4%

// 张飞攻击太史慈
命中率 = 100% - 7.4% = 92.6%
// 有92.6%的概率命中，7.4%的概率被闪避
```

### 闪避率范围

根据武将运气属性范围：

| 运气值 | 闪避率 | 说明 |
|--------|--------|------|
| 3.0 | 3% | 最低闪避（属性下限） |
| 5.0 | 5% | 普通武将 |
| 7.0 | 7% | 优秀武将 |
| 8.0 | 8% | 高运气武将 |
| 9.0 | 9% | 极高运气 |
| 10.0 | 10% | 满运气（传奇/核心） |

**设计理念**：
- 闪避率不会太高（最高10%），保持战斗稳定性
- 运气差异带来明显但不过分的闪避差距
- 简单易懂，便于玩家理解

---

## 💥 伤害计算系统

### 伤害类型

游戏中有两种伤害类型：

1. **物理伤害** - 基于武力的普通攻击和物理技能
2. **计谋伤害** - 基于智力的计谋技能和法术攻击

---

### 物理伤害公式

```javascript
// 基础物理伤害
基础伤害 = 武力 × 10

// 勇气加成
勇气加成 = 1 + (勇气 / 20)

// 奋战值加成
奋战加成 = (奋战值 - 50) / 100
// 奋战值50%时无加成，100%时+50%，0%时-50%

// 最终物理伤害
最终伤害 = 基础伤害 × 勇气加成 × (1 + 奋战加成)
```

### 计谋伤害公式

```javascript
// 基础计谋伤害
基础计谋伤害 = 智力 × 10

// 运气加成
运气加成 = 1 + (运气 / 20)

// 最终计谋伤害
最终计谋伤害 = 基础计谋伤害 × 运气加成
```

**说明**：
- 计谋伤害**只考虑智力**，不受政治和魅力影响
- 运气影响计谋伤害（类似勇气影响物理伤害）
- 计谋伤害不受奋战值影响

### 物理伤害示例

#### 示例1：关羽（巅峰状态）
```javascript
武力 = 9.1
勇气 = 9.6
奋战值 = 85%

基础伤害 = 9.1 × 10 = 91
勇气加成 = 1 + (9.6 / 20) = 1.48
奋战加成 = (85 - 50) / 100 = 0.35

最终物理伤害 = 91 × 1.48 × (1 + 0.35) = 181.8
```

#### 示例2：张飞（高奋战）
```javascript
武力 = 9.6
勇气 = 9.8
奋战值 = 100%

基础伤害 = 9.6 × 10 = 96
勇气加成 = 1 + (9.8 / 20) = 1.49
奋战加成 = (100 - 50) / 100 = 0.5

最终物理伤害 = 96 × 1.49 × (1 + 0.5) = 214.6
```

#### 示例3：低奋战状态
```javascript
武力 = 8.0
勇气 = 7.0
奋战值 = 20%

基础伤害 = 8.0 × 10 = 80
勇气加成 = 1 + (7.0 / 20) = 1.35
奋战加成 = (20 - 50) / 100 = -0.3

最终物理伤害 = 80 × 1.35 × (1 - 0.3) = 75.6
```

### 计谋伤害示例

#### 示例1：诸葛亮（高智力）
```javascript
智力 = 10.0
运气 = 7.0

基础计谋伤害 = 10.0 × 10 = 100
运气加成 = 1 + (7.0 / 20) = 1.35

最终计谋伤害 = 100 × 1.35 = 135
```

#### 示例2：郭嘉（高运气）
```javascript
智力 = 9.5
运气 = 8.0

基础计谋伤害 = 9.5 × 10 = 95
运气加成 = 1 + (8.0 / 20) = 1.40

最终计谋伤害 = 95 × 1.40 = 133
```

#### 示例3：普通谋士
```javascript
智力 = 7.0
运气 = 5.0

基础计谋伤害 = 7.0 × 10 = 70
运气加成 = 1 + (5.0 / 20) = 1.25

最终计谋伤害 = 70 × 1.25 = 87.5
```

---

## 📊 基础伤害规则（兵力对比）

### 规则说明

以下是**基础伤害规则**，仅考虑武将和部队自身的数值，**不包含任何加成**（如技能、阵型、羁绊等）。

这些数值用于建立游戏的基础伤害曲线，确保兵力差距带来合理的战损比。

### 基础伤害表

假设双方武将均为**蓝色品质**（属性相近），仅通过部队兵力差异产生伤害差距：

| 攻击方兵力 | 防守方兵力 | 攻击方造成伤害 | 攻击方受到反击 | 战损比 | 说明 |
|-----------|-----------|--------------|--------------|--------|------|
| 150 | 150 | 36% | 16% | 2.25倍 | 同级别对战，攻击方优势 |
| 300 | 150 | 50% | 14% | 3.57倍 | 2倍兵力优势 |
| 450 | 150 | 64% | 12% | 5.33倍 | 3倍兵力优势 |
| 600 | 150 | 80% | 10% | 8.00倍 | 4倍兵力优势 |
| 999 | 150 | 120% | 6% | 20.00倍 | 金色满配，碾压优势 |

### 详细说明

#### 1. 同级别对战（150 vs 150）
```javascript
// 双方兵力相同，武将品质相同
攻击方造成伤害 = 150 × 36% = 54人损失
攻击方受到反击 = 150 × 16% = 24人损失

战损比 = 54 / 24 = 2.25倍
// 攻击方有明显优势，但不会碾压
```

**设计理念**：
- 同级别对战，攻击方有优势但不会一边倒
- 鼓励主动进攻，但也要承担反击风险
- 战损比2.25倍，符合历史战争规律

#### 2. 2倍兵力优势（300 vs 150）
```javascript
// 攻击方兵力2倍于防守方
攻击方造成伤害 = 150 × 50% = 75人损失
攻击方受到反击 = 300 × 14% = 42人损失

战损比 = 75 / 42 = 1.79倍（对攻击方）
// 注意：这里是对方损失/己方损失的比例
```

**设计理念**：
- 2倍兵力可以造成50%伤害，接近全歼对方
- 反击伤害降低到14%，攻击方损失可控
- 鼓励玩家通过升级部队获得兵力优势

#### 3. 3倍兵力优势（450 vs 150）
```javascript
// 攻击方兵力3倍于防守方
攻击方造成伤害 = 150 × 64% = 96人损失
攻击方受到反击 = 450 × 12% = 54人损失

战损比 = 96 / 54 = 1.78倍（对攻击方）
```

**设计理念**：
- 3倍兵力可以造成64%伤害，基本全歼对方
- 反击伤害进一步降低到12%
- 紫色部队对蓝色部队有明显优势

#### 4. 4倍兵力优势（600 vs 150）
```javascript
// 攻击方兵力4倍于防守方
攻击方造成伤害 = 150 × 80% = 120人损失
攻击方受到反击 = 600 × 10% = 60人损失

战损比 = 120 / 60 = 2.00倍（对攻击方）
```

**设计理念**：
- 4倍兵力可以造成80%伤害，完全压制对方
- 反击伤害降低到10%，攻击方几乎无损
- 橙色部队对蓝色部队有碾压优势

#### 5. 金色碾压（999 vs 150）
```javascript
// 攻击方金色满配部队
攻击方造成伤害 = 150 × 120% = 180人损失
// 注意：伤害超过100%，意味着可以秒杀并造成溢出伤害
攻击方受到反击 = 999 × 6% = 60人损失

战损比 = 180 / 60 = 3.00倍（对攻击方）
```

**设计理念**：
- 金色部队可以造成120%伤害，直接秒杀低级部队
- 理论上不会受到反击（对方已死），但如果对方有增益存活，则受到6%反击
- 体现金色部队的稀有性和强大战斗力

### 战损比曲线

```
战损比（攻击方优势）
20.00x ┤                                    ●（999 vs 150）
       │
       │
       │
8.00x  ┤                          ●（600 vs 150）
       │
       │
5.33x  ┤                    ●（450 vs 150）
       │
       │
3.57x  ┤              ●（300 vs 150）
       │
       │
2.25x  ┤        ●（150 vs 150）
       │
       └────────┴────────┴────────┴────────┴────────
            1x      2x      3x      4x      6.66x
                    兵力比例
```

### 实战应用

#### 场景1：新手对战
```javascript
// 双方都是蓝色150人部队
玩家A攻击玩家B：
- 玩家A损失：24人（16%反击）
- 玩家B损失：54人（36%伤害）
- 结果：玩家A获胜，但也有损失

// 如果玩家B反击：
玩家B攻击玩家A：
- 玩家B损失：24人（16%反击）
- 玩家A损失：54人（36%伤害）
- 结果：双方互有损失，需要策略选择
```

#### 场景2：升级优势
```javascript
// 玩家A升级到紫色450人，玩家B仍是蓝色150人
玩家A攻击玩家B：
- 玩家A损失：54人（12%反击）
- 玩家B损失：96人（64%伤害）
- 结果：玩家A碾压优势，几乎无损

// 体现升级的重要性
```

#### 场景3：金色碾压
```javascript
// 玩家A拥有金色999人部队，玩家B是蓝色150人
玩家A攻击玩家B：
- 玩家A损失：60人（6%反击）
- 玩家B损失：180人（120%伤害，直接秒杀）
- 结果：玩家B被秒杀，玩家A几乎无损

// 体现金色部队的稀有性和强大
```

### 设计平衡性

**优势**：
- ✅ **成长曲线清晰** - 兵力提升带来明显战斗力提升
- ✅ **战损比合理** - 2.25倍到20倍的战损比，符合游戏平衡
- ✅ **鼓励升级** - 玩家有动力升级部队获得优势
- ✅ **保持挑战** - 同级别对战仍有悬念，不会一边倒
- ✅ **金色稀有** - 金色部队有明显优势，体现稀有性

**注意事项**：
- ⚠️ 这是**基础伤害**，实际战斗还会受到以下因素影响：
  - 武将属性（武力、勇气、智力等）
  - 技能效果（增伤、减伤、控制等）
  - 阵型加成（八卦阵、锋矢阵等）
  - 羁绊效果（无双羁绊、桃园结义等）
  - 装备加成（武器、防具、称号等）
  - 暴击系统（2倍伤害）
  - 奋战值（士气影响）

---

## ⚡ 暴击系统

### 暴击率计算

```javascript
暴击率 = (勇气 + 运气) / 20
```

### 暴击伤害

```javascript
暴击伤害 = 最终伤害 × 2
```

### 示例计算

#### 示例1：关羽
```javascript
勇气 = 9.6
运气 = 7.0

暴击率 = (9.6 + 7.0) / 20 = 0.83 = 83%
// 非常高的暴击率！

普通伤害 = 181.8
暴击伤害 = 181.8 × 2 = 363.6
```

#### 示例2：赵云
```javascript
勇气 = 10.0
运气 = 8.8

暴击率 = (10.0 + 8.8) / 20 = 0.94 = 94%
// 几乎必定暴击！

普通伤害 = 200
暴击伤害 = 200 × 2 = 400
```

#### 示例3：普通武将
```javascript
勇气 = 6.0
运气 = 5.0

暴击率 = (6.0 + 5.0) / 20 = 0.55 = 55%
// 中等暴击率

普通伤害 = 100
暴击伤害 = 100 × 2 = 200
```

### 暴击率范围

| 勇气+运气 | 暴击率 | 说明 |
|-----------|--------|------|
| 6.0 | 30% | 最低（属性下限） |
| 10.0 | 50% | 普通武将 |
| 14.0 | 70% | 优秀武将 |
| 16.0 | 80% | 高级武将 |
| 18.0 | 90% | 顶级武将 |
| 20.0 | 100% | 满暴击（理论最大） |

---

## 🛡️ 防御系统

### 物理防御

```javascript
// 物理防御力
物理防御 = 统率 × 5 + 武力 × 3

// 物理伤害减免
物理减免 = 物理防御 / (物理防御 + 100)

// 实际受到物理伤害
实际物理伤害 = 物理攻击伤害 × (1 - 物理减免)
```

### 计谋防御

```javascript
// 计谋防御力
计谋防御 = 智力 × 8

// 计谋伤害减免
计谋减免 = 计谋防御 / (计谋防御 + 100)

// 实际受到计谋伤害
实际计谋伤害 = 计谋攻击伤害 × (1 - 计谋减免)
```

**说明**：
- 物理防御由统率和武力决定
- 计谋防御**只由智力决定**，不受政治和魅力影响
- 智力高的武将既能造成高计谋伤害，也能抵御计谋攻击

### 物理防御示例

#### 示例1：关羽防御
```javascript
统率 = 9.0
武力 = 9.1

物理防御 = 9.0 × 5 + 9.1 × 3 = 72.3
物理减免 = 72.3 / (72.3 + 100) = 0.42 = 42%

// 受到100点物理攻击
实际物理伤害 = 100 × (1 - 0.42) = 58
```

#### 示例2：张飞防御
```javascript
统率 = 10.0
武力 = 9.6

物理防御 = 10.0 × 5 + 9.6 × 3 = 78.8
物理减免 = 78.8 / (78.8 + 100) = 0.44 = 44%

// 受到100点物理攻击
实际物理伤害 = 100 × (1 - 0.44) = 56
```

### 计谋防御示例

#### 示例1：诸葛亮防御
```javascript
智力 = 10.0

计谋防御 = 10.0 × 8 = 80
计谋减免 = 80 / (80 + 100) = 0.44 = 44%

// 受到100点计谋攻击
实际计谋伤害 = 100 × (1 - 0.44) = 56
```

#### 示例2：郭嘉防御
```javascript
智力 = 9.5

计谋防御 = 9.5 × 8 = 76
计谋减免 = 76 / (76 + 100) = 0.43 = 43%

// 受到100点计谋攻击
实际计谋伤害 = 100 × (1 - 0.43) = 57
```

#### 示例3：武将防御（低智力）
```javascript
智力 = 5.0

计谋防御 = 5.0 × 8 = 40
计谋减免 = 40 / (40 + 100) = 0.29 = 29%

// 受到100点计谋攻击
实际计谋伤害 = 100 × (1 - 0.29) = 71
// 智力低的武将容易被计谋攻击
```

---

## 🎲 完整战斗流程

### 物理攻击流程

```javascript
function performPhysicalAttack(attacker, defender) {
  // 1. 命中判定
  const dodgeRate = defender.luck / 100;
  const hitRate = 1 - dodgeRate;
  const hitRoll = Math.random();
  
  if (hitRoll >= hitRate) {
    return {
      result: 'miss',
      message: `${defender.name}闪避了攻击！`,
      damage: 0
    };
  }
  
  // 2. 计算物理伤害
  const baseDamage = attacker.combat * 10;
  const courageBonus = 1 + (attacker.courage / 20);
  const moraleBonus = (attacker.morale - 50) / 100;
  let finalDamage = baseDamage * courageBonus * (1 + moraleBonus);
  
  // 3. 暴击判定
  const critRate = (attacker.courage + attacker.luck) / 20;
  const critRoll = Math.random();
  const isCrit = critRoll < critRate;
  
  if (isCrit) {
    finalDamage *= 2;
  }
  
  // 4. 物理防御减免
  const defense = defender.command * 5 + defender.combat * 3;
  const damageReduction = defense / (defense + 100);
  const actualDamage = finalDamage * (1 - damageReduction);
  
  // 5. 返回结果
  return {
    result: 'hit',
    damageType: 'physical',
    isCrit: isCrit,
    damage: Math.round(actualDamage),
    message: isCrit 
      ? `${attacker.name}暴击！造成${Math.round(actualDamage)}点物理伤害！`
      : `${attacker.name}攻击命中，造成${Math.round(actualDamage)}点物理伤害。`
  };
}
```

### 计谋攻击流程

```javascript
function performStrategyAttack(attacker, defender) {
  // 1. 命中判定（计谋攻击也可以被闪避）
  const dodgeRate = defender.luck / 100;
  const hitRate = 1 - dodgeRate;
  const hitRoll = Math.random();
  
  if (hitRoll >= hitRate) {
    return {
      result: 'miss',
      message: `${defender.name}闪避了计谋！`,
      damage: 0
    };
  }
  
  // 2. 计算计谋伤害
  const baseDamage = attacker.intelligence * 10;
  const luckBonus = 1 + (attacker.luck / 20);
  let finalDamage = baseDamage * luckBonus;
  
  // 3. 暴击判定（计谋也可以暴击）
  const critRate = (attacker.courage + attacker.luck) / 20;
  const critRoll = Math.random();
  const isCrit = critRoll < critRate;
  
  if (isCrit) {
    finalDamage *= 2;
  }
  
  // 4. 计谋防御减免
  const defense = defender.intelligence * 8;
  const damageReduction = defense / (defense + 100);
  const actualDamage = finalDamage * (1 - damageReduction);
  
  // 5. 返回结果
  return {
    result: 'hit',
    damageType: 'strategy',
    isCrit: isCrit,
    damage: Math.round(actualDamage),
    message: isCrit 
      ? `${attacker.name}计谋暴击！造成${Math.round(actualDamage)}点计谋伤害！`
      : `${attacker.name}计谋命中，造成${Math.round(actualDamage)}点计谋伤害。`
  };
}
```

### 战斗示例

```javascript
// 关羽 vs 张飞（物理攻击）
const guanyu = {
  name: '关羽',
  luck: 7.0,
  courage: 9.6,
  command: 9.0,
  combat: 9.1,
  intelligence: 7.6,
  morale: 85
};

const zhangfei = {
  name: '张飞',
  luck: 6.8,
  courage: 9.8,
  command: 10.0,
  combat: 9.6,
  intelligence: 3.0,
  morale: 90
};

// 关羽物理攻击张飞
const result1 = performPhysicalAttack(guanyu, zhangfei);
// 可能结果：
// 1. 闪避：张飞闪避了攻击！（6.8%概率）
// 2. 普通命中：关羽攻击命中，造成102点物理伤害。（约15%概率）
// 3. 暴击：关羽暴击！造成204点物理伤害！（约77%概率）

// 诸葛亮 vs 关羽（计谋攻击）
const zhugeliang = {
  name: '诸葛亮',
  luck: 7.0,
  courage: 6.0,
  command: 9.0,
  combat: 4.0,
  intelligence: 10.0,
  morale: 80
};

// 诸葛亮计谋攻击关羽
const result2 = performStrategyAttack(zhugeliang, guanyu);
// 可能结果：
// 1. 闪避：关羽闪避了计谋！（7%概率）
// 2. 普通命中：诸葛亮计谋命中，造成76点计谋伤害。（约28%概率）
// 3. 暴击：诸葛亮计谋暴击！造成152点计谋伤害！（约65%概率）
```

---

## 🎯 特殊效果

### 1. Buff/Debuff

#### 命中率Buff
```javascript
// 左慈的幻象迷惑
命中率 = (100% - 敌方闪避率) × (1 - 0.15)
// 命中率降低15%
```

#### 闪避率Buff
```javascript
// 左慈的幻术护体
闪避率 = (运气 / 100) + 0.20
// 闪避率增加20%
```

#### 暴击率Buff
```javascript
// 管辂的天机预兆
暴击率 = (勇气 + 运气) / 20 + 0.25
// 暴击率增加25%
```

### 2. 阵型效果

#### 八卦阵
```javascript
// 敌人攻击命中率-15%
敌方命中率 = (100% - 我方闪避率) × (1 - 0.15)
```

### 3. 羁绊效果

#### 无双羁绊
```javascript
// 3人激活
武力 = 基础武力 + 1.5
暴击率 = 基础暴击率 + 0.25
暴击伤害 = 基础暴击伤害 × 1.3
```

---

## 📊 战斗数据示例

### 完整战斗回合

```
【第1回合】
关羽 vs 张飞

关羽发起攻击：
- 命中判定：随机数0.45 < 命中率93.2% → 命中！
- 基础伤害：91
- 勇气加成：×1.48
- 奋战加成：×1.35
- 暴击判定：随机数0.32 < 暴击率83% → 暴击！
- 暴击伤害：181.8 × 2 = 363.6
- 防御减免：44%
- 最终伤害：363.6 × 0.56 = 203.6

结果：关羽暴击！对张飞造成204点伤害！

张飞反击：
- 命中判定：随机数0.92 < 命中率93% → 命中！
- 基础伤害：96
- 勇气加成：×1.49
- 奋战加成：×1.5
- 暴击判定：随机数0.15 < 暴击率88% → 暴击！
- 暴击伤害：214.6 × 2 = 429.2
- 防御减免：42%
- 最终伤害：429.2 × 0.58 = 248.9

结果：张飞暴击！对关羽造成249点伤害！
```

---

## 🎮 游戏平衡性

### 设计理念

1. **命中稳定**：闪避率3%-10%，保证大部分攻击能命中
2. **暴击频繁**：顶级武将暴击率80%+，战斗更刺激
3. **运气重要**：运气同时影响闪避、暴击和计谋伤害，是关键属性
4. **勇气核心**：勇气影响物理伤害、暴击、士气，物理战斗核心属性
5. **智力独立**：智力独立影响计谋伤害和计谋防御，不受政治魅力干扰

### 伤害类型对比

| 特性 | 物理伤害 | 计谋伤害 |
|------|---------|---------|
| 基础属性 | 武力 | 智力 |
| 加成属性 | 勇气 | 运气 |
| 额外影响 | 奋战值 | 无 |
| 防御属性 | 统率+武力 | 智力 |
| 适用武将 | 武官型 | 军师型 |
| 代表人物 | 关羽、张飞、吕布 | 诸葛亮、郭嘉、司马懿 |

### 属性权重

| 属性 | 物理战斗 | 计谋战斗 | 综合权重 |
|------|---------|---------|---------|
| 武力 | ⭐⭐⭐⭐⭐ | - | ⭐⭐⭐⭐⭐ |
| 勇气 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 运气 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 统率 | ⭐⭐⭐ | - | ⭐⭐⭐ |
| 智力 | - | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 政治 | - | - | ⭐ |
| 魅力 | - | - | ⭐ |

**说明**：
- 政治和魅力不参与战斗计算
- 政治影响内政、外交等非战斗系统
- 魅力影响招募、忠诚等社交系统

---

## 🔧 实现代码

### JavaScript实现

```javascript
// 战斗系统类
class CombatSystem {
  // 计算闪避率
  static calculateDodgeRate(luck) {
    return luck / 100;
  }
  
  // 计算命中率
  static calculateHitRate(attackerLuck, defenderLuck) {
    const dodgeRate = this.calculateDodgeRate(defenderLuck);
    return 1 - dodgeRate;
  }
  
  // 命中判定
  static checkHit(hitRate) {
    return Math.random() < hitRate;
  }
  
  // 计算物理伤害
  static calculatePhysicalDamage(combat, courage, morale) {
    const baseDamage = combat * 10;
    const courageBonus = 1 + (courage / 20);
    const moraleBonus = (morale - 50) / 100;
    return baseDamage * courageBonus * (1 + moraleBonus);
  }
  
  // 计算计谋伤害
  static calculateStrategyDamage(intelligence, luck) {
    const baseDamage = intelligence * 10;
    const luckBonus = 1 + (luck / 20);
    return baseDamage * luckBonus;
  }
  
  // 计算暴击率
  static calculateCritRate(courage, luck) {
    return (courage + luck) / 20;
  }
  
  // 暴击判定
  static checkCrit(critRate) {
    return Math.random() < critRate;
  }
  
  // 计算物理防御减免
  static calculatePhysicalDefense(command, combat) {
    const defense = command * 5 + combat * 3;
    return defense / (defense + 100);
  }
  
  // 计算计谋防御减免
  static calculateStrategyDefense(intelligence) {
    const defense = intelligence * 8;
    return defense / (defense + 100);
  }
  
  // 执行物理攻击
  static performPhysicalAttack(attacker, defender) {
    // 1. 命中判定
    const hitRate = this.calculateHitRate(attacker.luck, defender.luck);
    if (!this.checkHit(hitRate)) {
      return {
        result: 'miss',
        damageType: 'physical',
        damage: 0,
        message: `${defender.name}闪避了攻击！`
      };
    }
    
    // 2. 计算伤害
    let damage = this.calculatePhysicalDamage(
      attacker.combat,
      attacker.courage,
      attacker.morale
    );
    
    // 3. 暴击判定
    const critRate = this.calculateCritRate(attacker.courage, attacker.luck);
    const isCrit = this.checkCrit(critRate);
    if (isCrit) {
      damage *= 2;
    }
    
    // 4. 防御减免
    const defenseReduction = this.calculatePhysicalDefense(
      defender.command,
      defender.combat
    );
    damage *= (1 - defenseReduction);
    
    return {
      result: 'hit',
      damageType: 'physical',
      isCrit: isCrit,
      damage: Math.round(damage),
      message: isCrit
        ? `${attacker.name}暴击！造成${Math.round(damage)}点物理伤害！`
        : `${attacker.name}攻击命中，造成${Math.round(damage)}点物理伤害。`
    };
  }
  
  // 执行计谋攻击
  static performStrategyAttack(attacker, defender) {
    // 1. 命中判定
    const hitRate = this.calculateHitRate(attacker.luck, defender.luck);
    if (!this.checkHit(hitRate)) {
      return {
        result: 'miss',
        damageType: 'strategy',
        damage: 0,
        message: `${defender.name}闪避了计谋！`
      };
    }
    
    // 2. 计算伤害
    let damage = this.calculateStrategyDamage(
      attacker.intelligence,
      attacker.luck
    );
    
    // 3. 暴击判定
    const critRate = this.calculateCritRate(attacker.courage, attacker.luck);
    const isCrit = this.checkCrit(critRate);
    if (isCrit) {
      damage *= 2;
    }
    
    // 4. 防御减免
    const defenseReduction = this.calculateStrategyDefense(
      defender.intelligence
    );
    damage *= (1 - defenseReduction);
    
    return {
      result: 'hit',
      damageType: 'strategy',
      isCrit: isCrit,
      damage: Math.round(damage),
      message: isCrit
        ? `${attacker.name}计谋暴击！造成${Math.round(damage)}点计谋伤害！`
        : `${attacker.name}计谋命中，造成${Math.round(damage)}点计谋伤害。`
    };
  }
}

// 使用示例
const attacker = {
  name: '关羽',
  luck: 7.0,
  courage: 9.6,
  command: 9.0,
  combat: 9.1,
  intelligence: 7.6,
  morale: 85
};

const defender = {
  name: '张飞',
  luck: 6.8,
  courage: 9.8,
  command: 10.0,
  combat: 9.6,
  intelligence: 3.0,
  morale: 90
};

// 物理攻击
const result1 = CombatSystem.performPhysicalAttack(attacker, defender);
console.log(result1.message);

// 计谋攻击
const strategist = {
  name: '诸葛亮',
  luck: 7.0,
  courage: 6.0,
  command: 9.0,
  combat: 4.0,
  intelligence: 10.0,
  morale: 80
};

const result2 = CombatSystem.performStrategyAttack(strategist, defender);
console.log(result2.message);
```

---

## 🎖️ 上阵规则与队伍配置

### 队伍组成

**上阵角色数**:
- 玩家角色: 1个（必须）
- 历史武将: 最多2个
- 总计: 最多3个角色上阵

**部队数量计算**:
```
最大部队数 = 玩家部队(1) + 武将1部队(2) + 武将2部队(2) = 5支部队
最小部队数 = 玩家部队(1) = 1支部队
```

### 装备槽位差异

| 角色类型 | 装备槽数 | 部队槽数 | 说明 |
|---------|---------|---------|------|
| 玩家角色 | 7个 | 1个 | 基础战斗力 |
| 历史武将 | 8个 | 2个 | 更强战斗力 |

**装备槽位详情**:

**玩家角色**（7个装备槽）:
```javascript
const playerEquipment = {
  weapon: null,      // 武器槽
  armor: null,       // 防具槽
  accessory1: null,  // 辅助槽1
  accessory2: null,  // 辅助槽2
  title: null,       // 称号槽
  troop: null,       // 部队槽（1个）
};
```

**历史武将**（8个装备槽）:
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

### 队伍配置示例

#### 配置1：最小配置（新手）
```javascript
const battleTeam = {
  player: {
    name: '玩家角色',
    troops: [troop1],  // 1支部队
  },
  totalTroops: 1,
};
```

#### 配置2：标准配置（中期）
```javascript
const battleTeam = {
  player: {
    name: '玩家角色',
    troops: [troop1],  // 1支部队
  },
  hero1: {
    name: '关羽',
    troops: [troop2, troop3],  // 2支部队
  },
  totalTroops: 3,
};
```

#### 配置3：满配（后期）
```javascript
const battleTeam = {
  player: {
    name: '玩家角色',
    troops: [troop1],  // 1支部队
  },
  hero1: {
    name: '关羽',
    troops: [troop2, troop3],  // 2支部队
  },
  hero2: {
    name: '张飞',
    troops: [troop4, troop5],  // 2支部队
  },
  totalTroops: 5,  // 总计5支部队
};
```

### 上阵规则

1. **玩家必须** - 玩家角色必须上阵
2. **武将可选** - 可以选择0-2个历史武将
3. **部队必需** - 每个角色必须装备至少1支部队才能上阵
4. **武将优势** - 历史武将可装备2支部队，战斗力更强
5. **策略深度** - 选择合适的武将和部队组合

### 战斗力对比

| 配置 | 角色数 | 部队数 | 战斗力 | 适用阶段 |
|------|-------|-------|--------|---------|
| 最小 | 1（玩家） | 1 | ⭐ | 新手 |
| 标准 | 2（玩家+1武将） | 3 | ⭐⭐⭐ | 中期 |
| 满配 | 3（玩家+2武将） | 5 | ⭐⭐⭐⭐⭐ | 后期 |

### 设计理念

**为什么武将有2个部队槽？**
- ✅ **历史还原** - 历史武将确实能统率更多部队
- ✅ **收集动力** - 给玩家抽取武将的动力
- ✅ **策略深度** - 选择合适的武将组合很重要
- ✅ **成长空间** - 从1支部队到5支部队的成长路径

**为什么最多3个角色？**
- ✅ **简化管理** - 3个角色易于管理
- ✅ **战斗节奏** - 不会因为角色太多而拖慢战斗
- ✅ **策略选择** - 需要选择最合适的武将组合

---

## 📝 总结

### 核心公式速查

```javascript
// 闪避与命中
闪避率 = 运气 / 100
命中率 = 100% - 敌方闪避率

// 物理伤害
基础物理伤害 = 武力 × 10
最终物理伤害 = 基础物理伤害 × (1 + 勇气/20) × (1 + (奋战值-50)/100)

// 计谋伤害
基础计谋伤害 = 智力 × 10
最终计谋伤害 = 基础计谋伤害 × (1 + 运气/20)

// 暴击系统
暴击率 = (勇气 + 运气) / 20
暴击伤害 = 最终伤害 × 2

// 物理防御
物理防御力 = 统率 × 5 + 武力 × 3
物理伤害减免 = 物理防御力 / (物理防御力 + 100)
实际物理伤害 = 物理攻击伤害 × (1 - 物理伤害减免)

// 计谋防御
计谋防御力 = 智力 × 8
计谋伤害减免 = 计谋防御力 / (计谋防御力 + 100)
实际计谋伤害 = 计谋攻击伤害 × (1 - 计谋伤害减免)
```

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

### 设计优势

✅ **简单易懂** - 公式简洁，玩家容易理解  
✅ **平衡合理** - 闪避率不会太高，保持战斗稳定  
✅ **属性重要** - 运气和勇气成为战斗核心属性  
✅ **战斗刺激** - 高暴击率让战斗更有爆发感  
✅ **易于实现** - 代码简单，性能优秀  
✅ **类型分明** - 物理和计谋各有特色，武将定位清晰  
✅ **智力独立** - 计谋伤害只看智力，不受政治魅力干扰  

---

**文档作者**: Kiro AI  
**创建日期**: 2026-02-07  
**最后更新**: 2026-02-09  
**文档版本**: v2.1.0
