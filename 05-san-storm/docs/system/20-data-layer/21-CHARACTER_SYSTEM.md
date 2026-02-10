# 角色系统完整文档

**最后更新**: 2026-02-08  
**版本**: v3.0.0  
**状态**: ✅ 完成

---

## 📋 文档概述

本文档是角色系统的完整说明，包含角色属性、属性生成规则、技能系统、羁绊系统、传记系统和生涯系统。这些部分共同构成了完整的角色系统。

**系统关系**：
```
角色系统（Character System）
├── 角色属性（Attributes）
│   ├── 核心属性（7项基础属性）
│   ├── 属性生成规则（v3.2）
│   └── 属性验证规则
├── 生涯系统（Life Stages System）- 子系统
├── 技能系统（Skills System）- 子系统
├── 羁绊系统（Bonds System）- 子系统
├── 传记系统（Biography System）- 子系统
└── 阵型系统（Formation System）- 子系统
```

**数据文件**：
- `public/data/shared/characters.json` - 武将基础数据（140个武将）
- `public/data/shared/life-stages.json` - 生涯数据（140武将×9赛季=1260条）
- `public/data/shared/skills.json` - 技能数据（64个技能）
- `public/data/shared/bonds.json` - 羁绊数据（21个羁绊）

**前端组件**：
- `src/components/character/CharacterCard.jsx` - 武将卡片组件
- `src/components/character/LifeStageDetail.jsx` - 生涯详情组件
- `src/components/character/LifeStageExample.jsx` - 生涯示例页面

**数据Hook**：
- `src/hooks/useCharacters.js` - 武将数据Hook
- `src/hooks/useLifeStages.js` - 生涯数据Hook
- `src/hooks/useSkills.js` - 技能数据Hook
- `src/hooks/useBonds.js` - 羁绊数据Hook

**工具脚本**：
- `tools/hero-csv-to-json.cjs` - CSV转JSON（武将基础数据）
- `tools/calculate-life-stages.cjs` - 计算生涯数据
- `tools/skill-csv-to-json.cjs` - CSV转JSON（技能数据）
- `tools/bond-csv-to-json.cjs` - CSV转JSON（羁绊数据）

---

## 🎯 一、角色属性系统

### 1.1 核心属性

每个角色拥有7项基础属性：

| 属性 | 英文 | 图标 | 说明 | 范围 | 影响 |
|------|------|------|------|------|------|
| 运气 | luck | 🎲 | 影响暴击、闪避等随机事件 | 0-10 | 闪避率、暴击率、掉落率、事件触发 |
| 勇气 | courage | 💪 | 影响士气和战斗意志 | 0-10 | 伤害加成、暴击率、士气恢复、抗压能力 |
| 统帅 | command | ⚔️ | 影响部队指挥和战术 | 0-10 | 防御力、部队上限、战术效果 |
| 武力 | combat | 🗡️ | 影响物理攻击和防御 | 0-10 | 基础伤害、防御力 |
| 智力 | intelligence | 📚 | 影响计谋和策略 | 0-10 | 计谋伤害、计谋成功率、科技研发 |
| 政治 | politics | 🏛️ | 影响内政和外交 | 0-10 | 资源产出、外交效果、**势力资源竞争** |
| 魅力 | charisma | ✨ | 影响招募和民心 | 0-10 | 招募成功率、忠诚度、**势力卡池竞争** |

⚠️ **关键规则**：
- **角色自身属性值范围：0-10**
- **单项属性不能超过10**
- **只能通过羁绊、技能、装备等外部加成突破10的上限**
- 例如：武力10的武将，装备青龙偃月刀（+2武力），最终武力可达12

#### 政治和魅力的势力层面作用

**魅力值 - 卡池质量竞争**：
- 每周四00:00统计势力魅力值总和
- 7个势力按魅力值排名
- 排名决定下周卡池质量（传说概率）
- 第1名传说概率5%，第7名传说概率0.3%（16.7倍差距）

**政治值 - 资源发放竞争**：
- 每天08:00根据势力政治值发放资源
- 政治值越高，资源发放越多
- 平均政治7.0 → 资源加成70%
- 平均政治5.4 → 资源加成54%

**计算公式**：
```javascript
// 魅力值卡池质量
势力魅力值 = Σ(所有玩家的所有角色魅力值) × 势力AI魅力加成
排名 → 卡池质量（传说概率）

// 政治值资源发放
势力政治值 = Σ(所有玩家的所有角色政治值) × 势力AI政治加成
平均政治 = 势力政治值 / 玩家数 / 3
政治加成 = 平均政治 / 10
最终资源 = 基础资源 × (1 + 政治加成) × AI加成
```

**势力AI加成**：

| 势力 | 魅力加成 | 政治加成 | 特色 |
|------|---------|---------|------|
| 刘备 | +10% | +0% | 招募容易，卡池好 |
| 曹操 | +0% | +5% | 城市多，资源丰富 |
| 孙坚 | +5% | +0% | 破虏将军 |
| 袁绍 | +5% | +0% | 名门望族 |
| 汉室 | +0% | +10% | 正统，政治优势 |
| 董卓 | -5% | -10% | 暴君，高难度 |
| 黄巾 | -10% | -15% | 叛军，最高难度 |

### 1.2 奋战属性（动态属性）

**奋战（Morale）** 是一个特殊的动态属性，类似武将血条，会根据战斗表现实时变化。

#### 基本信息

| 属性 | 说明 |
|------|------|
| 类型 | 动态属性 |
| 图标 | 🔥 |
| 范围 | 0%-100% |
| 初始值 | 50% |
| 显示位置 | 核心五维后面（第8个属性）|

#### 属性效果

| 奋战值范围 | 效果 | 状态 |
|-----------|------|------|
| ≥80% | 部队攻击力+10% | 高士气 |
| 20%-80% | 无影响 | 正常状态 |
| ≤20% | 部队攻击力-10% | 低士气 |
| 部队全灭 | 进入受伤状态，20分钟无法上阵 | 受伤 |

#### 计算方法

```javascript
战斗结果 = 杀敌数 - 自损数
奋战值变化 = 战斗结果 / 10

示例：
杀敌200，自损100 → 战斗结果+100 → 奋战值+10%
杀敌300，自损50 → 战斗结果+250 → 奋战值+25%
杀敌50，自损200 → 战斗结果-150 → 奋战值-15%
```

#### 恢复机制

- **休息恢复**：每小时+5%（未战斗时）
- **特殊物品**：+10%-20%（士气丹、战鼓等）
- **受伤恢复**：20分钟后自动恢复，奋战值重置为50%

#### 颜色方案

| 奋战值范围 | 颜色 | 状态 |
|-----------|------|------|
| 80%-100% | 金色 #FFD700 | 高士气 |
| 50%-79% | 绿色 #4CAF50 | 正常 |
| 20%-49% | 黄色 #FFC107 | 警告 |
| 0%-19% | 红色 #F44336 | 低士气 |
| 受伤状态 | 灰色 #9E9E9E | 无法战斗 |

#### 代表武将奋战值

| 武将 | 奋战值 | 说明 |
|------|-------|------|
| 张飞 | 90% | 勇猛无畏 |
| 典韦 | 92% | 古之恶来 |
| 许褚 | 90% | 虎痴 |
| 赵云 | 88% | 一身是胆 |
| 关羽 | 85% | 义薄云天 |
| 诸葛亮 | 60% | 谋定后动 |
| 荀彧 | 55% | 谋士型 |

#### 设计理念

1. **鼓励进攻** - 多杀敌少损失，奋战值上升，获得攻击加成
2. **惩罚躺平** - 消极防守，奋战值下降，攻击力降低
3. **风险管理** - 部队全灭会受伤，需要谨慎平衡进攻和防守
4. **策略深度** - 需要管理奋战值，选择合适的战斗时机
5. **动态变化** - 奋战值实时变化，增加游戏的动态性

### 1.3 属性生成完整规则

#### 1.3.1 规则总览

角色属性生成遵循以下6大规则，按优先级从高到低排列：

1. **基础属性范围** - 所有属性的绝对上下限
2. **总属性点计算** - 根据稀有度、类型、生涯计算总属性点
3. **生涯修正** - 根据年龄和生命状态调整属性
4. **稀有度单项属性上限** - 不同稀有度的单项属性上限
5. **角色类型属性分配** - 不同类型的属性分配规则
6. **随机生成下限** - 随机生成时的最小值限制

#### 1.3.2 规则1：基础属性范围

**绝对范围**：
- **上限**：10.0
- **下限**：0.0

**说明**：
- 这是所有属性的绝对范围
- 基础属性（未加成）不能超过10.0
- 可以通过羁绊、技能、装备等外部加成突破10.0上限

#### 1.3.3 规则2：总属性点计算

**计算公式**：
```
总属性点 = 基础点数（稀有度 + 类型） × 生涯修正
```

**基础点数表**：

| 稀有度 | military/strategist | balanced | 说明 |
|--------|---------------------|----------|------|
| 核心(core) | 56-60 | 58-62 | 最强角色 |
| 传奇(legendary) | 56-60 | 58-62 | 顶级武将 |
| 史诗(epic) | 52-56 | 54-58 | 优秀武将 |
| 稀有(rare) | 48-52 | 50-54 | 普通武将 |
| 普通(common) | 44-48 | 46-50 | 基础武将 |

**关键点**：
- ✅ **balanced类型** 总属性点比其他类型高 **2点**
- ✅ **military** 和 **strategist** 类型总属性点相同
- ✅ 基础点数是一个范围，实际生成时在范围内随机

**示例**：
```javascript
// core + balanced + 巅峰
基础点数 = 58-62（随机）
生涯修正 = 100%
总属性点 = 58-62 × 1.0 = 58-62

// legendary + military + 茅庐
基础点数 = 56-60（随机）
生涯修正 = 95%
总属性点 = 56-60 × 0.95 = 53.2-57.0

// epic + strategist + 不惑
基础点数 = 52-56（随机）
生涯修正 = 90%
总属性点 = 52-56 × 0.90 = 46.8-50.4
```

#### 1.3.4 规则3：生涯修正

