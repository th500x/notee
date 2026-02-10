# AI玩家系统设计文档

## 📋 文档概述

本文档详细说明AI玩家系统的设计，用于在测试期和玩家不足时填充服务器，保证游戏体验。

**核心理念**：
- 🤖 **无缝融入** - AI玩家与真人玩家无明显区别
- 🎯 **智能行为** - 模拟真实玩家的游戏行为
- ⚖️ **动态调整** - 根据真人数量自动增减AI
- 🎮 **测试辅助** - 帮助测试游戏机制和平衡性
- 📊 **数据收集** - 收集AI行为数据优化游戏

---

## 🎯 核心目标

### 1. 测试期目标

**问题**：
- 测试人数不足（可能只有5-10人）
- 无法测试大规模战斗
- 无法测试势力平衡
- 无法测试社交系统

**解决方案**：
```
真人玩家：10人
AI玩家：490人
总计：500人（满服）

分配示例：
- 刘备势力：3真人 + 27AI = 30人
- 曹操势力：4真人 + 56AI = 60人
- 孙坚势力：1真人 + 29AI = 30人
- 袁绍势力：1真人 + 29AI = 30人
- 董卓势力：0真人 + 100AI = 100人
- 汉室势力：1真人 + 149AI = 150人
- 黄巾势力：0真人 + 100AI = 100人
```

**效果**：
- ✅ 测试完整的游戏循环
- ✅ 测试势力战争
- ✅ 测试资源系统
- ✅ 测试排名系统
- ✅ 测试社交功能

### 2. 正式运营目标

**问题**：
- 新服务器玩家不足
- 老服务器玩家流失
- 某些势力人数过少
- 游戏体验下降

**解决方案**：
```
动态AI补充系统

场景1：新服务器开服
- 真人：50人
- AI：450人
- 随着真人增加，AI逐渐退出

场景2：老服务器维持
- 真人：200人
- AI：300人
- 保持服务器活跃度

场景3：势力平衡
- 刘备势力：30人（全真人）
- 董卓势力：5真人 + 95AI = 100人
- AI填充人数少的势力
```

---

## 🤖 AI玩家类型

### 1. 基础AI（填充型）

**特点**：
- 行为简单，可预测
- 主要用于填充人数
- 不参与核心竞争
- 资源消耗少

**行为模式**：
```javascript
基础AI行为：
- 每天登录1-2次
- 完成简单日常任务
- 不参与PVP战斗
- 不参与势力决策
- 不在聊天频道发言
- 自动接受任务和奖励
```

**用途**：
- 填充服务器人数
- 提供基础互动对象
- 维持势力人数

**占比**：60-70%的AI玩家

### 2. 活跃AI（互动型）

**特点**：
- 行为较复杂，有一定随机性
- 参与游戏互动
- 模拟真实玩家行为
- 提供游戏体验

**行为模式**：
```javascript
活跃AI行为：
- 每天登录3-5次
- 完成大部分日常任务
- 参与PVE战斗
- 参与势力任务
- 偶尔在聊天频道发言（预设话术）
- 参与资源交易
- 参与排名竞争（但不争第一）
```

**用途**：
- 提供互动体验
- 测试游戏机制
- 活跃游戏氛围

**占比**：25-35%的AI玩家

### 3. 精英AI（竞争型）

**特点**：
- 行为复杂，高度智能
- 参与核心竞争
- 模拟高水平玩家
- 提供挑战

**行为模式**：
```javascript
精英AI行为：
- 每天登录5-10次
- 完成所有日常任务
- 积极参与PVP战斗
- 参与势力决策投票
- 在聊天频道活跃（预设话术）
- 参与资源交易和外交
- 争夺排名（但不超过真人前10%）
- 使用策略和战术
```

**用途**：
- 提供竞争压力
- 测试高端玩法
- 填补高端玩家空缺

**占比**：5-10%的AI玩家

---

## 🎭 AI玩家身份设计

### 1. 命名规则

