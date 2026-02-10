# 任务系统 (Quest System)

## 文档信息
- **文档编号**: 17-QUEST_SYSTEM
- **系统类型**: 核心系统
- **创建日期**: 2026-02-09
- **最后更新**: 2026-02-09
- **状态**: 📝 设计中

## 一、系统概述

### 1.1 系统定位
任务系统是游戏的核心引导和奖励机制，通过各种任务引导玩家体验游戏内容，推动游戏进程，并提供成长奖励。

### 1.2 设计目标
- 🎯 **引导玩家** - 通过任务引导玩家了解游戏机制
- 🎁 **提供奖励** - 完成任务获得资源、武将、装备等奖励
- 📖 **讲述故事** - 通过任务串联历史事件和剧情
- 🔄 **增加粘性** - 日常任务和周期任务提高玩家活跃度
- 🏆 **成就感** - 完成任务带来成就感和进度反馈

### 1.3 系统特点
- ✅ **多样化** - 主线、支线、日常、周常、成就等多种类型
- ✅ **层次化** - 新手引导 → 主线推进 → 日常循环 → 长期目标
- ✅ **历史化** - 结合三国历史事件设计任务
- ✅ **动态化** - 根据玩家进度和选择动态生成任务

## 二、任务分类

### 2.1 主线任务

**定义**: 推动游戏主要剧情的核心任务链

**特点**:
- 📖 按赛季顺序展开
- 🔒 有前置条件和解锁顺序
- 🎁 奖励丰厚
- ⭐ 不可重复

**示例**:
```javascript
{
  id: "quest_main_s1_01",
  type: "main",
  season: "S1",
  name: "黄巾起义",
  description: "公元184年，黄巾军起义爆发，天下大乱...",
  objectives: [
    {
      type: "defeat_enemy",
      target: "黄巾军",
      count: 1,
      current: 0
    }
  ],
  prerequisites: [], // 无前置任务
  rewards: {
    gold: 1000,
    prestige: 100,
    items: ["item_recruit_token"],
    characters: ["char_s1_001"] // 刘备
  },
  nextQuest: "quest_main_s1_02"
}
```

**S1赛季主线任务链**:
```
S1-01: 黄巾起义 → 招募刘备
S1-02: 桃园结义 → 招募关羽、张飞
S1-03: 讨伐黄巾 → 首次战斗教学
S1-04: 平定广宗 → 攻城战教学
S1-05: 朝廷封赏 → 官职系统解锁
...
```

### 2.2 支线任务

**定义**: 丰富游戏内容的可选任务

**特点**:
- 🌟 可选完成
- 🎭 展现角色故事
- 🎁 奖励适中
- 🔄 部分可重复

**类型**:
1. **武将传记任务** - 解锁武将背景故事
2. **势力任务** - 提升势力关系
3. **探索任务** - 探索地图和据点
4. **收集任务** - 收集特定物品

**示例**:
```javascript
{
  id: "quest_side_guan_yu_01",
  type: "side",
  category: "character_story",
  name: "关羽传：温酒斩华雄",
  description: "关羽请战，斩杀华雄...",
  unlockCondition: {
    hasCharacter: "char_guan_yu",
    characterLevel: 5
  },
  objectives: [
    {
      type: "defeat_boss",
      target: "华雄",
      count: 1
    }
  ],
  rewards: {
    gold: 500,
    items: ["item_青龙偃月刀"],
    characterExp: {
      "char_guan_yu": 1000
    }
  },
  repeatable: false
}
```

### 2.3 日常任务

**定义**: 每日刷新的常规任务

**特点**:
- 🔄 每日重置
- ⚡ 快速完成
- 🎁 稳定收益
- 📊 活跃度奖励

**类型**:
```javascript
const dailyQuests = [
  {
    id: "quest_daily_battle",
    name: "每日征战",
    description: "完成3场战斗",
    objectives: [
      { type: "complete_battle", count: 3 }
    ],
    rewards: {
      gold: 200,
      exp: 100,
      dailyPoints: 10
    }
  },
  {
    id: "quest_daily_recruit",
    name: "招贤纳士",
    description: "招募1名武将",
    objectives: [
      { type: "recruit_character", count: 1 }
    ],
    rewards: {
      gold: 150,
      dailyPoints: 10
    }
  },
  {
    id: "quest_daily_upgrade",
    name: "强化部队",
    description: "升级任意部队1次",
    objectives: [
      { type: "upgrade_troop", count: 1 }
    ],
    rewards: {
      gold: 100,
      dailyPoints: 10
    }
  }
];
```

