-- ==========================================
-- 真三风云 - 完整数据库表结构
-- ==========================================
-- 版本: v1.5
-- 创建日期: 2026-03-09
-- 最后更新: 2026-03-10
-- 说明: 包含所有核心表（19张）和配置表（10张）
-- 更新: 添加军团表（legions）和军团成员表（legion_members）
-- ==========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS 05_san_storm 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE 05_san_storm;

-- ==========================================
-- 核心表（17张）
-- ==========================================

-- ==========================================
-- 账号表 (accounts)
-- ==========================================
CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(4) PRIMARY KEY COMMENT '用户ID（4位随机字符，36进制；AI玩家格式：A+3位字符）',
  password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密存储）',
  birthMonth TINYINT NOT NULL COMMENT '生日月份（1-12，用于生日礼物）',
  
  serverId VARCHAR(20) NOT NULL COMMENT '服务器ID',
  
  account_type ENUM('real', 'ai') NOT NULL DEFAULT 'real' COMMENT '账号类型（real=真人玩家，ai=AI玩家）',
  
  current_season VARCHAR(50) COMMENT '当前所在赛季（如san_1=黄巾之乱、san_2=董卓之乱）',
  participated_seasons JSON COMMENT '参与过的赛季列表（如["san_0_m2","san_0_m3","san_1","san_2"]）',
  
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
  
  UNIQUE INDEX idx_machine_id (machineId),
  UNIQUE INDEX idx_client_ip (clientIP),
  INDEX idx_server_id (serverId),
  INDEX idx_status (status),
  INDEX idx_birth_month (birthMonth),
  INDEX idx_last_active (lastActiveAt),
  INDEX idx_current_season (current_season),
  INDEX idx_account_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号表';

