# 玩家数据结构设计文档

**创建日期**: 2026-02-10  
**文档版本**: v1.0.0  
**状态**: 设计中

---

## 📋 文档概述

本文档定义完整的玩家数据结构，包括所有必需字段和可选字段，为前后端开发提供统一的数据规范。

**设计原则**：
- 🎯 **完整性** - 包含所有必需的游戏数据
- 🔄 **可扩展** - 预留未来功能的扩展空间
- 📊 **结构化** - 清晰的层级关系
- 🔒 **安全性** - 敏感数据分离存储
- ⚡ **性能** - 考虑查询和更新效率

---

## 🗂️ 数据结构总览

```javascript
Player {
  // 1. 账号信息
  account: AccountInfo
  
  // 2. 角色基础信息（包含声望和资源）
  character: CharacterInfo
  
  // 3. 属性系统
  attributes: Attributes
  
  // 4. 官职系统（基于声望晋升）
  position: PositionInfo
  
  // 5. 卡包系统（统一管理所有卡牌）
  cardCollection: CardCollection
  
  // 6. 装备槽位系统
  equipmentSlots: EquipmentSlots
  
  // 7. 战斗数据
  combat: CombatInfo
  
  // 8. 进度数据（包含称号系统）
  progress: ProgressInfo
  
  // 9. 统计数据
  statistics: StatisticsInfo
  
  // 10. 时间戳
  timestamps: Timestamps
}
```

---

## 1️⃣ 账号信息 (AccountInfo)

```javascript
account: {
  // 基础信息
  accountId: string,           // 账号唯一ID（UUID）
  username: string,            // 用户名（唯一，2-16字符）
  email: string,               // 邮箱（可选，用于找回密码）
  passwordHash: string,        // 密码哈希（bcrypt）
  
  // 状态管理
  status: string,              // 账号状态：active/inactive/banned/premium
  statusReason: string,        // 状态原因（如果被封禁）
  
  // 服务器信息
  serverId: string,            // 所在服务器ID
  serverName: string,          // 服务器名称
  
  // 付费信息
  isPremium: boolean,          // 是否付费用户
  premiumExpireAt: Date,       // 付费到期时间
  
  // 安全信息
  lastLoginIp: string,         // 最后登录IP
  loginAttempts: number,       // 登录尝试次数
  lockedUntil: Date,           // 锁定到期时间
}
```

**字段说明**：
- `accountId` - 全局唯一，用于跨服务器识别
- `status` - 控制账号是否可用
- `isPremium` - 付费用户不受非激活限制

---

## 2️⃣ 角色基础信息 (CharacterInfo)

```javascript
character: {
  // 基础信息
  playerId: string,            // 玩家角色ID（UUID）
  characterName: string,       // 角色名（唯一，2-4个中文字符）
  
  // 势力信息
  factionId: string,           // 势力ID（faction_han/faction_liu等）
  factionName: string,         // 势力名称
  
  // 外观信息（预留）
  avatar: string,              // 头像URL
  portrait: string,            // 立绘URL
  
  // 声望系统（替代等级系统）
  reputation: number,          // 当前声望值
  reputationToNext: number,    // 晋升所需声望
  
  // 资源系统（仅2类）
  resources: {
    food: number,              // 粮草
    silver: number,            // 银两
  },
}
```

**字段说明**：
- `playerId` - 角色唯一ID，与accountId关联
- `characterName` - 服务器内唯一
- `factionId` - 关联势力数据
- `reputation` - 通过任务和杀敌提升，达到阈值可晋升官职
- `resources` - 游戏内仅有2类资源：粮草和银两

---

## 3️⃣ 属性系统 (Attributes)

```javascript
attributes: {
  // 核心属性（3.0-10.0）
  combat: number,              // 武力（影响物理伤害）
  intelligence: number,        // 智力（影响计谋伤害和防御）
  command: number,             // 统率（影响部队和物理防御）
  politics: number,            // 政治（影响内政）
  charm: number,               // 魅力（影响招募和忠诚）
  
  // 战斗属性（3.0-10.0）
  courage: number,             // 勇气（影响物理伤害和暴击）
  luck: number,                // 运气（影响闪避、暴击、计谋伤害）
  
  // 属性来源记录
  baseAttributes: {            // 初始随机属性
    combat: number,
    intelligence: number,
    command: number,
    politics: number,
    charm: number,
    courage: number,
    luck: number,
  },
  
  bonusAttributes: {           // 加成属性（装备、称号等）
    combat: number,
    intelligence: number,
    command: number,
    politics: number,
    charm: number,
    courage: number,
    luck: number,
  },
  
  // 属性随机记录
  attributeRolls: {
    rollCount: number,         // 已随机次数（最多3次）
    selectedRoll: number,      // 选择的方案（1-9）
    rollHistory: Array<{       // 随机历史
      rollNumber: number,      // 第几次随机
      options: Array<{         // 3个方案
        optionNumber: number,  // 方案编号
        attributes: object,    // 属性值
      }>,
    }>,
  },
}
```