**生涯阶段定义**：

| 阶段 | 中文 | 图标 | 修正 | 年龄范围 | 说明 |
|------|------|------|------|---------|------|
| early | 茅庐 | 🌱 | 95% | <25岁 | 初出茅庐，潜力大但经验不足 |
| peak | 巅峰 | ⭐ | 100% | 25-45岁 | 人生巅峰，数值最高 |
| late | 不惑 | 🧙 | 90% | >45岁 | 不惑之年，体力下降但智慧增长 |
| death | 卒 | 💀 | 80% | 已故 | 角色已故，实力大幅下降 |

**计算逻辑**：
```javascript
// 计算年龄
const age = seasonYear - birthYear;

// 判断是否已故（关键：赛季年份 > 去世年份）
const isDead = deathYear && seasonYear > deathYear;

// 判断生涯
if (isDead) {
  return 'death'; // 💀 卒
} else if (age < 25) {
  return 'early'; // 🌱 茅庐
} else if (age <= 45) {
  return 'peak';  // ⭐ 巅峰
} else {
  return 'late';  // 🧙 不惑
}
```

**关键规则**：
- ⚠️ 使用 `seasonYear > deathYear` 而不是 `>=`
- ⚠️ 原因：去世那一年赛季开始时还活着（一年有365天）
- ⚠️ 例子：张角184年去世 → S1(184年)显示⭐巅峰 → S2(189年)开始显示💀卒

#### 1.3.5 规则4：稀有度单项属性上限

**上限表**：

| 稀有度 | 单项属性上限 | 实际上限值 | 说明 |
|--------|-------------|-----------|------|
| core | 无上限 | 10.0 | 核心武将可以达到10.0 |
| legendary | 无上限 | 10.0 | 传奇武将可以达到10.0 |
| epic | < 9.5 | 9.4 | 史诗武将单项属性不能达到9.5或以上 |
| rare | < 8.5 | 8.4 | 稀有武将单项属性不能达到8.5或以上 |
| common | < 8.0 | 7.9 | 普通武将单项属性不能达到8.0或以上 |

**为什么使用9.4、8.4、7.9？**

**原因**：避免浮点数精度问题

**规则要求**：
- epic: 单项属性 **< 9.5** (严格小于)
- rare: 单项属性 **< 8.5** (严格小于)
- common: 单项属性 **< 8.0** (严格小于)

**代码实现**：
```javascript
const rarityMaxMap = {
  core: 10.0,
  legendary: 10.0,
  epic: 9.4,      // 确保 < 9.5
  rare: 8.4,      // 确保 < 8.5
  common: 7.9,    // 确保 < 8.0
};
```

#### 1.3.6 规则5：角色类型属性分配规则

**Military（武官型）**

**核心规则（v3.2）**：
```
1. luck + courage + command + combat 占总属性的 60%-65%
2. 主要4项属性差值 ≤ 3.5
```

**属性分组**：
- **主要属性组**（4项）：运气、勇气、统帅、武力 → 60%-65%，差值≤3.5
- **次要属性组**（3项）：智力、政治、魅力 → 35%-40%

**分配算法（v3.2优化）**：
```javascript
// 1. 计算主要属性组点数
const primaryRatio = randomBetween(0.60, 0.65);
const primaryTotal = totalPoints * primaryRatio;

// 2. 计算次要属性组点数
const secondaryTotal = totalPoints - primaryTotal;

// 3. 在主要属性组内随机分配（4项）
// 使用更均衡的权重分配以控制差值
const primaryWeights = [
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6   // 0.7-1.3
];
const primarySum = sum(primaryWeights);
luck = (primaryWeights[0] / primarySum) * primaryTotal;
courage = (primaryWeights[1] / primarySum) * primaryTotal;
command = (primaryWeights[2] / primarySum) * primaryTotal;
combat = (primaryWeights[3] / primarySum) * primaryTotal;

// 4. 在次要属性组内随机分配（3项）
const secondaryWeights = [random(), random(), random()];
const secondarySum = sum(secondaryWeights);
intelligence = (secondaryWeights[0] / secondarySum) * secondaryTotal;
politics = (secondaryWeights[1] / secondarySum) * secondaryTotal;
charisma = (secondaryWeights[2] / secondarySum) * secondaryTotal;

// 5. 验证差值，最多尝试50次直到符合条件
```

**示例（总属性60点）**：
```javascript
// 主要属性组：60 × 62% = 37.2点
luck: 9.5
courage: 9.8
command: 9.0
combat: 8.9
差值: 9.8 - 8.9 = 0.9 ✅ (≤3.5)

// 次要属性组：60 × 38% = 22.8点
intelligence: 7.5
politics: 7.8
charisma: 7.5

// 验证：(9.5 + 9.8 + 9.0 + 8.9) / 60 = 62.0% ✅ (60%-65%范围内)
// 验证：差值0.9 ✅ (≤3.5)
```

---

**Strategist（军师型）**

**核心规则（v3.2）**：
```
1. luck + intelligence + politics + charisma 占总属性的 60%-65%
2. 主要4项属性差值 ≤ 3.5
```

**属性分组**：
- **主要属性组**（4项）：运气、智力、政治、魅力 → 60%-65%，差值≤3.5
- **次要属性组**（3项）：勇气、统帅、武力 → 35%-40%

**分配算法（v3.2优化）**：
```javascript
// 1. 计算主要属性组点数
const primaryRatio = randomBetween(0.60, 0.65);
const primaryTotal = totalPoints * primaryRatio;

// 2. 计算次要属性组点数
const secondaryTotal = totalPoints - primaryTotal;

// 3. 在主要属性组内随机分配（4项）
// 使用更均衡的权重分配以控制差值
const primaryWeights = [
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6,  // 0.7-1.3
  0.7 + Math.random() * 0.6   // 0.7-1.3
];
const primarySum = sum(primaryWeights);
luck = (primaryWeights[0] / primarySum) * primaryTotal;
intelligence = (primaryWeights[1] / primarySum) * primaryTotal;
politics = (primaryWeights[2] / primarySum) * primaryTotal;
charisma = (primaryWeights[3] / primarySum) * primaryTotal;

// 4. 在次要属性组内随机分配（3项）
const secondaryWeights = [random(), random(), random()];
const secondarySum = sum(secondaryWeights);
courage = (secondaryWeights[0] / secondarySum) * secondaryTotal;
command = (secondaryWeights[1] / secondarySum) * secondaryTotal;
combat = (secondaryWeights[2] / secondarySum) * secondaryTotal;

// 5. 验证差值，最多尝试50次直到符合条件
```

**示例（总属性60点）**：
```javascript
// 主要属性组：60 × 63% = 37.8点
luck: 9.2
intelligence: 9.8
politics: 9.5
charisma: 9.3
差值: 9.8 - 9.2 = 0.6 ✅ (≤3.5)

// 次要属性组：60 × 37% = 22.2点
courage: 7.0
command: 7.5
combat: 7.7

// 验证：(9.2 + 9.8 + 9.5 + 9.3) / 60 = 63.0% ✅ (60%-65%范围内)
// 验证：差值0.6 ✅ (≤3.5)
```

---

**Balanced（文武双全）**

**核心规则**：
```
7项属性各自的差值不超过 2
max(所有属性) - min(所有属性) ≤ 2.0
```

**分配算法**：
```javascript
// 1. 计算平均值
const avgValue = totalPoints / 7;

// 2. 生成7个随机偏移值（范围：-1.0 到 +1.0）
const offsets = [];
for (let i = 0; i < 7; i++) {
  offsets.push(randomBetween(-1.0, 1.0));
}

// 3. 应用偏移值
luck = avgValue + offsets[0];
courage = avgValue + offsets[1];
command = avgValue + offsets[2];
combat = avgValue + offsets[3];
intelligence = avgValue + offsets[4];
politics = avgValue + offsets[5];
charisma = avgValue + offsets[6];

// 4. 调整确保总和不变
const currentTotal = luck + courage + command + combat + intelligence + politics + charisma;
const adjustRatio = totalPoints / currentTotal;
luck *= adjustRatio;
courage *= adjustRatio;
command *= adjustRatio;
combat *= adjustRatio;
intelligence *= adjustRatio;
politics *= adjustRatio;
charisma *= adjustRatio;

// 5. 验证差值 ≤ 2.0
const maxAttr = Math.max(luck, courage, command, combat, intelligence, politics, charisma);
const minAttr = Math.min(luck, courage, command, combat, intelligence, politics, charisma);
if (maxAttr - minAttr > 2.0) {
  // 重新生成或调整
}
```

**示例（总属性60点）**：
```javascript
// 平均值：60 / 7 = 8.57

luck: 8.5
courage: 9.2
command: 8.0
combat: 8.8
intelligence: 9.5
politics: 7.5
charisma: 8.5

// 验证差值
max = 9.5
min = 7.5
差值 = 9.5 - 7.5 = 2.0 ✅
```

#### 1.3.7 规则6：随机生成下限

**下限值**：
- **所有随机生成的单项属性必须 > 3.5**

**说明**：
- 这是随机生成时的最小值限制
- 即使是短板属性，也不能低于3.5
- 确保所有武将都有基本的能力

**代码实现**：
```javascript
// 在生成属性后，确保所有属性 >= 3.5
Object.keys(attributes).forEach(key => {
  if (attributes[key] < 3.5) {
    attributes[key] = 3.5;
  }
});
```

#### 1.3.8 规则优先级和应用顺序

**生成流程**：
```
1. 计算总属性点（规则2 + 规则3）
   ↓
2. 根据角色类型分配属性（规则5）
   ↓
3. 应用稀有度单项属性上限（规则4）
   ↓
4. 应用随机生成下限（规则6）
   ↓
5. 确保在基础属性范围内（规则1）
   ↓
6. 验证差值约束（规则5 v3.2新增）
   - Military/Strategist: 主要4项差值≤3.5
   - Balanced: 全部7项差值≤2.0
   - 最多尝试50次直到符合条件
```

