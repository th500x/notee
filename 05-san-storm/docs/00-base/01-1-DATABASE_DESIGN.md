# 数据库设计指导文档

**版本**: v1.4.4  
**创建日期**: 2026-03-07  
**最后更新**: 2026-03-29  
**状态**: 已确定

---

## 📋 文档概述

本文档定义《三国风云》游戏的完整数据库架构设计，包括MySQL表结构、Redis缓存策略、数值存储规范和实施计划。

**设计目标**：
- 🚀 **高性能** - 支持高并发访问和快速响应
- 📊 **可扩展** - 支持未来功能扩展和数据增长
- 🔒 **数据安全** - 确保数据完整性和安全性
- 💰 **成本优化** - 合理使用资源，控制成本
- 🔧 **易维护** - 清晰的结构，便于开发和维护

**核心方案**：MySQL + Redis（推荐⭐⭐⭐⭐⭐）
- 阶段1（MVP）：纯MySQL - 快速开发，验证核心功能
- 阶段2（优化）：引入Redis - 性能优化，提升用户体验
- 阶段3（扩展）：读写分离、分库分表 - 支持大规模用户

---

## 📚 目录

1. [架构设计](#1️⃣-架构设计)
2. [数值存储规范](#2️⃣-数值存储规范)
3. [MySQL表结构设计](#3️⃣-mysql表结构设计)
4. [Redis缓存策略](#4️⃣-redis缓存策略)
5. [数据访问层设计](#5️⃣-数据访问层设计)
6. [性能优化方案](#6️⃣-性能优化方案)
7. [数据迁移方案](#7️⃣-数据迁移方案)
8. [实施计划](#8️⃣-实施计划)

---


## 1️⃣ 架构设计

### 1.1 方案对比

| 方案 | 优势 | 劣势 | 推荐度 | 适用场景 |
|------|------|------|--------|---------|
| **纯MySQL** | 简单、成本低、易维护 | 高并发性能有限 | ⭐⭐⭐ | MVP阶段、小规模用户 |
| **MySQL + Redis** | 高性能、灵活、成熟 | 需要维护两个系统 | ⭐⭐⭐⭐⭐ | 推荐方案 |
| **MongoDB** | 灵活schema、易扩展 | 事务支持弱、学习成本高 | ⭐⭐⭐ | 不推荐 |
| **PostgreSQL** | 功能强大、JSON支持好 | 配置复杂、资源占用高 | ⭐⭐⭐⭐ | 可选方案 |

### 1.2 推荐架构：MySQL + Redis

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端层                              │
│                    (React + Vite)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API层                                │
│                    (Node.js + Express)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  路由层 → 业务逻辑层 → 数据访问层                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│      Redis缓存层           │   │      MySQL持久层           │
│  ┌─────────────────────┐  │   │  ┌─────────────────────┐  │
│  │ 玩家在线数据         │  │   │  │ 玩家基础数据         │  │
│  │ 战斗临时数据         │  │   │  │ 配置数据             │  │
│  │ 排行榜数据           │  │   │  │ 战斗记录             │  │
│  │ 会话数据             │  │   │  │ 统计数据             │  │
│  └─────────────────────┘  │   │  └─────────────────────┘  │
└───────────────────────────┘   └───────────────────────────┘
```

### 1.3 数据分层策略

**热数据（Redis）**：
- 玩家在线状态
- 当前战斗数据
- 实时排行榜
- 会话信息

**温数据（MySQL + Redis）**：
- 玩家基础信息
- 装备和卡牌数据
- 任务进度

**冷数据（MySQL）**：
- 历史战斗记录
- 统计数据
- 日志数据

---


## 2️⃣ 数值存储规范

### 2.1 核心原则

**"整数存储，小数显示"方案**：
- 💾 **存储层**：整数（×10）
- 🧮 **计算层**：整数运算
- 🎨 **显示层**：小数（÷10）

**优势**：
- ✅ 避免浮点精度问题（0.1+0.2≠0.3）
- ✅ 整数运算更快更可靠
- ✅ 数据库索引效率更高
- ✅ 便于调试和数据验证

### 2.2 适用范围

**需要小数显示的属性（×10存储）**：

| 属性类型 | 存储倍数 | 示例存储值 | 显示值 | 说明 |
|---------|---------|-----------|--------|------|
| 攻击力 | ×10 | 155 | 15.5 | 部队基础攻击 |
| 防御力 | ×10 | 102 | 10.2 | 部队基础防御 |
| 将领运气 | ×10 | 68 | 6.8 | 将领属性 |
| 将领勇气 | ×10 | 91 | 9.1 | 将领属性 |
| 将领武力 | ×10 | 95 | 9.5 | 将领属性 |
| 将领统帅 | ×10 | 88 | 8.8 | 将领属性 |
| 将领智力 | ×10 | 76 | 7.6 | 将领属性 |
| 将领政治 | ×10 | 65 | 6.5 | 将领属性 |
| 将领魅力 | ×10 | 82 | 8.2 | 将领属性 |
| 将领速度 | ×10 | 73 | 7.3 | 将领属性 |

**保持整数的属性（×1存储）**：

| 属性类型 | 存储倍数 | 示例存储值 | 显示值 | 说明 |
|---------|---------|-----------|--------|------|
| 兵力数量 | ×1 | 200 | 200 | 部队兵力 |
| 移速 | ×1 | 4 | 4 | 移动格数 |
| 攻击范围 | ×1 | 3 | 3 | 攻击距离 |
| HP | ×1 | 500 | 500 | 建筑生命值 |
| 回合数 | ×1 | 10 | 10 | 战斗回合 |
| 资源数量 | ×1 | 1000 | 1000 | 粮草、银两 |

### 2.3 数值转换工具类

```javascript
/**
 * 数值转换工具类
 */
class NumericConverter {
  /**
   * 存储值转显示值（÷10）
   */
  static toDisplay(storageValue) {
    return storageValue / 10;
  }
  
  /**
   * 显示值转存储值（×10）
   */
  static toStorage(displayValue) {
    return Math.round(displayValue * 10);
  }
  
  /**
   * 格式化显示（保留1位小数）
   */
  static format(storageValue) {
    return (storageValue / 10).toFixed(1);
  }
  
  /**
   * 批量转换（用于API响应）
   */
  static convertToDisplay(data, fields) {
    const result = { ...data };
    fields.forEach(field => {
      if (result[field] !== undefined) {
        result[field] = this.toDisplay(result[field]);
      }
    });
    return result;
  }
}

module.exports = NumericConverter;
```

---


## 3️⃣ MySQL表结构设计

### 3.1 表设计概览

```
数据库：05_san_storm

按数据归属分为4个级别：

=== 账号级别（3张）===
说明：跨赛季，跟人走。仅"删除"按钮起效（彻底删除账号时才清除）
├── accounts              # 账号表
├── memorial_images       # 纪念图表（关键节点、每日生涯、战斗纪念）
└── season_inheritances   # 赛季继承表（跨服务器）

=== 玩家级别（11张）===
说明：玩家独有数据。"清除"和"删除"按钮都起效
├── players               # 玩家角色表
├── player_cards          # 玩家卡牌表（部队、将领、装备、道具）
├── player_garrison      # 玩家驻守配置表
├── player_progress       # 玩家进度表（新手引导、称号、成就、战役）
├── player_events         # 玩家事件进度表（7种事件类型）
├── player_synthesis      # 装备合成表（保底+统计+历史）
├── statistics            # 统计数据表
├── season_records        # 赛季统计表（与服务器绑定）
├── temp_character_creation # 角色创建进度表（临时数据，角色创建完成后删除）
├── temp_ranking_snapshots  # 活动排名快照表（临时数据，14天过期）
└── temp_card_pool_draws    # 卡池抽取记录表（临时数据，14天过期）

=== 势力/世界级别（10张）===
说明：不属于某个玩家，属于赛季世界。玩家被清除/删除后，相关引用显示"未知玩家"
├── factions              # 势力运行时数据表
├── cities                # 城市数据表
├── legions               # 军团表
├── legion_members        # 军团成员表（player_id ON DELETE SET NULL）
├── texts                 # 传书表（邮件系统，sender_id ON DELETE SET NULL）
├── chats                 # 聊天表（实时通信，sender_id ON DELETE SET NULL）
├── battles               # 战斗记录表（player_id ON DELETE SET NULL）
├── wars                  # 战事表（势力对抗）
├── raids                 # 讨伐表（联合对抗AI势力）
└── ai_players            # AI玩家配置表

=== 配置表（14张）===
├── config_servers        # 服务器配置表
├── config_factions       # 势力配置表
├── config_characters     # 将领配置表
├── config_troops         # 部队配置表
├── config_skills         # 技能配置表
├── config_bonds          # 羁绊配置表
├── config_positions      # 官职配置表
├── config_equipment      # 装备配置表
├── config_titles         # 称号配置表
├── config_achievements   # 成就配置表
├── config_items          # 道具配置表（事件链钥匙）
├── config_events         # 事件配置表
├── config_formations     # 阵型配置表
└── config_texts          # 传书/系统邮件模板配置表（实例化写入 texts）

```

### 3.1.1 管理员操作与表级别对应关系

| 操作 | 账号级别（3张） | 玩家级别（10张） | 势力/世界级别（10张） |
|------|:---:|:---:|:---:|
| **清除** | 不动 | 删除数据 | player_id 设为 NULL，前端显示"未知玩家" |
| **删除** | 删除数据 | 删除数据（CASCADE） | player_id 设为 NULL，前端显示"未知玩家" |
| **封禁** | 修改 status='banned' | 不动 | 不动 |

### 3.2 核心表结构

#### 3.2.1 账号表 (accounts)

**表名**: `accounts`  
**说明**: 存储账号的基础信息，不包含游戏内数据。测试和正式赛季通用。

```sql
CREATE TABLE accounts (
  id VARCHAR(4) PRIMARY KEY COMMENT '用户ID（4位随机字符，36进制；AI玩家格式：A+3位字符）',
  password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密存储）',
  birthMonth TINYINT NOT NULL COMMENT '生日月份（1-12，用于生日礼物）',
  
  serverId VARCHAR(20) NOT NULL COMMENT '服务器ID',
  
  -- 账号类型
  account_type ENUM('real', 'ai') NOT NULL DEFAULT 'real' COMMENT '账号类型（real=真人玩家，ai=AI玩家）',
  
  -- 赛季系统（账号级别）
  current_season VARCHAR(50) COMMENT '当前所在赛季（如san_1=黄巾之乱、san_2=董卓之乱）',
  participated_seasons JSON COMMENT '参与过的赛季列表（如["san_0_m2","san_0_m3","san_1","san_2"]）',
  
  -- 战令系统（赛季通行证）
  hasPremium BOOLEAN NOT NULL DEFAULT FALSE COMMENT '当前赛季是否购买战令',
  
  province VARCHAR(50) NULL COMMENT '省份（通过IP自动推断）',
  city VARCHAR(50) NULL COMMENT '城市（通过IP自动推断）',
  clientIP VARCHAR(45) NOT NULL COMMENT 'IP地址（支持IPv6）',
  
  machineId VARCHAR(64) NOT NULL COMMENT '机器指纹（防重复注册）',
  
  status ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active' COMMENT '账号状态',
  banReason TEXT NULL COMMENT '封禁原因（仅banned时有值）',
  banUntil DATETIME NULL COMMENT '封禁到期时间（仅banned时有值）',
  
  registeredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  lastLoginAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
  lastActiveAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后活跃时间',
  loginCount INT NOT NULL DEFAULT 0 COMMENT '登录次数',
  
  -- 索引
  UNIQUE INDEX idx_machine_id (machineId),
  UNIQUE INDEX idx_client_ip (clientIP),
  INDEX idx_server_id (serverId),
  INDEX idx_status (status),
  INDEX idx_birth_month (birthMonth),
  INDEX idx_last_active (lastActiveAt),
  INDEX idx_current_season (current_season),
  INDEX idx_account_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `id` | 用户ID | 4位随机字符，从预生成批次中选择（36^4=1,679,616种组合） |
| `password` | 密码 | bcrypt加密，不存储明文，最少6位 |
| `birthMonth` | 生日月份 | 1-12，必填，用于每月自动发放生日礼物 |
| `serverId` | 服务器ID | 用户选择的服务器（如S1-01） |
| `current_season` | 当前所在赛季 | 如san_1=黄巾之乱、san_2=董卓之乱 |
| `participated_seasons` | 参与过的赛季列表 | JSON数组，记录所有参与过的赛季 |
| `hasPremium` | 当前赛季是否购买战令 | 布尔值，赛季切换时重置为false |
| `province` | 省份 | 通过IP自动获取，可为空 |
| `city` | 城市 | 通过IP自动获取，可为空 |
| `clientIP` | IP地址 | 支持IPv4和IPv6 |
| `machineId` | 机器指纹 | 唯一索引，防止重复注册 |
| `status` | 账号状态 | active/inactive/banned |
| `banReason` | 封禁原因 | 仅banned时有值 |
| `banUntil` | 封禁到期 | 仅banned时有值 |
| `registeredAt` | 注册时间 | 自动生成 |
| `lastLoginAt` | 最后登录 | 每次登录更新 |
| `lastActiveAt` | 最后活跃 | 每次操作更新 |
| `loginCount` | 登录次数 | 累计登录次数 |

**业务规则**：

1. **账号注册**：
   - ID从预生成的批次中随机选择
   - **防重复注册（双重验证）**：
     - ✅ 机器指纹唯一性检查（基于：语言、色深、分辨率、时区、CPU核心数、Canvas）
     - ✅ IP地址唯一性检查
     - ⚠️ 任何一个重复即禁止注册
     - 🚫 无时间限制，永久生效
   - 必须选择生日月份（1-12月）
   - 省份和城市通过IP自动获取

2. **机器指纹组成**（改进版 - 最稳定）：
   - `navigator.language` - 浏览器语言（稳定）
   - `screen.colorDepth` - 色深（稳定）
   - `screen.width × screen.height` - 屏幕分辨率（较稳定）
   - `timezone` - 时区（稳定）
   - `navigator.hardwareConcurrency` - CPU核心数（稳定）
   - ❌ 不使用 `userAgent`（浏览器升级会变化）
   - ❌ 不使用 `canvas fingerprint`（重启后可能变化，受硬件加速影响）
   - ❌ 不使用 `navigator.platform`（已弃用的API）

3. **防重复注册策略**：
   - 同一机器指纹只能注册1个账号（永久）
   - 同一IP地址只能注册1个账号（永久）
   - 两个条件同时检查，任一重复即拒绝
   - 错误提示会明确告知是哪个条件触发

4. **账号状态转换**：
   - `active` → `banned`：管理员封禁，或用户90天未登录
   - `banned` → `active`：管理员解封

5. **账号激活管理**（服务器名额管理）⚠️ 未实现，仅为设计规划：
   
   **三种状态**：
   - ✅ **active**（激活）- 正常游戏状态，占用服务器名额
   - ⏸️ **inactive**（非激活）- 不活跃，释放服务器名额
   - 💎 **premium**（付费）- 付费用户，不受短期非激活限制
   
   **非激活条件**：
   
   **条件1：未完成新手引导**
   - ⏰ **时限**：创建角色后8小时
   - 📊 **判断**：`tutorialCompleted = false` 且超过8小时
   - 🔄 **处理**：标记为非激活，释放服务器名额
   - 💡 **说明**：鼓励新玩家尽快完成新手引导
   
   **条件2：已完成新手引导**
   - ⏰ **时限**：最后登录后24小时
   - 📊 **判断**：`tutorialCompleted = true` 且超过24小时未登录
   - 🔄 **处理**：标记为非激活，释放服务器名额
   - 💡 **说明**：短期不活跃玩家释放名额，保持服务器活跃度
   
   **例外：付费用户**
   - 💎 **特权**：付费用户不受短期非激活限制
   - ✅ **条件**：完成新手引导后开通付费战令（`hasPremium = true`）
   - 🔒 **保护**：账号90天内不会被标记为非激活
   - 💡 **说明**：付费用户享有更长的保护期
   
   **重新激活**：
   - 非激活账号重新登录时自动激活
   - 角色数据完整保留，无任何损失
   - 重新占用服务器名额
   
   **业务逻辑**：
   ```javascript
   // 检查账号是否应该被标记为非激活
   function shouldDeactivate(account, player) {
     // 付费用户90天保护期
     if (account.hasPremium) {
       const daysSinceLastLogin = (Date.now() - account.lastLoginAt) / (1000 * 60 * 60 * 24);
       return daysSinceLastLogin > 90;
     }
     
     // 未完成新手引导：8小时
     if (!player.tutorialCompleted) {
       const hoursSinceCreated = (Date.now() - player.created_at) / (1000 * 60 * 60);
       return hoursSinceCreated > 8;
     }
     
     // 已完成新手引导：24小时
     const hoursSinceLastLogin = (Date.now() - account.lastLoginAt) / (1000 * 60 * 60);
     return hoursSinceLastLogin > 24;
   }
   ```
   
   **相关字段**：
   - `accounts.status` - 账号状态（active/inactive/banned）
   - `accounts.hasPremium` - 是否购买战令（付费用户保护）
   - `accounts.lastLoginAt` - 最后登录时间（用于计算不活跃时长）
   - `players.tutorial_completed` - 是否完成新手引导（参见 3.2.2 玩家角色表）
   - `players.created_at` - 角色创建时间（用于计算新手引导超时）

6. **账号删除**：
   - 真正删除的账号直接从数据库物理删除
   - 不保留已删除账号的记录
   - 删除后该ID可以被重新注册
   - ⚠️ 但机器指纹和IP限制仍然生效

7. **赛季系统**（账号级别）：
   - 赛季信息存储在账号级别，不是角色级别
   - 一个账号只能参与一个当前赛季
   - 一个账号只能创建一个角色（player_id = account_id）
   - 赛季切换时，账号和角色自动切换
   - `participated_seasons` 记录所有参与过的赛季（包括测试赛季）

8. **战令系统**（赛季通行证）：
   - 战令是赛季级别的付费内容，购买后在当前赛季有效
   - `hasPremium` 字段记录玩家是否购买了当前赛季的战令
   - 赛季切换时，`hasPremium` 自动重置为 `false`
   - 战令福利包括：
     - 每日额外奖励（粮草、银两等）
     - 解锁专属任务和奖励
     - 赛季结束时的额外继承物
     - 特殊称号和成就
   - 玩家切换服务器或赛季时，战令状态跟随账号
   - 无月卡、年卡等时间限制，只与赛季绑定

9. **服务器设计说明**：
   - 服务器ID（如S1-01）是唯一标识，直接用于显示
   - 服务器会一直保留，接收新玩家
   - 赛季在服务器上轮换（黄巾之乱 → 董卓之乱 → 群雄割据）
   - 服务器 ≠ 赛季（同一服务器可以运行多个赛季）
   - 赛季信息通过 `current_season` 字段管理

10. **缓存策略**：
   - 用户登录后，账户信息缓存7天
   - 7天内无需重新登录
   - 超过7天需要重新输入密码

**示例数据**：

```json
{
  "id": "0CEW",
  "password": "$2b$10$...",
  "birthMonth": 3,
  "serverId": "S1-01",
  "current_season": "san_1",
  "participated_seasons": ["san_0_m2", "san_0_m3", "san_1"],
  "hasPremium": true,
  "province": "广东省",
  "city": "深圳市",
  "clientIP": "2403:6200:8892:87d7:7809:e84:39d6:915c",
  "machineId": "x4muzu...",
  "status": "active",
  "banReason": null,
  "banUntil": null,
  "registeredAt": "2026-03-07T22:48:41.000Z",
  "lastLoginAt": "2026-03-07T22:48:41.000Z",
  "lastActiveAt": "2026-03-07T22:48:41.000Z",
  "loginCount": 1
}
```

---

---

#### 3.2.2 玩家角色表 (players)

```sql
CREATE TABLE players (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家角色ID（等同于账号ID）',
  character_name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名',
  
  faction_id VARCHAR(50) NOT NULL COMMENT '势力ID',
  faction_name VARCHAR(50) NOT NULL COMMENT '势力名称',
  
  avatar VARCHAR(255) COMMENT '头像URL',
  
  -- 声望系统（荣誉累积，不可消费）
  reputation INT DEFAULT 0 COMMENT '当前声望值（累计，只增不减）',
  reputation_to_next INT DEFAULT 10 COMMENT '下一级官职所需声望',
  
  -- 贡献系统（可消费货币）
  contribution INT DEFAULT 0 COMMENT '当前贡献值（可用于兑换稀有奖励）',
  
  -- 资源系统（整数存储）
  silver INT DEFAULT 500 COMMENT '银两',
  food INT DEFAULT 1000 COMMENT '粮草',
  
  -- 属性系统（×10存储，如65代表6.5）
  luck INT NOT NULL COMMENT '运气×10',
  courage INT NOT NULL COMMENT '勇气×10',
  combat INT NOT NULL COMMENT '武力×10',
  command INT NOT NULL COMMENT '统帅×10',
  intelligence INT NOT NULL COMMENT '智力×10',
  politics INT NOT NULL COMMENT '政治×10',
  charm INT NOT NULL COMMENT '魅力×10',
  
  -- 技能系统（玩家角色也可以有技能）
  skill_1 VARCHAR(50) COMMENT '技能1',
  skill_2 VARCHAR(50) COMMENT '技能2',
  
  -- 战斗属性
  troop_affinity VARCHAR(50) COMMENT '兵种亲和（如：infantry:5）',
  trait VARCHAR(50) COMMENT '性格特质类型（brave/reckless/calm/normal/cautious/timid）',
  trait_modifier INT COMMENT '性格特质对应的士气修正值（-5到+8，用于战斗计算）',
  on_duty BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否披挂上阵（待战开关；作战编组见上阵 player_cards，与 player_garrison 无关）',
  on_duty_city_id VARCHAR(64) NULL DEFAULT NULL COMMENT '披挂待战目标城池 id，与 cities.id 对应；与驻地编组无强制关联',
  morale INT NOT NULL DEFAULT 70 COMMENT '当前士气（0-120），初始值=70+trait_modifier，战后保持',
  
  -- 属性随机系统（日常属性重随机，复用角色创建算法）
  attr_reroll_date DATE COMMENT '上次属性随机日期（用于每日次数重置）',
  attr_reroll_count INT DEFAULT 0 COMMENT '今日已随机次数（每日00:00重置，上限2）',
  attr_reroll_batches JSON COMMENT '属性随机历史批次（与角色创建random_batches格式一致）',
  attr_reroll_selected_batch INT COMMENT '当前选中的方案所在批次',
  attr_reroll_selected_index INT COMMENT '当前选中的方案索引（0-2）',
  
  -- 官职系统
  current_position_id VARCHAR(50) COMMENT '当前官职ID',
  current_position_name VARCHAR(50) COMMENT '当前官职名称',
  position_level INT DEFAULT 1 COMMENT '官职等级',
  
  -- 🔥 玩家级别加成字段（来源：宝物/道具/势力加成）
  -- 对应术语表 06-TERMINOLOGY.csv 的 db_field 列
  bonus_backpack_capacity INT DEFAULT 0 COMMENT '背包容量加成（实际上限=默认10+此值）',
  bonus_daily_events INT DEFAULT 0 COMMENT '每日事件数加成',
  
  -- 道具背包（事件链钥匙等消耗品）
  items JSON COMMENT '持有道具（如：{"san_1_item_taoyuan": 1}，消耗时减数量，为0删key）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  last_login_at DATETIME COMMENT '最后登录时间',
  last_active_at DATETIME COMMENT '最后活跃时间',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_character_name (character_name),
  INDEX idx_faction (faction_id),
  INDEX idx_reputation (reputation),
  INDEX idx_position (current_position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家角色表（一个账号一个角色）';
```

**说明**：
- ✅ player_id改为VARCHAR(4)，与账号ID一致
- ✅ 删除account_id字段（不需要了）
- ✅ 外键直接关联accounts(id)
- ✅ 删除idx_account索引（不需要了）
- ✅ 一个账号只能创建一个角色
- ✅ 新增战斗字段：玩家角色作为可上阵的卡牌，需要技能、兵种亲和、性格特质等战斗属性
- ✅ **披挂上阵**：`on_duty` + `on_duty_city_id` 表示「待战哪座城」；攻城逻辑与统计见 `garrisonService` / `cityService`。字段由迁移 `backend/database/migrations/add-players-on-duty-city-id.sql` 添加（若库为旧版须执行）。
- ✅ **系统占位行**：`player_id = 'sys1'` 与 `accounts.id = 'sys1'` 成对存在，供传书 `texts.sender_id` 外键使用；**非真实玩家**，认证层须拒绝登录。部署时执行种子脚本或 SQL 迁移：
  - `backend/database/migrations/seed-system-player-sys1.js`（推荐，在 `backend` 目录：`node database/migrations/seed-system-player-sys1.js`）
  - 或 `backend/database/migrations/seed-system-player-sys1.sql`（`mysql … < seed-system-player-sys1.sql`）

**战斗属性说明**：

玩家角色在 `player_lineup_slots` 中占据一个槽位，作为可上阵的卡牌参与战斗，因此需要以下战斗属性：

1. **技能系统**：
   - `skill_1`：主动技能（在角色创建时随机生成或选择）
   - `skill_2`：被动技能（在角色创建时随机生成或选择）

2. **兵种亲和**：
   - `troop_affinity`：兵种亲和度（如：infantry:5，表示对步兵有5级亲和）
   - 影响带领该兵种时的战斗效果

3. **性格特质**：
   - `trait`：性格特质类型（brave/reckless/calm/normal/cautious/timid）
   - `trait_modifier`：对应的士气修正值（-5到+8）
   - 战斗计算：实际士气 = 玩家全局士气 + trait_modifier

4. **属性随机系统**：
   - `attr_reroll_date`：上次属性随机日期，用于每日次数重置（与当天日期比较，不同则重置count为0）
   - `attr_reroll_count`：今日已随机次数，上限2次
   - `attr_reroll_batches`：属性随机历史批次JSON，格式与角色创建的 `random_batches` 完全一致
   - `attr_reroll_selected_batch`：当前选中的方案所在批次号
   - `attr_reroll_selected_index`：当前选中的方案在批次中的索引（0=Military, 1=Strategist, 2=Balanced）
   - 费用按官职稀有度：common=10, rare=50, epic=250, legendary=500, core=750（银两）
   - 复用角色创建的 `generateAttributes(rarity)` 算法

**资源系统说明**：

1. **银两（silver）**：
   - 主要货币，用于购买道具、装备合成、资源兑换等
   - 获取途径：任务奖励、战斗奖励、每日签到、资源兑换
   - 消耗途径：购买道具、装备合成、资源兑换

2. **粮草（food）**：
   - 战斗资源，用于恢复部队兵力、参与战斗等
   - 获取途径：任务奖励、战斗奖励、每日签到、资源兑换
   - 消耗途径：恢复部队兵力、参与战斗、资源兑换

3. **资源兑换**：
   - 支持银两↔粮草双向兑换
   - 兑换比例动态调整（基于势力资源池）
   - 基础比例：1银两 = 5粮草
   - 动态比例范围：1:3 ~ 1:7
   - 兑换限制：每日最多兑换10次
   - 兑换手续费：无

**资源兑换比例计算**：
```javascript
// 基础比例
const BASE_RATE = 5; // 1银两 = 5粮草

// 动态比例（基于势力资源池）
function getExchangeRate(factionId) {
  const faction = getFaction(factionId);
  const silverPool = faction.silver_pool;
  const foodPool = faction.food_pool;
  
  // 计算资源比例
  const ratio = foodPool / silverPool;
  
  // 动态调整比例（范围：3-7）
  let rate = BASE_RATE;
  if (ratio > 1.5) rate = 7; // 粮草充足，银两稀缺
  else if (ratio > 1.2) rate = 6;
  else if (ratio < 0.8) rate = 4;
  else if (ratio < 0.5) rate = 3; // 银两充足，粮草稀缺
  
  return rate;
}
```


#### 3.2.3 玩家卡牌表 (player_cards)

**设计原则**：只存储**动态数据**（会变化的数据），固定属性通过 `card_id` 关联配置表读取。

```sql
CREATE TABLE player_cards (
  instance_id VARCHAR(50) PRIMARY KEY COMMENT '卡牌实例ID',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  
  card_type ENUM('troop', 'character', 'equipment', 'title', 'achievement', 'treasure') NOT NULL COMMENT '卡牌类型',
  card_id VARCHAR(50) NOT NULL COMMENT '卡牌配置ID（关联配置表）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  -- 🔥 部队卡专用字段（仅动态数据）
  current_troops INT COMMENT '当前兵力（战斗中会损失，可通过粮草恢复）',
  battle_count INT DEFAULT 0 COMMENT '已使用次数（每次战斗+1）',
  max_battle_count INT COMMENT '最大使用次数（根据稀有度：common=20, rare=40, epic=60, legendary=80, core=99）',
  
  -- 🔥 部队卡加成字段（来源：宝物/道具/势力加成，装备时写入，卸下时清零）
  -- 对应术语表 06-TERMINOLOGY.csv 的 db_field 列
  bonus_max_troops INT DEFAULT 0 COMMENT '兵力上限加成（实际上限=config_troops.max_troops+此值）',
  bonus_attack INT DEFAULT 0 COMMENT '攻击加成（×10存储）',
  bonus_defense INT DEFAULT 0 COMMENT '防御加成（×10存储）',
  bonus_speed INT DEFAULT 0 COMMENT '速度加成（影响行动顺序和闪避率）',
  bonus_movement INT DEFAULT 0 COMMENT '移速加成（每回合可移动格数）',
  
  -- 🔥 部队卡兵力恢复字段
  -- 兵力损失后自动恢复，恢复速率：10兵/分钟，粮草消耗：损失兵力/10
  -- 每次读取profile时后端自动结算：根据经过时间计算已恢复兵力，扣除粮草，更新current_troops
  last_troops_lost_at DATETIME COMMENT '上次兵力损失时间（战斗结束/称号装备导致上限变化时写入，满编后清除）',
  
  -- 🔥 将领卡专用字段（仅动态数据）
  -- 将领卡无升级系统，无需存储等级和经验值
  -- 将领的固定属性（武力、统帅、智力等）从 config_characters 表读取
  morale INT COMMENT '当前士气（0-120），将领卡专用，初始值=70+config_characters.trait_modifier，战后保持',
  
  -- 🔥 装备卡专用字段（「四件合一」套装卡方案；与单件装备件 player_cards 行可并存，见 24-EQUIPMENT_SYSTEM.md）
  equipment_set_id VARCHAR(50) COMMENT '装备套装ID（预留：套装卡方案；单件装备卡通常只用 card_id→config_equipment）',
  equipment_set_data JSON COMMENT '装备套装数据 JSON（预留：武器×1、防具×1、辅助×2 等）',
  
  -- 🔥 称号卡、成就卡、宝物卡专用字段
  -- 这三种卡牌无需额外字段，固定属性从配置表读取
  -- 只需记录装备状态（is_equipped, equipped_by, equipped_slot）
  
  -- 🔥 装备状态（所有卡牌通用）
  is_equipped BOOLEAN DEFAULT FALSE COMMENT '是否已装备',
  equipped_by VARCHAR(50) COMMENT '装备者（player/character1/character2）',
  equipped_slot VARCHAR(50) COMMENT '装备槽位',
  
  -- 时间戳
  obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_card_type (card_type),
  INDEX idx_card_id (card_id),
  INDEX idx_rarity (rarity),
  INDEX idx_equipped (is_equipped, equipped_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家卡牌表（仅存储动态数据，固定属性从配置表读取）';
```

**字段说明**：

| 字段名 | 适用卡牌类型 | 说明 | 备注 |
|--------|------------|------|------|
| `instance_id` | 全部 | 卡牌实例ID | 唯一标识玩家拥有的每张卡牌 |
| `player_id` | 全部 | 玩家ID | 关联玩家 |
| `card_type` | 全部 | 卡牌类型 | troop/character/equipment/title/achievement/treasure |
| `card_id` | 全部 | 卡牌配置ID | 关联配置表获取固定属性 |
| `rarity` | 全部 | 稀有度 | common/rare/epic/legendary/core |
| `current_troops` | 部队卡 | 当前兵力 | 战斗中会损失，可通过粮草恢复 |
| `battle_count` | 部队卡 | 已使用次数 | 每次战斗+1，达到上限后卡牌报废 |
| `max_battle_count` | 部队卡 | 最大使用次数 | 根据稀有度固定 |
| `bonus_max_troops` | 部队卡 | 兵力上限加成 | 实际上限=config_troops.max_troops+此值 |
| `bonus_attack` | 部队卡 | 攻击加成 | ×10存储，来源：宝物/势力加成 |
| `bonus_defense` | 部队卡 | 防御加成 | ×10存储，来源：宝物/势力加成 |
| `bonus_speed` | 部队卡 | 速度加成 | 影响行动顺序和闪避率 |
| `bonus_movement` | 部队卡 | 移速加成 | 每回合可移动格数 |
| `equipment_set_id` | 装备卡（套装方案） | 装备套装 ID | **预留**：`config_equipment_sets` 等落地后使用；当前战斗掉落等写入的 **单件装备** 行通常 **仅** `card_id` + `card_type=equipment` |
| `equipment_set_data` | 装备卡（套装方案） | 套装槽位 JSON | **预留**：与 24 号装备文档「装备卡」一致；未启用前可为 NULL |
| `is_equipped` | 全部 | 是否已装备 | 标识卡牌是否在使用中 |
| `equipped_by` | 全部 | 装备者 | player/character1/character2 |
| `equipped_slot` | 全部 | 装备槽位 | 具体槽位名称 |

**数据读取示例**：

```javascript
// 获取玩家的部队卡（带完整属性）
async function getPlayerTroopCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.current_troops,
      pc.battle_count,
      pc.max_battle_count,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性
      ct.troop_name,
      ct.troop_type,
      ct.attack,
      ct.defense,
      ct.max_troops,
      ct.speed,
      ct.movement,
      ct.attack_range,
      ct.special_ability
      
    FROM player_cards pc
    INNER JOIN config_troops ct ON pc.card_id = ct.troop_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}

// 获取玩家的将领卡（带完整属性）
async function getPlayerCharacterCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性
      cc.character_name,
      cc.luck,
      cc.courage,
      cc.combat,
      cc.command,
      cc.intelligence,
      cc.politics,
      cc.charm,
      cc.skill_1,
      cc.skill_2,
      cc.troop_affinity,
      cc.trait
      
    FROM player_cards pc
    INNER JOIN config_characters cc ON pc.card_id = cc.character_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}

// 获取玩家的「套装型」装备卡（带完整属性）——依赖 config_equipment_sets；表未落地前勿在生产路径调用
async function getPlayerEquipmentCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.equipment_set_id,
      pc.equipment_set_data,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性（config_equipment_sets 为套装方案目标表，与 24-EQUIPMENT_SYSTEM 一致）
      ce.equipment_set_name,
      ce.set_bonus
      
    FROM player_cards pc
    INNER JOIN config_equipment_sets ce ON pc.equipment_set_id = ce.set_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}

// 获取玩家的称号卡（带完整属性）
async function getPlayerTitleCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性
      ct.title_name,
      ct.description,
      ct.display_name,
      ct.display_position,
      ct.attribute_bonus,
      ct.special_effects
      
    FROM player_cards pc
    INNER JOIN config_titles ct ON pc.card_id = ct.title_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}

// 获取玩家的成就卡（带完整属性）
async function getPlayerAchievementCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性
      ca.achievement_name,
      ca.description,
      ca.attribute_bonus,
      ca.special_effects,
      ca.rewards
      
    FROM player_cards pc
    INNER JOIN config_achievements ca ON pc.card_id = ca.achievement_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}

// 获取玩家的宝物卡（带完整属性）
async function getPlayerTreasureCard(instanceId) {
  const [rows] = await mysql.query(`
    SELECT 
      pc.instance_id,
      pc.player_id,
      pc.card_id,
      pc.rarity,
      pc.is_equipped,
      pc.equipped_by,
      
      -- 从配置表读取固定属性
      ctr.treasure_name,
      ctr.treasure_effect,
      ctr.attribute_bonus,
      ctr.special_ability
      
    FROM player_cards pc
    INNER JOIN config_treasures ctr ON pc.card_id = ctr.treasure_id
    WHERE pc.instance_id = ?
  `, [instanceId]);
  
  return rows[0];
}
```

**优势**：
- ✅ 数据库体积大幅减小（删除了所有固定属性字段）
- ✅ 属性调整时只需修改配置表，不需要更新玩家数据
- ✅ 数据一致性更好（所有玩家的"青州兵"属性永远一致）
- ✅ 查询时通过 `card_id` JOIN 配置表即可获取完整数据

#### 3.2.4 ~~玩家装备槽表 (player_equipment_slots)~~ — 已废弃

> ⚠️ **已废弃（2026-03-28）**：此表已从数据库中移除。
> 玩家编组功能实际通过 `player_cards` 表的 `is_equipped` / `equipped_by` / `equipped_slot` 字段实现，
> 本表从未被读取或更新过，仅在创建角色时插入空行。已确认无任何业务依赖后移除。

---

#### 3.2.5 玩家驻守配置表 (player_garrison)

**说明**：存储玩家**驻地编组**（守城卡池 A/B 等），用于已占领城池的**异步守城 PVE**（`player_garrison` 槽位内部队）。与 **`players.on_duty` / `on_duty_city_id`（披挂上阵）在数据上解耦**：可只配驻地、只开披挂，或两者兼有；攻城队列中同玩家去重时披挂优先。详见 [13-2-CITY_DEFENSE_SYSTEM.md](../10-core-system/13-2-CITY_DEFENSE_SYSTEM.md)、[17-3-SIEGE_SYSTEM.md](../10-core-system/17-3-SIEGE_SYSTEM.md)。

> 表结构以仓库迁移为准：`backend/database/migrations/create-player-garrison.sql`。

```sql
CREATE TABLE player_garrison (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  garrison_slot INT NOT NULL COMMENT '驻守槽位编号（1-12；产品侧常用 1=卡池A、2=卡池B）',
  
  city_id VARCHAR(50) COMMENT '驻守城市ID（cities.id）',
  city_name VARCHAR(50) COMMENT '驻守城市名称（冗余展示）',
  
  -- 将领1配置（6个装备槽）
  char1_card VARCHAR(50) COMMENT '将领1卡牌实例ID',
  char1_equipment_card VARCHAR(50) COMMENT '将领1装备卡槽（包含武器×1、防具×1、辅助×2）',
  char1_title VARCHAR(50) COMMENT '将领1称号槽',
  char1_achievement VARCHAR(50) COMMENT '将领1成就槽',
  char1_treasure VARCHAR(50) COMMENT '将领1宝物槽',
  char1_troop1 VARCHAR(50) COMMENT '将领1部队槽1',
  char1_troop2 VARCHAR(50) COMMENT '将领1部队槽2',
  
  -- 将领2配置（6个装备槽）
  char2_card VARCHAR(50) COMMENT '将领2卡牌实例ID',
  char2_equipment_card VARCHAR(50) COMMENT '将领2装备卡槽（包含武器×1、防具×1、辅助×2）',
  char2_title VARCHAR(50) COMMENT '将领2称号槽',
  char2_achievement VARCHAR(50) COMMENT '将领2成就槽',
  char2_treasure VARCHAR(50) COMMENT '将领2宝物槽',
  char2_troop1 VARCHAR(50) COMMENT '将领2部队槽1',
  char2_troop2 VARCHAR(50) COMMENT '将领2部队槽2',
  
  is_active BOOLEAN DEFAULT FALSE COMMENT '是否计入守军/可出战：配置完整且四路驻守部队当前兵力合计≥800；战后若合计<800由结算置 FALSE',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (player_id, garrison_slot),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_city (city_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家驻守配置表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `garrison_slot` | 驻守槽位编号 | 1-12；与攻城战线锁 `def|warId|playerId|slot` 中的 slot 一致（披挂为逻辑槽位 0，**不写入本表**） |
| `city_id` | 驻守城市ID | 须与 `cities.id` 一致 |
| `city_name` | 驻守城市名称 | 冗余展示 |
| `char1_card` / `char2_card` | 将领卡牌实例ID | 关联 `player_cards.instance_id` |
| `is_active` | 是否有效守军槽 | 为 `TRUE` 时才参与地图驻地统计、`getCityGarrisonDefenders` 与攻城筛选（仍须 `initiateSiege` 侧兵力合计 ≥800 校验） |

**业务规则**：

1. **驻守组配置**：
   - 每组 = 2 将领 + 4 部队（每将 2 部队）+ 称号等槽位（与实装 `garrisonService` 一致）
   - 最多 12 组槽位（产品可仅用其中若干）

2. **卡牌占用（与代码一致）**：
   - 写入驻守的卡牌实例 **`is_equipped` 须为 false**：已在上阵编组中的卡不可再编入驻守（`saveGarrison` 会校验）
   - 同一实例不得同时出现在多个驻守槽位

3. **`is_active` 与兵力门槛**：
   - 保存时由服务端根据四路部队 **`current_troops` 合计（与配置表满编回退算法见 `garrisonService.sumTroopInstancesTotalTroops`）是否 ≥ `MIN_GARRISON_TOTAL_TROOPS`（800）** 写入
   - 攻城结算后若该槽合计 **&lt; 800**，`recordSiegeResult` 将 `is_active` 置 `FALSE`

4. **城市绑定**：
   - 每组可绑定一城；同城可多玩家、多槽位

**使用示例**：

```javascript
// 1. 设置驻守配置：请走后端 garrisonService.saveGarrison（或 POST /garrisons/:playerId/:slot）
//    内部 INSERT … ON DUPLICATE KEY UPDATE 全字段，并按四路部队合计兵力是否 ≥800 写入 is_active
async function setGarrison(playerId, slotNumber, config) {
  return garrisonService.saveGarrison(playerId, slotNumber, config);
}

// 2. 查询玩家的所有驻守
async function getPlayerGarrisons(playerId) {
  const [rows] = await mysql.query(`
    SELECT * FROM player_garrison
    WHERE player_id = ? AND is_active = true
    ORDER BY garrison_slot
  `, [playerId]);
  
  return rows;
}

// 3. 查询某个城市的所有驻守
async function getCityGarrisons(cityId) {
  const [rows] = await mysql.query(`
    SELECT * FROM player_garrison
    WHERE city_id = ? AND is_active = true
  `, [cityId]);
  
  return rows;
}

// 4. 清空驻守槽位
async function clearGarrison(playerId, slotNumber) {
  await mysql.query(`
    UPDATE player_garrison SET
      city_id = NULL,
      city_name = NULL,
      char1_card = NULL,
      char1_equipment_card = NULL,
      char1_troop1 = NULL,
      char1_troop2 = NULL,
      char2_card = NULL,
      char2_equipment_card = NULL,
      char2_troop1 = NULL,
      char2_troop2 = NULL,
      is_active = false
    WHERE player_id = ? AND garrison_slot = ?
  `, [playerId, slotNumber]);
}

// 5. 各城驻地统计（与实装 garrisonService.getCityGarrisonStats 一致：激活槽位数 + 人数，且须玩家与城同势力）
async function getCityGarrisonStats() {
  const [rows] = await mysql.query(`
    SELECT g.city_id, g.city_name,
           COUNT(DISTINCT g.player_id) AS player_count,
           COUNT(*) AS slot_count
    FROM player_garrison g
    JOIN players p ON g.player_id = p.player_id
    JOIN cities c ON c.id = g.city_id
    WHERE g.is_active = TRUE AND g.city_id IS NOT NULL
      AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
    GROUP BY g.city_id, g.city_name
    ORDER BY slot_count DESC
  `);
  return rows;
}

// 返回示例：
// [
//   { city_id: 'san_1_city_3_xinye', city_name: '新野', player_count: 5, slot_count: 7 },
//   ...
// ]

// 6. 获取特定城市的驻地详情（包含玩家信息）
async function getCityGarrisonDetails(cityId) {
  const [rows] = await mysql.query(`
    SELECT 
      g.*,
      p.character_name,
      p.faction_name
    FROM player_garrison g
    JOIN players p ON g.player_id = p.player_id
    WHERE g.city_id = ? AND g.is_active = true
    ORDER BY g.player_id, g.garrison_slot
  `, [cityId]);
  
  return rows;
}
```

**城市驻地统计说明**：

1. **地图 / tooltip 需求**：
   - 展示每城 **`slot_count`（激活驻守槽数）** 与 **`player_count`（人数）**；**披挂上阵人数**单独按 `players.on_duty` + `on_duty_city_id` 统计，勿与 `player_garrison` 混算

2. **统计查询性能**：
   - 使用聚合查询；仅 `is_active = TRUE`；建议与 `cities`、`players` 联结过滤势力一致，避免易主后脏数据
   - 查询结果可短期缓存（驻地变化相对不频繁）

3. **UI显示示例**：
```
地图Tab - 城市列表
┌─────────────────────────────────┐
│ 南阳城（中城）                   │
│ 驻地槽位：15 · 玩家 12 人        │
│ 势力：刘备势力                   │
├─────────────────────────────────┤
│ 洛阳城（大城）                   │
│ 驻地槽位：12 · 玩家 10 人        │
│ 势力：曹操势力                   │
└─────────────────────────────────┘
```

**数据结构对比**：

```
部队阵容（通过 player_cards 的 is_equipped/equipped_by/equipped_slot 实现）：
├── 玩家自己（6个装备槽）
├── 将领1（6个装备槽）
└── 将领2（6个装备槽）
用途：玩家主动战斗（手动/快速战斗）
说明：战前配置的将领+部队组合

驻守配置（player_garrison）：
├── 驻守槽位1（绑定某城，如南阳）
│   ├── 将领A（6个装备槽）
│   └── 将领B（6个装备槽）
├── 驻守槽位2（另一套卡池）
│   └── ...
└── ... 最多12组
用途：已占领城池的异步守城（PVE）；**不包含**披挂上阵（披挂为 players.on_duty + 上阵编组）

披挂上阵（players 表字段，无单独表）：
├── on_duty + on_duty_city_id
└── 作战单位来自 player_cards 上阵编组，逻辑槽位 garrison_slot=0（不写 player_garrison）
```

---

#### 3.2.6 玩家进度表 (player_progress)

**说明**：存储玩家的固定进度数据（新手引导、称号、成就、战役），这些内容完成后基本不变。

```sql
CREATE TABLE player_progress (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 新手引导
  tutorial_completed BOOLEAN DEFAULT FALSE COMMENT '是否完成新手引导',
  tutorial_current_step INT DEFAULT 1 COMMENT '当前步骤',
  tutorial_completed_at DATETIME COMMENT '完成时间',
  
  -- 称号系统
  unlocked_titles JSON COMMENT '已解锁的称号列表（称号ID数组）',
  title_progress JSON COMMENT '称号解锁进度（包含未解锁和已解锁的进度数据）',
  
  -- 成就系统
  unlocked_achievements JSON COMMENT '已解锁的成就列表（成就ID数组）',
  achievement_progress JSON COMMENT '成就解锁进度（包含未解锁和已解锁的进度数据）',
  
  -- 战役系统
  campaign_progress JSON COMMENT '战役地图进度（记录每个战役的完成情况、星级、排名等）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家进度表（固定内容）';
```

**字段说明**：

| 字段名 | 说明 | 数据格式 |
|--------|------|---------|
| `tutorial_completed` | 是否完成新手引导 | Boolean |
| `tutorial_current_step` | 当前引导步骤 | 整数 |
| `unlocked_titles` | 已解锁的称号列表 | JSON数组（称号ID） |
| `title_progress` | 称号解锁进度 | JSON对象 |
| `unlocked_achievements` | 已解锁的成就列表 | JSON数组（成就ID） |
| `achievement_progress` | 成就解锁进度 | JSON对象 |
| `campaign_progress` | 战役地图进度 | JSON对象 |

**设计说明**：
- ✅ 只存储固定内容（完成后基本不变）
- ✅ 数据量小（每个玩家约2-5KB）
- ✅ 可以长期缓存
- ✅ 查询频率低

---

#### 3.2.7 玩家事件进度表 (player_events)

**说明**：存储玩家的动态事件进度（7种事件类型），这些内容随机触发，频繁更新。

```sql
CREATE TABLE player_events (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 事件系统（7种事件类型）
  historical_events JSON COMMENT '历史事件进度（类型1：基于真实历史的事件）',
  fictional_events JSON COMMENT '虚构事件进度（类型2：原创剧情事件）',
  daily_events JSON COMMENT '日常事件进度（类型3：每日任务和随机遭遇）',
  weekly_events JSON COMMENT '周常事件进度（类型4：每周挑战和任务）',
  mini_events JSON COMMENT '迷你游戏进度（类型5：小游戏类事件）',
  explore_events JSON COMMENT '探索事件进度（类型6：地图探索触发的事件）',
  reward_events JSON COMMENT '奖励事件进度（类型7：系统奖励发放事件）',
  
  -- 探索配额（服务端存储，防止跨浏览器重复恢复）
  explore_quota_remaining INT DEFAULT NULL COMMENT '探索剩余次数（NULL=首次使用，由后端初始化）',
  explore_quota_refill_ts VARCHAR(20) DEFAULT NULL COMMENT '探索上次恢复的整点时间戳（毫秒字符串）',
  
  -- 攻城配额（与探索配额机制一致）
  siege_quota_remaining INT DEFAULT NULL COMMENT '攻城剩余次数',
  siege_quota_refill_ts VARCHAR(20) DEFAULT NULL COMMENT '攻城上次恢复的整点时间戳（毫秒字符串）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家事件进度表（动态内容）';
```

**字段说明**：

| 字段名 | 说明 | 数据格式 |
|--------|------|---------|
| `historical_events` | 历史事件进度 | JSON对象 |
| `fictional_events` | 虚构事件进度 | JSON对象 |
| `daily_events` | 日常事件进度 | JSON对象 |
| `weekly_events` | 周常事件进度 | JSON对象 |
| `mini_events` | 迷你游戏进度 | JSON对象 |
| `explore_events` | 探索事件进度 | JSON对象 |
| `reward_events` | 奖励事件进度 | JSON对象 |

**设计说明**：
- ✅ 只存储动态内容（随机触发，频繁更新）
- ✅ 数据量可控（每个玩家约10-50KB）
- ✅ 已完成事件保留14天后自动清理
- ✅ 查询频率高，独立缓存策略

**事件列表查询**：

1. **获取最近未完成事件**（用于UI左上角浮层）：
```javascript
// 获取最近3-5个未完成事件
async function getRecentEvents(playerId) {
  const [progress] = await mysql.query(`
    SELECT * FROM player_events WHERE player_id = ?
  `, [playerId]);
  
  // 解析JSON，提取未完成事件
  const allEvents = [
    ...Object.values(progress.historical_events || {}),
    ...Object.values(progress.fictional_events || {}),
    ...Object.values(progress.daily_events || {}),
    ...Object.values(progress.weekly_events || {}),
    ...Object.values(progress.mini_events || {}),
  ];
  
  // 筛选未完成事件
  const unfinishedEvents = allEvents.filter(event => 
    event.status === 'in_progress' || event.status === 'available'
  );
  
  // 按优先级和时间排序，取前3-5个
  return unfinishedEvents
    .sort((a, b) => {
      // 优先级：in_progress > available
      if (a.status !== b.status) {
        return a.status === 'in_progress' ? -1 : 1;
      }
      // 时间：最新的在前
      return new Date(b.updated_at) - new Date(a.updated_at);
    })
    .slice(0, 5);
}
```

2. **事件状态说明**：
- `available` - 可接取（显示在事件列表）
- `in_progress` - 进行中（显示在浮层）
- `completed` - 已完成（保留14天）
- `expired` - 已过期（自动清理）

3. **UI显示规则**：
- 左上角浮层：显示最多5个未完成事件（in_progress优先）
- 事件列表页面：显示所有可接取和进行中的事件
- 历史记录：显示最近14天的已完成事件

**数据保留策略**：
- 进行中的事件：永久保留
- 已完成的事件：保留14天后自动清理
- 重要事件：可标记为"收藏"永久保留
- 与battles表保持一致的数据保留策略

**拆分优势**：
1. **性能优化**：事件系统频繁更新不会影响固定内容的缓存
2. **数据量控制**：事件数据14天自动清理，避免无限增长
3. **扩展性更好**：未来如果事件系统继续扩展，不会影响其他功能
4. **查询效率**：大部分查询只需要固定内容，不需要加载事件数据

---

#### 3.2.8 装备合成表 (player_synthesis)

**说明**：存储玩家的装备合成保底计数、统计数据和最近30条合成记录，持久表，永久保存。

**设计理念**：
- ✅ 合并原 `player_synthesis_records` 和 `player_synthesis_guarantee` 两个表
- ✅ 保底计数和统计数据存储在字段中（持久数据）
- ✅ 最近30条合成记录存储在JSON字段中（滚动更新）
- ✅ 简化架构，提升查询性能，减少维护成本

```sql
CREATE TABLE player_synthesis (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 武器保底计数
  weapon_common_count INT DEFAULT 0 COMMENT '白色武器未升级次数',
  weapon_rare_count INT DEFAULT 0 COMMENT '蓝色武器未升级次数',
  weapon_epic_count INT DEFAULT 0 COMMENT '紫色武器未升级次数',
  
  -- 防具保底计数
  armor_common_count INT DEFAULT 0 COMMENT '白色防具未升级次数',
  armor_rare_count INT DEFAULT 0 COMMENT '蓝色防具未升级次数',
  armor_epic_count INT DEFAULT 0 COMMENT '紫色防具未升级次数',
  
  -- 辅助保底计数
  accessory_common_count INT DEFAULT 0 COMMENT '白色辅助未升级次数',
  accessory_rare_count INT DEFAULT 0 COMMENT '蓝色辅助未升级次数',
  accessory_epic_count INT DEFAULT 0 COMMENT '紫色辅助未升级次数',
  
  -- 统计数据
  total_synthesis INT DEFAULT 0 COMMENT '总合成次数',
  success_upgrade INT DEFAULT 0 COMMENT '成功升级次数',
  guaranteed_upgrade INT DEFAULT 0 COMMENT '保底升级次数',
  badge_upgrade INT DEFAULT 0 COMMENT '徽章保底升级次数',
  
  -- 最近合成记录（JSON数组，最多保留30条）
  recent_records JSON COMMENT '最近30条合成记录',
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装备合成数据表（保底+统计+历史）';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `weapon_common_count` | 白色武器未升级次数 | 达到4次后，第5次必定升级 |
| `weapon_rare_count` | 蓝色武器未升级次数 | 达到4次后，第5次必定升级 |
| `weapon_epic_count` | 紫色武器未升级次数 | 达到4次后，第5次必定升级 |
| `armor_*_count` | 防具保底计数 | 同上 |
| `accessory_*_count` | 辅助保底计数 | 同上 |
| `total_synthesis` | 总合成次数 | 累计合成次数 |
| `success_upgrade` | 成功升级次数 | 升级稀有度的次数 |
| `guaranteed_upgrade` | 保底升级次数 | 触发保底的次数 |
| `badge_upgrade` | 徽章保底升级次数 | 使用徽章保底的次数 |
| `recent_records` | 最近30条合成记录 | JSON数组，滚动更新 |

**recent_records JSON格式**：
```json
[
  {
    "record_id": "syn_2026031310300001",
    "equipment_type": "weapon",
    "input_rarity": "epic",
    "output_rarity": "legendary",
    "is_upgrade": true,
    "is_guaranteed": true,
    "is_badge_upgrade": false,
    "gold_cost": 1000,
    "badge_cost": 0,
    "result_equipment_id": "eq_xxx",
    "created_at": "2026-03-13T10:30:00Z"
  },
  // ... 最多30条，超过30条时删除最旧的记录
]
```

**保底机制**：
- 连续4次合成未升级稀有度
- 第5次合成必定升级稀有度
- 升级后保底计数重置为0
- 按装备类型和稀有度分别计数

**数据更新策略**：
1. **保底计数更新**：
   - 升级成功：对应计数重置为0
   - 升级失败：对应计数+1

2. **统计数据更新**：
   - 每次合成：`total_synthesis` +1
   - 升级成功：`success_upgrade` +1
   - 保底触发：`guaranteed_upgrade` +1
   - 徽章保底：`badge_upgrade` +1

3. **历史记录更新**：
   - 新增记录插入到数组开头
   - 保持最多30条记录
   - 超过30条时删除最旧的记录

**缓存策略**：
- Redis缓存完整数据，TTL=7天
- 缓存键：`synthesis:data:{playerId}`
- 每次合成后清除缓存

**使用示例**：

```javascript
// 1. 获取保底进度
async function getGuaranteeProgress(playerId, equipmentType, rarity) {
  const [rows] = await mysql.query(
    'SELECT * FROM player_synthesis WHERE player_id = ?',
    [playerId]
  );
  
  if (!rows.length) {
    // 首次合成，初始化数据
    await mysql.query(
      'INSERT INTO player_synthesis (player_id) VALUES (?)',
      [playerId]
    );
    return { count: 0, isNextGuaranteed: false };
  }
  
  const data = rows[0];
  const fieldName = `${equipmentType}_${rarity}_count`;
  const currentCount = data[fieldName] || 0;
  const threshold = 4;
  const isNextGuaranteed = currentCount >= threshold;
  
  return {
    count: currentCount,
    remaining: threshold - currentCount,
    isNextGuaranteed
  };
}

// 2. 执行合成并更新数据
async function performSynthesis(playerId, equipmentType, inputRarity, options = {}) {
  const { useBadge = false, goldCost = 0, badgeCost = 0 } = options;
  
  // 获取当前保底进度
  const progress = await getGuaranteeProgress(playerId, equipmentType, inputRarity);
  
  // 判断是否升级
  let isUpgrade = false;
  let isGuaranteed = false;
  
  if (useBadge) {
    // 徽章保底：100%成功
    isUpgrade = true;
  } else if (progress.isNextGuaranteed) {
    // 保底触发：必定升级
    isUpgrade = true;
    isGuaranteed = true;
  } else {
    // 正常概率判定
    const upgradeRate = getUpgradeRate(inputRarity);
    isUpgrade = Math.random() < upgradeRate;
  }
  
  // 计算输出稀有度
  const outputRarity = isUpgrade ? getNextRarity(inputRarity) : inputRarity;
  
  // 生成装备实例
  const resultEquipmentId = await createEquipmentCard(playerId, equipmentType, outputRarity);
  
  // 构建合成记录
  const record = {
    record_id: `syn_${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    equipment_type: equipmentType,
    input_rarity: inputRarity,
    output_rarity: outputRarity,
    is_upgrade: isUpgrade,
    is_guaranteed: isGuaranteed,
    is_badge_upgrade: useBadge,
    gold_cost: goldCost,
    badge_cost: badgeCost,
    result_equipment_id: resultEquipmentId,
    created_at: new Date().toISOString()
  };
  
  // 更新数据库
  const fieldName = `${equipmentType}_${inputRarity}_count`;
  
  await mysql.query(`
    UPDATE player_synthesis SET
      ${fieldName} = CASE 
        WHEN ? THEN 0 
        ELSE ${fieldName} + 1 
      END,
      total_synthesis = total_synthesis + 1,
      success_upgrade = success_upgrade + ?,
      guaranteed_upgrade = guaranteed_upgrade + ?,
      badge_upgrade = badge_upgrade + ?,
      recent_records = JSON_ARRAY_INSERT(
        COALESCE(recent_records, JSON_ARRAY()),
        '$[0]',
        CAST(? AS JSON)
      ),
      recent_records = CASE
        WHEN JSON_LENGTH(recent_records) > 30 THEN
          JSON_REMOVE(recent_records, '$[30]')
        ELSE recent_records
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ?
  `, [
    isUpgrade,                    // 是否重置计数
    isUpgrade ? 1 : 0,           // 成功升级次数
    isGuaranteed ? 1 : 0,        // 保底触发次数
    useBadge ? 1 : 0,            // 徽章保底次数
    JSON.stringify(record),       // 新记录
    playerId
  ]);
  
  return {
    success: true,
    record,
    resultEquipmentId
  };
}

// 3. 获取合成历史记录
async function getSynthesisHistory(playerId, limit = 30) {
  const [rows] = await mysql.query(
    'SELECT recent_records FROM player_synthesis WHERE player_id = ?',
    [playerId]
  );
  
  if (!rows.length || !rows[0].recent_records) {
    return [];
  }
  
  const records = JSON.parse(rows[0].recent_records);
  return records.slice(0, limit);
}

// 4. 获取统计数据
async function getSynthesisStats(playerId) {
  const [rows] = await mysql.query(`
    SELECT 
      total_synthesis,
      success_upgrade,
      guaranteed_upgrade,
      badge_upgrade,
      ROUND(success_upgrade * 100.0 / NULLIF(total_synthesis, 0), 2) as success_rate
    FROM player_synthesis 
    WHERE player_id = ?
  `, [playerId]);
  
  return rows[0] || {
    total_synthesis: 0,
    success_upgrade: 0,
    guaranteed_upgrade: 0,
    badge_upgrade: 0,
    success_rate: 0
  };
}
```

**优势对比**：

| 维度 | 原设计（2个表） | 新设计（1个表） |
|------|----------------|----------------|
| **查询性能** | 需要JOIN两个表 | ✅ 单表查询，更快 |
| **数据一致性** | 需要事务保证 | ✅ 天然一致 |
| **存储空间** | 2个表的索引开销 | ✅ 1个表，节省空间 |
| **维护成本** | 需要维护2个表 | ✅ 只维护1个表 |
| **历史记录** | 完整保留30天 | ✅ 保留最近30条 |
| **数据分析** | 可查询完整历史 | ✅ 可分析最近30条 |
| **架构复杂度** | 较复杂 | ✅ 更简洁 |

---

#### 3.2.9 AI玩家配置表 (ai_players)

**说明**：存储AI玩家的行为配置和统计数据，用于管理和调度AI玩家行为。

```sql
CREATE TABLE ai_players (
  player_id VARCHAR(4) PRIMARY KEY COMMENT 'AI玩家ID（关联accounts.id，格式：A + 3位字符）',
  ai_type ENUM('active', 'elite') NOT NULL COMMENT 'AI类型（active=活跃型70%，elite=精英型30%）',
  
  -- 行为配置
  event_participation_types VARCHAR(100) DEFAULT 'daily' COMMENT '参与事件类型（active=daily仅日常事件，elite=all所有事件）',
  pvp_participation VARCHAR(20) DEFAULT 'defense_only' COMMENT 'PVP参与（active=defense_only仅防守，elite=all全部）',
  chat_frequency DECIMAL(3,2) DEFAULT 0.35 COMMENT '聊天频率（每20分钟35%概率）',
  
  -- 行为策略
  battle_strategy ENUM('balanced', 'aggressive') DEFAULT 'balanced' COMMENT '战斗策略（active=balanced，elite=aggressive）',
  resource_strategy ENUM('basic', 'optimal') DEFAULT 'basic' COMMENT '资源策略（active=basic，elite=optimal）',
  
  -- 统计数据
  total_logins INT DEFAULT 0 COMMENT '总登录次数（事件触发次数）',
  total_battles INT DEFAULT 0 COMMENT '总战斗次数',
  total_chats INT DEFAULT 0 COMMENT '总聊天次数',
  total_events_completed INT DEFAULT 0 COMMENT '完成事件总数',
  
  -- 表现评分（用于大司空任命）
  performance_score DECIMAL(10,2) DEFAULT 0.00 COMMENT '表现评分（声望*0.3+贡献*0.3+胜率*100*0.2+事件数*0.2）',
  
  -- 状态
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  last_behavior_update DATETIME COMMENT '最后行为更新时间',
  last_chat_time DATETIME COMMENT '最后聊天时间（用于聊天频率控制）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_ai_type (ai_type),
  INDEX idx_is_active (is_active),
  INDEX idx_performance_score (performance_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI玩家配置表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `player_id` | AI玩家ID | 格式：A + 3位字符（如：A1B2） |
| `ai_type` | AI类型 | active=活跃型（70%），elite=精英型（30%） |
| `event_participation_types` | 参与事件类型 | active=daily（仅日常事件），elite=all（所有事件） |
| `pvp_participation` | PVP参与 | active=defense_only（仅防守），elite=all（全部） |
| `chat_frequency` | 聊天频率 | 每20分钟35%概率，随机延迟0-20分钟 |
| `battle_strategy` | 战斗策略 | active=balanced，elite=aggressive |
| `resource_strategy` | 资源策略 | active=basic，elite=optimal |
| `performance_score` | 表现评分 | 用于大司空任命评估 |

**AI类型配置**：

| AI类型 | 登录状态 | 参与事件类型 | PVP参与 | 聊天频率 | 战斗策略 | 初始官职 | 官职稀有度 | 属性范围 | 技能数量 | 占比 |
|--------|---------|------------|---------|---------|---------|---------|-----------|---------|---------|------|
| active | 事件驱动 | 仅日常事件 | 仅防守 | 每20分钟35%概率 | balanced | 都尉 | rare (2) | 5.0-7.0 | 2个（1主动+1被动） | 70% |
| elite | 事件驱动 | 所有事件 | 全部 | 每20分钟35%概率 | aggressive | 中郎将 | epic (3) | 7.0-8.5 | 2个（1主动+1被动） | 30% |

**数据示例**：

```javascript
// Active AI玩家（活跃型，70%）
{
  player_id: 'A1B2',
  ai_type: 'active',
  event_participation_types: 'daily',  // 仅日常事件
  pvp_participation: 'defense_only',  // 仅防守
  chat_frequency: 0.35,  // 每20分钟35%概率
  battle_strategy: 'balanced',
  resource_strategy: 'basic',
  total_events_completed: 0,
  performance_score: 0.00,
  is_active: true,
  last_chat_time: null
}

// Elite AI玩家（精英型，30%）
{
  player_id: 'A2C3',
  ai_type: 'elite',
  event_participation_types: 'all',  // 所有事件
  pvp_participation: 'all',  // 全部参与
  chat_frequency: 0.35,  // 每20分钟35%概率
  battle_strategy: 'aggressive',
  resource_strategy: 'optimal',
  total_events_completed: 0,
  performance_score: 0.00,
  is_active: true,
  last_chat_time: null
}
```

**重要说明**：
- `event_participation_types`：AI玩家参与的事件类型（active=daily仅日常事件，elite=all所有事件）
- `pvp_participation`：PVP参与方式（active=defense_only仅防守，elite=all全部参与）
- `chat_frequency`：两种类型都是35%概率，通过`last_chat_time`控制频率
    { hour: 12, probability: 0.4 },
    { hour: 18, probability: 0.6 },
    { hour: 20, probability: 0.7 }
  ],
  task_completion_rate: 0.70,
  pvp_participation_rate: 0.30,
  chat_frequency: 0.10,
  battle_strategy: 'balanced',
  resource_strategy: 'planned',
  is_active: true
}

// 精英AI玩家
{
  player_id: 'A3D4',
  ai_type: 'elite',
  login_schedule: [
    { hour: 8, probability: 0.8 },
    { hour: 12, probability: 0.6 },
    { hour: 14, probability: 0.5 },
    { hour: 18, probability: 0.8 },
    { hour: 20, probability: 0.9 },
    { hour: 22, probability: 0.7 }
  ],
  task_completion_rate: 0.95,
  pvp_participation_rate: 0.80,
  chat_frequency: 0.30,
  battle_strategy: 'aggressive',
  resource_strategy: 'optimal',
  is_active: true
}
```

**查询示例**：

```javascript
// 1. 查询所有活跃的AI玩家
SELECT a.*, ai.*
FROM accounts a
INNER JOIN ai_players ai ON a.id = ai.player_id
WHERE a.account_type = 'ai' 
  AND ai.is_active = TRUE
  AND a.status = 'active';

// 2. 查询某个势力的AI玩家
SELECT p.*, ai.ai_type, ai.battle_strategy
FROM players p
INNER JOIN ai_players ai ON p.player_id = ai.player_id
WHERE p.faction_id = 'san_1_faction_1001';

// 3. 查询需要执行行为的AI玩家（当前小时）
SELECT a.*, ai.*
FROM accounts a
INNER JOIN ai_players ai ON a.id = ai.player_id
WHERE a.account_type = 'ai'
  AND ai.is_active = TRUE
  AND JSON_CONTAINS(
    ai.login_schedule,
    JSON_OBJECT('hour', HOUR(NOW())),
    '$'
  );

// 4. 统计各类型AI玩家数量
SELECT ai_type, COUNT(*) as count
FROM ai_players
WHERE is_active = TRUE
GROUP BY ai_type;
```

**业务规则**：

1. **AI玩家创建**：
   - AI玩家ID格式：A + 3位字符（如：A1B2、A2C3）
   - 创建账号时设置 `account_type = 'ai'`
   - 同时创建 `ai_players` 表记录
   - 根据AI类型自动配置行为参数

2. **AI行为调度**：
   - 每10分钟检查一次所有AI玩家
   - 根据 `login_schedule` 决定是否执行行为
   - 根据各种概率参数决定具体行为
   - 更新统计数据

3. **AI动态调整**：
   - 根据真人玩家数量自动增减AI玩家
   - 优先移除基础AI，保留活跃和精英AI
   - 保持服务器80%以上满员

4. **AI标识**：
   - AI玩家ID以"A"开头，可公开
   - 前端可以显示AI标识（可选）
   - 不影响游戏体验和公平性

---

### 称号系统数据格式

**已解锁称号列表**：
```javascript
// unlocked_titles 字段
["title_001", "title_002", "title_005"]
```

**称号解锁进度**：
```javascript
// title_progress 字段
{
  "title_001": {  // 百战将军
    "unlocked": true,
    "unlockedAt": "2026-03-07T10:30:00.000Z",
    "progress": {
      "win_battles": {
        "current": 10,
        "required": 10
      }
    }
  },
  "title_002": {  // 仁德之君
    "unlocked": false,
    "progress": {
      "charisma_level": {
        "current": 75,
        "required": 80
      }
    }
  },
  "title_003": {  // 攻城略地
    "unlocked": false,
    "progress": {
      "capture_cities": {
        "current": 3,
        "required": 5
      }
    }
  }
}
```

**称号卡装备逻辑**：
1. 玩家完成条件后，称号解锁（`unlocked: true`）
2. 系统自动生成称号卡，存入 `player_cards` 表（`card_type = 'title'`）
3. 玩家可以将称号卡装备到编组槽位（通过 `player_cards.is_equipped` + `equipped_slot = 'title'`）

---

### 成就系统数据格式

**已解锁成就列表**：
```javascript
// unlocked_achievements 字段
["san_1_achi_2_1001", "san_1_achi_4_3001", "san_1_achi_5_2001"]
```

**成就解锁进度**：
```javascript
// achievement_progress 字段
{
  "san_1_achi_2_1001": {  // 初战告捷（战斗类）
    "unlocked": true,
    "unlockedAt": "2026-03-07T08:00:00.000Z",
    "progress": {
      "win_battles": {
        "current": 10,
        "required": 10
      }
    }
  },
  "san_1_achi_2_3001": {  // 百战将军（战斗类）
    "unlocked": false,
    "progress": {
      "win_battles": {
        "current": 72,
        "required": 100
      }
    }
  },
  "san_1_achi_4_3001": {  // 兵种图鉴（收集类）
    "unlocked": true,
    "unlockedAt": "2026-03-07T12:00:00.000Z",
    "progress": {
      "recruit_characters": {
        "current": 10,
        "required": 10
      }
    }
  }
}
```

**成就卡装备逻辑**：
1. 玩家完成条件后，成就解锁（`unlocked: true`）
2. 系统自动生成成就卡，存入 `player_cards` 表（`card_type = 'achievement'`）
3. 玩家可以将成就卡装备到编组槽位（通过 `player_cards.is_equipped` + `equipped_slot = 'achievement'`）

---

### 事件系统数据格式

游戏中有5种事件类型，每种类型存储在对应的字段中：

**1. 历史事件** (`historical_events`) - 类型编号：1
- ID范围：`san_x_event_1001-1999`
- 特点：基于真实历史，稀有度高，奖励丰厚
- 示例：桃园结义、虎牢关之战、三顾茅庐

**2. 虚构事件** (`fictional_events`) - 类型编号：2
- ID范围：`san_x_event_2001-2999`
- 特点：原创剧情，创意自由，支持连锁事件
- 示例：穿越时空、神秘商人、异界来客

**3. 日常事件** (`daily_events`) - 类型编号：3
- ID范围：`san_x_event_3001-3999`
- 特点：触发频率高，每日重置，包含每日任务
- 示例：市集购物、路遇强盗、每日征战、招贤纳士

**4. 周常事件** (`weekly_events`) - 类型编号：4
- ID范围：`san_x_event_4001-4999`
- 特点：每周刷新，奖励丰厚，有挑战性
- 示例：武道大会、商队护送、周常征服

**5. 迷你游戏** (`mini_events`) - 类型编号：5
- ID范围：`san_x_event_5001-5999`
- 特点：互动性强，技巧性玩法，独特奖励
- 示例：五子棋对弈、投壶比赛、射箭竞技

**事件进度数据格式**：

```javascript
// 历史事件进度示例
{
  "san_1_event_1001": {  // 桃园结义
    "completed": true,
    "completedAt": "2026-03-07T10:30:00.000Z",
    "result": "success",
    "fortuneLevel": "excellent"
  },
  "san_1_event_1002": {  // 虎牢关之战
    "completed": false,
    "attempts": 2,
    "lastAttemptAt": "2026-03-07T12:00:00.000Z"
  }
}

// 日常事件进度示例
{
  "san_1_event_3101": {  // 每日征战
    "objectives": [
      {
        "type": "complete_battle",
        "count": 3,
        "current": 2,
        "completed": false
      }
    ],
    "resetTime": "daily_00:00",
    "lastResetAt": "2026-03-07T00:00:00.000Z"
  }
}

// 周常事件进度示例
{
  "san_1_event_4101": {  // 周常征服
    "objectives": [
      {
        "type": "capture_city",
        "count": 5,
        "current": 3,
        "completed": false
      }
    ],
    "resetTime": "weekly_monday_00:00",
    "lastResetAt": "2026-03-03T00:00:00.000Z"
  }
}
```

---

### 战役系统数据格式

**战役进度数据**：
```javascript
// campaign_progress 字段
{
  "san_1_camp_0001_v1": {  // 长社战役（汉军视角）
    "completed": true,
    "completedAt": "2026-03-07T14:00:00.000Z",
    "unlockedAt": "2026-03-07T10:00:00.000Z",  // 解锁时间（用于计算7天期限）
    "expiresAt": "2026-03-14T10:00:00.000Z",  // 过期时间（解锁后7天）
    "difficulty": 3,  // 完成时的难度等级（1-5星）
    "bestRanking": 5,  // 最佳排名（基于bestScore在所有玩家中的排名）
    "bestScore": 3681,  // 最佳分数（来自战后评分系统）
    "bestGrade": "A",  // 最佳评级（S/A/B/C/D，来自战后评分系统）
    "playCount": 3,  // 游玩次数
    "maxPlayCount": 3,  // 最大挑战次数（固定为3次）
    "remainingPlays": 0,  // 剩余挑战次数（3 - playCount）
    "lastPlayedAt": "2026-03-07T14:00:00.000Z",
    "playHistory": [  // 挑战历史记录
      {
        "playedAt": "2026-03-07T12:00:00.000Z",
        "score": 2500,
        "grade": "B",
        "turns": 6,
        "ranking": 15
      },
      {
        "playedAt": "2026-03-07T13:00:00.000Z",
        "score": 3200,
        "grade": "A",
        "turns": 5,
        "ranking": 8
      },
      {
        "playedAt": "2026-03-07T14:00:00.000Z",
        "score": 3681,
        "grade": "A",
        "turns": 5,
        "ranking": 5
      }
    ],
    "rewards": {
      "food": 1500,  // 已获得粮草（含排名奖励）
      "silver": 750,  // 已获得银两（含排名奖励）
      "badge": 1  // 已获得赛季徽章
    }
  },
  "san_1_camp_0001_v2": {  // 长社战役（黄巾视角）
    "completed": false,
    "unlocked": true,  // 是否已解锁
    "unlockedAt": "2026-03-07T10:00:00.000Z",
    "expiresAt": "2026-03-14T10:00:00.000Z",
    "attempts": 2,  // 尝试次数（失败的次数，不计入playCount）
    "playCount": 2,  // 已挑战次数
    "maxPlayCount": 3,
    "remainingPlays": 1,  // 还可以挑战1次
    "lastAttemptAt": "2026-03-07T15:00:00.000Z"
  },
  "san_1_camp_0002": {  // 长坂坡战役
    "completed": false,
    "unlocked": false,  // 未解锁（需要完成前置战役）
    "unlockedAt": null,
    "expiresAt": null
  },
  "san_1_camp_0003": {  // 已过期的战役
    "completed": false,
    "unlocked": true,
    "unlockedAt": "2026-02-20T10:00:00.000Z",
    "expiresAt": "2026-02-27T10:00:00.000Z",  // 已过期
    "expired": true,  // 标记为已过期
    "playCount": 1,
    "maxPlayCount": 3,
    "remainingPlays": 0,  // 已过期，无法再挑战
    "lastPlayedAt": "2026-02-21T10:00:00.000Z"
  }
}
```

**战役挑战规则**：

1. **挑战次数限制**：
   - 每个战役最多挑战 **3次**（之前是2次，现已调整为3次）
   - `playCount` 记录已挑战次数（包括成功和失败）
   - `remainingPlays = maxPlayCount - playCount`
   - 达到3次后，无法再挑战该战役

2. **时间限制（7天期限）**：
   - 战役解锁后，玩家有 **7天** 时间进行挑战
   - `unlockedAt` 记录解锁时间
   - `expiresAt = unlockedAt + 7天`
   - 超过7天后，`expired = true`，无法再挑战
   - 目的：防止玩家等待获得高级部队和将领后来刷分

3. **挑战条件检查**：
   ```javascript
   // 检查是否可以挑战
   function canChallengeCampaign(campaignProgress) {
     // 1. 必须已解锁
     if (!campaignProgress.unlocked) {
       return { canChallenge: false, reason: '战役未解锁' };
     }
     
     // 2. 检查是否过期
     const now = new Date();
     const expiresAt = new Date(campaignProgress.expiresAt);
     if (now > expiresAt) {
       return { canChallenge: false, reason: '战役已过期（超过7天）' };
     }
     
     // 3. 检查挑战次数
     if (campaignProgress.playCount >= campaignProgress.maxPlayCount) {
       return { canChallenge: false, reason: '已达到最大挑战次数（3次）' };
     }
     
     return { canChallenge: true };
   }
   ```

4. **解锁逻辑**：
   - 第一个战役默认解锁
   - 完成前一个战役后，立即解锁下一个战役
   - 解锁时自动设置 `unlockedAt` 和 `expiresAt`
   - 同一战役的不同变种（v1, v2）独立解锁

5. **奖励机制**：
   - 每次挑战都可以获得基础奖励
   - 排名奖励只在首次完成时获得
   - 重复挑战可以刷新排名，但不会重复获得排名奖励
   - 3次挑战机会用完后，无法再获得任何奖励

6. **战后评分系统集成**：
   - 战役完成后，通过**战后评分系统**计算得分（详见 `15-STATISTICS_RANKING_SYSTEM.md`）
   - 评分项目包括：
     - 消灭敌兵（白200/蓝330/紫460/橙600/金990分）
     - 连杀奖励（1.0x ~ 2.5x倍率）
     - 己方损失（-1.5倍惩罚）
     - 摧毁建筑（箭塔900/军营600/城门900/城墙600分）
     - 摧毁障碍物（拒马150/陷阱150分）
     - 开启宝箱（150分）
     - 回合倍率（1.0x ~ 1.4x倍率）
   - 根据得分评定等级：S（3000+）、A（2000-2999）、B（1000-1999）、C（500-999）、D（0-499）
   - 得分用于全服排名，排名决定额外奖励倍率

**战役类型说明**：

游戏中有5种战役类型：

1. **平原战** (`Field Battle`)
   - 特点：开阔地形的大规模野战
   - 地形：平原、丘陵
   - 示例：官渡战役、赤壁战役

2. **攻城战** (`Siege Battle`)
   - 特点：攻打敌方城池或要塞
   - 地形：城墙、城门、箭塔
   - 示例：虎牢关战役、长安城攻防

3. **防守战** (`Defense Battle`)
   - 特点：防守己方据点
   - 地形：城池、关隘
   - 示例：守卫城池、坚守阵地

4. **撤退战** (`Retreat Battle`)
   - 特点：掩护撤退或突围
   - 地形：多样化
   - 示例：长坂坡战役

5. **突袭战** (`Raid Battle`)
   - 特点：快速突袭敌方目标
   - 地形：多样化
   - 示例：夜袭乌巢、长社战役

**战役难度等级**：

| 难度 | 星级 | 推荐声望 | 奖励倍率 |
|------|------|---------|---------|
| 1星 | ⭐ | 0-200 | 1.0x |
| 2星 | ⭐⭐ | 200-400 | 1.2x |
| 3星 | ⭐⭐⭐ | 400-600 | 1.5x |
| 4星 | ⭐⭐⭐⭐ | 600-1000 | 2.0x |
| 5星 | ⭐⭐⭐⭐⭐ | 1000+ | 3.0x |

**战役解锁逻辑**：
1. 第一个战役默认解锁，立即设置 `unlockedAt` 和 `expiresAt`（7天后）
2. 完成前一个战役后，立即解锁下一个战役
3. 每个战役最多挑战 **3次**（`maxPlayCount = 3`）
4. 战役解锁后有 **7天** 挑战期限，超过7天无法挑战
5. 同一战役的不同变种（v1, v2）独立解锁，各有3次挑战机会和7天期限
6. 玩家可以在3次机会内重复挑战已完成的战役，刷新排名

---

### 进度更新示例

**更新称号进度**：
```javascript
// 玩家赢得一场战斗后
async function updateTitleProgress(playerId, titleId, progressKey, increment = 1) {
  await mysql.query(`
    UPDATE player_progress
    SET title_progress = JSON_SET(
      title_progress,
      '$.${titleId}.progress.${progressKey}.current',
      JSON_EXTRACT(title_progress, '$.${titleId}.progress.${progressKey}.current') + ?
    )
    WHERE player_id = ?
  `, [increment, playerId]);
  
  // 检查是否达成条件
  const [rows] = await mysql.query(`
    SELECT JSON_EXTRACT(title_progress, '$.${titleId}') as progress
    FROM player_progress
    WHERE player_id = ?
  `, [playerId]);
  
  const progress = JSON.parse(rows[0].progress);
  if (progress.progress[progressKey].current >= progress.progress[progressKey].required) {
    // 解锁称号
    await unlockTitle(playerId, titleId);
  }
}

// 解锁称号
async function unlockTitle(playerId, titleId) {
  // 1. 更新进度表
  await mysql.query(`
    UPDATE player_progress
    SET 
      unlocked_titles = JSON_ARRAY_APPEND(unlocked_titles, '$', ?),
      title_progress = JSON_SET(
        title_progress,
        '$.${titleId}.unlocked', true,
        '$.${titleId}.unlockedAt', NOW()
      )
    WHERE player_id = ?
  `, [titleId, playerId]);
  
  // 2. 生成称号卡
  const instanceId = `title_inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await mysql.query(`
    INSERT INTO player_cards SET
      instance_id = ?,
      player_id = ?,
      card_type = 'title',
      card_id = ?,
      rarity = 'rare',
      obtained_at = NOW()
  `, [instanceId, playerId, titleId]);
  
  // 3. 通知玩家
  notifyPlayer(playerId, {
    type: 'title_unlocked',
    titleId: titleId,
    instanceId: instanceId
  });
}
```

**更新成就进度**：
```javascript
// 玩家攻占城市后
async function updateAchievementProgress(playerId, achievementId, progressKey, increment = 1) {
  await mysql.query(`
    UPDATE player_progress
    SET achievement_progress = JSON_SET(
      achievement_progress,
      '$.${achievementId}.progress.${progressKey}.current',
      JSON_EXTRACT(achievement_progress, '$.${achievementId}.progress.${progressKey}.current') + ?
    )
    WHERE player_id = ?
  `, [increment, playerId]);
  
  // 检查是否达成条件
  const [rows] = await mysql.query(`
    SELECT JSON_EXTRACT(achievement_progress, '$.${achievementId}') as progress
    FROM player_progress
    WHERE player_id = ?
  `, [playerId]);
  
  const progress = JSON.parse(rows[0].progress);
  if (progress.progress[progressKey].current >= progress.progress[progressKey].required) {
    // 解锁成就
    await unlockAchievement(playerId, achievementId);
  }
}
```

---
#### 3.2.10 势力运行时数据表 (factions)

**说明**：存储势力的运行时数据，包括资源储备、统计数据等。

```sql
CREATE TABLE factions (
  id VARCHAR(50) PRIMARY KEY COMMENT '势力ID（如：san_1_faction_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1）',
  faction_name VARCHAR(100) NOT NULL COMMENT '势力名称',
  
  -- 资源储备（30%的城市产出）
  silver_reserve INT DEFAULT 0 COMMENT '银两储备',
  food_reserve INT DEFAULT 0 COMMENT '粮草储备',
  
  -- 每日卡池质量（由AI君主计算）
  troop_orange_probability DECIMAL(5,4) DEFAULT 0 COMMENT '部队橙卡概率（如：0.0500表示5%）',
  character_orange_probability DECIMAL(5,4) DEFAULT 0 COMMENT '将领橙卡概率（如：0.0500表示5%）',
  
  -- 统计数据
  player_count INT DEFAULT 0 COMMENT '玩家数量',
  city_count INT DEFAULT 0 COMMENT '占领城市数',
  total_power BIGINT DEFAULT 0 COMMENT '总战力',
  
  -- 时间戳
  last_settlement_at DATETIME COMMENT '最后结算时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_faction_name (faction_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力运行时数据表';
```

**字段说明**：

| 字段名 | 说明 | 用途 |
|--------|------|------|
| `silver_reserve` | 银两储备 | 每日结算时，30%的银两产出存入储备 |
| `food_reserve` | 粮草储备 | 每日结算时，30%的粮草产出存入储备 |
| `troop_orange_probability` | 部队橙卡概率 | 由AI君主根据城市平均军事值计算 |
| `character_orange_probability` | 将领橙卡概率 | 由AI君主根据城市平均文化值计算 |

**资源储备用途**（具体消耗数量待定）：
- 🏰 发动战事：攻城战、对决战、掠夺战等
- 📜 发布事件：城市发展事件（人口、商业、农业、军事、文化）
- 🔬 势力建设：科技研究、外交活动、特殊建筑等
- 🎖️ 奖励发放：势力任务奖励、活动奖励等

---

#### 3.2.11 城市数据表 (cities)

**说明**：存储城市的运行时数据，包括五大属性、长官、驻军等。

```sql
CREATE TABLE cities (
  id VARCHAR(50) PRIMARY KEY COMMENT '城市ID（如：san_1_city_luoyang）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1）',
  city_name VARCHAR(100) NOT NULL COMMENT '城市名称',
  city_type ENUM('city_major', 'city_medium', 'city_small', 'gate', 'fort') NOT NULL COMMENT '城市类型',
  
  -- 所属势力
  faction_id VARCHAR(50) COMMENT '所属势力ID',
  
  -- 地理位置
  region VARCHAR(50) COMMENT '所属地区（如：司隶、冀州）',
  position_x INT COMMENT '地图X坐标',
  position_y INT COMMENT '地图Y坐标',
  
  -- 五大属性（仅大城/中城/小城有，关隘/要塞无）
  population INT DEFAULT 0 COMMENT '人口（关隘/要塞为NULL）',
  commerce INT DEFAULT 0 COMMENT '商业值（关隘/要塞为NULL）',
  agriculture INT DEFAULT 0 COMMENT '农业值（关隘/要塞为NULL）',
  military INT DEFAULT 0 COMMENT '军事值（关隘/要塞为NULL）',
  culture INT DEFAULT 0 COMMENT '文化值（关隘/要塞为NULL）',
  
  -- 特色资源（仅中城有）
  special_resource_name VARCHAR(50) COMMENT '特色资源名称（如：盐场、铁矿）',
  special_resource_commerce INT DEFAULT 0 COMMENT '特色资源商业加成（固定+100）',
  special_resource_agriculture INT DEFAULT 0 COMMENT '特色资源农业加成（固定+100）',
  
  -- 最终属性（含人口加成和特色资源）
  final_commerce INT DEFAULT 0 COMMENT '最终商业值（用于资源结算）',
  final_agriculture INT DEFAULT 0 COMMENT '最终农业值（用于资源结算）',
  
  -- 长官系统（大城无长官）
  governor_player_id VARCHAR(50) COMMENT '长官玩家ID',
  governor_appointed_at DATETIME COMMENT '长官任命时间',
  
  -- 防御属性
  defense INT DEFAULT 0 COMMENT '防御力',
  
  -- 建筑
  has_main_palace BOOLEAN DEFAULT FALSE COMMENT '是否有主殿（AI君主处所，仅大城）',
  has_three_ministers_palace BOOLEAN DEFAULT FALSE COMMENT '是否有三公府（仅大城）',
  has_side_palace BOOLEAN DEFAULT FALSE COMMENT '是否有偏殿（AI大司空处所，仅中城）',
  has_special_resource_building BOOLEAN DEFAULT FALSE COMMENT '是否有特色资源建筑（仅中城）',
  garrison_capacity INT DEFAULT 0 COMMENT '驻军所容量',
  
  -- NPC守军（攻城PVE系统）
  npc_garrison JSON COMMENT 'NPC守军配置（部队+将领数组，消灭后设为NULL）',
  npc_garrison_alive INT DEFAULT 0 COMMENT 'NPC守军存活数量',
  npc_max_rarity VARCHAR(20) DEFAULT 'rare' COMMENT 'NPC守军最高稀有度',
  
  -- 城市状态
  status ENUM('neutral', 'contested', 'owned') DEFAULT 'neutral' COMMENT '城市状态（neutral=中立/contested=争夺中/owned=已占领）',
  
  -- 特殊建筑（仅大城，n选2）
  special_building_1 VARCHAR(50) COMMENT '特殊建筑1（如：太学、铸币厂、兵工厂等）',
  special_building_1_level INT DEFAULT 0 COMMENT '特殊建筑1等级（0=未建造）',
  special_building_1_started_at DATETIME COMMENT '特殊建筑1开始建造时间',
  special_building_1_completed_at DATETIME COMMENT '特殊建筑1完成时间',
  
  special_building_2 VARCHAR(50) COMMENT '特殊建筑2（如：太学、铸币厂、兵工厂等）',
  special_building_2_level INT DEFAULT 0 COMMENT '特殊建筑2等级（0=未建造）',
  special_building_2_started_at DATETIME COMMENT '特殊建筑2开始建造时间',
  special_building_2_completed_at DATETIME COMMENT '特殊建筑2完成时间',
  
  -- 特殊属性
  is_capital BOOLEAN DEFAULT FALSE COMMENT '是否是首都',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE SET NULL,
  FOREIGN KEY (governor_player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  INDEX idx_season (season),
  INDEX idx_faction (faction_id),
  INDEX idx_city_type (city_type),
  INDEX idx_governor (governor_player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='城市数据表';
```

**字段说明**：

| 字段名 | 说明 | 计算公式 |
|--------|------|---------|
| `population` | 人口 | 通过事件增长，不自动增长 |
| `commerce` | 商业值 | 基础值，可通过事件提升 |
| `agriculture` | 农业值 | 基础值，可通过事件提升 |
| `military` | 军事值 | 基础值，可通过事件提升 |
| `culture` | 文化值 | 基础值，可通过事件提升 |
| `final_commerce` | 最终商业值 | commerce + floor(population/1000)*5 + special_resource_commerce |
| `final_agriculture` | 最终农业值 | agriculture + floor(population/1000)*5 + special_resource_agriculture |

**人口加成规则**：
- 每1000人口 → +5商业值，+5农业值
- 不影响军事值和文化值

**特色资源规则**（仅中城）：
- 统一加成：+100商业值，+100农业值
- 不影响军事值和文化值

**长官收益**（每日独立发放）：

| 城市类型 | 银两 | 粮草 |
|---------|------|------|
| 中城 | 200 | 1000 |
| 小城 | 100 | 500 |
| 关隘 | 100 | 500 |
| 要塞 | 50 | 250 |

**驻军所容量**：

| 城市类型 | 容量 |
|---------|------|
| 大城 | 2000 |
| 中城 | 1000 |
| 小城 | 500 |
| 关隘 | 1000 |
| 要塞 | 500 |

---

#### 3.2.12 军团表 (legions)

**说明**：存储势力内的军团编组信息，用于组织管理和任务分配。

```sql
CREATE TABLE legions (
  legion_id VARCHAR(50) PRIMARY KEY COMMENT '军团ID（如：san_1_legion_1001）',
  legion_name VARCHAR(50) NOT NULL COMMENT '军团名称',
  faction_id VARCHAR(50) NOT NULL COMMENT '所属势力ID',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1）',
  
  -- 军团长官
  commander_id VARCHAR(4) NOT NULL COMMENT '军团长官ID（3-1阶官职）',
  commander_position_id VARCHAR(50) COMMENT '长官官职ID（用于验证权限）',
  
  -- 成员管理
  member_count INT DEFAULT 0 COMMENT '当前成员数',
  max_members INT DEFAULT 30 COMMENT '最大成员数',
  
  -- 军团状态
  status ENUM('active', 'disbanded') DEFAULT 'active' COMMENT '军团状态',
  description TEXT COMMENT '军团描述',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE,
  FOREIGN KEY (commander_id) REFERENCES players(player_id),
  INDEX idx_faction (faction_id),
  INDEX idx_season (season),
  INDEX idx_commander (commander_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='军团表';
```

**字段说明**：

| 字段名 | 说明 | 用途 |
|--------|------|------|
| `legion_id` | 军团ID | 格式：`{season}_legion_{四位编号}`，如：`san_1_legion_1001`<br>第一位数字代表势力（1-9），后三位为序号（001-999） |
| `commander_id` | 军团长官 | 必须是3-1阶官职的玩家 |
| `commander_position_id` | 长官官职ID | 用于验证长官是否有权限管理军团 |
| `member_count` | 当前成员数 | 自动统计，最多30人 |
| `max_members` | 最大成员数 | 默认30人，可扩展 |

**军团功能**：
- 📨 **传书系统**：3-1阶官职可以给指定军团内的玩家发送传书（邮件）
- 📋 **任务指派**：三公发布任务时可以指定军团
- 🎁 **额外奖励**：军团完成特定事件可以获得额外奖励
- 👥 **组织管理**：便于势力内部的人员组织和协调

---

#### 3.2.13 军团成员表 (legion_members)

**说明**：存储军团成员关系，支持玩家加入/退出军团。

```sql
CREATE TABLE legion_members (
  legion_id VARCHAR(50) COMMENT '军团ID',
  player_id VARCHAR(4) COMMENT '玩家ID',
  
  -- 成员角色
  role ENUM('commander', 'member') DEFAULT 'member' COMMENT '角色（长官/成员）',
  
  -- 时间戳
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  
  PRIMARY KEY (legion_id, player_id),
  FOREIGN KEY (legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='军团成员表';
```

**字段说明**：

| 字段名 | 说明 | 用途 |
|--------|------|------|
| `legion_id` | 军团ID | 关联军团表 |
| `player_id` | 玩家ID | 关联玩家表 |
| `role` | 成员角色 | `commander`=长官，`member`=普通成员 |
| `joined_at` | 加入时间 | 记录玩家加入军团的时间 |

**业务规则**：
- 每个玩家只能加入一个军团
- 军团长官自动成为军团成员（role='commander'）
- 军团解散时，自动删除所有成员关系（CASCADE）
- 玩家退出势力时，自动退出军团（CASCADE）

**AI玩家支持**：
- ✅ AI玩家可以加入军团（player_id 以 'ai_' 开头）
- ✅ 增加军团战斗力和可用性
- ✅ 建议每个军团分配10-15个AI玩家
- ✅ AI玩家可以参与军团战斗和事件
- ❌ AI玩家不能发送军团聊天和传书
- 📊 服务器压力几乎为零

**与现有功能的集成**：
- **传书系统**：`texts` 表通过 `target_legion_id` 字段关联军团
- **事件系统**：`player_events` 表可以关联军团事件
- **聊天系统**：`chats` 表支持军团频道（channel_type='legion'）

---

#### 3.2.14 通信类数据保留对照表（battles / texts / chats）

**说明**：统一「通信浮层」相关数据的保存期限，供产品、运营与实现对照；**具体清理任务以实现代码与定时任务为准**。

| 数据类型 | 存储表 / 字段 | 默认保留 | 例外或补充说明 |
|---------|----------------|----------|----------------|
| **战报战斗记录（元数据）** | `battles` 整行 | **长期保留**（赛季/合服策略另定） | 摘要、结果、评分、收藏标记等不因日志清理而删除 |
| **战报战斗日志正文** | `battles.battle_log` | **约 14 天**（`log_expires_at` 到期后可清空） | **收藏**（`is_favorited = TRUE`）的战报：**日志不清理或按产品策略延长** |
| **传书（含系统/奖励/玩家/军团）** | `texts` 整行 | **14 天**（`expires_at`） | 到期后定时任务物理删除；软删除仅影响展示 |
| **聊天消息** | `chats` 整行 | **3 天**（`expires_at`） | 短留存、高吞吐；**当前实现以 MySQL 为准**；Redis 作热数据缓存为**后续可选**，见 [18-3](../10-core-system/18-3-CHAT_SYSTEM.md) §7 |

**关联文档**：

- 战报业务与 API：[18-1-BATTLE_REPORT_SYSTEM.md](../10-core-system/18-1-BATTLE_REPORT_SYSTEM.md)
- 传书：[18-2-TEXT_SYSTEM.md](../10-core-system/18-2-TEXT_SYSTEM.md)
- 聊天：[18-3-CHAT_SYSTEM.md](../10-core-system/18-3-CHAT_SYSTEM.md)
- 通信浮层 UI：[92-1-GAME_UI_DESIGN.md](../90-assets/92-1-GAME_UI_DESIGN.md) §1.7

---

#### 3.2.15 传书表 (texts)

**说明**：存储传书（邮件）系统的消息，支持玩家传书、军团传书、系统传书、奖励传书。

**与 `config_texts` 的关系**：`texts` 为运行时收件箱数据；`config_texts` 仅存**可复用的模板**（标题、正文、附件结构、`mail_type` 等）。后台「试发」或活动任务按模板向 `texts` 插入一行时，`sender_id` 仍使用占位账号 `sys1`（见下文「系统发件人」），`type` 取模板中的 `mail_type`（`system` / `reward`）。详见 §3.3.14。

```sql
CREATE TABLE texts (
  text_id VARCHAR(50) PRIMARY KEY COMMENT '传书ID',
  
  -- 类型和发送者
  type ENUM('player', 'legion', 'system', 'reward') NOT NULL COMMENT '传书类型',
  sender_id VARCHAR(4) NOT NULL COMMENT '发送者ID',
  sender_name VARCHAR(50) NOT NULL COMMENT '发送者名称（冗余）',
  sender_position VARCHAR(50) COMMENT '发送者官职（军团传书）',
  
  -- 接收者
  receiver_id VARCHAR(4) COMMENT '接收者ID（单发）',
  target_legion_id VARCHAR(50) COMMENT '目标军团ID（群发）',
  
  -- 内容
  subject VARCHAR(100) NOT NULL COMMENT '标题',
  content VARCHAR(1000) NOT NULL COMMENT '内容（最多1000字符）',
  
  -- 附件（JSON格式）
  attachments JSON COMMENT '附件（奖励）',
  is_claimed BOOLEAN DEFAULT FALSE COMMENT '附件是否已领取',
  claimed_at DATETIME COMMENT '领取时间',
  
  -- 状态
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否删除（软删除）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  read_at DATETIME COMMENT '阅读时间',
  expires_at DATETIME COMMENT '过期时间（创建时间+14天）',
  
  FOREIGN KEY (sender_id) REFERENCES players(player_id),
  FOREIGN KEY (receiver_id) REFERENCES players(player_id),
  FOREIGN KEY (target_legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  
  INDEX idx_receiver (receiver_id, is_read, is_deleted, created_at),
  INDEX idx_sender (sender_id, created_at),
  INDEX idx_legion (target_legion_id, created_at),
  INDEX idx_expires (expires_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传书表';
```

**字段说明**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `text_id` | VARCHAR(50) | 传书ID，格式：`text_{type}_{timestamp}` |
| `type` | ENUM | 传书类型：player/legion/system/reward |
| `sender_id` | VARCHAR(4) | 发送者ID |
| `receiver_id` | VARCHAR(4) | 接收者ID（单发时使用） |
| `target_legion_id` | VARCHAR(50) | 目标军团ID（群发时使用） |
| `subject` | VARCHAR(100) | 标题 |
| `content` | VARCHAR(1000) | 内容，最多1000字符 |
| `attachments` | JSON | 附件（奖励），字段名与游戏经济一致，如：`silver`、`food`、`reputation`、`contribution`、`morale`、`items`（数组）等，与事件/奖励发放逻辑对齐 |
| `is_claimed` | BOOLEAN | 附件是否已领取 |
| `is_read` | BOOLEAN | 是否已读 |
| `is_deleted` | BOOLEAN | 是否删除（软删除） |
| `expires_at` | DATETIME | 过期时间（创建时间+14天） |

**传书类型**：
- `player`：玩家传书（玩家间私密通信）
- `legion`：军团传书（军团长官给军团成员发送通知）
- `system`：系统传书（系统公告、通知）
- `reward`：奖励传书（事件奖励、活动奖励）

**业务规则**：
- 玩家传书：无等级限制，1分钟冷却，每天最多50封
- 军团传书：发送者须具备赛季配置的军团管理/发信权限（官职与权限位以 [12-POSITION_SYSTEM.md](../10-core-system/12-POSITION_SYSTEM.md) 及 `config_positions` 为准），1小时冷却，每天最多10封
- 系统传书：由系统自动发送
- 奖励传书：必有附件，需要手动领取
- 保留时间：14天，过期自动删除（总表见 §3.2.14）
- 军团解散时，相关军团传书自动删除（CASCADE）

**系统发件人（`sender_id` 外键）**：

- `type IN ('system','reward')` 时仍需满足 `sender_id` → `players(player_id)` 外键。
- **约定**：在 `players` 中预留**不可登录**的系统占位账号，`player_id = 'sys1'`（长度符合 `VARCHAR(4)`），`sender_name` 展示为「系统」。系统仅通过服务端任务写入传书，**不接受客户端伪造** `sender_id`。
- **部署**：须通过迁移/种子脚本插入该占位行（其余字段按项目可空或默认值填充）；**认证层须拒绝**以该 ID 登录。
- **理由**：保留外键与查询路径统一；避免 `sender_id` 可空带来的 JOIN/校验分支；审计上系统消息仍对应一行占位玩家记录。

**与军团系统的关系**：
- 军团长官可以给军团成员发送传书
- 通过 `target_legion_id` 关联军团表
- 军团解散时，相关传书自动删除

---

#### 3.2.16 聊天表 (chats)

**说明**：存储聊天系统的实时消息，支持天下频道、势力频道、军团频道。

**设计评审（合理性）**：
- `channel_type` + `channel_id`：世界为 `world` + `NULL`；势力为 `faction` + **势力 ID**（与 `players.faction_id` 一致）；军团为 `legion` + 军团 ID。查询模式与 `idx_channel (channel_type, channel_id, created_at)` 匹配。
- 发送者冗余字段：减少列表接口 JOIN，与传书 `texts` 的冗余策略一致。
- `expires_at`：建议应用层插入时即写入（创建时间 +3 天），与 §3.2.14 保留策略一致；清理任务按 `expires_at` 批量删除即可。
- **未包含**：举报、禁言等运营字段——首版可在应用层或后续表扩展；见 [18-3](../10-core-system/18-3-CHAT_SYSTEM.md)。

```sql
CREATE TABLE chats (
  chat_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '聊天ID（自增）',
  
  -- 频道信息
  channel_type ENUM('world', 'faction', 'legion') NOT NULL COMMENT '频道类型',
  channel_id VARCHAR(50) COMMENT '频道ID（势力ID或军团ID）',
  
  -- 发送者信息（冗余，减少JOIN）
  sender_id VARCHAR(4) NOT NULL COMMENT '发送者ID',
  sender_name VARCHAR(50) NOT NULL COMMENT '发送者名称',
  sender_faction_id VARCHAR(50) COMMENT '发送者势力ID',
  
  -- 内容
  content VARCHAR(100) NOT NULL COMMENT '内容（最多100字符）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  expires_at DATETIME COMMENT '过期时间（创建时间+3天）',
  
  FOREIGN KEY (sender_id) REFERENCES players(player_id),
  
  INDEX idx_channel (channel_type, channel_id, created_at),
  INDEX idx_sender (sender_id, created_at),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天表';
```

**字段说明**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `chat_id` | BIGINT | 聊天ID，自增，支持海量数据 |
| `channel_type` | ENUM | 频道类型：world/faction/legion |
| `channel_id` | VARCHAR(50) | 频道ID（势力ID或军团ID），world频道为NULL |
| `sender_id` | VARCHAR(4) | 发送者ID |
| `sender_name` | VARCHAR(50) | 发送者名称（冗余，减少JOIN） |
| `sender_faction_id` | VARCHAR(50) | 发送者势力ID（冗余，用于显示势力标识） |
| `content` | VARCHAR(100) | 内容，最多100字符 |
| `created_at` | DATETIME | 发送时间 |
| `expires_at` | DATETIME | 过期时间（创建时间+3天） |

**频道类型**：
- `world`：天下频道（全服可见）
- `faction`：势力频道（仅本势力成员；`channel_id` 为势力 ID）
- `legion`：军团频道（军团内部）

**发言权限**（官职等级 `position_level` 定义见 [12-POSITION_SYSTEM.md](../10-core-system/12-POSITION_SYSTEM.md)；**等级数字越小官职越高**）：
- 天下频道：至少为**都尉**（`position_level <= 7`），30秒冷却，每天最多50条
- 势力频道：至少为**都尉**（`position_level <= 7`），10秒冷却，每天最多50条
- 军团频道：至少为**中郎将**（`position_level <= 5`），10秒冷却，每天最多50条

**业务规则**：
- 保留时间：3天，过期自动删除（总表见 §3.2.14）
- 内容长度：最多100字符
- 实时推送：通过 WebSocket 推送给在线玩家（实现见 [18-3](../10-core-system/18-3-CHAT_SYSTEM.md)）
- **UI 展示**：势力频道 Tab/前缀使用 **势力展示名**（如刘备、曹操），取自 `config_factions` 等与赛季一致的配置；**不**以「州名」作为主展示名（全州名规则未单独定稿时避免硬编码州映射）

**Redis（可选，后续）**：最新消息列表缓存、冷却键等可在接入 Redis 后补充；**未接入前以 MySQL 为权威**。

---

#### 3.2.17 战斗记录表 (battles)

```sql
CREATE TABLE battles (
  -- 战报主键：服务端曾用 siege_pvp_${warId}_… 拼接导致超长；现约定 ≤48 字符随机 id + 列宽 VARCHAR(80)
  battle_id VARCHAR(80) PRIMARY KEY COMMENT '战斗ID',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  war_id VARCHAR(50) COMMENT '战事ID（可选，NULL表示非战事战斗）',
  
  -- 战斗类型（精简分类）
  battle_type ENUM(
    'pvp_field',        -- 平原PVP
    'pvp_siege',        -- 攻城PVP（含披挂遇袭服务端裁定写入的攻城方战报）
    'pvp_defense',      -- 守城PVP
    'pve_campaign',     -- 战役PVE
    'pve_event',        -- 事件PVE（流寇、黄巾军、诸侯、教学等）
    'pve_siege'         -- 攻城PVE（驻地/NPC 守军等：客户端 BattleArena 战后 POST /api/battles）
  ) NOT NULL COMMENT '战斗类型',
  
  -- 对手类型（精简分类）
  opponent_type ENUM(
    'player',           -- 玩家对手
    'campaign_enemy',   -- 战役敌人
    'event_enemy'       -- 事件敌人（流寇、黄巾军、诸侯、教学等）
  ) NOT NULL COMMENT '对手类型',
  
  opponent_id VARCHAR(50) COMMENT '对手ID（玩家ID或AI配置ID）',
  opponent_name VARCHAR(100) COMMENT '对手名称（玩家名或AI名称）',
  
  result ENUM('win', 'lose', 'draw') NOT NULL COMMENT '战斗结果',
  
  -- 战斗数据
  player_team JSON COMMENT '玩家队伍配置（简化版）',
  opponent_team JSON COMMENT '对手队伍配置（简化版）',
  battle_log TEXT COMMENT '战斗文字描述（简略记录每回合操作）',
  
  -- 战斗统计
  total_damage_dealt INT COMMENT '造成伤害',
  total_damage_taken INT COMMENT '受到伤害',
  total_kills INT COMMENT '击杀数',
  duration INT COMMENT '战斗时长（秒）',
  
  -- 奖励
  rewards JSON COMMENT '战斗奖励',
  
  -- 日志管理
  is_favorited BOOLEAN DEFAULT FALSE COMMENT '是否收藏（收藏后不会过期）',
  log_expires_at DATETIME COMMENT '日志过期时间（14天后，收藏的日志不过期）',
  
  battle_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '战斗时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_war_id (war_id),
  INDEX idx_battle_type (battle_type),
  INDEX idx_opponent_type (opponent_type),
  INDEX idx_result (result),
  INDEX idx_battle_at (battle_at),
  INDEX idx_favorited (is_favorited),
  INDEX idx_log_expires (log_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战斗记录表';
```

> **迁移（与代码对齐）**：若库表为早期脚本且缺少 `pve_siege` 或 `battle_id` 仍为 `VARCHAR(50)`，请执行仓库内  
> `backend/database/migrations/alter-battles-pve-siege-and-battle-id.sql`（为 ENUM 增加 `pve_siege`，并将 `battle_id` 放宽至 `VARCHAR(80)`）。  
> 服务端披挂裁定写库已改用短 `battle_id`（`backend/utils/battleId.js`），避免超长主键插入失败。

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `battle_id` | 主键 | **推荐 VARCHAR(80)**；与 `pvp_siege_att_…` 等短 id 及历史 warId 拼接方案兼容 |
| `battle_type` | 战斗类型 | **6** 种：`pvp_*` / `pve_campaign` / `pve_event` / **`pve_siege`（攻城PVE）** |
| `war_id` | 战事ID | 可选字段，NULL表示非战事战斗 |
| `opponent_type` | 对手类型 | 3种类型，简单明了 |
| `opponent_id` | 对手ID | 玩家ID或AI配置ID |
| `opponent_name` | 对手名称 | 显示用的名称 |
| `battle_log` | 战斗文字描述 | TEXT类型，存储文字描述的战斗过程 |
| `is_favorited` | 是否收藏 | 收藏后不会过期 |
| `log_expires_at` | 日志过期时间 | 14天后过期，收藏的日志不过期 |

**战斗类型说明**：

| 战斗类型 | 说明 | opponent_type | 使用场景 |
|---------|------|---------------|---------|
| `pvp_field` | 平原PVP | player | 玩家在平原地图对战 |
| `pvp_siege` | 攻城PVP | player | 玩家攻打其他玩家的城市 |
| `pvp_defense` | 守城PVP | player | 玩家防守自己的城市 |
| `pve_campaign` | 战役PVE | campaign_enemy | 战役系统的战斗 |
| `pve_event` | 事件PVE | event_enemy | 所有非战役PVE（流寇、黄巾军、诸侯、教学等） |
| **`pve_siege`** | **攻城PVE** | **event_enemy** | **驻地编组 / NPC 守军攻城**（`BattleArena` → `POST /api/battles`）；**须**在库 ENUM 中存在，否则战报无法落库 |

**对手类型说明**：

| 对手类型 | 说明 | opponent_id示例 | opponent_name示例 |
|---------|------|----------------|------------------|
| `player` | 玩家对手 | player_001 | 张三 |
| `campaign_enemy` | 战役敌人 | san_1_camp_0001 | 黄巾军（长社战役） |
| `event_enemy` | 事件敌人 | san_1_event_3002 | 黄巾流寇 |


> 📋 **详细设计**：使用示例、数据格式、日志格式、趣味性描述、收藏系统、后端API、数据量估算等内容已转移至 [18-1-BATTLE_REPORT_SYSTEM.md](../10-core-system/18-1-BATTLE_REPORT_SYSTEM.md)

#### 3.2.18 战事表 (wars)

**表名**: `wars`  
**说明**: 存储势力级别的战事信息，包括攻城战事、防守战事、野战战事等。

> ⚠️ **当前实装版本（v1.1.0）**：简化版，用于中立城市 PVE 攻城。支持多势力同时攻打，通过 `faction_kills` JSON 字段统计各势力击杀数，击杀最多的势力获得城市归属权。下方 SQL 为当前实装的简化表结构，完整版（含攻守双方详细统计、士气、大本营HP等）待 PVP 阶段实装。

```sql
CREATE TABLE wars (
  war_id VARCHAR(50) PRIMARY KEY COMMENT '战事ID',
  war_name VARCHAR(100) NOT NULL COMMENT '战事名称',
  war_type ENUM('siege', 'defense', 'field') NOT NULL COMMENT '战事类型',

  -- 目标城市
  target_city_id VARCHAR(50) NOT NULL COMMENT '目标城市ID',
  target_city_name VARCHAR(50) NOT NULL COMMENT '目标城市名称',

  -- 多势力击杀统计（核心：支持多势力同时攻打中立城市）
  faction_kills JSON COMMENT '各势力击杀统计（如：{"san_1_faction_1001":3,"san_1_faction_2001":1}）',

  -- 状态
  status ENUM('active', 'completed') DEFAULT 'active' COMMENT '战事状态',
  winner_faction_id VARCHAR(50) DEFAULT NULL COMMENT '胜利势力ID',

  -- NPC 守军统计
  npc_total INT DEFAULT 0 COMMENT 'NPC守军总数',
  npc_killed INT DEFAULT 0 COMMENT '已被消灭的NPC数量',

  start_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_target_city (target_city_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战事表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `war_id` | 战事ID | 自动生成：`war_{cityId}_{timestamp}` |
| `war_name` | 战事名称 | 如：新野攻城战 |
| `war_type` | 战事类型 | siege=攻城、defense=防守、field=野战 |
| `target_city_id` | 目标城市ID | 关联 cities 表 |
| `target_city_name` | 目标城市名称 | 冗余存储，便于查询 |
| `faction_kills` | 各势力击杀统计 | JSON，如 `{"san_1_faction_1001":3}` |
| `status` | 战事状态 | active=进行中、completed=已完成 |
| `winner_faction_id` | 胜利势力ID | 所有NPC消灭后，击杀最多的势力 |
| `npc_total` | NPC守军总数 | 城市初始NPC数量 |
| `npc_killed` | 已消灭NPC数量 | 累计，达到npc_total时攻破 |

**业务规则**：

1. **战事创建**：玩家首次攻打中立城市时自动创建
2. **多势力参与**：不同势力玩家攻打同一城市，击杀数分别统计到 `faction_kills`
3. **攻破判定**：`npc_killed >= npc_total` 时，`faction_kills` 中击杀最多的势力获得城市归属
4. **攻破后刷新**：城市归属新势力后立即重新生成NPC守军，创建新的 war 记录

**与 battles 表的关系**：

```sql
-- 关系：一个 war 包含多个 battles
SELECT * FROM battles WHERE war_id = 'war_san_1_city_3_xinye_1774607244289';
```

---

#### 3.2.19 讨伐表 (raids)

**表名**: `raids`  
**说明**: 存储全服讨伐AI势力的信息。讨伐是PVE合作内容，全服玩家联合对抗AI势力（流寇、蛮族、异族联军），持续3-7天。

```sql
CREATE TABLE raids (
  raid_id VARCHAR(50) PRIMARY KEY COMMENT '讨伐ID（如：san_1_raid_0001）',
  raid_name VARCHAR(100) NOT NULL COMMENT '讨伐名称（如：流寇军团讨伐）',
  raid_type ENUM('BANDIT', 'BARBARIAN', 'ALLIANCE') NOT NULL COMMENT '讨伐类型',
  
  -- AI势力信息
  ai_faction_id VARCHAR(50) NOT NULL COMMENT 'AI势力ID',
  ai_faction_name VARCHAR(50) NOT NULL COMMENT 'AI势力名称',
  ai_leader_name VARCHAR(50) COMMENT 'AI首领名称',
  ai_description TEXT COMMENT 'AI势力描述',
  
  -- 主营地信息
  main_camp_hp INT NOT NULL COMMENT '主营地HP',
  main_camp_max_hp INT NOT NULL COMMENT '主营地最大HP',
  main_camp_status ENUM('active', 'destroyed') DEFAULT 'active' COMMENT '主营地状态',
  
  -- 副营地信息（JSON）
  sub_camps JSON COMMENT '副营地列表',
  
  -- 参与统计
  total_participants INT DEFAULT 0 COMMENT '总参与人数',
  total_battles INT DEFAULT 0 COMMENT '总战斗次数',
  total_damage BIGINT DEFAULT 0 COMMENT '总伤害输出',
  total_kills INT DEFAULT 0 COMMENT '总击杀数',
  
  -- 排名数据（JSON）
  player_rankings JSON COMMENT '玩家排名（前100名）',
  faction_rankings JSON COMMENT '势力排名（前10名）',
  
  -- 状态
  status ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending' COMMENT '讨伐状态',
  
  -- 时间
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  duration BIGINT DEFAULT 604800000 COMMENT '持续时间（毫秒，默认7天）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_status (status),
  INDEX idx_raid_type (raid_type),
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='讨伐表（全服VS AI）';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `raid_id` | 讨伐ID | 格式：san_{赛季}_raid_{编号} |
| `raid_name` | 讨伐名称 | 如：流寇军团讨伐、蛮族入侵讨伐 |
| `raid_type` | 讨伐类型 | BANDIT=流寇、BARBARIAN=蛮族、ALLIANCE=异族联军 |
| `ai_faction_id` | AI势力ID | AI势力的唯一标识 |
| `main_camp_hp` | 主营地HP | 归零则讨伐成功 |
| `sub_camps` | 副营地列表 | JSON格式，包含副营地HP和BUFF信息 |
| `total_participants` | 总参与人数 | 全服参与玩家数量 |
| `player_rankings` | 玩家排名 | JSON格式，存储前100名玩家排名 |
| `faction_rankings` | 势力排名 | JSON格式，存储前10名势力排名 |

**业务规则**：

1. **讨伐创建**：
   - 系统定期刷新（每周1-2次）
   - 随机选择AI势力类型
   - 持续时间3-7天

2. **参与机制**：
   - 所有势力玩家都可参与
   - 每天最多5次战斗
   - 每次战斗消耗粮草
   - 最多2人组队

3. **讨伐结算**：
   - 主营地HP归零 → 讨伐成功
   - 时间到期 → 讨伐失败
   - 发放个人排名奖励和势力排名奖励

4. **数据保留**：
   - 讨伐记录永久保留（历史记录）
   - 关联的 `battles` 记录按照 14天规则清理

**与 battles 表的关系**：

```sql
-- battles 表添加 raid_id 字段
ALTER TABLE battles 
ADD COLUMN raid_id VARCHAR(50) COMMENT '讨伐ID（可选，NULL表示非讨伐战斗）',
ADD INDEX idx_raid_id (raid_id);

-- 修改 battle_type 枚举（须与 §3.2.17 主表一致：已含 pve_siege 时再追加其它类型）
ALTER TABLE battles MODIFY COLUMN battle_type ENUM(
  'pvp_field',      -- 平原PVP
  'pvp_siege',      -- 攻城PVP
  'pvp_defense',    -- 守城PVP
  'pve_campaign',   -- 战役PVE
  'pve_event',      -- 事件PVE
  'pve_siege',      -- 攻城PVE（驻地/NPC）
  'pve_raid'        -- 讨伐PVE（规划）
) NOT NULL COMMENT '战斗类型';

-- 关系：一个 raid 包含多个 battles
-- 查询讨伐的所有战斗：
SELECT * FROM battles WHERE raid_id = 'san_1_raid_0001';

-- 查询玩家在某个讨伐中的战斗：
SELECT * FROM battles 
WHERE raid_id = 'san_1_raid_0001' AND player_id = 'player_001';
```

**示例数据**：

```javascript
// 讨伐记录
{
  raid_id: 'san_1_raid_0001',
  raid_name: '流寇军团讨伐',
  raid_type: 'BANDIT',
  
  ai_faction_id: 'ai_bandit_001',
  ai_faction_name: '流寇军团',
  ai_leader_name: '流寇首领',
  ai_description: '一群横行乡里的山贼马贼',
  
  main_camp_hp: 450000,
  main_camp_max_hp: 1000000,
  main_camp_status: 'active',
  
  sub_camps: [
    {
      campId: 'sub_camp_1',
      campName: '东营',
      hp: 0,
      maxHp: 200000,
      status: 'destroyed',
      buff: { type: 'attack', value: 10, description: '攻击+10%' }
    },
    {
      campId: 'sub_camp_2',
      campName: '西营',
      hp: 0,
      maxHp: 200000,
      status: 'destroyed',
      buff: { type: 'defense', value: 10, description: '防御+10%' }
    }
  ],
  
  total_participants: 1250,
  total_battles: 8500,
  total_damage: 550000000,
  total_kills: 125000,
  
  player_rankings: [
    {
      playerId: 'p001',
      playerName: '玩家A',
      factionId: 'faction_1',
      factionName: '刘备',
      totalDamage: 75000,
      totalKills: 580,
      battleCount: 20,
      teamBattles: 5,
      score: 85000,
      rank: 1
    }
    // ... 前100名
  ],
  
  faction_rankings: [
    {
      factionId: 'faction_2',
      factionName: '曹操',
      totalDamage: 750000,
      totalKills: 15000,
      participantCount: 450,
      score: 850000,
      rank: 1
    }
    // ... 前10名
  ],
  
  status: 'active',
  start_time: '2026-03-09 00:00:00',
  end_time: '2026-03-16 00:00:00',
  duration: 604800000
}
```

---

#### 3.2.20 纪念图表 (memorial_images)

**表名**: `memorial_images`  
**说明**: 存储玩家的纪念图片信息，包括关键节点（永久）、每日生涯（14天）、战斗纪念（14天）三种类型。

```sql
CREATE TABLE memorial_images (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '纪念图ID',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  season_id VARCHAR(50) NOT NULL COMMENT '赛季ID',
  server_id VARCHAR(50) NOT NULL COMMENT '服务器ID',
  
  -- 图片类型
  image_type ENUM('milestone', 'daily', 'battle') NOT NULL COMMENT '图片类型：milestone=关键节点（永久）, daily=每日生涯（14天）, battle=战斗纪念（14天，每天限1次）',
  event_date DATE NOT NULL COMMENT '事件日期',
  
  -- 关联信息
  battle_id VARCHAR(50) COMMENT '关联的战斗ID（仅battle类型使用）',
  
  -- OSS存储信息
  image_url VARCHAR(500) NOT NULL COMMENT 'OSS图片完整URL',
  oss_key VARCHAR(500) NOT NULL COMMENT 'OSS存储key',
  file_size INT COMMENT '文件大小（字节）',
  
  -- 事件数据（JSON格式，灵活扩展）
  event_data JSON NOT NULL COMMENT '事件详细数据',
  
  -- 过期管理
  expires_at DATETIME COMMENT '过期时间（milestone为NULL永不过期，daily和battle为创建时间+14天）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_player (player_id),
  INDEX idx_player_season (player_id, season_id),
  INDEX idx_image_type (image_type),
  INDEX idx_event_date (event_date),
  INDEX idx_expires_at (expires_at),
  INDEX idx_battle_id (battle_id),
  UNIQUE INDEX idx_unique_daily (player_id, image_type, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='纪念图表（包含关键节点、每日生涯、战斗纪念三种类型）';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `id` | 纪念图ID | 自增主键 |
| `player_id` | 玩家ID | 关联玩家账号 |
| `season_id` | 赛季ID | 如：san_1, san_2 |
| `server_id` | 服务器ID | 服务器标识 |
| `image_type` | 图片类型 | milestone=关键节点（永久）, daily=每日生涯（14天）, battle=战斗纪念（14天） |
| `event_date` | 事件日期 | 事件发生的日期 |
| `battle_id` | 关联战斗ID | 仅battle类型使用 |
| `image_url` | OSS图片URL | 完整的图片访问地址 |
| `oss_key` | OSS存储key | 用于删除和管理 |
| `file_size` | 文件大小 | 字节数 |
| `event_data` | 事件数据 | JSON格式，灵活扩展 |
| `expires_at` | 过期时间 | milestone为NULL永不过期，其他类型为创建时间+14天 |

**业务规则**：

1. **图片类型**：
   - milestone（关键节点）：永久保存，如首次登录、首次胜利、官职晋升等
   - daily（每日生涯）：保存14天，每日自动生成
   - battle（战斗纪念）：保存14天，每天限1次

2. **过期管理**：
   - milestone类型：expires_at为NULL，永不过期
   - daily和battle类型：expires_at = created_at + 14天
   - 定时任务每天清理过期图片

3. **唯一性约束**：
   - daily和battle类型：同一玩家同一天只能有一张（通过idx_unique_daily保证）

4. **存储管理**：
   - 图片存储在OSS（对象存储服务）
   - image_url：完整访问地址
   - oss_key：用于删除和管理

**示例数据**：

```javascript
// 关键节点纪念图
{
  id: 1,
  player_id: 'p001',
  season_id: 'san_1',
  server_id: 'server_001',
  image_type: 'milestone',
  event_date: '2026-03-01',
  battle_id: null,
  image_url: 'https://oss.example.com/memorial/p001_milestone_first_login.png',
  oss_key: 'memorial/p001_milestone_first_login.png',
  file_size: 245678,
  event_data: {
    type: 'first_login',
    title: '初入乱世',
    description: '首次登录游戏',
    timestamp: '2026-03-01 10:30:00'
  },
  expires_at: null,  // 永不过期
  created_at: '2026-03-01 10:30:00'
}

// 每日生涯纪念图
{
  id: 2,
  player_id: 'p001',
  season_id: 'san_1',
  server_id: 'server_001',
  image_type: 'daily',
  event_date: '2026-03-09',
  battle_id: null,
  image_url: 'https://oss.example.com/memorial/p001_daily_20260309.png',
  oss_key: 'memorial/p001_daily_20260309.png',
  file_size: 189234,
  event_data: {
    date: '2026-03-09',
    battles: 15,
    wins: 10,
    reputation: 1250,
    position: '校尉',
    highlights: ['首次击败传奇将领', '官职晋升']
  },
  expires_at: '2026-03-23 00:00:00',  // 14天后过期
  created_at: '2026-03-09 23:59:00'
}

// 战斗纪念图
{
  id: 3,
  player_id: 'p001',
  season_id: 'san_1',
  server_id: 'server_001',
  image_type: 'battle',
  event_date: '2026-03-09',
  battle_id: 'battle_12345',
  image_url: 'https://oss.example.com/memorial/p001_battle_20260309.png',
  oss_key: 'memorial/p001_battle_20260309.png',
  file_size: 312456,
  event_data: {
    battleId: 'battle_12345',
    opponent: '吕布',
    result: 'win',
    damage: 8500,
    kills: 3,
    mvp: '关羽',
    timestamp: '2026-03-09 20:15:00'
  },
  expires_at: '2026-03-23 00:00:00',  // 14天后过期
  created_at: '2026-03-09 20:15:30'
}
```

---

#### 3.2.21 统计数据表 (statistics)

```sql
CREATE TABLE statistics (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 战斗统计
  total_battles INT DEFAULT 0 COMMENT '总战斗次数',
  wins INT DEFAULT 0 COMMENT '胜利次数',
  losses INT DEFAULT 0 COMMENT '失败次数',
  draws INT DEFAULT 0 COMMENT '平局次数',
  win_rate DECIMAL(5,2) DEFAULT 0 COMMENT '胜率',
  total_damage_dealt BIGINT DEFAULT 0 COMMENT '总杀伤兵力（造成的敌军损失）',
  total_damage_taken BIGINT DEFAULT 0 COMMENT '总自损兵力（己方兵力损失）',
  total_kills INT DEFAULT 0 COMMENT '总击杀数（消灭的敌军部队数）',
  total_battle_score BIGINT DEFAULT 0 COMMENT '战后评分累计（所有战斗的最终得分之和）',
  total_events_completed INT DEFAULT 0 COMMENT '已完成事件总数（所有类型事件的累计完成数）',
  
  -- 游戏时长统计（秒）
  total_playtime INT DEFAULT 0 COMMENT '总游戏时长',
  today_playtime INT DEFAULT 0 COMMENT '今日游戏时长',
  week_playtime INT DEFAULT 0 COMMENT '本周游戏时长',
  month_playtime INT DEFAULT 0 COMMENT '本月游戏时长',
  
  -- 经济统计
  total_gold_earned BIGINT DEFAULT 0 COMMENT '总获得银两',
  total_gold_spent BIGINT DEFAULT 0 COMMENT '总消耗银两',
  total_food_earned BIGINT DEFAULT 0 COMMENT '总获得粮草',
  total_food_spent BIGINT DEFAULT 0 COMMENT '总消耗粮草',
  
  -- 贡献统计
  total_contribution_earned BIGINT DEFAULT 0 COMMENT '总获得贡献值',
  total_contribution_spent BIGINT DEFAULT 0 COMMENT '总消耗贡献值',
  
  -- 声望统计
  total_reputation_earned BIGINT DEFAULT 0 COMMENT '总获得声望（累计值，用于统计）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统计数据表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `total_damage_dealt` | 总杀伤兵力 | 累计造成的敌军兵力损失 |
| `total_damage_taken` | 总自损兵力 | 累计己方兵力损失 |
| `total_kills` | 总击杀数 | 累计消灭的敌军部队数量 |
| `total_battle_score` | 战后评分累计 | 所有战斗的最终得分之和（来自BattleScoreSystem） |
| `total_events_completed` | 已完成事件总数 | 所有类型事件的累计完成数 |
| `total_gold_earned` | 总获得银两 | 累计获得的银两 |
| `total_gold_spent` | 总消耗银两 | 累计消耗的银两 |
| `total_food_earned` | 总获得粮草 | 累计获得的粮草 |
| `total_food_spent` | 总消耗粮草 | 累计消耗的粮草（恢复部队兵力） |
| `total_contribution_earned` | 总获得贡献值 | 累计获得的贡献值 |
| `total_contribution_spent` | 总消耗贡献值 | 累计消耗的贡献值（兑换奖励） |

**移除的字段**：
- ❌ `total_purchases` - 总购买次数（没必要）
- ❌ `week_contribution_earned` - 本周获得贡献（没必要）
- ❌ `month_contribution_earned` - 本月获得贡献（没必要）
- ❌ `friends_count` - 好友数量（没必要）
- ❌ `messages_count` - 消息数量（没必要）
- ❌ `guild_contribution` - 公会贡献（没必要）

**统计更新示例**：

```javascript
// 战斗结束后更新统计
async function updateBattleStatistics(playerId, battleResult) {
  await mysql.query(`
    UPDATE statistics SET
      total_battles = total_battles + 1,
      wins = wins + ?,
      losses = losses + ?,
      draws = draws + ?,
      total_damage_dealt = total_damage_dealt + ?,
      total_damage_taken = total_damage_taken + ?,
      total_kills = total_kills + ?,
      win_rate = (wins * 100.0 / total_battles)
    WHERE player_id = ?
  `, [
    battleResult.isWin ? 1 : 0,
    battleResult.isLose ? 1 : 0,
    battleResult.isDraw ? 1 : 0,
    battleResult.enemyCasualties,  // 杀伤的敌军兵力
    battleResult.selfCasualties,   // 自损的己方兵力
    battleResult.enemyKills,       // 消灭的敌军部队数
    playerId
  ]);
}

// 获得银两时更新统计
async function updateGoldEarned(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_gold_earned = total_gold_earned + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}

// 消耗银两时更新统计
async function updateGoldSpent(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_gold_spent = total_gold_spent + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}

// 获得粮草时更新统计
async function updateFoodEarned(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_food_earned = total_food_earned + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}

// 消耗粮草时更新统计（恢复部队兵力）
async function updateFoodSpent(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_food_spent = total_food_spent + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}

// 获得贡献值时更新统计
async function updateContributionEarned(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_contribution_earned = total_contribution_earned + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}

// 消耗贡献值时更新统计（兑换奖励）
async function updateContributionSpent(playerId, amount) {
  await mysql.query(`
    UPDATE statistics SET
      total_contribution_spent = total_contribution_spent + ?
    WHERE player_id = ?
  `, [amount, playerId]);
}
```

**统计展示示例**：

```
┌─────────────────────────────────────┐
│  玩家统计                           │
├─────────────────────────────────────┤
│                                     │
│  ⚔️ 战斗统计                        │
│  • 总战斗次数：156场                │
│  • 胜利/失败/平局：98/52/6          │
│  • 胜率：62.82%                     │
│  • 总杀伤兵力：45,230               │
│  • 总自损兵力：18,560               │
│  • 总击杀部队：312支                │
│                                     │
│  ⏱️ 游戏时长                        │
│  • 总时长：48小时32分               │
│  • 今日时长：2小时15分              │
│  • 本周时长：12小时40分             │
│  • 本月时长：35小时20分             │
│                                     │
│  💰 经济统计                        │
│  • 总获得银两：125,600              │
│  • 总消耗银两：98,400               │
│  • 当前余额：27,200                 │
│  • 总获得粮草：85,300               │
│  • 总消耗粮草：72,100               │
│  • 当前余额：13,200                 │
│                                     │
│  🏆 贡献统计                        │
│  • 总获得贡献：8,560                │
│  • 总消耗贡献：6,200                │
│  • 当前余额：2,360                  │
│                                     │
│  ⭐ 声望统计                        │
│  • 总获得声望：1,250                │
│  • 当前声望：1,250                  │
│  • 当前官职：县令                   │
│                                     │
└─────────────────────────────────────┘
```

#### 3.2.22 赛季统计表 (season_records)

```sql
CREATE TABLE season_records (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  season_id VARCHAR(50) NOT NULL COMMENT '赛季ID（如：san_1=黄巾之乱, san_2=董卓之乱）',
  server_id VARCHAR(50) NOT NULL COMMENT '服务器ID',
  
  -- 赛季最终数据
  final_reputation INT COMMENT '最终声望',
  final_position VARCHAR(50) COMMENT '最终官职',
  final_rank INT COMMENT '最终排名',
  
  -- 赛季战斗统计
  total_battles INT DEFAULT 0 COMMENT '总战斗次数',
  wins INT DEFAULT 0 COMMENT '胜利次数',
  losses INT DEFAULT 0 COMMENT '失败次数',
  draws INT DEFAULT 0 COMMENT '平局次数',
  win_rate DECIMAL(5,2) DEFAULT 0 COMMENT '胜率',
  
  -- 赛季评述
  season_comment VARCHAR(200) COMMENT '赛季一句话评述（根据表现自动生成）',
  
  settled_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '结算时间',
  
  PRIMARY KEY (player_id, season_id, server_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_player_season (player_id, season_id),
  INDEX idx_season (season_id),
  INDEX idx_server (server_id),
  INDEX idx_final_rank (final_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='赛季统计表（用于历史成绩展示）';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `final_reputation` | 最终声望 | 赛季结束时的声望值 |
| `final_position` | 最终官职 | 赛季结束时的官职 |
| `final_rank` | 最终排名 | 赛季结束时的全服排名 |
| `total_battles` | 总战斗次数 | 该赛季的总战斗次数 |
| `wins` | 胜利次数 | 该赛季的胜利次数 |
| `losses` | 失败次数 | 该赛季的失败次数 |
| `draws` | 平局次数 | 该赛季的平局次数 |
| `win_rate` | 胜率 | 该赛季的胜率（百分比） |

**说明**：
- 记录玩家在每个赛季的统计数据
- 用于历史成绩查询、排行榜展示
- 与服务器绑定（同一玩家在不同服务器有不同记录）
- 赛季结束时自动结算并保存

**赛季结算示例**：

```javascript
// 赛季结束时结算玩家数据
async function settleSeason(playerId, seasonId, serverId) {
  // 1. 获取玩家当前数据
  const [playerRows] = await mysql.query(`
    SELECT 
      reputation,
      current_position_name,
      current_season,
      contribution
    FROM players
    WHERE player_id = ?
  `, [playerId]);
  
  const player = playerRows[0];
  
  // 2. 获取玩家该赛季的战斗统计
  const [battleRows] = await mysql.query(`
    SELECT 
      COUNT(*) as total_battles,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'lose' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws
    FROM battles
    WHERE player_id = ?
      AND battle_at >= (SELECT start_date FROM seasons WHERE season_id = ?)
      AND battle_at <= (SELECT end_date FROM seasons WHERE season_id = ?)
  `, [playerId, seasonId, seasonId]);
  
  const battleStats = battleRows[0];
  const winRate = battleStats.total_battles > 0 
    ? (battleStats.wins * 100.0 / battleStats.total_battles).toFixed(2)
    : 0;
  
  // 3. 获取玩家排名
  const [rankRows] = await mysql.query(`
    SELECT COUNT(*) + 1 as rank
    FROM players
    WHERE reputation > ?
      AND current_season = ?
  `, [player.reputation, seasonId]);
  
  const finalRank = rankRows[0].rank;
  
  // 4. 获取玩家游戏时长
  const [statsRows] = await mysql.query(`
    SELECT total_playtime
    FROM statistics
    WHERE player_id = ?
  `, [playerId]);
  
  const totalPlaytime = statsRows[0].total_playtime;
  
  // 5. 生成赛季评述
  const seasonComment = generateSeasonComment({
    playerName: player.character_name,
    position: player.current_position_name,
    reputation: player.reputation,
    contribution: player.contribution,
    rank: finalRank,
    totalBattles: battleStats.total_battles,
    wins: battleStats.wins,
    winRate: parseFloat(winRate),
    totalPlaytime: totalPlaytime
  });
  
  // 6. 保存赛季记录
  await mysql.query(`
    INSERT INTO season_records SET
      player_id = ?,
      season_id = ?,
      server_id = ?,
      final_reputation = ?,
      final_position = ?,
      final_rank = ?,
      total_battles = ?,
      wins = ?,
      losses = ?,
      draws = ?,
      win_rate = ?,
      season_comment = ?,
      settled_at = NOW()
  `, [
    playerId,
    seasonId,
    serverId,
    player.reputation,
    player.current_position_name,
    finalRank,
    battleStats.total_battles,
    battleStats.wins,
    battleStats.losses,
    battleStats.draws,
    winRate,
    seasonComment
  ]);
  
  console.log(`玩家 ${playerId} 赛季 ${seasonId} 结算完成`);
}

// 赛季评述生成系统
function generateSeasonComment(playerData) {
  const {
    playerName,
    position,
    reputation,
    contribution,
    rank,
    totalBattles,
    wins,
    winRate,
    totalPlaytime
  } = playerData;
  
  // 计算平均每天在线时长（假设赛季90天）
  const avgDailyPlaytime = totalPlaytime / (90 * 3600); // 转换为小时
  
  // 评述规则（按优先级排序）
  const comments = [];
  
  // 1. 战神级别（胜率>80% 且 总战斗>3000）
  if (winRate > 80 && totalBattles > 3000) {
    comments.push(`${playerName}天下无双，十步杀一人，千里不留行`);
  }
  // 2. 高胜率（胜率>75% 且 总战斗>1000）
  else if (winRate > 75 && totalBattles > 1000) {
    comments.push(`${playerName}勇冠三军，所向披靡`);
  }
  // 3. 战斗狂人（总战斗>5000）
  else if (totalBattles > 5000) {
    comments.push(`${playerName}征战沙场，百战不殆`);
  }
  
  // 4. 肝帝（平均每天在线>10小时）
  if (avgDailyPlaytime > 10) {
    comments.push(`${playerName}兢兢业业，勤奋耕耘`);
  }
  // 5. 勤奋玩家（平均每天在线>6小时）
  else if (avgDailyPlaytime > 6) {
    comments.push(`${playerName}勤勉不辍，日夜操劳`);
  }
  
  // 6. 排名前10
  if (rank <= 10) {
    comments.push(`${playerName}位列前茅，名震天下`);
  }
  // 7. 排名前100
  else if (rank <= 100) {
    comments.push(`${playerName}崭露头角，前途无量`);
  }
  
  // 8. 高官职（根据官职等级）
  const highPositions = ['州牧', '太守', '郡守', '刺史'];
  if (highPositions.includes(position)) {
    comments.push(`${playerName}位高权重，一方诸侯`);
  }
  
  // 9. 高贡献（贡献值>10000）
  if (contribution > 10000) {
    comments.push(`${playerName}功勋卓著，忠心耿耿`);
  }
  // 10. 中等贡献（贡献值>5000）
  else if (contribution > 5000) {
    comments.push(`${playerName}尽心竭力，功不可没`);
  }
  
  // 11. 高声望（声望>5000）
  if (reputation > 5000) {
    comments.push(`${playerName}声名远播，威震四方`);
  }
  
  // 12. 低胜率但战斗多（胜率<40% 且 总战斗>1000）
  if (winRate < 40 && totalBattles > 1000) {
    comments.push(`${playerName}屡败屡战，愈挫愈勇`);
  }
  
  // 13. 佛系玩家（平均每天在线<2小时 且 总战斗<100）
  if (avgDailyPlaytime < 2 && totalBattles < 100) {
    comments.push(`${playerName}闲云野鹤，淡泊名利`);
  }
  
  // 14. 默认评述
  if (comments.length === 0) {
    comments.push(`${playerName}初出茅庐，前程似锦`);
  }
  
  // 返回第一条匹配的评述（优先级最高）
  return comments[0];
}
```

**评述规则表**：

| 优先级 | 触发条件 | 评述内容 | 说明 |
|-------|---------|---------|------|
| 1 | 胜率>80% 且 总战斗>3000 | 天下无双，十步杀一人，千里不留行 | 战神级别 |
| 2 | 胜率>75% 且 总战斗>1000 | 勇冠三军，所向披靡 | 高胜率玩家 |
| 3 | 总战斗>5000 | 征战沙场，百战不殆 | 战斗狂人 |
| 4 | 平均每天在线>10小时 | 兢兢业业，勤奋耕耘 | 肝帝 |
| 5 | 平均每天在线>6小时 | 勤勉不辍，日夜操劳 | 勤奋玩家 |
| 6 | 排名≤10 | 位列前茅，名震天下 | 前10名 |
| 7 | 排名≤100 | 崭露头角，前途无量 | 前100名 |
| 8 | 官职为州牧/太守/郡守/刺史 | 位高权重，一方诸侯 | 高官职 |
| 9 | 贡献值>10000 | 功勋卓著，忠心耿耿 | 高贡献 |
| 10 | 贡献值>5000 | 尽心竭力，功不可没 | 中等贡献 |
| 11 | 声望>5000 | 声名远播，威震四方 | 高声望 |
| 12 | 胜率<40% 且 总战斗>1000 | 屡败屡战，愈挫愈勇 | 不屈不挠 |
| 13 | 平均每天在线<2小时 且 总战斗<100 | 闲云野鹤，淡泊名利 | 佛系玩家 |
| 14 | 默认 | 初出茅庐，前程似锦 | 默认评述 |

**更多评述示例**：

```javascript
// 可以扩展更多有趣的评述
const extendedComments = {
  // 战斗类
  战神: '${playerName}天下无双，十步杀一人，千里不留行',
  猛将: '${playerName}勇冠三军，所向披靡',
  战狂: '${playerName}征战沙场，百战不殆',
  不败: '${playerName}百战百胜，未尝一败',
  
  // 勤奋类
  肝帝: '${playerName}兢兢业业，勤奋耕耘',
  勤奋: '${playerName}勤勉不辍，日夜操劳',
  夜猫: '${playerName}披星戴月，废寝忘食',
  
  // 排名类
  榜首: '${playerName}独占鳌头，傲视群雄',
  前十: '${playerName}位列前茅，名震天下',
  前百: '${playerName}崭露头角，前途无量',
  
  // 官职类
  诸侯: '${playerName}位高权重，一方诸侯',
  封疆: '${playerName}封疆大吏，威名赫赫',
  
  // 贡献类
  功臣: '${playerName}功勋卓著，忠心耿耿',
  忠臣: '${playerName}尽心竭力，功不可没',
  
  // 声望类
  名将: '${playerName}声名远播，威震四方',
  英雄: '${playerName}英雄豪杰，名动天下',
  
  // 特殊类
  不屈: '${playerName}屡败屡战，愈挫愈勇',
  佛系: '${playerName}闲云野鹤，淡泊名利',
  新手: '${playerName}初出茅庐，前程似锦',
  
  // 组合类（多个条件同时满足）
  文武双全: '${playerName}文韬武略，智勇双全',
  全能: '${playerName}德才兼备，文武全才',
  传奇: '${playerName}传奇人物，千古流芳'
};
```

**历史成绩查询示例**：

```javascript
// 查询玩家的历史赛季成绩
async function getPlayerSeasonHistory(playerId) {
  const [rows] = await mysql.query(`
    SELECT 
      season_id,
      server_id,
      final_reputation,
      final_position,
      final_rank,
      total_battles,
      wins,
      losses,
      draws,
      win_rate,
      settled_at
    FROM season_records
    WHERE player_id = ?
    ORDER BY settled_at DESC
  `, [playerId]);
  
  return rows;
}
```

**历史成绩展示UI**：

```
┌─────────────────────────────────────┐
│  历史赛季成绩                       │
├─────────────────────────────────────┤
│                                     │
│  📜 黄巾之乱（san_1）               │
│  服务器：Saraburi                   │
│  结算时间：2026-02-28               │
│  ─────────────────────────────────  │
│  最终排名：#15                      │
│  最终声望：1,250                    │
│  最终官职：县令                     │
│  ─────────────────────────────────  │
│  战斗统计：                         │
│  • 总战斗：156场                    │
│  • 胜/负/平：98/52/6                │
│  • 胜率：62.82%                     │
│  ─────────────────────────────────  │
│  💬 赛季评述：                      │
│  "张三崭露头角，前途无量"           │
│                                     │
│  📜 董卓之乱（san_2）               │
│  服务器：Saraburi                   │
│  结算时间：2026-05-31               │
│  ─────────────────────────────────  │
│  最终排名：#8                       │
│  最终声望：2,580                    │
│  最终官职：郡守                     │
│  ─────────────────────────────────  │
│  战斗统计：                         │
│  • 总战斗：203场                    │
│  • 胜/负/平：145/50/8               │
│  • 胜率：71.43%                     │
│  ─────────────────────────────────  │
│  💬 赛季评述：                      │
│  "张三位列前茅，名震天下"           │
│                                     │
│  📜 群雄割据（san_3）               │
│  服务器：Saraburi                   │
│  结算时间：2026-08-31               │
│  ─────────────────────────────────  │
│  最终排名：#2                       │
│  最终声望：5,680                    │
│  最终官职：州牧                     │
│  ─────────────────────────────────  │
│  战斗统计：                         │
│  • 总战斗：3,256场                  │
│  • 胜/负/平：2,650/580/26           │
│  • 胜率：81.38%                     │
│  ─────────────────────────────────  │
│  💬 赛季评述：                      │
│  "张三天下无双，十步杀一人，    │
│   千里不留行"                       │
│                                     │
└─────────────────────────────────────┘
```

**评述展示效果**：

不同玩家会看到不同的评述，增加趣味性和成就感：

```
玩家A（战神）：
💬 "张三天下无双，十步杀一人，千里不留行"

玩家B（肝帝）：
💬 "李四兢兢业业，勤奋耕耘"

玩家C（前十）：
💬 "王五位列前茅，名震天下"

玩家D（高官）：
💬 "赵六位高权重，一方诸侯"

玩家E（不屈）：
💬 "孙七屡败屡战，愈挫愈勇"

玩家F（佛系）：
💬 "周八闲云野鹤，淡泊名利"
```

**排行榜查询示例**：

```javascript
// 查询某个赛季的排行榜
async function getSeasonLeaderboard(seasonId, serverId, limit = 100) {
  const [rows] = await mysql.query(`
    SELECT 
      sr.player_id,
      p.character_name,
      sr.final_reputation,
      sr.final_position,
      sr.final_rank,
      sr.total_battles,
      sr.wins,
      sr.win_rate
    FROM season_records sr
    INNER JOIN players p ON sr.player_id = p.player_id
    WHERE sr.season_id = ?
      AND sr.server_id = ?
    ORDER BY sr.final_rank ASC
    LIMIT ?
  `, [seasonId, serverId, limit]);
  
  return rows;
}
```

---

#### 3.2.23 赛季继承表 (season_inheritances)

```sql
CREATE TABLE season_inheritances (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  season_id VARCHAR(50) NOT NULL COMMENT '来源赛季ID（如：san_1=黄巾之乱, san_2=董卓之乱）',
  
  -- 继承物数据（JSON格式，便于扩展）
  inherited_equipment_cards JSON COMMENT '继承的装备卡列表（递增式：第1赛季=1套, 第2赛季=2套, ..., 第10赛季+=10套）',
  inherited_troop_cards JSON COMMENT '继承的部队卡列表（橙×10+紫×10）',
  inherited_title_cards JSON COMMENT '继承的称号卡列表（全部）',
  inherited_achievement_cards JSON COMMENT '继承的成就卡列表（全部）',
  inherited_treasure_cards JSON COMMENT '继承的宝物卡列表（全部）',
  inherited_golden_troop_cards JSON COMMENT '继承的金色部队卡列表（全部）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（赛季结算时）',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (player_id),
  INDEX idx_season (season_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='赛季继承表（跨服务器，全局有效，每个玩家只有一条记录）';
```

**业务规则**：

1. **继承物生成与更新**：
   - 每个赛季结束时，系统根据玩家的最终成绩生成/更新继承物
   - 每个玩家只有**一条**继承物记录（PRIMARY KEY = player_id）
   - 新赛季结束时，旧的继承物记录被**更新替换**
   - 继承物与服务器无关，全局有效

2. **装备卡继承规则（递增式）**：
   - **第1赛季（黄巾之乱）**：最多继承 1 套装备卡
   - **第2赛季（董卓之乱）**：最多继承 2 套装备卡
   - **第3赛季（群雄割据）**：最多继承 3 套装备卡
   - **...**
   - **第10赛季及以后**：最多继承 10 套装备卡（上限）
   
   **设计意图**：
   - ✅ 递增式变强曲线，避免第1赛季直接保留10套装备卡
   - ✅ 防止肝帝/人品帝在第2赛季获得巨大优势
   - ✅ 让大多数玩家保持在相近的起跑线
   - ✅ 长期玩家获得适当的累积优势
   
   **计算公式**：
   ```javascript
   // 装备卡继承数量 = min(赛季序号, 10)
   const maxEquipmentSets = Math.min(seasonNumber, 10);
   
   // 示例：
   // 第1赛季（黄巾之乱）: min(1, 10) = 1套
   // 第2赛季（董卓之乱）: min(2, 10) = 2套
   // 第5赛季: min(5, 10) = 5套
   // 第10赛季: min(10, 10) = 10套
   // 第15赛季: min(15, 10) = 10套（上限）
   ```

3. **其他继承物规则**：
   - **部队卡**：橙色×10 + 紫色×10（固定数量）
   - **称号卡**：全部继承（无上限）
   - **成就卡**：全部继承（无上限）
   - **宝物卡**：全部继承（无上限）
   - **金色部队卡**：全部继承，但**同一种金色部队卡每个玩家最多持有2张**
   
   **金色部队卡持有限制**：
   - ✅ 同一种金色部队卡（相同ID），每个玩家最多持有2张
   - ✅ 跨赛季继承时也遵循此限制
   - ✅ 如果玩家已持有2张相同的金色部队卡，无法再获得第3张
   - ✅ 不同种类的金色部队卡可以各持有2张
   
   **示例**：
   ```javascript
   // 玩家的金色部队卡持有情况
   {
     "golden_troop_001": 2,  // 已持有2张，达到上限
     "golden_troop_002": 1,  // 已持有1张，还可以获得1张
     "golden_troop_003": 0   // 未持有，可以获得2张
   }
   
   // 赛季结算时的继承逻辑
   if (player.goldenTroopCards[troopId] >= 2) {
     // 已达到上限，不再继承此卡
     console.log(`金色部队卡 ${troopId} 已达到持有上限（2张）`);
   } else {
     // 可以继承，但不超过2张
     const canInherit = 2 - player.goldenTroopCards[troopId];
     console.log(`金色部队卡 ${troopId} 可继承 ${canInherit} 张`);
   }
   ```

4. **继承物更新机制**：
   - 每个玩家只有**一条**当前有效的继承物记录
   - 赛季结束时，系统自动更新该玩家的继承物记录
   - 新赛季开始时，自动应用当前继承物（无需手动选择）
   - 玩家可以选择前进到下一赛季，也可以重复游玩当前赛季
   
   **赛季选择规则**：
   - ✅ **前进到下一赛季**：装备卡继承数量+1（如：san_1结束后进入san_2，装备卡从1套变为2套）
   - ✅ **重复游玩当前赛季**：装备卡继承数量保持不变（如：重复玩san_1，装备卡仍为1套）
   - ✅ **无强制限制**：玩家可以自由选择是否前进到下一赛季
   - ✅ **金色部队卡补充**：重复游玩可以获取该赛季的限定金色部队卡（受持有上限2张限制）
   
   **示例场景**：
   ```javascript
   // 场景1：玩家A完成san_1后选择前进到san_2
   {
     player_id: "0CEW",
     season_id: "san_2",  // 前进到san_2
     inherited_equipment_cards: [套装1, 套装2],  // 2套（递增）
     // ...
   }
   
   // 场景2：玩家B完成san_1后选择重复玩san_1
   {
     player_id: "0XYZ",
     season_id: "san_1",  // 仍然是san_1
     inherited_equipment_cards: [套装1],  // 仍为1套（不递增）
     // ...
   }
   
   // 场景3：玩家B重复玩san_1多次后，决定前进到san_2
   {
     player_id: "0XYZ",
     season_id: "san_2",  // 现在前进到san_2
     inherited_equipment_cards: [套装1, 套装2],  // 2套（递增）
     // 注意：即使重复玩了多次san_1，装备卡继承数仍按赛季序号计算
   }
   ```
   
   **装备卡继承数量计算**：
   ```javascript
   // 装备卡继承数量 = min(当前赛季序号, 10)
   // 注意：是"当前赛季序号"，不是"完成赛季的总次数"
   
   function calculateEquipmentSets(seasonId) {
     // 从 season_id 提取赛季序号
     const seasonNumber = parseInt(seasonId.replace('san_', ''));
     
     // 计算装备卡继承数量
     return Math.min(seasonNumber, 10);
   }
   
   // 示例：
   // san_1 → 1套（无论玩多少次san_1）
   // san_2 → 2套（无论玩多少次san_2）
   // san_5 → 5套
   // san_10 → 10套
   // san_15 → 10套（上限）
   ```
   
   **设计理念**：
   - 🎯 **自由选择**：玩家可以根据自己的需求选择是否前进
   - 🎴 **金色卡补充**：重复游玩可以补充该赛季的限定金色部队卡
   - ⚖️ **平衡性**：装备卡继承数只与赛季序号相关，避免重复刷取优势
   - 🚀 **鼓励前进**：前进到新赛季可以获得更多装备卡继承数量

5. **跨服务器特性**：
   - 继承物表没有 `server_id` 字段，全局有效
   - 玩家在任何服务器都可以使用自己的继承物
   - 切换服务器不影响继承物（但会清除当前赛季数据）

6. **数据隔离**：
   - `season_records` 表：与服务器绑定，记录在特定服务器的成绩
   - `season_inheritances` 表：跨服务器，全局共享

**示例数据**：

```json
// 玩家完成第2赛季（董卓之乱）后的继承物（第1赛季继承物已被替换）
{
  "player_id": "0CEW",
  "season_id": "san_2",
  "inherited_equipment_cards": [
    {
      "set_id": "equip_set_001",
      "weapon": "weapon_legendary_001",
      "armor": "armor_legendary_001",
      "accessory1": "accessory_epic_001",
      "accessory2": "accessory_epic_002"
    }
  ], // 只有1套
  "inherited_troop_cards": ["troop_epic_001", "troop_epic_002", ...], // 橙×10+紫×10
  "inherited_achievement_cards": ["san_1_achi_2_1001", "san_1_achi_3_2001"],
  "is_used": false,
  "created_at": "2026-06-30T23:59:59.000Z"
}

// san_5赛季结束时的继承物
{
  "player_id": "0CEW",
  "season_id": "san_5",
  "inherited_equipment_cards": [
    { "set_id": "equip_set_001", ... },
    { "set_id": "equip_set_002", ... },
    { "set_id": "equip_set_003", ... },
    { "set_id": "equip_set_004", ... },
    { "set_id": "equip_set_005", ... }
  ], // 5套装备卡
  "inherited_troop_cards": [...],
  "is_used": false,
  "created_at": "2027-06-30T23:59:59.000Z"
}

// 第15赛季结束时的继承物
{
  "player_id": "0CEW",
  "season_id": "san_15",
  "inherited_equipment_cards": [
    // 10套装备卡（达到上限）
    { "set_id": "equip_set_001", ... },
    { "set_id": "equip_set_002", ... },
    // ... 共10套
  ],
  "inherited_troop_cards": [...],
  "is_used": false,
  "created_at": "2031-06-30T23:59:59.000Z"
}
```

**示例场景**：

```
玩家A的赛季历程（正常前进）：

san_1：
- 在 san_1-01 服务器游玩
- 赛季结束时：
  * season_records 表：记录在 san_1-01 的成绩（rank=15）
  * season_inheritances 表：生成1套装备卡 + 其他继承物

san_2：
- 在 san_2-01 服务器开始游戏
- 使用san_1的继承物：1套装备卡
- 赛季结束时：
  * season_inheritances 表：更新为2套装备卡 + 其他继承物

san_5：
- 在 san_5-02 服务器游玩
- 使用san_2的继承物：2套装备卡
- 赛季结束时：
  * season_inheritances 表：更新为5套装备卡 + 其他继承物

san_10：
- 使用san_5的继承物：5套装备卡
- 赛季结束时：
  * season_inheritances 表：更新为10套装备卡（达到上限）

san_15：
- 使用san_10的继承物：10套装备卡
- 赛季结束时：
  * season_inheritances 表：仍然是10套装备卡（上限）
```

```
玩家B的赛季历程（重复游玩san_1补充金色卡）：

san_1（第1次）：
- 在 san_1-01 服务器游玩
- 赛季结束时：
  * season_records 表：记录在 san_1-01 的成绩（rank=20）
  * season_inheritances 表：生成1套装备卡 + 金色部队卡×1
  * 选择：重复玩san_1（想要补充更多金色部队卡）

san_1（第2次）：
- 在 san_1-02 服务器重新游玩san_1
- 使用san_1的继承物：1套装备卡 + 金色部队卡×1
- 赛季结束时：
  * season_records 表：记录在 san_1-02 的成绩（rank=8）
  * season_inheritances 表：仍为1套装备卡 + 金色部队卡×2（补充了1张）
  * 选择：前进到san_2

san_2：
- 在 san_2-01 服务器开始游戏
- 使用san_1的继承物：1套装备卡 + 金色部队卡×2
- 赛季结束时：
  * season_inheritances 表：更新为2套装备卡 + 金色部队卡×2 + san_2金色卡×1
```

```
玩家C的赛季历程（混合策略）：

san_1（第1次）：
- 赛季结束：1套装备卡 + 金色卡×1
- 选择：前进到san_2

san_2（第1次）：
- 赛季结束：2套装备卡 + 金色卡×2
- 选择：重复玩san_2（想要补充san_2的金色卡）

san_2（第2次）：
- 赛季结束：仍为2套装备卡 + 金色卡×3（补充了san_2的金色卡）
- 选择：前进到san_3

san_3：
- 赛季结束：3套装备卡 + 金色卡×4
```

**公平性分析**：

| 赛季 | 新玩家装备卡 | 老玩家装备卡 | 差距 | 说明 |
|------|------------|------------|------|------|
| san_1 | 0套 | 0套 | 0套 | 完全公平 |
| san_2 | 0套 | 1套 | 1套 | 差距很小 |
| san_3 | 0套 | 2套 | 2套 | 适度差距 |
| san_5 | 0套 | 4套 | 4套 | 有一定优势 |
| san_10 | 0套 | 9套 | 9套 | 明显优势 |
| san_15+ | 0套 | 10套 | 10套 | 上限锁定 |

- ✅ san_1-san_3：新老玩家差距很小，新玩家容易追赶
- ✅ san_4-san_9：差距逐渐拉开，但仍在可接受范围
- ✅ san_10+：差距锁定在10套，不会无限扩大
- ✅ 鼓励长期游玩，但不会让新玩家完全没有机会

---

### 3.3 配置表设计说明

**配置表概述**：
- 配置表存储游戏的基础配置数据（势力、将领、部队、装备、官职、称号、成就）
- 每个赛季的配置数据不同，通过 `season` 字段隔离
- 配置数据由策划维护，玩家无法修改

**赛季隔离方案**：
- ✅ 所有配置表都添加 `season` 字段（如：`san_1`, `san_2`）
- ✅ 添加索引：`INDEX idx_season (season)`，提升查询效率10-100倍
- ✅ `season` 字段的值从配置ID中自动提取（如：`san_1_char_1001` → `san_1`）
- ✅ 查询时使用 `WHERE season = 'san_1'`，避免 `LIKE` 查询

**ID命名规范**：
- 势力：`san_{season}_faction_{4digits}`（如：`san_1_faction_1001`）
- 将领：`san_{season}_char_{4digits}`（如：`san_1_char_1001`）
- 部队：`san_{season}_troop_{4digits}`（如：`san_1_troop_1001`）
- 技能：`skill_{type}_{4digits}`（如：`skill_1_5001`，不含赛季前缀，跨赛季通用）
- 羁绊：`bond_{type}_{4digits}`（如：`bond_1_5001`，不含赛季前缀，跨赛季通用）
- 官职：`san_{season}_pos_{4digits}`（如：`san_1_pos_1001`）
- 装备：`san_{season}_equip_{4digits}`（如：`san_1_equip_1001`）
- 称号：`san_{season}_title_{category}_{rarity+seq}`（如：`san_1_title_1_4001`）
- 成就：`san_{season}_achi_{category}_{rarity+seq}`（如：`san_1_achi_2_3001`）

**注意**：技能和羁绊不含赛季前缀，因为它们是跨赛季通用的基础配置。

**查询示例**：

```sql
-- ✅ 推荐：使用 season 字段查询（快速，使用索引）
SELECT * FROM config_characters WHERE season = 'san_1';
SELECT * FROM config_troops WHERE season = 'san_1';
SELECT * FROM config_factions WHERE season = 'san_1';

-- ✅ 跨赛季统计
SELECT season, COUNT(*) as count 
FROM config_characters 
GROUP BY season;

-- ✅ 多赛季查询
SELECT * FROM config_characters 
WHERE season IN ('san_1', 'san_2');

-- ❌ 不推荐：使用 LIKE 查询（慢，无法使用索引）
SELECT * FROM config_characters WHERE character_id LIKE 'san_1_%';
```

**性能对比**：

| 查询方式 | 查询时间 | 是否使用索引 | 推荐度 |
|---------|---------|------------|--------|
| `WHERE season = 'san_1'` | ~0.01ms | ✅ 是 | ⭐⭐⭐⭐⭐ |
| `WHERE id LIKE 'san_1_%'` | ~1-10ms | ❌ 否 | ⭐ |

**数据导入**：
- 导入时自动从ID中提取 `season` 字段
- 提取逻辑：`season = id.match(/^(san_\d+)/)[1]`
- 示例：`san_1_char_1001` → `san_1`

**未来扩展**：
- 添加新赛季时（如 san_2），只需使用新的ID前缀
- 导入脚本会自动提取并填充 season 字段
- 表结构和导入脚本无需任何修改

---

#### 3.3.1 服务器配置表 (config_servers)

**表名**: `config_servers`  
**说明**: 存储服务器的配置信息，包括容量、状态、赛季等。用于服务器列表展示和玩家加入验证。

```sql
CREATE TABLE config_servers (
  server_id VARCHAR(20) PRIMARY KEY COMMENT '服务器ID（如：S1-01）',
  server_name VARCHAR(50) NOT NULL COMMENT '服务器名称（如：群雄逐鹿）',
  server_icon VARCHAR(255) DEFAULT '🏰' COMMENT '服务器图标（emoji或图片URL）',
  server_color VARCHAR(20) DEFAULT '#FF6B6B' COMMENT '服务器主题色（hex）',
  description VARCHAR(200) COMMENT '服务器描述',
  
  -- 赛季信息
  current_season VARCHAR(50) NOT NULL COMMENT '当前赛季（如：san_1）',
  season_start_time DATETIME COMMENT '赛季开始时间',
  season_end_time DATETIME COMMENT '赛季结束时间',
  
  -- 容量配置
  max_real_players INT DEFAULT 700 COMMENT '最大真人玩家数',
  max_ai_players INT DEFAULT 300 COMMENT '最大AI玩家数',
  
  -- 服务器状态
  status ENUM('open', 'maintenance', 'closed') DEFAULT 'open' COMMENT '服务器状态',
  is_new BOOLEAN DEFAULT TRUE COMMENT '是否新服（开服7天内）',
  is_recommended BOOLEAN DEFAULT FALSE COMMENT '是否推荐服务器',
  
  -- 时间信息
  opened_at DATETIME NOT NULL COMMENT '开服时间',
  
  -- 游戏内历法（与 15-GAME_TIME_SYSTEM.md、gameTimeService 一致）
  game_time_start_year INT NOT NULL DEFAULT 184 COMMENT '锚点时刻的游戏年',
  game_time_start_month INT NOT NULL DEFAULT 1 COMMENT '锚点时刻的游戏月 1-12',
  game_time_start_day INT NOT NULL DEFAULT 1 COMMENT '锚点时刻的游戏日 1-30',
  game_time_real_hours_per_game_day DECIMAL(10,4) NOT NULL DEFAULT 1.0000 COMMENT '现实小时/游戏日；1=1现实小时=1游戏日',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (current_season),
  INDEX idx_status (status),
  INDEX idx_opened_at (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务器配置表';
```

**字段说明**：

| 字段名 | 说明 | 备注 |
|--------|------|------|
| `server_id` | 服务器ID | 如：S1-01, S1-02 |
| `server_name` | 服务器名称 | 如：群雄逐鹿、龙争虎斗 |
| `server_icon` | 服务器图标 | emoji（🏰）或图片URL |
| `server_color` | 服务器主题色 | hex颜色值，如：#FF6B6B |
| `description` | 服务器描述 | 如：新手推荐服务器 |
| `current_season` | 当前赛季 | 如：san_1, san_2 |
| `max_real_players` | 最大真人玩家数 | 默认700 |
| `max_ai_players` | 最大AI玩家数 | 默认300 |
| `status` | 服务器状态 | open/maintenance/closed |
| `is_new` | 是否新服 | 开服7天内为true |
| `is_recommended` | 是否推荐 | 管理员设置 |
| `game_time_start_year` 等 | 游戏历锚点与流速 | 迁移 `add-config-servers-game-time.sql`；锚点时间优先 `season_start_time` |

**业务规则**：

1. **服务器图标支持两种方式**：
   - Emoji：直接存储emoji字符（如：🏰🐉⚔️）
   - 图片：存储图片URL（如：https://cdn.notee.vip/servers/dragon.png）
   - 前端自动判断类型渲染

2. **服务器状态管理**：
   - `open`：正常开放，玩家可加入
   - `maintenance`：维护中，禁止新玩家加入
   - `closed`：已关闭，禁止所有操作

3. **新服标识**：
   - 开服7天内 `is_new = true`
   - 7天后自动更新为 `false`
   - 用于前端显示"新服"标签

4. **推荐服务器**：
   - 管理员可设置推荐服务器
   - 推荐服务器在列表中优先显示
   - 用于引导新玩家选择

5. **容量管理**：
   - 真人玩家数量通过 accounts 表统计
   - AI玩家数量通过 accounts 表统计
   - 达到上限后禁止新玩家加入

**查询示例**：

```javascript
// 获取服务器列表（含实时人数）
async function getServerList(season) {
  const servers = await db.query(`
    SELECT 
      cs.server_id,
      cs.server_name,
      cs.server_icon,
      cs.server_color,
      cs.description,
      cs.current_season,
      cs.max_real_players,
      cs.max_ai_players,
      cs.status,
      cs.is_new,
      cs.is_recommended,
      cs.opened_at,
      COUNT(CASE WHEN a.account_type = 'real' AND a.status = 'active' THEN 1 END) as current_real_players,
      COUNT(CASE WHEN a.account_type = 'ai' AND a.status = 'active' THEN 1 END) as current_ai_players
    FROM config_servers cs
    LEFT JOIN accounts a ON cs.server_id = a.serverId
    WHERE cs.current_season = ?
    GROUP BY cs.server_id
    ORDER BY cs.is_recommended DESC, cs.opened_at DESC
  `, [season]);
  
  return servers.map(s => ({
    ...s,
    isFull: s.current_real_players >= s.max_real_players,
    playerRate: `${s.current_real_players}/${s.max_real_players}`
  }));
}

// 检查玩家是否可以加入服务器
async function canJoinServer(serverId) {
  const server = await db.query(`
    SELECT 
      cs.*,
      COUNT(a.id) as current_real_players
    FROM config_servers cs
    LEFT JOIN accounts a ON cs.server_id = a.serverId 
      AND a.account_type = 'real' 
      AND a.status = 'active'
    WHERE cs.server_id = ?
    GROUP BY cs.server_id
  `, [serverId]);
  
  if (!server) {
    return { canJoin: false, reason: '服务器不存在' };
  }
  
  if (server.status !== 'open') {
    return { canJoin: false, reason: '服务器维护中' };
  }
  
  if (server.current_real_players >= server.max_real_players) {
    return { canJoin: false, reason: '服务器已满' };
  }
  
  return { canJoin: true };
}
```

**示例数据**：

```javascript
// S1赛季服务器
{
  server_id: 'S1-01',
  server_name: '群雄逐鹿',
  server_icon: '🏰',  // emoji图标
  server_color: '#FF6B6B',
  description: '新手推荐服务器',
  current_season: 'san_1',
  season_start_time: '2026-03-01 00:00:00',
  season_end_time: '2026-05-31 23:59:59',
  max_real_players: 700,
  max_ai_players: 300,
  status: 'open',
  is_new: true,
  is_recommended: true,
  opened_at: '2026-03-01 00:00:00'
}

// S2赛季服务器（使用图片）
{
  server_id: 'S2-01',
  server_name: '董卓之乱',
  server_icon: 'https://cdn.notee.vip/servers/dongzhuo.png',  // 图片URL
  server_color: '#E74C3C',
  description: '董卓之乱赛季',
  current_season: 'san_2',
  season_start_time: '2026-06-01 00:00:00',
  season_end_time: '2026-08-31 23:59:59',
  max_real_players: 700,
  max_ai_players: 300,
  status: 'open',
  is_new: false,
  is_recommended: false,
  opened_at: '2026-06-01 00:00:00'
}
```

**性能优化**：

1. **Redis缓存**：
   ```javascript
   // 缓存服务器列表（5分钟）
   const cacheKey = `servers:${season}`;
   await redis.setex(cacheKey, 300, JSON.stringify(servers));
   ```

2. **索引优化**：
   - `idx_season`：按赛季查询
   - `idx_status`：按状态过滤
   - `idx_opened_at`：按开服时间排序

3. **查询优化**：
   - 使用 LEFT JOIN 避免服务器无玩家时不显示
   - 使用 CASE WHEN 分别统计真人和AI玩家
   - 使用 GROUP BY 聚合数据

---

#### 3.3.2 势力配置表 (config_factions)

**说明**：存储势力的基础配置信息，每个赛季的势力配置不同。

```sql
CREATE TABLE config_factions (
  faction_id VARCHAR(50) PRIMARY KEY COMMENT '势力ID（如：san_1_faction_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）',
  faction_name VARCHAR(100) NOT NULL COMMENT '势力名称',
  faction_leader VARCHAR(50) COMMENT '势力君主ID（关联将领表）',
  
  icon VARCHAR(10) COMMENT '势力图标（emoji）',
  color VARCHAR(20) COMMENT '势力颜色（hex）',
  
  style VARCHAR(50) COMMENT '势力风格（机缘/霸业/挑战/猛攻/中庸/速攻等，直接使用中文）',
  
  max_players INT NOT NULL DEFAULT 100 COMMENT '最大玩家数',
  
  faction_bonuses JSON COMMENT '势力加成列表',
  
  description TEXT COMMENT '势力描述',
  difficulty VARCHAR(20) COMMENT '难度（简单/中级/困难），简单=推荐',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力配置表';
```

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `faction_id` | 势力ID | `san_1_faction_1001` |
| `season` | 赛季ID | `san_1`（从faction_id中提取） |
| `faction_name` | 势力名称 | 刘备、曹操、孙坚 |
| `faction_leader` | 势力君主ID | `san_1_char_1001` |
| `style` | 势力风格（中文） | 机缘、霸业、挑战、猛攻、中庸、速攻 |
| `faction_bonuses` | 势力加成 | JSON数组，结构化格式，key对应术语表(06-BONUS_TERMINOLOGY.csv) |
| `max_players` | 最大玩家数 | 40-180 |
| `difficulty` | 难度 | 简单/中级/困难，简单=推荐 |

**v2.0.0 变更**：
- 移除 `style_text` — 合并到 `style`，直接存中文
- 移除 `player_type` / `player_type_text` — 未被UI使用
- 移除 `recommended` — 由 `difficulty === '简单'` 推导

**数据示例**：

```json
{
  "faction_id": "san_1_faction_1001",
  "season": "san_1",
  "faction_name": "刘备",
  "faction_leader": "san_1_char_1001",
  "icon": "🐉",
  "color": "#FF6B6B",
  "style": "机缘",
  "max_players": 60,
  "faction_bonuses": [
    { "key": "faction_politics_bonus", "value": 5 },
    { "key": "faction_charm_bonus", "value": 10 },
    { "key": "troop_max_troops_bonus", "value": 15 },
    { "key": "npc_sage_guaranteed_buff" }
  ],
  "difficulty": "简单"
}
```

---


#### 3.3.3 将领配置表 (config_characters)

**说明**：存储将领的基础配置信息，每个赛季的将领配置不同。

```sql
CREATE TABLE config_characters (
  character_id VARCHAR(50) PRIMARY KEY COMMENT '将领ID（如：san_1_char_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从character_id中提取）',
  character_name VARCHAR(100) NOT NULL COMMENT '将领名称',
  courtesy_name VARCHAR(50) COMMENT '字（如：玄德）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  faction VARCHAR(50) COMMENT '势力（如：刘备、曹操）',
  
  -- 基础属性（×10存储）
  luck INT NOT NULL COMMENT '运气×10',
  courage INT NOT NULL COMMENT '勇气×10',
  combat INT NOT NULL COMMENT '武力×10',
  command INT NOT NULL COMMENT '统帅×10',
  intelligence INT NOT NULL COMMENT '智力×10',
  politics INT NOT NULL COMMENT '政治×10',
  charm INT NOT NULL COMMENT '魅力×10',
  
  -- 生平信息
  birth_year INT COMMENT '出生年（如：161）',
  death_year INT COMMENT '卒年（如：223）',
  stage VARCHAR(20) COMMENT '生涯（early/middle/late）',
  
  -- 将领类型
  character_type VARCHAR(20) COMMENT '将领类型（military/strategist/balanced）',
  
  -- 技能
  skill_1 VARCHAR(50) COMMENT '技能1',
  skill_2 VARCHAR(50) COMMENT '技能2',
  
  -- 其他核心属性
  troop_affinity VARCHAR(50) COMMENT '兵种亲和',
  trait VARCHAR(50) COMMENT '性格特质类型（brave/reckless/calm/normal/cautious/timid）',
  trait_modifier INT COMMENT '性格特质对应的士气修正值（-5到+8，用于战斗计算）',
  
  -- 额外信息（JSON）
  character_extra JSON COMMENT '额外信息（bonds, biography, description）',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_rarity (rarity),
  INDEX idx_faction (faction),
  INDEX idx_stage (stage),
  INDEX idx_character_type (character_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='将领配置表';
```

**新增字段说明**：

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `courtesy_name` | VARCHAR(50) | 字 | 玄德、孟德、仲谋 |
| `faction` | VARCHAR(50) | 势力 | 刘备、曹操、孙坚、袁绍、董卓、汉室、黄巾 |
| `birth_year` | INT | 出生年 | 161（刘备）、155（曹操） |
| `death_year` | INT | 卒年 | 223（刘备）、220（曹操） |
| `stage` | VARCHAR(20) | 生涯 | early（早期）、middle（中期）、late（晚期） |
| `character_type` | VARCHAR(20) | 将领类型 | military（武将）、strategist（谋士）、balanced（平衡） |
| `trait` | VARCHAR(50) | 性格特质类型 | brave、reckless、calm、normal、cautious、timid |
| `trait_modifier` | INT | 性格特质修正值 | -5到+8，影响士气计算 |
| `character_extra` | JSON | 额外信息 | 见下方JSON结构 |

**性格特质配置**：

| 特质类型 | 中文名 | trait_modifier | 说明 |
|---------|--------|----------------|------|
| `reckless` | 无惧 | +8 | 最高士气加成，适合冲锋陷阵 |
| `brave` | 勇猛 | +5 | 较高士气加成，勇于战斗 |
| `calm` | 冷静 | +2 | 小幅士气加成，沉着应战 |
| `normal` | 平凡 | 0 | 无士气修正，普通将领 |
| `cautious` | 谨慎 | -2 | 小幅士气减少，谨慎行事 |
| `timid` | 怯懦 | -5 | 较大士气减少，容易动摇 |

**士气计算公式**：
```
实际士气 = 玩家全局士气 + trait_modifier
```

**character_extra JSON结构**：
```json
{
  "bonds": ["桃园", "汉室"],     // 羁绊列表
  "biography": "《先主传》",     // 传记来源
  "description": "昭烈仁主..."   // 人物描述
}
```

**设计原则**：
- **独立列**：核心数据、需要查询/索引/筛选的字段（如faction、stage、character_type）
- **JSON字段**：展示数据、不常查询的字段（如bonds、biography、description）
- **参考官职表**：类似的字段组合并为JSON，简化表结构

---


#### 3.3.4 部队配置表 (config_troops)

**说明**：存储部队的基础配置信息，每个赛季的部队配置不同。

```sql
CREATE TABLE config_troops (
  troop_id VARCHAR(50) PRIMARY KEY COMMENT '部队ID（如：san_1_troop_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从troop_id中提取）',
  troop_name VARCHAR(100) NOT NULL COMMENT '部队名称',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  troop_type ENUM('infantry', 'cavalry', 'archer', 'special') NOT NULL COMMENT '兵种类型',
  weapon_type VARCHAR(50) DEFAULT NULL COMMENT '武器类型（用于图标显示，如：infantry_saber, cavalry_lance, archer_bow）',
  
  -- 核心属性
  max_troops INT NOT NULL COMMENT '最大兵力',
  troop_weight DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT '兵力权重（等效兵力=max_troops×troop_weight，可小数，用于伤害公式的兵力比例系数计算）',
  `range` INT NOT NULL COMMENT '攻击距离',
  attack INT NOT NULL COMMENT '攻击力×10',
  defense INT NOT NULL COMMENT '防御力×10',
  speed INT NOT NULL COMMENT '速度',
  movement INT NOT NULL COMMENT '移速',
  
  -- 特殊能力（JSON：包含武器、克制、适应、技能、特效）
  special_ability JSON COMMENT '特殊能力',
  
  description TEXT COMMENT '部队描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_rarity (rarity),
  INDEX idx_troop_type (troop_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部队配置表';
```

**special_ability JSON结构**：
```json
{
  "weapon_type": "infantry_saber",    // 武器类型
  "counters": {                       // 克制关系
    "infantry": 1.0,                  // 对步兵克制系数
    "cavalry": 0.9,                   // 对骑兵克制系数
    "archer": 1.1,                    // 对弓兵克制系数
    "siege": 1.0                      // 对攻城克制系数
  },
  "adaptation": {                     // 地形适应
    "plain": 1.0,                     // 平原适应系数
    "hill": 1.0,                      // 丘陵适应系数
    "forest": 1.0,                    // 森林适应系数
    "siege": 1.1                      // 攻城适应系数
  },
  "skills": ["skill_id_1", "skill_id_2"],  // 技能ID列表
  "effects": {                        // 特效
    "attack": "fx_02"                 // 攻击特效（空=CSS默认效果，填写=动画模组ID）
  }
}
```

**设计原则**：
- **独立列**：核心数据、需要查询/索引的字段（如troop_type、rarity）
- **JSON字段**：游戏机制数据、总是一起使用的字段（如克制、适应、技能、特效）
- **简化结构**：从15+个字段简化为1个JSON字段，便于扩展和维护

---


#### 3.3.5 技能配置表 (config_skills)

**说明**：存储技能的基础配置信息。每个技能都带有赛季标识，确保系统一致性。

```sql
CREATE TABLE config_skills (
  skill_id VARCHAR(50) PRIMARY KEY COMMENT '技能ID（如：san_1_skill_1_5001，包含赛季前缀）',
  season VARCHAR(20) NOT NULL COMMENT '赛季标识（如：san_1）',
  skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
  skill_type ENUM('active', 'passive') NOT NULL COMMENT '技能类型（主动/被动）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  damage_type ENUM('physical', 'strategy', 'none') COMMENT '伤害类型（物理/策略/无）',
  character_type VARCHAR(100) COMMENT '适用将领类型（如：military;balanced）',
  troop_type VARCHAR(100) COMMENT '兵种类型限制（infantry/cavalry/archer，支持多兵种用分号分隔）',
  
  target_effect VARCHAR(100) COMMENT '效果数值（TBD表示待定）',
  target_range VARCHAR(50) COMMENT '目标范围',
  target_count VARCHAR(50) COMMENT '目标数量',
  description TEXT COMMENT '技能描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_skill_type (skill_type),
  INDEX idx_rarity (rarity),
  INDEX idx_damage_type (damage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能配置表（按赛季区分）';
```

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `skill_id` | 技能ID（包含赛季前缀） | `san_1_skill_1_5001`（S1主动技能），`san_1_skill_2_5001`（S1被动技能） |
| `season` | 赛季标识 | `san_1`（赛季1），`san_2`（赛季2） |
| `skill_name` | 技能名称 | 圣斩、千里、妖术、诱惑 |
| `skill_type` | 技能类型 | active（主动）、passive（被动） |
| `rarity` | 稀有度 | common/rare/epic/legendary/core |
| `damage_type` | 伤害类型 | physical（物理）、strategy（策略）、none（无伤害） |
| `character_type` | 适用将领类型 | military（武将）、strategist（谋士）、balanced（平衡），多个用分号分隔 |
| `troop_type` | 兵种类型限制 | infantry（步兵）、cavalry（骑兵）、archer（弓兵），多个用分号分隔，留空表示通用 |
| `target_effect` | 效果数值 | TBD（待定）或具体数值 |
| `target_range` | 目标范围 | 1x1（单格）、1x2（2格直线）、1x3（3格直线）、2x2（田字4格）、3x3（九宫9格）、4x4（16格）、cross（标准十字5格）、cross_thin（大十字9格）、cross_large（超大十字13格） |
| `target_count` | 目标数量 | all（范围内全部）、1、2、3、random_1（随机1个）、random_2（随机2个）、random_3（随机3个） |
| `description` | 技能描述 | 对目标十字型位置敌人造成200%伤害 |

**ID格式规范**：
- 格式：`san_{赛季}_skill_{类型}_{稀有度}{编号}`
- 示例：`san_1_skill_1_5001`
  - `san_1`：赛季1
  - `skill_1`：主动技能（1=主动，2=被动）
  - `5001`：核心稀有度（5=core）+ 编号001

**设计原则**：
- ✅ 所有技能都带有 `season` 字段，保持系统一致性
- ✅ 即使未来赛季技能完全相同，也会复制一份并使用新的赛季标识
- ✅ 避免跨赛季共享数据导致的特殊处理和bug
- ✅ 简化查询逻辑：`WHERE season = 'san_1'`

**实际数据统计（S1赛季）**：
- 核心技能：8个（主动4个，被动4个）
- 传奇技能：20个（主动8个，被动12个）
- 史诗技能：12个（主动6个，被动6个）
- 稀有技能：16个（主动8个，被动8个）
- 普通技能：12个（主动6个，被动6个）
- 总计：68个技能

**数据示例**：

```json
{
  "skill_id": "san_1_skill_1_5001",
  "skill_name": "圣斩",
  "skill_type": "active",
  "rarity": "core",
  "damage_type": "physical",
  "character_type": "military;balanced",
  "troop_type": null,
  "description": "对目标十字型位置敌人造成200%伤害"
},
{
  "skill_id": "san_1_skill_1_4004",
  "skill_name": "白马",
  "skill_type": "active",
  "rarity": "legendary",
  "damage_type": "physical",
  "character_type": "military;balanced",
  "troop_type": "cavalry",
  "description": "骑兵攻击距离+2，并对目标造成180%伤害"
},
{
  "skill_id": "san_1_skill_2_4007",
  "skill_name": "骑将",
  "skill_type": "passive",
  "rarity": "legendary",
  "damage_type": "none",
  "character_type": null,
  "troop_type": "cavalry",
  "description": "骑兵伤害增加10%"
}
```

**设计说明**：
- ✅ 技能ID不含赛季前缀，因为技能是跨赛季通用的
- ✅ 不同赛季的将领可以使用相同的技能
- ✅ 技能配置修改后，所有使用该技能的将领自动更新

---


#### 3.3.6 羁绊配置表 (config_bonds)

**说明**：存储羁绊的基础配置信息。羁绊是跨赛季通用的，不同赛季可以共享相同的羁绊。

```sql
CREATE TABLE config_bonds (
  bond_id VARCHAR(50) PRIMARY KEY COMMENT '羁绊ID（如：san_1_bond_1_5001，包含赛季前缀和类型）',
  bond_name VARCHAR(100) NOT NULL COMMENT '羁绊名称',
  bond_type ENUM('active', 'passive') NOT NULL COMMENT '羁绊类型（主动/被动）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  min_characters INT NOT NULL DEFAULT 2 COMMENT '最少需要将领数',
  
  target_effect VARCHAR(100) COMMENT '效果数值',
  description TEXT COMMENT '羁绊描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_bond_type (bond_type),
  INDEX idx_rarity (rarity),
  INDEX idx_min_characters (min_characters)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羁绊配置表（跨赛季通用）';
```

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `bond_id` | 羁绊ID | `san_1_bond_1_5001`（主动羁绊），`san_1_bond_2_5001`（被动羁绊） |
| `bond_name` | 羁绊名称 | 无双、旷世、桃园、五虎 |
| `bond_type` | 羁绊类型 | active（主动）、passive（被动） |
| `rarity` | 稀有度 | common/rare/epic/legendary/core |
| `min_characters` | 最少需要将领数 | 2（需要2个将领触发），3（需要3个将领触发） |
| `target_effect` | 效果数值 | TBD（待定）或具体数值 |
| `description` | 羁绊描述 | 桃园三结义，增加全体属性 |

**数据示例**：

```json
{
  "bond_id": "san_1_bond_2_5001",
  "bond_name": "桃园",
  "bond_type": "passive",
  "rarity": "core",
  "min_characters": 2,
  "description": "桃园三结义，增加全体属性"
}
```

**设计说明**：
- ✅ 羁绊ID包含赛季前缀和类型数字（1=主动，2=被动），与技能ID格式一致
- ✅ 主动/被动由ID中的类型数字决定，无需额外的 effect_type 字段
- ✅ 羁绊配置修改后，所有使用该羁绊的将领自动更新
- ✅ `min_characters` 字段用于判断羁绊是否激活

---


#### 3.3.7 官职配置表 (config_positions)

**说明**：存储官职的基础配置信息，每个赛季的官职配置不同。

```sql
CREATE TABLE config_positions (
  position_id VARCHAR(50) PRIMARY KEY COMMENT '官职ID（如：san_1_position_junzhu）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从position_id中提取）',
  position_name VARCHAR(100) NOT NULL COMMENT '官职名称',
  position_level INT NOT NULL COMMENT '官职等级（0-8，0=君主最高，8=士官最低）',
  position_rank INT NOT NULL COMMENT '官职排名（用于排序，0=最高）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL DEFAULT 'common' COMMENT '稀有度',
  category VARCHAR(50) COMMENT '官职类别',
  
  icon VARCHAR(10) COMMENT '官职图标（emoji）',
  color VARCHAR(20) COMMENT '官职颜色（hex）',
  description TEXT COMMENT '官职描述',
  
  requirement INT NOT NULL COMMENT '所需声望',
  
  -- 加成属性（JSON存储，灵活扩展）
  position_bonuses JSON COMMENT '官职加成（如：{"reputation": 0.5, "contribution": 0.5, "resource": 0.5, "infantry": 0.15, "cavalry": 0, "archer": 0}）',
  
  permissions JSON COMMENT '权限列表',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_level (position_level),
  INDEX idx_rank (position_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='官职配置表';
```

**字段说明**：

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| position_id | VARCHAR(50) | 官职ID | san_1_position_junzhu |
| season | VARCHAR(20) | 赛季ID | san_1 |
| position_name | VARCHAR(100) | 官职名称 | 君主 |
| position_level | INT | 官职等级（0-8，0最高） | 0 |
| position_rank | INT | 官职排名（用于排序） | 0 |
| rarity | ENUM | 稀有度 | core |
| category | VARCHAR(50) | 官职类别 | 君主 |
| icon | VARCHAR(10) | 官职图标 | ⭐⭐⭐ |
| color | VARCHAR(20) | 官职颜色 | #f97316 |
| description | TEXT | 官职描述 | 最高统帅，掌握军权 |
| requirement | INT | 所需声望 | 500 |
| position_bonuses | JSON | 官职加成（见下方说明） | {"reputation": 0.5, "contribution": 0.5, "resource": 0.5, "infantry": 0.15, "cavalry": 0, "archer": 0} |
| permissions | JSON | 权限列表 | ["state_governor", "military_command"] |

**position_bonuses JSON字段结构**：

```json
{
  "reputation": 0.5,    // 声望加成（0.5 = +50%）
  "contribution": 0.5,  // 贡献加成（0.5 = +50%）
  "resource": 0.5,      // 资源加成（0.5 = +50%）
  "infantry": 0.15,     // 步兵加成（0.15 = +15%）
  "cavalry": 0,         // 骑兵加成（0 = 无加成）
  "archer": 0           // 弓兵加成（0 = 无加成）
}
```

**设计优势**：
- ✅ 灵活扩展：未来可以轻松添加新的加成类型（如：special、siege等）
- ✅ 简化结构：5个独立字段合并为1个JSON字段
- ✅ 易于维护：加成配置集中管理，修改更方便
- ✅ 查询友好：MySQL 5.7+支持JSON字段查询和索引

**使用示例**：

```sql
-- 查询资源加成大于30%的官职
SELECT position_name, position_bonuses->>'$.resource' as resource_bonus
FROM config_positions
WHERE JSON_EXTRACT(position_bonuses, '$.resource') > 0.3;

-- 查询有步兵加成的官职
SELECT position_name, position_bonuses->>'$.infantry' as infantry_bonus
FROM config_positions
WHERE JSON_EXTRACT(position_bonuses, '$.infantry') > 0;

-- 更新官职加成
UPDATE config_positions
SET position_bonuses = JSON_SET(position_bonuses, '$.resource', 0.6)
WHERE position_id = 'san_1_pos_1001';
```

---

#### 3.3.8 装备配置表 (config_equipment)

**说明**：存储装备的基础配置信息，每个赛季的装备配置不同。`equipment_type` 和 `rarity` 从 `equipment_id` 解析，不单独存储。

**ID命名规范**：`san_1_equip_{类型编号}_{稀有度}{序号}`（类型：1=weapon, 2=armor, 3=accessory）
- 详见 [05-ID_NAMING_GUIDE.md](./05-ID_NAMING_GUIDE.md) 第11节

```sql
CREATE TABLE config_equipment (
  equipment_id VARCHAR(50) PRIMARY KEY COMMENT '装备ID（如：san_1_equip_1_4001，编码赛季+类型+稀有度）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从equipment_id中提取）',
  equipment_name VARCHAR(100) NOT NULL COMMENT '装备名称',
  
  -- 属性加成（×10存储，CSV填写显示值如1.5，导入时×10存储为15）
  luck_bonus INT DEFAULT 0 COMMENT '运气加成×10',
  courage_bonus INT DEFAULT 0 COMMENT '勇气加成×10',
  combat_bonus INT DEFAULT 0 COMMENT '武力加成×10',
  command_bonus INT DEFAULT 0 COMMENT '统帅加成×10',
  intelligence_bonus INT DEFAULT 0 COMMENT '智力加成×10',
  politics_bonus INT DEFAULT 0 COMMENT '政治加成×10',
  charm_bonus INT DEFAULT 0 COMMENT '魅力加成×10',
  
  -- 特殊效果（JSON，由CSV标记语言转换而来，格式见 24-EQUIPMENT_SYSTEM.md）
  -- 示例：{"condition":{"type":"equipped_by_char","char_id":"san_1_char_1002"},"bonus":{"combat":30}}
  -- 示例：{"grant_skill":"san_1_skill_1_4001"}
  -- 示例：{"summon_troop":{"troop_id":"san_1_troop_1003","trigger":"battle_start","count":1}}
  special_effect JSON COMMENT '特殊效果',
  
  description TEXT COMMENT '装备描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装备配置表';
```

**已删除的冗余字段**（从ID解析）：~~equipment_type~~、~~rarity~~

---


#### 3.3.9 称号配置表 (config_titles)

**说明**：存储称号的基础配置信息。赛季、类目、稀有度从ID解析，不单独存储。

**ID命名规范**：`san_1_title_1_4001`（赛季_title_类目编号_稀有度+序号）
- 详见 [25-TITLE_ACHIEVEMENT_SYSTEM.md](../20-data-layer/25-TITLE_ACHIEVEMENT_SYSTEM.md) 第2节

```sql
CREATE TABLE config_titles (
  title_id VARCHAR(50) PRIMARY KEY COMMENT '称号ID（如：san_1_title_1_4001，编码赛季+类目+稀有度）',
  title_name VARCHAR(100) NOT NULL COMMENT '称号名称',
  description TEXT COMMENT '描述',
  
  -- 显示相关
  display_name VARCHAR(100) COMMENT '显示名称（如【S1冠军】）',
  display_position ENUM('prefix', 'suffix') DEFAULT 'prefix' COMMENT '显示位置（前缀/后缀）',
  
  -- 解锁条件（JSON格式，支持多种条件组合）
  unlock_conditions JSON COMMENT '解锁条件（如：{"type":"season_rank","rank":1}）',
  unlock_conditions_desc VARCHAR(255) COMMENT '解锁条件中文描述（人类可读，如：新手指引事件）',
  
  -- 属性加成（×10存储，CSV填写显示值如 combat+5,command+3，脚本转换）
  attribute_bonus JSON COMMENT '属性加成（如：{"combat": 50, "command": 30}，表示武力+5.0，统帅+3.0）',
  
  -- 特殊效果（CSV标记语言格式，同装备件，与装备件共用解析器）
  special_effect TEXT COMMENT '特殊效果（CSV标记语言字符串，如：all_attributes_bonus:5）',
  special_effect_desc VARCHAR(255) COMMENT '特殊效果中文描述（如：全属性+0.5）',
  
  -- 其他
  is_unique BOOLEAN DEFAULT FALSE COMMENT '是否全服唯一',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='称号配置表';
```

**已删除的冗余字段**（v2.1.0，从ID解析）：~~season~~、~~rarity~~、~~category~~、~~display_order~~


---

#### 3.3.10 成就配置表 (config_achievements)

**说明**：存储成就的基础配置信息。赛季、类目、稀有度从ID解析，不单独存储。

**ID命名规范**：`san_1_achi_2_3001`（赛季_achi_类目编号_稀有度+序号）
- 详见 [25-TITLE_ACHIEVEMENT_SYSTEM.md](../20-data-layer/25-TITLE_ACHIEVEMENT_SYSTEM.md) 第2节

```sql
CREATE TABLE config_achievements (
  achievement_id VARCHAR(50) PRIMARY KEY COMMENT '成就ID（如：san_1_achi_2_3001，编码赛季+类目+稀有度）',
  achievement_name VARCHAR(100) NOT NULL COMMENT '成就名称',
  description TEXT COMMENT '描述',
  
  -- 成就链
  chain_id VARCHAR(50) COMMENT '成就链ID（同链成就填相同值，无链为NULL）',
  chain_level INT COMMENT '成就链层级（1-5，无链为NULL）',
  unlock_title VARCHAR(50) COMMENT '解锁的称号ID（完成成就后解锁对应称号，无则NULL）',
  
  -- 解锁条件（JSON格式，支持多种条件组合）
  unlock_conditions JSON COMMENT '解锁条件（如：{"win_battles": 100}）',
  unlock_conditions_desc VARCHAR(255) COMMENT '解锁条件中文描述（人类可读，如：战斗胜利100场）',
  
  -- 属性加成（×10存储，CSV填写显示值如 combat+5,command+3，脚本转换）
  attribute_bonus JSON COMMENT '属性加成（如：{"combat": 50}，表示武力+5.0）',
  
  -- 特殊效果（CSV标记语言格式，同装备件，与装备件共用解析器）
  special_effect TEXT COMMENT '特殊效果（CSV标记语言字符串，如：daily_silver_bonus:50）',
  special_effect_desc VARCHAR(255) COMMENT '特殊效果中文描述（如：每日额外银两+50）',
  
  -- 奖励
  rewards JSON COMMENT '解锁奖励（如：{"silver": 5000, "contribution": 100}）',
  
  -- 其他
  is_hidden BOOLEAN DEFAULT FALSE COMMENT '是否隐藏成就（解锁前不显示）',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_chain (chain_id, chain_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成就配置表';
```

**已删除的冗余字段**（v2.1.0，从ID解析）：~~season~~、~~rarity~~、~~category~~、~~display_order~~

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `achievement_id` | 成就ID（编码赛季+类目+稀有度） | san_1_achi_2_3001 |
| `achievement_name` | 成就名称 | 百战将军 |
| `description` | 描述 | 累计战斗胜利100场 |
| `chain_id` | 成就链ID | chain_combat_win（同链填相同值） |
| `chain_level` | 成就链层级 | 1-5（链中第几级） |
| `unlock_title` | 解锁称号ID | san_1_title_1_3001 |
| `unlock_conditions` | 解锁条件 | {"win_battles": 100} |
| `attribute_bonus` | 属性加成 | {"combat": 50}（×10存储，即武力+5.0） |
| `special_effects` | 特殊效果 | {"daily_silver_bonus": 50} |
| `rewards` | 解锁奖励 | {"silver": 5000, "contribution": 100} |
| `is_hidden` | 是否隐藏 | true=解锁前不显示，false=始终显示 |

**成就示例**：

```json
// 百战将军（战斗类成就链第3级）
{
  "achievement_id": "san_1_achi_2_3001",
  "achievement_name": "百战将军",
  "description": "累计战斗胜利100场",
  "chain_id": "chain_combat_win",
  "chain_level": 3,
  "unlock_title": "san_1_title_1_3001",
  "unlock_conditions": { "win_battles": 100 },
  "attribute_bonus": { "combat": 50 },
  "rewards": { "silver": 5000, "contribution": 100 }
}

// 战令持有者（氪金类，购买即解锁）
{
  "achievement_id": "san_1_achi_7_3001",
  "achievement_name": "战令持有者",
  "description": "开通当前赛季战令",
  "unlock_conditions": { "has_premium": true },
  "attribute_bonus": { "luck": 10 },
  "special_effects": { "daily_silver_bonus": 50 },
  "rewards": { "silver": 1000, "food": 2000 }
}

// 隐藏成就：传说再现（收集类）
{
  "achievement_id": "san_1_achi_4_4001",
  "achievement_name": "传说再现",
  "description": "招募所有传说级别将领",
  "is_hidden": true,
  "unlock_conditions": { "collect_all_legendary_characters": 1 },
  "rewards": { "silver": 100000, "contribution": 1000 }
}
```

**类目编号说明**（从ID解析）：

| 编号 | 类目 | 英文标识 | 示例 |
|:----:|------|---------|------|
| 1 | 荣誉类 | honor | 名列前茅、赛季精英 |
| 2 | 战斗类 | combat | 初战告捷、百战将军 |
| 3 | 经济类 | economic | 富甲一方、挥金如土 |
| 4 | 收集类 | collection | 兵种图鉴、传奇全装 |
| 5 | 事件类 | event | 鸿运当头、事件达人 |
| 6 | 社交类 | social | 势力栋梁、军团先锋 |
| 7 | 氪金类 | premium | 战令持有者 |

---

#### 3.3.13 阵型配置表 (config_formations)

**说明**：存储阵型的基础配置信息，每个赛季的阵型配置不同。阵型系统是战斗系统的核心机制之一，允许玩家在战斗开局时将多支部队组成战术阵型，获得强大的首回合加成。

**相关文档**：[17-6-FORMATION_SYSTEM.md](../10-core-system/17-6-FORMATION_SYSTEM.md) - 阵型系统

**术语说明**：
- **阵型（Formation）**：战斗中的战术阵型，存储在本表中
- **阵容（Lineup）**：战前配置的将领+部队组合，详见 [22-2-TROOP_LINEUP_SYSTEM.md](../20-data-layer/22-2-TROOP_LINEUP_SYSTEM.md)

```sql
CREATE TABLE config_formations (
  formation_id VARCHAR(50) PRIMARY KEY COMMENT '阵型ID（如：san_1_formation_001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从formation_id中提取）',
  formation_name VARCHAR(100) NOT NULL COMMENT '阵型名称',
  formation_type ENUM('offensive', 'defensive', 'balanced', 'flexible') NOT NULL COMMENT '阵型类型',
  formation_tier ENUM('normal', 'advanced') NOT NULL COMMENT '阵型等级（normal=3人，advanced=5人）',
  
  -- 触发条件（JSON格式）
  conditions JSON NOT NULL COMMENT '触发条件',
  
  -- 阵型形状（JSON格式）
  shape JSON NOT NULL COMMENT '阵型形状和位置',
  
  -- 攻击配置（JSON格式）
  attack JSON NOT NULL COMMENT '攻击距离和兵种加成',
  
  -- 首回合效果（JSON格式）
  first_turn_effects JSON NOT NULL COMMENT '首回合效果',
  
  -- 克制关系
  counters JSON COMMENT '克制的阵型列表',
  countered_by JSON COMMENT '被克制的阵型列表',
  
  -- 视觉效果（JSON格式）
  visual_effect JSON COMMENT '视觉效果配置',
  
  -- 优先级
  priority INT DEFAULT 0 COMMENT '优先级（多个阵型同时满足时）',
  
  -- 描述
  description TEXT COMMENT '阵型描述',
  icon_url VARCHAR(255) COMMENT '阵型图标',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_formation_type (formation_type),
  INDEX idx_formation_tier (formation_tier),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='阵型配置表';
```

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `formation_id` | 阵型ID | san_1_formation_001, san_1_formation_002 |
| `formation_name` | 阵型名称 | 锋矢阵、鹤翼阵、鱼鳞阵 |
| `formation_type` | 阵型类型 | offensive/defensive/balanced/flexible |
| `formation_tier` | 阵型等级 | normal（3人）/advanced（5人） |
| `conditions` | 触发条件 | 部队数量、兵种要求、地形要求 |
| `shape` | 阵型形状 | 部队相对位置、前中后排 |
| `attack` | 攻击配置 | 基础攻击距离、兵种距离加成 |
| `first_turn_effects` | 首回合效果 | 攻击加成、防御加成、移速加成 |
| `counters` | 克制的阵型 | ["鱼鳞阵"] |
| `countered_by` | 被克制的阵型 | ["方圆阵"] |
| `visual_effect` | 视觉效果 | 动画、音效、粒子效果 |
| `priority` | 优先级 | 多个阵型同时满足时的选择顺序 |

**JSON字段详细结构**：

**conditions（触发条件）**：
```json
{
  "minTroops": 3,
  "minTotalPower": 0,
  "requiredTroopTypes": {
    "cavalry": 1,
    "archer": 1,
    "infantry": 2
  },
  "terrainRequirements": {
    "deployableTiles": ["plain", "hill"],
    "requiredTiles": { "plain": 3 },
    "forbiddenTiles": ["water", "mountain"]
  }
}
```

**shape（阵型形状）**：
```json
{
  "positions": [
    {
      "x": 0,
      "y": 0,
      "row": "front",
      "role": "vanguard"
    },
    {
      "x": -1,
      "y": 1,
      "row": "middle",
      "role": "left_wing"
    },
    {
      "x": 1,
      "y": 1,
      "row": "middle",
      "role": "right_wing"
    }
  ]
}
```

**attack（攻击配置）**：
```json
{
  "baseRange": [1, 3],
  "rangeBonus": {
    "cavalry": 1,
    "archer": 2,
    "infantry": 0
  }
}
```

**first_turn_effects（首回合效果）**：
```json
{
  "attackBonus": 30,
  "defenseBonus": 0,
  "moveBonus": 1,
  "rangeBonus": 0,
  "dodgeBonus": 0,
  "counterBonus": 0,
  "defensiveBonus": 15
}
```

**visual_effect（视觉效果）**：
```json
{
  "animation": "charge_lines",
  "sound": "cavalry_charge",
  "cameraShake": true,
  "particleEffect": "dust_cloud"
}
```

**阵型示例**：

```json
// 锋矢阵（进攻型，3人）
{
  "formation_id": "san_1_formation_001",
  "formation_name": "锋矢阵",
  "formation_type": "offensive",
  "formation_tier": "normal",
  "conditions": {
    "minTroops": 3,
    "requiredTroopTypes": { "cavalry": 1 },
    "terrainRequirements": {
      "deployableTiles": ["plain", "hill"],
      "requiredTiles": { "plain": 2 },
      "forbiddenTiles": ["water", "mountain", "forest"]
    }
  },
  "shape": {
    "positions": [
      {"x": 0, "y": 0, "row": "front", "role": "vanguard"},
      {"x": -1, "y": 1, "row": "middle", "role": "left_wing"},
      {"x": 1, "y": 1, "row": "middle", "role": "right_wing"}
    ]
  },
  "attack": {
    "baseRange": [1, 2],
    "rangeBonus": { "cavalry": 1, "archer": 2, "infantry": 0 }
  },
  "first_turn_effects": {
    "attackBonus": 30,
    "defenseBonus": 0,
    "moveBonus": 1,
    "defensiveBonus": 15
  },
  "counters": ["鱼鳞阵"],
  "countered_by": ["方圆阵"],
  "priority": 5,
  "description": "骑兵为锋，冲锋陷阵。适合平原作战，首回合攻击力大幅提升。"
}

// 方圆阵（防御型，5人）
{
  "formation_id": "san_1_formation_006",
  "formation_name": "方圆阵",
  "formation_type": "defensive",
  "formation_tier": "advanced",
  "conditions": {
    "minTroops": 5,
    "requiredTroopTypes": { "infantry": 3 },
    "terrainRequirements": {
      "deployableTiles": ["hill", "forest", "plain"],
      "requiredTiles": { "hill": 2 }
    }
  },
  "shape": {
    "positions": [
      {"x": -1, "y": 0, "row": "front", "role": "left_front"},
      {"x": 0, "y": 0, "row": "front", "role": "center_front"},
      {"x": 1, "y": 0, "row": "front", "role": "right_front"},
      {"x": -1, "y": 1, "row": "back", "role": "left_back"},
      {"x": 1, "y": 1, "row": "back", "role": "right_back"}
    ]
  },
  "attack": {
    "baseRange": [1, 2],
    "rangeBonus": { "cavalry": 0, "archer": 1, "infantry": 0 }
  },
  "first_turn_effects": {
    "attackBonus": 5,
    "defenseBonus": 35,
    "counterBonus": 20,
    "moveBonus": -1,
    "defensiveBonus": 15
  },
  "counters": ["锋矢阵"],
  "countered_by": ["长蛇阵"],
  "priority": 4,
  "description": "固若金汤，铜墙铁壁。适合防守要地，防御力极强。"
}
```

**阵型类型说明**：

| 类型 | 说明 | 特点 | 示例 |
|------|------|------|------|
| offensive | 进攻型 | 高攻击加成，低防御 | 锋矢阵、雁行阵 |
| defensive | 防御型 | 高防御加成，低移速 | 鱼鳞阵、方圆阵 |
| balanced | 平衡型 | 攻守兼备 | 鹤翼阵、偃月阵、衡轭阵 |
| flexible | 灵活型 | 高移速，高闪避 | 长蛇阵 |

**阵型等级说明**：

| 等级 | 部队数量 | 说明 |
|------|---------|------|
| normal | 3支部队 | 普通阵型，容易触发 |
| advanced | 5支部队 | 高级阵型，效果更强 |

**阵型克制关系**：

| 阵型 | 克制 | 被克制 |
|------|------|--------|
| 锋矢阵 | 鱼鳞阵 | 方圆阵 |
| 鹤翼阵 | 长蛇阵 | 锋矢阵 |
| 鱼鳞阵 | 鹤翼阵 | 锋矢阵 |
| 长蛇阵 | 方圆阵 | 鹤翼阵 |
| 雁行阵 | 长蛇阵 | 偃月阵 |
| 方圆阵 | 锋矢阵 | 长蛇阵 |
| 偃月阵 | 雁行阵 | 方圆阵 |
| 衡轭阵 | 鹤翼阵 | 雁行阵 |

---

#### 3.3.14 传书模板配置表 (config_texts)

**说明**：存储系统/奖励类传书的**模板**，供运营后台维护与试发；玩家实际收到的记录写在 `texts` 表。`mail_type` 与 `texts.type` 对齐，仅取 `system`、`reward`（玩家间传书、军团传书不走本表）。

**相关文档**：[18-2-TEXT_SYSTEM.md](../10-core-system/18-2-TEXT_SYSTEM.md)

```sql
CREATE TABLE config_texts (
  template_id VARCHAR(50) PRIMARY KEY COMMENT '模板ID（如 san_1_mail_welcome）',
  mail_type ENUM('system', 'reward') NOT NULL COMMENT '实例化到 texts.type',
  subject VARCHAR(100) NOT NULL COMMENT '标题',
  body TEXT NOT NULL COMMENT '正文（写入 texts.content 时截断至 1000 字符）',
  attachments_json JSON NULL COMMENT '奖励型附件，字段与游戏经济一致，如 silver、food、reputation、items 等',
  season VARCHAR(20) NULL COMMENT '赛季筛选（可选）',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '列表排序',
  remark VARCHAR(255) NULL COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_season (season),
  INDEX idx_mail_type (mail_type),
  INDEX idx_enabled_sort (is_enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='传书/系统邮件模板配置表';
```

**字段说明**：

| 字段名 | 说明 |
|--------|------|
| `template_id` | 主键，建议带赛季前缀 |
| `mail_type` | `system`：无领取流程；`reward`：通常配合 `attachments_json`，需领取 |
| `attachments_json` | 与 `texts.attachments` 结构一致；`system` 型可为 NULL |
| `is_enabled` | 后台列表可过滤；定时任务发放时可只读启用行 |

---

#### 3.3.11 道具配置表 (config_items)

**说明**：存储事件链道具的配置数据。道具是一次性消耗品（事件钥匙），用于串联事件链。

**数据来源**：CSV（主数据源）→ JSON（转换）→ MySQL（导入）
- CSV文件：`docs/tools/event/item-template.csv`
- 转换脚本：`docs/tools/event/item-csv-to-json.cjs`
- 导入脚本：`backend/database/import-items-data.js`

```sql
CREATE TABLE config_items (
  item_id VARCHAR(50) PRIMARY KEY COMMENT '道具ID（如：san_1_item_taoyuan）',
  item_name VARCHAR(100) NOT NULL COMMENT '道具名称（如：桃园令牌）',
  description TEXT COMMENT '道具描述',
  item_type ENUM('event_key') NOT NULL DEFAULT 'event_key' COMMENT '道具类型',
  season VARCHAR(20) COMMENT '赛季标识',
  version VARCHAR(10) DEFAULT '1.0' COMMENT '版本',
  special_effect VARCHAR(128) NULL COMMENT '道具特殊效果标识（如 repair_legendary_min_durability_full）'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='道具配置表（事件链钥匙）';
```

**玩家道具存储**：道具存储在 `players.items` JSON 字段中，格式为 `{"item_id": quantity}`。

**special_effect**：由 `item-template.csv` 列 `special_effect` 经 JSON 导入；服务端事件结算等逻辑统一查库，不依赖 `items.json` 中的该字段。

---

#### 3.3.12 事件配置表 (config_events)

**说明**：存储游戏事件的配置数据，包括探索事件、城市事件等。事件可以是独立事件，也可以是事件链中的一环。

**数据来源**：CSV（主数据源）→ JSON（转换）→ MySQL（导入）
- CSV文件：`docs/tools/event/event-template.csv`
- 转换脚本：`docs/tools/event/event-csv-to-json.cjs`
- 导入脚本：`backend/database/import-events-data.js`

```sql
CREATE TABLE config_events (
  event_id VARCHAR(50) PRIMARY KEY COMMENT '事件ID（如：san_1_event_explore_001）',
  event_name VARCHAR(100) NOT NULL COMMENT '事件名称',
  location VARCHAR(100) COMMENT '触发地点',
  min_position_level INT COMMENT '最低官职等级要求',
  trigger_probability DECIMAL(4,2) NOT NULL DEFAULT 0.10 COMMENT '触发概率',
  trigger_context VARCHAR(50) COMMENT '触发场景（explore/city/battle/story/special）',
  
  -- 事件链字段
  chain_id VARCHAR(50) COMMENT '事件链ID（如：san_1_chain_rescue_woman）',
  chain_level INT COMMENT '事件链层级（1-5）',
  required_items VARCHAR(255) COMMENT '前置道具（事件链钥匙）',
  
  -- 事件描述（分段存储）
  description_1 TEXT COMMENT '描述第1段',
  description_2 TEXT COMMENT '描述第2段',
  description_3 TEXT COMMENT '描述第3段',
  
  -- 选项数据（JSON格式，内部key使用camelCase）
  option_a JSON COMMENT '选项A完整数据',
  option_b JSON COMMENT '选项B完整数据',
  
  tags VARCHAR(255) COMMENT '标签',
  version VARCHAR(20) DEFAULT '1.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_location (location),
  INDEX idx_trigger_context (trigger_context),
  INDEX idx_chain_id (chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='事件配置表';
```

**字段说明**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| `event_id` | 事件ID | san_1_event_explore_001 |
| `event_name` | 事件名称 | 路遇山贼 |
| `location` | 触发地点 | nanyang_outskirts |
| `min_position_level` | 最低官职等级 | 1 |
| `trigger_probability` | 触发概率 | 0.10（10%） |
| `trigger_context` | 触发场景 | explore/city/battle/story/special |
| `chain_id` | 事件链ID | san_1_chain_rescue_woman |
| `chain_level` | 事件链层级 | 1-5 |
| `required_items` | 前置道具 | san_1_item_rescue_clue |
| `description_1/2/3` | 事件描述分段 | 叙事文本 |
| `option_a` | 选项A数据（JSON） | 包含text、mainRequirement、subFactors等 |
| `option_b` | 选项B数据（JSON） | 包含text、mainRequirement、subFactors等 |
| `tags` | 标签 | combat,moral_choice |
| `version` | 版本号 | 1.0 |

**option_a / option_b JSON结构**：

```json
{
  "text": "拔刀相助",
  "mainRequirement": "combat",
  "subFactors": ["courage", "luck"],
  "subRequirement": "courage",
  "successRate": "0.55",
  "rewards": "reputation+2,silver+50",
  "penalties": "food-30",
  "battleVictoryText": "你击退了山贼，村民感激不尽。",
  "battleDefeatText": "山贼人多势众，你负伤撤退。"
}
```

---


## 4️⃣ Redis缓存策略

### 4.1 缓存数据类型

**String类型**：
```javascript
// 玩家在线状态
key: `player:online:${playerId}`
value: "1"
ttl: 300秒（5分钟）

// 玩家会话
key: `session:${sessionId}`
value: JSON.stringify({ playerId, accountId, loginAt })
ttl: 7200秒（2小时）
```

**Hash类型**：
```javascript
// 玩家基础信息
key: `player:info:${playerId}`
fields: {
  characterName: "云中鹤",
  reputation: "150",
  food: "1000",
  silver: "500",
  combat: "65",  // 存储×10后的值
  intelligence: "72"
}
ttl: 3600秒（1小时）

// 玩家装备槽
key: `player:equipment:${playerId}`
fields: {
  player_position: "position_inst_001",
  player_equipment_card: "equip_card_inst_001",
  player_title: "title_inst_001",
  player_troop: "troop_inst_001"
}
ttl: 3600秒（1小时）
```

**List类型**：
```javascript
// 玩家卡牌列表
key: `player:cards:${playerId}`
value: ["card_inst_001", "card_inst_002", "card_inst_003"]
ttl: 3600秒（1小时）
```

**Sorted Set类型**：
```javascript
// 声望排行榜
key: `ranking:reputation`
members: playerId
scores: reputation
ttl: 300秒（5分钟）

// 战斗力排行榜
key: `ranking:combat_power`
members: playerId
scores: combatPower
ttl: 300秒（5分钟）
```

### 4.2 缓存更新策略

**Cache-Aside模式（推荐）**：

```javascript
// 读取数据
async function getPlayerInfo(playerId) {
  // 1. 先查Redis
  const cached = await redis.hgetall(`player:info:${playerId}`);
  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }
  
  // 2. Redis没有，查MySQL
  const player = await mysql.query(
    'SELECT * FROM players WHERE player_id = ?',
    [playerId]
  );
  
  // 3. 写入Redis
  if (player) {
    await redis.hmset(`player:info:${playerId}`, player);
    await redis.expire(`player:info:${playerId}`, 3600);
  }
  
  return player;
}

// 更新数据
async function updatePlayerReputation(playerId, newReputation) {
  // 1. 更新MySQL
  await mysql.query(
    'UPDATE players SET reputation = ? WHERE player_id = ?',
    [newReputation, playerId]
  );
  
  // 2. 删除Redis缓存（让下次读取时重新加载）
  await redis.del(`player:info:${playerId}`);
  
  // 3. 更新排行榜
  await redis.zadd('ranking:reputation', newReputation, playerId);
}
```

### 4.3 缓存预热

```javascript
// 服务器启动时预热热门数据
async function warmupCache() {
  // 1. 加载在线玩家数据
  const onlinePlayers = await mysql.query(
    'SELECT * FROM players WHERE last_active_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
  );
  
  for (const player of onlinePlayers) {
    await redis.hmset(`player:info:${player.player_id}`, player);
    await redis.expire(`player:info:${player.player_id}`, 3600);
  }
  
  // 2. 加载排行榜数据
  const topPlayers = await mysql.query(
    'SELECT player_id, reputation FROM players ORDER BY reputation DESC LIMIT 100'
  );
  
  for (const player of topPlayers) {
    await redis.zadd('ranking:reputation', player.reputation, player.player_id);
  }
  
  console.log('Cache warmup completed');
}
```

### 4.4 缓存失效策略

**主动失效**：
- 玩家数据更新时删除缓存
- 战斗结束时删除战斗缓存
- 任务完成时删除任务缓存

**被动失效**：
- 设置合理的TTL
- 玩家信息：1小时
- 排行榜：5分钟
- 会话：2小时

**定时刷新**：
```javascript
// 每5分钟刷新排行榜
setInterval(async () => {
  const topPlayers = await mysql.query(
    'SELECT player_id, reputation FROM players ORDER BY reputation DESC LIMIT 100'
  );
  
  await redis.del('ranking:reputation');
  for (const player of topPlayers) {
    await redis.zadd('ranking:reputation', player.reputation, player.player_id);
  }
}, 5 * 60 * 1000);
```

---


## 5️⃣ 数据访问层设计

### 5.1 数据访问层架构

```javascript
/**
 * 数据访问层（DAL）
 * 封装所有数据库操作，提供统一的数据访问接口
 */

// 1. 基础数据访问类
class BaseDAO {
  constructor(tableName) {
    this.tableName = tableName;
    this.mysql = require('./mysql');
    this.redis = require('./redis');
  }
  
  // 通用查询方法
  async findById(id) {
    const [rows] = await this.mysql.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return rows[0];
  }
  
  // 通用插入方法
  async insert(data) {
    const [result] = await this.mysql.query(
      `INSERT INTO ${this.tableName} SET ?`,
      data
    );
    return result.insertId;
  }
  
  // 通用更新方法
  async update(id, data) {
    const [result] = await this.mysql.query(
      `UPDATE ${this.tableName} SET ? WHERE id = ?`,
      [data, id]
    );
    return result.affectedRows;
  }
  
  // 通用删除方法
  async delete(id) {
    const [result] = await this.mysql.query(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.affectedRows;
  }
}

// 2. 玩家数据访问类
class PlayerDAO extends BaseDAO {
  constructor() {
    super('players');
  }
  
  // 获取玩家信息（带缓存）
  async getPlayerInfo(playerId) {
    // 1. 先查Redis
    const cacheKey = `player:info:${playerId}`;
    const cached = await this.redis.hgetall(cacheKey);
    
    if (cached && Object.keys(cached).length > 0) {
      // 转换数值类型
      return this.convertToDisplay(cached);
    }
    
    // 2. 查MySQL
    const [rows] = await this.mysql.query(
      'SELECT * FROM players WHERE player_id = ?',
      [playerId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const player = rows[0];
    
    // 3. 写入Redis
    await this.redis.hmset(cacheKey, player);
    await this.redis.expire(cacheKey, 3600);
    
    return this.convertToDisplay(player);
  }
  
  // 更新玩家声望
  async updateReputation(playerId, newReputation) {
    // 1. 更新MySQL
    await this.mysql.query(
      'UPDATE players SET reputation = ?, updated_at = NOW() WHERE player_id = ?',
      [newReputation, playerId]
    );
    
    // 2. 删除Redis缓存
    await this.redis.del(`player:info:${playerId}`);
    
    // 3. 更新排行榜
    await this.redis.zadd('ranking:reputation', newReputation, playerId);
  }
  
  // 转换显示值（×10的字段÷10）
  convertToDisplay(player) {
    const displayFields = [
      'combat', 'intelligence', 'command', 'politics', 
      'charm', 'courage', 'luck'
    ];
    
    const result = { ...player };
    displayFields.forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = result[field] / 10;
      }
    });
    
    return result;
  }
}

// 3. 卡牌数据访问类
class CardDAO extends BaseDAO {
  constructor() {
    super('player_cards');
  }
  
  // 获取玩家所有卡牌
  async getPlayerCards(playerId) {
    const [rows] = await this.mysql.query(
      'SELECT * FROM player_cards WHERE player_id = ? ORDER BY obtained_at DESC',
      [playerId]
    );
    
    return rows.map(card => this.convertToDisplay(card));
  }
  
  // 装备卡牌
  async equipCard(instanceId, equippedBy, equippedSlot) {
    await this.mysql.query(
      'UPDATE player_cards SET is_equipped = TRUE, equipped_by = ?, equipped_slot = ? WHERE instance_id = ?',
      [equippedBy, equippedSlot, instanceId]
    );
    
    // 删除缓存
    const [card] = await this.mysql.query(
      'SELECT player_id FROM player_cards WHERE instance_id = ?',
      [instanceId]
    );
    
    if (card.length > 0) {
      await this.redis.del(`player:cards:${card[0].player_id}`);
      await this.redis.del(`player:equipment:${card[0].player_id}`);
    }
  }
  
  // 转换显示值
  convertToDisplay(card) {
    const displayFields = ['attack', 'defense', 'force', 'command_attr', 'intelligence_attr'];
    
    const result = { ...card };
    displayFields.forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = result[field] / 10;
      }
    });
    
    return result;
  }
}

// 4. 战斗数据访问类
class BattleDAO extends BaseDAO {
  constructor() {
    super('battles');
  }
  
  // 记录战斗
  async recordBattle(battleData) {
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.mysql.query(
      'INSERT INTO battles SET ?',
      {
        battle_id: battleId,
        ...battleData,
        battle_at: new Date()
      }
    );
    
    // 更新统计数据
    await this.updateStatistics(battleData.player_id, battleData);
    
    return battleId;
  }
  
  // 更新统计数据
  async updateStatistics(playerId, battleData) {
    const result = battleData.result;
    const winIncrement = result === 'win' ? 1 : 0;
    const lossIncrement = result === 'lose' ? 1 : 0;
    const drawIncrement = result === 'draw' ? 1 : 0;
    
    await this.mysql.query(`
      UPDATE statistics SET
        total_battles = total_battles + 1,
        wins = wins + ?,
        losses = losses + ?,
        draws = draws + ?,
        win_rate = (wins + ?) / (total_battles + 1) * 100,
        total_damage_dealt = total_damage_dealt + ?,
        total_damage_taken = total_damage_taken + ?,
        total_kills = total_kills + ?
      WHERE player_id = ?
    `, [
      winIncrement, lossIncrement, drawIncrement, winIncrement,
      battleData.total_damage_dealt || 0,
      battleData.total_damage_taken || 0,
      battleData.total_kills || 0,
      playerId
    ]);
  }
}

// 导出
module.exports = {
  PlayerDAO,
  CardDAO,
  BattleDAO
};
```

### 5.2 使用示例

```javascript
const { PlayerDAO, CardDAO, BattleDAO } = require('./dao');

// 1. 获取玩家信息
const playerDAO = new PlayerDAO();
const player = await playerDAO.getPlayerInfo('player_001');
console.log(player.combat);  // 6.5（已转换为显示值）

// 2. 更新玩家声望
await playerDAO.updateReputation('player_001', 150);

// 3. 获取玩家卡牌
const cardDAO = new CardDAO();
const cards = await cardDAO.getPlayerCards('player_001');

// 4. 装备卡牌
await cardDAO.equipCard('troop_inst_001', 'player', 'troop');

// 5. 记录战斗
const battleDAO = new BattleDAO();
await battleDAO.recordBattle({
  player_id: 'player_001',
  battle_type: 'pve',
  opponent_id: 'ai_001',
  opponent_name: 'AI对手',
  result: 'win',
  total_damage_dealt: 500,
  total_damage_taken: 200,
  total_kills: 3,
  rewards: { food: 100, silver: 50 }
});
```

---


## 6️⃣ 性能优化方案

### 6.1 索引优化

**高频查询字段必须建索引**：
```sql
-- 玩家表
CREATE INDEX idx_reputation ON players(reputation);
CREATE INDEX idx_faction ON players(faction_id);

-- 卡牌表
CREATE INDEX idx_player_card_type ON player_cards(player_id, card_type);
CREATE INDEX idx_equipped ON player_cards(is_equipped, equipped_by);

-- 战斗表
CREATE INDEX idx_player_battle_type ON battles(player_id, battle_type);
CREATE INDEX idx_battle_at ON battles(battle_at);
```

**复合索引优化查询**：
```sql
-- 查询玩家的已装备卡牌
CREATE INDEX idx_player_equipped ON player_cards(player_id, is_equipped);

-- 查询特定类型的卡牌
CREATE INDEX idx_player_card_rarity ON player_cards(player_id, card_type, rarity);
```

### 6.2 查询优化

**避免SELECT ***：
```javascript
// ❌ 不推荐
const players = await mysql.query('SELECT * FROM players');

// ✅ 推荐
const players = await mysql.query(
  'SELECT player_id, character_name, reputation, combat FROM players'
);
```

**使用LIMIT分页**：
```javascript
// 排行榜分页
const page = 1;
const pageSize = 20;
const offset = (page - 1) * pageSize;

const topPlayers = await mysql.query(
  'SELECT player_id, character_name, reputation FROM players ORDER BY reputation DESC LIMIT ? OFFSET ?',
  [pageSize, offset]
);
```

**批量操作**：
```javascript
// ❌ 不推荐：循环插入
for (const card of cards) {
  await mysql.query('INSERT INTO player_cards SET ?', card);
}

// ✅ 推荐：批量插入
const values = cards.map(card => [
  card.instance_id, card.player_id, card.card_type, card.card_id
]);

await mysql.query(
  'INSERT INTO player_cards (instance_id, player_id, card_type, card_id) VALUES ?',
  [values]
);
```

### 6.3 连接池配置

```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 连接池配置
  connectionLimit: 10,        // 最大连接数
  queueLimit: 0,              // 队列限制（0=无限制）
  waitForConnections: true,   // 等待可用连接
  
  // 性能优化
  enableKeepAlive: true,      // 保持连接活跃
  keepAliveInitialDelay: 0,   // 初始延迟
  
  // 字符集
  charset: 'utf8mb4'
});

module.exports = pool;
```

### 6.4 Redis优化

**使用Pipeline批量操作**：
```javascript
// ❌ 不推荐：多次网络请求
for (const player of players) {
  await redis.zadd('ranking:reputation', player.reputation, player.player_id);
}

// ✅ 推荐：Pipeline批量操作
const pipeline = redis.pipeline();
for (const player of players) {
  pipeline.zadd('ranking:reputation', player.reputation, player.player_id);
}
await pipeline.exec();
```

**合理设置TTL**：
```javascript
// 热数据：短TTL，频繁更新
await redis.setex('player:online:player_001', 300, '1');  // 5分钟

// 温数据：中等TTL
await redis.expire('player:info:player_001', 3600);  // 1小时

// 冷数据：长TTL
await redis.expire('player:history:player_001', 86400);  // 24小时
```

### 6.5 数据库分区（未来扩展）

**按时间分区（战斗记录表）**：
```sql
CREATE TABLE battles (
  battle_id VARCHAR(50),
  player_id VARCHAR(4),
  battle_at DATETIME,
  -- 其他字段
  PRIMARY KEY (battle_id, battle_at)
) PARTITION BY RANGE (YEAR(battle_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

**按玩家ID分区（玩家表）**：
```sql
-- 使用HASH分区，按player_id分散数据
CREATE TABLE players (
  player_id VARCHAR(4) PRIMARY KEY,
  -- 其他字段
) PARTITION BY HASH(CRC32(player_id)) PARTITIONS 8;
```

---


## 7️⃣ 数据迁移方案

### 7.1 初始化数据库

```javascript
/**
 * 数据库初始化脚本
 * 文件：scripts/init-database.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function initDatabase() {
  // 1. 连接MySQL
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  
  // 2. 创建数据库
  await connection.query('CREATE DATABASE IF NOT EXISTS 05_san_storm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connection.query('USE 05_san_storm');
  
  // 3. 读取并执行SQL文件
  const sqlFiles = [
    'schema/01-accounts.sql',
    'schema/02-players.sql',
    'schema/03-player_cards.sql',
    'schema/04-player_garrison.sql',
    'schema/06-player_progress.sql',
    'schema/07-player_events.sql',
    'schema/08-battles.sql',
    'schema/09-statistics.sql',
    'schema/10-season_records.sql',
    'schema/11-season_inheritances.sql',
    'schema/config/01-config_troops.sql',
    'schema/config/02-config_characters.sql',
    'schema/config/03-config_equipment.sql',
    'schema/config/04-config_positions.sql',
    'schema/config/05-config_titles.sql',
    'schema/config/06-config_achievements.sql'
  ];
  
  for (const sqlFile of sqlFiles) {
    const sqlPath = path.join(__dirname, '..', 'database', sqlFile);
    const sql = await fs.readFile(sqlPath, 'utf8');
    await connection.query(sql);
    console.log(`✅ Executed: ${sqlFile}`);
  }
  
  // 4. 导入配置数据
  await importConfigData(connection);
  
  await connection.end();
  console.log('✅ Database initialization completed');
}

async function importConfigData(connection) {
  // 导入部队配置
  const troops = require('../data/shared/troops.json');
  for (const troop of troops.troops) {
    await connection.query('INSERT INTO config_troops SET ?', {
      troop_id: troop.id,
      troop_name: troop.name,
      rarity: troop.rarity,
      troop_type: troop.type,
      attack: Math.round(troop.attack * 10),  // ×10存储
      defense: Math.round(troop.defense * 10),
      max_troops: troop.maxTroops,
      speed: troop.speed,
      movement: troop.movement,
      attack_range: troop.attackRange
    });
  }
  console.log('✅ Imported troops config');
  
  // 导入将领配置
  const characters = require('../data/shared/characters.json');
  for (const char of characters.characters) {
    await connection.query('INSERT INTO config_characters SET ?', {
      character_id: char.id,
      character_name: char.name,
      rarity: char.rarity,
      luck: Math.round(char.luck * 10),
      courage: Math.round(char.courage * 10),
      combat: Math.round(char.combat * 10),
      command: Math.round(char.command * 10),
      intelligence: Math.round(char.intelligence * 10),
      politics: Math.round(char.politics * 10),
      charm: Math.round(char.charm * 10),
      skill_1: char.skill1,
      skill_2: char.skill2,
      troop_affinity: char.troopAffinity,
      trait: char.trait
    });
  }
  console.log('✅ Imported characters config');
  
  // 导入称号配置
  const titles = require('../data/shared/titles.json');
  for (const title of titles.titles) {
    await connection.query('INSERT INTO config_titles SET ?', {
      title_id: title.title_id,
      title_name: title.title_name,
      description: title.description,
      display_name: title.display_name,
      display_position: title.display_position,
      unlock_conditions: JSON.stringify(title.unlock_conditions),
      attribute_bonus: JSON.stringify(title.attribute_bonus),
      attribute_bonus: JSON.stringify(title.attribute_bonus),
      special_effect: title.special_effect ? JSON.stringify({ raw: title.special_effect }) : null,
      special_effect_desc: title.special_effect_desc || null,
      is_unique: title.is_unique || false,
    });
  }
  console.log('✅ Imported titles config');
  
  // 导入成就配置
  const achievements = require('../data/shared/achievements.json');
  for (const achievement of achievements.achievements) {
    await connection.query('INSERT INTO config_achievements SET ?', {
      achievement_id: achievement.achievement_id,
      achievement_name: achievement.achievement_name,
      description: achievement.description,
      chain_id: achievement.chain_id,
      chain_level: achievement.chain_level,
      unlock_title: achievement.unlock_title,
      unlock_conditions: JSON.stringify(achievement.unlock_conditions),
      attribute_bonus: JSON.stringify(achievement.attribute_bonus),
      special_effect: achievement.special_effect ? JSON.stringify({ raw: achievement.special_effect }) : null,
      special_effect_desc: achievement.special_effect_desc || null,
      rewards: JSON.stringify(achievement.rewards),
      is_hidden: achievement.is_hidden || false,
    });
  }
  console.log('✅ Imported achievements config');
}

// 运行初始化
initDatabase().catch(console.error);
```

### 7.2 数据迁移脚本

```javascript
/**
 * 数据迁移脚本
 * 文件：scripts/migrate-data.js
 */

const mysql = require('mysql2/promise');

async function migrateData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: '05_san_storm'
  });
  
  // 1. 迁移玩家属性（如果现有数据是小数，需要×10）
  console.log('Migrating player attributes...');
  await connection.query(`
    UPDATE players SET
      combat = ROUND(combat * 10),
      intelligence = ROUND(intelligence * 10),
      command = ROUND(command * 10),
      politics = ROUND(politics * 10),
      charm = ROUND(charm * 10),
      courage = ROUND(courage * 10),
      luck = ROUND(luck * 10),
      courage = ROUND(courage * 10),
      combat = ROUND(combat * 10),
      command = ROUND(command * 10),
      intelligence = ROUND(intelligence * 10),
      politics = ROUND(politics * 10),
      charm = ROUND(charm * 10)
    WHERE combat < 100
  `);
  console.log('✅ Player attributes migrated');
  
  // 2. 迁移卡牌属性
  console.log('Migrating card attributes...');
  await connection.query(`
    UPDATE player_cards SET
      attack = ROUND(attack * 10),
      defense = ROUND(defense * 10),
      force = ROUND(force * 10),
      command_attr = ROUND(command_attr * 10),
      intelligence_attr = ROUND(intelligence_attr * 10)
    WHERE attack IS NOT NULL AND attack < 100
  `);
  console.log('✅ Card attributes migrated');
  
  await connection.end();
  console.log('✅ Data migration completed');
}

migrateData().catch(console.error);
```

### 7.3 数据备份脚本

```javascript
/**
 * 数据备份脚本
 * 文件：scripts/backup-database.js
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
  
  // 创建备份目录
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // 执行mysqldump
  const command = `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} 05_san_storm > ${backupFile}`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Backup failed:', error);
      return;
    }
    console.log(`✅ Backup completed: ${backupFile}`);
  });
}

// 每天凌晨2点自动备份
const schedule = require('node-schedule');
schedule.scheduleJob('0 2 * * *', backupDatabase);

// 立即执行一次
backupDatabase();
```

---


## 8️⃣ 实施计划

### 阶段1：MVP阶段（纯MySQL）⏱️ 2-3周

**目标**：快速开发，验证核心功能

**实施内容**：
1. ✅ 创建MySQL数据库和表结构
2. ✅ 实现数据访问层（DAO）
3. ✅ 实现核心API接口
4. ✅ 实现数值转换工具类
5. ✅ 完成基础功能测试

**技术栈**：
- 数据库：MySQL 8.0
- 后端：Node.js + Express
- ORM：mysql2（原生SQL）

**性能指标**：
- 支持100-500并发用户
- API响应时间 < 200ms
- 数据库查询时间 < 50ms

**代码示例**：
```javascript
// 简单的MySQL连接
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: '05_san_storm',
  connectionLimit: 10
});

// 简单的API接口
app.get('/api/player/:id', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM players WHERE player_id = ?',
    [req.params.id]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Player not found' });
  }
  
  // 转换显示值
  const player = NumericConverter.convertToDisplay(rows[0], [
    'combat', 'intelligence', 'command', 'politics', 
    'charm', 'courage', 'luck'
  ]);
  
  res.json({ success: true, data: player });
});
```

---

### 阶段2：优化阶段（引入Redis）⏱️ 1-2周

**目标**：性能优化，提升用户体验

**实施内容**：
1. ✅ 部署Redis服务器
2. ✅ 实现Redis缓存层
3. ✅ 实现Cache-Aside模式
4. ✅ 实现排行榜功能
5. ✅ 实现会话管理
6. ✅ 性能测试和优化

**技术栈**：
- 缓存：Redis 7.0
- 客户端：ioredis

**性能指标**：
- 支持1000-5000并发用户
- API响应时间 < 100ms
- 缓存命中率 > 80%

**代码示例**：
```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'password',
  db: 0
});

// 带缓存的API接口
app.get('/api/player/:id', async (req, res) => {
  const playerId = req.params.id;
  const cacheKey = `player:info:${playerId}`;
  
  // 1. 先查Redis
  const cached = await redis.hgetall(cacheKey);
  if (cached && Object.keys(cached).length > 0) {
    const player = NumericConverter.convertToDisplay(cached, [
      'combat', 'intelligence', 'command', 'politics', 
      'charm', 'courage', 'luck'
    ]);
    return res.json({ success: true, data: player, cached: true });
  }
  
  // 2. 查MySQL
  const [rows] = await pool.query(
    'SELECT * FROM players WHERE player_id = ?',
    [playerId]
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Player not found' });
  }
  
  const player = rows[0];
  
  // 3. 写入Redis
  await redis.hmset(cacheKey, player);
  await redis.expire(cacheKey, 3600);
  
  // 4. 转换并返回
  const displayPlayer = NumericConverter.convertToDisplay(player, [
    'combat', 'intelligence', 'command', 'politics', 
    'charm', 'courage', 'luck'
  ]);
  
  res.json({ success: true, data: displayPlayer, cached: false });
});

// 排行榜API
app.get('/api/ranking/reputation', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  
  // 从Redis获取排行榜
  const ranking = await redis.zrevrange(
    'ranking:reputation',
    start,
    end,
    'WITHSCORES'
  );
  
  // 格式化数据
  const players = [];
  for (let i = 0; i < ranking.length; i += 2) {
    players.push({
      playerId: ranking[i],
      reputation: parseInt(ranking[i + 1]),
      rank: start + (i / 2) + 1
    });
  }
  
  res.json({ success: true, data: players });
});
```

---

### 阶段3：扩展阶段（读写分离、分库分表）⏱️ 2-3周

**目标**：支持大规模用户，提升系统可扩展性

**实施内容**：
1. ✅ 配置MySQL主从复制
2. ✅ 实现读写分离
3. ✅ 实现数据库分区
4. ✅ 实现分库分表（可选）
5. ✅ 实现数据同步机制
6. ✅ 压力测试和性能调优

**技术栈**：
- 主从复制：MySQL Replication
- 读写分离：自定义中间件
- 分库分表：ShardingSphere（可选）

**性能指标**：
- 支持10000+并发用户
- API响应时间 < 50ms
- 数据库查询时间 < 20ms

**架构图**：
```
                    ┌─────────────┐
                    │   客户端     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   API层     │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────┐              ┌──────────┐
       │  Redis   │              │  MySQL   │
       │  集群    │              │  集群    │
       └──────────┘              └─────┬────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    ┌─────────┐  ┌─────────┐  ┌─────────┐
                    │ Master  │  │ Slave1  │  │ Slave2  │
                    │  (写)   │  │  (读)   │  │  (读)   │
                    └─────────┘  └─────────┘  └─────────┘
```

**代码示例**：
```javascript
// 读写分离连接池
const masterPool = mysql.createPool({
  host: 'master.db.example.com',
  user: 'root',
  password: 'password',
  database: '05_san_storm',
  connectionLimit: 10
});

const slavePool = mysql.createPool({
  host: 'slave.db.example.com',
  user: 'root',
  password: 'password',
  database: '05_san_storm',
  connectionLimit: 20
});

// 读写分离中间件
class DatabaseManager {
  // 写操作使用主库
  async write(sql, params) {
    return await masterPool.query(sql, params);
  }
  
  // 读操作使用从库
  async read(sql, params) {
    return await slavePool.query(sql, params);
  }
}

const db = new DatabaseManager();

// 使用示例
// 读操作
const [players] = await db.read('SELECT * FROM players WHERE player_id = ?', [playerId]);

// 写操作
await db.write('UPDATE players SET reputation = ? WHERE player_id = ?', [newReputation, playerId]);
```

---

### 实施时间表

| 阶段 | 时间 | 主要任务 | 里程碑 |
|------|------|---------|--------|
| 阶段1 | 第1-3周 | MySQL表结构、DAO层、核心API | MVP上线 |
| 阶段2 | 第4-5周 | Redis缓存、排行榜、会话管理 | 性能优化完成 |
| 阶段3 | 第6-8周 | 读写分离、分库分表、压力测试 | 支持大规模用户 |

### 成本估算

**阶段1（MVP）**：
- MySQL服务器：$20-50/月
- 总成本：$20-50/月

**阶段2（优化）**：
- MySQL服务器：$20-50/月
- Redis服务器：$10-30/月
- 总成本：$30-80/月

**阶段3（扩展）**：
- MySQL主库：$50-100/月
- MySQL从库×2：$40-80/月
- Redis集群：$30-60/月
- 总成本：$120-240/月

---

## 📚 相关文档

- [数值存储规范](./DATEBASE_SPECIFICATION.md) - 详细的数值存储规范
- [玩家数据结构](./PLAYER_DATA_STRUCTURE.md) - 完整的玩家数据结构
- [13-1-CITY_SYSTEM.md](../10-core-system/13-1-CITY_SYSTEM.md) - 城市与地图防守入口摘要
- [13-2-CITY_DEFENSE_SYSTEM.md](../10-core-system/13-2-CITY_DEFENSE_SYSTEM.md) - 城防与驻地编组 / 披挂上阵（与表字段对应）
- [15-GAME_TIME_SYSTEM.md](../10-core-system/15-GAME_TIME_SYSTEM.md) - 游戏历法（config_servers）
- [17-3-SIEGE_SYSTEM.md](../10-core-system/17-3-SIEGE_SYSTEM.md) - 攻城队列与战线锁
- [装备系统](../20-data-layer/25-EQUIPMENT_SYSTEM.md) - 装备卡和装备合成系统
- [物品系统](../20-data-layer/26-ITEM_SYSTEM.md) - 卡包系统和赛季继承规则
- [赛季结算系统](../10-core-system/19-SEASON_SETTLEMENT_SYSTEM.md) - 赛季结算流程

---

## 🔄 更新日志

- v1.4.4 (2026-03-29): §3.2.14 聊天行补充「未接入 Redis 以 MySQL 为准」；§3.2.16 `chats` 增加设计评审说明、势力频道表述与 UI「势力名」、Redis 分期；删除旧「州频道命名」硬编码列表；与 [18-3](../10-core-system/18-3-CHAT_SYSTEM.md) 对齐
- v1.4.3 (2026-03-29): §3.3.1 `config_servers` 增加游戏历法四字段（`game_time_*`）；与 [15-GAME_TIME_SYSTEM.md](../10-core-system/15-GAME_TIME_SYSTEM.md) 及迁移 `add-config-servers-game-time.sql` 对齐
- v1.4.2 (2026-03-29): §3.2.2 `players` 增加 `on_duty_city_id` 及披挂说明；§3.2.5 `player_garrison` 与实装对齐（`is_active` 语义、驻守卡须非上阵、与披挂解耦、移除冗余 UNIQUE 索引、迁移脚本引用）；修正驻守卡 `is_equipped` 错误描述；`getCityGarrisonStats` 示例与 `garrisonService` 一致（`slot_count`/`player_count` + 势力联结）；删除 UI 示例后误粘贴的 SQL 碎片；相关文档链接补充 13-1 / 13-2 / 17-3
- v1.4.1 (2026-03-29): 新增 §3.2.14「通信类数据保留对照表」；原 §3.2.14–§3.2.22 顺延为 §3.2.15–§3.2.23；`texts` 附件字段说明对齐银两/粮草等经济命名；补充系统发件人约定（占位 `player_id='sys1'`）；传书/聊天业务规则中的官职表述对齐 [12-POSITION_SYSTEM.md](../10-core-system/12-POSITION_SYSTEM.md) 的 `position_level`；§3.2.2 `players` 补充 `sys1` 种子脚本路径（`migrations/seed-system-player-sys1.js` / `.sql`）
- v1.3.0 (2026-03-27): player_events 表新增 `explore_quota_*` 和 `siege_quota_*` 字段（配额服务端存储）；cities 表新增 `npc_garrison`/`npc_garrison_alive`/`npc_max_rarity`/`status` 字段（NPC 守军 PVE 攻城）；wars 表更新为简化实装版（多势力击杀统计 `faction_kills` JSON）
- v1.2.0 (2026-03-13): 优化装备合成表设计，合并 `player_synthesis_records` 和 `player_synthesis_guarantee` 为单表 `player_synthesis`，使用JSON字段存储最近30条记录，简化架构，提升性能
- v1.1.0 (2026-03-09): 补充资源兑换机制、事件列表查询方法、城市驻地统计查询方法
- v1.0.0 (2026-03-07): 初始版本，整合MySQL+Redis架构设计、表结构、缓存策略、实施计划

---

**文档作者**: Kiro AI  
**创建日期**: 2026-03-07  
**文档版本**: v1.4.4  
**状态**: ✅ 已确定



---

## 9️⃣ 数据库维护操作

### 9.1 测试赛季数据合并

**场景说明**：

在测试阶段，用户可能参与了多个测试版本（如 `san_0_m2`, `san_0_m3`, `san_0_mvp`）。测试结束后，需要将这些测试记录合并为一个统一的标记 `san_0`，表示"参加过san_0测试"。

**操作目标**：

- 更新 `players` 表的 `participated_seasons` 字段
- 将所有 `san_0_xxx` 合并为 `san_0`
- 保留其他赛季记录（如 `san_1`, `san_2`）

**示例**：

```json
// 合并前
{
  "player_id": "0CEW",
  "participated_seasons": ["san_0_m2", "san_0_mvp", "san_1"]
}

// 合并后
{
  "player_id": "0CEW",
  "participated_seasons": ["san_0", "san_1"]
}
```

### 9.2 使用SQL脚本执行合并

**脚本位置**：`05-san-storm/docs/tools/database/merge-test-participation.sql`

**执行步骤**：

#### 步骤1：备份数据库（必须！）

```bash
# 备份整个数据库
mysqldump -u root -p 05_san_storm > backup_$(date +%Y%m%d_%H%M%S).sql

# 或只备份 players 表
mysqldump -u root -p 05_san_storm players > backup_players_$(date +%Y%m%d_%H%M%S).sql
```

#### 步骤2：执行合并脚本

**方法A：直接执行脚本文件**

```bash
# 在服务器上执行
cd /www/wwwroot/notee

# 运行脚本
mysql -u root -p 05_san_storm < 05-san-storm/docs/tools/database/merge-test-participation.sql

# 输入密码后，脚本会自动执行并显示结果
```

**方法B：交互式执行**

```bash
# 登录MySQL
mysql -u root -p 05_san_storm

# 在MySQL提示符下执行
mysql> source /www/wwwroot/notee/05-san-storm/docs/tools/database/merge-test-participation.sql

# 查看执行结果
```

#### 步骤3：验证结果

```sql
-- 检查合并后的数据
SELECT 
  player_id,
  character_name,
  participated_seasons
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0"')
LIMIT 10;

-- 确认没有残留的测试标记
SELECT COUNT(*) as remaining_test_marks
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"');
-- 应该返回 0
```

#### 步骤4：如果需要回滚

```sql
-- 从备份恢复
mysql -u root -p 05_san_storm < backup_players_20260308_120000.sql

-- 或使用脚本中的回滚代码
UPDATE players p
INNER JOIN players_backup_test b ON p.player_id = b.player_id
SET p.participated_seasons = b.participated_seasons;
```

### 9.3 使用Node.js脚本执行（可选）

**脚本位置**：`05-san-storm/docs/tools/database/run-merge-script.js`

**前置要求**：

```bash
# 确保已安装 mysql2 包
npm install mysql2
```

**执行方法**：

```bash
# 进入脚本目录
cd /www/wwwroot/notee/05-san-storm/docs/tools/database

# 设置环境变量并运行
DB_PASSWORD=your_password node run-merge-script.js

# 或者分步设置（Windows）
set DB_HOST=localhost
set DB_USER=root
set DB_PASSWORD=your_password
set DB_NAME=05_san_storm
node run-merge-script.js

# Linux/Mac
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=05_san_storm
node run-merge-script.js
```

**输出示例**：

```
📦 连接数据库...
   主机: localhost
   用户: root
   数据库: 05_san_storm
✅ 数据库连接成功

📄 读取SQL脚本...
✅ SQL脚本读取成功

🚀 开始执行脚本...
============================================================

📊 结果集 1:
┌─────────┬────────────┬──────────────────────────────┐
│ (index) │ player_id  │ participated_seasons         │
├─────────┼────────────┼──────────────────────────────┤
│    0    │ '0CEW'     │ ["san_0_m2", "san_0_mvp"]   │
│    1    │ '1ABC'     │ ["san_0_m3", "san_1"]       │
└─────────┴────────────┴──────────────────────────────┘

✅ 影响行数: 156

📊 结果集 2:
┌─────────┬────────────┬──────────────────────────────┐
│ (index) │ player_id  │ participated_seasons         │
├─────────┼────────────┼──────────────────────────────┤
│    0    │ '0CEW'     │ ["san_0", "san_1"]          │
│    1    │ '1ABC'     │ ["san_0", "san_1"]          │
└─────────┴────────────┴──────────────────────────────┘

============================================================
✅ 脚本执行完成！
🔌 数据库连接已关闭
```

### 9.4 注意事项

**⚠️ 重要提醒**：

1. **必须先备份**：任何数据库操作前都要先备份
2. **在测试环境验证**：如果有测试环境，先在测试环境执行
3. **选择低峰期执行**：避免在用户活跃时段执行
4. **使用事务**：脚本已包含事务，确保操作的原子性
5. **保留备份表**：脚本会创建 `players_backup_test` 表，执行成功后可以保留一段时间再删除

**执行时机建议**：

- ✅ 测试阶段完全结束后
- ✅ 确认不再需要区分测试子阶段
- ✅ 在服务器低峰期（如凌晨2-4点）
- ✅ 提前通知用户可能的短暂维护

**回滚准备**：

```bash
# 保留完整备份至少7天
backup_$(date +%Y%m%d_%H%M%S).sql

# 记录执行时间和影响的玩家数量
echo "执行时间: $(date)" >> merge_log.txt
echo "影响玩家数: $(mysql -u root -p -e 'SELECT COUNT(*) FROM players WHERE ...')" >> merge_log.txt
```

### 9.5 快速参考

```
┌─────────────────────────────────────────────────────────┐
│  测试赛季合并 - 快速参考                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 备份数据库                                           │
│     mysqldump -u root -p 05_san_storm > backup.sql     │
│                                                         │
│  2. 执行合并脚本                                         │
│     mysql -u root -p 05_san_storm < merge-test.sql     │
│                                                         │
│  3. 验证结果                                             │
│     SELECT * FROM players WHERE                         │
│     JSON_CONTAINS(participated_seasons, '"san_0"')      │
│                                                         │
│  4. 如需回滚                                             │
│     mysql -u root -p 05_san_storm < backup.sql         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 更新日志

- v1.1.0 (2026-03-08): 添加数据库维护操作章节，包含测试赛季合并指南
- v1.0.0 (2026-03-07): 初始版本，整合MySQL+Redis架构设计、表结构、缓存策略、实施计划

---

**文档作者**: Kiro AI  
**创建日期**: 2026-03-07  
**文档版本**: v1.1.0  
**状态**: ✅ 已确定


---

## 4️⃣ 临时表设计

### 4.1 临时表概述

**临时表说明**：
- 临时表存储短期的、流程性的数据
- 数据在流程完成后会被删除或清理
- 不需要长期保存，不参与赛季继承
- 主要用于优化用户体验和数据同步

**设计原则**：
- ✅ 数据存储在后端数据库，确保跨设备同步
- ✅ 流程完成后自动删除，避免数据冗余
- ✅ 支持断点续传，用户可以随时继续未完成的流程
- ✅ 定期清理过期数据，避免数据库膨胀

---

### 4.2 角色创建进度表 (temp_character_creation)

**表名**: `temp_character_creation`  
**说明**: 存储玩家角色创建流程的临时数据，包括剩余银两、随机历史记录、创建进度等。角色创建完成后自动删除。

```sql
CREATE TABLE temp_character_creation (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID（账号ID）',
  
  -- 创建流程进度
  current_step INT DEFAULT 1 COMMENT '当前步骤（1=势力选择, 2=角色名, 3=属性随机, 4=初始部队）',
  
  -- 步骤1：势力选择
  selected_faction_id VARCHAR(50) COMMENT '选择的势力ID',
  selected_faction_name VARCHAR(50) COMMENT '选择的势力名称',
  
  -- 步骤2：角色名
  character_name VARCHAR(50) COMMENT '角色名',
  
  -- 步骤3：属性随机
  remaining_silver INT DEFAULT 50 COMMENT '剩余银两（初始50两）',
  random_cost INT DEFAULT 10 COMMENT '每次随机成本（固定10两）',
  current_batch INT DEFAULT 1 COMMENT '当前查看的批次号',
  random_batches JSON COMMENT '所有随机批次的历史记录',
  selected_option_batch INT COMMENT '选中的方案所在批次',
  selected_option_index INT COMMENT '选中的方案在批次中的索引（0-2）',
  
  -- 步骤4：初始部队
  selected_troops JSON COMMENT '选择的初始部队（troop_id数组，最多2个）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  expires_at DATETIME COMMENT '过期时间（创建后7天）',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色创建进度表（临时数据）';
```

**字段说明**：

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `player_id` | VARCHAR(4) | 玩家ID（账号ID） | - |
| `current_step` | INT | 当前步骤（1-4） | 1 |
| `selected_faction_id` | VARCHAR(50) | 选择的势力ID | NULL |
| `selected_faction_name` | VARCHAR(50) | 选择的势力名称 | NULL |
| `character_name` | VARCHAR(50) | 角色名 | NULL |
| `remaining_silver` | INT | 剩余银两 | 50 |
| `random_cost` | INT | 每次随机成本 | 10 |
| `current_batch` | INT | 当前查看的批次号 | 1 |
| `random_batches` | JSON | 所有随机批次的历史记录 | NULL |
| `selected_option_batch` | INT | 选中的方案所在批次 | NULL |
| `selected_option_index` | INT | 选中的方案索引（0-2） | NULL |
| `selected_troops` | JSON | 选择的初始部队 | NULL |
| `expires_at` | DATETIME | 过期时间（创建后7天） | NULL |

**random_batches 数据格式**：

```javascript
[
  {
    "batch": 1,
    "timestamp": "2026-03-13T10:30:00.000Z",
    "cost": 0,  // 第一批免费
    "options": [
      {
        "attributes": {
          "courage": 91,
          "luck": 68,
          "command": 88,
          "combat": 95,
          "intelligence": 76,
          "politics": 65,
          "charm": 82
        },
        "attributesInt": {  // ×10存储版本
          "courage": 910,
          "luck": 680,
          "command": 880,
          "combat": 950,
          "intelligence": 760,
          "politics": 650,
          "charm": 820
        },
        "skills": {
          "skill_1": {
            "id": "skill_1_5001",
            "name": "破阵",
            "description": "攻击时额外造成20%伤害"
          },
          "skill_2": {
            "id": "skill_2_6001",
            "name": "坚守",
            "description": "受到攻击时减少15%伤害"
          }
        },
        "totalPoints": 565,  // 总属性点（×10）
        "type": "Military"  // 类型：Military/Strategist/Balanced
      },
      {
        "attributes": { /* 方案2 */ },
        "attributesInt": { /* 方案2 */ },
        "skills": { /* 方案2 */ },
        "totalPoints": 548,
        "type": "Balanced"
      },
      {
        "attributes": { /* 方案3 */ },
        "attributesInt": { /* 方案3 */ },
        "skills": { /* 方案3 */ },
        "totalPoints": 572,
        "type": "Strategist"
      }
    ]
  },
  {
    "batch": 2,
    "timestamp": "2026-03-13T10:31:00.000Z",
    "cost": 10,  // 花费10银两
    "options": [
      { /* 方案1 */ },
      { /* 方案2 */ },
      { /* 方案3 */ }
    ]
  },
  {
    "batch": 3,
    "timestamp": "2026-03-13T10:32:00.000Z",
    "cost": 10,
    "options": [
      { /* 方案1 */ },
      { /* 方案2 */ },
      { /* 方案3 */ }
    ]
  }
]
```

**selected_troops 数据格式**：

```javascript
[
  "san_1_troop_1001",  // 第一个部队ID
  "san_1_troop_1002"   // 第二个部队ID
]
```

**业务规则**：

1. **创建进度记录**：
   - 用户进入角色创建流程时，创建记录
   - 初始状态：`current_step = 1`, `remaining_silver = 50`
   - 设置过期时间：`expires_at = created_at + 7天`

2. **银两管理**：
   - 初始银两：50两
   - 第一批随机：免费（`cost = 0`）
   - 后续随机：每次10两（`cost = 10`）
   - 每次随机前检查：`remaining_silver >= random_cost`
   - 随机成功后扣除：`remaining_silver -= random_cost`

3. **批次管理**：
   - 第一批自动生成（免费）
   - 点击"重新随机"生成新批次
   - 所有批次保存在 `random_batches` 数组中
   - 用户可以通过"上一批"/"下一批"按钮切换查看
   - `current_batch` 记录当前查看的批次号

4. **方案选择**：
   - 用户从任意批次选择一个方案
   - 记录选中的批次号和索引：`selected_option_batch`, `selected_option_index`
   - 进入下一步时，从 `random_batches` 中提取选中的方案

5. **数据同步**：
   - 每次状态变化时更新数据库
   - 支持跨设备/浏览器同步
   - 用户可以随时继续未完成的流程

6. **数据清理**：
   - 角色创建完成后，立即删除记录
   - 定时任务：每天清理过期记录（超过7天）
   - 用户删除账号时，自动删除记录（CASCADE）

**API设计**：

```javascript
// 1. 获取创建进度
GET /api/character-creation/progress/:playerId
Response: {
  success: true,
  data: {
    player_id: "0XAE",
    current_step: 3,
    selected_faction_id: "san_1_faction_1001",
    selected_faction_name: "刘备",
    character_name: "张三",
    remaining_silver: 30,
    random_cost: 10,
    current_batch: 2,
    random_batches: [ /* 批次数组 */ ],
    selected_option_batch: null,
    selected_option_index: null
  }
}

// 2. 保存创建进度
POST /api/character-creation/progress
Body: {
  player_id: "0XAE",
  current_step: 2,
  selected_faction_id: "san_1_faction_1001",
  selected_faction_name: "刘备",
  character_name: "张三"
}
Response: {
  success: true,
  message: "进度已保存"
}

// 3. 生成属性方案（新批次）
POST /api/character-creation/generate-attributes
Body: {
  player_id: "0XAE",
  rarity: "common"
}
Response: {
  success: true,
  data: {
    batch: 3,
    timestamp: "2026-03-13T10:32:00.000Z",
    cost: 10,
    options: [ /* 3个方案 */ ],
    remaining_silver: 30  // 扣除后的剩余银两
  }
}

// 4. 选择属性方案
POST /api/character-creation/select-option
Body: {
  player_id: "0XAE",
  batch: 2,
  index: 1
}
Response: {
  success: true,
  message: "方案已选择"
}

// 5. 完成角色创建（删除临时数据）
POST /api/character-creation/complete
Body: {
  player_id: "0XAE",
  character_name: "张三",
  faction_id: "san_1_faction_1001",
  faction_name: "刘备",
  attributes: { /* 选中的属性 */ },
  initial_troops: ["san_1_troop_1001", "san_1_troop_1002"],
  initial_silver: 30  // 剩余银两带入游戏
}
Response: {
  success: true,
  message: "角色创建成功",
  data: { /* 玩家数据 */ }
}
```

**前端实现要点**：

1. **页面加载时**：
   - 调用 `GET /api/character-creation/progress/:playerId`
   - 如果有进度，恢复到对应步骤
   - 如果没有进度，创建新记录（`current_step = 1`）

2. **每次状态变化时**：
   - 调用 `POST /api/character-creation/progress` 保存进度
   - 不再使用 localStorage

3. **属性随机步骤**：
   - 显示当前批次的3个方案
   - 显示"上一批"/"下一批"按钮（如果有多个批次）
   - 显示当前批次号："第2批/共3批"
   - 点击"重新随机"调用 `POST /api/character-creation/generate-attributes`
   - 检查银两是否足够，不足则禁用按钮

4. **批次切换**：
   - 点击"上一批"：`current_batch -= 1`
   - 点击"下一批"：`current_batch += 1`
   - 更新 UI 显示对应批次的方案
   - 保存 `current_batch` 到数据库

5. **方案选择**：
   - 用户点击某个方案
   - 调用 `POST /api/character-creation/select-option`
   - 记录 `selected_option_batch` 和 `selected_option_index`

6. **完成创建**：
   - 调用 `POST /api/character-creation/complete`
   - 后端创建角色，删除临时数据
   - 前端跳转到游戏主页

**定时清理任务**：

```javascript
// 定时任务：每天凌晨3点清理过期记录
const cron = require('node-cron');

cron.schedule('0 3 * * *', async () => {
  const result = await mysql.query(`
    DELETE FROM temp_character_creation
    WHERE expires_at < NOW()
  `);
  
  console.log(`清理了 ${result.affectedRows} 条过期的角色创建记录`);
});
```

**数据量估算**：

假设：
- 每天 1,000 个新用户
- 平均每人随机 3 次（3批）
- 每条记录约 5KB（包含3批×3方案的数据）

**存储需求**：
- 每天新增：1,000 × 5KB = 5MB
- 7天内：5MB × 7 = 35MB
- 完成创建后删除，实际存储更少

**结论**：
- ✅ 数据量极小，完全可控
- ✅ 支持跨设备同步
- ✅ 支持断点续传
- ✅ 自动清理过期数据

---

**文档作者**: Kiro AI  
**创建日期**: 2026-03-13  
**文档版本**: v1.2.0  
**更新内容**: 添加临时表设计（角色创建进度表）

---

### 4.3 活动排名快照表 (temp_ranking_snapshots)

**表名**: `temp_ranking_snapshots`  
**说明**: 存储活动排名的玩家数据快照。活动开始时为每个玩家记录当前 statistics 值，排名 = 当前值 - 快照值（即只计算活动期间的增量）。活动结束后保留14天供玩家查看最终排名，14天后由定时任务自动清理。

```sql
CREATE TABLE temp_ranking_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(30) NOT NULL COMMENT '活动ID（对应公告ID，如 san_1_info_0002）',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  
  -- 四项积分的快照值（活动开始时的累计值）
  snapshot_battle_score BIGINT DEFAULT 0 COMMENT '快照：战后评分累计',
  snapshot_events_completed INT DEFAULT 0 COMMENT '快照：已完成事件总数',
  snapshot_reputation BIGINT DEFAULT 0 COMMENT '快照：声望获得累计',
  snapshot_contribution BIGINT DEFAULT 0 COMMENT '快照：贡献获得累计',
  snapshot_silver BIGINT DEFAULT 0 COMMENT '快照：银两获得累计',
  snapshot_food BIGINT DEFAULT 0 COMMENT '快照：粮草获得累计',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '快照创建时间',
  expires_at DATETIME COMMENT '过期时间（活动结束后14天）',
  
  UNIQUE KEY uk_event_player (event_id, player_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_event (event_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动排名快照表（临时数据）';
```

**字段说明**：

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| `event_id` | VARCHAR(30) | 活动ID | 对应公告配置中的 `id` 字段 |
| `player_id` | VARCHAR(4) | 玩家ID | 活动开始时自动为所有在线玩家创建快照 |
| `snapshot_battle_score` | BIGINT | 战后评分快照 | 活动开始时 `statistics.total_battle_score` 的值 |
| `snapshot_events_completed` | INT | 事件完成数快照 | 活动开始时 `statistics.total_events_completed` 的值 |
| `snapshot_reputation` | BIGINT | 声望快照 | 活动开始时 `statistics.total_reputation_earned` 的值 |
| `snapshot_contribution` | BIGINT | 贡献快照 | 活动开始时 `statistics.total_contribution_earned` 的值 |
| `snapshot_silver` | BIGINT | 银两快照 | 活动开始时 `statistics.total_gold_earned` 的值 |
| `snapshot_food` | BIGINT | 粮草快照 | 活动开始时 `statistics.total_food_earned` 的值 |
| `expires_at` | DATETIME | 过期时间 | 活动结束后保留14天，供玩家查看最终排名 |

**排名计算公式**：

```javascript
// 活动期间增量 = 当前 statistics 值 - 快照值
const delta = {
  battleScore: stats.total_battle_score - snapshot.snapshot_battle_score,
  eventsCompleted: stats.total_events_completed - snapshot.snapshot_events_completed,
  reputation: stats.total_reputation_earned - snapshot.snapshot_reputation,
  contribution: stats.total_contribution_earned - snapshot.snapshot_contribution,
  silver: stats.total_gold_earned - snapshot.snapshot_silver,
  food: stats.total_food_earned - snapshot.snapshot_food,
};

// 四项积分（含权重）
const scores = {
  combat: delta.battleScore * 1,                                    // 权重 ×1
  events: delta.eventsCompleted * 300,                              // 权重 ×300
  repContrib: (delta.reputation + delta.contribution) * 30,         // 权重 ×30
  silverFood: (delta.silver + delta.food) * 3,                     // 权重 ×3
};

// 总分
const totalScore = scores.combat + scores.events + scores.repContrib + scores.silverFood;

// 同分排序：战后评分 > 事件数 > 声望贡献 > 银两粮草
// ORDER BY totalScore DESC, scores.combat DESC, scores.events DESC, scores.repContrib DESC, scores.silverFood DESC
```

**快照创建时机**：

```javascript
// 1. 活动开始时，为所有已注册玩家创建快照
async function createRankingSnapshots(eventId, expiresAt) {
  await mysql.query(`
    INSERT INTO temp_ranking_snapshots 
      (event_id, player_id, 
       snapshot_battle_score, snapshot_events_completed,
       snapshot_reputation, snapshot_contribution,
       snapshot_silver, snapshot_food, expires_at)
    SELECT 
      ?, s.player_id,
      s.total_battle_score, s.total_events_completed,
      s.total_reputation_earned, s.total_contribution_earned,
      s.total_gold_earned, s.total_food_earned, ?
    FROM statistics s
  `, [eventId, expiresAt]);
}

// 2. 活动期间新注册的玩家，首次登录时补建快照（增量从0开始）
async function createSnapshotForNewPlayer(eventId, playerId, expiresAt) {
  await mysql.query(`
    INSERT IGNORE INTO temp_ranking_snapshots 
      (event_id, player_id, 
       snapshot_battle_score, snapshot_events_completed,
       snapshot_reputation, snapshot_contribution,
       snapshot_silver, snapshot_food, expires_at)
    SELECT 
      ?, ?,
      s.total_battle_score, s.total_events_completed,
      s.total_reputation_earned, s.total_contribution_earned,
      s.total_gold_earned, s.total_food_earned, ?
    FROM statistics s WHERE s.player_id = ?
  `, [eventId, playerId, expiresAt, playerId]);
}
```

**定时清理任务**：

```javascript
// 定时任务：每天凌晨3点清理过期快照
cron.schedule('0 3 * * *', async () => {
  const result = await mysql.query(`
    DELETE FROM temp_ranking_snapshots
    WHERE expires_at < NOW()
  `);
  console.log(`清理了 ${result.affectedRows} 条过期的排名快照记录`);
});
```

**数据量估算**：

假设：
- 同时进行 1-2 个活动
- 每个活动 500 个玩家参与
- 每条记录约 200 字节

**存储需求**：
- 每个活动：500 × 200B = 100KB
- 2个活动：200KB
- 活动结束后保留7天，实际存储 < 1MB

**结论**：
- ✅ 数据量极小，完全可控
- ✅ 支持多活动并行
- ✅ 自动清理过期数据
- ✅ 新玩家自动补建快照

---

### 4.4 卡池抽取记录表 (temp_card_pool_draws)

**表名**: `temp_card_pool_draws`  
**说明**: 存储玩家的卡池抽取记录，用于每日次数限制、每日稀有度上限检查和保底计数。数据保留14天后自动清理。当前为临时模拟方案（模拟满发展度3000），未来迁移到正式势力抽卡系统时，只需将固定概率改为从城市发展度动态计算即可。

**设计理念**：
- 🎴 **双卡池独立** - 部队卡池和将领卡池各自独立（次数、保底、上限互不影响）
- 🎯 **保底机制** - 50抽内必出一张legendary，保底计数作为字段存储在玩家维度
- 🛡️ **防欧皇** - 每日legendary上限1张、epic上限2张
- 🔄 **14天过期** - 定时清理过期数据，避免数据库膨胀

```sql
CREATE TABLE temp_card_pool_draws (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  pool_type ENUM('troop', 'character') NOT NULL COMMENT '卡池类型（troop=部队卡池, character=将领卡池）',
  
  -- 抽取结果
  rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL COMMENT '抽到的稀有度',
  card_id VARCHAR(50) NULL COMMENT '抽到的卡牌配置ID（补偿时也记录原始卡牌ID）',
  compensated BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否转为补偿（TRUE=重复将领/部队超限，未实际获得卡牌）',
  
  -- 保底计数（每行记录当前累计值，查询时取最新一条即可）
  pity_count INT NOT NULL DEFAULT 0 COMMENT '本次抽取后的保底计数（获得legendary时重置为0）',
  
  -- 时间
  drawn_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽取时间',
  expires_at DATETIME NOT NULL COMMENT '过期时间（drawn_at + 14天）',
  
  INDEX idx_player_pool_date (player_id, pool_type, drawn_at),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡池抽取记录表（临时数据，14天过期）';
```

**字段说明**：

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| `player_id` | VARCHAR(4) | 玩家ID | 关联 players 表 |
| `pool_type` | ENUM | 卡池类型 | troop=部队卡池, character=将领卡池 |
| `rarity` | ENUM | 抽到的稀有度 | 不含core（core不进入抽卡池） |
| `card_id` | VARCHAR(50) | 卡牌配置ID | 补偿时也记录，便于追溯 |
| `compensated` | BOOLEAN | 是否转为补偿 | TRUE=重复将领给银两/部队超限给粮草 |
| `pity_count` | INT | 保底计数 | 每次抽取后的累计值，legendary时重置为0 |
| `drawn_at` | DATETIME | 抽取时间 | 用于每日次数和稀有度上限统计 |
| `expires_at` | DATETIME | 过期时间 | drawn_at + 14天，定时清理 |

**卡池配置常量**：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 单抽价格 | 40银两 | 两个池子相同 |
| 每日抽取次数 | 5次/池 | 部队池5次、将领池5次，各自独立 |
| 部队池每次出卡 | 2张 | 每次抽取同时获得2张部队卡 |
| 将领池每次出卡 | 1张 | 每次抽取获得1张将领卡 |
| 保底阈值 | 50抽 | 50抽内必出legendary，两个池子各自独立 |
| 每日legendary上限 | 1张/池 | 超限降级为epic |
| 每日epic上限 | 2张/池 | 超限降级为rare |

**概率分布（模拟满发展度3000）**：

| 稀有度 | 概率 | 颜色 | 说明 |
|--------|------|------|------|
| legendary | 5% | 🟠 橙 | 传奇卡 |
| epic | 10% | 💜 紫 | 史诗卡 |
| rare | 30% | 💙 蓝 | 稀有卡 |
| common | 55% | ⚪ 白 | 普通卡 |

**卡池范围**：
- 从玩家所属势力 + 通用势力（编号0）的卡牌中随机
- 部队卡：`config_troops` 表中 `troop_id LIKE 'san_1_troop_{势力编号}%' OR 'san_1_troop_0%'`
- 将领卡：`config_characters` 表中 `character_id LIKE 'san_1_char_{势力编号}%' OR 'san_1_char_0%'`

**补偿规则**：

| 场景 | 补偿类型 | 补偿金额 |
|------|---------|---------|
| 将领卡重复（已持有同ID） | 银两 | common:20, rare:40, epic:60, legendary:80 |
| 部队卡超限（同稀有度≥20张） | 粮草 | common:100, rare:200, epic:300, legendary:400 |

**保底计数逻辑**：

```javascript
// 保底计数存储在每条抽取记录的 pity_count 字段中
// 查询时取该玩家该池子最新一条记录的 pity_count 即可

// 抽取时：
// 1. 查询当前 pity_count（最新记录）
// 2. 如果 pity_count >= 49（即第50抽），强制出 legendary
// 3. 抽到 legendary → 新记录 pity_count = 0
// 4. 未抽到 legendary → 新记录 pity_count = 上一次 + 本次出卡数

// 部队池每次出2张，pity_count 按实际卡牌数累加
// 将领池每次出1张，pity_count 每次+1
```

**每日次数和稀有度统计查询**：

```sql
-- 今日抽取次数（按pool_type分组，每条记录=一次抽取操作）
-- 注意：部队池一次操作产生2条记录（2张卡），需要按drawn_at秒级去重
SELECT pool_type, COUNT(DISTINCT DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s')) AS draw_count
FROM temp_card_pool_draws
WHERE player_id = ? AND DATE(drawn_at) = CURDATE()
GROUP BY pool_type;

-- 今日各稀有度获取数量（仅统计实际获得的，不含补偿）
SELECT pool_type, rarity, COUNT(*) AS cnt
FROM temp_card_pool_draws
WHERE player_id = ? AND DATE(drawn_at) = CURDATE() AND compensated = FALSE
GROUP BY pool_type, rarity;
```

**定时清理任务**：

```javascript
// 定时任务：每天凌晨3点清理过期记录
cron.schedule('0 3 * * *', async () => {
  const result = await mysql.query(`
    DELETE FROM temp_card_pool_draws
    WHERE expires_at < NOW()
  `);
  console.log(`清理了 ${result.affectedRows} 条过期的卡池抽取记录`);
});
```

**数据量估算**：

假设：
- 500个活跃玩家
- 每人每天抽满两个池子：部队5次×2张 + 将领5次×1张 = 15条记录/天
- 每条记录约 150 字节

**存储需求**：
- 每天新增：500 × 15 × 150B = 1.1MB
- 14天内：1.1MB × 14 = 15.4MB
- 过期自动清理，实际存储 ≤ 16MB

**结论**：
- ✅ 单表设计，保底计数内嵌在记录中，无需额外表
- ✅ 数据量极小，完全可控
- ✅ 14天自动清理，避免膨胀
- ✅ 未来迁移只需修改概率计算逻辑（固定值→城市发展度动态计算）
