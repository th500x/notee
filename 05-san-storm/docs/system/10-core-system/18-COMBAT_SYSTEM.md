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

---

## 🗺️ 战斗地图系统

### 地图尺寸标准

战斗地图根据战斗规模和类型采用不同尺寸：

| 地图类型 | 尺寸 | 格数 | 适用场景 | 预计时长 |
|---------|------|------|---------|---------|
| **小型地图** | 4x6 | 24格 | 日常战斗（≤2部队） | 3-5分钟 |
| **中型地图** | 6x8 | 48格 | 日常战斗（>2部队） | 5-8分钟 |
| **大型地图** | 8x10 | 80格 | 战役地图 | 8-12分钟 |
| **超大地图** | 10x12 | 120格 | 核心城市攻城 | 10-15分钟 |

### 地图生成方式

#### AI随机生成（日常/事件战斗）
- **小型地图（4x6）**: 玩家部队数≤2时使用
- **中型地图（6x8）**: 玩家部队数>2时使用
- **生成规则**: 基于预设模板和算法自动生成
- **地形类型**: 平原、森林、山地、河流、道路

#### 手工设计（重要战斗）
- **战役地图（8x10）**: 赛季特殊挑战，手工精心设计
- **核心城市（10x12）**: 多人协作攻城，复杂城防设施

### 视角设计

**俯视角（Top-down View）** ✅ 确定方案
- 开发效率高，AI绘图工作量小
- 信息展示清晰，适合策略思考
- 参考《文明6》战略地图风格
- 重点突出游戏性而非视觉特效

---

## 👥 多人协作战斗系统

### 核心城市攻城战

#### 基本配置
- **地图尺寸**: 10x12 (120格)
- **参战人数**: 2-3名玩家协作 vs AI防守
- **战斗时长**: 10-15分钟
- **回合限制**: 20回合

#### 部队配置
```javascript
// 2人协作模式
玩家A: 最多5支部队
玩家B: 最多5支部队
AI防守: 6-8支部队
总兵力对比: 10v6-8

// 3人协作模式  
玩家A: 最多5支部队
玩家B: 最多4支部队
玩家C: 最多4支部队
AI防守: 7-8支部队
总兵力对比: 13v7-8
```

#### 回合制协作机制

**轮流行动制（推荐）**:
```
行动顺序: 玩家A → 玩家B → 玩家C → AI → 循环
行动时间: 每人15秒
决策机制: 可以看到队友行动后再决策
配合效果: 更有策略性和配合感
```

**同时行动制**:
```
行动方式: 所有玩家同时下达指令
思考时间: 30秒
执行方式: 指令同时执行
适用场景: 快节奏战斗
```

#### 胜利条件
1. **占领城门**: 控制城门3回合
2. **消灭守军**: 消灭80%的AI部队  
3. **时间限制**: 20回合内达成目标

#### 失败条件
1. **全军覆没**: 所有玩家部队被消灭
2. **时间耗尽**: 20回合后未达成胜利条件

#### 奖励分配机制
```javascript
贡献度计算 = {
  伤害输出: 40%,
  承受伤害: 20%, 
  战术配合: 20%,
  目标贡献: 20%
}

奖励类型 = {
  基础奖励: "所有参与者获得",
  贡献奖励: "按贡献度比例分配", 
  MVP奖励: "贡献度最高者额外奖励"
}
```

### 房间系统设计
```javascript
const siegeRoom = {
  roomId: "siege_001",
  cityId: "core_city_luoyang", 
  maxPlayers: 3,
  currentPlayers: 2,
  status: "waiting", // waiting/in_battle/finished
  players: [
    { playerId: "player_001", ready: true },
    { playerId: "player_002", ready: false }
  ],
  battleConfig: {
    mapSize: "10x12",
    maxRounds: 20,
    aiDifficulty: "hard"
  }
}
```

### 技术实现要点
- **WebSocket实时同步**: 保证多人操作同步
- **断线重连机制**: 处理网络异常
- **观战模式**: 其他玩家可观看战斗
- **聊天系统**: 队友间战术沟通

---

## 🎮 战斗体验优化

### 快节奏设计目标
- **小型战斗**: 3-5分钟解决
- **中型战斗**: 5-8分钟解决  
- **大型战斗**: 8-12分钟解决
- **攻城战**: 10-15分钟解决

### 地图平衡性
- **AI生成地图**: 算法保证公平性和战术多样性
- **手工地图**: 精心设计，确保平衡和趣味性
- **地形效果**: 不同地形提供战术选择
- **出生点**: 确保双方起始位置公平

### 社交体验
- **多人协作**: 增加游戏社交性
- **实时配合**: 考验团队协作能力
- **贡献统计**: 公平的奖励分配机制
- **观战功能**: 增加游戏观赏性
---

## ⏰ 回合时间系统

