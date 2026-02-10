# 事件系统文档

**最后更新**: 2026-02-09  
**文档版本**: v1.0.0  
**状态**: 概要设计（细节待完善）

---

## 📋 系统概述

事件系统是游戏的核心玩法之一，通过触发各种事件让玩家体验三国世界的故事和冒险。

### 核心特性

- 🎲 **动态触发** - 根据玩家位置、等级、属性等条件触发
- 🎯 **因子判定** - 基于角色属性计算成功率
- 🎁 **丰富奖励** - 经验、金币、物品、属性、关系等
- 🔗 **连锁事件** - 支持事件链和剧情线
- ⚔️ **战斗集成** - 可触发战斗和攻城
- 📊 **数据驱动** - 使用CSV/Excel管理事件数据

---

## 🎯 事件类型

### 1. 历史事件 (Historical)
基于真实历史的事件，如桃园结义、三顾茅庐等。

**特点**：
- 稀有度较高
- 奖励丰厚
- 有特定触发条件
- 冷却时间较长

### 2. 虚构事件 (Fictional)
原创剧情事件，丰富游戏内容。

**特点**：
- 创意自由
- 可设计复杂剧情
- 支持连锁事件

### 3. 日常事件 (Daily)
常见的日常遭遇，如市集购物、路遇强盗等。

**特点**：
- 触发频率高
- 奖励适中
- 冷却时间短
- 增加游戏趣味性

---

## 🔧 事件结构

### 基础结构

```javascript
{
  // 基础信息
  id: 'event_tk_0001',              // 唯一ID
  type: 'historical',               // 类型：historical/fictional/daily
  category: 'three_kingdoms',       // 分类
  title: '桃园结义',                // 标题
  description: '事件描述文本...',   // 描述
  
  // 触发条件
  trigger: {
    locations: ['涿郡', '桃园'],    // 触发地点
    minLevel: 1,                    // 最低等级
    requiredFactors: {              // 因子要求
      charisma: 60,
    },
    probability: 0.15,              // 触发概率 (0-1)
    context: ['move', 'idle'],      // 触发场景
  },
  
  // 选项
  options: [
    {
      id: 'option_a',
      text: '欣然接受，共饮此杯',
      outcomes: [
        {
          condition: {
            type: 'factor_check',
            factors: {
              charisma: { min: 70, weight: 0.6 },
              intelligence: { min: 60, weight: 0.4 },
            },
          },
          onSuccess: {
            type: 'text_reward',
            text: '成功文本...',
            rewards: {
              exp: 1000,
              gold: 500,
              items: ['桃园令牌'],
              attributes: { charisma: 5 },
              relationship: { '刘备': 30, '关羽': 20 },
            },
          },
          onFailure: {
            type: 'text',
            text: '失败文本...',
            rewards: {},
          },
        },
      ],
    },
  ],
  
  // 元数据
  metadata: {
    difficulty: 'easy',             // 难度：easy/normal/hard/extreme
    rarity: 'rare',                 // 稀有度：common/rare/epic/legendary
    tags: ['结义', '刘备'],         // 标签
    author: '策划组',               // 作者
    version: '1.0',                 // 版本
  },
}
```

---

## 🎮 触发机制

### 触发场景 (Context)

| 场景 | 说明 | 示例 |
|------|------|------|
| move | 移动时 | 在地图上移动触发 |
| idle | 闲置时 | 停留在某地触发 |
| social | 社交时 | 与NPC互动触发 |
| battle_end | 战斗结束 | 战斗胜利后触发 |
| city_enter | 进入城市 | 进入城市时触发 |
| gacha | 抽卡时 | 抽卡时触发特殊事件 |

### 触发条件

**必须同时满足**：
1. 玩家在指定地点（或任意地点）
2. 玩家等级 ≥ 最低等级
3. 玩家因子 ≥ 因子要求
4. 随机概率判定通过
5. 事件冷却时间已过

### 冷却机制

根据稀有度设置冷却时间：

| 稀有度 | 冷却时间 |
|--------|----------|
| Common | 1小时 |
| Rare | 2小时 |
| Epic | 4小时 |
| Legendary | 24小时 |

---

## 🎲 判定系统

### 条件类型

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| always | 总是成功 | 安全选项 |
| never | 总是失败 | 陷阱选项 |
| factor_check | 因子检查 | 属性判定 |
| random | 纯随机 | 运气事件 |
| item_check | 物品检查 | 需要特定物品 |
| relationship | 关系检查 | 需要NPC好感度 |

### 因子判定

