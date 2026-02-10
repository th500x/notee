# 聊天系统设计文档

## 📋 文档概述

本文档详细说明游戏中的聊天系统设计，采用古风命名，营造真实的三国氛围�?

---

## 🎯 核心概念

### 设计理念

**简洁实用，古风沉浸**�?
- �?只有2个频道，避免复杂
- �?古风命名，增强代入感
- �?低服务器压力
- �?防刷屏机�?

### 古风命名

| 现代名称 | 古风名称 | 说明 |
|---------|---------|------|
| 世界频道 | 天下 | 所有玩家可�?|
| 势力频道 | 军营 | 仅本势力可见 |
| 私聊 | 密语 | 玩家间单点联�?|
| 邮件 | 传书 | 异步消息系统 |
| 群发 | 传令 | 高级官职群发消息 |

---

## 💬 频道系统

### 1. 天下频道（世界频道）

**特点**�?
- 🌍 **全服可见** - 所有玩家都能看�?
- 📢 **公共交流** - 招募、交易、闲�?
- 🛡�?**防刷�?* - 发言冷却时间
- 👑 **等级限制** - 防止小号刷屏

**发言限制**�?
```javascript
{
  minLevel: 5,              // 最�?级才能发言
  cooldown: 30000,          // 30秒冷�?
  maxLength: 100,           // 最�?00�?
  dailyLimit: 50,           // 每天最�?0�?
  bannedWords: [...],       // 敏感词过�?
}
```

**消息格式**�?
```javascript
{
  id: 'msg_world_1738742400000',
  channel: 'world',
  from: {
    id: 'player_001',
    name: '玩家A',
    level: 15,
    faction: '刘备',
    position: '将军',      // 官职
    avatar: 'avatar_001.png',
  },
  content: '有人一起攻城吗�?,
  timestamp: 1738742400000,
  type: 'normal',           // normal/system/ai
}
```

**显示示例**�?
```
[天下] [刘备·将军] 玩家A (Lv.15)：有人一起攻城吗�?
[天下] [曹操·大将军] 玩家B (Lv.20)：我来！
[天下] [孙坚·校尉] 玩家C (Lv.12)：求组队�?
```

---

### 2. 军营频道（势力频道）

**特点**�?
- 🏛�?**势力专属** - 仅本势力成员可见
- 🤝 **内部交流** - 战术讨论、协�?
- 🤖 **AI参与** - AI君主会在此发言
- 📜 **任务通知** - 势力任务发布

**发言限制**�?
```javascript
{
  minLevel: 1,              // 无等级限�?
  cooldown: 10000,          // 10秒冷�?
  maxLength: 200,           // 最�?00�?
  dailyLimit: 200,          // 每天最�?00�?
  bannedWords: [...],       // 敏感词过�?
}
```

**消息格式**�?
```javascript
{
  id: 'msg_faction_1738742400000',
  channel: 'faction',
  factionId: 'faction_1101',
  from: {
    id: 'player_001',
    name: '玩家A',
    level: 15,
    position: '将军',
    avatar: 'avatar_001.png',
  },
  content: '今晚8点一起攻城！',
  timestamp: 1738742400000,
  type: 'normal',           // normal/system/ai/announcement
}
```

**显示示例**�?
```
[军营] [将军] 玩家A (Lv.15)：今�?点一起攻城！
[军营] [校尉] 玩家B (Lv.12)：收到！
[军营] 【刘备】：诸位将士辛苦了！（AI发言�?
[军营] 【系统】：新任务发布：攻占邺城
```

---

### 3. 密语系统（私聊）

**特点**�?
- 🔒 **私密对话** - 仅双方可�?
- 💬 **单点联系** - 一对一交流
- 📝 **历史记录** - 保存聊天记录
- 🚫 **屏蔽功能** - 可屏蔽骚扰玩�?

**发言限制**�?
```javascript
{
  minLevel: 3,              // 最�?�?
  cooldown: 5000,           // 5秒冷�?
  maxLength: 200,           // 最�?00�?
  dailyLimit: 500,          // 每天最�?00�?
  bannedWords: [...],       // 敏感词过�?
}
```

**消息格式**�?
```javascript
{
  id: 'msg_private_1738742400000',
  channel: 'private',
  from: 'player_001',
  to: 'player_002',
  content: '一起组队吗�?,
  timestamp: 1738742400000,
  read: false,              // 是否已读
}
```