### 回合时间规则

根据不同的战斗模式，采用不同的时间限制策略：

| 战斗模式 | 行动时间限制 | 超时处理 | 说明 |
|---------|-------------|---------|------|
| **玩家 vs AI** | 无限制 | - | 单人模式，可以慢慢思考 |
| **多人协作 vs AI** | 10秒/人 | 自动待机 | 2-3人协作攻城 |
| **玩家 vs 玩家** | 20秒/人 | 自动待机 | PVP对战 |

### 详细规则说明

#### 玩家 vs AI（单人模式）
```javascript
const singlePlayerMode = {
  timeLimit: null,           // 无时间限制
  pauseAllowed: true,        // 允许暂停
  thinkingTime: "unlimited", // 无限思考时间
  targetDuration: "5-8分钟"  // 目标战斗时长
}
```

**特点**：
- ✅ 无时间压力，适合新手学习
- ✅ 可以仔细规划战术
- ✅ 适合复杂的战役地图挑战

#### 多人协作 vs AI（攻城模式）
```javascript
const coopMode = {
  timeLimit: 10,             // 10秒行动时间
  playerCount: "2-3人",      // 参与人数
  turnOrder: "轮流行动",      // 玩家A→玩家B→玩家C→AI
  timeoutAction: "待机",     // 超时自动待机
  totalDuration: "10-15分钟" // 总战斗时长
}
```

**回合流程**：
```
1. 玩家A行动（10秒倒计时）
   ├─ 有操作：执行指令
   └─ 无操作：所有部队自动待机
   
2. 玩家B行动（10秒倒计时）
   ├─ 有操作：执行指令  
   └─ 无操作：所有部队自动待机
   
3. 玩家C行动（10秒倒计时）
   ├─ 有操作：执行指令
   └─ 无操作：所有部队自动待机
   
4. AI行动（2-3秒思考时间）
   └─ 执行AI策略
   
5. 回到步骤1，开始下一轮
```

#### 玩家 vs 玩家（PVP模式）
```javascript
const pvpMode = {
  timeLimit: 20,             // 20秒行动时间
  playerCount: "1v1",        // 对战人数
  turnOrder: "轮流行动",      // 玩家A→玩家B
  timeoutAction: "待机",     // 超时自动待机
  totalDuration: "8-12分钟"  // 总战斗时长
}
```

**回合流程**：
```
1. 玩家A行动（20秒倒计时）
   ├─ 有操作：执行指令
   └─ 无操作：所有部队自动待机
   
2. 玩家B行动（20秒倒计时）
   ├─ 有操作：执行指令
   └─ 无操作：所有部队自动待机
   
3. 回到步骤1，开始下一轮
```

### 行动顺序系统

#### 速度属性影响
每个部队都有**速度属性**，决定在回合内的行动顺序：

```javascript
// 部队速度示例
const troopSpeeds = {
  "轻骑兵": 8,    // 速度最快，优先行动
  "弓箭手": 6,    // 中等速度
  "轻步兵": 5,    // 中等速度
  "重步兵": 4,    // 较慢
  "重骑兵": 7,    // 骑兵相对较快
  "攻城器械": 2   // 最慢
}
```

#### 行动顺序计算
```javascript
function calculateTurnOrder(playerTroops) {
  // 1. 收集所有部队
  const allTroops = [];
  playerTroops.forEach(troop => {
    allTroops.push({
      troopId: troop.id,
      playerId: troop.playerId,
      speed: troop.speed,
      name: troop.name
    });
  });
  
  // 2. 按速度排序（速度高的先行动）
  allTroops.sort((a, b) => b.speed - a.speed);
  
  // 3. 速度相同时，随机决定顺序
  return allTroops;
}
```

#### 回合内行动顺序示例
```
玩家A的回合（10秒）：
1. 轻骑兵（速度8）先行动
2. 重骑兵（速度7）次行动  
3. 弓箭手（速度6）再行动
4. 重步兵（速度4）最后行动

玩家B的回合（10秒）：
1. 轻骑兵（速度8）先行动
2. 轻步兵（速度5）次行动
3. 攻城器械（速度2）最后行动
```

### 超时处理机制

#### 自动待机规则
```javascript
function handleTimeout(player, troops) {
  troops.forEach(troop => {
    if (!troop.hasActed) {
      // 自动执行待机指令
      troop.action = "wait";
      troop.hasActed = true;
      
      // 记录超时次数
      player.timeoutCount++;
      
      // 显示提示信息
      showMessage(`${troop.name} 超时待机`);
    }
  });
}
```

#### 超时惩罚（可选）
```javascript
const timeoutPenalty = {
  // 连续超时3次，下回合行动时间-2秒
  consecutiveTimeouts: 3,
  timePenalty: -2,
  
  // 单场战斗超时5次，战斗结束后经验-10%
  totalTimeouts: 5,
  expPenalty: -0.1
}
```