**活跃度系统**:
```javascript
const dailyActivityRewards = [
  { points: 20, rewards: { gold: 500 } },
  { points: 40, rewards: { gold: 1000, items: ["item_exp_book"] } },
  { points: 60, rewards: { gold: 2000, items: ["item_recruit_token"] } },
  { points: 80, rewards: { gold: 3000, items: ["item_equipment_box"] } },
  { points: 100, rewards: { gold: 5000, items: ["item_legendary_box"] } }
];
```

### 2.4 周常任务

**定义**: 每周刷新的挑战任务

**特点**:
- 📅 每周重置
- 💪 难度较高
- 🎁 奖励丰厚
- 🏆 排行榜竞争

**示例**:
```javascript
{
  id: "quest_weekly_conquest",
  name: "周常征服",
  description: "本周攻占5座城市",
  objectives: [
    { type: "capture_city", count: 5 }
  ],
  rewards: {
    gold: 5000,
    prestige: 500,
    items: ["item_epic_equipment_box"]
  },
  resetTime: "weekly_monday_00:00"
}
```

### 2.5 成就任务

**定义**: 长期累积的里程碑目标

**特点**:
- ♾️ 永久有效
- 📈 累积进度
- 🏅 称号奖励
- 💎 稀有奖励

**类型**:
1. **战斗成就** - 胜利次数、连胜记录
2. **收集成就** - 武将收集、装备收集
3. **成长成就** - 等级、官职、势力
4. **探索成就** - 地图探索、据点占领
5. **社交成就** - 好友、联盟、交易

**示例**:
```javascript
{
  id: "achievement_collector_legendary",
  name: "传奇收藏家",
  description: "收集10名传奇武将",
  category: "collection",
  objectives: [
    {
      type: "collect_characters",
      rarity: "legendary",
      count: 10,
      current: 0
    }
  ],
  rewards: {
    title: "传奇收藏家",
    avatar_frame: "frame_legendary",
    items: ["item_legendary_recruit_token"]
  },
  hidden: false,
  points: 100
}
```

### 2.6 限时活动任务

**定义**: 特殊活动期间的限定任务

**特点**:
- ⏰ 限时开放
- 🎉 节日主题
- 🎁 特殊奖励
- 🔥 高参与度

**示例**:
```javascript
{
  id: "quest_event_spring_festival",
  name: "春节庆典",
  description: "春节期间完成特殊挑战",
  startTime: "2026-01-29 00:00:00",
  endTime: "2026-02-12 23:59:59",
  objectives: [
    { type: "complete_battle", count: 10 },
    { type: "recruit_character", count: 3 },
    { type: "upgrade_troop", count: 5 }
  ],
  rewards: {
    gold: 10000,
    items: ["item_spring_festival_box"],
    characters: ["char_event_special"]
  }
}
```

## 三、任务目标类型

### 3.1 战斗类目标

```javascript
const combatObjectives = {
  // 完成战斗
  complete_battle: {
    type: "complete_battle",
    count: 5,
    conditions: {
      difficulty: "normal", // 可选：难度限制
      mapType: "field" // 可选：地图类型
    }
  },
  
  // 击败敌人
  defeat_enemy: {
    type: "defeat_enemy",
    target: "黄巾军",
    count: 10
  },
  
  // 击败BOSS
  defeat_boss: {
    type: "defeat_boss",
    target: "华雄",
    count: 1
  },
  
  // 战斗胜利
  win_battle: {
    type: "win_battle",
    count: 3,
    conditions: {
      noLoss: true // 无损胜利
    }
  }
};
```

### 3.2 收集类目标