**字段说明**：
- 核心属性范围：3.0-10.0（小数点后1位）
- `baseAttributes` - 记录初始属性，用于计算加成
- `attributeRolls` - 记录随机过程，用于审计

---

## 4️⃣ 官职系统 (PositionInfo)

```javascript
position: {
  // 当前官职
  currentPosition: {
    positionId: string,        // 官职ID（position_1_001等）
    positionName: string,      // 官职名称
    level: number,             // 官职等级（1-8）
    category: string,          // 官职类别（步兵/骑兵/综合等）
    isUnique: boolean,         // 是否唯一官职
  },
  
  // 晋升数据
  promotion: {
    currentReputation: number, // 当前声望值（从character复制）
    reputationToNext: number,  // 晋升所需声望
    canPromote: boolean,       // 是否可以晋升
    nextPositions: string[],   // 可晋升的官职列表
  },
  
  // 官职历史
  positionHistory: Array<{
    positionId: string,
    positionName: string,
    obtainedAt: Date,          // 获得时间
    lostAt: Date,              // 失去时间（如果有）
    duration: number,          // 持续时间（秒）
  }>,
  
  // 权限列表
  permissions: string[],       // 当前拥有的权限
}
```

**字段说明**：
- `currentPosition` - 当前官职信息
- `currentReputation` - 当前声望值，通过任务和杀敌提升
- `reputationToNext` - 达到此声望值可晋升
- `permissions` - 根据官职等级动态计算

---

## 5️⃣ 卡包系统 (CardCollection)

**设计理念**：所有游戏内容都以卡牌形式存在，统一管理，按类型分类。

```javascript
cardCollection: {
  // 部队卡
  troopCards: Array<{
    instanceId: string,        // 卡牌实例ID（唯一）
    cardType: "troop",         // 卡牌类型
    troopCardId: string,       // 部队卡模板ID
    troopName: string,         // 部队名称
    rarity: string,            // 稀有度（common/rare/epic/legendary/core）
    troopType: string,         // 兵种类型（infantry/cavalry/archer）
    currentTroops: number,     // 当前兵力
    maxTroops: number,         // 最大兵力
    attack: number,            // 攻击力
    defense: number,           // 防御力
    speed: number,             // 速度
    morale: number,            // 士气（0-100）
    isEquipped: boolean,       // 是否已装备
    equippedBy: string,        // 装备在哪个角色上（player/hero1/hero2）
    obtainedAt: Date,          // 获得时间
    usageCount: number,        // 使用次数（金色部队卡专用）
  }>,
  
  // 武将卡
  heroCards: Array<{
    instanceId: string,        // 卡牌实例ID
    cardType: "hero",          // 卡牌类型
    characterId: string,       // 武将模板ID
    characterName: string,     // 武将名称
    rarity: string,            // 稀有度
    attributes: object,        // 属性
    level: number,             // 等级
    experience: number,        // 经验
    isRecruited: boolean,      // 是否已招募（在队伍中）
    loyalty: number,           // 忠诚度（0-100）
    obtainedAt: Date,          // 获得时间
  }>,
  
  // 装备卡
  equipmentCards: Array<{
    instanceId: string,        // 卡牌实例ID
    cardType: "equipment",     // 卡牌类型
    equipmentId: string,       // 装备模板ID
    equipmentName: string,     // 装备名称
    equipmentType: string,     // 装备类型（weapon/armor/accessory/title/mount/treasure）
    rarity: string,            // 稀有度
    attributes: object,        // 属性加成
    isEquipped: boolean,       // 是否已装备
    equippedBy: string,        // 装备在哪个角色上
    obtainedAt: Date,          // 获得时间
  }>,
  
  // 道具卡
  itemCards: Array<{
    instanceId: string,        // 卡牌实例ID
    cardType: "item",          // 卡牌类型
    itemId: string,            // 道具模板ID
    itemName: string,          // 道具名称
    itemType: string,          // 道具类型（consumable/material/special）
    rarity: string,            // 稀有度
    quantity: number,          // 数量（可堆叠）
    description: string,       // 道具描述
    obtainedAt: Date,          // 获得时间
  }>,
  
  // 卡包统计
  collectionStats: {
    totalCards: number,        // 总卡牌数
    troopCardsCount: number,   // 部队卡数量
    heroCardsCount: number,    // 武将卡数量
    equipmentCardsCount: number, // 装备卡数量
    itemCardsCount: number,    // 道具卡数量
    
    // 按稀有度统计
    byRarity: {
      common: number,
      rare: number,
      epic: number,
      legendary: number,
      core: number,
    },
  },
}
```