### UI界面设计

#### 倒计时显示
```jsx
function TurnTimer({ timeLeft, maxTime, currentPlayer }) {
  const percentage = (timeLeft / maxTime) * 100;
  
  return (
    <div className="turn-timer">
      <div className="timer-bar">
        <div 
          className="timer-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="timer-text">
        {currentPlayer}行动中: {timeLeft}秒
      </div>
    </div>
  );
}
```

#### 行动顺序显示
```jsx
function TurnOrderDisplay({ turnOrder, currentTurn }) {
  return (
    <div className="turn-order">
      <h4>行动顺序</h4>
      {turnOrder.map((troop, index) => (
        <div 
          key={troop.id}
          className={`turn-item ${index === currentTurn ? 'active' : ''}`}
        >
          <span className="speed">⚡{troop.speed}</span>
          <span className="name">{troop.name}</span>
          <span className="player">{troop.playerName}</span>
        </div>
      ))}
    </div>
  );
}
```

### 平衡性考虑

#### 时间设计理由

**10秒（多人协作）**：
- ✅ 足够做出基本决策
- ✅ 保持游戏节奏
- ✅ 避免其他玩家等待过久
- ✅ 考验快速决策能力

**20秒（PVP对战）**：
- ✅ 允许更深入的战术思考
- ✅ 平衡策略性和节奏感
- ✅ 给予足够时间分析对手
- ✅ 避免冲动决策

**无限制（单人）**：
- ✅ 学习和练习模式
- ✅ 适合复杂战役挑战
- ✅ 无社交压力
- ✅ 专注战术研究

#### 速度属性平衡
```javascript
// 速度属性设计原则
const speedBalance = {
  "轻单位": "高速度，低防御",     // 8-9速度
  "重单位": "低速度，高防御",     // 3-4速度  
  "远程单位": "中等速度",        // 5-6速度
  "骑兵单位": "较高速度",        // 6-8速度
  "攻城单位": "极低速度，高攻击" // 1-2速度
}
```

### 技术实现要点

#### WebSocket同步
```javascript
// 回合时间同步
socket.emit('turn_start', {
  playerId: currentPlayer,
  timeLimit: getTimeLimit(gameMode),
  turnOrder: calculateTurnOrder(troops)
});

// 超时处理
socket.on('turn_timeout', (data) => {
  handleTimeout(data.playerId, data.troops);
  nextTurn();
});
```

#### 断线重连
```javascript
// 玩家断线时暂停计时
function handleDisconnect(playerId) {
  if (currentPlayer === playerId) {
    pauseTimer();
    showMessage(`${playerId} 断线，等待重连...`);
  }
}

// 重连后恢复计时
function handleReconnect(playerId) {
  if (currentPlayer === playerId) {
    resumeTimer();
    showMessage(`${playerId} 重连成功`);
  }
}
```

### 总结

这个回合时间系统设计具有以下特点：

1. **差异化设计**：不同模式不同时间限制
2. **公平性**：速度属性决定行动顺序
3. **用户友好**：超时自动待机，不会卡住游戏
4. **节奏控制**：保证战斗在合理时间内结束
5. **策略深度**：时间压力增加决策挑战

**实现优先级**：
- **M2阶段**：基础计时器和超时处理
- **M3阶段**：速度系统和行动顺序
- **后续版本**：超时惩罚和高级功能
---

## 🎯 部队布阵系统

### 布阵方式

玩家可以通过两种方式布置部队：

| 布阵方式 | 说明 | 适用场景 |
|---------|------|---------|
| **手动布阵** | 玩家逐个拖拽部队到指定位置 | 精确战术布局 |
| **一键布阵** | 系统自动根据部队类型智能布阵 | 快速开始战斗 |

### 一键布阵算法

#### 布阵优先级
```javascript
const deploymentPriority = {
  1: "尝试匹配经典阵型",
  2: "根据部队类型分组布置", 
  3: "居中靠前安置（兜底方案）"
}
```

#### 阵型匹配规则

**锋矢阵（3-5支部队）**：
```javascript
const wedgeFormation = {
  requiredTroops: 3,
  preferredTypes: ["cavalry", "infantry"],
  layout: {
    3: [
      "  🐎  ",    // 前锋：骑兵
      " 🛡️🛡️ "     // 后排：步兵
    ],
    4: [
      "  🐎  ",    // 前锋：骑兵
      " 🛡️🛡️ ",    // 中排：步兵
      "  🏹️  "     // 后排：弓兵
    ],
    5: [
      "  🐎  ",    // 前锋：骑兵
      " 🛡️🛡️ ",    // 中排：步兵
      " 🏹️🏹️ "     // 后排：弓兵
    ]
  }
}
```