**真实感命名**：
```javascript
// 历史人物名（低级AI）
const historicalNames = [
  '张三', '李四', '王五', '赵六',
  '孙七', '周八', '吴九', '郑十',
  // ... 数百个常见姓名
];

// 文艺名（中级AI）
const literaryNames = [
  '云中鹤', '风中剑', '雨中行', '雪中客',
  '月下影', '星空梦', '天涯路', '海角心',
  // ... 数百个文艺名字
];

// 游戏风格名（高级AI）
const gameStyleNames = [
  '破军之刃', '天策无双', '龙吟九天', '凤舞长空',
  '霸王之志', '军师之智', '神将之勇', '谋士之谋',
  // ... 数百个游戏风格名
];

// 命名规则
function generateAIName(aiType, aiId) {
  const namePool = {
    basic: historicalNames,
    active: literaryNames,
    elite: gameStyleNames,
  };
  
  const names = namePool[aiType];
  const name = names[aiId % names.length];
  
  // 避免重复，添加后缀
  return `${name}${aiId > names.length ? aiId : ''}`;
}
```

### 2. 角色设定

**属性分配**：
```javascript
// 基础AI - 随机但偏低
function generateBasicAIAttributes() {
  return {
    luck: random(3.0, 6.0),
    courage: random(3.0, 6.0),
    command: random(3.0, 6.0),
    combat: random(3.0, 6.0),
    intelligence: random(3.0, 6.0),
    politics: random(3.0, 6.0),
    charisma: random(3.0, 6.0),
    morale: 50,
  };
}

// 活跃AI - 随机但中等
function generateActiveAIAttributes() {
  return {
    luck: random(5.0, 7.5),
    courage: random(5.0, 7.5),
    command: random(5.0, 7.5),
    combat: random(5.0, 7.5),
    intelligence: random(5.0, 7.5),
    politics: random(5.0, 7.5),
    charisma: random(5.0, 7.5),
    morale: 60,
  };
}

// 精英AI - 随机但偏高
function generateEliteAIAttributes() {
  return {
    luck: random(7.0, 9.0),
    courage: random(7.0, 9.0),
    command: random(7.0, 9.0),
    combat: random(7.0, 9.0),
    intelligence: random(7.0, 9.0),
    politics: random(7.0, 9.0),
    charisma: random(7.0, 9.0),
    morale: 80,
  };
}
```

### 3. 标识系统

**如何区分AI和真人**：

**选项A：完全隐藏（推荐）** ⭐
```javascript
// AI玩家与真人玩家完全一样
// 优点：真实感强，测试效果好
// 缺点：可能引起误解

const player = {
  id: 'player_12345',
  name: '云中鹤',
  isAI: false, // 前端不显示
  // ... 其他属性
};
```

**选项B：后台标记**
```javascript
// 后台数据库标记，前端不显示
// 管理员可以查看
// 玩家看不到

const player = {
  id: 'player_12345',
  name: '云中鹤',
  isAI: true, // 仅管理员可见
  aiType: 'active',
  // ... 其他属性
};
```

**选项C：特殊标识（不推荐）**
```javascript
// 在名字后添加[AI]标识
// 优点：透明
// 缺点：破坏沉浸感

const player = {
  id: 'player_12345',
  name: '云中鹤[AI]',
  isAI: true,
  // ... 其他属性
};
```

**建议**：使用选项A或B，保持游戏沉浸感

---

## 🧠 AI行为系统

### 1. 日常行为

**登录行为**：
```javascript
class AIPlayer {
  // 每日登录时间
  getDailyLoginTimes(aiType) {
    const schedules = {
      basic: [
        { hour: 8, probability: 0.3 },  // 早上
        { hour: 20, probability: 0.5 }, // 晚上
      ],
      active: [
        { hour: 8, probability: 0.5 },
        { hour: 12, probability: 0.4 },
        { hour: 18, probability: 0.6 },
        { hour: 20, probability: 0.7 },
      ],
      elite: [
        { hour: 8, probability: 0.8 },
        { hour: 12, probability: 0.6 },
        { hour: 14, probability: 0.5 },
        { hour: 18, probability: 0.8 },
        { hour: 20, probability: 0.9 },
        { hour: 22, probability: 0.7 },
      ],
    };
    
    return schedules[aiType];
  }
  
  // 任务完成
  async completeDailyTasks() {
    const tasks = await this.getAvailableTasks();
    
    for (const task of tasks) {
      // 根据AI类型决定是否完成
      const shouldComplete = this.shouldCompleteTask(task);
      
      if (shouldComplete) {
        await this.completeTask(task);
        await this.delay(random(5, 30)); // 模拟真人操作延迟
      }
    }
  }
  
  shouldCompleteTask(task) {
    const rates = {
      basic: 0.3,   // 30%完成率
      active: 0.7,  // 70%完成率
      elite: 0.95,  // 95%完成率
    };
    
    return Math.random() < rates[this.aiType];
  }
}
```

