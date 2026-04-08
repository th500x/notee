# 战斗系统 - 完整设计文档

## 📋 文档概述

本文档详细说明《真三风云》的战斗系统，包括伤害计算、命中闪避、暴击系统、回合控制等核心机制。

**最后更新**：2026-04-07  
**文档版本**：v3.9.8

---

## 📁 相关文档

### 核心文档

- **本文档** - 战斗系统完整设计（包含最新战斗公式）
- **战斗模拟报告** - `docs/BATTLE_SIMULATION_REPORT.md` - 48场战斗的详细模拟结果
- **最终战斗分析** - `docs/FINAL_COMBAT_ANALYSIS.md` - 战斗系统达成目标评估

### 城防与攻城（场景边界）

- **[13-2-CITY_DEFENSE_SYSTEM.md](./13-2-CITY_DEFENSE_SYSTEM.md)** - 守城卡池、披挂上阵、攻城防守队列与战线锁；**非**本文战斗公式范畴
- **[17-3-SIEGE_SYSTEM.md](./17-3-SIEGE_SYSTEM.md)** - 攻城流程、`siege-result`、战事与城市状态

### 工具文件

- **战斗模拟器** - `docs/tools/battle-simulator.cjs` - 模拟战斗并生成报告

**运行方式**：
```bash
node docs/tools/battle-simulator.cjs
```

---

## 目录