**冲突处理**：
- 如果生成的属性超过稀有度上限 → 限制为上限值
- 如果生成的属性低于3.5 → 提升到3.5
- 如果生成的属性超过10.0 → 限制为10.0
- 如果差值超过限制 → 重新生成（最多50次）

#### 1.3.9 验证清单

生成的角色数据必须满足以下所有条件：

- [ ] 所有属性在 0.0-10.0 范围内
- [ ] 所有属性 ≥ 3.5
- [ ] 总属性点符合稀有度和类型的范围
- [ ] 单项属性不超过稀有度上限
- [ ] Military类型：主要4项属性占60%-65%
- [ ] Military类型：主要4项属性差值≤3.5 ⭐ v3.2新增
- [ ] Strategist类型：主要4项属性占60%-65%
- [ ] Strategist类型：主要4项属性差值≤3.5 ⭐ v3.2新增
- [ ] Balanced类型：最大差值 ≤ 2.0

#### 1.3.10 验证工具

**验证属性范围**：
```bash
node tools/verify-attribute-range.cjs
```

**验证稀有度限制**：
```bash
node tools/verify-rarity-limits.cjs
```

**验证类型分配规则**：
```bash
node tools/verify-type-distribution.cjs
```

**输出示例**：
```
✅ 所有角色100%符合规则

📊 类型分配统计：

Military (102个角色):
  ✅ 100%符合规则
  平均主要属性占比: 62.3%
  平均差值: 2.0
  差值范围: 0.4-3.3

Strategist (36个角色):
  ✅ 100%符合规则
  平均主要属性占比: 62.1%
  平均差值: 1.9
  差值范围: 0.7-3.2

Balanced (42个角色):
  ✅ 100%符合规则
  平均差值: 1.5
  差值范围: 0.5-2.0
```

#### 1.3.11 更新日志

**v3.2 (2026-02-08)** ⭐ 当前版本
- ✅ 添加差值限制：Military和Strategist类型的主要4项属性差值≤3.5
- ✅ 优化权重分配算法：使用0.7-1.3范围的权重，使属性分布更均衡
- ✅ 增加尝试次数：从10次提高到50次，确保生成符合条件的属性
- ✅ 验证结果：所有角色100%符合规则

**v3.1 (2026-02-08)**
- ✅ 调整类型分配比例：从65%-70%降低到60%-65%
- ✅ 提高随机生成下限：从>3.0提高到>3.5
- ✅ 优化属性分布，使其更加均衡合理

**v3.0 (2026-02-08)**
- ✅ 移除旧的120%-150%规则
- ✅ 添加新的类型分配规则
- ✅ 整理归纳完整规则体系

### 1.4 生涯系统

#### 1.4.1 阶段定义

武将的属性会随着年龄和生命状态发生变化，这通过**生涯系统**来体现。每个武将在不同赛季会处于不同的生涯。

**四个生涯**：

**🌱 茅庐期（Early Stage）**
- **年龄范围**: <25岁
- **属性修正**: 95%
- **特点**: 初出茅庐，潜力巨大但经验不足
- **代表**: 年轻的刘备（S1，23岁）、年轻的曹仁（S1，16岁）

**⭐ 巅峰期（Peak Stage）**
- **年龄范围**: 25-45岁
- **属性修正**: 100%（无修正）
- **特点**: 人生巅峰，各项能力达到最高水平
- **代表**: 关羽（S1-S4，24-40岁）、曹操（S1-S3，29-39岁）

**🧙 不惑期（Late Stage）**
- **年龄范围**: >45岁
- **属性修正**: 90%
- **特点**: 不惑之年，体力下降但智慧和经验丰富
- **代表**: 黄忠（S3，47岁）、刘表（S2，47岁）

**💀 卒（Death Stage）**
- **判断条件**: 赛季开始年份 > 去世年份
- **属性修正**: 80%
- **特点**: 角色已故，实力大幅下降（可能以英灵形式存在）
- **重要**: 去世那一年赛季开始时还活着，只是在那一年的某一天去世
- **代表**: 张角（184年去世，S2开始显示为卒）、关羽（220年去世，S7开始显示为卒）

#### 1.4.2 阶段判断逻辑

```javascript
// 计算年龄
const age = seasonYear - birthYear;

// 判断是否已故（关键：赛季年份 > 去世年份）
const isDead = deathYear && seasonYear > deathYear;

// 判断阶段
if (isDead) {
  return 'death'; // 💀 卒
} else if (age < 25) {
  return 'early'; // 🌱 茅庐
} else if (age <= 45) {
  return 'peak';  // ⭐ 巅峰
} else {
  return 'late';  // 🧙 不惑
}
```

**关键规则**：
- 使用 `seasonYear > deathYear` 而不是 `>=`
- 原因：去世那一年赛季开始时还活着（一年有365天）
- 例子：张角184年去世 → S1(184年)显示⭐巅峰 → S2(189年)开始显示💀卒

#### 1.4.3 属性计算

```javascript
// 基础属性（来自CSV数据）
const baseAttributes = {
  luck: 7.6,
  courage: 10,
  command: 9.3,
  combat: 9.3,
  intelligence: 6.7,
  politics: 5.9,
  charisma: 8.4
};

// 获取阶段修正值
const stageModifier = {
  early: 0.95,
  peak: 1.0,
  late: 0.90,
  death: 0.80
}[stage];

// 计算修正后属性
const modifiedAttributes = {};
for (const [key, value] of Object.entries(baseAttributes)) {
  modifiedAttributes[key] = value * stageModifier;
}

// 例子：关羽在不同阶段
// S1 (24岁，茅庐): 总属性 58.0 × 0.95 = 55.1
// S2 (29岁，巅峰): 总属性 58.0 × 1.0 = 58.0
// S5 (48岁，不惑): 总属性 58.0 × 0.90 = 52.2
// S7 (已故，卒):   总属性 58.0 × 0.80 = 46.4
```

#### 1.4.4 赛季阶段分布

根据9个赛季的统计数据：

| 赛季 | 年份 | 茅庐🌱 | 巅峰⭐ | 不惑🧙 | 卒💀 |
|------|------|--------|--------|--------|------|
| **S1** | 184年 | 19人 | 111人 | 10人 | 0人 |
| **S2** | 189年 | 9人 | 90人 | 14人 | 27人 |
| **S3** | 194年 | 4人 | 62人 | 11人 | 63人 |
| **S4** | 200年 | 0人 | 29人 | 26人 | 85人 |
| **S5** | 208年 | 0人 | 8人 | 29人 | 103人 |
| **S6** | 220年 | 0人 | 0人 | 22人 | 118人 |
| **S7** | 228年 | 0人 | 0人 | 9人 | 131人 |
| **S8** | 249年 | 0人 | 0人 | 1人 | 139人 |
| **S9** | 280年 | 0人 | 0人 | 0人 | 140人 |

**趋势分析**：
- S1：大部分武将处于巅峰期，游戏最强时期
- S2-S4：逐渐有武将进入不惑期和去世
- S5-S7：大量武将去世，只剩少数老将
- S8-S9：几乎所有武将都已去世

#### 1.4.5 典型案例

**案例1：关羽（160年生，220年卒）**
```
S1 (184年): 24岁, 🌱茅庐, 总属性55.1 (95%)
S2 (189年): 29岁, ⭐巅峰, 总属性58.0 (100%)
S3 (194年): 34岁, ⭐巅峰, 总属性58.0 (100%)
S4 (200年): 40岁, ⭐巅峰, 总属性58.0 (100%)
S5 (208年): 48岁, 🧙不惑, 总属性52.2 (90%)
S6 (220年): 60岁, 🧙不惑, 总属性52.2 (90%) ← 220年去世
S7 (228年): 68岁, 💀卒, 总属性46.4 (80%) ← 开始显示为卒
S8-S9: 💀卒
```

**案例2：张角（140年生，184年卒）**
```
S1 (184年): 44岁, ⭐巅峰, 总属性59.2 (100%) ← 184年去世，但S1开始时还活着
S2 (189年): 49岁, 💀卒, 总属性47.5 (80%) ← 开始显示为卒
S3-S9: 💀卒
```

**案例3：陶谦（132年生，194年卒）**
```
S1 (184年): 52岁, 🧙不惑, 总属性43.3 (90%)
S2 (189年): 57岁, 🧙不惑, 总属性43.3 (90%)
S3 (194年): 62岁, 🧙不惑, 总属性43.3 (90%) ← 194年去世
S4 (200年): 68岁, 💀卒, 总属性38.3 (80%) ← 开始显示为卒
S5-S9: 💀卒
```

#### 1.4.6 数据存储

生涯数据存储在 `public/data/shared/life-stages.json`：

```json
{
  "lifeStages": {
    "char_san_1102": {
      "id": "char_san_1102",
      "name": "关羽",
      "birthYear": 160,
      "deathYear": 220,
      "baseAttributes": {
        "luck": 7.6,
        "courage": 10,
        "command": 9.3,
        "combat": 9.3,
        "intelligence": 6.7,
        "politics": 5.9,
        "charisma": 8.4
      },
      "seasons": [
        {
          "season": "S1",
          "seasonName": "黄巾之乱",
          "year": 184,
          "age": 24,
          "stage": "early",
          "stageName": "茅庐",
          "stageIcon": "🌱",
          "stageDescription": "初出茅庐，潜力大但经验不足",
          "modifier": 0.95,
          "attributes": {
            "luck": 7.2,
            "courage": 9.5,
            "command": 8.8,
            "combat": 8.8,
            "intelligence": 6.4,
            "politics": 5.6,
            "charisma": 8.0
          },
          "total": 55.1,
          "isDead": false,
          "deathYear": 220
        }
        // ... 其他8个赛季
      ]
    }
  }
}
```

#### 1.4.7 前端使用

```javascript
// 读取数据
import lifeStagesData from '/data/shared/life-stages.json';

// 获取某个武将的数据
const guanyuData = lifeStagesData.lifeStages['char_san_1102'];

// 获取某个赛季的数据
const s1Data = guanyuData.seasons.find(s => s.season === 'S1');

// 显示阶段
console.log(`${s1Data.stageIcon} ${s1Data.stageName}`); // 🌱 茅庐

// 显示属性
console.log(`总属性: ${s1Data.total}`); // 总属性: 55.1

// 判断是否已故
if (s1Data.isDead) {
  console.log('该武将已故');
}
```