-- ==========================================
-- 玩家角色表 (players)
-- ==========================================
CREATE TABLE IF NOT EXISTS players (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家角色ID（等同于账号ID）',
  character_name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名',
  
  faction_id VARCHAR(50) NOT NULL COMMENT '势力ID',
  faction_name VARCHAR(50) NOT NULL COMMENT '势力名称',
  
  avatar VARCHAR(255) COMMENT '头像URL',
  
  reputation INT DEFAULT 0 COMMENT '当前声望值（累计，只增不减）',
  reputation_to_next INT DEFAULT 10 COMMENT '下一级官职所需声望',
  
  contribution INT DEFAULT 0 COMMENT '当前贡献值（可用于兑换稀有奖励）',
  
  silver INT DEFAULT 500 COMMENT '银两',
  food INT DEFAULT 1000 COMMENT '粮草',
  
  combat INT NOT NULL COMMENT '武力×10',
  intelligence INT NOT NULL COMMENT '智力×10',
  command INT NOT NULL COMMENT '统率×10',
  politics INT NOT NULL COMMENT '政治×10',
  charm INT NOT NULL COMMENT '魅力×10',
  courage INT NOT NULL COMMENT '勇气×10',
  luck INT NOT NULL COMMENT '运气×10',
  
  skill_1 VARCHAR(50) COMMENT '技能1',
  skill_2 VARCHAR(50) COMMENT '技能2',
  
  troop_affinity VARCHAR(50) COMMENT '兵种亲和（如：infantry:5）',
  trait VARCHAR(50) COMMENT '性格特质类型（brave/reckless/calm/normal/cautious/timid）',
  trait_modifier INT COMMENT '性格特质对应的士气修正值（-5到+8，用于战斗计算）',
  
  base_combat INT NOT NULL COMMENT '基础武力×10',
  base_intelligence INT NOT NULL COMMENT '基础智力×10',
  base_command INT NOT NULL COMMENT '基础统率×10',
  base_politics INT NOT NULL COMMENT '基础政治×10',
  base_charm INT NOT NULL COMMENT '基础魅力×10',
  base_courage INT NOT NULL COMMENT '基础勇气×10',
  base_luck INT NOT NULL COMMENT '基础运气×10',
  
  current_position_id VARCHAR(50) COMMENT '当前官职ID',
  current_position_name VARCHAR(50) COMMENT '当前官职名称',
  position_level INT DEFAULT 1 COMMENT '官职等级',
  
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

-- ==========================================
-- 玩家卡牌表 (player_cards)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_cards (
  instance_id VARCHAR(50) PRIMARY KEY COMMENT '卡牌实例ID',
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  
  card_type ENUM('troop', 'character', 'equipment', 'title', 'achievement', 'treasure') NOT NULL COMMENT '卡牌类型',
  card_id VARCHAR(50) NOT NULL COMMENT '卡牌配置ID（关联配置表）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  -- 部队卡专用字段（仅动态数据）
  current_troops INT COMMENT '当前兵力（战斗中会损失，可通过粮草恢复）',
  battle_count INT DEFAULT 0 COMMENT '已使用次数（每次战斗+1）',
  max_battle_count INT COMMENT '最大使用次数（根据稀有度：common=10, rare=15, epic=20, legendary=25, core=30）',
  
  -- 装备卡专用字段
  equipment_set_id VARCHAR(50) COMMENT '装备套装ID',
  equipment_data JSON COMMENT '装备套装数据（武器、防具、辅助×2）',
  
  -- 装备状态（所有卡牌通用）
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

-- ==========================================
-- 玩家装备槽表 (player_equipment_slots)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_equipment_slots (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 玩家装备槽（6个）
  player_position VARCHAR(50) COMMENT '玩家官职槽（固定槽位，自动装备，无法手动卸除）',
  player_equipment_card VARCHAR(50) COMMENT '玩家装备卡槽（包含武器×1、防具×1、辅助×2）',
  player_title VARCHAR(50) COMMENT '玩家称号槽',
  player_achievement VARCHAR(50) COMMENT '玩家成就槽',
  player_treasure VARCHAR(50) COMMENT '玩家宝物槽',
  player_troop VARCHAR(50) COMMENT '玩家部队槽',
  
  -- 将领1装备槽（6个）
  char1_card VARCHAR(50) COMMENT '将领1卡牌实例ID',
  char1_equipment_card VARCHAR(50) COMMENT '将领1装备卡槽（包含武器×1、防具×1、辅助×2）',
  char1_title VARCHAR(50) COMMENT '将领1称号槽',
  char1_achievement VARCHAR(50) COMMENT '将领1成就槽',
  char1_treasure VARCHAR(50) COMMENT '将领1宝物槽',
  char1_troop1 VARCHAR(50) COMMENT '将领1部队槽1',
  char1_troop2 VARCHAR(50) COMMENT '将领1部队槽2',
  
  -- 将领2装备槽（6个）
  char2_card VARCHAR(50) COMMENT '将领2卡牌实例ID',
  char2_equipment_card VARCHAR(50) COMMENT '将领2装备卡槽（包含武器×1、防具×1、辅助×2）',
  char2_title VARCHAR(50) COMMENT '将领2称号槽',
  char2_achievement VARCHAR(50) COMMENT '将领2成就槽',
  char2_treasure VARCHAR(50) COMMENT '将领2宝物槽',
  char2_troop1 VARCHAR(50) COMMENT '将领2部队槽1',
  char2_troop2 VARCHAR(50) COMMENT '将领2部队槽2',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家装备槽表（上阵阵容）';

-- ==========================================
-- 玩家驻守配置表 (player_garrison_slots)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_garrison_slots (
  player_id VARCHAR(4) NOT NULL COMMENT '玩家ID',
  garrison_slot INT NOT NULL COMMENT '驻守槽位编号（1-12）',
  
  city_id VARCHAR(50) COMMENT '驻守城市ID（如：nanyang）',
  city_name VARCHAR(50) COMMENT '驻守城市名称（如：南阳城）',
  
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
  
  is_active BOOLEAN DEFAULT FALSE COMMENT '是否已激活（是否有将领驻守）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (player_id, garrison_slot),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  UNIQUE INDEX idx_player_slot (player_id, garrison_slot),
  INDEX idx_city (city_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家驻守配置表';

-- ==========================================
-- 玩家进度表 (player_progress)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_progress (
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

-- ==========================================
-- 玩家事件进度表 (player_events)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_events (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  
  -- 事件系统（5种事件类型）
  historical_events JSON COMMENT '历史事件进度（类型1：基于真实历史的事件）',
  fictional_events JSON COMMENT '虚构事件进度（类型2：原创剧情事件）',
  daily_events JSON COMMENT '日常事件进度（类型3：每日任务和随机遭遇）',
  weekly_events JSON COMMENT '周常事件进度（类型4：每周挑战和任务）',
  mini_events JSON COMMENT '迷你游戏进度（类型5：小游戏类事件）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家事件进度表（动态内容）';

-- ==========================================
-- AI玩家配置表 (ai_players)
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_players (
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

-- ==========================================
-- 势力运行时数据表 (factions)
-- ==========================================
CREATE TABLE IF NOT EXISTS factions (
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

-- ==========================================
-- 军团表 (legions)
-- ==========================================
CREATE TABLE IF NOT EXISTS legions (
  legion_id VARCHAR(50) PRIMARY KEY COMMENT '军团ID（如：san_1_legion_1001，第一位数字代表势力）',
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

-- ==========================================
-- 军团成员表 (legion_members)
-- ==========================================
CREATE TABLE IF NOT EXISTS legion_members (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '成员记录ID',
  legion_id VARCHAR(50) NOT NULL COMMENT '军团ID',
  player_id VARCHAR(4) COMMENT '玩家ID（玩家被清除后为NULL，显示"未知玩家"）',
  
  -- 成员角色
  role ENUM('commander', 'member') DEFAULT 'member' COMMENT '角色（长官/成员）',
  
  -- 时间戳
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  
  UNIQUE INDEX idx_legion_player (legion_id, player_id),
  FOREIGN KEY (legion_id) REFERENCES legions(legion_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  INDEX idx_player (player_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='军团成员表';

-- ==========================================
-- 城市数据表 (cities)
-- ==========================================
CREATE TABLE IF NOT EXISTS cities (
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
  
  -- 五大属性（仅大城/中城/小城有，关隘/要塞为NULL）
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
  governor_player_id VARCHAR(4) COMMENT '长官玩家ID',
  governor_appointed_at DATETIME COMMENT '长官任命时间',
  
  -- 防御属性
  defense INT DEFAULT 0 COMMENT '防御力',
  
  -- 建筑
  has_main_palace BOOLEAN DEFAULT FALSE COMMENT '是否有主殿（AI君主处所，仅大城）',
  has_three_ministers_palace BOOLEAN DEFAULT FALSE COMMENT '是否有三公府（仅大城）',
  has_side_palace BOOLEAN DEFAULT FALSE COMMENT '是否有偏殿（AI大司空处所，仅中城）',
  has_special_resource_building BOOLEAN DEFAULT FALSE COMMENT '是否有特色资源建筑（仅中城）',
  garrison_capacity INT DEFAULT 0 COMMENT '驻军所容量',
  
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

-- ==========================================
-- 统计数据表 (statistics)
-- ==========================================
CREATE TABLE IF NOT EXISTS statistics (
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

-- ==========================================
-- 赛季统计表 (season_records)
-- ==========================================
CREATE TABLE IF NOT EXISTS season_records (
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


-- ==========================================
-- 赛季继承表 (season_inheritances)
-- ==========================================
CREATE TABLE IF NOT EXISTS season_inheritances (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID',
  season_id VARCHAR(50) NOT NULL COMMENT '来源赛季ID（如：san_1=黄巾之乱, san_2=董卓之乱）',
  
  inherited_equipment_cards JSON COMMENT '继承的装备卡列表（递增式：第1赛季=1套, 第2赛季=2套, ..., 第10赛季+=10套）',
  inherited_troop_cards JSON COMMENT '继承的部队卡列表（橙×10+紫×10）',
  inherited_title_cards JSON COMMENT '继承的称号卡列表（全部）',
  inherited_achievement_cards JSON COMMENT '继承的成就卡列表（全部）',
  inherited_treasure_cards JSON COMMENT '继承的宝物卡列表（全部）',
  inherited_golden_troop_cards JSON COMMENT '继承的金色部队卡列表（全部）',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（赛季结算时）',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='赛季继承表（跨服务器，全局有效，每个玩家只有一条记录）';

-- ==========================================
-- 配置表 1: 服务器配置表 (config_servers)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_servers (
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (current_season),
  INDEX idx_status (status),
  INDEX idx_opened_at (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务器配置表';

-- ==========================================
-- 配置表 2: 势力配置表 (config_factions)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_factions (
  faction_id VARCHAR(50) PRIMARY KEY COMMENT '势力ID（如：san_1_faction_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从faction_id中提取）',
  faction_name VARCHAR(100) NOT NULL COMMENT '势力名称',
  faction_leader VARCHAR(50) COMMENT '势力君主ID（关联将领表）',
  
  icon VARCHAR(10) COMMENT '势力图标（emoji）',
  color VARCHAR(20) COMMENT '势力颜色（hex）',
  
  style VARCHAR(50) COMMENT '势力风格（机缘/霸业/挑战/猛攻/中庸/速攻等）',
  
  max_players INT NOT NULL DEFAULT 100 COMMENT '最大玩家数',
  
  faction_bonuses JSON COMMENT '势力加成列表',
  
  description TEXT COMMENT '势力描述',
  difficulty VARCHAR(20) COMMENT '难度（简单/中级/困难），简单=推荐',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力配置表';

-- ==========================================
-- 配置表 3: 将领配置表 (config_characters)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_characters (
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

-- ==========================================
-- 配置表 4: 部队配置表 (config_troops)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_troops (
  troop_id VARCHAR(50) PRIMARY KEY COMMENT '部队ID（如：san_1_troop_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从troop_id中提取）',
  troop_name VARCHAR(100) NOT NULL COMMENT '部队名称',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  troop_type ENUM('infantry', 'cavalry', 'archer', 'special') NOT NULL COMMENT '兵种类型',
  
  max_troops INT NOT NULL COMMENT '最大兵力',
  `range` INT NOT NULL COMMENT '攻击距离',
  attack INT NOT NULL COMMENT '攻击力×10',
  defense INT NOT NULL COMMENT '防御力×10',
  speed INT NOT NULL COMMENT '速度',
  movement INT NOT NULL COMMENT '移动力',
  
  special_ability JSON COMMENT '特殊能力（包含skills、counters、adaptation、effects）',
  description TEXT COMMENT '部队描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_rarity (rarity),
  INDEX idx_troop_type (troop_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部队配置表';

-- ==========================================
-- 配置表 5: 技能配置表 (config_skills)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_skills (
  skill_id VARCHAR(50) PRIMARY KEY COMMENT '技能ID（如：san_1_skill_1_5001，包含赛季前缀）',
  season VARCHAR(20) NOT NULL COMMENT '赛季标识（如：san_1）',
  skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
  skill_type ENUM('active', 'passive') NOT NULL COMMENT '技能类型（主动/被动）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  damage_type ENUM('physical', 'strategy', 'none') COMMENT '伤害类型（物理/策略/无）',
  character_type VARCHAR(100) COMMENT '适用将领类型（如：military;balanced）',
  troop_type VARCHAR(100) COMMENT '兵种类型限制（如：infantry;cavalry;archer，留空表示通用）',
  
  effect_type VARCHAR(50) COMMENT '效果类型',
  effect_value VARCHAR(100) COMMENT '效果数值',
  target_range VARCHAR(20) COMMENT '目标范围（1x1/1x2/1x3/2x2/3x3/4x4/cross/cross_thin/cross_large）',
  target_count VARCHAR(20) COMMENT '目标数量（all/1/2/3/random_1/random_2/random_3）',
  description TEXT COMMENT '技能描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_skill_type (skill_type),
  INDEX idx_rarity (rarity),
  INDEX idx_damage_type (damage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技能配置表（按赛季区分）';

-- ==========================================
-- 配置表 6: 羁绊配置表 (config_bonds)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_bonds (
  bond_id VARCHAR(50) PRIMARY KEY COMMENT '羁绊ID（如：bond_1_5001，不含赛季前缀）',
  bond_name VARCHAR(100) NOT NULL COMMENT '羁绊名称',
  bond_type ENUM('active', 'passive') NOT NULL COMMENT '羁绊类型（主动/被动）',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  min_characters INT NOT NULL DEFAULT 2 COMMENT '最少需要将领数',
  
  effect_type VARCHAR(50) COMMENT '效果类型',
  effect_value VARCHAR(100) COMMENT '效果数值',
  description TEXT COMMENT '羁绊描述',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_bond_type (bond_type),
  INDEX idx_rarity (rarity),
  INDEX idx_min_characters (min_characters)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='羁绊配置表（跨赛季通用）';

-- ==========================================
-- 配置表 7: 官职配置表 (config_positions)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_positions (
  position_id VARCHAR(50) PRIMARY KEY COMMENT '官职ID（如：san_1_pos_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从position_id中提取）',
  position_name VARCHAR(100) NOT NULL COMMENT '官职名称',
  position_level INT NOT NULL COMMENT '官职等级',
  position_rank INT NOT NULL COMMENT '官职排名（用于排序）',
  category VARCHAR(50) COMMENT '官职类别',
  
  icon VARCHAR(10) COMMENT '官职图标（emoji）',
  color VARCHAR(20) COMMENT '官职颜色（hex）',
  description TEXT COMMENT '官职描述',
  
  requirement INT NOT NULL COMMENT '所需声望',
  
  -- 加成属性（JSON存储，灵活扩展）
  position_bonuses JSON COMMENT '官职加成（如：{"resource": 0.5, "prestige": 0.5, "infantry": 0.15, "cavalry": 0, "archer": 0}）',
  
  permissions JSON COMMENT '权限列表',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_level (position_level),
  INDEX idx_rank (position_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='官职配置表';

-- ==========================================
-- 配置表 8: 装备配置表 (config_equipment)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_equipment (
  equipment_id VARCHAR(50) PRIMARY KEY COMMENT '装备ID（如：san_1_equip_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从equipment_id中提取）',
  equipment_name VARCHAR(100) NOT NULL COMMENT '装备名称',
  equipment_type ENUM('weapon', 'armor', 'accessory') NOT NULL COMMENT '装备类型',
  rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL COMMENT '稀有度',
  
  -- 属性加成（×10存储）
  luck_bonus INT DEFAULT 0 COMMENT '运气加成×10',
  courage_bonus INT DEFAULT 0 COMMENT '勇气加成×10',
  combat_bonus INT DEFAULT 0 COMMENT '武力加成×10',
  command_bonus INT DEFAULT 0 COMMENT '统帅加成×10',
  intelligence_bonus INT DEFAULT 0 COMMENT '智力加成×10',
  politics_bonus INT DEFAULT 0 COMMENT '政治加成×10',
  charm_bonus INT DEFAULT 0 COMMENT '魅力加成×10',
  
  special_effect JSON COMMENT '特殊效果',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_equipment_type (equipment_type),
  INDEX idx_rarity (rarity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装备配置表';


-- ==========================================
-- 配置表 9: 称号配置表 (config_titles)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_titles (
  title_id VARCHAR(50) PRIMARY KEY COMMENT '称号ID（如：san_1_title_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从title_id中提取）',
  title_name VARCHAR(100) NOT NULL COMMENT '称号名称',
  title_description TEXT COMMENT '称号描述',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  
  unlock_conditions JSON COMMENT '解锁条件（如：{"win_battles": 100, "reputation": 1000}）',
  
  attribute_bonus JSON COMMENT '属性加成（如：{"combat": 50, "command": 30}，表示武力+5.0，统率+3.0）',
  
  special_effects JSON COMMENT '特殊效果（如：{"resource_bonus": 10, "troop_morale": 5}）',
  
  icon_url VARCHAR(255) COMMENT '图标URL',
  display_order INT DEFAULT 0 COMMENT '显示顺序',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_rarity (rarity),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='称号配置表';

-- ==========================================
-- 配置表 10: 成就配置表 (config_achievements)
-- ==========================================
CREATE TABLE IF NOT EXISTS config_achievements (
  achievement_id VARCHAR(50) PRIMARY KEY COMMENT '成就ID（如：san_1_achv_1001）',
  season VARCHAR(20) NOT NULL COMMENT '赛季ID（如：san_1, san_2，从achievement_id中提取）',
  achievement_name VARCHAR(100) NOT NULL COMMENT '成就名称',
  achievement_description TEXT COMMENT '成就描述',
  rarity ENUM('common', 'rare', 'epic', 'legendary', 'core') NOT NULL COMMENT '稀有度',
  category VARCHAR(50) COMMENT '成就类别（战斗/经济/社交/探索等）',
  
  unlock_conditions JSON COMMENT '解锁条件（如：{"complete_tutorial": 1, "first_battle": 1}）',
  
  attribute_bonus JSON COMMENT '属性加成（如：{"combat": 30, "intelligence": 20}）',
  
  special_effects JSON COMMENT '特殊效果（如：{"exp_bonus": 10, "gold_bonus": 5}）',
  
  rewards JSON COMMENT '解锁奖励（如：{"silver": 1000, "food": 500}）',
  
  icon_url VARCHAR(255) COMMENT '图标URL',
  display_order INT DEFAULT 0 COMMENT '显示顺序',
  is_hidden BOOLEAN DEFAULT FALSE COMMENT '是否隐藏成就（解锁前不显示）',
  
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_season (season),
  INDEX idx_rarity (rarity),
  INDEX idx_category (category),
  INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成就配置表';

-- ==========================================
-- 纪念图表 (memorial_images)
-- ==========================================
CREATE TABLE IF NOT EXISTS memorial_images (
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


-- ==========================================
-- 战斗记录表 (battles)
-- ==========================================
CREATE TABLE IF NOT EXISTS battles (
  battle_id VARCHAR(50) PRIMARY KEY COMMENT '战斗ID',
  player_id VARCHAR(4) COMMENT '玩家ID（玩家被清除后为NULL，显示"未知玩家"）',
  war_id VARCHAR(50) COMMENT '战事ID（可选，NULL表示非战事战斗）',
  
  -- 战斗类型（精简分类）
  battle_type ENUM(
    'pvp_field',        -- 平原PVP
    'pvp_siege',        -- 攻城PVP
    'pvp_defense',      -- 守城PVP
    'pve_campaign',     -- 战役PVE
    'pve_event'         -- 事件PVE（所有非战役PVE：流寇、黄巾军、诸侯、教学等）
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
  
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE SET NULL,
  INDEX idx_player (player_id),
  INDEX idx_war_id (war_id),
  INDEX idx_battle_type (battle_type),
  INDEX idx_opponent_type (opponent_type),
  INDEX idx_result (result),
  INDEX idx_battle_at (battle_at),
  INDEX idx_favorited (is_favorited),
  INDEX idx_log_expires (log_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战斗记录表（单次战斗）';

-- ==========================================
-- 战事表 (wars)
-- ==========================================
CREATE TABLE IF NOT EXISTS wars (
  war_id VARCHAR(50) PRIMARY KEY COMMENT '战事ID（如：san_1_war_0001）',
  war_name VARCHAR(100) NOT NULL COMMENT '战事名称（如：南阳之战）',
  war_type ENUM('siege', 'defense', 'field') NOT NULL COMMENT '战事类型',
  
  -- 目标城市
  target_city_id VARCHAR(50) NOT NULL COMMENT '目标城市ID',
  target_city_name VARCHAR(50) NOT NULL COMMENT '目标城市名称',
  target_city_size ENUM('small', 'medium', 'large', 'capital') NOT NULL COMMENT '城市规模',
  
  -- 攻击方
  attacker_faction_id VARCHAR(50) NOT NULL COMMENT '攻击方势力ID',
  attacker_faction_name VARCHAR(50) NOT NULL COMMENT '攻击方势力名称',
  attacker_player_count INT DEFAULT 0 COMMENT '攻击方参战人数',
  attacker_total_battles INT DEFAULT 0 COMMENT '攻击方总战斗次数',
  attacker_wins INT DEFAULT 0 COMMENT '攻击方胜利次数',
  attacker_losses INT DEFAULT 0 COMMENT '攻击方失败次数',
  attacker_troops_killed INT DEFAULT 0 COMMENT '攻击方消灭敌军',
  attacker_troops_lost INT DEFAULT 0 COMMENT '攻击方损失',
  attacker_morale INT DEFAULT 100 COMMENT '攻击方士气（0-100）',
  attacker_camp_hp INT DEFAULT 1000 COMMENT '攻击方大本营HP',
  attacker_camp_max_hp INT DEFAULT 1000 COMMENT '攻击方大本营最大HP',
  
  -- 防守方
  defender_faction_id VARCHAR(50) NOT NULL COMMENT '防守方势力ID',
  defender_faction_name VARCHAR(50) NOT NULL COMMENT '防守方势力名称',
  defender_player_count INT DEFAULT 0 COMMENT '防守方参战人数',
  defender_total_battles INT DEFAULT 0 COMMENT '防守方总战斗次数',
  defender_wins INT DEFAULT 0 COMMENT '防守方胜利次数',
  defender_losses INT DEFAULT 0 COMMENT '防守方失败次数',
  defender_troops_killed INT DEFAULT 0 COMMENT '防守方消灭敌军',
  defender_troops_lost INT DEFAULT 0 COMMENT '防守方损失',
  defender_morale INT DEFAULT 100 COMMENT '防守方士气（0-100）',
  defender_city_hp INT DEFAULT 5000 COMMENT '防守方城池HP',
  defender_city_max_hp INT DEFAULT 5000 COMMENT '防守方城池最大HP',
  
  -- 战事状态
  status ENUM('pending', 'active', 'completed', 'failed') DEFAULT 'pending' COMMENT '战事状态',
  winner VARCHAR(50) COMMENT '胜利方（attacker/defender）',
  victory_condition VARCHAR(100) COMMENT '胜利条件类型',
  
  -- 时间
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  duration BIGINT DEFAULT 604800000 COMMENT '持续时间（毫秒，默认7天）',
  siege_duration BIGINT DEFAULT 0 COMMENT '围困时间（毫秒）',
  
  -- 胜利条件（JSON格式）
  victory_conditions JSON COMMENT '胜利条件配置',
  
  -- 主将单挑记录（JSON格式）
  duel_history JSON COMMENT '主将单挑历史记录',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  completed_at DATETIME COMMENT '完成时间',
  
  INDEX idx_attacker (attacker_faction_id),
  INDEX idx_defender (defender_faction_id),
  INDEX idx_target_city (target_city_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time),
  INDEX idx_war_type (war_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='战事表（势力对抗）';

-- ==========================================
-- 讨伐表 (raids)
-- ==========================================
CREATE TABLE IF NOT EXISTS raids (
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

-- ==========================================
-- 扩展 battles 表以支持讨伐系统
-- ==========================================
-- 添加 raid_id 字段（使用存储过程兼容低版本MySQL）
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'battles' AND COLUMN_NAME = 'raid_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE battles ADD COLUMN raid_id VARCHAR(50) COMMENT ''讨伐ID（可选，NULL表示非讨伐战斗）''', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'battles' AND INDEX_NAME = 'idx_raid_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE battles ADD INDEX idx_raid_id (raid_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 修改 battle_type 枚举，添加 pve_raid 类型
ALTER TABLE battles MODIFY COLUMN battle_type ENUM(
  'pvp_field',      -- 平原PVP
  'pvp_siege',      -- 攻城PVP
  'pvp_defense',    -- 守城PVP
  'pve_campaign',   -- 战役PVE
  'pve_event',      -- 事件PVE
  'pve_raid'        -- 讨伐PVE（新增）
) NOT NULL COMMENT '战斗类型';

-- ==========================================
-- 临时表: 角色创建进度表 (temp_character_creation)
-- ==========================================
CREATE TABLE IF NOT EXISTS temp_character_creation (
  player_id VARCHAR(4) PRIMARY KEY COMMENT '玩家ID（账号ID）',
  
  -- 创建进度
  current_step INT DEFAULT 1 COMMENT '当前步骤（1=势力, 2=形象, 3=名字, 4=属性, 5=部队）',
  
  -- 步骤1: 势力选择
  selected_faction_id VARCHAR(50) COMMENT '选择的势力ID',
  selected_faction_name VARCHAR(50) COMMENT '选择的势力名称',
  
  -- 步骤2: 形象选择
  selected_avatar VARCHAR(255) COMMENT '选择的头像路径',
  
  -- 步骤3: 角色名
  character_name VARCHAR(50) COMMENT '角色名',
  
  -- 步骤4: 属性随机
  remaining_silver INT DEFAULT 50 COMMENT '剩余银两（初始50）',
  random_cost INT DEFAULT 10 COMMENT '每次随机费用（固定10）',
  current_batch INT DEFAULT 1 COMMENT '当前查看的批次号',
  random_batches JSON COMMENT '所有随机批次历史',
  selected_option_batch INT COMMENT '选中方案的批次号',
  selected_option_index INT COMMENT '选中方案在批次中的索引（0-2）',
  
  -- 步骤5: 初始部队
  selected_troops JSON COMMENT '选择的初始部队（troop_id数组，最多2个）',
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  expires_at DATETIME COMMENT '过期时间（创建后7天）',
  
  FOREIGN KEY (player_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色创建进度表（临时数据，角色创建完成后删除）';