### 2. 战斗行为

**PVE战斗**：
```javascript
class AIPlayer {
  // 选择战斗目标
  selectBattleTarget() {
    const targets = this.getAvailableTargets();
    
    // 基础AI：选择最弱的
    if (this.aiType === 'basic') {
      return targets.sort((a, b) => a.power - b.power)[0];
    }
    
    // 活跃AI：选择中等难度的
    if (this.aiType === 'active') {
      const myPower = this.getPower();
      return targets.find(t => 
        t.power >= myPower * 0.8 && 
        t.power <= myPower * 1.2
      );
    }
    
    // 精英AI：选择高价值目标
    if (this.aiType === 'elite') {
      return targets.sort((a, b) => b.reward - a.reward)[0];
    }
  }
  
  // 战斗策略
  getBattleStrategy() {
    const strategies = {
      basic: 'defensive',   // 防守型
      active: 'balanced',   // 平衡型
      elite: 'aggressive',  // 进攻型
    };
    
    return strategies[this.aiType];
  }
}
```

**PVP战斗**：
```javascript
class AIPlayer {
  // 是否参与PVP
  shouldEngagePVP() {
    const rates = {
      basic: 0.0,   // 不参与
      active: 0.3,  // 30%概率
      elite: 0.8,   // 80%概率
    };
    
    return Math.random() < rates[this.aiType];
  }
  
  // 选择PVP目标
  selectPVPTarget() {
    const players = this.getNearbyPlayers();
    
    // 活跃AI：选择实力相近的
    if (this.aiType === 'active') {
      const myPower = this.getPower();
      return players.find(p => 
        !p.isAI && // 优先攻击真人
        p.power >= myPower * 0.9 && 
        p.power <= myPower * 1.1
      );
    }
    
    // 精英AI：选择排名靠前的（但不是第一）
    if (this.aiType === 'elite') {
      return players
        .filter(p => !p.isAI && p.rank > 10) // 不攻击前10真人
        .sort((a, b) => a.rank - b.rank)[0];
    }
  }
}
```

### 3. 社交行为

**聊天系统**：
```javascript
class AIPlayer {
  // 聊天话术库
  getChatTemplates() {
    return {
      greeting: [
        '大家好',
        '各位好',
        '在线的兄弟们好',
      ],
      victory: [
        '赢了！',
        '不错不错',
        '侥幸获胜',
      ],
      defeat: [
        '失败了...',
        '下次再来',
        '对手太强了',
      ],
      help: [
        '有人组队吗？',
        '求带',
        '一起做任务吗？',
      ],
      trade: [
        '收购XX资源',
        '出售XX装备',
        '有人换资源吗？',
      ],
    };
  }
  
  // 发送聊天
  async sendChat() {
    // 只有活跃和精英AI会聊天
    if (this.aiType === 'basic') return;
    
    const probability = {
      active: 0.1,  // 10%概率每小时
      elite: 0.3,   // 30%概率每小时
    };
    
    if (Math.random() < probability[this.aiType]) {
      const templates = this.getChatTemplates();
      const category = this.selectChatCategory();
      const message = this.randomChoice(templates[category]);
      
      await this.sendMessage(message);
    }
  }
}
```

### 4. 经济行为

**资源管理**：
```javascript
class AIPlayer {
  // 资源使用策略
  manageResources() {
    const resources = this.getResources();
    
    // 基础AI：随机使用
    if (this.aiType === 'basic') {
      if (resources.gold > 1000) {
        this.buyRandomItem();
      }
    }
    
    // 活跃AI：有计划使用
    if (this.aiType === 'active') {
      if (resources.gold > 2000) {
        this.upgradeEquipment();
      }
      if (resources.food > 5000) {
        this.recruitTroops();
      }
    }
    
    // 精英AI：优化使用
    if (this.aiType === 'elite') {
      const plan = this.calculateOptimalSpending();
      this.executeSpendingPlan(plan);
    }
  }
  
  // 交易行为
  async tradeResources() {
    // 只有活跃和精英AI参与交易
    if (this.aiType === 'basic') return;
    
    const market = await this.getMarketPrices();
    
    // 卖出多余资源
    const surplus = this.getSurplusResources();
    for (const [resource, amount] of Object.entries(surplus)) {
      if (amount > 1000) {
        await this.sellResource(resource, amount * 0.5);
      }
    }
    
    // 买入需要的资源
    const needed = this.getNeededResources();
    for (const [resource, amount] of Object.entries(needed)) {
      if (this.canAfford(resource, amount)) {
        await this.buyResource(resource, amount);
      }
    }
  }
}
```