**计算公式**：
```javascript
成功率 = Σ (因子值 / 因子要求 × 权重)

// 示例
charisma: { min: 70, weight: 0.6 }
intelligence: { min: 60, weight: 0.4 }

// 如果玩家 charisma=80, intelligence=70
成功率 = (80/70 × 0.6) + (70/60 × 0.4)
      = 0.686 + 0.467
      = 1.153 → 100% (上限100%)
```

### 因子类型

| 因子 | 说明 | 适用场景 |
|------|------|----------|
| combat | 武力 | 战斗、武力威慑 |
| intelligence | 智力 | 谋略、解谜 |
| charisma | 魅力 | 说服、招募 |
| politics | 政治 | 外交、管理 |
| courage | 勇气 | 冒险、挑战 |
| loyalty | 忠诚 | 忠诚考验 |
| strategy | 谋略 | 战术、计谋 |
| command | 统率 | 领导、指挥 |
| diplomacy | 外交 | 谈判、结盟 |

---

## 🎁 奖励系统

### 奖励类型

```javascript
rewards: {
  exp: 1000,                        // 经验值
  gold: 500,                        // 金币
  items: ['物品1', '物品2'],        // 物品
  attributes: {                     // 属性加成
    combat: 5,
    intelligence: 3,
  },
  relationship: {                   // 关系值
    '刘备': 20,
    '关羽': 10,
  },
  title: '称号',                    // 称号
  troops: 100,                      // 兵力
}
```

### 奖励平衡

根据难度和稀有度设置奖励：

| 难度 | 经验值 | 金币 | 属性加成 | 因子要求 |
|------|--------|------|----------|----------|
| Easy | 500-1000 | 100-500 | 1-3 | 50-60 |
| Normal | 1000-3000 | 500-1500 | 3-5 | 60-75 |
| Hard | 3000-8000 | 1500-5000 | 5-10 | 75-85 |
| Extreme | 8000+ | 5000+ | 10+ | 85+ |

---

## 📊 数据管理

### CSV/Excel 工作流

```
Excel编辑 → 保存CSV → 运行转换 → 生成JS → 导入游戏
```

### CSV 模板列

**基础信息**（必填）：
- 事件ID
- 事件名称
- 事件类型
- 分类
- 事件描述

**触发条件**（可选）：
- 触发地点
- 最低等级
- 需求因子
- 触发概率
- 触发场景

**选项A/B/C**（至少一个）：
- 选项ID
- 选项文本
- 条件类型
- 因子要求
- 成功文本
- 失败文本

**奖励**（可选）：
- 成功奖励（经验/金币/物品/属性/关系/称号）
- 失败奖励（经验/金币/属性）

**元数据**（可选）：
- 难度
- 稀有度
- 标签
- 作者
- 版本
- 备注

### 转换工具

```bash
# 转换CSV为JS
node tools/csv-to-event.js

# 输入：tools/event-data.csv
# 输出：src/data/events/generated/
```

---

## 🎨 创作建议

### 文本长度

- **标题**：5-10个字
- **描述**：30-80个字
- **选项文本**：8-15个字
- **结果文本**：30-100个字

### 选项设计

- 每个事件建议 2-4 个选项
- 选项应有明显区别
- 至少一个选项是"安全"选择
- 高风险选项应有高回报

### 触发概率建议

| 稀有度 | 触发概率 |
|--------|----------|
| Common | 30%-50% |
| Rare | 15%-30% |
| Epic | 5%-15% |
| Legendary | 1%-5% |

---

## 🔗 高级功能（待实现）

### 连锁事件

```javascript
onSuccess: {
  type: 'chain_event',
  text: '触发了连锁事件！',
  nextEventId: 'event_tk_002',
}
```

### 触发战斗

```javascript
onSuccess: {
  type: 'battle',
  battleConfig: {
    enemy: 'enemy_id',
    difficulty: 'hard',
    rewards: { exp: 5000 },
  },
  afterBattleText: {
    victory: '胜利文本',
    defeat: '失败文本',
  },
}
```

### 触发攻城

```javascript
onSuccess: {
  type: 'siege',
  siegeConfig: {
    city: 'city_id',
    difficulty: 'extreme',
  },
}
```

---

## 📁 文件结构