#### 1.4.8 工具脚本

**生成生涯数据**：
```bash
# 1. 先转换CSV到JSON（包含deathYear字段）
node tools/hero-csv-to-json.cjs

# 2. 计算生涯数据
node tools/calculate-life-stages.cjs
```

**输出文件**：
- `public/data/shared/characters.json` - 武将基础数据
- `public/data/shared/life-stages.json` - 生涯数据

**相关文档**：
- `CHARACTER_SYSTEM.md` - 角色系统完整文档（包含生涯系统详细说明和前端使用指南）
- `SEASON_ROADMAP.md` - 9个赛季的完整定义

### 1.5 角色类型

#### Military（武官型）

**核心规则**：`luck + courage + command + combat` 占总属性的 **60%-65%**

**代表人物**：关羽、张飞、吕布、赵云、典韦、许褚

**属性分组**：
- **主要属性组**（4项）：运气、勇气、统帅、武力 → 60%-65%
- **次要属性组**（3项）：智力、政治、魅力 → 35%-40%

**属性特点**：
- ⚔️ **统帅** - 高
- 🗡️ **武力** - 高
- 💪 **勇气** - 高
- 🎲 **运气** - 中高
- 📚 **智力** - 中低
- 🏛️ **政治** - 低
- ✨ **魅力** - 中低

#### Strategist（军师型）

**核心规则**：`luck + intelligence + politics + charisma` 占总属性的 **60%-65%**

**代表人物**：诸葛亮、郭嘉、荀彧、贾诩、司马懿、庞统

**属性分组**：
- **主要属性组**（4项）：运气、智力、政治、魅力 → 60%-65%
- **次要属性组**（3项）：勇气、统帅、武力 → 35%-40%

**属性特点**：
- 📚 **智力** - 高
- 🏛️ **政治** - 高
- ✨ **魅力** - 高
- 🎲 **运气** - 中高
- ⚔️ **统帅** - 中
- 🗡️ **武力** - 低
- 💪 **勇气** - 中低

#### Balanced（文武双全）

**核心规则**：7项属性各自的差值不超过 **2.0**

**代表人物**：曹操、周瑜、陆逊、孙策、刘备

**属性特点**：
- 所有属性较为均衡
- 最高属性 - 最低属性 ≤ 2.0
- 没有明显短板
- 总属性点比其他类型高2点

### 1.6 属性验证规则

#### 单项属性上限（稀有度限制）

⚠️ **关键规则**：不同稀有度的武将有不同的单项属性上限

| 稀有度 | 单项属性上限 | 说明 | 实际上限值 |
|--------|-------------|------|-----------|
| core | 无上限 | 核心武将可以达到10.0 | 10.0 |
| legendary | 无上限 | 传奇武将可以达到10.0 | 10.0 |
| epic | < 9.5 | 史诗武将单项属性不能达到9.5或以上 | 9.4 |
| rare | < 8.5 | 稀有武将单项属性不能达到8.5或以上 | 8.4 |
| common | < 8.0 | 普通武将单项属性不能达到8.0或以上 | 7.9 |

**重要说明**：
- 代码中使用 `9.4`、`8.4`、`7.9` 作为实际上限值，确保严格小于规则要求
- 例如：epic武将要求 `< 9.5`，代码中设置上限为 `9.4`
- 这样可以避免浮点数精度问题导致的边界值错误

#### 单项属性下限

- **所有武将**的单项属性必须 **> 3.0**
- 即使是短板属性，也不能低于3.0
- 代码中设置下限为 `3.0`

#### 验证示例

```javascript
// ✅ 合法：epic武将，最高属性9.4
{ rarity: 'epic', combat: 9.4, intelligence: 8.5 }

// ✅ 合法：rare武将，最高属性8.4
{ rarity: 'rare', combat: 8.4, intelligence: 7.0 }

// ✅ 合法：common武将，最高属性7.9
{ rarity: 'common', combat: 7.9, intelligence: 6.5 }

// ❌ 非法：epic武将，combat达到9.5
{ rarity: 'epic', combat: 9.5, intelligence: 8.0 }

// ❌ 非法：rare武将，combat达到8.5
{ rarity: 'rare', combat: 8.5, intelligence: 7.0 }

// ❌ 非法：任何武将，politics低于3.0
{ rarity: 'legendary', combat: 10.0, politics: 2.5 }
```

#### 验证工具

**验证属性范围**：
```bash
# 验证所有属性在3.0-10.0范围内
node tools/verify-attribute-range.cjs
```

**验证稀有度限制**：
```bash
# 验证稀有度单项属性上限
node tools/verify-rarity-limits.cjs
```

**输出示例**：
```
✅ 所有属性都符合稀有度限制！

📊 稀有度属性统计：

core (上限: 无限制):
  角色数: 7
  最高属性值: luck=10, courage=10, command=10, combat=10, intelligence=10, politics=10, charisma=10

legendary (上限: 无限制):
  角色数: 9
  最高属性值: luck=10, courage=10, command=10, combat=10, intelligence=10, politics=10, charisma=6.8

epic (上限: < 9.5):
  角色数: 38
  最高属性值: luck=9.4, courage=9.4, command=9.4, combat=9.4, intelligence=9.4, politics=9.4, charisma=9.4

rare (上限: < 8.5):
  角色数: 71
  最高属性值: luck=8.4, courage=8.4, command=8.4, combat=8.4, intelligence=8.4, politics=8.4, charisma=8.4

common (上限: < 8):
  角色数: 55
  最高属性值: luck=7.9, courage=7.9, command=7.9, combat=7.9, intelligence=7.9, politics=7.9, charisma=7.9
```

### 1.7 属性成长系统

#### 玩家角色成长机制

**核心设计**：
- ❌ **没有个人等级** - 玩家角色没有传统的等级系统
- ✅ **官职升级** - 通过做任务获得经验点，升级官职
- ✅ **稀有度进阶** - 官职升级时，角色稀有度同步提升
- ✅ **技能替换** - 官职升级时，从新稀有度技能池随机技能

**官职升级流程**：

1. **获得经验点** - 通过完成任务获得经验
2. **经验存满** - 达到升级所需经验值
3. **点击升级** - 玩家主动点击升级官职
4. **随机3个方案** - 系统生成3个属性增长方案
5. **选择1个方案** - 玩家选择其中1个方案
6. **技能替换** - 从新稀有度技能池随机3套技能（每套2个技能）
7. **选择技能** - 玩家从3套技能中选择1套

**官职与稀有度对应**：

| 官职等级 | 官职名称 | 稀有度 | 技能池 | 说明 |
|---------|---------|--------|--------|------|
| 1级 | 军侯 | common (⚪白) | common技能池 | 初始官职 |
| 2级 | 都尉 | rare (💙蓝) | rare技能池 | 第一次升级 |
| 3级 | 校尉 | rare (💙蓝) | rare技能池 | 第二次升级 |
| 4级 | 中郎将 | epic (💜紫) | epic技能池 | 第三次升级 |
| 5级 | 将军 | legendary (🟠橙) | epic→legendary技能池 | 第四次升级，稀有度进阶 |
| 6级 | 四安/四平/四镇/四征 | legendary (🟠橙) | legendary技能池 | 第五次升级 |
| 7级 | 骠骑/车骑 | legendary (🟠橙) | legendary技能池 | 第六次升级 |
| 8级 | 大司马/大将军 | legendary (🟠橙) | legendary技能池 | 最高官职 |

**重要说明**：
- ⚠️ **玩家无法获取核心(core)级别技能**
- ✅ **玩家最高可使用legendary(🟠橙)技能**
- ⚠️ **核心技能仅限NPC武将使用**
- 🎯 **5级将军是稀有度进阶的关键节点**（epic→legendary）

**属性增长方案**：

每次升级随机生成3个方案，玩家选择1个：

| 方案类型 | 增长属性 | 增长点数 | 说明 |
|---------|---------|---------|------|
| 方案A | 运气 + 勇气 | 合计 +2.0 | 随机分配到运气和勇气 |
| 方案B | 统帅 + 武力 | 合计 +2.0 | 随机分配到统帅和武力 |
| 方案C | 智力 + 政治 + 魅力 | 合计 +3.0 | 随机分配到智力、政治、魅力 |

**属性分配算法**：

```javascript
// 方案A：运气+勇气，合计+2.0
function generateSchemeA() {
  const total = 2.0;
  const luck = 0.5 + Math.random() * 1.0; // 0.5-1.5
  const courage = total - luck; // 剩余点数
  
  return {
    type: 'A',
    name: '方案A（运气+勇气）',
    attributes: {
      luck: Math.round(luck * 10) / 10,
      courage: Math.round(courage * 10) / 10,
    },
  };
}

// 方案B：统帅+武力，合计+2.0
function generateSchemeB() {
  const total = 2.0;
  const command = 0.5 + Math.random() * 1.0; // 0.5-1.5
  const combat = total - command; // 剩余点数
  
  return {
    type: 'B',
    name: '方案B（统帅+武力）',
    attributes: {
      command: Math.round(command * 10) / 10,
      combat: Math.round(combat * 10) / 10,
    },
  };
}

// 方案C：智力+政治+魅力，合计+3.0
function generateSchemeC() {
  const total = 3.0;
  const intelligence = 0.5 + Math.random() * 1.0; // 0.5-1.5
  const politics = 0.5 + Math.random() * 1.0; // 0.5-1.5
  const charisma = total - intelligence - politics; // 剩余点数
  
  return {
    type: 'C',
    name: '方案C（智力+政治+魅力）',
    attributes: {
      intelligence: Math.round(intelligence * 10) / 10,
      politics: Math.round(politics * 10) / 10,
      charisma: Math.round(charisma * 10) / 10,
    },
  };
}
```

**技能替换机制**：

