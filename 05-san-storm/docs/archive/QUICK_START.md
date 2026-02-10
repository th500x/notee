# 快速开始指南

## 项目概览

**真三风云 (San Storm)** 是一款基于三国题材的策略战棋游戏。

当前已完成：
- ✅ 事件系统基础架构
- ✅ 因子计算工具
- ✅ 概率引擎
- ✅ 示例事件数据

## 文件结构

```
05-san-storm/
├── README.md                    # 项目说明
├── ARCHITECTURE.md              # 架构设计文档
├── USAGE_EXAMPLE.md             # 使用示例
├── QUICK_START.md              # 本文件
└── src/
    ├── data/
    │   ├── eventConfig.js       # 事件配置
    │   └── events/
    │       ├── index.js         # 事件总导出
    │       ├── historical/      # 历史事件
    │       │   ├── index.js
    │       │   └── three-kingdoms.js  # 三国事件（2个示例）
    │       ├── fictional/       # 虚构事件（待添加）
    │       └── daily/           # 日常事件（待添加）
    ├── systems/
    │   └── eventSystem.js       # 事件系统核心
    └── utils/
        ├── factorCalculator.js  # 因子计算
        └── probabilityEngine.js # 概率引擎
```

## 如何添加新事件

### 步骤1：选择事件类型

根据事件性质选择对应的文件：
- **历史真实类** → `src/data/events/historical/three-kingdoms.js`
- **虚构类** → `src/data/events/fictional/` (新建文件)
- **日常类** → `src/data/events/daily/` (新建文件)

### 步骤2：编写事件数据

在对应文件中添加事件对象：

```javascript
{
  id: 'event_tk_003',              // 唯一ID
  type: 'historical',              // 类型
  category: 'three_kingdoms',      // 分类
  title: '事件标题',               // 标题
  
  trigger: {                       // 触发条件
    locations: ['地点'],           // 触发地点
    minLevel: 1,                   // 最低等级
    requiredFactors: {             // 因子要求
      combat: 60,
    },
    probability: 0.2,              // 触发概率
    context: ['move'],             // 触发场景
  },
  
  description: '事件描述文本',     // 描述
  
  options: [                       // 选项
    {
      id: 'option_a',
      text: '选项文本',
      outcomes: [                  // 结果
        {
          condition: {             // 条件
            type: 'factor_check',
            factors: {
              combat: { min: 70, weight: 1 },
            },
          },
          onSuccess: {             // 成功结果
            type: 'text_reward',
            text: '成功文本',
            rewards: {
              exp: 1000,
              gold: 500,
            },
          },
          onFailure: {             // 失败结果
            type: 'text',
            text: '失败文本',
            rewards: {},
          },
        },
      ],
    },
  ],
  
  metadata: {                      // 元数据
    author: '策划组',
    version: '1.0',
    tags: ['标签1', '标签2'],
    difficulty: 'normal',
    rarity: 'common',
  },
}
```

### 步骤3：保存文件

事件会自动被系统加载，无需额外配置。

## 事件配置说明

### 触发条件 (trigger)

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| locations | Array | 触发地点 | `['涿郡', '桃园']` |
| minLevel | Number | 最低等级 | `10` |
| requiredFactors | Object | 因子要求 | `{ combat: 70 }` |
| probability | Number | 触发概率 (0-1) | `0.15` |
| context | Array | 触发场景 | `['move', 'idle']` |

### 触发场景 (context)

- `move` - 移动时
- `social` - 社交时
- `gacha` - 抽卡时
- `battle_end` - 战斗结束
- `city_enter` - 进入城市
- `idle` - 闲置时

### 条件类型 (condition.type)

- `always` - 总是成功
- `never` - 总是失败
- `factor_check` - 因子检查（根据角色属性计算成功率）
- `random` - 纯随机
- `item_check` - 物品检查
- `relationship` - 关系检查

### 结果类型 (outcome.type)

- `text` - 纯文本
- `text_reward` - 文本+奖励
- `battle` - 触发战斗
- `chain_event` - 触发连锁事件
- `siege` - 触发攻城

### 奖励类型 (rewards)