```
src/
├── data/
│   ├── eventConfig.js           # 事件配置
│   └── events/
│       ├── index.js             # 事件总导出
│       ├── historical/          # 历史事件
│       │   ├── index.js
│       │   └── three-kingdoms.js
│       ├── fictional/           # 虚构事件
│       │   └── index.js
│       ├── daily/               # 日常事件
│       │   └── index.js
│       └── generated/           # CSV生成的事件
│           └── (自动生成)
├── systems/
│   └── eventSystem.js           # 事件系统核心
└── utils/
    ├── factorCalculator.js      # 因子计算
    └── probabilityEngine.js     # 概率引擎

tools/
├── event-template.csv           # CSV模板
├── csv-to-event.js              # 转换工具
└── event-data.csv               # 事件数据（用户创建）
```

---

## 🚀 开发计划

### 里程碑1：基础框架（已完成）
- ✅ 事件数据结构设计
- ✅ 因子计算工具
- ✅ 概率引擎
- ✅ 示例事件

### 里程碑2：CSV工具（待开发）
- [ ] CSV模板完善
- [ ] 转换工具开发
- [ ] 数据验证
- [ ] 批量导入

### 里程碑3：前端集成（待开发）
- [ ] 事件触发UI
- [ ] 选项交互
- [ ] 结果展示
- [ ] 奖励动画

### 里程碑4：高级功能（待开发）
- [ ] 连锁事件
- [ ] 战斗集成
- [ ] 攻城集成
- [ ] 事件统计

---

## 📚 相关文档

- [21-CHARACTER_SYSTEM.md](../20-data-layer/21-CHARACTER_SYSTEM.md) - 角色系统
- [18-COMBAT_SYSTEM.md](./18-COMBAT_SYSTEM.md) - 战斗系统
- [15-CITY_SYSTEM.md](./15-CITY_SYSTEM.md) - 据点系统
- [17-QUEST_SYSTEM.md](./17-QUEST_SYSTEM.md) - 任务系统
- [02-MILESTONES_S1.md](../../base/02-MILESTONES_S1.md) - 开发里程碑

---

## 💡 示例事件

### 简单日常事件

```javascript
{
  id: 'event_daily_0001',
  type: 'daily',
  category: 'daily',
  title: '市集购物',
  description: '你来到市集，看到各种商品。',
  
  trigger: {
    locations: ['任意城市'],
    minLevel: 1,
    probability: 0.3,
    context: ['move'],
  },
  
  options: [
    {
      id: 'option_a',
      text: '购买物品',
      outcomes: [
        {
          condition: { type: 'always' },
          onSuccess: {
            type: 'text_reward',
            text: '你购买了一些物品。',
            rewards: { gold: -100, items: ['食物'] },
          },
        },
      ],
    },
  ],
  
  metadata: {
    difficulty: 'easy',
    rarity: 'common',
  },
}
```

### 复杂历史事件

```javascript
{
  id: 'event_tk_0001',
  type: 'historical',
  category: 'three_kingdoms',
  title: '桃园结义',
  description: '你在桃园遇到了两位豪杰，刘备邀请你共饮一杯...',
  
  trigger: {
    locations: ['涿郡', '桃园'],
    minLevel: 1,
    requiredFactors: { charisma: 60 },
    probability: 0.15,
    context: ['move', 'idle'],
  },
  
  options: [
    {
      id: 'option_a',
      text: '欣然接受，共饮此杯',
      outcomes: [
        {
          condition: {
            type: 'factor_check',
            factors: {
              charisma: { min: 70, weight: 0.6 },
              intelligence: { min: 60, weight: 0.4 },
            },
          },
          onSuccess: {
            type: 'text_reward',
            text: '你们结为异姓兄弟！',
            rewards: {
              items: ['桃园令牌'],
              attributes: { charisma: 5 },
              relationship: { '刘备': 30, '关羽': 20, '张飞': 20 },
            },
          },
          onFailure: {
            type: 'text',
            text: '你言语不当，刘备等人匆匆告辞。',
            rewards: { relationship: { '刘备': -10 } },
          },
        },
      ],
    },
    {
      id: 'option_b',
      text: '婉言谢绝，继续赶路',
      outcomes: [
        {
          condition: { type: 'always' },
          onSuccess: {
            type: 'text',
            text: '你礼貌地谢绝了邀请。',
          },
        },
      ],
    },
  ],
  
  metadata: {
    difficulty: 'easy',
    rarity: 'rare',
    tags: ['结义', '刘备', '关羽', '张飞'],
    author: '策划组',
    version: '1.0',
  },
}
```

---

## 🎯 总结

事件系统是游戏的核心玩法，通过丰富的事件内容让玩家体验三国世界。

**核心优势**：
- ✅ 数据驱动，易于扩展
- ✅ 支持CSV/Excel管理
- ✅ 灵活的判定机制
- ✅ 丰富的奖励类型
- ✅ 支持高级功能（连锁、战斗等）