```javascript
// 官职升级时替换技能
function upgradePositionSkills(currentRarity, newRarity) {
  // 从新稀有度技能池随机3套技能
  const skillSets = [];
  
  for (let i = 0; i < 3; i++) {
    const activeSkills = getSkillsByRarityAndType(newRarity, 'active');
    const passiveSkills = getSkillsByRarityAndType(newRarity, 'passive');
    
    const randomActiveSkill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
    const randomPassiveSkill = passiveSkills[Math.floor(Math.random() * passiveSkills.length)];
    
    skillSets.push({
      id: `skillset_${i + 1}`,
      name: `技能方案${i + 1}`,
      skill_1: randomActiveSkill.id,
      skill_2: randomPassiveSkill.id,
      skills: [randomActiveSkill, randomPassiveSkill],
    });
  }
  
  return skillSets;
}
```

**升级界面示例**：

```
┌─────────────────────────────────────────────────────────┐
│                      官职升级                           │
│                  军侯(⚪白) → 都尉(💙蓝)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎉 恭喜！经验值已满，可以升级官职！                   │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  第一步：选择属性增长方案（3选1）                      │
│                                                         │
│  方案A（运气+勇气）  方案B（统帅+武力）  方案C（智政魅）│
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐│
│  │ 🎲 运气 +1.2  │  │ ⚔️  统帅 +0.8  │  │ 📚 智力 +1.1  ││
│  │ 💪 勇气 +0.8  │  │ 🗡️  武力 +1.2  │  │ 🏛️  政治 +0.9  ││
│  │               │  │               │  │ ✨ 魅力 +1.0  ││
│  │ 合计: +2.0    │  │ 合计: +2.0    │  │ 合计: +3.0    ││
│  │ [选择]        │  │ [选择]        │  │ [选择]        ││
│  └───────────────┘  └───────────────┘  └───────────────┘│
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  第二步：选择新技能（3选1）                            │
│                                                         │
│  技能方案1         技能方案2         技能方案3         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐│
│  │ ⚔️  突击(主动) │  │ ⚔️  冲锋(主动) │  │ ⚔️  斩击(主动) ││
│  │ 🛡️  坚守(被动) │  │ 🛡️  铁壁(被动) │  │ 🛡️  反击(被动) ││
│  │ [选择]        │  │ [选择]        │  │ [选择]        ││
│  └───────────────┘  └───────────────┘  └───────────────┘│
│                                                         │
│  [ 确认升级 ]                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**装备加成**：
- 武器、防具、饰品提供属性加成
- 装备加成：+0.5-2.0
- 详见 `ITEM_CARD_SYSTEM.md`

#### NPC武将成长

**固定属性**：
- NPC武将属性固定，不会成长
- 但可以通过装备、官职获得加成

#### 最终属性计算

```javascript
最终属性 = 基础属性 + 官职升级增长 + 装备加成 + 临时加成
```

**示例：玩家角色**
```javascript
{
  // 基础属性（创建时，common稀有度）
  baseCommand: 6.8,
  
  // 官职升级增长（4次升级，每次+2.0，共+8.0）
  // 1级军侯→2级都尉：+0.8
  // 2级都尉→3级校尉：+1.2
  // 3级校尉→4级中郎将：+1.0
  // 4级中郎将→5级将军：+1.0
  growthCommand: 4.0,
  
  // 装备加成（青龙偃月刀）
  equipmentCommand: 1.5,
  
  // 临时加成（技能、buff）
  tempCommand: 2.0,
  
  // 最终统率
  finalCommand: 6.8 + 4.0 + 1.5 + 2.0 = 14.3
}
```

**玩家角色成长路径**：
```
初始（common）：总属性点 44-48
  ↓ 升级到2级都尉（rare）：+2.0属性点
2级都尉（rare）：总属性点 46-50
  ↓ 升级到3级校尉（rare）：+2.0属性点
3级校尉（rare）：总属性点 48-52
  ↓ 升级到4级中郎将（epic）：+2.0属性点
4级中郎将（epic）：总属性点 50-54
  ↓ 升级到5级将军（epic）：+2.0属性点
5级将军（epic）：总属性点 52-56
  ↓ 升级到6级四安/四平/四镇/四征（legendary）：+2.0属性点
6级（legendary）：总属性点 54-58
  ↓ 升级到7级骠骑/车骑（legendary）：+2.0属性点
7级（legendary）：总属性点 56-60
  ↓ 升级到8级大司马/大将军（legendary）：+2.0属性点
8级（legendary）：总属性点 58-62