**鹤翼阵（4-5支部队）**：
```javascript
const craneWingFormation = {
  requiredTroops: 4,
  preferredTypes: ["mixed"],
  layout: {
    4: [
      "🏹️  🏹️",    // 两翼：弓兵
      " 🛡️🛡️ "     // 中央：步兵
    ],
    5: [
      "🏹️  🏹️",    // 两翼：弓兵
      " 🛡️🐎 ",    // 中央：步兵+骑兵
      "  🛡️  "     // 后排：步兵
    ]
  }
}
```

**鱼鳞阵（3-4支部队）**：
```javascript
const fishScaleFormation = {
  requiredTroops: 3,
  preferredTypes: ["infantry", "archer"],
  layout: {
    3: [
      " 🛡️ ",      // 前排：重步兵
      "🏹️🏹️"       // 后排：弓兵
    ],
    4: [
      " 🛡️🛡️ ",    // 前排：重步兵
      " 🏹️🏹️ "     // 后排：弓兵
    ]
  }
}
```

#### 部队类型识别
```javascript
function identifyTroopTypes(troops) {
  const types = {
    cavalry: [],    // 骑兵
    infantry: [],   // 步兵
    archer: [],     // 弓兵
    siege: []       // 攻城器械
  };
  
  troops.forEach(troop => {
    if (troop.type.includes('cavalry')) {
      types.cavalry.push(troop);
    } else if (troop.type.includes('archer')) {
      types.archer.push(troop);
    } else if (troop.type.includes('siege')) {
      types.siege.push(troop);
    } else {
      types.infantry.push(troop);
    }
  });
  
  return types;
}
```

#### 阵型选择算法
```javascript
function selectFormation(troops) {
  const troopCount = troops.length;
  const types = identifyTroopTypes(troops);
  
  // 1. 根据部队数量和类型选择阵型
  if (troopCount >= 3 && types.cavalry.length >= 1) {
    return 'wedge';        // 锋矢阵：有骑兵，适合突击
  } else if (troopCount >= 4 && types.archer.length >= 2) {
    return 'craneWing';    // 鹤翼阵：弓兵多，适合包围
  } else if (troopCount >= 3 && types.infantry.length >= 1) {
    return 'fishScale';    // 鱼鳞阵：步兵为主，适合防守
  } else {
    return 'default';      // 默认布阵：居中靠前
  }
}
```

#### 布阵实现算法
```javascript
function autoDeployTroops(troops, mapSize, playerSide) {
  const formation = selectFormation(troops);
  const deploymentZone = getDeploymentZone(mapSize, playerSide);
  
  switch (formation) {
    case 'wedge':
      return deployWedgeFormation(troops, deploymentZone);
    case 'craneWing':
      return deployCraneWingFormation(troops, deploymentZone);
    case 'fishScale':
      return deployFishScaleFormation(troops, deploymentZone);
    default:
      return deployDefaultFormation(troops, deploymentZone);
  }
}

// 默认布阵：居中靠前
function deployDefaultFormation(troops, zone) {
  const positions = [];
  const centerX = Math.floor(zone.width / 2);
  const startY = zone.startY;
  
  troops.forEach((troop, index) => {
    const offsetX = index - Math.floor(troops.length / 2);
    positions.push({
      troopId: troop.id,
      x: Math.max(0, Math.min(zone.width - 1, centerX + offsetX)),
      y: startY + Math.floor(index / zone.width)
    });
  });
  
  return positions;
}
```

### 部署区域定义

#### 不同地图尺寸的部署区域
```javascript
const deploymentZones = {
  // 小型地图 4x6
  small: {
    player: { startY: 4, endY: 5, width: 4 },    // 玩家：底部2行
    enemy: { startY: 0, endY: 1, width: 4 }      // 敌人：顶部2行
  },
  
  // 中型地图 6x8  
  medium: {
    player: { startY: 6, endY: 7, width: 6 },    // 玩家：底部2行
    enemy: { startY: 0, endY: 1, width: 6 }      // 敌人：顶部2行
  },
  
  // 大型地图 8x10
  large: {
    player: { startY: 8, endY: 9, width: 8 },    // 玩家：底部2行
    enemy: { startY: 0, endY: 1, width: 8 }      // 敌人：顶部2行
  },
  
  // 超大地图 10x12（多人协作）
  xlarge: {
    playerA: { startY: 10, endY: 11, width: 3 }, // 玩家A：左下角
    playerB: { startY: 10, endY: 11, width: 3, offsetX: 7 }, // 玩家B：右下角
    playerC: { startY: 9, endY: 9, width: 4, offsetX: 3 },   // 玩家C：中下
    enemy: { startY: 0, endY: 1, width: 10 }     // 敌人：顶部2行
  }
}
```

### UI界面设计