**下一步**：
1. 完善CSV转换工具
2. 创作更多事件内容
3. 实现前端UI
4. 集成到游戏主流程

---

**文档创建者**: Kiro AI  
**创建日期**: 2026-02-09  
**文档版本**: v1.0.0


---

## 💻 使用示例

### 基础使用流程

#### 1. 导入事件系统

```javascript
import { eventSystem } from './src/systems/eventSystem.js';
import { allEvents } from './src/data/events/index.js';
```

#### 2. 初始化玩家数据

```javascript
const player = {
  id: 'player_001',
  name: '张三',
  level: 15,
  factors: {
    combat: 75,        // 武力
    intelligence: 68,  // 智力
    charisma: 82,      // 魅力
    politics: 55,      // 政治
    courage: 70,       // 勇气
    loyalty: 90,       // 忠诚
  },
  inventory: ['桃园令牌', '青龙偃月刀'],
  relationships: {
    '刘备': 50,
    '关羽': 30,
  },
};
```

#### 3. 触发事件检查

```javascript
// 玩家移动到某个位置时
function onPlayerMove(location) {
  const event = eventSystem.checkEventTrigger(
    player,
    location,
    'move'  // 触发场景
  );

  if (event) {
    // 显示事件UI
    showEventDialog(event);
  }
}

// 示例：玩家移动到涿郡
onPlayerMove('涿郡');
```

#### 4. 处理玩家选择

```javascript
function onPlayerChoice(event, optionId) {
  const result = eventSystem.processChoice(event, optionId, player);

  // 显示结果
  showResultDialog(result);

  // 应用奖励
  if (result.rewards) {
    applyRewards(player, result.rewards);
  }

  // 处理后续动作
  if (result.nextAction) {
    handleNextAction(result.nextAction);
  }
}

// 示例：玩家选择"欣然接受"
onPlayerChoice(currentEvent, 'option_a');
```

#### 5. 应用奖励

```javascript
function applyRewards(player, rewards) {
  // 经验值
  if (rewards.exp) {
    player.exp += rewards.exp;
  }

  // 金币
  if (rewards.gold) {
    player.gold += rewards.gold;
  }

  // 物品
  if (rewards.items) {
    player.inventory.push(...rewards.items);
  }

  // 属性
  if (rewards.attributes) {
    for (const [attr, value] of Object.entries(rewards.attributes)) {
      player.factors[attr] = (player.factors[attr] || 0) + value;
    }
  }

  // 关系值
  if (rewards.relationship) {
    for (const [npc, value] of Object.entries(rewards.relationship)) {
      player.relationships[npc] = (player.relationships[npc] || 0) + value;
    }
  }

  // 称号
  if (rewards.title) {
    player.titles = player.titles || [];
    player.titles.push(rewards.title);
  }
}
```

#### 6. 处理后续动作

```javascript
function handleNextAction(nextAction) {
  switch (nextAction.type) {
    case 'battle':
      // 触发战斗系统
      startBattle(nextAction.config);
      break;

    case 'chain_event':
      // 触发连锁事件
      const nextEvent = getEventById(nextAction.eventId);
      showEventDialog(nextEvent);
      break;

    case 'siege':
      // 触发攻城系统
      startSiege(nextAction.config);
      break;
  }
}
```

---

### 添加新事件示例

```javascript
// src/data/events/historical/three-kingdoms.js

export const threeKingdomsEvents = [
  // ... 现有事件

  // 新事件：赤壁之战
  {
    id: 'event_tk_003',
    type: 'historical',
    category: 'three_kingdoms',
    title: '赤壁之战',
    
    trigger: {
      locations: ['赤壁'],
      minLevel: 20,
      requiredFactors: {
        intelligence: 80,
        strategy: 75,
      },
      probability: 0.3,
      context: ['move', 'battle_end'],
    },
    
    description: '曹操大军压境，孙刘联军商议对策。诸葛亮提出火攻之计，你是否支持？',
    
    options: [
      {
        id: 'option_a',
        text: '支持火攻，献计献策',
        outcomes: [
          {
            condition: {
              type: 'factor_check',
              factors: {
                intelligence: { min: 85, weight: 0.5 },
                strategy: { min: 80, weight: 0.5 },
              },
            },
            onSuccess: {
              type: 'text_reward',
              text: '你的建议得到采纳，火攻大获成功！曹操败走华容道。',
              rewards: {
                exp: 10000,
                gold: 5000,
                relationship: { '诸葛亮': 40, '周瑜': 30 },
                attributes: { intelligence: 10, strategy: 8 },
                title: '赤壁功臣',
              },
            },
            onFailure: {
              type: 'text',
              text: '你的建议被否决，只能作为旁观者见证这场大战。',
              rewards: {
                exp: 1000,
              },
            },
          },
        ],
      },
      {
        id: 'option_b',
        text: '保持中立，观察局势',
        outcomes: [
          {
            condition: { type: 'always' },
            onSuccess: {
              type: 'text',
              text: '你选择观望，见证了这场改变历史的战役。',
              rewards: {
                exp: 2000,
                attributes: { intelligence: 3 },
              },
            },
          },
        ],
      },
    ],
    
    metadata: {
      author: '策划组',
      version: '1.0',
      tags: ['赤壁', '诸葛亮', '周瑜', '曹操'],
      difficulty: 'hard',
      rarity: 'legendary',
    },
  },
];
```