最大成长：+14.0属性点（7次升级）
最高稀有度：legendary（🟠橙）
```

**重要限制**：
- ⚠️ 玩家最高只能达到legendary稀有度
- ⚠️ 玩家无法获取core级别技能
- ⚠️ 核心技能仅限NPC武将使用，保持其独特性

**注意事项**：
- ⚠️ 所有属性值必须在0.0-10.0范围内（基础属性）
- ⚠️ 显示时保留一位小数（如8.5）
- ⚠️ 计算时使用浮点数运算
- ⚠️ 成长后需要四舍五入到一位小数
- ⚠️ 最终属性可以超过10.0（加上加成后）

---

## ⚔️ 二、技能系统

### 2.1 技能概述

每个武将拥有2个技能：
- **skill_1**: 主动技能（active）
- **skill_2**: 被动技能（passive）

### 2.2 技能ID规则

**格式**：
```
skill_{类型}_{稀有度}{编号}
```

**类型代码**：
- `1` - 主动技能
- `2` - 被动技能

**稀有度编号**：
- `5` - core（核心）
- `4` - legendary（传奇）
- `3` - epic（史诗）
- `2` - rare（稀有）
- `1` - common（普通）

**示例**：
```
skill_1_5001  // 主动技能，核心稀有度，编号001
skill_2_4001  // 被动技能，传奇稀有度，编号001
```

### 2.3 技能稀有度匹配

技能稀有度必须与武将稀有度完全匹配：

| 武将稀有度 | 可用技能 |
|-----------|---------|
| core | `skill_x_5xxx` |
| legendary | `skill_x_4xxx` |
| epic | `skill_x_3xxx` |
| rare | `skill_x_2xxx` |
| common | `skill_x_1xxx` |

### 2.4 技能数据结构

**CSV格式** (`skill-template.csv`):
```csv
skill_id,skill_name,damage_type,character_type,effect_type,effect_value,description
skill_1_5001,圣斩,physical,military;balanced,active,,对目标十字型位置敌人造成200%伤害
skill_2_5001,群雄,,,passive,,可上阵部队数+1
```

**字段说明**：
- `skill_id` - 技能ID
- `skill_name` - 技能名称 ⭐ 已移至第2列
- `damage_type` - 伤害类型（physical/strategy）
- `character_type` - 角色类型限制（military/strategist/balanced，可用分号分隔多个）
- `effect_type` - 效果类型（active/passive）
- `effect_value` - 效果值（保留字段，暂未使用）
- `description` - 技能描述（前端显示内容）⭐

**JSON格式** (`skills.json`):
```json
{
  "id": "skill_1_5001",
  "name": "圣斩",
  "type": "active",
  "typeName": "主动技能",
  "rarity": "core",
  "rarityName": "核心",
  "damageType": "physical",
  "characterType": "military;balanced",
  "effectType": "active",
  "effectValue": "",
  "description": "对目标十字型位置敌人造成200%伤害"
}
```

**前端显示**：
- 前端组件使用 `description` 字段显示技能效果
- `effectValue` 字段保留但不再使用

### 2.5 技能统计

- **总计**: 64个技能
- **主动技能**: 30个
- **被动技能**: 34个

**稀有度分布**：
| 稀有度 | 主动技能 | 被动技能 |
|--------|---------|---------|
| Core | 4 | 4 |
| Legendary | 8 | 12 |
| Epic | 6 | 6 |
| Rare | 6 | 6 |
| Common | 6 | 6 |

### 2.6 技能工具

**CSV转JSON工具**：
```bash
node tools/skill-csv-to-json.cjs
```

**技能分配工具**：
```bash
node tools/assign-skills-to-heroes.cjs
```

**技能验证工具**：
```bash
node tools/verify-hero-skills.cjs
```

---

## 🤝 三、羁绊系统

### 3.1 羁绊概述

羁绊是特定武将组合上阵时触发的特殊效果，提供属性加成或特殊能力。

### 3.2 羁绊ID规则

**格式**：
```
bond_{类型}_{稀有度}{编号}
```

**类型代码**：
- `1` - 主动羁绊（提供新技能）
- `2` - 被动羁绊（属性加成）

**稀有度编号**：
- `5` - core（核心）
- `4` - legendary（传奇）
- `3` - epic（史诗）
- `2` - rare（稀有）
- `1` - common（普通）

**示例**：
```
bond_1_5001  // 主动羁绊，核心稀有度，编号001
bond_2_4001  // 被动羁绊，传奇稀有度，编号001
```

### 3.3 羁绊数据结构

**CSV格式** (`bond-template.csv`):
```csv
bond_id,bond_name,min_characters,effect_type,effect_value,description
bond_1_5001,无双,2,active,,获得技能【无双】对单个敌人造成300%伤害
bond_2_5001,桃园,3,passive,,所有属性+3
```

**字段说明**：
- `bond_id` - 羁绊ID
- `bond_name` - 羁绊名称
- `min_characters` - 最少触发角色数
- `effect_type` - 效果类型（active/passive）
- `effect_value` - 效果值（保留字段，暂未使用）
- `description` - 羁绊描述（前端显示内容）⭐

**JSON格式** (`bonds.json`):
```json
{
  "id": "bond_2_5001",
  "name": "桃园",
  "type": "passive",
  "typeName": "被动羁绊",
  "rarity": "core",
  "rarityName": "核心",
  "minCharacters": 3,
  "effectType": "attribute_boost",
  "effectValue": "",
  "description": "所有属性+3"
}
```

**前端显示**：
- 前端组件使用 `description` 字段显示羁绊效果
- `effectValue` 字段保留但不再使用

### 3.4 羁绊关联方式

羁绊信息存储在角色表格中（`hero-template.csv`）：

```csv
char_id,char_name,bond,biography,description
char_san_1101,刘备,桃园,《先主传》,汉室宗亲...
char_san_1102,关羽,桃园;五虎;无双,《关羽传》,义薄云天...
char_san_1103,张飞,桃园;五虎;无双,《张飞传》,喝断长坂...
```

**说明**：
- 多个羁绊用分号 `;` 分隔
- 填写羁绊的中文名称
- 系统自动匹配羁绊ID和效果

### 3.5 羁绊触发逻辑

```javascript
function checkBonds(team) {
  const activeBonds = new Map();
  
  // 收集所有队伍成员的羁绊
  const allBonds = new Set();
  team.forEach(hero => {
    if (hero.bonds && hero.bonds.length > 0) {
      hero.bonds.forEach(bond => allBonds.add(bond));
    }
  });
  
  // 遍历所有可能的羁绊
  for (const bondName of allBonds) {
    const bondConfig = getBondConfig(bondName);
    if (!bondConfig) continue;
    
    // 统计队伍中有多少该羁绊的成员
    const count = team.filter(hero => 
      hero.bonds && hero.bonds.includes(bondName)
    ).length;
    
    // 如果达到最小人数，触发羁绊
    if (count >= bondConfig.minCharacters) {
      activeBonds.set(bondName, {
        bond: bondConfig,
        count: count,
        effect: bondConfig.effects[count],
      });
    }
  }
  
  return Array.from(activeBonds.values());
}
```

### 3.6 羁绊统计

- **总计**: 21个羁绊
- **主动羁绊**: 2个
- **被动羁绊**: 19个

**稀有度分布**：
- **核心 (core)**: 9个
- **传奇 (legendary)**: 7个
- **史诗 (epic)**: 5个

### 3.7 羁绊工具

**CSV转JSON工具**：
```bash
node tools/bond-csv-to-json.cjs
```

---

## 📖 四、传记系统

### 4.1 传记概述

传记系统基于《三国志》是否为武将立传，有传记的武将获得属性加成。

### 4.2 传记分类

| 传记类型 | 加成 | 说明 |
|---------|------|------|
| 特殊传记 | 全属性 +0.5 | 有独立传记的武将 |
| 《三国志》 | 无加成 | 默认传记，所有武将都有 |

### 4.3 传记加成规则

**有加成传记**：
- 条件：`biography` 字段存在且不是《三国志》
- 效果：全属性 +0.5（运气、勇气、统帅、武力、智力、政治、魅力）
- 示例：《先主传》、《关羽传》、《张飞传》

**无加成传记**：
- 条件：`biography` 字段为《三国志》或为空
- 效果：无属性加成
- 说明：《三国志》是基础传记，所有武将的默认来源

### 4.4 传记数据结构

传记信息存储在角色表格中（`hero-template.csv`）：

```csv
char_id,char_name,biography,description
char_san_1101,刘备,《先主传》,汉室宗亲。中山靖王之后...
char_san_1102,关羽,《关羽传》,义薄云天。字云长...
char_san_1103,张飞,《张飞传》,喝断长坂。字益德...
```

### 4.5 传记加成计算

```javascript
function calculateBiographyBonus(character) {
  // 判断是否有加成
  const hasBiographyBonus = character.biography && 
                           character.biography !== '《三国志》';
  
  if (hasBiographyBonus) {
    return {
      luck: 0.5,
      courage: 0.5,
      command: 0.5,
      combat: 0.5,
      intelligence: 0.5,
      politics: 0.5,
      charisma: 0.5,
    };
  }
  
  return null;
}
```

---

## 🎨 五、前端显示

### 5.1 武将卡片布局

```
┌─────────────────────────┐
│ 武将头部（名称、稀有度）  │
├─────────────────────────┤
│ 武将属性（7个属性）       │
├─────────────────────────┤
│ 技能：                   │
│ ⚔️ 技能1 (物理)          │
│ 🛡️ 技能2                │
├─────────────────────────┤
│ 羁绊：                   │
│ 🔗 羁绊1                 │
│ 🤝 羁绊2                 │
├─────────────────────────┤
│ 传记：                   │
│ 📖 《先主传》(+0.5全属性) │
└─────────────────────────┘
```

### 5.2 颜色方案

| 类型 | 图标 | 背景色 | 文字色 | 边框色 |
|------|------|--------|--------|--------|
| 主动技能 | ⚔️ | red-50 | red-700 | red-200 |
| 被动技能 | 🛡️ | blue-50 | blue-700 | blue-200 |
| 主动羁绊 | 🔗 | amber-50 | amber-700 | amber-200 |
| 被动羁绊 | 🤝 | teal-50 | teal-700 | teal-200 |
| 有加成传记 | 📖 | emerald-50 | emerald-700 | emerald-200 |
| 无加成传记 | 📖 | gray-50 | gray-600 | gray-200 |
| 无内容 | - | gray-50 | gray-500 | gray-200 |

### 5.3 交互效果

**鼠标悬停**：
- 技能：显示 `effectValue`（技能效果描述）
- 羁绊：显示 `effectValue`（羁绊效果描述）
- 传记：显示 `description`（传记详细描述）

**点击效果**：
- 点击整个卡片：触发选择回调

### 5.4 前端组件

**CharacterCard组件**：
```jsx
export function CharacterCard({ 
  character, 
  skillsMap = {}, 
  bondsMap = {}, 
  onSelect 
}) {
  // 解析羁绊
  let bonds = [];
  if (Array.isArray(character.bonds)) {
    bonds = character.bonds;
  } else if (character.bond) {
    bonds = character.bond.split(';').map(b => b.trim()).filter(b => b);
  }
  
  // 判断传记加成
  const hasBiographyBonus = character.biography && 
                           character.biography !== '《三国志》';
  
  // ... 渲染逻辑
}
```

**Hooks**：
- `useCharacters()` - 加载角色数据
- `useSkills()` - 加载技能数据
- `useBonds()` - 加载羁绊数据

---

## 💾 六、数据文件

### 6.1 字段命名规范

为了保持代码一致性，我们统一了字段的命名规则：

**统一后的命名**：

| 位置 | 字段名 | 格式 | 说明 |
|------|--------|------|------|
| **角色CSV** | `character_id` | 下划线命名 | hero-template.csv表头 |
| **角色CSV** | `character_name` | 下划线命名 | hero-template.csv表头 |
| **角色CSV** | `character_type` | 下划线命名 | hero-template.csv表头 |
| **角色CSV** | `birth_year` | 下划线命名 | hero-template.csv表头 |
| **角色CSV** | `death_year` | 下划线命名 | hero-template.csv表头 |
| **技能CSV** | `character_type` | 下划线命名 | skill-template.csv表头 |
| **角色JSON** | `id` | 驼峰命名 | characters.json（从character_id转换） |
| **角色JSON** | `name` | 驼峰命名 | characters.json（从character_name转换） |
| **角色JSON** | `characterType` | 驼峰命名 | characters.json（自动转换） |
| **角色JSON** | `birthYear` | 驼峰命名 | characters.json（自动转换） |
| **角色JSON** | `deathYear` | 驼峰命名 | characters.json（自动转换） |
| **技能JSON** | `characterType` | 驼峰命名 | skills.json（自动转换） |
| **代码中** | `name` | 驼峰命名 | 所有JS/JSX文件 |
| **代码中** | `characterType` | 驼峰命名 | 所有JS/JSX文件 |

**命名规则**：

✅ **CSV文件**：使用下划线命名（snake_case）
- `character_id` - 角色ID
- `character_name` - 角色名称
- `character_type` - 角色类型
- `birth_year` - 出生年份
- `death_year` - 去世年份
- 符合CSV文件的传统命名习惯

✅ **JSON/代码**：使用驼峰命名（camelCase）
- `id` - 角色ID（从character_id转换）
- `name` - 角色名称（从character_name转换）
- `characterType` - 角色类型
- `birthYear` - 出生年份
- `deathYear` - 去世年份
- 符合JavaScript命名规范

✅ **自动转换**：CSV → JSON 时自动转换
- `character_id` → `id`
- `character_name` → `name`
- `character_type` → `characterType`
- `birth_year` → `birthYear`
- `death_year` → `deathYear`

**字段值说明**：

角色类型（character_type / characterType）：

| 值 | 中文 | 说明 |
|---|------|------|
| `military` | 武官型 | 主要4项：运气、勇气、统帅、武力 |
| `strategist` | 军师型 | 主要4项：运气、智力、政治、魅力 |
| `balanced` | 文武双全 | 7项属性均衡 |

技能类型限制（character_type / characterType）：

技能的 `character_type` 字段可以包含多个类型（用分号分隔）：

| 值 | 说明 |
|---|------|
| `military` | 只有武官型可用 |
| `strategist` | 只有军师型可用 |
| `balanced` | 只有文武双全可用 |
| `military;balanced` | 武官型和文武双全可用 |
| `military;strategist;balanced` | 所有类型可用 |
| 空值 | 所有类型可用 |

### 6.2 CSV文件（数据源）

| 文件 | 说明 | 位置 |
|------|------|------|
| `hero-template.csv` | 角色数据 | `tools/` |
| `skill-template.csv` | 技能数据 | `tools/` |
| `bond-template.csv` | 羁绊数据 | `tools/` |

### 6.3 JSON文件（生成文件）

| 文件 | 说明 | 位置 |
|------|------|------|
| `characters.json` | 角色JSON | `public/data/shared/` |
| `skills.json` | 技能JSON | `public/data/shared/` |
| `bonds.json` | 羁绊JSON | `public/data/shared/` |

### 6.4 工具脚本

| 工具 | 功能 | 命令 |
|------|------|------|
| `hero-csv-to-json.cjs` | 角色CSV转JSON | `node tools/hero-csv-to-json.cjs` |
| `skill-csv-to-json.cjs` | 技能CSV转JSON | `node tools/skill-csv-to-json.cjs` |
| `bond-csv-to-json.cjs` | 羁绊CSV转JSON | `node tools/bond-csv-to-json.cjs` |
| `assign-skills-to-heroes.cjs` | 技能分配 | `node tools/assign-skills-to-heroes.cjs` |
| `verify-hero-skills.cjs` | 技能验证 | `node tools/verify-hero-skills.cjs` |

---

## 📊 七、数据统计

### 7.1 S1赛季武将统计

- **总计**: 140个武将
- **Core（核心）**: 7个
- **Legendary（传奇）**: 9个
- **Epic（史诗）**: 39个
- **Rare（稀有）**: 34个
- **Common（普通）**: 51个

### 7.2 技能统计

- **总计**: 64个技能
- **主动技能**: 30个
- **被动技能**: 34个
- **所有武将都已分配技能** ✅

### 7.3 羁绊统计

- **总计**: 21个羁绊
- **主动羁绊**: 2个
- **被动羁绊**: 19个

### 7.4 传记统计

- **有特殊传记**: 约30-40个武将
- **《三国志》传记**: 其余武将
- **传记加成**: 全属性 +0.5

---

## 🎯 八、战斗计算公式

### 8.1 闪避与命中系统

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

### 8.2 物理伤害系统

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

### 8.3 计谋伤害系统

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

### 8.4 暴击系统

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

### 8.5 防御系统

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

### 8.6 技能伤害类型

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

**详细战斗系统请参考**：[18-COMBAT_SYSTEM.md](../10-core-system/18-COMBAT_SYSTEM.md)

---

## 🎯 九、设计原则

### 9.1 数据一致性

**单一数据源原则**：
- 角色拥有什么 → 存储在 `hero-template.csv`
- 技能/羁绊是什么 → 存储在各自的模板文件

**字段命名统一**：
- 技能和羁绊使用相同的字段结构
- `effectType` + `effectValue` 统一命名

### 9.2 平衡性设计

**稀有度匹配**：
- 技能稀有度必须与武将稀有度匹配
- 羁绊稀有度反映触发难度

**属性平衡**：
- balanced类型总属性点+2
- 类型属性比例有明确规则
- 阶段修正反映角色生命周期

### 9.3 可扩展性

**模块化设计**：
- 技能、羁绊、传记独立管理
- 易于添加新内容
- 工具自动化处理

**数据驱动**：
- CSV编辑，工具生成JSON
- 前端直接使用JSON数据
- 修改数据无需改代码

---

## 🔧 十、开发工作流

### 10.1 添加新武将

1. 编辑 `tools/hero-template.csv`
2. 填写角色基础信息
3. 分配技能（使用工具或手动）
4. 填写羁绊（中文名，分号分隔）
5. 填写传记
6. 运行 `node tools/hero-csv-to-json.cjs`
7. 验证生成的JSON文件

### 10.2 添加新技能

1. 编辑 `tools/skill-template.csv`
2. 填写技能信息（ID、名称、效果）
3. 运行 `node tools/skill-csv-to-json.cjs`
4. 验证生成的JSON文件
5. 为武将分配新技能

### 10.3 添加新羁绊

1. 编辑 `tools/bond-template.csv`
2. 填写羁绊信息（ID、名称、效果）
3. 运行 `node tools/bond-csv-to-json.cjs`
4. 在 `hero-template.csv` 中为武将添加羁绊
5. 重新生成角色JSON

---

## 📚 十一、相关文档

### 11.1 工具文档

- `tools/README.md` - 工具脚本总览
- `tools/EXCEL_GUIDE.md` - Excel数据处理指南

### 11.2 系统文档

- [92-ID_NAMING_GUIDE.md](../../base/92-ID_NAMING_GUIDE.md) - ID命名规范
- [TROOP_TEMPLATE_GUIDE.md](../../../tools/TROOP_TEMPLATE_GUIDE.md) - 部队模板使用指南
- [18-COMBAT_SYSTEM.md](../10-core-system/18-COMBAT_SYSTEM.md) - 战斗系统
- [ATTRIBUTES_QUICK_REF.md](../../archive/ATTRIBUTES_QUICK_REF.md) - 属性快速参考

### 11.3 其他文档

- [01-SEASON_SYSTEM.md](../../base/01-SEASON_SYSTEM.md) - 赛季系统
- [11-FACTION_SYSTEM.md](../10-core-system/11-FACTION_SYSTEM.md) - 势力系统
- [14-PLAYER_SYSTEM.md](../10-core-system/14-PLAYER_SYSTEM.md) - 玩家系统（包含官职系统）

---

## ✅ 十二、完成状态

### 12.1 已完成功能

- ✅ 角色属性系统设计
- ✅ 属性生成规则v3.2（包含差值限制）
- ✅ 180个武将数据完成（S1赛季）
- ✅ 技能系统完整实现（64个技能）
- ✅ 羁绊系统完整实现（21个羁绊）
- ✅ 传记系统完整实现
- ✅ 生涯系统完整实现（9个赛季）
- ✅ 所有武将技能分配完成
- ✅ 前端UI完整显示
- ✅ 数据工具完善
- ✅ 文档完整整合

### 12.2 数据验证

- ✅ 所有武将属性符合规则
- ✅ Military类型：主要4项占60%-65%，差值≤3.5
- ✅ Strategist类型：主要4项占60%-65%，差值≤3.5
- ✅ Balanced类型：最大差值≤2.0
- ✅ 所有技能ID格式正确
- ✅ 技能稀有度匹配武将稀有度
- ✅ 羁绊数据结构正确
- ✅ 传记加成逻辑正确
- ✅ 前端显示正常

---

## 🎉 总结

角色系统是游戏的核心，包含多个紧密关联的子系统：

1. **角色属性** - 定义角色的基础能力
2. **属性生成规则v3.2** - 确保属性分配合理均衡
3. **生涯系统** - 体现武将在不同赛季的成长轨迹
4. **技能系统** - 提供战斗和策略能力
5. **羁绊系统** - 增加武将搭配的策略深度
6. **传记系统** - 体现武将的历史地位

所有系统都已完整实现，数据完善，工具齐全，文档清晰。

**核心特点**：
- 📊 **数据驱动** - CSV编辑，工具生成
- 🎯 **平衡设计** - 稀有度匹配，属性规则v3.2
- 🔧 **工具完善** - 自动化处理，验证工具
- 🎨 **UI完整** - 所有词条完整显示
- 📚 **文档清晰** - 统一管理，易于维护
- ✅ **规则严格** - 差值限制，确保数值合理

**v3.2属性生成规则亮点**：
- ✅ Military/Strategist类型主要4项属性差值≤3.5
- ✅ Balanced类型全部7项属性差值≤2.0
- ✅ 优化权重分配算法（0.7-1.3范围）
- ✅ 增加尝试次数（50次）确保生成成功
- ✅ 所有180个武将100%符合规则

---

**文档作者**: Kiro AI  
**最后更新**: 2026-02-08  
**文档版本**: v3.0.0


---

## 🎨 八、前端使用指南

### 8.1 快速开始

#### 启动开发服务器

```bash
cd 05-san-storm
npm run dev
```

#### 访问页面

- 武将列表：`http://localhost:5173/characters`
- 生涯：`http://localhost:5173/life-stages`