#### 布阵界面
```jsx
function DeploymentInterface({ troops, mapSize, onDeploymentComplete }) {
  const [deploymentMode, setDeploymentMode] = useState('auto');
  const [positions, setPositions] = useState([]);
  
  const handleAutoDeployment = () => {
    const autoPositions = autoDeployTroops(troops, mapSize, 'player');
    setPositions(autoPositions);
  };
  
  return (
    <div className="deployment-interface">
      <div className="deployment-controls">
        <button 
          className={`btn ${deploymentMode === 'auto' ? 'active' : ''}`}
          onClick={() => setDeploymentMode('auto')}
        >
          一键布阵
        </button>
        <button 
          className={`btn ${deploymentMode === 'manual' ? 'active' : ''}`}
          onClick={() => setDeploymentMode('manual')}
        >
          手动布阵
        </button>
      </div>
      
      {deploymentMode === 'auto' && (
        <div className="auto-deployment">
          <button onClick={handleAutoDeployment}>
            🎯 智能布阵
          </button>
          <div className="formation-preview">
            预计阵型: {getFormationName(selectFormation(troops))}
          </div>
        </div>
      )}
      
      <div className="battlefield-preview">
        {/* 地图预览和部队位置 */}
        <BattlefieldGrid 
          positions={positions}
          troops={troops}
          onPositionChange={setPositions}
          readonly={deploymentMode === 'auto'}
        />
      </div>
      
      <button 
        className="btn-primary"
        onClick={() => onDeploymentComplete(positions)}
        disabled={positions.length !== troops.length}
      >
        开始战斗
      </button>
    </div>
  );
}
```

#### 阵型说明提示
```jsx
function FormationTooltip({ formation }) {
  const formationInfo = {
    wedge: {
      name: "锋矢阵",
      description: "骑兵前锋，步兵支援，适合突击",
      advantage: "攻击力+20%，突破力+30%"
    },
    craneWing: {
      name: "鹤翼阵", 
      description: "两翼包抄，中央坚守，适合包围",
      advantage: "包围伤害+25%，侧翼防护+20%"
    },
    fishScale: {
      name: "鱼鳞阵",
      description: "层层防御，步步为营，适合防守", 
      advantage: "防御力+20%，反击伤害+20%"
    },
    default: {
      name: "散兵布阵",
      description: "居中靠前，灵活机动",
      advantage: "无特殊加成，但布阵灵活"
    }
  };
  
  const info = formationInfo[formation];
  
  return (
    <div className="formation-tooltip">
      <h4>{info.name}</h4>
      <p>{info.description}</p>
      <div className="advantage">{info.advantage}</div>
    </div>
  );
}
```

### 布阵验证规则

#### 合法性检查
```javascript
function validateDeployment(positions, deploymentZone) {
  const errors = [];
  
  positions.forEach((pos, index) => {
    // 检查是否在部署区域内
    if (pos.y < deploymentZone.startY || pos.y > deploymentZone.endY) {
      errors.push(`部队${index + 1}不在部署区域内`);
    }
    
    // 检查是否重叠
    const overlapping = positions.find((other, otherIndex) => 
      otherIndex !== index && other.x === pos.x && other.y === pos.y
    );
    if (overlapping) {
      errors.push(`部队${index + 1}位置重叠`);
    }
  });
  
  return errors;
}
```

### 实现优先级

#### M2阶段（基础功能）
- ✅ 手动拖拽布阵
- ✅ 一键布阵（默认居中靠前）
- ✅ 部署区域限制
- ✅ 位置合法性验证

#### M3阶段（阵型系统）
- [ ] 3种经典阵型实现
- [ ] 部队类型识别算法
- [ ] 阵型选择逻辑
- [ ] 阵型效果加成

#### 后续版本（高级功能）
- [ ] 更多阵型选择
- [ ] 自定义阵型保存
- [ ] 阵型克制关系
- [ ] AI阵型识别和应对

### 总结

一键布阵系统的设计特点：

1. **智能化**：根据部队类型自动选择最适合的阵型
2. **兜底机制**：无法布阵时居中靠前安置
3. **用户友好**：既支持快速开始，也支持精确控制
4. **战术深度**：不同阵型提供不同的战斗加成
5. **可扩展性**：后续可以添加更多阵型和功能

这个系统将大大提升游戏的易用性和战术深度！
---

## 🎮 回合时间系统设计

**更新日期**: 2026-02-11  
**设计状态**: ✅ 已确定

### 回合时间规则

根据不同战斗模式，采用不同的回合时间限制：

#### 1. 玩家 vs AI
```javascript
const playerVsAI = {
  timeLimit: null,           // 无时间限制
  description: "玩家可以充分思考策略",
  autoAction: false,         // 不会自动行动
  reason: "单机模式，不影响其他玩家"
};
```