---

### 高级用法

#### 1. 查询事件统计

```javascript
import { getEventStatistics } from './src/data/events/index.js';

const stats = getEventStatistics();
console.log('总事件数:', stats.total);
console.log('历史事件:', stats.historical);
console.log('按难度分布:', stats.byDifficulty);
```

#### 2. 检查事件冷却

```javascript
const cooldownInfo = eventSystem.getCooldownInfo('event_tk_001');

if (cooldownInfo && cooldownInfo.isOnCooldown) {
  console.log(`事件冷却中，剩余 ${cooldownInfo.remainingSeconds} 秒`);
}
```

#### 3. 查看事件历史

```javascript
const history = eventSystem.getEventHistory(10);
console.log('最近10个事件:', history);
```

#### 4. 自定义因子计算

```javascript
import { calculateFactorSuccess } from './src/utils/factorCalculator.js';

const successRate = calculateFactorSuccess(
  player.factors,
  {
    combat: { min: 80, weight: 0.7 },
    courage: { min: 70, weight: 0.3 },
  }
);

console.log('成功率:', (successRate * 100).toFixed(2) + '%');
```

---

### 与其他系统集成

#### 战斗系统集成

```javascript
// 当事件触发战斗时
function startBattle(battleConfig) {
  const battleSystem = new BattleSystem();
  
  battleSystem.initBattle({
    player: player,
    enemy: battleConfig.enemy,
    difficulty: battleConfig.difficulty,
    onVictory: () => {
      applyRewards(player, battleConfig.rewards);
      showMessage(battleConfig.afterBattleText.victory);
    },
    onDefeat: () => {
      showMessage(battleConfig.afterBattleText.defeat);
    },
  });
}
```

#### 攻城系统集成

```javascript
// 当事件触发攻城时
function startSiege(siegeConfig) {
  const siegeSystem = new SiegeSystem();
  
  siegeSystem.initSiege({
    player: player,
    target: siegeConfig.target,
    difficulty: siegeConfig.difficulty,
  });
}
```

---

### 性能优化

#### 1. 事件预加载

```javascript
// 只加载当前区域相关的事件
const currentAreaEvents = getEventsByLocation(player.currentLocation);
```

#### 2. 事件缓存

```javascript
// 缓存常用事件查询结果
const eventCache = new Map();

function getCachedEvent(id) {
  if (!eventCache.has(id)) {
    eventCache.set(id, getEventById(id));
  }
  return eventCache.get(id);
}
```

#### 3. 批量处理

```javascript
// 批量检查多个位置的事件
function batchCheckEvents(locations) {
  return locations.map(loc => 
    eventSystem.checkEventTrigger(player, loc, 'move')
  ).filter(Boolean);
}
```

---

### 数据持久化

#### 保存事件历史

```javascript
// 保存到本地存储
function saveEventHistory() {
  const history = eventSystem.getEventHistory();
  localStorage.setItem('event_history', JSON.stringify(history));
}

// 加载事件历史
function loadEventHistory() {
  const saved = localStorage.getItem('event_history');
  if (saved) {
    eventSystem.eventHistory = JSON.parse(saved);
  }
}
```

#### 保存冷却信息

```javascript
// 保存冷却数据
function saveCooldowns() {
  const cooldowns = Array.from(eventSystem.cooldowns.entries());
  localStorage.setItem('event_cooldowns', JSON.stringify(cooldowns));
}

// 加载冷却数据
function loadCooldowns() {
  const saved = localStorage.getItem('event_cooldowns');
  if (saved) {
    eventSystem.cooldowns = new Map(JSON.parse(saved));
  }
}
```