**显示示例**�?
```
[密语] 玩家A �?你：一起组队吗�?
[密语] �?�?玩家A：好的！
```

---

## 📮 传书系统（邮件）

### 传书类型


| 类型 | 发送�?| 用�?| 附件 |
|------|--------|------|------|
| 系统传书 | 系统 | 系统通知、公�?| 可能�?|
| 君主传书 | AI君主 | 任务、奖励、闲�?| 可能�?|
| 玩家传书 | 玩家 | 玩家间异步消�?| 可能�?|
| 传令 | 高级官职 | 群发消息 | �?|

### 传书数据结构

```javascript
{
  id: 'mail_1738742400000',
  type: 'lord',             // system/lord/player/broadcast
  
  // 发送�?
  from: {
    id: 'ai_lord_s1_0001',
    name: '刘备',
    avatar: 'liubei.png',
    title: '刘皇�?,
  },
  
  // 接收�?
  to: ['player_001', 'player_002', ...],  // 可以是多�?
  
  // 内容
  title: '新任务发�?,
  content: '诸位将士：邺城空虚，正是攻城良机！速来参与�?,
  
  // 附件（奖励）
  attachments: {
    gold: 5000,
    gems: 500,
    items: ['item_weapon_0001'],
    exp: 3000,
  },
  
  // 状�?
  timestamp: 1738742400000,
  expiryDate: 1739347200000,  // 7天后过期
  read: false,
  claimed: false,             // 附件是否已领�?
  
  // 分类
  category: 'quest',          // quest/reward/announcement/chat
}
```

### 传书界面

**收件�?*�?
```
【未读】刘备：新任务发�?[附件] (2小时�?
【未读】系统：排名奖励 [附件] (5小时�?
【已读】玩家A：交易请�?(昨天)
【已读】曹操：势力公告 (2天前)
```

**传书详情**�?
```
━━━━━━━━━━━━━━━━━━━━━━
发件人：刘备（刘皇叔�?
收件人：全体将士
时间�?026�?�?�?08:00

【新任务发布�?

诸位将士�?

邺城空虚，正是攻城良机！
速来参与，建功立业！

附件�?
- 金币 +5000
- 宝石 +500
- 青龙偃月刀 ×1
- 经验 +3000

[领取附件] [回复] [删除]
━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📢 传令系统（群发）

### 权限要求

**可使用传令的官职**�?
- 大将军（�?名）- 可传令全势力
- 将军（第2-5名）- 可传令全势力
- 校尉（第6-20名）- 可传令本部（仅校尉及以下�?

### 传令限制

```javascript
{
  // 大将�?将军
  general: {
    cooldown: 3600000,      // 1小时冷却
    maxLength: 300,         // 最�?00�?
    dailyLimit: 5,          // 每天最�?�?
    recipients: 'all',      // 全势�?
  },
  
  // 校尉
  captain: {
    cooldown: 7200000,      // 2小时冷却
    maxLength: 200,         // 最�?00�?
    dailyLimit: 3,          // 每天最�?�?
    recipients: 'subordinates',  // 仅下�?
  },
}
```

### 传令格式

**发送传�?*�?
```javascript
function sendBroadcast(sender, content) {
  // 检查权�?
  if (!hasPermission(sender, 'broadcast')) {
    return { error: '权限不足' };
  }
  
  // 检查冷�?
  if (isOnCooldown(sender, 'broadcast')) {
    return { error: '冷却�? };
  }
  
  // 获取接收者列�?
  const recipients = getRecipients(sender);
  
  // 创建传书
  const mail = {
    id: `mail_broadcast_${Date.now()}`,
    type: 'broadcast',
    from: {
      id: sender.id,
      name: sender.name,
      position: sender.position,
    },
    to: recipients,
    title: `【传令�?{sender.position} ${sender.name}`,
    content: content,
    timestamp: Date.now(),
    expiryDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    category: 'announcement',
  };
  
  // 批量发�?
  sendBatchMails(mail);
  
  // 同时在军营频道公�?
  sendToFactionChannel({
    channel: 'faction',
    from: sender,
    content: `【传令�?{content}`,
    type: 'announcement',
  });
  
  return { success: true };
}
```

**显示示例**�?
```
[军营] 【传令】[大将军] 玩家A：今�?点集合，攻打邺城！所有人务必参加�?
```

---

## 🛡�?防刷屏机�?

### 冷却系统

```javascript
const cooldownConfig = {
  world: {
    normal: 30000,          // 普通玩�?0�?
    vip: 15000,             // VIP玩家15�?
    official: 10000,        // 官职玩家10�?
  },
  faction: {
    normal: 10000,          // 普通玩�?0�?
    vip: 5000,              // VIP玩家5�?
    official: 3000,         // 官职玩家3�?
  },
  private: {
    normal: 5000,           // 普通玩�?�?
    vip: 3000,              // VIP玩家3�?
  },
};

function checkCooldown(playerId, channel) {
  const lastMessage = getLastMessage(playerId, channel);
  if (!lastMessage) return true;
  
  const elapsed = Date.now() - lastMessage.timestamp;
  const cooldown = getCooldown(playerId, channel);
  
  return elapsed >= cooldown;
}
```

### 敏感词过�?

```javascript
const bannedWords = [
  // 政治敏感�?
  '...',
  
  // 广告�?
  '加微�?, '加QQ', '外挂', '代练',
  
  // 辱骂�?
  '...',
];

function filterContent(content) {
  let filtered = content;
  
  bannedWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  });
  
  return filtered;
}
```

### 频率限制

```javascript
const rateLimits = {
  world: {
    perMinute: 2,           // 每分钟最�?�?
    perHour: 20,            // 每小时最�?0�?
    perDay: 50,             // 每天最�?0�?
  },
  faction: {
    perMinute: 5,           // 每分钟最�?�?
    perHour: 50,            // 每小时最�?0�?
    perDay: 200,            // 每天最�?00�?
  },
  private: {
    perMinute: 10,          // 每分钟最�?0�?
    perHour: 100,           // 每小时最�?00�?
    perDay: 500,            // 每天最�?00�?
  },
};