#### 2. 多人协作 vs AI
```javascript
const multiPlayerVsAI = {
  timeLimit: 10,             // 10秒/人
  description: "每个玩家有10秒思考时间",
  autoAction: "standby",     // 超时自动待机
  reason: "避免其他玩家长时间等待"
};
```

#### 3. 玩家 vs 玩家（PVP）
```javascript
const playerVsPlayer = {
  timeLimit: 20,             // 20秒/人
  description: "每个玩家有20秒思考时间",
  autoAction: "standby",     // 超时自动待机
  reason: "平衡策略深度和游戏节奏"
};
```

### 行动顺序系统

#### 速度属性影响
```javascript
// 行动顺序计算
const calculateActionOrder = (units) => {
  return units.sort((a, b) => {
    // 主要按速度排序
    if (a.speed !== b.speed) {
      return b.speed - a.speed;  // 速度高的先行动
    }
    
    // 速度相同时按运气排序
    if (a.luck !== b.luck) {
      return b.luck - a.luck;
    }
    
    // 都相同时随机决定
    return Math.random() - 0.5;
  });
};
```

#### 行动顺序示例
```javascript
// 战斗单位示例
const battleUnits = [
  { name: "赵云", speed: 8.8, luck: 8.8, type: "player" },
  { name: "关羽", speed: 7.0, luck: 7.0, type: "player" },
  { name: "张飞", speed: 6.8, luck: 6.8, type: "player" },
  { name: "敌将A", speed: 7.5, luck: 6.0, type: "ai" },
  { name: "敌将B", speed: 6.5, luck: 7.0, type: "ai" }
];

// 排序后的行动顺序
const actionOrder = [
  "赵云",    // 速度8.8，最快
  "敌将A",   // 速度7.5，第二快
  "关羽",    // 速度7.0，第三
  "张飞",    // 速度6.8，第四
  "敌将B"    // 速度6.5，最慢
];
```

### UI界面设计

#### 时间显示
```javascript
const timeDisplayUI = {
  // 倒计时显示
  countdown: {
    position: "屏幕右上角",
    format: "剩余时间: 08秒",
    color: {
      normal: "text-blue-600",      // 正常时间（>5秒）
      warning: "text-yellow-600",   // 警告时间（3-5秒）
      danger: "text-red-600"        // 危险时间（<3秒）
    },
    animation: "最后3秒闪烁提醒"
  },
  
  // 行动顺序显示
  actionOrder: {
    position: "屏幕左侧",
    format: "头像列表，当前行动者高亮",
    indicator: "箭头指向当前行动单位"
  }
};
```

#### 超时处理
```javascript
const timeoutHandling = {
  // 超时警告
  warning: {
    at: 3,                    // 剩余3秒时警告
    effect: "屏幕边缘红色闪烁",
    sound: "滴答声提醒"
  },
  
  // 超时执行
  timeout: {
    action: "standby",        // 自动待机
    message: "时间到！自动待机",
    duration: 2,              // 提示显示2秒
    nextTurn: true            // 立即切换到下一个单位
  }
};
```

### 技术实现要点

#### 计时器管理
```javascript
class TurnTimer {
  constructor(timeLimit) {
    this.timeLimit = timeLimit;
    this.remainingTime = timeLimit;
    this.isRunning = false;
    this.timer = null;
  }
  
  start() {
    if (!this.timeLimit) return; // 无限制模式
    
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.remainingTime--;
      
      // 更新UI显示
      this.updateUI();
      
      // 检查超时
      if (this.remainingTime <= 0) {
        this.timeout();
      }
    }, 1000);
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.isRunning = false;
    }
  }
  
  timeout() {
    this.stop();
    // 执行超时操作（待机）
    this.executeStandby();
  }
  
  executeStandby() {
    // 自动待机逻辑
    console.log("时间到！自动待机");
    // 切换到下一个行动单位
    this.nextTurn();
  }
}
```

#### 网络同步（多人模式）
```javascript
const networkSync = {
  // 发送行动
  sendAction: (action) => {
    const actionData = {
      playerId: currentPlayer.id,
      action: action,
      timestamp: Date.now(),
      turnId: currentTurn.id
    };
    
    websocket.send(JSON.stringify(actionData));
  },
  
  // 接收行动
  receiveAction: (actionData) => {
    // 验证行动有效性
    if (validateAction(actionData)) {
      executeAction(actionData);
      nextTurn();
    }
  },
  
  // 同步计时器
  syncTimer: (timeData) => {
    turnTimer.remainingTime = timeData.remainingTime;
    turnTimer.updateUI();
  }
};
```

### 平衡性考虑

#### 时间限制设计理念
```javascript
const designPhilosophy = {
  // 玩家 vs AI：无限制
  playerVsAI: {
    reason: "单机体验，允许充分思考",
    benefit: "新手友好，策略深度"
  },
  
  // 多人协作：10秒
  cooperation: {
    reason: "避免其他玩家等待过久",
    benefit: "保持游戏节奏，团队配合"
  },
  
  // 玩家对战：20秒
  pvp: {
    reason: "平衡策略思考和游戏节奏",
    benefit: "足够思考时间，避免拖沓"
  }
};
```