### 8.2 组件使用

#### 武将卡片组件

```jsx
import { CharacterCard } from '@/components/character/CharacterCard';
import { useCharacters } from '@/hooks/useCharacters';
import { useSkills } from '@/hooks/useSkills';
import { useBonds } from '@/hooks/useBonds';

function MyComponent() {
  const { characters } = useCharacters();
  const { skillsMap } = useSkills();
  const { bondsMap } = useBonds();
  
  return (
    <div>
      {characters.map(character => (
        <CharacterCard
          key={character.id}
          character={character}
          skillsMap={skillsMap}
          bondsMap={bondsMap}
          onSelect={(char) => console.log('选择了', char.name)}
        />
      ))}
    </div>
  );
}
```

#### 生涯详情组件

```jsx
import { LifeStageDetail } from '@/components/character/LifeStageDetail';
import { useLifeStages } from '@/hooks/useLifeStages';
import { useState } from 'react';

function MyComponent() {
  const { getCharacterLifeStage, loading } = useLifeStages();
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  if (loading) {
    return <div>加载中...</div>;
  }
  
  // 获取关羽的生涯数据
  const guanyu = getCharacterLifeStage('char_san_1102');
  
  return (
    <>
      <button onClick={() => setSelectedCharacter(guanyu)}>
        查看关羽生涯
      </button>
      
      {selectedCharacter && (
        <LifeStageDetail
          characterData={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </>
  );
}
```

### 8.3 Hook API

#### useCharacters

```javascript
const {
  characters,        // 所有武将数据
  loading,          // 加载状态
  error,            // 错误信息
  filterCharacters, // 筛选武将
  sortCharacters,   // 排序武将
} = useCharacters();

// 筛选示例
const filtered = filterCharacters({
  faction: '刘备',
  rarity: 'legendary',
  search: '关羽',
});

// 排序示例
const sorted = sortCharacters(characters, 'rarity', 'desc');
```

#### useLifeStages

```javascript
const {
  lifeStages,              // 所有生涯数据
  loading,                 // 加载状态
  error,                   // 错误信息
  getCharacterLifeStage,   // 获取指定武将数据
  getSeasonData,           // 获取指定武将在指定赛季的数据
  getSeasonStats,          // 获取指定赛季的统计数据
} = useLifeStages();

// 获取关羽的完整数据
const guanyu = getCharacterLifeStage('char_san_1102');

// 获取关羽在S1的数据
const guanyuS1 = getSeasonData('char_san_1102', 'S1');

// 获取S1赛季的统计
const s1Stats = getSeasonStats('S1');
// 返回: { early: 19, peak: 111, late: 10, death: 0, total: 140 }
```

#### useSkills

```javascript
const {
  skills,      // 所有技能数据（数组）
  skillsMap,   // 技能ID到技能对象的映射
  loading,     // 加载状态
  error,       // 错误信息
} = useSkills();

// 通过ID获取技能
const skill = skillsMap['skill_1_5001'];
```

#### useBonds

```javascript
const {
  bonds,      // 所有羁绊数据（数组）
  bondsMap,   // 羁绊名称到羁绊对象的映射
  loading,    // 加载状态
  error,      // 错误信息
} = useBonds();

// 通过名称获取羁绊
const bond = bondsMap['桃园'];
```