**字段说明**：
- 所有卡牌都有唯一的 `instanceId`
- `cardType` 用于区分卡牌类型
- `isEquipped` 和 `equippedBy` 用于管理装备状态
- 统一的稀有度系统（common/rare/epic/legendary/core）

---

## 6️⃣ 装备槽位系统 (EquipmentSlots)

**玩家装备槽（7个）**：

```javascript
equipmentSlots: {
  // 玩家装备槽（7个）
  player: {
    weapon: string,            // 武器槽（装备instanceId）
    armor: string,             // 防具槽
    accessory1: string,        // 辅助槽1
    accessory2: string,        // 辅助槽2
    title: string,             // 称号槽
    achievement: string,       // 成就槽
    treasure: string,          // 宝物槽
    troop: string,             // 部队槽（1个）
  },
  
  // 武将1装备槽（8个）
  hero1: {
    weapon: string,            // 武器槽
    armor: string,             // 防具槽
    accessory1: string,        // 辅助槽1
    accessory2: string,        // 辅助槽2
    title: string,             // 称号槽
    achievement: string,       // 成就槽
    treasure: string,          // 宝物槽
    troop1: string,            // 部队槽1
    troop2: string,            // 部队槽2（武将专属）
  },
  
  // 武将2装备槽（8个）
  hero2: {
    weapon: string,
    armor: string,
    accessory1: string,
    accessory2: string,
    title: string,
    achievement: string,
    treasure: string,
    troop1: string,
    troop2: string,
  },
}
```

**7个装备槽说明**：
1. **武器槽** - 增加攻击力
2. **防具槽** - 增加防御力
3. **辅助槽1** - 特殊效果（如增加速度）
4. **辅助槽2** - 特殊效果（如增加暴击）
5. **称号槽** - 综合属性加成
6. **成就槽** - 成就徽章，提供特殊加成
7. **宝物槽** - 特殊技能或效果

**玩家 vs 武将**：
- 玩家：7个装备槽 + 1个部队槽 = 8个槽位
- 武将：7个装备槽 + 2个部队槽 = 9个槽位

**字段说明**：
- 槽位存储的是卡牌的 `instanceId`
- 通过 `instanceId` 关联到 `cardCollection` 中的具体卡牌
- 成就槽用于装备成就徽章，展示玩家的成就并提供属性加成
- 宝物槽用于装备特殊宝物，提供独特的技能或效果

---

## 7️⃣ 战斗数据 (CombatInfo)

```javascript
combat: {
  // 战斗队伍
  battleTeam: {
    player: {
      playerId: string,
      troopInstanceId: string, // 装备的部队卡实例ID
    },
    hero1: {
      heroInstanceId: string,
      troop1InstanceId: string,
      troop2InstanceId: string,
    },
    hero2: {
      heroInstanceId: string,
      troop1InstanceId: string,
      troop2InstanceId: string,
    },
  },
  
  // 战斗状态
  inBattle: boolean,           // 是否在战斗中
  currentBattleId: string,     // 当前战斗ID
  
  // 战斗历史
  battleHistory: Array<{
    battleId: string,          // 战斗ID
    battleType: string,        // 战斗类型
    opponent: object,          // 对手信息
    result: string,            // 战斗结果（win/lose/draw）
    rewards: object,           // 战斗奖励
    battleAt: Date,            // 战斗时间
    duration: number,          // 战斗时长（秒）
  }>,
}
```

**字段说明**：
- `battleTeam` - 当前编组的战斗队伍
- `battleHistory` - 最近的战斗记录

---

## 8️⃣ 进度数据 (ProgressInfo)