#### 速度属性价值
```javascript
const speedValue = {
  importance: "高",
  reason: "决定行动顺序，影响战斗主动权",
  
  // 速度差异影响
  speedDifference: {
    small: "0.1-0.5差异，影响较小",
    medium: "0.6-1.0差异，明显优势", 
    large: "1.1+差异，压倒性优势"
  },
  
  // 与其他属性平衡
  balance: {
    vs_attack: "速度高但攻击低 vs 攻击高但速度低",
    vs_defense: "先手攻击 vs 后手反击",
    vs_luck: "行动顺序 vs 闪避能力"
  }
};
```

---

## 🏰 战斗地图与部署系统

**更新日期**: 2026-02-11  
**设计状态**: ✅ 已确定

### 地图尺寸标准

采用俯视角（Top-down）视角，根据战斗规模设定不同地图尺寸：

#### 地图尺寸分类
```javascript
const mapSizes = {
  small: {
    size: "4x6",
    gridCount: 24,
    description: "小型战斗",
    playerCount: "2-4人",
    troopCount: "6-10支部队",
    useCase: "快速战斗、教学关卡"
  },
  
  medium: {
    size: "6x8", 
    gridCount: 48,
    description: "中型战斗",
    playerCount: "4-6人",
    troopCount: "10-15支部队",
    useCase: "标准战斗、多数关卡"
  },
  
  large: {
    size: "8x10",
    gridCount: 80,
    description: "大型战斗", 
    playerCount: "6-8人",
    troopCount: "15-20支部队",
    useCase: "重要战役、团队战"
  },
  
  xlarge: {
    size: "10x12",
    gridCount: 120,
    description: "超大型战斗",
    playerCount: "8-12人", 
    troopCount: "20-30支部队",
    useCase: "史诗战役、赛季决战"
  }
};
```

### 部署位置系统

#### 部署区域设计
```javascript
const deploymentZones = {
  // 标准6x8地图示例
  playerZone: {
    area: "底部2行（第7-8行）",
    positions: [
      [6,0], [6,1], [6,2], [6,3], [6,4], [6,5],
      [7,0], [7,1], [7,2], [7,3], [7,4], [7,5]
    ],
    maxUnits: 12,
    description: "玩家部队部署区域"
  },
  
  enemyZone: {
    area: "顶部2行（第0-1行）", 
    positions: [
      [0,0], [0,1], [0,2], [0,3], [0,4], [0,5],
      [1,0], [1,1], [1,2], [1,3], [1,4], [1,5]
    ],
    maxUnits: 12,
    description: "敌方部队部署区域"
  },
  
  neutralZone: {
    area: "中间4行（第2-5行）",
    positions: "战斗区域，不可部署",
    description: "战斗进行区域"
  }
};
```

#### 部署规则
```javascript
const deploymentRules = {
  // 基础规则
  basic: {
    oneUnitPerGrid: true,      // 每格只能部署一个单位
    withinZone: true,          // 必须在指定区域内
    noOverlap: true,           // 不能重叠部署
    mustDeploy: true           // 必须部署所有可用单位
  },
  
  // 部署限制
  restrictions: {
    maxUnitsPerRow: 6,         // 每行最多6个单位
    minDistance: 0,            // 最小间距（相邻可以）
    specialPositions: [],      // 特殊位置限制
    terrainRestrictions: []    // 地形限制
  },
  
  // 部署顺序
  order: {
    phase: "战斗开始前",
    timeLimit: 60,             // 60秒部署时间
    playerFirst: true,         // 玩家先部署
    simultaneous: false        // 非同时部署
  }
};
```

### 一键布阵系统

#### 自动布阵逻辑
```javascript
const autoDeployment = {
  // 布阵优先级
  priority: {
    1: "根据部队类型选择阵型",
    2: "优先布阵型（如有合适部队）",
    3: "兜底方案：居中靠前安置"
  },
  
  // 阵型选择算法
  formationSelection: {
    // 锋矢阵：适合骑兵多的情况
    wedge: {
      condition: "骑兵数量 >= 总数的50%",
      pattern: "三角形尖锐阵型",
      effect: "增强突击能力"
    },
    
    // 鹤翼阵：适合弓兵多的情况  
    crane: {
      condition: "弓兵数量 >= 总数的40%",
      pattern: "展开翼状阵型",
      effect: "增强射击覆盖"
    },
    
    // 鱼鳞阵：适合步兵多的情况
    scale: {
      condition: "步兵数量 >= 总数的60%",
      pattern: "层次防御阵型", 
      effect: "增强防御能力"
    },
    
    // 兜底方案：居中靠前
    default: {
      condition: "无特定兵种优势",
      pattern: "居中靠前排列",
      effect: "均衡布局"
    }
  }
};
```