```javascript
rewards: {
  exp: 1000,                        // 经验值
  gold: 500,                        // 金币
  items: ['物品1', '物品2'],        // 物品
  attributes: {                     // 属性
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

### 因子类型

- `combat` - 武力
- `intelligence` - 智力
- `charisma` - 魅力
- `politics` - 政治
- `courage` - 勇气
- `loyalty` - 忠诚
- `strategy` - 谋略
- `command` - 统率
- `diplomacy` - 外交

### 难度等级 (difficulty)

- `easy` - 简单
- `normal` - 普通
- `hard` - 困难
- `extreme` - 极难

### 稀有度 (rarity)

- `common` - 普通（冷却1小时）
- `rare` - 稀有（冷却2小时）
- `epic` - 史诗（冷却4小时）
- `legendary` - 传说（冷却24小时）

## 事件创作建议

### 1. 文本长度

- **标题**：5-10个字
- **描述**：30-80个字
- **选项文本**：8-15个字
- **结果文本**：30-100个字

### 2. 选项设计

- 每个事件建议 2-4 个选项
- 选项应有明显区别
- 至少一个选项是"安全"选择

### 3. 奖励平衡

根据难度和稀有度设置奖励：

| 难度 | 经验值 | 金币 | 属性加成 |
|------|--------|------|----------|
| Easy | 500-1000 | 100-500 | 1-3 |
| Normal | 1000-3000 | 500-1500 | 3-5 |
| Hard | 3000-8000 | 1500-5000 | 5-10 |
| Extreme | 8000+ | 5000+ | 10+ |

### 4. 因子要求

- Easy: 50-60
- Normal: 60-75
- Hard: 75-85
- Extreme: 85+

### 5. 触发概率

- Common: 0.3-0.5 (30%-50%)
- Rare: 0.15-0.3 (15%-30%)
- Epic: 0.05-0.15 (5%-15%)
- Legendary: 0.01-0.05 (1%-5%)

## 测试事件

### 方法1：直接测试

```javascript
import { eventSystem } from './src/systems/eventSystem.js';
import { getEventById } from './src/data/events/index.js';

// 模拟玩家数据
const testPlayer = {
  level: 15,
  factors: {
    combat: 75,
    intelligence: 68,
    charisma: 82,
  },
  inventory: [],
};

// 获取事件
const event = getEventById('event_tk_001');

// 测试选择
const result = eventSystem.processChoice(event, 'option_a', testPlayer);
console.log('结果:', result);
```

### 方法2：触发测试

```javascript
// 测试触发
const triggeredEvent = eventSystem.checkEventTrigger(
  testPlayer,
  '涿郡',
  'move'
);

if (triggeredEvent) {
  console.log('触发事件:', triggeredEvent.title);
}
```

## 常见问题

### Q: 如何调整事件触发概率？

A: 修改事件的 `trigger.probability` 值（0-1之间）

### Q: 如何让事件必定触发？

A: 设置 `trigger.probability = 1`，并确保满足其他触发条件

### Q: 如何创建连锁事件？

A: 在结果中使用 `type: 'chain_event'` 并指定下一个事件ID

```javascript
onSuccess: {
  type: 'chain_event',
  text: '触发了连锁事件！',
  nextEventId: 'event_tk_004',
}
```

### Q: 如何触发战斗？

A: 在结果中使用 `type: 'battle'` 并配置战斗参数

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

### Q: 如何查看所有事件？

A: 使用统计函数

```javascript
import { getEventStatistics } from './src/data/events/index.js';

const stats = getEventStatistics();
console.log('总事件数:', stats.total);
console.log('按难度:', stats.byDifficulty);
console.log('按稀有度:', stats.byRarity);
```

## 下一步

1. 阅读 [ARCHITECTURE.md](./ARCHITECTURE.md) 了解整体架构
2. 阅读 [USAGE_EXAMPLE.md](./USAGE_EXAMPLE.md) 查看详细示例
3. 开始创作你的事件！

## 需要帮助？

- 查看示例事件：`src/data/events/historical/three-kingdoms.js`
- 查看配置说明：`src/data/eventConfig.js`
- 查看工具函数：`src/utils/`

祝创作愉快！🎮