### 8.4 数据生成

#### 生成武将数据

```bash
# 从CSV生成JSON
node tools/hero-csv-to-json.cjs

# 输出文件
# - public/data/shared/characters.json
```

#### 生成生涯数据

```bash
# 1. 先生成武将数据（包含deathYear字段）
node tools/hero-csv-to-json.cjs

# 2. 计算生涯数据
node tools/calculate-life-stages.cjs

# 输出文件
# - public/data/shared/life-stages.json (140武将×9赛季=1260条)
```

#### 生成技能数据

```bash
# 从CSV生成JSON
node tools/skill-csv-to-json.cjs

# 输出文件
# - public/data/shared/skills.json
```

#### 生成羁绊数据

```bash
# 从CSV生成JSON
node tools/bond-csv-to-json.cjs

# 输出文件
# - public/data/shared/bonds.json
```

### 8.5 生涯UI功能

#### 功能特性

✅ 显示武将在9个赛季的完整数据  
✅ 可切换查看不同赛季的详细信息  
✅ 显示每个赛季的年龄、阶段、属性、总属性点  
✅ 成长轨迹统计（茅庐、巅峰、不惑、卒各有多少个赛季）  
✅ 基础属性对比  
✅ 模态弹窗形式展示  
✅ 响应式设计，支持移动端  

#### 视觉效果

- 🌱 茅庐：绿色系（bg-green-50, text-green-700）
- ⭐ 巅峰：黄色系（bg-yellow-50, text-yellow-700）
- 🧙 不惑：紫色系（bg-purple-50, text-purple-700）
- 💀 卒：灰色系（bg-gray-50, text-gray-700）

#### 交互效果

- hover时卡片阴影加深
- hover时卡片轻微放大（scale-105）
- 当前选中赛季蓝色边框高亮
- 已故赛季灰色显示
- 平滑的过渡动画

### 8.6 常见问题

#### Q: 页面显示"加载中..."一直不消失？
A: 检查数据文件是否存在。如果不存在，运行数据生成脚本：
```bash
node tools/hero-csv-to-json.cjs
node tools/calculate-life-stages.cjs
node tools/skill-csv-to-json.cjs
node tools/bond-csv-to-json.cjs
```

#### Q: 点击武将没有反应？
A: 检查浏览器控制台是否有错误。确保武将有对应的数据。

#### Q: 如何添加新武将？
A: 
1. 在 `tools/hero-template.csv` 中添加新武将数据
2. 运行 `node tools/hero-csv-to-json.cjs` 生成JSON
3. 运行 `node tools/calculate-life-stages.cjs` 生成生涯数据

#### Q: 如何添加新技能？
A: 
1. 在 `tools/skill-template.csv` 中添加新技能数据
2. 运行 `node tools/skill-csv-to-json.cjs` 生成JSON

#### Q: 如何添加新羁绊？
A: 
1. 在 `tools/bond-template.csv` 中添加新羁绊数据
2. 运行 `node tools/bond-csv-to-json.cjs` 生成JSON

---

## ⚔️ 九、阵型系统（子系统）

### 9.1 系统概述

阵型系统是战斗中的核心策略要素，当部队数≥3时可选择阵型，获得不同的属性加成和特殊效果。

**核心理念**：
- ✅ **经典阵型** - 参考三国志系列经典阵型
- ✅ **属性加成** - 不同阵型提供不同加成
- ✅ **集团攻击** - 整队编制成阵型，同时行动
- ✅ **策略深度** - 根据敌人选择合适阵型

### 9.2 阵型解锁条件

| 部队数 | 可用阵型 | 说明 |
|--------|---------|------|
| 1-2支 | 无阵型 | 散兵作战 |
| 3支 | 基础阵型 | 锋矢、鹤翼、鱼鳞 |
| 4支 | 进阶阵型 | 方圆、偃月 |
| 5支 | 高级阵型 | 八卦、长蛇 |

### 9.3 经典阵型详解

#### 锋矢阵 (Arrow Formation) 🔺

**解锁条件**：3支部队

**属性加成**：
- 攻击力：+2.0
- 移动力：+1
- 突破力：+30%

**特殊效果**：
- **锋矢突击** - 集团攻击时，对单个目标造成150%伤害
- **破阵** - 对防御阵型额外+20%伤害

**适用场景**：进攻作战、快速突破、单点击破

---

#### 鹤翼阵 (Crane Wing Formation) 🦅

**解锁条件**：3支部队

**属性加成**：
- 防御力：+1.5
- 攻击范围：+1格
- 包围加成：+25%

**特殊效果**：
- **双翼夹击** - 集团攻击时，对被包围的敌人造成180%伤害
- **侧翼防护** - 受到侧面攻击时，伤害减免20%

**适用场景**：包围作战、防守反击、多目标作战

---

#### 鱼鳞阵 (Fish Scale Formation) 🐟

**解锁条件**：3支部队

**属性加成**：
- 防御力：+2.0
- 士气：+1.0
- 反击伤害：+20%

**特殊效果**：
- **层层防御** - 前排被击破后，后排自动补位
- **坚守** - 防守时，防御力额外+1.0

**适用场景**：防守作战、持久战、抵御强敌

---

#### 方圆阵 (Square Formation) ⬜

**解锁条件**：4支部队

**属性加成**：
- 全属性：+1.0
- 士气：+1.5
- 四面防御：+15%

**特殊效果**：
- **四面防御** - 受到任何方向攻击，伤害减免15%
- **稳固** - 不会被击退或混乱

**适用场景**：全面防守、被包围时、持久战

---

#### 偃月阵 (Crescent Moon Formation) 🌙

**解锁条件**：4支部队

**属性加成**：
- 防御力：+1.5
- 反击伤害：+30%
- 士气：+1.0

**特殊效果**：
- **月牙反击** - 敌人进入包围圈时，自动反击
- **诱敌深入** - 敌人攻击中军时，两翼自动夹击

**适用场景**：防守反击、诱敌深入、反击战术

---

#### 八卦阵 (Eight Trigrams Formation) ☯️

**解锁条件**：5支部队

**属性加成**：
- 全属性：+1.5
- 智力加成：+2.0
- 计谋成功率：+20%

**特殊效果**：
- **八卦变化** - 每回合可变换阵型位置
- **迷阵** - 敌人攻击命中率-15%
- **奇门遁甲** - 计谋伤害+50%

**适用场景**：谋略战、复杂战况、高智力角色

---

#### 长蛇阵 (Long Snake Formation) 🐍

**解锁条件**：5支部队

**属性加成**：
- 移动力：+2
- 速度：+2.0
- 连击率：+25%

**特殊效果**：
- **首尾呼应** - 攻击蛇头，蛇尾反击；攻击蛇尾，蛇头反击
- **蛇行** - 移动时不受地形限制
- **连环攻击** - 集团攻击时，5支部队依次攻击

**适用场景**：机动作战、追击战、复杂地形

### 9.4 集团攻击系统

**核心机制**：将整个阵型作为一个整体，同时对敌方发起攻击。

**集团攻击伤害计算**：
```javascript
// 基础伤害 = 所有部队攻击力之和
baseDamage = troop1.attack + troop2.attack + troop3.attack + ...

// 阵型加成
formationBonus = formation.attackBonus

// 集团加成（多支部队协同）
groupBonus = troopCount * 0.2  // 每支部队+20%

// 最终伤害
finalDamage = baseDamage * (1 + formationBonus + groupBonus)
```

**集团攻击限制**：
- 冷却时间：2-3回合
- 士气消耗：1.0
- 阵型要求：必须保持阵型完整
- 范围限制：只能攻击阵型前方的敌人

### 9.5 阵型克制关系

```
锋矢阵 → 克制 → 鱼鳞阵（破防御）
鹤翼阵 → 克制 → 锋矢阵（包围突击）
鱼鳞阵 → 克制 → 鹤翼阵（坚守防御）
方圆阵 → 平衡型，无明显克制
偃月阵 → 克制 → 锋矢阵（反击突击）
八卦阵 → 克制 → 所有阵型（智力碾压）
长蛇阵 → 克制 → 方圆阵（机动灵活）
```

### 9.6 战术应用

**进攻战术**：
- 推荐阵型：锋矢阵、长蛇阵
- 快速移动到敌阵前 → 使用集团攻击突破 → 击溃敌军主力

**防守战术**：
- 推荐阵型：鱼鳞阵、方圆阵
- 占据有利地形 → 等待敌人进攻 → 反击时使用集团攻击

**包围战术**：
- 推荐阵型：鹤翼阵、偃月阵
- 两翼包抄敌军 → 形成包围圈 → 集团攻击歼灭

**谋略战术**：
- 推荐阵型：八卦阵
- 使用计谋削弱敌军 → 变换阵型迷惑敌人 → 集团攻击收割

### 9.7 与角色系统的关联

**角色属性影响阵型效果**：
- **统帅** - 影响阵型加成效果
- **智力** - 影响八卦阵的计谋效果
- **勇气** - 影响集团攻击的伤害
- **士气（奋战值）** - 影响阵型稳定性

**阵型解锁进度**：

| 阶段 | 部队数 | 可用阵型 | 战斗力 |
|------|-------|---------|--------|
| 新手 | 1-2 | 无 | 基础 |
| 初期 | 3 | 锋矢/鹤翼/鱼鳞 | 中等 |
| 中期 | 4 | +方圆/偃月 | 较强 |
| 后期 | 5 | +八卦/长蛇 | 最强 |

---

## 📚 十、相关文档

### 核心文档
- `MILESTONE2_CHECKLIST.md` - 里程碑2工作清单
- `SEASON_ROADMAP.md` - 9个赛季的完整定义
- `POSITION_SYSTEM.md` - 官职系统文档

### 工具文档
- `tools/README.md` - 工具脚本总览
- `tools/EXCEL_GUIDE.md` - Excel数据处理指南
- `TROOP_TEMPLATE_GUIDE.md` - 部队模板使用指南

---

**最后更新**: 2026-02-08  
**版本**: v3.0.0  
**维护者**: Kiro AI  
**状态**: ✅ 生产就绪