```javascript
const collectionObjectives = {
  // 招募武将
  recruit_character: {
    type: "recruit_character",
    count: 1,
    conditions: {
      rarity: "legendary" // 可选：稀有度限制
    }
  },
  
  // 收集物品
  collect_item: {
    type: "collect_item",
    itemId: "item_青龙偃月刀",
    count: 1
  },
  
  // 收集资源
  collect_resource: {
    type: "collect_resource",
    resource: "gold",
    count: 10000
  }
};
```

### 3.3 成长类目标

```javascript
const growthObjectives = {
  // 角色升级
  level_up_character: {
    type: "level_up_character",
    characterId: "char_guan_yu",
    targetLevel: 10
  },
  
  // 部队升级
  upgrade_troop: {
    type: "upgrade_troop",
    count: 3
  },
  
  // 官职晋升
  promote_position: {
    type: "promote_position",
    targetLevel: 5
  }
};
```

### 3.4 据点类目标

```javascript
const cityObjectives = {
  // 占领城市
  capture_city: {
    type: "capture_city",
    cityId: "city_luoyang", // 可选：特定城市
    count: 1
  },
  
  // 建设据点
  build_facility: {
    type: "build_facility",
    facilityType: "barracks",
    count: 1
  },
  
  // 资源生产
  produce_resource: {
    type: "produce_resource",
    resource: "food",
    count: 5000
  }
};
```

### 3.5 社交类目标

```javascript
const socialObjectives = {
  // 添加好友
  add_friend: {
    type: "add_friend",
    count: 5
  },
  
  // 加入联盟
  join_alliance: {
    type: "join_alliance",
    count: 1
  },
  
  // 协助盟友
  help_ally: {
    type: "help_ally",
    count: 10
  }
};
```

## 四、任务奖励系统

### 4.1 奖励类型

```javascript
const rewardTypes = {
  // 基础资源
  resources: {
    gold: 1000,        // 金币
    food: 500,         // 粮食
    wood: 300,         // 木材
    iron: 200,         // 铁矿
    prestige: 100      // 声望
  },
  
  // 经验
  experience: {
    playerExp: 500,    // 玩家经验
    characterExp: {    // 武将经验
      "char_id": 1000
    }
  },
  
  // 物品
  items: [
    "item_recruit_token",
    "item_equipment_box",
    "item_exp_book"
  ],
  
  // 武将
  characters: [
    "char_s1_001"
  ],
  
  // 称号
  title: "黄巾平定者",
  
  // 头像框
  avatar_frame: "frame_legendary",
  
  // 解锁内容
  unlocks: [
    "feature_alliance",
    "map_area_02"
  ]
};
```

### 4.2 奖励发放

```javascript
class QuestRewardSystem {
  /**
   * 发放任务奖励
   */
  grantRewards(player, quest) {
    const rewards = quest.rewards;
    const log = [];
    
    // 发放资源
    if (rewards.resources) {
      Object.entries(rewards.resources).forEach(([type, amount]) => {
        player.addResource(type, amount);
        log.push(`获得${type} +${amount}`);
      });
    }
    
    // 发放经验
    if (rewards.experience) {
      if (rewards.experience.playerExp) {
        player.addExp(rewards.experience.playerExp);
        log.push(`获得经验 +${rewards.experience.playerExp}`);
      }
      
      if (rewards.experience.characterExp) {
        Object.entries(rewards.experience.characterExp).forEach(([charId, exp]) => {
          player.getCharacter(charId).addExp(exp);
          log.push(`${charId}获得经验 +${exp}`);
        });
      }
    }
    
    // 发放物品
    if (rewards.items) {
      rewards.items.forEach(itemId => {
        player.addItem(itemId, 1);
        log.push(`获得物品: ${itemId}`);
      });
    }
    
    // 发放武将
    if (rewards.characters) {
      rewards.characters.forEach(charId => {
        player.recruitCharacter(charId);
        log.push(`招募武将: ${charId}`);
      });
    }
    
    // 发放称号
    if (rewards.title) {
      player.unlockTitle(rewards.title);
      log.push(`获得称号: ${rewards.title}`);
    }
    
    // 解锁内容
    if (rewards.unlocks) {
      rewards.unlocks.forEach(feature => {
        player.unlock(feature);
        log.push(`解锁: ${feature}`);
      });
    }
    
    return log;
  }
}
```