function checkRateLimit(playerId, channel) {
  const messages = getRecentMessages(playerId, channel);
  
  // 检查每分钟
  const lastMinute = messages.filter(m => 
    Date.now() - m.timestamp < 60000
  );
  if (lastMinute.length >= rateLimits[channel].perMinute) {
    return { allowed: false, reason: '发言过快，请稍后再试' };
  }
  
  // 检查每小时
  const lastHour = messages.filter(m => 
    Date.now() - m.timestamp < 3600000
  );
  if (lastHour.length >= rateLimits[channel].perHour) {
    return { allowed: false, reason: '发言次数已达上限（每小时�? };
  }
  
  // 检查每�?
  const today = messages.filter(m => 
    Date.now() - m.timestamp < 86400000
  );
  if (today.length >= rateLimits[channel].perDay) {
    return { allowed: false, reason: '发言次数已达上限（今日）' };
  }
  
  return { allowed: true };
}
```

---

## 🎨 UI设计

### 聊天窗口布局

```
┌─────────────────────────────────────�?
�?[天下] [军营] [密语(3)] [传书(5)]    �? �?标签�?
├─────────────────────────────────────�?
�?                                    �?
�? [刘备·将军] 玩家A (Lv.15)          �?
�? 有人一起攻城吗�?                   �?
�? (2分钟�?                          �?
�?                                    �?
�? [曹操·大将军] 玩家B (Lv.20)        �?
�? 我来�?                            �?
�? (1分钟�?                          �?
�?                                    �?
�? 【刘备】诸位将士辛苦了�?           �?
�? (刚刚)                             �?
�?                                    �?
├─────────────────────────────────────�?
�?[输入框]                      [发送] �?
�?冷却�?5�?                         �?
└─────────────────────────────────────�?
```

### 传书界面

```
┌─────────────────────────────────────�?
�?传书                          [写信] �?
├─────────────────────────────────────�?
�?📮 收件�?(5)                       �?
�?📤 发件�?                          �?
�?�?重要                             �?
�?🗑�?已删�?                          �?
├─────────────────────────────────────�?
�?✉️ [未读] 刘备：新任务发布 [附件]   �?
�?   2小时�?                         �?
�?                                    �?
�?✉️ [未读] 系统：排名奖�?[附件]     �?
�?   5小时�?                         �?
�?                                    �?
�?📭 [已读] 玩家A：交易请�?          �?
�?   昨天                             �?
�?                                    �?
�?📭 [已读] 曹操：势力公�?           �?
�?   2天前                            �?
└─────────────────────────────────────�?
```

---

## 💾 数据存储

### 消息存储策略

**实时消息**（Redis）：
```javascript
// 天下频道：保留最�?00�?
redis.lpush('chat:world', message);
redis.ltrim('chat:world', 0, 99);

// 军营频道：保留最�?00�?
redis.lpush(`chat:faction:${factionId}`, message);
redis.ltrim(`chat:faction:${factionId}`, 0, 199);

// 密语：保留最�?0�?
redis.lpush(`chat:private:${userId}`, message);
redis.ltrim(`chat:private:${userId}`, 0, 49);
```

**历史消息**（数据库）：
```javascript
// 定期归档到数据库（每小时�?
schedule.scheduleJob('0 * * * *', async () => {
  // 归档天下频道
  const worldMessages = await redis.lrange('chat:world', 0, -1);
  await db.messages.insertMany(worldMessages);
  
  // 归档军营频道
  for (const faction of factions) {
    const messages = await redis.lrange(`chat:faction:${faction.id}`, 0, -1);
    await db.messages.insertMany(messages);
  }
  
  // 清理Redis（保留最近的�?
  // ...
});
```

**传书存储**（数据库）：
```javascript
// 传书永久保存（直到玩家删除）
await db.mails.insertOne({
  id: mail.id,
  type: mail.type,
  from: mail.from,
  to: mail.to,
  title: mail.title,
  content: mail.content,
  attachments: mail.attachments,
  timestamp: mail.timestamp,
  expiryDate: mail.expiryDate,
  read: false,
  claimed: false,
  deleted: false,
});
```

---

## 🔧 技术实�?

### 聊天系统架构

```
客户�?
    �?WebSocket连接
聊天服务�?
    �?
├─ 消息验证（权限、冷却、敏感词�?
├─ 消息分发（广�?单播�?
├─ 消息存储（Redis + 数据库）
└─ 在线状态管�?
```

### WebSocket实现

```javascript
// 服务器端
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  const playerId = socket.handshake.auth.playerId;
  
  // 加入势力房间
  const player = getPlayer(playerId);
  socket.join(`faction:${player.factionId}`);
  
  // 监听消息
  socket.on('chat:world', async (data) => {
    // 验证
    const validation = await validateMessage(playerId, 'world', data.content);
    if (!validation.allowed) {
      socket.emit('chat:error', validation.reason);
      return;
    }
    
    // 过滤敏感�?
    const filtered = filterContent(data.content);
    
    // 创建消息
    const message = {
      id: `msg_world_${Date.now()}`,
      channel: 'world',
      from: getPlayerInfo(playerId),
      content: filtered,
      timestamp: Date.now(),
      type: 'normal',
    };
    
    // 存储
    await saveMessage(message);
    
    // 广播
    io.emit('chat:world', message);
  });
  
  socket.on('chat:faction', async (data) => {
    // 类似处理
    // ...
    
    // 广播到势力房�?
    io.to(`faction:${player.factionId}`).emit('chat:faction', message);
  });
  
  socket.on('chat:private', async (data) => {
    // 类似处理
    // ...
    
    // 发送给目标玩家
    io.to(data.targetId).emit('chat:private', message);
  });
});
```

### 客户端实�?

```javascript
// 客户�?
const socket = io('wss://game.server.com', {
  auth: {
    playerId: currentPlayer.id,
    token: authToken,
  },
});

// 监听消息
socket.on('chat:world', (message) => {
  displayMessage('world', message);
});

socket.on('chat:faction', (message) => {
  displayMessage('faction', message);
});

socket.on('chat:private', (message) => {
  displayMessage('private', message);
  showNotification(`${message.from.name}发来密语`);
});

// 发送消�?
function sendMessage(channel, content) {
  socket.emit(`chat:${channel}`, {
    content: content,
  });
}
```

---

## 📊 性能优化

### 服务器压力分�?


**假设**�?00人同时在�?

| 场景 | 频率 | 压力 |
|------|------|------|
| 天下频道 | 每分钟约10�?| �?�?|
| 军营频道 | 每分钟约30条（7个势力） | �?�?|
| 密语 | 每分钟约50�?| �?�?|
| AI闲聊 | �?0分钟�?-3�?| 极低 �?|

**总计**：每分钟�?0条消息，对于2�?G服务器完全无压力�?

### 优化策略

1. **消息批量处理**
```javascript
// 批量广播（减少网络开销�?
const messageBatch = [];
setInterval(() => {
  if (messageBatch.length > 0) {
    io.emit('chat:batch', messageBatch);
    messageBatch.length = 0;
  }
}, 1000);  // 每秒批量发送一�?
```

2. **Redis缓存**
```javascript
// 最近消息缓存在Redis
// 避免频繁查询数据�?
const recentMessages = await redis.lrange('chat:world', 0, 99);
```

3. **消息压缩**
```javascript
// 压缩历史消息
const compressed = zlib.gzipSync(JSON.stringify(messages));
await db.messages.insertOne({
  data: compressed,
  compressed: true,
});
```

4. **分片存储**
```javascript
// 按日期分片存�?
const collection = `messages_${getDateString()}`;
await db[collection].insertOne(message);
```

---

## 🎮 玩家体验

### 天下频道示例

```
[天下] [刘备·大将军] 龙腾天下 (Lv.25)：招募高手一起攻城！
[天下] [曹操·将军] 霸王之志 (Lv.22)：我来！
[天下] [孙坚·校尉] 江东小霸�?(Lv.18)：求组队�?
[天下] [系统]：恭喜【龙腾天下】成功攻占邺城！
[天下] [袁绍·将军] 四世三公 (Lv.20)：厉害！
```

### 军营频道示例

```
[军营] [大将军] 龙腾天下 (Lv.25)：今�?点集合攻城！
[军营] [将军] 关云�?(Lv.23)：收到！
[军营] [校尉] 张翼�?(Lv.21)：俺也来�?
[军营] 【刘备】：诸位将士辛苦了！
[军营] 【系统】：新任务发布：攻占邺城
[军营] 【传令】[大将军] 龙腾天下：所有人务必参加�?
```

### 密语示例

```
[密语] 龙腾天下 �?你：一起组队吗�?
[密语] �?�?龙腾天下：好的！什么时候？
[密语] 龙腾天下 �?你：今晚8�?
[密语] �?�?龙腾天下：没问题�?
```

### 传书示例

```
━━━━━━━━━━━━━━━━━━━━━━
发件人：刘备（刘皇叔�?
收件人：全体将士
时间�?026�?�?�?08:00

【新任务发布�?

诸位将士�?

邺城空虚，正是攻城良机！
速来参与，建功立业！

附件�?
- 金币 +5000
- 宝石 +500
- 青龙偃月刀 ×1
- 经验 +3000

[已领取] [回复] [删除]
━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔐 安全机制

### 1. 权限验证

```javascript
function checkPermission(playerId, action) {
  const player = getPlayer(playerId);
  
  switch (action) {
    case 'chat:world':
      return player.level >= 5;
    
    case 'chat:faction':
      return player.factionId !== null;
    
    case 'chat:private':
      return player.level >= 3;
    
    case 'broadcast':
      return ['大将�?, '将军', '校尉'].includes(player.position);
    
    default:
      return false;
  }
}
```

### 2. 防刷�?

```javascript
// 检测重复消�?
function detectSpam(playerId, content) {
  const recentMessages = getRecentMessages(playerId, 5);
  
  // 检测完全相同的消息
  const duplicates = recentMessages.filter(m => m.content === content);
  if (duplicates.length >= 2) {
    return { isSpam: true, reason: '请勿重复发送相同消�? };
  }
  
  // 检测相似消息（编辑距离�?
  const similar = recentMessages.filter(m => 
    levenshteinDistance(m.content, content) < 5
  );
  if (similar.length >= 3) {
    return { isSpam: true, reason: '请勿重复发送相似消�? };
  }
  
  return { isSpam: false };
}
```

### 3. 举报系统

```javascript
function reportMessage(reporterId, messageId, reason) {
  const report = {
    id: `report_${Date.now()}`,
    reporter: reporterId,
    message: messageId,
    reason: reason,
    timestamp: Date.now(),
    status: 'pending',
  };
  
  // 保存举报
  db.reports.insertOne(report);
  
  // 自动处理（如果举报次数过多）
  const reports = db.reports.find({ message: messageId });
  if (reports.length >= 5) {
    // 自动禁言
    mutePlayer(message.from.id, 3600000);  // 禁言1小时
    
    // 删除消息
    deleteMessage(messageId);
    
    // 通知管理�?
    notifyAdmin(report);
  }
}
```

### 4. 禁言系统

```javascript
function mutePlayer(playerId, duration) {
  const mute = {
    playerId: playerId,
    startTime: Date.now(),
    endTime: Date.now() + duration,
    reason: '违反聊天规则',
  };
  
  // 保存禁言记录
  db.mutes.insertOne(mute);
  
  // 通知玩家
  sendMail(playerId, {
    from: '系统',
    title: '禁言通知',
    content: `你因违反聊天规则被禁言${duration / 60000}分钟`,
  });
}

function isMuted(playerId) {
  const mute = db.mutes.findOne({
    playerId: playerId,
    endTime: { $gt: Date.now() },
  });
  
  return mute !== null;
}
```

---

## 📝 配置示例

### 聊天系统配置

```javascript
// src/systems/chatConfig.js

export const CHAT_CONFIG = {
  // 频道配置
  channels: {
    world: {
      name: '天下',
      icon: '🌍',
      minLevel: 5,
      cooldown: 30000,
      maxLength: 100,
      dailyLimit: 50,
      color: '#FFD700',
    },
    faction: {
      name: '军营',
      icon: '🏛�?,
      minLevel: 1,
      cooldown: 10000,
      maxLength: 200,
      dailyLimit: 200,
      color: '#FF6B6B',
    },
    private: {
      name: '密语',
      icon: '💬',
      minLevel: 3,
      cooldown: 5000,
      maxLength: 200,
      dailyLimit: 500,
      color: '#4ECDC4',
    },
  },
  
  // 传书配置
  mail: {
    name: '传书',
    icon: '📮',
    maxInbox: 100,
    expiryDays: 7,
    maxAttachments: 10,
  },
  
  // 传令配置
  broadcast: {
    name: '传令',
    icon: '📢',
    positions: ['大将�?, '将军', '校尉'],
    cooldown: {
      大将�? 3600000,
      将军: 3600000,
      校尉: 7200000,
    },
    dailyLimit: {
      大将�? 5,
      将军: 5,
      校尉: 3,
    },
  },
  
  // 敏感词配�?
  filter: {
    enabled: true,
    bannedWords: [
      // 政治敏感�?
      // ...
      
      // 广告�?
      '加微�?, '加QQ', '外挂', '代练',
      
      // 辱骂�?
      // ...
    ],
    replacement: '***',
  },
  
  // 防刷屏配�?
  antiSpam: {
    enabled: true,
    duplicateThreshold: 2,
    similarityThreshold: 5,
    autoMuteDuration: 3600000,  // 1小时
  },
};
```

---

## 🚀 实现步骤

### 阶段1：基础功能

1. �?天下频道
2. �?军营频道
3. �?密语系统
4. �?传书系统

### 阶段2：增强功�?

1. �?传令系统
2. �?敏感词过�?
3. �?防刷屏机�?
4. �?冷却系统

### 阶段3：安全功�?

1. �?举报系统
2. �?禁言系统
3. �?权限验证
4. �?日志记录

### 阶段4：优化完�?

1. �?性能优化
2. �?消息压缩
3. �?批量处理
4. �?历史归档

---

## 📚 相关文档

- [AI系统](./AI_SYSTEM.md) - AI闲聊功能
- [势力系统](./FACTION_SYSTEM.md) - 势力频道基础
- [架构文档](./ARCHITECTURE.md) - 系统架构

---

## 🎓 总结

### 核心特�?

- 💬 **2个频�?* - 天下、军营，简洁实�?
- 🔒 **密语系统** - 玩家间私密交�?
- 📮 **传书系统** - 异步消息，古风命�?
- 📢 **传令系统** - 高级官职群发消息
- 🛡�?**防刷�?* - 冷却、频率限制、敏感词过滤
- 🔐 **安全机制** - 举报、禁言、权限验�?

### 古风命名

- 天下（世界频道）
- 军营（势力频道）
- 密语（私聊）
- 传书（邮件）
- 传令（群发）

### 服务器压�?

- �?**极低压力** - 每分钟约90条消�?
- �?**WebSocket** - 实时通信
- �?**Redis缓存** - 快速读�?
- �?**批量处理** - 减少开销

### 实现难度

- ⭐⭐ **简�?* - 标准聊天系统
- WebSocket + Redis + 数据�?
- 防刷屏和安全机制是重�?

---

**最后更�?*�?026-02-05
**文档版本**：v1.0.0