```javascript
progress: {
  // 新手引导
  tutorial: {
    completed: boolean,        // 是否完成新手引导
    currentStep: number,       // 当前步骤
    completedSteps: number[],  // 已完成步骤
    completedAt: Date,         // 完成时间
  },
  
  // 称号系统
  titles: {
    currentTitle: string,      // 当前使用的称号
    unlockedTitles: Array<{    // 已解锁的称号
      titleId: string,         // 称号ID
      titleName: string,       // 称号名称
      titleRarity: string,     // 称号稀有度
      attributes: object,      // 属性加成
      unlockedAt: Date,        // 解锁时间
    }>,
  },
  
  // 任务系统
  quests: {
    dailyQuests: Array<{       // 每日任务
      questId: string,
      questName: string,
      questType: string,       // 任务类型（combat/gather/social等）
      progress: number,
      target: number,
      reputationReward: number, // 声望奖励
      resourceReward: object,  // 资源奖励（粮草/银两）
      completed: boolean,
      claimed: boolean,
    }>,
    weeklyQuests: Array<{      // 每周任务
      questId: string,
      questName: string,
      questType: string,
      progress: number,
      target: number,
      reputationReward: number,
      resourceReward: object,
      completed: boolean,
      claimed: boolean,
    }>,
    mainQuests: Array<{        // 主线任务
      questId: string,
      questName: string,
      questType: string,
      progress: number,
      target: number,
      reputationReward: number,
      resourceReward: object,
      completed: boolean,
      claimed: boolean,
    }>,
  },
  
  // 成就系统
  achievements: Array<{
    achievementId: string,
    achievementName: string,
    achievementCategory: string, // 成就分类
    progress: number,
    target: number,
    reputationReward: number,  // 声望奖励
    titleReward: string,       // 称号奖励
    completed: boolean,
    claimed: boolean,
    completedAt: Date,
  }>,
}
```

**字段说明**：
- `tutorial` - 新手引导进度
- `titles` - 称号系统，称号可以装备到称号槽
- `quests` - 任务系统，完成任务获得声望和资源
- `achievements` - 成就系统，完成成就可能解锁称号

---

## 9️⃣ 统计数据 (StatisticsInfo)

**设计理念**：统计数据用于排行榜、成就系统、数据分析和玩家画像。这些数据不需要实时精确，可以定期更新。