1. [战斗核心机制](#战斗核心机制)
2. [命中与闪避系统](#命中与闪避系统)
3. [伤害计算系统](#伤害计算系统)
4. [暴击系统](#暴击系统)
5. [防御系统](#防御系统)
6. [回合控制系统](#回合控制系统)
7. [士气系统](#士气系统)
8. [战斗模拟结果](#战斗模拟结果)
9. [完整战斗流程代码](#完整战斗流程代码)
10. [系统特点总结](#系统特点总结)
11. [战斗动画系统](#战斗动画系统)
12. [手动战斗系统](#手动战斗系统)
13. [磨损衰减系统](#磨损衰减系统)
14. [自动战斗接管机制](#自动战斗接管机制)

---

## ⚔️ 战斗核心机制

### 1. 攻击流程

```
发起攻击 → 命中判定 → 伤害计算 → 暴击判定 → 防御减免 → 兵力比例系数 → 最终伤害
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

### 闪避率范围

根据将领运气属性范围：

| 运气值 | 闪避率 | 说明 |
|--------|--------|------|
| 3.0 | 3% | 最低闪避（属性下限） |
| 5.0 | 5% | 普通将领 |
| 7.0 | 7% | 优秀将领 |
| 8.0 | 8% | 高运气将领 |
| 9.0 | 9% | 极高运气 |
| 10.0 | 10% | 满运气（传奇/核心） |

**设计理念**：
- 闪避率不会太高（最高10%），保持战斗稳定性
- 运气差异带来明显但不过分的闪避差距
- 简单易懂，便于玩家理解

---

## 💥 伤害计算系统

### 物理伤害公式（完整版）

```javascript
// 1. 单兵基础攻击力
单兵基础攻击力 = 部队攻击力 + (将领武力 × 6)

// 2. 勇气加成
勇气加成 = 1 + (勇气 / 40)  // 最高+25%

// 3. 单兵最终攻击力
单兵最终攻击力 = 单兵基础攻击力 × 勇气加成

// 4. 战损兵力比例（攻击方输出缩放）
//    troopWeight ≤ 1：兵力比例 = 当前兵力 / 最大兵力（线性）
//    troopWeight > 1：兵力比例 = (当前兵力 / 最大兵力) ^ 0.85（凹曲线，残血衰减慢于线性；现配置仅燕云十八等）
// 5. 总伤害（暴击前）
总伤害 = 单兵最终攻击力 × 兵力比例

// 6. 暴击判定
暴击率 = (勇气 + 运气) / 80  // 最高25%
if (暴击) {
  总伤害 × 1.5
}

// 7. 士气加成
总伤害 × 士气攻击系数

// 8. 防御减免
物理防御 = 部队防御力 + (统帅 × 5 + 武力 × 3)
防御比例 = 与第4步相同规则（troopWeight>1 时用 (当前/最大)^0.85）
总防御力 = 物理防御 × 防御比例
伤害减免 = 总防御力 / (总防御力 + 140)
实际伤害 = 总伤害 × (1 - 伤害减免) × 士气防御系数

// 9. 兵力比例系数（加上限，防止精锐小队被碾压）
等效兵力_攻 = 攻击方最大兵力 × 攻击方兵力权重(troopWeight，默认1)
等效兵力_防 = 防守方最大兵力 × 防守方兵力权重(troopWeight，默认1)
原始比例 = 等效兵力_攻 / 等效兵力_防
兵力比例系数 = clamp(原始比例, 0.33, 3.0)  // 上限3.0，下限0.33
最终伤害 = 实际伤害 × 兵力比例系数
```

### 关键设计说明

#### 1. 兵力比例系数上下限 + 兵力权重

```javascript
// 等效兵力 = maxTroops × troopWeight
// 兵力比例系数限制在 [0.33, 3.0] 范围内
const atkEffective = atk.maxTroops * (atk.troopWeight || 1);
const defEffective = def.maxTroops * (def.troopWeight || 1);
troopRatioCoeff = Math.min(3.0, Math.max(0.33, atkEffective / defEffective));

// 示例：燕云十八(maxTroops=180, troopWeight=3) vs 虎豹骑(maxTroops=600, troopWeight=1)
// 等效兵力：180×3=540 vs 600×1=600
// 原始比例 = 540/600 = 0.9 → 接近1:1，精锐小队战力接近标准部队

// 示例：虎豹骑(600) vs 燕云十八(180, weight=3)
// 等效兵力：600 vs 540
// 原始比例 = 600/540 = 1.11 → 标准部队略占优势，但不会碾压
```

#### 2. 兵力比例系数的实际效果
```javascript
// 攻击方（600兵力）攻击防守方（200兵力）
兵力比例系数 = min(3.0, 600 / 200) = 3.0
最终伤害 = 100 × 3.0 = 300  // 伤害提升3倍（达到上限）

// 防守方（200兵力）反击攻击方（600兵力）
兵力比例系数 = max(0.33, 200 / 600) = 0.333
最终伤害 = 100 × 0.333 = 33.3  // 伤害削弱到1/3

// 极端情况：普通部队(500) vs 精锐小队(18)
兵力比例系数 = min(3.0, 500 / 18) = 3.0  // 原始27.78被cap到3.0
// 精锐小队不会被一击秒杀
```

#### 3. 动态伤害衰减（默认部队 troopWeight ≤ 1）
```javascript
// 随着战斗进行，兵力减少，伤害输出也会降低（线性）
初始状态：600兵力 → 兵力比例 1.0 → 100%伤害输出
损失100人：500兵力 → 兵力比例 0.833 → 83.3%伤害输出
损失200人：400兵力 → 兵力比例 0.667 → 66.7%伤害输出
损失300人：300兵力 → 兵力比例 0.5 → 50%伤害输出
```

#### 4. 精锐小队战损曲线（troopWeight > 1）

- **触发条件**：仅当 `troopWeight > 1` 时启用；配置见 `docs/tools/troop/troop-template.csv` 的 `troop_weight` 列（空或 1 与普通部队相同）。**现阶段仅燕云十八（`san_1_troop_1007`，troop_weight=3）**，其余部队战斗模型不变。
- **公式**：`战损兵力比例 = clamp(当前/最大, 0, 1) ^ 0.85`（指数 `ELITE_TROOP_STRENGTH_EXPONENT = 0.85`，实现见 `game/src/systems/combatSystem.js` 的 `troopStrengthRatioFromCasualties`）。
- **攻击与防御**均使用该比例缩放「单兵环节」后的总攻/总防（与第 9 步「等效兵力×权重」的 clamp 系数独立；后者仍只用 **最大兵力 × troopWeight**，不随当前兵力变化）。
- **意图**：精锐人少时，同样战损百分比下输出/坦度衰减慢于线性，避免「等效满编 540」在残血时体感过脆。
- **数值示例**（燕云 max=180）：50% 兵（90 人）时线性比例为 0.5，精锐曲线为 `0.5^0.85 ≈ 0.55`，约 **+10%** 相对线性；30% 兵时 `0.3^0.85 ≈ 0.35` 对比线性 0.3 约 **+17%**。

### 计谋伤害公式

```javascript
// 基础计谋伤害
基础计谋伤害 = 智力 × 10

// 运气加成
运气加成 = 1 + (运气 / 40)  // 最高+25%

// 最终计谋伤害
最终计谋伤害 = 基础计谋伤害 × 运气加成
```

**说明**：
- 计谋伤害**只考虑智力**，不受政治和魅力影响
- 运气影响计谋伤害（类似勇气影响物理伤害）
- 勇气和运气的加成从 /20 调整为 /40，降低属性加成，保持平衡

---

## ⚡ 暴击系统

### 暴击率计算

```javascript
暴击率 = (勇气 + 运气) / 80  // 最高25%
```

### 暴击伤害

```javascript
暴击伤害 = 最终伤害 × 1.5
```

### 暴击率范围

| 勇气+运气 | 暴击率 | 说明 |
|-----------|--------|------|
| 6.0 | 7.5% | 最低（属性下限） |
| 10.0 | 12.5% | 普通将领 |
| 14.0 | 17.5% | 优秀将领 |
| 16.0 | 20% | 高级将领 |
| 18.0 | 22.5% | 顶级将领 |
| 20.0 | 25% | 满暴击（理论最大） |

---

## 🛡️ 防御系统

### 物理防御（完整版）

```javascript
// 1. 单兵基础防御力
单兵基础防御力 = 部队防御力 + (统帅 × 5 + 武力 × 3)

// 2. 兵力比例
兵力比例 = 当前兵力 / 最大兵力

// 3. 总防御力
总防御力 = 单兵基础防御力 × 兵力比例

// 4. 伤害减免
伤害减免 = 总防御力 / (总防御力 + 140)

// 5. 实际受到物理伤害
实际物理伤害 = 物理攻击伤害 × (1 - 伤害减免)
```

**关键点**：
- 防御力也受兵力影响！兵力越多，总防御力越高
- 随着兵力损失，防御力按比例降低，更容易被击杀
- 例如：600兵力的部队比200兵力的部队防御力高3倍

### 计谋防御

```javascript
// 计谋防御力
计谋防御 = 智力 × 6

// 计谋伤害减免
计谋减免 = 计谋防御 / (计谋防御 + 140)

// 实际受到计谋伤害
实际计谋伤害 = 计谋攻击伤害 × (1 - 计谋减免)
```

---

## 🎲 回合控制系统

### 目标回合数规则

战斗回合数根据双方稀有度等级差异确定：

```javascript
同级对战: 5回合
跨1级: 4回合 (legendary vs epic, epic vs rare, rare vs common)
跨2级: 3回合 (legendary vs rare, epic vs common)
跨3级: 2回合 (legendary vs common)
```

### 稀有度等级映射

```javascript
const rarityLevels = {
  'common': 1,
  'rare': 2,
  'epic': 3,
  'legendary': 4
};

// 计算目标回合数
levelDiff = Math.abs(attackerLevel - defenderLevel);
targetRounds = Math.max(2, 5 - levelDiff);
```

### 战损惩罚系统

低级部队攻击高级部队时，会受到战损惩罚：

```javascript
// 战损惩罚系数
if (attackerLevel >= defenderLevel) {
  penalty = 1.0;  // 高打低或同级，无惩罚
} else {
  levelDiff = defenderLevel - attackerLevel;
  penalty = 1.0 + (levelDiff × 0.5);  // 每跨1级增加0.5倍战损
}

// 应用到防守方反击伤害
defenderDamagePerRound × attackerPenalty
```

**惩罚表**：

| 对战情况 | 战损惩罚 | 说明 |
|---------|---------|------|
| 同级或高打低 | 1.0x | 无惩罚 |
| 低打高跨1级 | 1.5x | common vs rare, rare vs epic, epic vs legendary |
| 低打高跨2级 | 2.0x | common vs epic, rare vs legendary |
| 低打高跨3级 | 2.5x | common vs legendary |

### 每回合伤害计算

```javascript
// 攻击方每回合伤害
const attackerTroopRatio = attacker.maxTroops / defender.maxTroops;
let attackerDamagePerRound = Math.ceil(
  (defender.currentTroops / targetRounds) * attackerTroopRatio
);

// 同级对战：给攻击方额外加成
if (isSameLevel) {
  attackerDamagePerRound = Math.ceil(
    defender.currentTroops / targetRounds * 1.1
  );
}

// 防守方每回合反击伤害
const defenderTroopRatio = defender.maxTroops / attacker.maxTroops;
let defenderDamagePerRound = Math.ceil(
  (attacker.currentTroops / targetRounds) * defenderTroopRatio * attackerPenalty
);

// 同级对战：降低防守方反击
if (isSameLevel) {
  defenderDamagePerRound = Math.ceil(
    attacker.currentTroops * 0.5 / targetRounds
  );
}
```

---

## 💪 士气系统

### 士气基础规则

每个将领拥有独立的士气值，战斗中根据各自表现独立变化，战后保持。

```javascript
const moraleSystem = {
  initial: 70,        // 默认基础士气：70（+ trait_modifier 将领特性）
  minimum: 0,         // 最低士气：0%
  maximum: 120,       // 最高士气：120%
};
```

**战役与 NPC 一致**：
- **玩家将领卡 / 发卡**：`initialMorale = 70 + trait_modifier`（见 `rewardService` 等）。
- **事件战斗、小型地图随机敌方**（`BattleArena` / `useBattleMap` 配置池）：`initialMorale = 70 + trait_modifier`，**不再**对 NPC 使用 `50 + random(30)`。
- **战役地图**：`quad_*_units_spec` 可选 **`morale:{m}`** 作为**每将基础士气**（管理员可逐行配置）；进入战斗时仍叠加该将领的 **`trait_modifier`**：`最终士气 = clamp(0, 120, m + trait_modifier)`。叙事与 DSL 见 `docs/tools/campaign/CAMPAIGN_MAP.md` §8。

### 士气变化规则（每个将领独立计算）

```javascript
// 该将领消灭敌方部队
onEnemyTroopKilled: +10%

// 该将领的部队被消灭
onOwnTroopKilled: -8%



### 士气状态效果

| 士气状态 | 阈值 | 攻击加成 | 防御加成 |
|---------|------|---------|---------|
| 超高昂 | ≥100% | +10% | +5% |
| 高昂 | ≥80% | +10% | +5% |
| 普通 | 20%-80% | 无 | 无 |
| 低落 | ≤20% | -5% | -10% |
| 崩溃 | =0% | 将领受伤 | 部队失控 |

**说明**：
- 超高昂与高昂加成相同，提供士气安全垫
- 士气崩溃时将领受伤20分钟，部队由AI接管（防御模式）

---

## 📊 战斗模拟结果

### 同级对战（目标：攻击方获胜，残留50%兵力）

| 对战 | 攻击方残留 | 防守方残留 | 战损比 | 结果 |
|-----|----------|----------|--------|------|
| 200 vs 200 | 64.9% | 0% | 2.84 | ✅ 攻击方获胜 |
| 330 vs 330 | 60.3% | 0% | 2.52 | ✅ 攻击方获胜 |
| 460 vs 460 | 62.8% | 0% | 2.69 | ✅ 攻击方获胜 |
| 600 vs 600 | 59.5% | 0% | 2.47 | ✅ 攻击方获胜 |

**结论**：同级对战攻击方100%获胜，残留60-65%兵力，符合目标！

### 高打低（目标：碾压效果）

| 对战 | 攻击方损失 | 防守方损失 | 战损比 | 回合数 |
|-----|----------|----------|--------|--------|
| legendary vs common | 0% | 100% | ∞ | 1 |
| legendary vs rare | 18% | 100% | 3.03 | 2 |
| legendary vs epic | 57% | 100% | 1.31 | 4 |
| epic vs common | 15% | 100% | 2.95 | 2 |
| epic vs rare | 41% | 100% | 1.73 | 3 |
| rare vs common | 30% | 100% | 2.02 | 3 |

**结论**：legendary打common零损失秒杀，符合预期！

### 低打高（目标：快速全灭）

| 对战 | 攻击方损失 | 防守方损失 | 战损比 | 回合数 |
|-----|----------|----------|--------|--------|
| common vs rare | 100% | 36% | 0.60 | 2 |
| common vs epic | 100% | 19% | 0.44 | 1 |
| common vs legendary | 100% | 17% | 0.51 | 1 |
| rare vs epic | 100% | 43% | 0.59 | 2 |
| rare vs legendary | 100% | 18% | 0.33 | 1 |
| epic vs legendary | 100% | 50% | 0.66 | 2-3 |

**结论**：低打高全部失败，且在2-4回合内快速全灭，符合预期！

---

## 🎯 完整战斗流程代码

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
  
  // 2. 计算物理伤害（包含兵力）
  const troopBaseDamage = parseFloat(attacker.troopAttack);
  const generalDamage = parseFloat(attacker.combat) * 6;
  const singleUnitDamage = troopBaseDamage + generalDamage;
  
  const courageBonus = 1 + (parseFloat(attacker.courage) / 40);
  const singleUnitFinalDamage = singleUnitDamage * courageBonus;
  
  const troopRatio = attacker.currentTroops / attacker.maxTroops;
  let totalDamage = singleUnitFinalDamage * troopRatio;
  
  // 3. 暴击判定
  const critRate = (parseFloat(attacker.courage) + parseFloat(attacker.luck)) / 80;
  const critRoll = Math.random();
  const isCrit = critRoll < critRate;
  
  if (isCrit) {
    totalDamage *= 1.5;
  }
  
  // 4. 应用士气效果
  const moraleEffects = getMoraleEffects(attacker.generalId);
  totalDamage *= moraleEffects.attack;
  
  // 5. 物理防御减免（包含兵力）
  const troopBaseDefense = parseFloat(defender.troopDefense);
  const generalDefense = parseFloat(defender.command) * 5 + parseFloat(defender.combat) * 3;
  const singleUnitDefense = troopBaseDefense + generalDefense;
  
  const defenderTroopRatio = defender.currentTroops / defender.maxTroops;
  const totalDefense = singleUnitDefense * defenderTroopRatio;
  
  const defenseReduction = totalDefense / (totalDefense + 140);
  const defenderMoraleEffects = getMoraleEffects(defender.generalId);
  const effectiveDefense = defenseReduction * defenderMoraleEffects.defense;
  
  totalDamage *= (1 - effectiveDefense);
  
  // 6. 兵力比例系数（用等效兵力，加上限）
  const atkEffective = attacker.maxTroops * (attacker.troopWeight || 1);
  const defEffective = defender.maxTroops * (defender.troopWeight || 1);
  const rawTroopRatio = atkEffective / defEffective;
  const troopRatioCoefficient = Math.min(3.0, Math.max(0.33, rawTroopRatio));
  totalDamage *= troopRatioCoefficient;
  
  return {
    result: 'hit',
    damageType: 'physical',
    isCrit: isCrit,
    damage: Math.round(totalDamage),
    troopRatioCoefficient: troopRatioCoefficient
  };
}
```

---

## 🎉 系统特点总结

### 核心设计理念

✅ **兵力优势明显**：兵力多的一方有压倒性优势  
✅ **回合数可控**：战斗在预期回合数内结束  
✅ **高打低碾压**：legendary打common零损失秒杀  
✅ **低打高惩罚**：低级部队快速全灭  
✅ **同级平衡**：战损比接近1:1，攻击方略优  
✅ **动态衰减**：兵力损失导致伤害和防御同步降低  
✅ **士气影响**：士气状态直接影响战斗力  
✅ **简单易懂**：规则清晰，玩家容易理解  

### 关键公式记忆

```
最终伤害 = 第一部分(基础公式) × 第二部分(适应性修正) × 第三部分(特殊加成)
```

#### 三层伤害计算体系

**第一部分：基础公式**（已实装）
```
基础伤害 = 单兵攻击力 × 勇气加成 × 兵力比例 × 暴击 × 士气 × 阵型 × (1 - 防御减免) × 兵力比例系数 × 地形防御
```
- 包含：将领属性（武力/统帅/勇气/运气）、部队属性（攻/防/兵力）、士气、阵型、地形防御
- 装备加成（bonus_attack/bonus_defense 等）在战斗初始化时已加入基础属性

**第二部分：适应性修正**（已实装 v3.5.0）
```javascript
// 兵种相性：攻击方对防守方兵种的克制系数
兵种相性 = attacker[defenderTroopType + 'Counter']  // 如 cavalryCounter=1.3

// 地形适应：攻击方在当前地形的适应系数
地形适应 = attacker[terrainType + 'Adapt']  // 如 forestAdapt=1.1

// 官职兵种加成：攻击方将领官职对该兵种的加成
官职加成 = positionBonus[attackerTroopType]  // 如 infantryBonus=0.05

// 适应性总系数 = 兵种相性 × 地形适应 × (1 + 官职加成)
适应性总系数 = 兵种相性 × 地形适应 × (1 + 官职加成)
```

**第三部分：特殊加成**（暂不实装）
```javascript
// 势力加成（未来实装）
// 仙人AI加成（未来实装）
特殊总系数 = (1 + 势力加成 + 仙人加成)
```

**完整公式**：
```
最终伤害 = 基础伤害 × 适应性总系数 × 特殊总系数
```

#### 适应性修正示例

```javascript
// 骑兵(cavalryCounter=1.3) 攻击 步兵，在平原(plainAdapt=1.2)，官职骑兵加成5%
兵种相性 = 1.3（骑兵克步兵）
地形适应 = 1.2（骑兵擅长平原）
官职加成 = 0.05（官职骑兵+5%）
适应性总系数 = 1.3 × 1.2 × 1.05 = 1.638
// 基础伤害100 → 最终伤害163.8，提升63.8%

// 弓兵(infantryCounter=0.9) 攻击 步兵，在丘陵(hillAdapt=0.8)，无官职加成
兵种相性 = 0.9（弓兵不克步兵）
地形适应 = 0.8（弓兵不擅长丘陵）
官职加成 = 0
适应性总系数 = 0.9 × 0.8 × 1.0 = 0.72
// 基础伤害100 → 最终伤害72，削弱28%
```

#### 弓兵近战惩罚（v3.8.0）

**设计理念**：弓兵擅长远程输出，被敌人近身后应该有明显的战斗力下降，鼓励玩家保护弓兵、利用射程优势。

**触发条件**：攻击方为弓兵（`troopType === 'archer'`），且与目标距离 ≤ 1（相邻格）

**惩罚系数**：`×0.85`（总伤害减少15%）

```javascript
// 弓兵近战惩罚：弓兵攻击相邻格目标时，总伤害×0.85
const ARCHER_MELEE_PENALTY = 0.85;
if (atk.troopType === 'archer') {
  const distance = Math.abs(atk.y - def.y) + Math.abs(atk.x - def.x);
  if (distance <= 1) {
    totalDmg *= ARCHER_MELEE_PENALTY;
  }
}
```

**叠加示例**：
```javascript
// 弓兵(infantryCounter=0.9) 近战攻击 步兵，在丘陵(hillAdapt=0.8)
兵种相性 = 0.9
地形适应 = 0.8
近战惩罚 = 0.85
总系数 = 0.9 × 0.8 × 0.85 = 0.612
// 基础伤害100 → 最终伤害61.2，削弱38.8%

// 对比远程攻击（距离>1）：
总系数 = 0.9 × 0.8 = 0.72
// 基础伤害100 → 最终伤害72，削弱28%
// 近战比远程多削弱约15%
```

**注意**：
- 仅影响弓兵（`archer`），步兵和骑兵不受影响
- 反击时同样生效（弓兵被近身后反击也会受到惩罚）
- `calcDamage()` 和 `estimateDamage()` 均已实装

---

## 🎬 战斗动画系统

### 11. 动画类型清单

| 动画类型 | 触发条件 | 视觉效果 | CSS实现 |
|---------|---------|---------|---------|
| 移动 | 部队移动到新格子 | CSS transition 平滑位移 + 路径高亮 | `transition: left/top 0.5s` |
| 近战攻击 | 物理攻击（相邻格） | 向目标方向冲刺后弹回 | `@keyframes attack-{dir}` |
| 远程攻击 | 弓兵/投射攻击 | 投射物从攻击者飞向目标 | CSS transition + 角度旋转 |
| 计谋技能 | 单体计谋 | 全屏闪光→技能名弹出→火球投射→强化受击→粒子爆炸→多段伤害 | 多层 keyframes 组合 |
| 范围技能 | AoE计谋 | 全屏闪光→技能名弹出→AoE范围圈扩散→全体受击→粒子→多段伤害 | `@keyframes aoe-expand` |
| 受击 | 被普通攻击命中 | 抖动 + 闪烁 | `@keyframes hit-shake` |
| 暴击受击 | 被暴击命中 | 强烈抖动 + 缩放 + 全屏震动 | `@keyframes crit-shake` + `screen-shake` |
| 闪避 | 闪避成功 | 残影滑动 + MISS文字 | `@keyframes dodge-slide` |
| 死亡 | 兵力归零 | 缩小 + 淡出 + 灰度化 | `@keyframes unit-death` |
| 伤害数字 | 任何伤害/治疗 | 数字向上飘出并淡出 | `@keyframes damage-float` |

### 12. 投射物方案

远程攻击的投射物设计：

| 投射物 | 符号 | 用途 | 说明 |
|--------|------|------|------|
| 箭矢 | `➤`（U+27A4） | 弓兵远程攻击 | 纯文本字符，CSS可控颜色（金铜色 `#e2c87a`），配合 `rotate()` 自动指向目标方向 |
| 火球 | `🔥`（emoji） | 计谋技能投射 | emoji不受CSS color影响，自带颜色 |

**设计决策**：
- Unicode中没有单独的"箭矢"emoji，🏹是弓+箭组合不适合做飞行投射物
- `➤` 作为纯文本三角箭头，缩放和旋转效果好，视觉上接近飞行中的箭
- 投射物带 `drop-shadow` 发光效果，增强飞行感
- 飞行时间根据距离动态计算（300-700ms），距离越远飞行越久

### 13. 技能特效组合

计谋技能的动画由多个特效层叠组合：

```
单体计谋技能时序：
  0ms    → 全屏闪光（紫色半透明，500ms淡出）
  0ms    → 技能名称弹出（大字缩放进入→停留→淡出，1200ms）
  600ms  → 火球投射（从施法者飞向目标，300-700ms）
  命中后  → 强化受击抖动（crit-shake，600ms）
  命中后  → 全屏震动（screen-shake，300ms）
  命中后  → 爆炸粒子（10-12个小方块向四周散射，400-700ms）
  命中后  → 多段伤害数字（2段，间隔180ms飘出）

范围计谋技能时序：
  0ms    → 全屏闪光（红色半透明）
  0ms    → 技能名称弹出
  600ms  → AoE范围圈（从施法者中心向外扩散，260px直径，800ms）
  1000ms → 所有目标同时受击（crit-shake + 粒子 + 多段伤害）
  1000ms → 全屏震动
```

### 14. CSS Keyframes 实现方式

所有战斗动画采用纯CSS Keyframes + JS时序控制，不依赖任何动画库：

- **CSS负责**：单个动画的视觉表现（位移、缩放、透明度、滤镜）
- **JS负责**：动画的触发时序、元素创建/销毁、数据更新（HP/状态）
- **优势**：零依赖、GPU加速、性能好、易调试
- **演示页面**：`game/demo/battle-animation.html`（纯HTML+CSS+JS，无React/Vite依赖）

---

## 🎮 手动战斗系统

### 15. 概述

战斗分为两种模式：
- **自动战斗**（勾选 ⚔自动战斗）：消耗银两，2倍速，所有部队由AI决策，循环执行直到结束
- **手动战斗**（不勾选）：玩家逐一操控己方部队的移动和攻击，敌方仍由AI控制

两种模式共享相同的伤害公式、命中闪避、暴击、防御、士气系统，区别仅在于玩家方部队的决策方式。

#### 15.1 表现层拆分：事件战 vs 战役大地图（2026-04）

- **状态与逻辑（共享）**：战术格尺寸与分区以 `shared/utils/tacticalBattleGrid.js` 为准；寻路、预估伤害、手动状态机在 `useManualBattle`；回合与动画时序在 `useBattleEngine`（`game/src/battle/tacticalBattleEngine.js`）。  
- **手动高亮（数据驱动）**：可达格 / 攻击目标 / 当前部队高亮由 **`manualHighlightModel`** 描述，`BattleMap` 与 `CampaignMapGrid` **各自 React 渲染**，不再向 `.map-grid .tile` 注入临时 DOM。  
- **引擎与瓦片 DOM**：`useBattleEngine` 通过可选 **`battleSurfaceRef`** 解析瓦片节点——**事件/PVE** 使用 `createTacticalMapCardSurface(mapCardRef)`（战术 `BattleMap`）；**战役** 使用 `createCampaignBattleSurface(campaignShellRef)`（大地图贴片上的 `[data-tactical-y][data-tactical-x]` 宿主），避免战役依赖「隐藏战术图」代演。  
- **战役象限**：preset 顶层 **`battle_tactical_quad`**（`A`/`B`/`C`/`D`，缺省 `C`）见 [16-CAMPAIGN_SYSTEM.md](./16-CAMPAIGN_SYSTEM.md) §5.1。

以下 §16～仍描述玩家操作语义；实现细节以上述代码路径为准。

### 16. 手动战斗回合流程

```
回合开始
  → 按速度排序所有存活部队
  → 依次行动：
      · 敌方部队 → AI决策（findBestMoveTarget，规则见 §36），自动执行，播放动画
      · 玩家部队 → 暂停，等待玩家操作
  → 所有部队行动完毕
  → 回合结束，检查胜负
  → 下一回合
```

### 17. 玩家操作流程（单个部队）

```
轮到玩家部队行动
  │
  ├─ 1. 高亮当前部队（manualHighlightModel / 格上高亮）
  │     部队详情：鼠标悬停格子上浮动提示（无「我军」快捷按钮）
  │
  ├─ 2. 移动阶段（可选）
  │     · 高亮可移动范围（基于剩余移动力，蓝色半透明）
  │     · 点击高亮格子 → 移动到该格子（播放移动动画，触发陷阱检查）
  │     · 移动消耗部分移动力后，剩余移动力 > 0 → 重新高亮可达范围
  │     · 可继续点击格子分段移动，直到移动力耗尽或玩家选择停止
  │     · 不点击格子 = 原地不动（保留全部移动力，但进入行动阶段后不可再移动）
  │
  ├─ 3. 行动阶段
  │     · 自动高亮攻击范围内的敌人（红色边框）
  │     · 「技能 / 待机」控件位置见 §19（小型图左侧栏；战役大图点当前部队展开）
  │     │
  │     ├─ 点击红色高亮敌人 → 执行普通攻击（复用现有 performAttack + 反击逻辑）
  │     ├─ 点击 [技能] → 选择技能 → 选择目标（M1 暂不实装，按钮灰色）
  │     └─ 点击 [待机] → 跳过攻击，结束行动
  │
  ├─ 4. 宝箱检查
  │     · 行动结束后（攻击/待机），检查当前格子是否有宝箱
  │     · 有宝箱 → 弹出开启提示（自动或点击开启）
  │
  └─ 5. 该部队行动结束，轮到下一个部队
```

### 18. 分段移动机制

移动力可以分多次消耗，让玩家精确控制路径：

```javascript
// 示例：部队移速6（movement=6）
// 第1次点击：移动到树林格(消耗2) → 剩余移动力4
// 第2次点击：移动到平原格(消耗1) → 剩余移动力3
// 第3次点击：移动到丘陵格(消耗2) → 剩余移动力1
// 第4次点击：移动到平原格(消耗1) → 剩余移动力0，移动阶段结束

// 地形消耗（复用现有 getMoveCost）：
// 平原/荒地/陷阱 = 1
// 树林 = 2
// 丘陵 = 2
// 障碍物(rock/fence) = 不可通行
```

**关键规则**：
- 每次点击移动到一个格子，不是选终点自动寻路
- 玩家可以主动绕开陷阱、选择有利地形
- 移动力耗尽自动进入行动阶段
- 玩家也可以在有剩余移动力时直接选择攻击/待机，放弃剩余移动

### 19. 操作栏 UI 设计（2026-04 现行）

**统一**

- 战斗中**不再**提供「我军」快捷按钮；将领/部队信息以**悬停格子**的 tooltip 为准（`BattleMap` / `CampaignMapGrid` 与 `TileTooltipContent` 同源）。
- 「技能」仍为占位（灰色，未实装）；「待机」调用 `useManualBattle` 的 `handleStandby` / `handleFormationStandby`。
- 移动阶段：地图上高亮可达格；悬停显示地形/消耗；点击高亮格移动。  
- 行动阶段：攻击范围内敌人红色高亮；两次点击攻击与预估伤害见 §23。

#### 19.1 小型战术图（8×10，`BattleMap.jsx` / `SmallMapBattle.jsx`）

- 左侧 **行标列**（与每行战术格对齐）保持战前分区样式：上「敌」、中「⚔」、下「我」（`.zone-b` 蓝色条 +「我」字，与底部部署格浅蓝提示一致）。
- 进入手动回合的移动/行动阶段时，在**中场区域连续两行**（战术行 `y=4、5`，与 `ZONE` 中立带中部对齐）用**一个合并行标格**承载竖排的 **「技能」「待机」** 按钮（`row-label--manual-actions` / `row-label-action-btn`），**不再**在地图上覆盖「叠在当前部队瓦片上」的浮动条。
- 实现文件：`game/src/components/battle/BattleMap.jsx`、`BattleMap.css`。

#### 19.2 大型战役图（16×20，`LargeMapBattle.jsx` / `CampaignMapGrid.jsx`，`pve_campaign`）

- **仅** `battlePlaying && !autoBattle` 且已进入回合（`roundNum > 0`）时适用本节；**战前部署阶段**不出现技能/待机浮层，无需额外部署期逻辑。
- 默认**隐藏**技能/待机浮层；玩家**点击当前行动部队所在格**时**切换**显示/收起：  
  - 单兵：`activeTroop` 的 `(y,x)`；  
  - 阵型：存活阵型部队的**几何中心格**（与手动高亮中心一致）。  
- 点击**其它**地图格：先收起浮层，再进入既有 `handleTileClick`（移动、攻击预览、敌方点击等），**不改变**点其它我方单位的原有语义。
- 再点**同一当前部队格**、开始移动/点待机、或阶段/当前行动者**位置**变化时，浮层会收起（与状态机一致）。
- 顶栏在「第 N 回合」徽章**右侧**显示提示：`请点击当前部队打开行动`（与 `manualActionHintText` 一致）。
- 战役卡片 **title / meta** 与格网**同宽左对齐**（`campaign-map-aligned-stack` + `campaign-map-wrap` `justify-content: flex-start`），避免标题相对外层容器与地图横向错位。
- 浮层仅含「技能」「待机」两行（无「我军」）；`LargeMapBattle` 传入 `useBattleSettlement` 的 `deploymentFoodCost` 须在 `LargeMapBattle` 解构 props（`deploymentFoodCost`），避免运行时 `ReferenceError`。

#### 19.3 （历史参考）邻格浮动避让评分

早期方案曾将操作栏放在当前部队 **8 邻格** 之一并按评分避让（宝箱/障碍等）。**现行默认 UI 下，小型图已改为左侧栏、战役图为点部队展开**，下表**不驱动当前默认界面**，保留作将来若恢复「邻格浮动条」时的设计参考。

**候选位置**：当前部队的 8 个相邻格子（下、上、左、右、右下、左下、右上、左上）

| 评分 | 格子状态 | 说明 |
|:----:|---------|------|
| 0 | 空格 + 无对象 + 不可移动 | 最佳位置，不遮挡任何内容 |
| 1 | 空格 + 无对象 + 可移动 | 次优，避免遮挡移动高亮 |
| 1.5 | 空格 + 有特殊对象瓦片 | 避免遮挡宝箱/障碍/陷阱等对象 |
| 2 | 己方部队 | 避免遮挡自己 |
| 3 | 友方部队 | 避免遮挡友军 |
| 4 | 敌方部队 | 避免遮挡敌人 |
| 5 | 越界 | 不可用 |

**避让的特殊对象瓦片**：chest（宝箱）、rock（岩石）、trap（陷阱）、fence（拒马）

### 20. 状态机设计

```javascript
// 手动战斗阶段状态
const MANUAL_PHASE = {
  IDLE: 'idle',              // 非手动回合（敌方行动中/回合间隔）
  SELECT_MOVE: 'select_move', // 移动阶段：高亮可达格子，等待玩家点击
  SELECT_ACTION: 'select_action', // 行动阶段：高亮可攻击敌人，等待攻击/待机
  ANIMATING: 'animating',    // 播放动画中（移动/攻击/反击），不接受输入
};
```

**状态转换**：
```
IDLE → SELECT_MOVE      （轮到玩家部队）
SELECT_MOVE → ANIMATING  （玩家点击格子，执行移动）
ANIMATING → SELECT_MOVE  （移动完毕，剩余移动力 > 0）
ANIMATING → SELECT_ACTION（移动完毕，移动力耗尽 或 触发陷阱死亡后跳过）
SELECT_MOVE → SELECT_ACTION（玩家直接选择攻击/待机，放弃剩余移动）
SELECT_ACTION → ANIMATING （玩家点击敌人，执行攻击）
ANIMATING → IDLE          （攻击+反击完毕，该部队行动结束）
SELECT_ACTION → IDLE      （玩家点击待机）
```

### 21. 与自动战斗的代码复用

手动战斗复用现有引擎的所有底层函数：

| 功能 | 复用的函数 | 说明 |
|------|-----------|------|
| 伤害计算 | `calcDamage()` | 完全复用 |
| 命中/暴击/闪避 | `rollCritDodge()` | 完全复用 |
| 攻击动画 | `battleAttack/Crit/Miss/Ranged/Skill` | 完全复用 |
| 击杀动画 | `battleKill()` | 完全复用 |
| 反击逻辑 | `performCounterAttack()` | 完全复用 |
| 移动动画 | `battleMove()` | 复用逐格移动+陷阱检查 |
| 可达范围 | `getReachableTiles()` | 复用BFS计算 |
| 寻路 | `findPath()` | 复用BFS寻路 |
| 阵型系统 | `applyFormationBuffs()` | 首回合自动阵型复用 |

**新增部分**：
- 手动战斗状态机（`manualPhase` state）
- 地图点击事件处理（tile click → 移动/攻击）
- 可达范围/攻击范围高亮渲染
- 操作控件 UI（小型图左侧栏 / 战役图点部队浮层，见 §19）
- `executeSingleRound` 改造：检测 `autoBattle`，玩家部队暂停等待

### 22. 首回合阵型

- 勾选"自动阵型"时：首回合开始前自动摆阵（与自动战斗一致）
- 未勾选"自动阵型"时：不摆阵，各自为战（M1阶段不实装手动阵型配置）

### 23. 两次点击攻击机制（攻击预览）

为避免玩家误操作，手动战斗中攻击敌人需要两次点击确认：

**流程**：
```
第一次点击敌人 → 显示攻击预览浮层（预估伤害、暴击率、命中率）
  ├─ 第二次点击同一敌人 → 确认攻击，执行 performAttack + 反击
  ├─ 点击其他敌人 → 切换预览目标
  └─ 点击空白处 → 取消预览
```

**预估伤害计算**：
```javascript
// 复用 calcDamage 的全部公式，但去掉 ±10% 随机浮动
// 新增函数：estimateDamage(atk, def, terrain)
// 返回：{ damage, critRate, hitRate, critDamage }

const estimate = estimateDamage(activeTroop, clickedEnemy, terrain);
// estimate.damage     = 50   （普通伤害，不含随机浮动）
// estimate.critRate   = 0.161（暴击率 16.1%）
// estimate.hitRate    = 0.942（命中率 94.2%）
// estimate.critDamage = 75   （暴击伤害 = damage × 1.5）
```

**UI设计**：
```
┌─────────────────────┐
│  ⚔️ 预估伤害         │
│      ~50            │  ← 金色大字，波浪号表示近似值
│  命中 94.2%  暴击 16.1% │
│  暴击伤害 ~75        │  ← 橙色
│  再次点击确认攻击     │  ← 红色脉冲动画
└─────────────────────┘
```

- 浮层定位在目标敌人瓦片正上方
- 半透明深色背景 + 红色边框
- 被预选的敌人瓦片保持红色高亮

**适用范围**：
- ✅ 单兵移动阶段（SELECT_MOVE）直接攻击范围内敌人
- ✅ 单兵行动阶段（SELECT_ACTION）攻击敌人
- ❌ 阵型攻击（阵型攻击是多部队同时攻击，不适用单目标预览）

**相关代码**：
- `combatSystem.js` → `estimateDamage()` 预估伤害函数
- `useManualBattle.js` → `attackPreview` 状态 + handleTileClick 两次点击逻辑
- `AttackPreview.jsx` → 攻击预览浮层组件

### 24. 宝箱交互机制

玩家部队行动结束后（攻击/待机），自动检查当前格子是否有未开启的宝箱。

**触发时机**：
```
单兵攻击完毕 → 宝箱检查 → endTurn
单兵待机 → 宝箱检查 → endTurn
阵型攻击完毕 → 所有存活部队宝箱检查 → endTurn
阵型待机 → 所有存活部队宝箱检查 → endTurn
```

**奖励规则（唯一配置源）**：
- 奖励品为装备件，**必须**来自 `public/data/shared/equipment.json`（与库表 `config_equipment` 同源导入），**禁止**前端占位假名或虚构属性。
- **抽样**：先在 `weapon` / `armor` / `accessory` 中随机类型，再取**当前赛季**（与 `POST /api/battles` 宝箱入库一致，现网 `san_1`）且 **稀有度 = 本场敌军最高稀有度** 的条目集合，从中 **均匀随机一条**；展示名、加成、`specialEffect` 等均取自该条配置。
- 战斗日志与 `ChestRewardOverlay` 显示的名称 **与** `chestRewards[].equipmentId` 入库的装备 **一致**。
- `useManualBattle.checkChestAtTroop` 使用 `loadSharedData('equipment')`；`insertChestEquipmentFromReward` **仅**接受 `equipmentId`（或 `card_id`）精确命中 `config_equipment`，缺失或查不到则记录错误并不入库（与前端数据应始终一致）。

**瓦片切换**：
- 开启后将 `obj.isOpen = true`
- `getObj('chest', true)` 自动返回 `chest_01_op.png`（已开启图片）
- 瓦片重渲染时自动切换为打开状态

**UI设计**：
```
┌──────────────────────────┐
│     📦 发现宝箱！         │  ← 金色标题
│                          │
│   [开箱动画 0.6s]         │  ← 📦 图标动画
│                          │
│  ┌────────────────────┐  │
│  │  ⚔️ 武器            │  │  ← 装备类型
│  │  「配置表真实名称」  │  │  ← equipment.json / config_equipment
│  │  稀有 🔵            │  │  ← 稀有度标签（与条目一致）
│  │  武+1 …             │  │  ← 条目 bonus（非随机假数值）
│  └────────────────────┘  │
│                          │
│       [确认收下]          │  ← 稀有度配色渐变按钮
└──────────────────────────┘
```

- 全屏半透明遮罩 + 居中浮层
- 开箱有 0.6s 延迟动画
- 确认后浮层关闭，战斗日志记录获得物品
- 战斗结算时将宝箱奖励纳入奖励列表

**相关代码**：
- `useManualBattle.js` → `checkChestAtTroop()`（`loadSharedData('equipment')` + `equipmentId`）+ `chestReward` 状态
- `ChestRewardOverlay.jsx` → 宝箱奖励浮层组件
- `battleConstants.js` → `getObj('chest', isOpen)` 已支持开/关图片切换
- `backend/routes/battles.js` → `insertChestEquipmentFromReward`（必选 `equipmentId`）

---

## 🔧 磨损衰减系统

### 25. 概述

传奇（legendary）部队卡耐久耗尽后不会被删除（与核心卡相同待遇），但会受到攻防衰减惩罚。这让传奇卡在PVE中仍可使用，但战斗力明显下降。

### 26. 磨损判定条件

```javascript
// 判定条件：legendary稀有度 + 已使用次数 >= 最大使用次数
const isWorn = (troop.rarity === 'legendary' 
  && troop.battleCount != null 
  && troop.maxBattleCount != null 
  && troop.battleCount >= troop.maxBattleCount);
```

### 27. 衰减效果

| 属性 | 衰减比例 | 说明 |
|------|---------|------|
| 攻击力 | ×0.80（-20%） | 基础攻击力乘以0.8 |
| 防御力 | ×0.80（-20%） | 基础防御力乘以0.8 |

**衰减应用位置**：在 `combatSystem.js` 的 `calcDamage()` 和 `estimateDamage()` 中，于基础攻防计算阶段应用。

```javascript
// combatSystem.js 中的实现
const WORN_PENALTY = 0.80;

// 攻击方磨损衰减
const troopAtk = ((atk.attack || 100) / 10) * (atkWorn ? WORN_PENALTY : 1);

// 防守方磨损衰减
const troopDef = ((def.defense || 50) / 10) * (defWorn ? WORN_PENALTY : 1);
```

### 28. 耐久耗尽后端处理（更新）

```javascript
// core + legendary 稀有度：保留卡牌，卸下装备
await pool.query(
  `UPDATE player_cards
   SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
   WHERE player_id = ? AND card_type = 'troop' AND rarity IN ('core', 'legendary')
     AND battle_count >= max_battle_count AND is_equipped = TRUE`,
  [playerId]
);

// 其他稀有度（epic/rare/common）：直接删除实例
await pool.query(
  `DELETE FROM player_cards
   WHERE player_id = ? AND card_type = 'troop' AND rarity NOT IN ('core', 'legendary')
     AND battle_count >= max_battle_count`,
  [playerId]
);
```

### 29. 编组面板行为

- legendary耐久耗尽的卡牌仍可在编组面板中选择上阵（PVE可用）
- core耐久耗尽的卡牌不可上阵（纪念收藏）
- 前端 `LineupTab.jsx` 过滤逻辑：耐久耗尽的legendary卡返回 `true`（可选），core卡返回 `false`

### 30. 耐久耗尽规则总结（更新）

| 稀有度 | 耐久耗尽后 | PVE可用 | 攻防衰减 | 说明 |
|--------|-----------|---------|---------|------|
| ⚪ common | 删除实例 | ❌ | - | 从数据库物理删除 |
| 💙 rare | 删除实例 | ❌ | - | 从数据库物理删除 |
| 💜 epic | 删除实例 | ❌ | - | 从数据库物理删除 |
| 🟠 legendary | 保留在军营 | ✅ | -20%攻防 | 卸下装备，可重新上阵但有衰减 |
| 🟡 core | 保留在军营 | ❌ | - | 卸下装备，纪念收藏，无法上阵 |

---

## 🖐 自动战斗接管机制

### 31. 概述

自动战斗进行中，玩家可以随时点击「接管」按钮中断自动战斗，切换为手动模式继续操控。

### 32. 接管流程

```
自动战斗进行中
  → 玩家点击地图标题栏右侧「🖐 接管」按钮
  → autoBattle 设为 false
  → 当前回合循环检测到 autoBattle=false
  → 添加战斗日志：「🖐 玩家接管战斗，切换为手动模式」
  → 速度重置为1倍速
  → 后续回合以手动模式执行（玩家部队暂停等待操作，敌方仍由AI控制）
```

### 33. 技术实现

**tacticalBattleEngine.js**（`game/src/battle/tacticalBattleEngine.js`，导出 `useBattleEngine`；~~`hooks/useBattleEngine.js`~~ 已移除）：
```javascript
// 自动战斗循环中检测接管
const takenOver = useRef(false);

// 在 runAutoBattle 的 while 循环中：
if (!autoBattleRef.current && !takenOver.current) {
  takenOver.current = true;
  addLog('🖐 玩家接管战斗，切换为手动模式', 'round');
  speedRef.current = 1;
}
// executeSingleRound 内部会根据 autoBattle 状态决定是否暂停等待玩家操作
```

**战术格网**：边界与索引以 `shared/utils/tacticalBattleGrid.js` 为准（与 `generateSmallMap`、`battleFlowManager` 一致）。**AI 入口**可经 `game/src/battle/ai/battleTurnAi.js` 引用 `findBestMoveTarget` 等。战役场景下瓦片 DOM 由 **`battleSurfaceRef`** 提供，见 §15.1。

**BattleMap.jsx**：
- 接管按钮位于地图标题栏右侧，仅在 `autoBattle && isBattle` 时显示
- 点击调用 `onTakeover()` → `toggleAutoBattle(false)`
- 按钮样式：琥珀色半透明背景，hover加深

### 34. 注意事项

- 接管后当前回合会继续执行完毕（不会中断正在播放的动画）
- 接管后速度自动重置为1倍速
- 接管是单向操作：接管后不能再切回自动战斗（当场战斗内）
- `takenOver` ref 在战斗结束后重置为 false

### 35. PVE 自动战斗：离开页面与 30 秒规则（2026-03-31）

**适用范围**：仅 **PVE 自动战斗**（`battleType` 为 `pve_event` 或 `pve_siege`，含大地图攻城走战术壳层 `BattleArena`→`EventBattleArena` 的 PVE；**不含** `pvp_siege` 披挂对战）。手动战斗、PVP 观战/披挂均不适用本节。

**时间基准**：使用 **`Date.now()` 墙上时钟**（与浏览器对后台标签的计时节流无关）。

**不切后台推进**：页面进入后台或失焦时，战斗**不**在后台继续推进回合；回到前台时仍从离开时的状态继续（与「补回被节流掉的 sleep」方案不同，已废弃）。

**30 秒**：

- 自**进入后台**起，若 **30 秒内**回到前台 → 继续本场战斗（节奏不变）。
- 若 **超过 30 秒**仍未回到前台（或回到前台时已超过该截止时刻）→ 客户端对**当前这一场**做**真实快进演算**直至终局（跳过动画 `sleep`，逻辑与正常自动战斗相同），结算后提示文案类似：「离开超过 30 秒未操作，本场将按规则自动结算并返回大地图」，确认后走原有 `onBattleEnd` 关闭战斗层。

**实现要点**：

- `useBattleEngine`（`tacticalBattleEngine.js`）：`setBattleAnimationSkipDelays(true)` 时 `sleep()` 视为 0，用于超时快进；本场 `playBattleRound` 的 `finally` 中复位。
- `EventBattleArena`（经 `BattleArena` 挂载）：`document.visibilitychange` + 30s `setTimeout` 双通道（应对后台定时器节流）；仅 `pve_event` / `pve_siege` 且 `autoBattle` 且进行中时启用。

设计约束：

- ❌ 不提供「切后台偷时间加速」类权益；超时路径是**规则内**的自动结算，与战斗脚本一致。
- ✅ 不改变单回合内的判定顺序与 RNG 路径（快进仅省略等待时间）。

### 36. 自动战斗 AI：接敌与弓兵后撤（2026-03-31）

**实现**：`game/src/systems/battleFlowManager.js` → `findBestMoveTarget()`（自动战斗与敌方 AI 共用）。

**问题（旧逻辑）**：在可达格上**最小化**与最近敌人的曼哈顿距离，导致 `range > 1` 的近战兵种（如枪、戟，`weaponType` 为 `*_lance`，仍走近战演出）被拉到**贴身**才攻击；且一旦 `dist ≤ range` 即不再移动，弓兵被贴脸后仍原地用近战演出对砍。

**现行规则**：

1. **打满射程（非弓兵同样适用）**  
   - 接敌时：在可达格中若存在能攻击目标的格子（`dist ≤ range`），取其中与敌**距离最大**的一格（优先在射程边缘接敌，如 `range=2` 时优先距离 2 而非 1）。  
   - 若尚无任何格能攻击，再在可达格上**最小化**与敌距离（继续接近）。

2. **已能攻击时的再移动**  
   - 若当前已在射程内，但存在可达格使 `与敌距离` **大于**当前距离且仍 `≤ range`，则先移动至该格再攻击（长柄保持枪程、弓兵从贴脸**后撤**至可触发 `battleRanged` 的距离，与 `performAttack` 中「弓兵且 `range≥2` 用箭矢演出」一致）。  
   - 若无更优格或无路可走，则原地攻击；弓兵贴脸且无法拉远时仍按现有逻辑使用近战演出。

3. **火焰瓦片躲避**（2026-04-07）  
   - AI 选择落脚点时，陷阱 **和** 火焰瓦片统一视为「危险格」。距离相同的候选格中，优先选无危险的格子。  
   - 寻路函数 `findPathWithTrapBudget` 同样将火焰格计入危险预算，尽可能减少途经危险格。  
   - `getMoveCost` 对火焰格额外 +2 移动消耗，BFS 天然倾向绕行。  
   - 实现：`hasFireAt(y, x, mapResult)`（`battleFlowManager.js`）。

4. **宝箱优先拾取**（2026-04-07）  
   - 自动战斗模式下，player 部队优先移向可达范围内的未开启宝箱：  
     - 若宝箱格可攻击敌人 → 移至宝箱、攻击、宝箱在行动后自动开启。  
     - 若宝箱格无可攻击目标 → 移至宝箱、待机、宝箱自动开启。  
   - 已站在宝箱上 → 就地攻击或待机后开启。  
   - 无可达宝箱 → 回退正常接敌逻辑。  
   - 实现：`findBestMoveTarget` 新增 `opts.prioritizeChests` 参数。

### 37. 自动战斗宝箱系统（2026-04-07）

**适用范围**：所有地图（小型 / 大型 / 战役），自动战斗模式。

**核心流程**：
```
AI 决策 → 移动（优先宝箱格）→ 攻击/待机 → checkChestAuto(troop) → 浮层展示 → 自动关闭 → 下一部队
```

**共享奖励解析**：`battle/chestRewardResolver.js` → `resolveChestReward(troop, mapResult, battleTroops)`，手动 / 自动复用同一逻辑（从 `equipment.json` 按赛季 + 敌方最高稀有度抽取装备件）。

**浮层行为**：
- 手动战斗：`ChestRewardOverlay` 显示「确认收下」按钮，玩家点击后关闭。
- 自动战斗：`ChestRewardOverlay` 显示「自动收取中…」提示，引擎 `sleep(2000)` 后自动关闭（不阻塞战斗流程以外的其它操作）。

**奖励入库**：自动战斗宝箱奖励收集在 `autoChestRewardsRef` 中，与手动 `collectedChestRewards` 在 `useBattleSettlement` 合并后一起随战报发送后端。

**相关代码**：
- `battle/chestRewardResolver.js` — 共享奖励抽取
- `battle/tacticalBattleEngine.js` — `checkChestAuto`、`autoChestReward` state、`getAutoChestRewards`
- `systems/battleFlowManager.js` — `findBestMoveTarget` `prioritizeChests` 分支、`hasUnopenedChestAt`
- `hooks/useBattleSettlement.js` — `engineRef` 合并 auto chest rewards
- `components/battle/ChestRewardOverlay.jsx` — 无 `onConfirm` 时显示「自动收取中…」

---

## 📝 更新日志

### v3.9.8 (2026-04-07)
- ✅ §17、§19：手动战斗控件改版——**小型图**「技能/待机」移至**左侧行标列**合并格（`y=4、5`）；**战役大图**改为**点击当前行动部队格**展开/收起浮层，顶栏提示「请点击当前部队打开行动」；**统一移除**「我军」按钮（详情仅靠格上 hover tooltip）。
- ✅ 战役 `CampaignMapGrid`：标题/meta 与格网**左对齐**（`campaign-map-aligned-stack`）；`LargeMapBattle` 正确解构 `deploymentFoodCost` 传入结算。
- ✅ 小型图行标 **「我」字**与战前 **`.zone-b` 样式保持原样**（与底部部署区提示一致）。

### v3.9.7 (2026-04-07)
- ✅ §36.3：AI 落脚点选择新增火焰瓦片躲避（与陷阱统一为「危险格」，`hasFireAt` + `findPathWithTrapBudget` 扩展）。
- ✅ §36.4 + §37：自动战斗宝箱系统——AI 优先前往宝箱格（`findBestMoveTarget` `prioritizeChests`）、行动后自动开启（`checkChestAuto`）、浮层 2 秒自动关闭、奖励随战报入库。共享抽取逻辑提取至 `chestRewardResolver.js`。

### v3.9.6 (2026-04-07)
- ✅ 阵型移动力从 `Math.min`（取最小值）改为 `Math.round(平均值)`，自动/手动战斗统一公式，解决阵型移动过于缓慢的问题。
- ✅ 初始部署位置改为前排优先（小型地图 row 8 先于 row 9；大型地图 `listPassableDeployCellsInRect` 自 `rowMin` 向 `rowMax` 枚举）。
- ✅ 战斗标题栏右侧新增实时回合数显示（「第X回合」`.round-badge`）。
- ✅ 战役 `minRounds`/`maxRounds` 数据源修正：从 `campaigns.json` 正确传递至引擎（原先误读 `campaignPreset`）。
- ✅ 战役「我军」按钮启用 tooltip 显示当前部队信息。

### v3.9.5 (2026-04-04)
- ✅ §15.1：手动高亮数据化（`manualHighlightModel`）、`battleSurfaceRef` 与战役/事件双表现层；与 `16-CAMPAIGN_SYSTEM` §5.1 对齐。
- ✅ §33：补充战役场景瓦片解析依赖 `battleSurfaceRef`。

### v3.9.4 (2026-04-04)
- ✅ 引擎路径：`useBattleEngine` 实现迁至 `game/src/battle/tacticalBattleEngine.js`；删除 `hooks/useBattleEngine.js`；§33、§35 与战术格网 / `battleTurnAi` 说明对齐。

### v3.9.3 (2026-03-31)
- ✅ §36：`findBestMoveTarget` 接敌优先打满射程；射程内可后撤拉远（弓兵脱离贴脸）；文档与实现对齐。

### v3.9.2 (2026-03-31)
- ✅ §35 重写：PVE 自动战斗离开页面 **30 秒**规则；移除旧「后台 sleep 补偿」描述；明确实现位置与约束。

### v3.9.1 (2026-03-30)
- ✅ §24 宝箱：移除占位装备名/随机假加成叙述；明确奖励仅来自 `equipment.json` / `config_equipment`，前端抽样与入库 `equipmentId` 一致。
- ✅ 宝箱入库：`insertChestEquipmentFromReward` 仅按 `equipmentId` 查询，移除类型+稀有度 `RAND()` 回退。

### v3.9.0 (2026-03-30)
- ✅ ~~自动战斗新增后台节流时间补偿（旧 §35）~~ → **已由 v3.9.2 §35 替换**（30 秒离开规则 + 客户端快进结算）。
- ✅ 补充接管章节的稳定性说明：仅改善切回前台后的体感一致性，不改变战斗结果。

### v3.7.1 (2026-03-27)
- ✅ 操作栏浮动定位新增特殊对象瓦片避让（§19.1）：宝箱/岩石/陷阱/拒马评分1.5，避免按钮遮挡
- ✅ 新增攻城战斗组件 `SiegeBattle.jsx`：复用战斗引擎，敌方数据来自后端 NPC 守军
- ✅ 提取 `buildPlayerUnitsFromContext` 共享工具函数，供事件战斗和攻城战斗复用

### v3.7.0 (2026-03-27)
- ✅ 新增磨损衰减系统（§25-§30）：legendary部队耐久耗尽后攻防-20%，PVE仍可使用
- ✅ 更新耐久耗尽规则：legendary与core同样保留卡牌不删除，但legendary可重新上阵（带衰减）
- ✅ 新增自动战斗接管机制（§31-§34）：自动战斗中可随时点击「接管」切换为手动模式
- ✅ `calcDamage()` 和 `estimateDamage()` 新增磨损衰减判定（WORN_PENALTY=0.80）
- ✅ 后端 battles.js 更新：core/legendary 统一保留，epic/rare/common 删除

### v3.6.0 (2026-03-26)
- ✅ 新增两次点击攻击机制（§23）：第一次点击显示预估伤害浮层，第二次点击确认攻击
- ✅ 新增 `estimateDamage()` 函数：复用 calcDamage 公式但去掉随机浮动，返回预估伤害/暴击率/命中率
- ✅ 新增 `AttackPreview.jsx` 攻击预览浮层组件
- ✅ 新增宝箱交互机制（§24）：行动结束后自动检查宝箱，随机装备件奖励，品质匹配敌人稀有度
- ✅ 新增 `ChestRewardOverlay.jsx` 宝箱奖励浮层组件
- ✅ 宝箱开启后瓦片自动切换为打开状态（`obj.isOpen = true`）

### v3.5.0 (2026-03-25)
- ✅ 新增三层伤害计算体系设计（第一部分基础公式 + 第二部分适应性修正 + 第三部分特殊加成）
- ✅ 实装第二部分：兵种相性、地形适应性、官职兵种加成
- ✅ 装备加成（bonus_attack/bonus_defense）纳入基础属性计算

### v3.4.0 (2026-03-24)
- ✅ 新增手动战斗系统设计（§15-§22）
- ✅ 定义手动操作流程：移动阶段→行动阶段→宝箱检查
- ✅ 分段移动机制：移动力可分多次消耗，精确控制路径
- ✅ 操作栏UI设计：攻击/技能(灰)/待机
- ✅ 状态机设计：IDLE→SELECT_MOVE→SELECT_ACTION→ANIMATING
- ✅ 明确与自动战斗的代码复用关系

### v3.3.0 (2026-03-22)
- ✅ 兵力比例系数增加上下限：clamp(0.33, 3.0)，防止精锐小队被极端碾压
- ✅ 新增兵力权重(troopWeight)字段：等效兵力=maxTroops×troopWeight，让少兵精锐与大部队战力平衡
- ✅ 更新伤害公式说明和代码示例

### v3.2.0 (2026-03-19)
- ✅ 添加战斗动画系统章节（动画类型清单、投射物方案、技能特效组合、CSS实现方式）
- ✅ 确定投射物方案：`➤` 做箭矢（CSS可控颜色+旋转）、`🔥` 做火球
- ✅ 记录技能特效时序编排（单体/范围两套组合）
- ✅ 演示页面：`game/demo/battle-animation.html`

### v3.1.0 (2026-03-05)
- ✅ 整合文档说明章节
- ✅ 添加目录导航
- ✅ 添加相关文档索引
- ✅ 优化文档结构

### v3.0.0 (2026-02-27)
- ✅ 整合所有最新战斗公式
- ✅ 添加兵力比例系数详细说明
- ✅ 添加回合控制系统
- ✅ 添加战损惩罚规则
- ✅ 添加完整的战斗模拟结果
- ✅ 删除旧的分析文档（已整合）

### v2.0.0 (2026-02-20)
- ✅ 更新伤害计算公式
- ✅ 添加兵力影响机制
- ✅ 优化防御系统

### v1.0.0 (2026-02-15)
- ✅ 创建战斗系统文档
- ✅ 定义基础战斗流程
- ✅ 设计命中闪避系统

---

**文档完成时间**：2026-03-30  
**系统版本**：v3.9.0  
**测试状态**：✅ 已通过48场战斗模拟验证