---

## ⚙️ AI管理系统

### 1. 动态调整

**自动增减AI**：
```javascript
class AIManager {
  // 计算需要的AI数量
  calculateRequiredAI(server) {
    const totalCapacity = 500;
    const realPlayers = server.getRealPlayerCount();
    const currentAI = server.getAIPlayerCount();
    
    // 目标：保持服务器80%以上满员
    const targetTotal = Math.max(totalCapacity * 0.8, realPlayers);
    const requiredAI = targetTotal - realPlayers;
    
    return Math.max(0, requiredAI);
  }
  
  // 调整AI数量
  async adjustAIPlayers(server) {
    const required = this.calculateRequiredAI(server);
    const current = server.getAIPlayerCount();
    
    if (required > current) {
      // 增加AI
      const toAdd = required - current;
      await this.addAIPlayers(server, toAdd);
    } else if (required < current) {
      // 减少AI
      const toRemove = current - required;
      await this.removeAIPlayers(server, toRemove);
    }
  }
  
  // 添加AI玩家
  async addAIPlayers(server, count) {
    const distribution = this.calculateAIDistribution(server, count);
    
    for (const [factionId, aiCount] of Object.entries(distribution)) {
      for (let i = 0; i < aiCount; i++) {
        const aiType = this.selectAIType();
        const ai = await this.createAIPlayer(factionId, aiType);
        await server.addPlayer(ai);
      }
    }
  }
  
  // 移除AI玩家
  async removeAIPlayers(server, count) {
    // 优先移除基础AI
    const aiPlayers = server.getAIPlayers()
      .sort((a, b) => {
        const priority = { basic: 1, active: 2, elite: 3 };
        return priority[a.aiType] - priority[b.aiType];
      });
    
    for (let i = 0; i < count && i < aiPlayers.length; i++) {
      await server.removePlayer(aiPlayers[i]);
    }
  }
}
```

### 2. 势力平衡

**AI分配策略**：
```javascript
class AIManager {
  // 计算AI在各势力的分配
  calculateAIDistribution(server, totalAI) {
    const factions = server.getFactions();
    const distribution = {};
    
    for (const faction of factions) {
      const maxPlayers = faction.maxPlayers;
      const realPlayers = faction.getRealPlayerCount();
      const currentAI = faction.getAIPlayerCount();
      
      // 每个势力至少保持50%满员
      const minRequired = Math.max(maxPlayers * 0.5, realPlayers);
      const needed = minRequired - realPlayers - currentAI;
      
      distribution[faction.id] = Math.max(0, needed);
    }
    
    // 如果总数不够，按比例分配
    const totalNeeded = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (totalNeeded > totalAI) {
      const ratio = totalAI / totalNeeded;
      for (const factionId in distribution) {
        distribution[factionId] = Math.floor(distribution[factionId] * ratio);
      }
    }
    
    return distribution;
  }
}
```

### 3. 性能优化

**批量处理**：
```javascript
class AIManager {
  // 批量更新AI行为
  async updateAIBehaviors() {
    const aiPlayers = await this.getAllAIPlayers();
    
    // 分批处理，避免服务器压力
    const batchSize = 100;
    for (let i = 0; i < aiPlayers.length; i += batchSize) {
      const batch = aiPlayers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(ai => 
        this.updateAIBehavior(ai)
      ));
      
      // 批次间延迟
      await this.delay(1000);
    }
  }
  
  // 更新单个AI行为
  async updateAIBehavior(ai) {
    // 检查是否需要登录
    if (this.shouldLogin(ai)) {
      await ai.login();
      await ai.completeDailyTasks();
      await ai.manageBattles();
      await ai.manageResources();
      await ai.socialInteraction();
      await ai.logout();
    }
  }
  
  // 定时任务
  startScheduler() {
    // 每小时检查一次AI数量
    setInterval(() => {
      this.adjustAllServers();
    }, 60 * 60 * 1000);
    
    // 每10分钟更新一次AI行为
    setInterval(() => {
      this.updateAIBehaviors();
    }, 10 * 60 * 1000);
  }
}
```