```javascript
statistics: {
  // 战斗统计
  combat: {
    // 基础战斗数据
    totalBattles: number,      // 总战斗次数
    wins: number,              // 胜利次数
    losses: number,            // 失败次数
    draws: number,             // 平局次数
    winRate: number,           // 胜率（百分比）
    
    // 伤害统计
    totalDamageDealt: number,  // 总伤害输出
    totalDamageTaken: number,  // 总承受伤害
    maxDamageInBattle: number, // 单场最高伤害
    avgDamagePerBattle: number, // 平均每场伤害
    
    // 击杀统计
    totalKills: number,        // 总击杀敌军数量
    maxKillsInBattle: number,  // 单场最高击杀
    
    // 连胜统计
    currentWinStreak: number,  // 当前连胜
    maxWinStreak: number,      // 最高连胜记录
    
    // 战斗类型统计
    pvpBattles: number,        // PVP战斗次数
    pveBattles: number,        // PVE战斗次数
    siegeBattles: number,      // 攻城战次数
    defenseBattles: number,    // 防守战次数
    
    // 特殊战斗统计
    perfectVictories: number,  // 完美胜利（无损或低损）
    comebackVictories: number, // 逆转胜利（劣势翻盘）
    quickVictories: number,    // 快速胜利（3回合内）
  },
  
  // 游戏时长统计
  playtime: {
    // 总时长
    totalPlaytime: number,     // 总游戏时长（秒）
    totalDays: number,         // 总游戏天数
    
    // 周期时长
    todayPlaytime: number,     // 今日游戏时长
    weekPlaytime: number,      // 本周游戏时长
    monthPlaytime: number,     // 本月游戏时长
    
    // 平均时长
    avgDailyPlaytime: number,  // 平均每日时长
    avgSessionTime: number,    // 平均单次会话时长
    
    // 活跃度
    totalSessions: number,     // 总登录次数
    consecutiveDays: number,   // 连续登录天数
    maxConsecutiveDays: number, // 最高连续登录记录
    
    // 时段统计（预留）
    morningPlaytime: number,   // 早上游戏时长（6-12点）
    afternoonPlaytime: number, // 下午游戏时长（12-18点）
    eveningPlaytime: number,   // 晚上游戏时长（18-24点）
    nightPlaytime: number,     // 深夜游戏时长（0-6点）
  },
  
  // 经济统计
  economy: {
    // 粮草统计
    totalFoodEarned: number,   // 总获得粮草
    totalFoodSpent: number,    // 总花费粮草
    currentFood: number,       // 当前粮草（冗余，便于查询）
    maxFood: number,           // 历史最高粮草
    
    // 银两统计
    totalSilverEarned: number, // 总获得银两
    totalSilverSpent: number,  // 总花费银两
    currentSilver: number,     // 当前银两（冗余）
    maxSilver: number,         // 历史最高银两
    
    // 交易统计
    totalTrades: number,       // 总交易次数
    totalPurchases: number,    // 总购买次数
    totalSales: number,        // 总出售次数
    
    // 资源来源统计
    foodFromBattles: number,   // 战斗获得粮草
    foodFromQuests: number,    // 任务获得粮草
    foodFromProduction: number, // 生产获得粮草
    silverFromBattles: number, // 战斗获得银两
    silverFromQuests: number,  // 任务获得银两
    silverFromTrade: number,   // 交易获得银两
    
    // 资源消耗统计（2种）
    foodForBattle: number,     // 战斗消耗粮草（上阵需要消耗与兵力相当的粮草）
    silverForTroopCards: number, // 招募部队卡消耗银两
    silverForEquipment: number, // 购买装备消耗银两
    silverForFood: number,     // 购买粮草消耗银两
  },
  
  // 社交统计
  social: {
    // 好友系统
    friendsCount: number,      // 好友数量
    friendRequestsSent: number, // 发送好友请求数
    friendRequestsReceived: number, // 收到好友请求数
    
    // 消息系统
    messagesCount: number,     // 总消息数量
    messagesSent: number,      // 发送消息数
    messagesReceived: number,  // 接收消息数
    
    // 协作统计（S1暂不实现，预留）
    assistBattles: number,     // 协助战斗次数
    assistedByOthers: number,  // 被协助次数
  },
  
  // 成长统计
  progression: {
    // 声望统计
    totalReputationEarned: number, // 总获得声望
    currentReputation: number, // 当前声望（冗余）
    reputationFromQuests: number, // 任务获得声望
    reputationFromBattles: number, // 战斗获得声望
    reputationFromAchievements: number, // 成就获得声望
    
    // 官职统计
    totalPromotions: number,   // 总晋升次数
    highestPosition: string,   // 历史最高官职
    daysInCurrentPosition: number, // 当前官职天数
    
    // 势力排名（基于声望）
    factionRank: number,       // 势力内声望排名
    serverRank: number,        // 服务器内声望排名
    
    // 任务统计
    totalQuestsCompleted: number, // 总完成任务数
    dailyQuestsCompleted: number, // 完成每日任务数
    weeklyQuestsCompleted: number, // 完成每周任务数
    mainQuestsCompleted: number, // 完成主线任务数
    
    // 成就统计
    totalAchievements: number, // 总成就数
    achievementsUnlocked: number, // 已解锁成就数
    achievementPoints: number, // 成就点数
    rareAchievements: number,  // 稀有成就数
  },
  
  // 收集统计
  collection: {
    // 卡牌收集
    totalCardsCollected: number, // 总收集卡牌数
    uniqueCardsCollected: number, // 不同卡牌数
    
    // 部队卡统计
    troopCardsCollected: number, // 收集部队卡数
    commonTroops: number,      // 白色部队卡数
    rareTroops: number,        // 蓝色部队卡数
    epicTroops: number,        // 紫色部队卡数
    legendaryTroops: number,   // 橙色部队卡数
    
    // 武将卡统计
    heroCardsCollected: number, // 收集武将卡数
    commonHeroes: number,      // 白色武将数
    rareHeroes: number,        // 蓝色武将数
    epicHeroes: number,        // 紫色武将数
    legendaryHeroes: number,   // 橙色武将数
    
    // 装备统计
    equipmentCollected: number, // 收集装备数
    weaponsCollected: number,  // 武器数
    armorsCollected: number,   // 防具数
    accessoriesCollected: number, // 辅助装备数
    
    // 特殊收集完成度（仅2种）
    coreCardsCollected: number, // 金卡（纪念卡）收集数
    treasuresCollected: number, // 宝物收集数（每赛季仅1个）
    coreCardRate: number,      // 金卡收集完成度（百分比）
    treasureRate: number,      // 宝物收集完成度（0或100）
  },
  
  // 战术统计
  tactics: {
    // 兵种使用统计
    infantryBattles: number,   // 使用步兵战斗次数
    cavalryBattles: number,    // 使用骑兵战斗次数
    archerBattles: number,     // 使用弓兵战斗次数
    
    // 战术偏好
    aggressiveWins: number,    // 进攻型胜利
    defensiveWins: number,     // 防守型胜利
    balancedWins: number,      // 均衡型胜利
    
    // 技能使用
    totalSkillsUsed: number,   // 总技能使用次数
    mostUsedSkill: string,     // 最常用技能
    maxSkillDamage: number,    // 技能最高伤害
    
    // 阵型使用
    formationsUsed: number,    // 使用阵型次数
    mostUsedFormation: string, // 最常用阵型
    formationWinRate: number,  // 阵型胜率
  },
}
```

---

### 📊 统计数据用途

#### 1. 排行榜系统
- 战斗胜率排行
- 总胜场排行
- 连胜排行
- 伤害输出排行
- 声望排行
- 收集完成度排行