## 五、任务进度追踪

### 5.1 进度数据结构

```javascript
const questProgress = {
  questId: "quest_main_s1_01",
  status: "in_progress", // not_started, in_progress, completed, claimed
  startTime: "2026-02-09 10:00:00",
  objectives: [
    {
      index: 0,
      current: 1,
      target: 1,
      completed: true
    }
  ],
  completedTime: null,
  claimedTime: null
};
```

### 5.2 进度更新

```javascript
class QuestProgressTracker {
  /**
   * 更新任务进度
   */
  updateProgress(player, eventType, eventData) {
    const activeQuests = player.getActiveQuests();
    
    activeQuests.forEach(quest => {
      quest.objectives.forEach((objective, index) => {
        if (this.matchesObjective(objective, eventType, eventData)) {
          const progress = player.getQuestProgress(quest.id);
          progress.objectives[index].current++;
          
          // 检查是否完成
          if (progress.objectives[index].current >= objective.count) {
            progress.objectives[index].completed = true;
          }
          
          // 检查任务是否全部完成
          if (this.isQuestCompleted(progress)) {
            this.completeQuest(player, quest);
          }
        }
      });
    });
  }
  
  /**
   * 检查事件是否匹配目标
   */
  matchesObjective(objective, eventType, eventData) {
    if (objective.type !== eventType) return false;
    
    // 检查额外条件
    if (objective.target && eventData.target !== objective.target) {
      return false;
    }
    
    if (objective.conditions) {
      for (const [key, value] of Object.entries(objective.conditions)) {
        if (eventData[key] !== value) return false;
      }
    }
    
    return true;
  }
  
  /**
   * 完成任务
   */
  completeQuest(player, quest) {
    const progress = player.getQuestProgress(quest.id);
    progress.status = "completed";
    progress.completedTime = new Date().toISOString();
    
    // 通知玩家
    player.notify({
      type: "quest_completed",
      questId: quest.id,
      questName: quest.name
    });
    
    // 自动解锁下一个任务
    if (quest.nextQuest) {
      player.unlockQuest(quest.nextQuest);
    }
  }
}
```

## 六、任务UI设计

### 6.1 任务列表界面

```
┌─────────────────────────────────────┐
│  任务                          [X]  │
├─────────────────────────────────────┤
│  [主线] [支线] [日常] [成就]       │
├─────────────────────────────────────┤
│                                     │
│  ⭐ 黄巾起义                        │
│  └─ 击败黄巾军 1/1 ✓               │
│  └─ 奖励: 金币+1000, 刘备          │
│  └─ [领取奖励]                     │
│                                     │
│  📖 桃园结义                        │
│  └─ 招募关羽 0/1                   │
│  └─ 招募张飞 0/1                   │
│  └─ 奖励: 金币+500                 │
│                                     │
│  🔄 每日征战                        │
│  └─ 完成战斗 2/3                   │
│  └─ 奖励: 金币+200, 活跃度+10      │
│                                     │
└─────────────────────────────────────┘
```

### 6.2 任务追踪器

```
┌──────────────────────┐
│  当前任务            │
├──────────────────────┤
│  ⭐ 黄巾起义         │
│  └─ 击败黄巾军 1/1 ✓│
│                      │
│  📖 桃园结义         │
│  └─ 招募关羽 0/1    │
│  └─ 招募张飞 0/1    │
└──────────────────────┘
```

### 6.3 任务完成提示

```
┌─────────────────────────────┐
│  🎉 任务完成！              │
├─────────────────────────────┤
│  黄巾起义                   │
│                             │
│  获得奖励:                  │
│  • 金币 +1000               │
│  • 声望 +100                │
│  • 武将: 刘备               │
│                             │
│  [确定]                     │
└─────────────────────────────┘
```

## 七、任务系统实现

### 7.1 数据结构