---

## 📊 数据统计

### 1. AI效果监控

**关键指标**：
```javascript
class AIAnalytics {
  // 收集AI数据
  async collectAIMetrics() {
    return {
      // 数量统计
      totalAI: await this.getTotalAICount(),
      aiByType: await this.getAICountByType(),
      aiByFaction: await this.getAICountByFaction(),
      
      // 行为统计
      dailyLogins: await this.getAIDailyLogins(),
      tasksCompleted: await this.getAITasksCompleted(),
      battlesParticipated: await this.getAIBattles(),
      chatMessages: await this.getAIChatMessages(),
      
      // 经济统计
      resourcesGenerated: await this.getAIResourcesGenerated(),
      resourcesConsumed: await this.getAIResourcesConsumed(),
      tradesCompleted: await this.getAITrades(),
      
      // 性能统计
      cpuUsage: await this.getAICPUUsage(),
      memoryUsage: await this.getAIMemoryUsage(),
      responseTime: await this.getAIResponseTime(),
    };
  }
}
```

### 2. 真人玩家反馈

**收集反馈**：
```javascript
// 玩家问卷
const aiSurvey = {
  questions: [
    {
      id: 1,
      text: '你能区分AI玩家和真人玩家吗？',
      options: ['完全不能', '偶尔能', '经常能', '总是能'],
    },
    {
      id: 2,
      text: 'AI玩家对你的游戏体验有什么影响？',
      options: ['非常正面', '正面', '中立', '负面', '非常负面'],
    },
    {
      id: 3,
      text: '你希望AI玩家的数量？',
      options: ['更多', '保持现状', '更少', '完全移除'],
    },
  ],
};
```

---

## 🚀 实施计划

### 阶段1：基础AI（测试期）

**时间**：里程碑3-4

**目标**：
- 实现基础AI玩家
- 填充服务器人数
- 辅助测试

**功能**：
- ✅ AI玩家创建和管理
- ✅ 基础行为（登录、任务）
- ✅ 动态数量调整
- ✅ 简单战斗AI

**工作量**：2-3周

### 阶段2：活跃AI（公测期）

**时间**：里程碑5-6

**目标**：
- 实现活跃AI玩家
- 提供互动体验
- 活跃游戏氛围

**功能**：
- ✅ 复杂行为模式
- ✅ 聊天系统
- ✅ 资源交易
- ✅ PVE战斗

**工作量**：3-4周

### 阶段3：精英AI（正式运营）

**时间**：里程碑7+

**目标**：
- 实现精英AI玩家
- 提供竞争压力
- 填补高端空缺

**功能**：
- ✅ 高级战斗AI
- ✅ 策略决策
- ✅ PVP战斗
- ✅ 外交行为

**工作量**：4-6周

---

## 💡 最佳实践

### 1. 真实感设计

**关键原则**：
- ✅ AI行为要有随机性
- ✅ AI要有"人性化"的失误
- ✅ AI要有不同的"性格"
- ✅ AI要有合理的反应时间
- ❌ 不要让AI太完美
- ❌ 不要让AI行为太机械

### 2. 平衡性考虑

**避免问题**：
- ❌ AI不应该垄断资源
- ❌ AI不应该占据排行榜前列
- ❌ AI不应该影响真人竞争
- ✅ AI应该辅助而不是主导
- ✅ AI应该让真人有成就感

### 3. 透明度管理

**建议**：
- ✅ 在游戏公告中说明有AI玩家
- ✅ 说明AI的作用和目的
- ✅ 承诺AI不会影响公平性
- ❌ 不要在游戏内明显标识AI
- ❌ 不要让玩家感觉被欺骗

---

## 📝 总结

### 核心优势

1. **测试效率** - 小团队也能测试大规模游戏
2. **玩家体验** - 保证服务器活跃度
3. **成本控制** - 减少运营成本
4. **灵活调整** - 根据需求动态调整

### 注意事项

1. **不要过度依赖** - AI是辅助，不是替代
2. **保持真实感** - AI要像真人
3. **性能优化** - AI不应该消耗太多资源
4. **持续优化** - 根据反馈不断改进

### 成功标准

- ✅ 玩家难以区分AI和真人
- ✅ AI不影响游戏平衡
- ✅ AI提升游戏体验
- ✅ AI帮助测试和运营

---

**最后更新**：2026-02-06
**状态**：设计完成，待实施