#### 2. 成就系统
- 战斗类成就（100胜、连胜10场等）
- 收集类成就（收集50张卡牌等）
- 经济类成就（累计获得10万粮草等）
- 社交类成就（添加10个好友等）

#### 3. 玩家画像
- 游戏风格分析（进攻型/防守型/均衡型）
- 活跃度分析（重度/中度/轻度玩家）
- 消费习惯分析
- 社交倾向分析

#### 4. 数据分析
- 留存率分析
- 付费转化分析
- 功能使用率分析
- 平衡性调整依据

#### 5. 个人中心展示
- 战绩展示
- 荣誉墙
- 数据看板
- 成长轨迹

---

### 🔄 数据更新策略

#### 实时更新
- 战斗结束后立即更新战斗统计
- 资源变化时立即更新经济统计
- 任务完成时立即更新进度统计

#### 定期更新（每小时）
- 游戏时长统计
- 平均值计算
- 排名更新

#### 每日更新
- 每日统计重置
- 连续登录天数更新
- 活跃度统计

#### 每周/每月更新
- 周期性统计重置
- 长期趋势分析

---

### 📈 统计数据示例

```javascript
statistics: {
  combat: {
    totalBattles: 156,
    wins: 98,
    losses: 52,
    draws: 6,
    winRate: 62.82,
    totalDamageDealt: 45230,
    totalDamageTaken: 32100,
    maxDamageInBattle: 1250,
    avgDamagePerBattle: 290,
    totalKills: 8920,
    maxKillsInBattle: 180,
    currentWinStreak: 5,
    maxWinStreak: 12,
    pvpBattles: 89,
    pveBattles: 67,
    siegeBattles: 23,
    defenseBattles: 18,
    perfectVictories: 15,
    comebackVictories: 8,
    quickVictories: 32,
  },
  
  playtime: {
    totalPlaytime: 432000,     // 120小时
    totalDays: 45,
    todayPlaytime: 7200,       // 2小时
    weekPlaytime: 36000,       // 10小时
    monthPlaytime: 144000,     // 40小时
    avgDailyPlaytime: 9600,    // 2.67小时
    avgSessionTime: 3600,      // 1小时
    totalSessions: 120,
    consecutiveDays: 7,
    maxConsecutiveDays: 15,
    morningPlaytime: 72000,
    afternoonPlaytime: 108000,
    eveningPlaytime: 180000,
    nightPlaytime: 72000,
  },
  
  economy: {
    totalFoodEarned: 125000,
    totalFoodSpent: 98000,
    currentFood: 27000,
    maxFood: 35000,
    totalSilverEarned: 68000,
    totalSilverSpent: 52000,
    currentSilver: 16000,
    maxSilver: 22000,
    totalTrades: 45,
    totalPurchases: 89,
    totalSales: 23,
    foodFromBattles: 45000,
    foodFromQuests: 60000,
    foodFromProduction: 20000,
    silverFromBattles: 28000,
    silverFromQuests: 32000,
    silverFromTrade: 8000,
    foodForBattle: 98000,      // 战斗消耗粮草
    silverForTroopCards: 25000, // 招募部队卡消耗银两
    silverForEquipment: 20000, // 购买装备消耗银两
    silverForFood: 7000,       // 购买粮草消耗银两
  },
  
  social: {
    friendsCount: 23,
    friendRequestsSent: 35,
    friendRequestsReceived: 42,
    messagesCount: 567,
    messagesSent: 289,
    messagesReceived: 278,
    assistBattles: 0,          // S1暂不实现
    assistedByOthers: 0,       // S1暂不实现
  },
  
  progression: {
    totalReputationEarned: 2340,
    currentReputation: 1850,
    reputationFromQuests: 1200,
    reputationFromBattles: 980,
    reputationFromAchievements: 160,
    totalPromotions: 3,
    highestPosition: "中郎将",
    daysInCurrentPosition: 12,
    factionRank: 15,           // 势力内声望排名
    serverRank: 89,            // 服务器内声望排名
    totalQuestsCompleted: 234,
    dailyQuestsCompleted: 156,
    weeklyQuestsCompleted: 45,
    mainQuestsCompleted: 33,
    totalAchievements: 150,
    achievementsUnlocked: 67,
    achievementPoints: 1250,
    rareAchievements: 8,
  },
  
  collection: {
    totalCardsCollected: 234,
    uniqueCardsCollected: 156,
    troopCardsCollected: 45,
    commonTroops: 15,
    rareTroops: 18,
    epicTroops: 9,
    legendaryTroops: 3,
    heroCardsCollected: 28,
    commonHeroes: 8,
    rareHeroes: 12,
    epicHeroes: 6,
    legendaryHeroes: 2,
    equipmentCollected: 67,
    weaponsCollected: 23,
    armorsCollected: 18,
    accessoriesCollected: 26,
    coreCardsCollected: 2,     // 收集了2张金卡
    treasuresCollected: 1,     // 收集了赛季宝物
    coreCardRate: 40.0,        // 金卡收集完成度40%
    treasureRate: 100.0,       // 宝物收集完成度100%
  },
  
  tactics: {
    infantryBattles: 67,
    cavalryBattles: 52,
    archerBattles: 37,
    aggressiveWins: 45,
    defensiveWins: 32,
    balancedWins: 21,
    totalSkillsUsed: 456,
    mostUsedSkill: "skill_charge",
    maxSkillDamage: 2850,      // 技能最高伤害
    formationsUsed: 89,
    mostUsedFormation: "formation_wedge",
    formationWinRate: 68.2,
  },
}
```