```javascript
// 任务定义
interface Quest {
  id: string;
  type: 'main' | 'side' | 'daily' | 'weekly' | 'achievement' | 'event';
  season?: string;
  name: string;
  description: string;
  objectives: Objective[];
  prerequisites?: string[];
  rewards: Rewards;
  nextQuest?: string;
  repeatable?: boolean;
  resetTime?: string;
  startTime?: string;
  endTime?: string;
}

// 任务目标
interface Objective {
  type: string;
  target?: string;
  count: number;
  conditions?: Record<string, any>;
}

// 任务进度
interface QuestProgress {
  questId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'claimed';
  startTime?: string;
  objectives: ObjectiveProgress[];
  completedTime?: string;
  claimedTime?: string;
}
```

### 7.2 核心类

```javascript
class QuestSystem {
  constructor() {
    this.quests = new Map();
    this.tracker = new QuestProgressTracker();
    this.rewardSystem = new QuestRewardSystem();
  }
  
  /**
   * 加载任务数据
   */
  async loadQuests() {
    const data = await fetch('/data/quests.json');
    const quests = await data.json();
    
    quests.forEach(quest => {
      this.quests.set(quest.id, quest);
    });
  }
  
  /**
   * 接受任务
   */
  acceptQuest(player, questId) {
    const quest = this.quests.get(questId);
    
    // 检查前置条件
    if (!this.checkPrerequisites(player, quest)) {
      return { success: false, reason: '不满足前置条件' };
    }
    
    // 创建进度记录
    player.addQuestProgress({
      questId: quest.id,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      objectives: quest.objectives.map(() => ({
        current: 0,
        completed: false
      }))
    });
    
    return { success: true };
  }
  
  /**
   * 领取奖励
   */
  claimRewards(player, questId) {
    const progress = player.getQuestProgress(questId);
    
    if (progress.status !== 'completed') {
      return { success: false, reason: '任务未完成' };
    }
    
    const quest = this.quests.get(questId);
    const log = this.rewardSystem.grantRewards(player, quest);
    
    progress.status = 'claimed';
    progress.claimedTime = new Date().toISOString();
    
    return { success: true, log };
  }
}
```

## 八、与其他系统的关联

### 8.1 与战斗系统

```javascript
// 战斗结束后更新任务进度
function onBattleEnd(player, battleResult) {
  questSystem.tracker.updateProgress(player, 'complete_battle', {
    result: battleResult.victory ? 'win' : 'lose',
    difficulty: battleResult.difficulty,
    mapType: battleResult.mapType
  });
  
  if (battleResult.victory) {
    questSystem.tracker.updateProgress(player, 'win_battle', {
      noLoss: battleResult.casualties === 0
    });
  }
}
```

### 8.2 与据点系统

```javascript
// 占领城市后更新任务进度
function onCityCapture(player, city) {
  questSystem.tracker.updateProgress(player, 'capture_city', {
    cityId: city.id,
    cityType: city.type
  });
}
```

### 8.3 与角色系统

```javascript
// 招募武将后更新任务进度
function onCharacterRecruit(player, character) {
  questSystem.tracker.updateProgress(player, 'recruit_character', {
    characterId: character.id,
    rarity: character.rarity
  });
}
```

## 九、里程碑规划

### 里程碑1 (当前)
- ❌ 任务系统未实现
- 📝 完成系统设计文档

### 里程碑2
- ✅ 实现基础任务系统
- ✅ 主线任务（S1赛季）
- ✅ 日常任务
- ✅ 任务UI界面

### 里程碑3
- ✅ 支线任务
- ✅ 周常任务
- ✅ 成就系统
- ✅ 限时活动任务

## 十、相关文档

- [14-PLAYER_SYSTEM.md](./14-PLAYER_SYSTEM.md) - 玩家系统
- [15-CITY_SYSTEM.md](./15-CITY_SYSTEM.md) - 据点系统
- [16-EVENT_SYSTEM.md](./16-EVENT_SYSTEM.md) - 事件系统
- [18-COMBAT_SYSTEM.md](./18-COMBAT_SYSTEM.md) - 战斗系统
- [21-CHARACTER_SYSTEM.md](../20-data-layer/21-CHARACTER_SYSTEM.md) - 角色系统

---

**文档状态**: 📝 设计中  
**下一步**: 实现基础任务系统和主线任务链