#### 布阵算法实现
```javascript
class AutoDeployment {
  constructor(troops, mapSize) {
    this.troops = troops;
    this.mapSize = mapSize;
    this.deploymentZone = this.getDeploymentZone();
  }
  
  // 分析部队构成
  analyzeTroopComposition() {
    const composition = {
      infantry: 0,
      cavalry: 0, 
      archer: 0,
      total: this.troops.length
    };
    
    this.troops.forEach(troop => {
      composition[troop.type]++;
    });
    
    return {
      infantry: composition.infantry / composition.total,
      cavalry: composition.cavalry / composition.total,
      archer: composition.archer / composition.total
    };
  }
  
  // 选择阵型
  selectFormation() {
    const composition = this.analyzeTroopComposition();
    
    if (composition.cavalry >= 0.5) {
      return 'wedge';      // 锋矢阵
    } else if (composition.archer >= 0.4) {
      return 'crane';      // 鹤翼阵
    } else if (composition.infantry >= 0.6) {
      return 'scale';      // 鱼鳞阵
    } else {
      return 'default';    // 默认阵型
    }
  }
  
  // 执行布阵
  deploy() {
    const formation = this.selectFormation();
    const positions = this.calculatePositions(formation);
    
    return this.assignTroopsToPositions(positions);
  }
  
  // 计算位置
  calculatePositions(formation) {
    switch(formation) {
      case 'wedge':
        return this.calculateWedgePositions();
      case 'crane':
        return this.calculateCranePositions();
      case 'scale':
        return this.calculateScalePositions();
      default:
        return this.calculateDefaultPositions();
    }
  }
  
  // 默认布阵：居中靠前
  calculateDefaultPositions() {
    const positions = [];
    const centerX = Math.floor(this.mapSize.width / 2);
    const startY = this.deploymentZone.startY;
    
    // 优先前排，然后后排
    let currentX = centerX;
    let currentY = startY;
    let direction = 1; // 1为右，-1为左
    
    for (let i = 0; i < this.troops.length; i++) {
      positions.push([currentY, currentX]);
      
      // 计算下一个位置
      currentX += direction;
      direction *= -1;
      
      if (Math.abs(currentX - centerX) > Math.floor(this.mapSize.width / 2)) {
        currentY++;
        currentX = centerX;
        direction = 1;
      }
    }
    
    return positions;
  }
}
```

### 地图生成策略

#### 地图类型
```javascript
const mapGeneration = {
  // AI随机生成（小地图）
  aiGenerated: {
    mapTypes: ["4x6", "6x8"],
    features: ["基础地形", "简单障碍"],
    generation: "程序化生成",
    useCase: "日常战斗、练习关卡"
  },
  
  // 手工设计（重要地图）
  handCrafted: {
    mapTypes: ["8x10", "10x12"],
    features: ["复杂地形", "战略要点", "特殊机制"],
    generation: "人工设计",
    useCase: "重要战役、剧情关卡"
  }
};
```

#### 地形要素
```javascript
const terrainElements = {
  // 基础地形
  basic: {
    plain: "平原（无影响）",
    forest: "森林（弓兵+1攻击，骑兵-1移动）",
    hill: "丘陵（所有单位+1防御）",
    river: "河流（移动消耗+1）"
  },
  
  // 战略要素
  strategic: {
    bridge: "桥梁（控制要点）",
    fortress: "要塞（防御+2）",
    tower: "箭塔（范围攻击）",
    gate: "城门（可破坏障碍）"
  }
};
```

### 视角与美术

#### 俯视角优势
```javascript
const topDownAdvantages = {
  development: {
    aiArt: "AI绘图工作量较小",
    consistency: "风格统一性好",
    speed: "制作速度快"
  },
  
  gameplay: {
    clarity: "战场情况一目了然",
    strategy: "便于战术规划",
    ui: "UI元素布局简单"
  },
  
  technical: {
    performance: "渲染性能好",
    responsive: "适配不同屏幕",
    development: "开发难度低"
  }
};
```

#### 美术资源策略
```javascript
const artStrategy = {
  // 优先级1：免费素材库
  freeAssets: {
    source: "OpenGameArt, Kenney.nl等",
    usage: "快速验证功能",
    replacement: "后续可替换为原创"
  },
  
  // 优先级2：AI生成
  aiGenerated: {
    source: "Stable Diffusion, Midjourney等",
    usage: "补充缺失素材",
    style: "保持风格统一"
  },
  
  // 优先级3：原创制作
  original: {
    source: "专业美术师",
    usage: "核心角色、重要场景",
    timing: "商业化后考虑"
  }
};
```