---

**字段说明**：
- 所有数值类型统计都是累计值
- 百分比类型（如胜率）是计算值，可以定期更新
- 某些字段是冗余的（如currentFood），便于快速查询
- 统计数据主要用于展示和分析，不影响核心游戏逻辑

---

## 🔟 时间戳 (Timestamps)

```javascript
timestamps: {
  createdAt: Date,             // 账号创建时间
  updatedAt: Date,             // 最后更新时间
  lastLoginAt: Date,           // 最后登录时间
  lastActiveAt: Date,          // 最后活跃时间
  lastBattleAt: Date,          // 最后战斗时间
  lastQuestAt: Date,           // 最后任务时间
}
```

**字段说明**：
- 用于非激活判定
- 用于活跃度统计

---

## 📊 完整数据结构示例

```javascript
const playerExample = {
  // 1. 账号信息
  account: {
    accountId: "acc_550e8400-e29b-41d4-a716-446655440000",
    username: "玩家001",
    email: "player001@example.com",
    passwordHash: "$2b$10$...",
    status: "active",
    statusReason: null,
    serverId: "server_s1_001",
    serverName: "群雄逐鹿",
    isPremium: false,
    premiumExpireAt: null,
    lastLoginIp: "192.168.1.1",
    loginAttempts: 0,
    lockedUntil: null,
  },
  
  // 2. 角色基础信息
  character: {
    playerId: "player_550e8400-e29b-41d4-a716-446655440001",
    characterName: "云中鹤",
    factionId: "faction_liu",
    factionName: "刘备势力",
    avatar: "/assets/avatars/default.png",
    portrait: "/assets/portraits/default.png",
    reputation: 0,           // 当前声望值
    reputationToNext: 100,   // 晋升到2级都尉需要100声望
    resources: {
      food: 1000,            // 初始粮草
      silver: 500,           // 初始银两
    },
  },
  
  // 3. 属性系统
  attributes: {
    combat: 6.5,
    intelligence: 7.2,
    command: 6.8,
    politics: 5.5,
    charm: 6.0,
    courage: 7.0,
    luck: 6.5,
    
    baseAttributes: {
      combat: 6.5,
      intelligence: 7.2,
      command: 6.8,
      politics: 5.5,
      charm: 6.0,
      courage: 7.0,
      luck: 6.5,
    },
    
    bonusAttributes: {
      combat: 0,
      intelligence: 0,
      command: 0,
      politics: 0,
      charm: 0,
      courage: 0,
      luck: 0,
    },
    
    attributeRolls: {
      rollCount: 1,
      selectedRoll: 2,
      rollHistory: [
        {
          rollNumber: 1,
          options: [
            { optionNumber: 1, attributes: { combat: 6.2, intelligence: 7.0, /* ... */ } },
            { optionNumber: 2, attributes: { combat: 6.5, intelligence: 7.2, /* ... */ } },
            { optionNumber: 3, attributes: { combat: 6.8, intelligence: 6.5, /* ... */ } },
          ],
        },
      ],
    },
  },
  
  // 4. 官职系统
  position: {
    currentPosition: {
      positionId: "position_1_001",
      positionName: "军候",
      level: 1,
      category: "初始",
      isUnique: false,
    },
    promotion: {
      currentReputation: 0,
      reputationToNext: 100,
      canPromote: false,
      nextPositions: ["position_2_001", "position_2_002"],
    },
    positionHistory: [],
    permissions: ["basic_combat", "basic_quest"],
  },
  
  // 5. 卡包系统
  cardCollection: {
    troopCards: [
      {
        instanceId: "troop_inst_001",
        cardType: "troop",
        troopCardId: "troop_san_1001",
        troopName: "民兵",
        rarity: "common",
        troopType: "infantry",
        currentTroops: 150,
        maxTroops: 150,
        attack: 35,
        defense: 23,
        speed: 4,
        morale: 100,
        isEquipped: true,
        equippedBy: "player",
        obtainedAt: new Date("2026-02-10"),
        usageCount: 0,
      },
      {
        instanceId: "troop_inst_002",
        cardType: "troop",
        troopCardId: "troop_san_1004",
        troopName: "轻骑兵",
        rarity: "common",
        troopType: "cavalry",
        currentTroops: 150,
        maxTroops: 150,
        attack: 40,
        defense: 20,
        speed: 7,
        morale: 100,
        isEquipped: false,
        equippedBy: null,
        obtainedAt: new Date("2026-02-10"),
        usageCount: 0,
      },
    ],
    heroCards: [],
    equipmentCards: [],
    itemCards: [],
    collectionStats: {
      totalCards: 2,
      troopCardsCount: 2,
      heroCardsCount: 0,
      equipmentCardsCount: 0,
      itemCardsCount: 0,
      byRarity: {
        common: 2,
        rare: 0,
        epic: 0,
        legendary: 0,
        core: 0,
      },
    },
  },
  
  // 6. 装备槽位系统
  equipmentSlots: {
    player: {
      weapon: null,
      armor: null,
      accessory1: null,
      accessory2: null,
      title: null,
      achievement: null,
      treasure: null,
      troop: "troop_inst_001",  // 装备了民兵
    },
    hero1: null,  // 未招募武将
    hero2: null,  // 未招募武将
  },
  
  // 7. 战斗数据
  combat: {
    battleTeam: {
      player: {
        playerId: "player_550e8400-e29b-41d4-a716-446655440001",
        troopInstanceId: "troop_inst_001",
      },
      hero1: null,
      hero2: null,
    },
    inBattle: false,
    currentBattleId: null,
    battleHistory: [],
  },
  
  // 8. 进度数据
  progress: {
    tutorial: {
      completed: false,
      currentStep: 1,
      completedSteps: [],
      completedAt: null,
    },
    titles: {
      currentTitle: "title_001",
      unlockedTitles: [
        {
          titleId: "title_001",
          titleName: "初出茅庐",
          titleRarity: "common",
          attributes: { combat: 0.1, intelligence: 0.1 },
          unlockedAt: new Date("2026-02-10"),
        },
      ],
    },
    quests: {
      dailyQuests: [],
      weeklyQuests: [],
      mainQuests: [
        {
          questId: "main_001",
          questName: "完成新手引导",
          questType: "tutorial",
          progress: 0,
          target: 1,
          reputationReward: 10,
          resourceReward: { food: 100, silver: 50 },
          completed: false,
          claimed: false,
        },
      ],
    },
    achievements: [],
  },
  
  // 9. 统计数据
  statistics: {
    combat: {
      totalBattles: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalKills: 0,
    },
    playtime: {
      totalPlaytime: 0,
      todayPlaytime: 0,
      weekPlaytime: 0,
      monthPlaytime: 0,
    },
    economy: {
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      totalPurchases: 0,
    },
    social: {
      friendsCount: 0,
      messagesCount: 0,
      guildContribution: 0,
    },
  },
  
  // 10. 时间戳
  timestamps: {
    createdAt: new Date("2026-02-10T10:00:00Z"),
    updatedAt: new Date("2026-02-10T10:30:00Z"),
    lastLoginAt: new Date("2026-02-10T10:00:00Z"),
    lastActiveAt: new Date("2026-02-10T10:30:00Z"),
    lastBattleAt: null,
    lastQuestAt: null,
  },
};
```

---

## 🔄 数据更新策略

### 实时更新
- 战斗数据
- 部队兵力
- 资源变化

### 定期更新
- 统计数据（每小时）
- 排行榜（每天）
- 活跃度（每天）

### 事件触发更新
- 官职晋升
- 任务完成
- 成就解锁

---

## 🔒 数据安全

### 敏感数据分离
- 密码哈希单独存储
- 支付信息单独存储
- 登录日志单独存储

### 数据验证
- 所有数值范围验证
- 唯一性验证
- 关联性验证

### 数据备份
- 每日全量备份
- 实时增量备份
- 关键操作日志

---

## 📚 相关文档

- [14-PLAYER_SYSTEM.md](./14-PLAYER_SYSTEM.md) - 玩家系统设计
- [22-TROOP_SYSTEM.md](../20-data-layer/22-TROOP_SYSTEM.md) - 部队系统
- [18-COMBAT_SYSTEM.md](./18-COMBAT_SYSTEM.md) - 战斗系统

---

**文档作者**: Kiro AI  
**创建日期**: 2026-02-10  
**文档版本**: v1.0.0
