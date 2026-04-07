-- MySQL dump 10.13  Distrib 5.7.43, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: 05_san_storm
-- ------------------------------------------------------
-- Server version	5.7.43-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accounts` (
  `id` varchar(4) NOT NULL COMMENT 'ç”¨æˆ·IDï¼ˆ4ä½éšæœºå­—ç¬¦ï¼Œ36è¿›åˆ¶ï¼›AIçŽ©å®¶æ ¼å¼ï¼šA+3ä½å­—ç¬¦ï¼‰',
  `password` varchar(255) NOT NULL COMMENT 'å¯†ç ï¼ˆbcryptåŠ å¯†å­˜å‚¨ï¼‰',
  `birthMonth` tinyint(4) NOT NULL COMMENT 'ç”Ÿæ—¥æœˆä»½ï¼ˆ1-12ï¼Œç”¨äºŽç”Ÿæ—¥ç¤¼ç‰©ï¼‰',
  `serverId` varchar(20) NOT NULL COMMENT 'æœåŠ¡å™¨ID',
  `account_type` enum('real','ai') NOT NULL DEFAULT 'real' COMMENT 'è´¦å·ç±»åž‹ï¼ˆreal=çœŸäººçŽ©å®¶ï¼Œai=AIçŽ©å®¶ï¼‰',
  `current_season` varchar(50) DEFAULT NULL COMMENT 'å½“å‰æ‰€åœ¨èµ›å­£ï¼ˆå¦‚san_1=é»„å·¾ä¹‹ä¹±ã€san_2=è‘£å“ä¹‹ä¹±ï¼‰',
  `participated_seasons` json DEFAULT NULL COMMENT 'å‚ä¸Žè¿‡çš„èµ›å­£åˆ—è¡¨ï¼ˆå¦‚["san_0_m2","san_0_m3","san_1","san_2"]ï¼‰',
  `hasPremium` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'å½“å‰èµ›å­£æ˜¯å¦è´­ä¹°æˆ˜ä»¤',
  `province` varchar(50) DEFAULT NULL COMMENT 'çœä»½ï¼ˆé€šè¿‡IPè‡ªåŠ¨æŽ¨æ–­ï¼‰',
  `city` varchar(50) DEFAULT NULL COMMENT 'åŸŽå¸‚ï¼ˆé€šè¿‡IPè‡ªåŠ¨æŽ¨æ–­ï¼‰',
  `clientIP` varchar(45) NOT NULL COMMENT 'IPåœ°å€ï¼ˆæ”¯æŒIPv6ï¼‰',
  `machineId` varchar(64) NOT NULL COMMENT 'æœºå™¨æŒ‡çº¹ï¼ˆé˜²é‡å¤æ³¨å†Œï¼‰',
  `status` enum('active','inactive','banned') NOT NULL DEFAULT 'active' COMMENT 'è´¦å·çŠ¶æ€',
  `banReason` text COMMENT 'å°ç¦åŽŸå› ï¼ˆä»…bannedæ—¶æœ‰å€¼ï¼‰',
  `banUntil` datetime DEFAULT NULL COMMENT 'å°ç¦åˆ°æœŸæ—¶é—´ï¼ˆä»…bannedæ—¶æœ‰å€¼ï¼‰',
  `registeredAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'æ³¨å†Œæ—¶é—´',
  `lastLoginAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'æœ€åŽç™»å½•æ—¶é—´',
  `lastActiveAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'æœ€åŽæ´»è·ƒæ—¶é—´',
  `loginCount` int(11) NOT NULL DEFAULT '0' COMMENT 'ç™»å½•æ¬¡æ•°',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_machine_id` (`machineId`),
  UNIQUE KEY `idx_client_ip` (`clientIP`),
  KEY `idx_server_id` (`serverId`),
  KEY `idx_status` (`status`),
  KEY `idx_birth_month` (`birthMonth`),
  KEY `idx_last_active` (`lastActiveAt`),
  KEY `idx_current_season` (`current_season`),
  KEY `idx_account_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='è´¦å·è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_players`
--

DROP TABLE IF EXISTS `ai_players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_players` (
  `player_id` varchar(4) NOT NULL COMMENT 'AIçŽ©å®¶IDï¼ˆå…³è”accounts.idï¼Œæ ¼å¼ï¼šA + 3ä½å­—ç¬¦ï¼‰',
  `ai_type` enum('active','elite') NOT NULL COMMENT 'AIç±»åž‹ï¼ˆactive=æ´»è·ƒåž‹70%ï¼Œelite=ç²¾è‹±åž‹30%ï¼‰',
  `event_participation_types` varchar(100) DEFAULT 'daily' COMMENT 'å‚ä¸Žäº‹ä»¶ç±»åž‹ï¼ˆactive=dailyä»…æ—¥å¸¸äº‹ä»¶ï¼Œelite=allæ‰€æœ‰äº‹ä»¶ï¼‰',
  `pvp_participation` varchar(20) DEFAULT 'defense_only' COMMENT 'PVPå‚ä¸Žï¼ˆactive=defense_onlyä»…é˜²å®ˆï¼Œelite=allå…¨éƒ¨ï¼‰',
  `chat_frequency` decimal(3,2) DEFAULT '0.35' COMMENT 'èŠå¤©é¢‘çŽ‡ï¼ˆæ¯20åˆ†é’Ÿ35%æ¦‚çŽ‡ï¼‰',
  `battle_strategy` enum('balanced','aggressive') DEFAULT 'balanced' COMMENT 'æˆ˜æ–—ç­–ç•¥ï¼ˆactive=balancedï¼Œelite=aggressiveï¼‰',
  `resource_strategy` enum('basic','optimal') DEFAULT 'basic' COMMENT 'èµ„æºç­–ç•¥ï¼ˆactive=basicï¼Œelite=optimalï¼‰',
  `total_logins` int(11) DEFAULT '0' COMMENT 'æ€»ç™»å½•æ¬¡æ•°ï¼ˆäº‹ä»¶è§¦å‘æ¬¡æ•°ï¼‰',
  `total_battles` int(11) DEFAULT '0' COMMENT 'æ€»æˆ˜æ–—æ¬¡æ•°',
  `total_chats` int(11) DEFAULT '0' COMMENT 'æ€»èŠå¤©æ¬¡æ•°',
  `total_events_completed` int(11) DEFAULT '0' COMMENT 'å®Œæˆäº‹ä»¶æ€»æ•°',
  `performance_score` decimal(10,2) DEFAULT '0.00' COMMENT 'è¡¨çŽ°è¯„åˆ†ï¼ˆå£°æœ›*0.3+è´¡çŒ®*0.3+èƒœçŽ‡*100*0.2+äº‹ä»¶æ•°*0.2ï¼‰',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'æ˜¯å¦æ¿€æ´»',
  `last_behavior_update` datetime DEFAULT NULL COMMENT 'æœ€åŽè¡Œä¸ºæ›´æ–°æ—¶é—´',
  `last_chat_time` datetime DEFAULT NULL COMMENT 'æœ€åŽèŠå¤©æ—¶é—´ï¼ˆç”¨äºŽèŠå¤©é¢‘çŽ‡æŽ§åˆ¶ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`),
  KEY `idx_ai_type` (`ai_type`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_performance_score` (`performance_score`),
  CONSTRAINT `ai_players_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AIçŽ©å®¶é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `battles`
--

DROP TABLE IF EXISTS `battles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `battles` (
  `battle_id` varchar(80) NOT NULL COMMENT 'ID',
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `war_id` varchar(50) DEFAULT NULL COMMENT 'æˆ˜äº‹IDï¼ˆå¯é€‰ï¼ŒNULLè¡¨ç¤ºéžæˆ˜äº‹æˆ˜æ–—ï¼‰',
  `battle_type` enum('pvp_field','pvp_siege','pvp_defense','pve_campaign','pve_event','pve_siege') NOT NULL,
  `opponent_type` enum('player','campaign_enemy','event_enemy') NOT NULL COMMENT 'å¯¹æ‰‹ç±»åž‹',
  `opponent_id` varchar(50) DEFAULT NULL COMMENT 'å¯¹æ‰‹IDï¼ˆçŽ©å®¶IDæˆ–AIé…ç½®IDï¼‰',
  `opponent_name` varchar(100) DEFAULT NULL COMMENT 'å¯¹æ‰‹åç§°ï¼ˆçŽ©å®¶åæˆ–AIåç§°ï¼‰',
  `result` enum('win','lose','draw') NOT NULL COMMENT 'æˆ˜æ–—ç»“æžœ',
  `player_team` json DEFAULT NULL COMMENT 'çŽ©å®¶é˜Ÿä¼é…ç½®ï¼ˆç®€åŒ–ç‰ˆï¼‰',
  `opponent_team` json DEFAULT NULL COMMENT 'å¯¹æ‰‹é˜Ÿä¼é…ç½®ï¼ˆç®€åŒ–ç‰ˆï¼‰',
  `battle_log` text COMMENT 'æˆ˜æ–—æ–‡å­—æè¿°ï¼ˆç®€ç•¥è®°å½•æ¯å›žåˆæ“ä½œï¼‰',
  `total_damage_dealt` int(11) DEFAULT NULL COMMENT 'é€ æˆä¼¤å®³',
  `total_damage_taken` int(11) DEFAULT NULL COMMENT 'å—åˆ°ä¼¤å®³',
  `total_kills` int(11) DEFAULT NULL COMMENT 'å‡»æ€æ•°',
  `duration` int(11) DEFAULT NULL COMMENT 'æˆ˜æ–—æ—¶é•¿ï¼ˆç§’ï¼‰',
  `rewards` json DEFAULT NULL COMMENT 'æˆ˜æ–—å¥–åŠ±',
  `is_favorited` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æ”¶è—ï¼ˆæ”¶è—åŽä¸ä¼šè¿‡æœŸï¼‰',
  `log_expires_at` datetime DEFAULT NULL COMMENT 'æ—¥å¿—è¿‡æœŸæ—¶é—´ï¼ˆ14å¤©åŽï¼Œæ”¶è—çš„æ—¥å¿—ä¸è¿‡æœŸï¼‰',
  `battle_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'æˆ˜æ–—æ—¶é—´',
  `raid_id` varchar(50) DEFAULT NULL COMMENT 'è®¨ä¼IDï¼ˆå¯é€‰ï¼ŒNULLè¡¨ç¤ºéžè®¨ä¼æˆ˜æ–—ï¼‰',
  PRIMARY KEY (`battle_id`),
  KEY `idx_player` (`player_id`),
  KEY `idx_war_id` (`war_id`),
  KEY `idx_battle_type` (`battle_type`),
  KEY `idx_opponent_type` (`opponent_type`),
  KEY `idx_result` (`result`),
  KEY `idx_battle_at` (`battle_at`),
  KEY `idx_favorited` (`is_favorited`),
  KEY `idx_log_expires` (`log_expires_at`),
  KEY `idx_raid_id` (`raid_id`),
  CONSTRAINT `battles_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='æˆ˜æ–—è®°å½•è¡¨ï¼ˆå•æ¬¡æˆ˜æ–—ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chats` (
  `chat_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `channel_type` enum('world','faction','legion') NOT NULL,
  `channel_id` varchar(50) DEFAULT NULL COMMENT 'IDIDIDNULL',
  `sender_id` varchar(4) NOT NULL COMMENT 'ID',
  `sender_name` varchar(50) NOT NULL,
  `sender_faction_id` varchar(50) DEFAULT NULL COMMENT 'ID',
  `content` varchar(100) NOT NULL COMMENT '100',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL COMMENT '+3',
  PRIMARY KEY (`chat_id`),
  KEY `idx_channel` (`channel_type`,`channel_id`,`created_at`),
  KEY `idx_sender` (`sender_id`,`created_at`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `fk_chats_sender_players` FOREIGN KEY (`sender_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cities`
--

DROP TABLE IF EXISTS `cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cities` (
  `id` varchar(50) NOT NULL COMMENT 'åŸŽå¸‚IDï¼ˆå¦‚ï¼šsan_1_city_luoyangï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1ï¼‰',
  `city_name` varchar(100) NOT NULL COMMENT 'åŸŽå¸‚åç§°',
  `city_type` enum('city_major','city_medium','city_small','gate','fort','wilderness') NOT NULL,
  `faction_id` varchar(50) DEFAULT NULL COMMENT 'æ‰€å±žåŠ¿åŠ›ID',
  `region` varchar(50) DEFAULT NULL COMMENT 'æ‰€å±žåœ°åŒºï¼ˆå¦‚ï¼šå¸éš¶ã€å†€å·žï¼‰',
  `position_x` int(11) DEFAULT NULL COMMENT 'åœ°å›¾Xåæ ‡',
  `position_y` int(11) DEFAULT NULL COMMENT 'åœ°å›¾Yåæ ‡',
  `population` int(11) DEFAULT '0' COMMENT 'äººå£ï¼ˆå…³éš˜/è¦å¡žä¸ºNULLï¼‰',
  `commerce` int(11) DEFAULT '0' COMMENT 'å•†ä¸šå€¼ï¼ˆå…³éš˜/è¦å¡žä¸ºNULLï¼‰',
  `agriculture` int(11) DEFAULT '0' COMMENT 'å†œä¸šå€¼ï¼ˆå…³éš˜/è¦å¡žä¸ºNULLï¼‰',
  `military` int(11) DEFAULT '0' COMMENT 'å†›äº‹å€¼ï¼ˆå…³éš˜/è¦å¡žä¸ºNULLï¼‰',
  `culture` int(11) DEFAULT '0' COMMENT 'æ–‡åŒ–å€¼ï¼ˆå…³éš˜/è¦å¡žä¸ºNULLï¼‰',
  `special_resource_name` varchar(50) DEFAULT NULL COMMENT 'ç‰¹è‰²èµ„æºåç§°ï¼ˆå¦‚ï¼šç›åœºã€é“çŸ¿ï¼‰',
  `special_resource_commerce` int(11) DEFAULT '0' COMMENT 'ç‰¹è‰²èµ„æºå•†ä¸šåŠ æˆï¼ˆå›ºå®š+100ï¼‰',
  `special_resource_agriculture` int(11) DEFAULT '0' COMMENT 'ç‰¹è‰²èµ„æºå†œä¸šåŠ æˆï¼ˆå›ºå®š+100ï¼‰',
  `final_commerce` int(11) DEFAULT '0' COMMENT 'æœ€ç»ˆå•†ä¸šå€¼ï¼ˆç”¨äºŽèµ„æºç»“ç®—ï¼‰',
  `final_agriculture` int(11) DEFAULT '0' COMMENT 'æœ€ç»ˆå†œä¸šå€¼ï¼ˆç”¨äºŽèµ„æºç»“ç®—ï¼‰',
  `governor_player_id` varchar(4) DEFAULT NULL COMMENT 'é•¿å®˜çŽ©å®¶ID',
  `status` enum('neutral','contested','owned') DEFAULT 'neutral',
  `governor_appointed_at` datetime DEFAULT NULL COMMENT 'é•¿å®˜ä»»å‘½æ—¶é—´',
  `defense` int(11) DEFAULT '0' COMMENT 'é˜²å¾¡åŠ›',
  `has_main_palace` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æœ‰ä¸»æ®¿ï¼ˆAIå›ä¸»å¤„æ‰€ï¼Œä»…å¤§åŸŽï¼‰',
  `has_three_ministers_palace` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æœ‰ä¸‰å…¬åºœï¼ˆä»…å¤§åŸŽï¼‰',
  `has_side_palace` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æœ‰åæ®¿ï¼ˆAIå¤§å¸ç©ºå¤„æ‰€ï¼Œä»…ä¸­åŸŽï¼‰',
  `has_special_resource_building` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æœ‰ç‰¹è‰²èµ„æºå»ºç­‘ï¼ˆä»…ä¸­åŸŽï¼‰',
  `garrison_capacity` int(11) DEFAULT '0' COMMENT 'é©»å†›æ‰€å®¹é‡',
  `npc_garrison` json DEFAULT NULL,
  `npc_garrison_alive` int(11) DEFAULT '0',
  `npc_max_rarity` varchar(20) DEFAULT 'rare',
  `is_capital` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æ˜¯é¦–éƒ½',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `idx_season` (`season`),
  KEY `idx_faction` (`faction_id`),
  KEY `idx_city_type` (`city_type`),
  KEY `idx_governor` (`governor_player_id`),
  CONSTRAINT `cities_ibfk_2` FOREIGN KEY (`governor_player_id`) REFERENCES `players` (`player_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='åŸŽå¸‚æ•°æ®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_achievements`
--

DROP TABLE IF EXISTS `config_achievements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_achievements` (
  `achievement_id` varchar(50) NOT NULL COMMENT 'æˆå°±IDï¼ˆå¦‚ï¼šsan_1_achv_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žachievement_idä¸­æå–ï¼‰',
  `achievement_name` varchar(100) NOT NULL COMMENT 'æˆå°±åç§°',
  `achievement_description` text COMMENT 'æˆå°±æè¿°',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `category` varchar(50) DEFAULT NULL COMMENT 'æˆå°±ç±»åˆ«ï¼ˆæˆ˜æ–—/ç»æµŽ/ç¤¾äº¤/æŽ¢ç´¢ç­‰ï¼‰',
  `unlock_conditions` json DEFAULT NULL COMMENT 'è§£é”æ¡ä»¶ï¼ˆå¦‚ï¼š{"complete_tutorial": 1, "first_battle": 1}ï¼‰',
  `attribute_bonus` json DEFAULT NULL COMMENT 'å±žæ€§åŠ æˆï¼ˆå¦‚ï¼š{"combat": 30, "intelligence": 20}ï¼‰',
  `special_effects` json DEFAULT NULL COMMENT 'ç‰¹æ®Šæ•ˆæžœï¼ˆå¦‚ï¼š{"exp_bonus": 10, "gold_bonus": 5}ï¼‰',
  `rewards` json DEFAULT NULL COMMENT 'è§£é”å¥–åŠ±ï¼ˆå¦‚ï¼š{"silver": 1000, "food": 500}ï¼‰',
  `icon_url` varchar(255) DEFAULT NULL COMMENT 'å›¾æ ‡URL',
  `display_order` int(11) DEFAULT '0' COMMENT 'æ˜¾ç¤ºé¡ºåº',
  `is_hidden` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦éšè—æˆå°±ï¼ˆè§£é”å‰ä¸æ˜¾ç¤ºï¼‰',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`achievement_id`),
  KEY `idx_season` (`season`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_category` (`category`),
  KEY `idx_display_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='æˆå°±é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_bonds`
--

DROP TABLE IF EXISTS `config_bonds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_bonds` (
  `bond_id` varchar(50) NOT NULL COMMENT 'ç¾ç»ŠIDï¼ˆå¦‚ï¼šbond_1_5001ï¼Œä¸å«èµ›å­£å‰ç¼€ï¼‰',
  `bond_name` varchar(100) NOT NULL COMMENT 'ç¾ç»Šåç§°',
  `bond_type` enum('active','passive') NOT NULL COMMENT 'ç¾ç»Šç±»åž‹ï¼ˆä¸»åŠ¨/è¢«åŠ¨ï¼‰',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `min_characters` int(11) NOT NULL DEFAULT '2' COMMENT 'æœ€å°‘éœ€è¦å°†é¢†æ•°',
  `target_effect` varchar(100) DEFAULT NULL,
  `description` text COMMENT 'ç¾ç»Šæè¿°',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`bond_id`),
  KEY `idx_bond_type` (`bond_type`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_min_characters` (`min_characters`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ç¾ç»Šé…ç½®è¡¨ï¼ˆè·¨èµ›å­£é€šç”¨ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_campaigns`
--

DROP TABLE IF EXISTS `config_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_campaigns` (
  `campaign_id` varchar(64) NOT NULL COMMENT ' campaign-template.csvpreset player_progress ',
  `season` varchar(20) NOT NULL COMMENT ' campaign_id  san_1',
  `campaign_name` varchar(100) NOT NULL,
  `campaign_type` varchar(40) NOT NULL COMMENT 'CSV  Attack Battle',
  `era` varchar(32) NOT NULL COMMENT ' 1844',
  `faction` varchar(512) NOT NULL,
  `max_rounds` int(11) NOT NULL,
  `min_rounds` int(11) DEFAULT NULL COMMENT ' NULL',
  `completion_reward_silver` int(11) NOT NULL,
  `completion_reward_food` int(11) NOT NULL,
  `completion_reward_badge` varchar(32) DEFAULT NULL COMMENT '通关奖励徽章：数字表示第 N 枚赛季徽章',
  `description_1` text NOT NULL,
  `description_2` text NOT NULL,
  `description_3` text,
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT ' era ',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `version` varchar(20) DEFAULT '1.0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`campaign_id`),
  KEY `idx_season_enabled` (`season`,`enabled`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_characters`
--

DROP TABLE IF EXISTS `config_characters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_characters` (
  `character_id` varchar(50) NOT NULL COMMENT 'å°†é¢†IDï¼ˆå¦‚ï¼šsan_1_char_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žcharacter_idä¸­æå–ï¼‰',
  `character_name` varchar(100) NOT NULL COMMENT 'å°†é¢†åç§°',
  `courtesy_name` varchar(50) DEFAULT NULL COMMENT 'å­—ï¼ˆå¦‚ï¼šçŽ„å¾·ï¼‰',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `faction` varchar(50) DEFAULT NULL COMMENT 'åŠ¿åŠ›ï¼ˆå¦‚ï¼šåˆ˜å¤‡ã€æ›¹æ“ï¼‰',
  `luck` int(11) NOT NULL COMMENT 'è¿æ°”Ã—10',
  `courage` int(11) NOT NULL COMMENT 'å‹‡æ°”Ã—10',
  `combat` int(11) NOT NULL COMMENT 'æ­¦åŠ›Ã—10',
  `command` int(11) NOT NULL COMMENT 'ç»Ÿå¸…Ã—10',
  `intelligence` int(11) NOT NULL COMMENT 'æ™ºåŠ›Ã—10',
  `politics` int(11) NOT NULL COMMENT 'æ”¿æ²»Ã—10',
  `charm` int(11) NOT NULL COMMENT 'é­…åŠ›Ã—10',
  `birth_year` int(11) DEFAULT NULL COMMENT 'å‡ºç”Ÿå¹´ï¼ˆå¦‚ï¼š161ï¼‰',
  `death_year` int(11) DEFAULT NULL COMMENT 'å’å¹´ï¼ˆå¦‚ï¼š223ï¼‰',
  `stage` varchar(20) DEFAULT NULL COMMENT 'ç”Ÿæ¶¯ï¼ˆearly/middle/lateï¼‰',
  `character_type` varchar(20) DEFAULT NULL COMMENT 'å°†é¢†ç±»åž‹ï¼ˆmilitary/strategist/balancedï¼‰',
  `skill_1` varchar(50) DEFAULT NULL COMMENT 'æŠ€èƒ½1',
  `skill_2` varchar(50) DEFAULT NULL COMMENT 'æŠ€èƒ½2',
  `troop_affinity` varchar(50) DEFAULT NULL COMMENT 'å…µç§äº²å’Œ',
  `trait` varchar(50) DEFAULT NULL COMMENT 'æ€§æ ¼ç‰¹è´¨ç±»åž‹ï¼ˆbrave/reckless/calm/normal/cautious/timidï¼‰',
  `trait_modifier` int(11) DEFAULT NULL COMMENT 'æ€§æ ¼ç‰¹è´¨å¯¹åº”çš„å£«æ°”ä¿®æ­£å€¼ï¼ˆ-5åˆ°+8ï¼Œç”¨äºŽæˆ˜æ–—è®¡ç®—ï¼‰',
  `character_extra` json DEFAULT NULL COMMENT 'é¢å¤–ä¿¡æ¯ï¼ˆbonds, biography, descriptionï¼‰',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`character_id`),
  KEY `idx_season` (`season`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_faction` (`faction`),
  KEY `idx_stage` (`stage`),
  KEY `idx_character_type` (`character_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='å°†é¢†é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_equipment`
--

DROP TABLE IF EXISTS `config_equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_equipment` (
  `equipment_id` varchar(50) NOT NULL COMMENT 'è£…å¤‡IDï¼ˆå¦‚ï¼šsan_1_equip_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žequipment_idä¸­æå–ï¼‰',
  `equipment_name` varchar(100) NOT NULL COMMENT 'è£…å¤‡åç§°',
  `equipment_type` enum('weapon','armor','accessory') NOT NULL COMMENT 'è£…å¤‡ç±»åž‹',
  `rarity` enum('common','rare','epic','legendary') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `luck_bonus` int(11) DEFAULT '0' COMMENT 'è¿æ°”åŠ æˆÃ—10',
  `courage_bonus` int(11) DEFAULT '0' COMMENT 'å‹‡æ°”åŠ æˆÃ—10',
  `combat_bonus` int(11) DEFAULT '0' COMMENT 'æ­¦åŠ›åŠ æˆÃ—10',
  `command_bonus` int(11) DEFAULT '0' COMMENT 'ç»Ÿå¸…åŠ æˆÃ—10',
  `intelligence_bonus` int(11) DEFAULT '0' COMMENT 'æ™ºåŠ›åŠ æˆÃ—10',
  `politics_bonus` int(11) DEFAULT '0' COMMENT 'æ”¿æ²»åŠ æˆÃ—10',
  `charm_bonus` int(11) DEFAULT '0' COMMENT 'é­…åŠ›åŠ æˆÃ—10',
  `special_effect` json DEFAULT NULL COMMENT 'ç‰¹æ®Šæ•ˆæžœ',
  `special_effect_desc` varchar(255) DEFAULT NULL,
  `description` text,
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`equipment_id`),
  KEY `idx_season` (`season`),
  KEY `idx_equipment_type` (`equipment_type`),
  KEY `idx_rarity` (`rarity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='è£…å¤‡é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_events`
--

DROP TABLE IF EXISTS `config_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_events` (
  `event_id` varchar(50) NOT NULL COMMENT 'ID',
  `event_name` varchar(100) NOT NULL,
  `location` varchar(100) DEFAULT NULL,
  `min_position_level` int(11) DEFAULT NULL,
  `trigger_probability` decimal(4,2) NOT NULL DEFAULT '0.10',
  `trigger_context` varchar(50) DEFAULT NULL,
  `chain_id` varchar(50) DEFAULT NULL COMMENT 'ID',
  `chain_level` int(11) DEFAULT NULL,
  `required_items` varchar(255) DEFAULT NULL,
  `description_1` text COMMENT '1',
  `description_2` text COMMENT '2',
  `description_3` text COMMENT '3',
  `option_a` json DEFAULT NULL COMMENT 'A',
  `option_b` json DEFAULT NULL COMMENT 'B',
  `tags` varchar(255) DEFAULT NULL,
  `version` varchar(20) DEFAULT '1.0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`),
  KEY `idx_location` (`location`),
  KEY `idx_trigger_context` (`trigger_context`),
  KEY `idx_chain_id` (`chain_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_factions`
--

DROP TABLE IF EXISTS `config_factions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_factions` (
  `faction_id` varchar(50) NOT NULL COMMENT 'åŠ¿åŠ›IDï¼ˆå¦‚ï¼šsan_1_faction_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žfaction_idä¸­æå–ï¼‰',
  `faction_name` varchar(100) NOT NULL COMMENT 'åŠ¿åŠ›åç§°',
  `faction_leader` varchar(50) DEFAULT NULL COMMENT 'åŠ¿åŠ›å›ä¸»IDï¼ˆå…³è”å°†é¢†è¡¨ï¼‰',
  `icon` varchar(10) DEFAULT NULL COMMENT 'åŠ¿åŠ›å›¾æ ‡ï¼ˆemojiï¼‰',
  `color` varchar(20) DEFAULT NULL COMMENT 'åŠ¿åŠ›é¢œè‰²ï¼ˆhexï¼‰',
  `style` varchar(50) DEFAULT NULL COMMENT 'åŠ¿åŠ›é£Žæ ¼ï¼ˆæœºç¼˜/éœ¸ä¸š/æŒ‘æˆ˜/çŒ›æ”»/ä¸­åº¸/é€Ÿæ”»ç­‰ï¼‰',
  `max_players` int(11) NOT NULL DEFAULT '100' COMMENT 'æœ€å¤§çŽ©å®¶æ•°',
  `faction_bonuses` json DEFAULT NULL COMMENT 'åŠ¿åŠ›åŠ æˆåˆ—è¡¨',
  `description` text COMMENT 'åŠ¿åŠ›æè¿°',
  `difficulty` varchar(20) DEFAULT NULL COMMENT 'éš¾åº¦ï¼ˆç®€å•/ä¸­çº§/å›°éš¾ï¼‰ï¼Œç®€å•=æŽ¨è',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`faction_id`),
  KEY `idx_season` (`season`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='åŠ¿åŠ›é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_items`
--

DROP TABLE IF EXISTS `config_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_items` (
  `item_id` varchar(50) NOT NULL COMMENT 'IDsan_1_item_taoyuan',
  `item_name` varchar(100) NOT NULL,
  `description` text,
  `item_type` enum('event_key','season_badge') NOT NULL DEFAULT 'event_key' COMMENT 'event_key=钥匙类; season_badge=赛季徽章',
  `season` varchar(20) DEFAULT NULL COMMENT 'san_1',
  `version` varchar(20) DEFAULT '1.0.0',
  `special_effect` varchar(128) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_positions`
--

DROP TABLE IF EXISTS `config_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_positions` (
  `position_id` varchar(50) NOT NULL COMMENT 'å®˜èŒIDï¼ˆå¦‚ï¼šsan_1_pos_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žposition_idä¸­æå–ï¼‰',
  `position_name` varchar(100) NOT NULL COMMENT 'å®˜èŒåç§°',
  `position_level` int(11) NOT NULL COMMENT 'å®˜èŒç­‰çº§',
  `position_rank` int(11) NOT NULL COMMENT 'å®˜èŒæŽ’åï¼ˆç”¨äºŽæŽ’åºï¼‰',
  `rarity` varchar(20) DEFAULT 'common',
  `category` varchar(50) DEFAULT NULL COMMENT 'å®˜èŒç±»åˆ«',
  `icon` varchar(10) DEFAULT NULL COMMENT 'å®˜èŒå›¾æ ‡ï¼ˆemojiï¼‰',
  `color` varchar(20) DEFAULT NULL COMMENT 'å®˜èŒé¢œè‰²ï¼ˆhexï¼‰',
  `description` text COMMENT 'å®˜èŒæè¿°',
  `requirement` int(11) NOT NULL COMMENT 'æ‰€éœ€å£°æœ›',
  `position_bonuses` json DEFAULT NULL COMMENT 'å®˜èŒåŠ æˆï¼ˆå¦‚ï¼š{"resource": 0.5, "prestige": 0.5, "infantry": 0.15, "cavalry": 0, "archer": 0}ï¼‰',
  `permissions` json DEFAULT NULL COMMENT 'æƒé™åˆ—è¡¨',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`position_id`),
  KEY `idx_season` (`season`),
  KEY `idx_level` (`position_level`),
  KEY `idx_rank` (`position_rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='å®˜èŒé…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_servers`
--

DROP TABLE IF EXISTS `config_servers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_servers` (
  `server_id` varchar(20) NOT NULL COMMENT 'æœåŠ¡å™¨IDï¼ˆå¦‚ï¼šS1-01ï¼‰',
  `server_name` varchar(50) NOT NULL COMMENT 'æœåŠ¡å™¨åç§°ï¼ˆå¦‚ï¼šç¾¤é›„é€é¹¿ï¼‰',
  `server_icon` varchar(255) DEFAULT 'ðŸ°' COMMENT 'æœåŠ¡å™¨å›¾æ ‡ï¼ˆemojiæˆ–å›¾ç‰‡URLï¼‰',
  `server_color` varchar(20) DEFAULT '#FF6B6B' COMMENT 'æœåŠ¡å™¨ä¸»é¢˜è‰²ï¼ˆhexï¼‰',
  `description` varchar(200) DEFAULT NULL COMMENT 'æœåŠ¡å™¨æè¿°',
  `current_season` varchar(50) NOT NULL COMMENT 'å½“å‰èµ›å­£ï¼ˆå¦‚ï¼šsan_1ï¼‰',
  `season_start_time` datetime DEFAULT NULL COMMENT 'èµ›å­£å¼€å§‹æ—¶é—´',
  `season_end_time` datetime DEFAULT NULL COMMENT 'èµ›å­£ç»“æŸæ—¶é—´',
  `max_real_players` int(11) DEFAULT '700' COMMENT 'æœ€å¤§çœŸäººçŽ©å®¶æ•°',
  `max_ai_players` int(11) DEFAULT '300' COMMENT 'æœ€å¤§AIçŽ©å®¶æ•°',
  `status` enum('open','maintenance','closed') DEFAULT 'open' COMMENT 'æœåŠ¡å™¨çŠ¶æ€',
  `is_new` tinyint(1) DEFAULT '1' COMMENT 'æ˜¯å¦æ–°æœï¼ˆå¼€æœ7å¤©å†…ï¼‰',
  `is_recommended` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦æŽ¨èæœåŠ¡å™¨',
  `opened_at` datetime NOT NULL COMMENT 'å¼€æœæ—¶é—´',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  `game_time_start_year` int(11) NOT NULL DEFAULT '184' COMMENT '=18411',
  `game_time_start_month` int(11) NOT NULL DEFAULT '1' COMMENT ' 1-12',
  `game_time_start_day` int(11) NOT NULL DEFAULT '1' COMMENT ' 1-30',
  `game_time_real_hours_per_game_day` decimal(10,4) NOT NULL DEFAULT '1.0000' COMMENT '11=1=1',
  PRIMARY KEY (`server_id`),
  KEY `idx_season` (`current_season`),
  KEY `idx_status` (`status`),
  KEY `idx_opened_at` (`opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='æœåŠ¡å™¨é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_skills`
--

DROP TABLE IF EXISTS `config_skills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_skills` (
  `skill_id` varchar(50) NOT NULL COMMENT 'æŠ€èƒ½IDï¼ˆå¦‚ï¼šsan_1_skill_1_5001ï¼ŒåŒ…å«èµ›å­£å‰ç¼€ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£æ ‡è¯†ï¼ˆå¦‚ï¼šsan_1ï¼‰',
  `skill_name` varchar(100) NOT NULL COMMENT 'æŠ€èƒ½åç§°',
  `skill_type` enum('active','passive') NOT NULL COMMENT 'æŠ€èƒ½ç±»åž‹ï¼ˆä¸»åŠ¨/è¢«åŠ¨ï¼‰',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `damage_type` enum('physical','strategy','none') DEFAULT NULL COMMENT 'ä¼¤å®³ç±»åž‹ï¼ˆç‰©ç†/ç­–ç•¥/æ— ï¼‰',
  `character_type` varchar(100) DEFAULT NULL COMMENT 'é€‚ç”¨å°†é¢†ç±»åž‹ï¼ˆå¦‚ï¼šmilitary;balancedï¼‰',
  `troop_type` varchar(100) DEFAULT NULL COMMENT 'å…µç§ç±»åž‹é™åˆ¶ï¼ˆå¦‚ï¼šinfantry;cavalry;archerï¼Œç•™ç©ºè¡¨ç¤ºé€šç”¨ï¼‰',
  `target_effect` varchar(100) DEFAULT NULL,
  `target_range` varchar(20) DEFAULT NULL COMMENT 'ç›®æ ‡èŒƒå›´ï¼ˆ1x1/1x2/1x3/2x2/3x3/4x4/cross/cross_thin/cross_largeï¼‰',
  `target_count` varchar(20) DEFAULT NULL COMMENT 'ç›®æ ‡æ•°é‡ï¼ˆall/1/2/3/random_1/random_2/random_3ï¼‰',
  `description` text COMMENT 'æŠ€èƒ½æè¿°',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`skill_id`),
  KEY `idx_season` (`season`),
  KEY `idx_skill_type` (`skill_type`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_damage_type` (`damage_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='æŠ€èƒ½é…ç½®è¡¨ï¼ˆæŒ‰èµ›å­£åŒºåˆ†ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_texts`
--

DROP TABLE IF EXISTS `config_texts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_texts` (
  `template_id` varchar(50) NOT NULL COMMENT 'ID',
  `mail_type` enum('system','reward') NOT NULL COMMENT ' texts.type',
  `subject` varchar(100) NOT NULL,
  `body` text NOT NULL,
  `attachments_json` json DEFAULT NULL,
  `season` varchar(20) DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `remark` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  KEY `idx_season` (`season`),
  KEY `idx_mail_type` (`mail_type`),
  KEY `idx_enabled_sort` (`is_enabled`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_titles`
--

DROP TABLE IF EXISTS `config_titles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_titles` (
  `title_id` varchar(50) NOT NULL COMMENT 'ç§°å·IDï¼ˆå¦‚ï¼šsan_1_title_1001ï¼‰',
  `season` varchar(20) DEFAULT 'san_1',
  `title_name` varchar(100) NOT NULL COMMENT 'ç§°å·åç§°',
  `description` text,
  `display_name` varchar(100) DEFAULT NULL,
  `display_position` varchar(20) DEFAULT 'prefix',
  `is_unique` tinyint(1) DEFAULT '0',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `unlock_conditions` json DEFAULT NULL COMMENT 'è§£é”æ¡ä»¶ï¼ˆå¦‚ï¼š{"win_battles": 100, "reputation": 1000}ï¼‰',
  `unlock_conditions_desc` text,
  `attribute_bonus` json DEFAULT NULL COMMENT 'å±žæ€§åŠ æˆï¼ˆå¦‚ï¼š{"combat": 50, "command": 30}ï¼Œè¡¨ç¤ºæ­¦åŠ›+5.0ï¼Œç»ŸçŽ‡+3.0ï¼‰',
  `special_effect` varchar(100) DEFAULT NULL,
  `special_effect_desc` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`title_id`),
  KEY `idx_season` (`season`),
  KEY `idx_rarity` (`rarity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ç§°å·é…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config_troops`
--

DROP TABLE IF EXISTS `config_troops`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_troops` (
  `troop_id` varchar(50) NOT NULL COMMENT 'éƒ¨é˜ŸIDï¼ˆå¦‚ï¼šsan_1_troop_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1, san_2ï¼Œä»Žtroop_idä¸­æå–ï¼‰',
  `troop_name` varchar(100) NOT NULL COMMENT 'éƒ¨é˜Ÿåç§°',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `troop_type` enum('infantry','cavalry','archer','special') NOT NULL COMMENT 'å…µç§ç±»åž‹',
  `weapon_type` varchar(50) DEFAULT NULL,
  `max_troops` int(11) NOT NULL COMMENT 'æœ€å¤§å…µåŠ›',
  `troop_weight` decimal(5,2) NOT NULL DEFAULT '1.00' COMMENT '兵力权重（等效兵力=max_troops×troop_weight，可小数）',
  `range` int(11) NOT NULL COMMENT 'æ”»å‡»è·ç¦»',
  `attack` int(11) NOT NULL COMMENT 'æ”»å‡»åŠ›Ã—10',
  `defense` int(11) NOT NULL COMMENT 'é˜²å¾¡åŠ›Ã—10',
  `speed` int(11) NOT NULL COMMENT 'é€Ÿåº¦',
  `movement` int(11) NOT NULL COMMENT 'ç§»åŠ¨åŠ›',
  `special_ability` json DEFAULT NULL COMMENT 'ç‰¹æ®Šèƒ½åŠ›ï¼ˆåŒ…å«skillsã€countersã€adaptationã€effectsï¼‰',
  `description` text COMMENT 'éƒ¨é˜Ÿæè¿°',
  `version` varchar(20) DEFAULT '1.0.0' COMMENT 'ç‰ˆæœ¬å·',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`troop_id`),
  KEY `idx_season` (`season`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_troop_type` (`troop_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='éƒ¨é˜Ÿé…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `factions`
--

DROP TABLE IF EXISTS `factions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `factions` (
  `id` varchar(50) NOT NULL COMMENT 'åŠ¿åŠ›IDï¼ˆå¦‚ï¼šsan_1_faction_1001ï¼‰',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1ï¼‰',
  `faction_name` varchar(100) NOT NULL COMMENT 'åŠ¿åŠ›åç§°',
  `silver_reserve` int(11) DEFAULT '0' COMMENT 'é“¶ä¸¤å‚¨å¤‡',
  `food_reserve` int(11) DEFAULT '0' COMMENT 'ç²®è‰å‚¨å¤‡',
  `troop_orange_probability` decimal(5,4) DEFAULT '0.0000' COMMENT 'éƒ¨é˜Ÿæ©™å¡æ¦‚çŽ‡ï¼ˆå¦‚ï¼š0.0500è¡¨ç¤º5%ï¼‰',
  `character_orange_probability` decimal(5,4) DEFAULT '0.0000' COMMENT 'å°†é¢†æ©™å¡æ¦‚çŽ‡ï¼ˆå¦‚ï¼š0.0500è¡¨ç¤º5%ï¼‰',
  `player_count` int(11) DEFAULT '0' COMMENT 'çŽ©å®¶æ•°é‡',
  `city_count` int(11) DEFAULT '0' COMMENT 'å é¢†åŸŽå¸‚æ•°',
  `total_power` bigint(20) DEFAULT '0' COMMENT 'æ€»æˆ˜åŠ›',
  `last_settlement_at` datetime DEFAULT NULL COMMENT 'æœ€åŽç»“ç®—æ—¶é—´',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `idx_season` (`season`),
  KEY `idx_faction_name` (`faction_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='åŠ¿åŠ›è¿è¡Œæ—¶æ•°æ®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `legion_members`
--

DROP TABLE IF EXISTS `legion_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `legion_members` (
  `legion_id` varchar(50) NOT NULL COMMENT 'å†›å›¢ID',
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `role` enum('commander','member') DEFAULT 'member' COMMENT 'è§’è‰²ï¼ˆé•¿å®˜/æˆå‘˜ï¼‰',
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åŠ å…¥æ—¶é—´',
  PRIMARY KEY (`legion_id`,`player_id`),
  KEY `idx_player` (`player_id`),
  KEY `idx_role` (`role`),
  CONSTRAINT `legion_members_ibfk_1` FOREIGN KEY (`legion_id`) REFERENCES `legions` (`legion_id`) ON DELETE CASCADE,
  CONSTRAINT `legion_members_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='å†›å›¢æˆå‘˜è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `legions`
--

DROP TABLE IF EXISTS `legions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `legions` (
  `legion_id` varchar(50) NOT NULL COMMENT 'å†›å›¢IDï¼ˆå¦‚ï¼šsan_1_legion_1001ï¼Œç¬¬ä¸€ä½æ•°å­—ä»£è¡¨åŠ¿åŠ›ï¼‰',
  `legion_name` varchar(50) NOT NULL COMMENT 'å†›å›¢åç§°',
  `faction_id` varchar(50) NOT NULL COMMENT 'æ‰€å±žåŠ¿åŠ›ID',
  `season` varchar(20) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1ï¼‰',
  `commander_id` varchar(4) NOT NULL COMMENT 'å†›å›¢é•¿å®˜IDï¼ˆ3-1é˜¶å®˜èŒï¼‰',
  `commander_position_id` varchar(50) DEFAULT NULL COMMENT 'é•¿å®˜å®˜èŒIDï¼ˆç”¨äºŽéªŒè¯æƒé™ï¼‰',
  `member_count` int(11) DEFAULT '0' COMMENT 'å½“å‰æˆå‘˜æ•°',
  `max_members` int(11) DEFAULT '30' COMMENT 'æœ€å¤§æˆå‘˜æ•°',
  `status` enum('active','disbanded') DEFAULT 'active' COMMENT 'å†›å›¢çŠ¶æ€',
  `description` text COMMENT 'å†›å›¢æè¿°',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`legion_id`),
  KEY `idx_faction` (`faction_id`),
  KEY `idx_season` (`season`),
  KEY `idx_commander` (`commander_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `legions_ibfk_1` FOREIGN KEY (`faction_id`) REFERENCES `factions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `legions_ibfk_2` FOREIGN KEY (`commander_id`) REFERENCES `players` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='å†›å›¢è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `memorial_images`
--

DROP TABLE IF EXISTS `memorial_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `memorial_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'çºªå¿µå›¾ID',
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `season_id` varchar(50) NOT NULL COMMENT 'èµ›å­£ID',
  `server_id` varchar(50) NOT NULL COMMENT 'æœåŠ¡å™¨ID',
  `image_type` enum('milestone','daily','battle') NOT NULL COMMENT 'å›¾ç‰‡ç±»åž‹ï¼šmilestone=å…³é”®èŠ‚ç‚¹ï¼ˆæ°¸ä¹…ï¼‰, daily=æ¯æ—¥ç”Ÿæ¶¯ï¼ˆ14å¤©ï¼‰, battle=æˆ˜æ–—çºªå¿µï¼ˆ14å¤©ï¼Œæ¯å¤©é™1æ¬¡ï¼‰',
  `event_date` date NOT NULL COMMENT 'äº‹ä»¶æ—¥æœŸ',
  `battle_id` varchar(80) DEFAULT NULL COMMENT 'å…³è”çš„æˆ˜æ–—IDï¼ˆä»…battleç±»åž‹ä½¿ç”¨ï¼‰',
  `image_url` varchar(500) NOT NULL COMMENT 'OSSå›¾ç‰‡å®Œæ•´URL',
  `oss_key` varchar(500) NOT NULL COMMENT 'OSSå­˜å‚¨key',
  `file_size` int(11) DEFAULT NULL COMMENT 'æ–‡ä»¶å¤§å°ï¼ˆå­—èŠ‚ï¼‰',
  `event_data` json NOT NULL COMMENT 'äº‹ä»¶è¯¦ç»†æ•°æ®',
  `expires_at` datetime DEFAULT NULL COMMENT 'è¿‡æœŸæ—¶é—´ï¼ˆmilestoneä¸ºNULLæ°¸ä¸è¿‡æœŸï¼Œdailyå’Œbattleä¸ºåˆ›å»ºæ—¶é—´+14å¤©ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `daily_event_date` date GENERATED ALWAYS AS ((case when (`image_type` = 'daily') then `event_date` else NULL end)) STORED,
  `battle_event_date` date GENERATED ALWAYS AS ((case when (`image_type` = 'battle') then `event_date` else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_daily_once_per_day` (`player_id`,`daily_event_date`),
  UNIQUE KEY `uk_battle_once_per_day` (`player_id`,`battle_event_date`),
  KEY `idx_player` (`player_id`),
  KEY `idx_player_season` (`player_id`,`season_id`),
  KEY `idx_image_type` (`image_type`),
  KEY `idx_event_date` (`event_date`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_battle_id` (`battle_id`),
  CONSTRAINT `memorial_images_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COMMENT='çºªå¿µå›¾è¡¨ï¼ˆåŒ…å«å…³é”®èŠ‚ç‚¹ã€æ¯æ—¥ç”Ÿæ¶¯ã€æˆ˜æ–—çºªå¿µä¸‰ç§ç±»åž‹ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_cards`
--

DROP TABLE IF EXISTS `player_cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_cards` (
  `instance_id` varchar(50) NOT NULL COMMENT 'å¡ç‰Œå®žä¾‹ID',
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `card_type` enum('troop','character','equipment','title','achievement','treasure','equipmentSet') NOT NULL,
  `card_id` varchar(50) NOT NULL COMMENT 'å¡ç‰Œé…ç½®IDï¼ˆå…³è”é…ç½®è¡¨ï¼‰',
  `rarity` enum('common','rare','epic','legendary','core') NOT NULL COMMENT 'ç¨€æœ‰åº¦',
  `current_troops` int(11) DEFAULT NULL COMMENT 'å½“å‰å…µåŠ›ï¼ˆæˆ˜æ–—ä¸­ä¼šæŸå¤±ï¼Œå¯é€šè¿‡ç²®è‰æ¢å¤ï¼‰',
  `battle_count` int(11) DEFAULT '0' COMMENT 'å·²ä½¿ç”¨æ¬¡æ•°ï¼ˆæ¯æ¬¡æˆ˜æ–—+1ï¼‰',
  `max_battle_count` int(11) DEFAULT NULL COMMENT 'æœ€å¤§ä½¿ç”¨æ¬¡æ•°ï¼ˆæ ¹æ®ç¨€æœ‰åº¦ï¼šcommon=10, rare=15, epic=20, legendary=25, core=30ï¼‰',
  `morale` int(11) DEFAULT NULL COMMENT '0-120=70+config_characters.trait_modifier',
  `bonus_max_troops` int(11) DEFAULT '0',
  `bonus_attack` int(11) DEFAULT '0' COMMENT '10',
  `bonus_defense` int(11) DEFAULT '0' COMMENT '10',
  `bonus_speed` int(11) DEFAULT '0',
  `bonus_movement` int(11) DEFAULT '0',
  `last_troops_lost_at` datetime DEFAULT NULL,
  `equipment_set_id` varchar(50) DEFAULT NULL COMMENT 'è£…å¤‡å¥—è£…ID',
  `equipment_set_data` json DEFAULT NULL COMMENT '112',
  `is_equipped` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦å·²è£…å¤‡',
  `equipped_by` varchar(50) DEFAULT NULL COMMENT 'è£…å¤‡è€…ï¼ˆplayer/character1/character2ï¼‰',
  `equipped_slot` varchar(50) DEFAULT NULL COMMENT 'è£…å¤‡æ§½ä½',
  `bound_equipment_set_instance_id` varchar(50) DEFAULT NULL COMMENT ' instance_id card_type=equipment 24 ',
  `obtained_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'èŽ·å¾—æ—¶é—´',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`instance_id`),
  KEY `idx_player` (`player_id`),
  KEY `idx_card_type` (`card_type`),
  KEY `idx_card_id` (`card_id`),
  KEY `idx_rarity` (`rarity`),
  KEY `idx_equipped` (`is_equipped`,`equipped_by`),
  KEY `idx_player_bound_set` (`player_id`,`bound_equipment_set_instance_id`),
  CONSTRAINT `player_cards_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶å¡ç‰Œè¡¨ï¼ˆä»…å­˜å‚¨åŠ¨æ€æ•°æ®ï¼Œå›ºå®šå±žæ€§ä»Žé…ç½®è¡¨è¯»å–ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_events`
--

DROP TABLE IF EXISTS `player_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_events` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `historical_events` json DEFAULT NULL COMMENT 'åŽ†å²äº‹ä»¶è¿›åº¦ï¼ˆç±»åž‹1ï¼šåŸºäºŽçœŸå®žåŽ†å²çš„äº‹ä»¶ï¼‰',
  `fictional_events` json DEFAULT NULL COMMENT 'è™šæž„äº‹ä»¶è¿›åº¦ï¼ˆç±»åž‹2ï¼šåŽŸåˆ›å‰§æƒ…äº‹ä»¶ï¼‰',
  `daily_events` json DEFAULT NULL COMMENT 'æ—¥å¸¸äº‹ä»¶è¿›åº¦ï¼ˆç±»åž‹3ï¼šæ¯æ—¥ä»»åŠ¡å’Œéšæœºé­é‡ï¼‰',
  `weekly_events` json DEFAULT NULL COMMENT 'å‘¨å¸¸äº‹ä»¶è¿›åº¦ï¼ˆç±»åž‹4ï¼šæ¯å‘¨æŒ‘æˆ˜å’Œä»»åŠ¡ï¼‰',
  `mini_events` json DEFAULT NULL COMMENT 'è¿·ä½ æ¸¸æˆè¿›åº¦ï¼ˆç±»åž‹5ï¼šå°æ¸¸æˆç±»äº‹ä»¶ï¼‰',
  `explore_events` json DEFAULT NULL COMMENT '6',
  `reward_events` json DEFAULT NULL COMMENT '7',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  `explore_quota_remaining` int(11) DEFAULT NULL,
  `explore_quota_refill_ts` varchar(20) DEFAULT NULL,
  `siege_quota_remaining` int(11) DEFAULT NULL,
  `siege_quota_refill_ts` varchar(20) DEFAULT NULL,
  `explore_chain_reset_date` date DEFAULT NULL COMMENT ' CURDATE() ',
  PRIMARY KEY (`player_id`),
  CONSTRAINT `player_events_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶äº‹ä»¶è¿›åº¦è¡¨ï¼ˆåŠ¨æ€å†…å®¹ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_garrison`
--

DROP TABLE IF EXISTS `player_garrison`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_garrison` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `garrison_slot` int(11) NOT NULL COMMENT 'é©»å®ˆæ§½ä½ç¼–å·ï¼ˆ1-12ï¼‰',
  `city_id` varchar(50) DEFAULT NULL COMMENT 'é©»å®ˆåŸŽå¸‚IDï¼ˆå¦‚ï¼šsan_1_city_3_xinyeï¼‰',
  `city_name` varchar(50) DEFAULT NULL COMMENT 'é©»å®ˆåŸŽå¸‚åç§°ï¼ˆå¦‚ï¼šæ–°é‡ŽåŸŽï¼‰',
  `char1_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1å¡ç‰Œå®žä¾‹ID',
  `char1_equipment_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1è£…å¤‡å¡æ§½',
  `char1_title` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1ç§°å·æ§½',
  `char1_achievement` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1æˆå°±æ§½',
  `char1_treasure` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1å®ç‰©æ§½',
  `char1_troop1` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1éƒ¨é˜Ÿæ§½1',
  `char1_troop2` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1éƒ¨é˜Ÿæ§½2',
  `char2_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2å¡ç‰Œå®žä¾‹ID',
  `char2_equipment_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2è£…å¤‡å¡æ§½',
  `char2_title` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2ç§°å·æ§½',
  `char2_achievement` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2æˆå°±æ§½',
  `char2_treasure` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2å®ç‰©æ§½',
  `char2_troop1` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2éƒ¨é˜Ÿæ§½1',
  `char2_troop2` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2éƒ¨é˜Ÿæ§½2',
  `is_active` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦å·²æ¿€æ´»ï¼ˆæœ‰å°†é¢†é©»å®ˆï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`,`garrison_slot`),
  KEY `idx_city` (`city_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `player_garrison_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶é©»å®ˆé…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_garrison_slots`
--

DROP TABLE IF EXISTS `player_garrison_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_garrison_slots` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `garrison_slot` int(11) NOT NULL COMMENT 'é©»å®ˆæ§½ä½ç¼–å·ï¼ˆ1-12ï¼‰',
  `city_id` varchar(50) DEFAULT NULL COMMENT 'é©»å®ˆåŸŽå¸‚IDï¼ˆå¦‚ï¼šnanyangï¼‰',
  `city_name` varchar(50) DEFAULT NULL COMMENT 'é©»å®ˆåŸŽå¸‚åç§°ï¼ˆå¦‚ï¼šå—é˜³åŸŽï¼‰',
  `char1_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1å¡ç‰Œå®žä¾‹ID',
  `char1_equipment_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1è£…å¤‡å¡æ§½ï¼ˆåŒ…å«æ­¦å™¨Ã—1ã€é˜²å…·Ã—1ã€è¾…åŠ©Ã—2ï¼‰',
  `char1_title` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1ç§°å·æ§½',
  `char1_achievement` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1æˆå°±æ§½',
  `char1_treasure` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1å®ç‰©æ§½',
  `char1_troop1` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1éƒ¨é˜Ÿæ§½1',
  `char1_troop2` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†1éƒ¨é˜Ÿæ§½2',
  `char2_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2å¡ç‰Œå®žä¾‹ID',
  `char2_equipment_card` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2è£…å¤‡å¡æ§½ï¼ˆåŒ…å«æ­¦å™¨Ã—1ã€é˜²å…·Ã—1ã€è¾…åŠ©Ã—2ï¼‰',
  `char2_title` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2ç§°å·æ§½',
  `char2_achievement` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2æˆå°±æ§½',
  `char2_treasure` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2å®ç‰©æ§½',
  `char2_troop1` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2éƒ¨é˜Ÿæ§½1',
  `char2_troop2` varchar(50) DEFAULT NULL COMMENT 'å°†é¢†2éƒ¨é˜Ÿæ§½2',
  `is_active` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦å·²æ¿€æ´»ï¼ˆæ˜¯å¦æœ‰å°†é¢†é©»å®ˆï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`,`garrison_slot`),
  UNIQUE KEY `idx_player_slot` (`player_id`,`garrison_slot`),
  KEY `idx_city` (`city_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `player_garrison_slots_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶é©»å®ˆé…ç½®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `player_progress`
--

DROP TABLE IF EXISTS `player_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_progress` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `tutorial_completed` tinyint(1) DEFAULT '0' COMMENT 'æ˜¯å¦å®Œæˆæ–°æ‰‹å¼•å¯¼',
  `tutorial_current_step` int(11) DEFAULT '1' COMMENT 'å½“å‰æ­¥éª¤',
  `tutorial_completed_at` datetime DEFAULT NULL COMMENT 'å®Œæˆæ—¶é—´',
  `unlocked_titles` json DEFAULT NULL COMMENT 'å·²è§£é”çš„ç§°å·åˆ—è¡¨ï¼ˆç§°å·IDæ•°ç»„ï¼‰',
  `title_progress` json DEFAULT NULL COMMENT 'ç§°å·è§£é”è¿›åº¦ï¼ˆåŒ…å«æœªè§£é”å’Œå·²è§£é”çš„è¿›åº¦æ•°æ®ï¼‰',
  `unlocked_achievements` json DEFAULT NULL COMMENT 'å·²è§£é”çš„æˆå°±åˆ—è¡¨ï¼ˆæˆå°±IDæ•°ç»„ï¼‰',
  `achievement_progress` json DEFAULT NULL COMMENT 'æˆå°±è§£é”è¿›åº¦ï¼ˆåŒ…å«æœªè§£é”å’Œå·²è§£é”çš„è¿›åº¦æ•°æ®ï¼‰',
  `campaign_progress` json DEFAULT NULL COMMENT 'æˆ˜å½¹åœ°å›¾è¿›åº¦ï¼ˆè®°å½•æ¯ä¸ªæˆ˜å½¹çš„å®Œæˆæƒ…å†µã€æ˜Ÿçº§ã€æŽ’åç­‰ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`),
  CONSTRAINT `player_progress_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶è¿›åº¦è¡¨ï¼ˆå›ºå®šå†…å®¹ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `players` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶è§’è‰²IDï¼ˆç­‰åŒäºŽè´¦å·IDï¼‰',
  `character_name` varchar(50) NOT NULL COMMENT 'è§’è‰²å',
  `faction_id` varchar(50) NOT NULL COMMENT 'åŠ¿åŠ›ID',
  `faction_name` varchar(50) NOT NULL COMMENT 'åŠ¿åŠ›åç§°',
  `avatar` varchar(255) DEFAULT NULL COMMENT 'å¤´åƒURL',
  `reputation` int(11) DEFAULT '0' COMMENT 'å½“å‰å£°æœ›å€¼ï¼ˆç´¯è®¡ï¼Œåªå¢žä¸å‡ï¼‰',
  `reputation_to_next` int(11) DEFAULT '10' COMMENT 'ä¸‹ä¸€çº§å®˜èŒæ‰€éœ€å£°æœ›',
  `contribution` int(11) DEFAULT '0' COMMENT 'å½“å‰è´¡çŒ®å€¼ï¼ˆå¯ç”¨äºŽå…‘æ¢ç¨€æœ‰å¥–åŠ±ï¼‰',
  `silver` int(11) DEFAULT '500' COMMENT 'é“¶ä¸¤',
  `food` int(11) DEFAULT '1000' COMMENT 'ç²®è‰',
  `combat` int(11) NOT NULL COMMENT 'æ­¦åŠ›Ã—10',
  `intelligence` int(11) NOT NULL COMMENT 'æ™ºåŠ›Ã—10',
  `command` int(11) NOT NULL COMMENT 'ç»ŸçŽ‡Ã—10',
  `politics` int(11) NOT NULL COMMENT 'æ”¿æ²»Ã—10',
  `charm` int(11) NOT NULL COMMENT 'é­…åŠ›Ã—10',
  `courage` int(11) NOT NULL COMMENT 'å‹‡æ°”Ã—10',
  `luck` int(11) NOT NULL COMMENT 'è¿æ°”Ã—10',
  `skill_1` varchar(50) DEFAULT NULL COMMENT 'æŠ€èƒ½1',
  `skill_2` varchar(50) DEFAULT NULL COMMENT 'æŠ€èƒ½2',
  `troop_affinity` varchar(50) DEFAULT NULL COMMENT 'å…µç§äº²å’Œï¼ˆå¦‚ï¼šinfantry:5ï¼‰',
  `trait` varchar(50) DEFAULT NULL COMMENT 'æ€§æ ¼ç‰¹è´¨ç±»åž‹ï¼ˆbrave/reckless/calm/normal/cautious/timidï¼‰',
  `trait_modifier` int(11) DEFAULT NULL COMMENT 'æ€§æ ¼ç‰¹è´¨å¯¹åº”çš„å£«æ°”ä¿®æ­£å€¼ï¼ˆ-5åˆ°+8ï¼Œç”¨äºŽæˆ˜æ–—è®¡ç®—ï¼‰',
  `on_duty` tinyint(1) NOT NULL DEFAULT '0',
  `on_duty_city_id` varchar(64) DEFAULT NULL COMMENT ' id cities.id ',
  `attr_reroll_date` date DEFAULT NULL,
  `attr_reroll_count` int(11) DEFAULT '0' COMMENT '00:002',
  `attr_reroll_batches` json DEFAULT NULL COMMENT 'random_batches',
  `attr_reroll_selected_batch` int(11) DEFAULT NULL,
  `attr_reroll_selected_index` int(11) DEFAULT NULL COMMENT '0-2',
  `morale` int(11) NOT NULL DEFAULT '70' COMMENT '0-120=70+trait_modifier',
  `current_position_id` varchar(50) DEFAULT NULL COMMENT 'å½“å‰å®˜èŒID',
  `current_position_name` varchar(50) DEFAULT NULL COMMENT 'å½“å‰å®˜èŒåç§°',
  `position_level` int(11) DEFAULT '1' COMMENT 'å®˜èŒç­‰çº§',
  `items` json DEFAULT NULL COMMENT 'key=IDvalue=0key',
  `bonus_backpack_capacity` int(11) DEFAULT '0',
  `bonus_daily_events` int(11) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  `last_login_at` datetime DEFAULT NULL COMMENT 'æœ€åŽç™»å½•æ—¶é—´',
  `last_active_at` datetime DEFAULT NULL COMMENT 'æœ€åŽæ´»è·ƒæ—¶é—´',
  PRIMARY KEY (`player_id`),
  UNIQUE KEY `character_name` (`character_name`),
  KEY `idx_character_name` (`character_name`),
  KEY `idx_faction` (`faction_id`),
  KEY `idx_reputation` (`reputation`),
  KEY `idx_position` (`current_position_id`),
  CONSTRAINT `players_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='çŽ©å®¶è§’è‰²è¡¨ï¼ˆä¸€ä¸ªè´¦å·ä¸€ä¸ªè§’è‰²ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `raids`
--

DROP TABLE IF EXISTS `raids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `raids` (
  `raid_id` varchar(50) NOT NULL COMMENT 'è®¨ä¼IDï¼ˆå¦‚ï¼šsan_1_raid_0001ï¼‰',
  `raid_name` varchar(100) NOT NULL COMMENT 'è®¨ä¼åç§°ï¼ˆå¦‚ï¼šæµå¯‡å†›å›¢è®¨ä¼ï¼‰',
  `raid_type` enum('BANDIT','BARBARIAN','ALLIANCE') NOT NULL COMMENT 'è®¨ä¼ç±»åž‹',
  `ai_faction_id` varchar(50) NOT NULL COMMENT 'AIåŠ¿åŠ›ID',
  `ai_faction_name` varchar(50) NOT NULL COMMENT 'AIåŠ¿åŠ›åç§°',
  `ai_leader_name` varchar(50) DEFAULT NULL COMMENT 'AIé¦–é¢†åç§°',
  `ai_description` text COMMENT 'AIåŠ¿åŠ›æè¿°',
  `main_camp_hp` int(11) NOT NULL COMMENT 'ä¸»è¥åœ°HP',
  `main_camp_max_hp` int(11) NOT NULL COMMENT 'ä¸»è¥åœ°æœ€å¤§HP',
  `main_camp_status` enum('active','destroyed') DEFAULT 'active' COMMENT 'ä¸»è¥åœ°çŠ¶æ€',
  `sub_camps` json DEFAULT NULL COMMENT 'å‰¯è¥åœ°åˆ—è¡¨',
  `total_participants` int(11) DEFAULT '0' COMMENT 'æ€»å‚ä¸Žäººæ•°',
  `total_battles` int(11) DEFAULT '0' COMMENT 'æ€»æˆ˜æ–—æ¬¡æ•°',
  `total_damage` bigint(20) DEFAULT '0' COMMENT 'æ€»ä¼¤å®³è¾“å‡º',
  `total_kills` int(11) DEFAULT '0' COMMENT 'æ€»å‡»æ€æ•°',
  `player_rankings` json DEFAULT NULL COMMENT 'çŽ©å®¶æŽ’åï¼ˆå‰100åï¼‰',
  `faction_rankings` json DEFAULT NULL COMMENT 'åŠ¿åŠ›æŽ’åï¼ˆå‰10åï¼‰',
  `status` enum('pending','active','completed','failed') DEFAULT 'pending' COMMENT 'è®¨ä¼çŠ¶æ€',
  `start_time` datetime DEFAULT NULL COMMENT 'å¼€å§‹æ—¶é—´',
  `end_time` datetime DEFAULT NULL COMMENT 'ç»“æŸæ—¶é—´',
  `duration` bigint(20) DEFAULT '604800000' COMMENT 'æŒç»­æ—¶é—´ï¼ˆæ¯«ç§’ï¼Œé»˜è®¤7å¤©ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`raid_id`),
  KEY `idx_status` (`status`),
  KEY `idx_raid_type` (`raid_type`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='è®¨ä¼è¡¨ï¼ˆå…¨æœVS AIï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `season_inheritances`
--

DROP TABLE IF EXISTS `season_inheritances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `season_inheritances` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `season_id` varchar(50) NOT NULL COMMENT 'æ¥æºèµ›å­£IDï¼ˆå¦‚ï¼šsan_1=é»„å·¾ä¹‹ä¹±, san_2=è‘£å“ä¹‹ä¹±ï¼‰',
  `inherited_equipment_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„è£…å¤‡å¡åˆ—è¡¨ï¼ˆé€’å¢žå¼ï¼šç¬¬1èµ›å­£=1å¥—, ç¬¬2èµ›å­£=2å¥—, ..., ç¬¬10èµ›å­£+=10å¥—ï¼‰',
  `inherited_troop_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„éƒ¨é˜Ÿå¡åˆ—è¡¨ï¼ˆæ©™Ã—10+ç´«Ã—10ï¼‰',
  `inherited_title_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„ç§°å·å¡åˆ—è¡¨ï¼ˆå…¨éƒ¨ï¼‰',
  `inherited_achievement_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„æˆå°±å¡åˆ—è¡¨ï¼ˆå…¨éƒ¨ï¼‰',
  `inherited_treasure_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„å®ç‰©å¡åˆ—è¡¨ï¼ˆå…¨éƒ¨ï¼‰',
  `inherited_golden_troop_cards` json DEFAULT NULL COMMENT 'ç»§æ‰¿çš„é‡‘è‰²éƒ¨é˜Ÿå¡åˆ—è¡¨ï¼ˆå…¨éƒ¨ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´ï¼ˆèµ›å­£ç»“ç®—æ—¶ï¼‰',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`),
  KEY `idx_season` (`season_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='èµ›å­£ç»§æ‰¿è¡¨ï¼ˆè·¨æœåŠ¡å™¨ï¼Œå…¨å±€æœ‰æ•ˆï¼Œæ¯ä¸ªçŽ©å®¶åªæœ‰ä¸€æ¡è®°å½•ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `season_records`
--

DROP TABLE IF EXISTS `season_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `season_records` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `season_id` varchar(50) NOT NULL COMMENT 'èµ›å­£IDï¼ˆå¦‚ï¼šsan_1=é»„å·¾ä¹‹ä¹±, san_2=è‘£å“ä¹‹ä¹±ï¼‰',
  `server_id` varchar(50) NOT NULL COMMENT 'æœåŠ¡å™¨ID',
  `final_reputation` int(11) DEFAULT NULL COMMENT 'æœ€ç»ˆå£°æœ›',
  `final_position` varchar(50) DEFAULT NULL COMMENT 'æœ€ç»ˆå®˜èŒ',
  `final_rank` int(11) DEFAULT NULL COMMENT 'æœ€ç»ˆæŽ’å',
  `total_battles` int(11) DEFAULT '0' COMMENT 'æ€»æˆ˜æ–—æ¬¡æ•°',
  `wins` int(11) DEFAULT '0' COMMENT 'èƒœåˆ©æ¬¡æ•°',
  `losses` int(11) DEFAULT '0' COMMENT 'å¤±è´¥æ¬¡æ•°',
  `draws` int(11) DEFAULT '0' COMMENT 'å¹³å±€æ¬¡æ•°',
  `win_rate` decimal(5,2) DEFAULT '0.00' COMMENT 'èƒœçŽ‡',
  `season_comment` varchar(200) DEFAULT NULL COMMENT 'èµ›å­£ä¸€å¥è¯è¯„è¿°ï¼ˆæ ¹æ®è¡¨çŽ°è‡ªåŠ¨ç”Ÿæˆï¼‰',
  `settled_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'ç»“ç®—æ—¶é—´',
  PRIMARY KEY (`player_id`,`season_id`,`server_id`),
  KEY `idx_player_season` (`player_id`,`season_id`),
  KEY `idx_season` (`season_id`),
  KEY `idx_server` (`server_id`),
  KEY `idx_final_rank` (`final_rank`),
  CONSTRAINT `season_records_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='èµ›å­£ç»Ÿè®¡è¡¨ï¼ˆç”¨äºŽåŽ†å²æˆç»©å±•ç¤ºï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `statistics`
--

DROP TABLE IF EXISTS `statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `statistics` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `total_battles` int(11) DEFAULT '0' COMMENT 'æ€»æˆ˜æ–—æ¬¡æ•°',
  `wins` int(11) DEFAULT '0' COMMENT 'èƒœåˆ©æ¬¡æ•°',
  `losses` int(11) DEFAULT '0' COMMENT 'å¤±è´¥æ¬¡æ•°',
  `draws` int(11) DEFAULT '0' COMMENT 'å¹³å±€æ¬¡æ•°',
  `win_rate` decimal(5,2) DEFAULT '0.00' COMMENT 'èƒœçŽ‡',
  `total_damage_dealt` bigint(20) DEFAULT '0' COMMENT 'æ€»æ€ä¼¤å…µåŠ›ï¼ˆé€ æˆçš„æ•Œå†›æŸå¤±ï¼‰',
  `total_damage_taken` bigint(20) DEFAULT '0' COMMENT 'æ€»è‡ªæŸå…µåŠ›ï¼ˆå·±æ–¹å…µåŠ›æŸå¤±ï¼‰',
  `total_kills` int(11) DEFAULT '0' COMMENT 'æ€»å‡»æ€æ•°ï¼ˆæ¶ˆç­çš„æ•Œå†›éƒ¨é˜Ÿæ•°ï¼‰',
  `total_battle_score` bigint(20) DEFAULT '0',
  `total_events_completed` int(11) DEFAULT '0',
  `total_playtime` int(11) DEFAULT '0' COMMENT 'æ€»æ¸¸æˆæ—¶é•¿',
  `today_playtime` int(11) DEFAULT '0' COMMENT 'ä»Šæ—¥æ¸¸æˆæ—¶é•¿',
  `week_playtime` int(11) DEFAULT '0' COMMENT 'æœ¬å‘¨æ¸¸æˆæ—¶é•¿',
  `month_playtime` int(11) DEFAULT '0' COMMENT 'æœ¬æœˆæ¸¸æˆæ—¶é•¿',
  `total_gold_earned` bigint(20) DEFAULT '0' COMMENT 'æ€»èŽ·å¾—é“¶ä¸¤',
  `total_gold_spent` bigint(20) DEFAULT '0' COMMENT 'æ€»æ¶ˆè€—é“¶ä¸¤',
  `total_food_earned` bigint(20) DEFAULT '0' COMMENT 'æ€»èŽ·å¾—ç²®è‰',
  `total_food_spent` bigint(20) DEFAULT '0' COMMENT 'æ€»æ¶ˆè€—ç²®è‰',
  `total_contribution_earned` bigint(20) DEFAULT '0' COMMENT 'æ€»èŽ·å¾—è´¡çŒ®å€¼',
  `total_contribution_spent` bigint(20) DEFAULT '0' COMMENT 'æ€»æ¶ˆè€—è´¡çŒ®å€¼',
  `total_reputation_earned` bigint(20) DEFAULT '0' COMMENT 'æ€»èŽ·å¾—å£°æœ›ï¼ˆç´¯è®¡å€¼ï¼Œç”¨äºŽç»Ÿè®¡ï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  PRIMARY KEY (`player_id`),
  CONSTRAINT `statistics_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ç»Ÿè®¡æ•°æ®è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `temp_card_pool_draws`
--

DROP TABLE IF EXISTS `temp_card_pool_draws`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_card_pool_draws` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶ID',
  `pool_type` enum('troop','character') NOT NULL COMMENT 'å¡æ± ç±»åž‹ï¼ˆtroop=éƒ¨é˜Ÿå¡æ± , character=å°†é¢†å¡æ± ï¼‰',
  `rarity` enum('common','rare','epic','legendary') NOT NULL COMMENT 'æŠ½åˆ°çš„ç¨€æœ‰åº¦',
  `card_id` varchar(50) DEFAULT NULL COMMENT 'æŠ½åˆ°çš„å¡ç‰Œé…ç½®ID',
  `compensated` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'æ˜¯å¦è½¬ä¸ºè¡¥å¿ï¼ˆé‡å¤å°†é¢†/éƒ¨é˜Ÿè¶…é™ï¼‰',
  `pity_count` int(11) NOT NULL DEFAULT '0' COMMENT 'æœ¬æ¬¡æŠ½å–åŽçš„ä¿åº•è®¡æ•°ï¼ˆlegendaryæ—¶é‡ç½®ä¸º0ï¼‰',
  `drawn_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'æŠ½å–æ—¶é—´',
  `expires_at` datetime NOT NULL COMMENT 'è¿‡æœŸæ—¶é—´ï¼ˆdrawn_at + 14å¤©ï¼‰',
  PRIMARY KEY (`id`),
  KEY `idx_player_pool_date` (`player_id`,`pool_type`,`drawn_at`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `temp_card_pool_draws_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2412 DEFAULT CHARSET=utf8mb4 COMMENT='å¡æ± æŠ½å–è®°å½•è¡¨ï¼ˆä¸´æ—¶æ•°æ®ï¼Œ14å¤©è¿‡æœŸï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `temp_character_creation`
--

DROP TABLE IF EXISTS `temp_character_creation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_character_creation` (
  `player_id` varchar(4) NOT NULL COMMENT 'çŽ©å®¶IDï¼ˆè´¦å·IDï¼‰',
  `current_step` int(11) DEFAULT '1' COMMENT 'å½“å‰æ­¥éª¤ï¼ˆ1=åŠ¿åŠ›, 2=å½¢è±¡, 3=åå­—, 4=å±žæ€§, 5=éƒ¨é˜Ÿï¼‰',
  `selected_faction_id` varchar(50) DEFAULT NULL COMMENT 'é€‰æ‹©çš„åŠ¿åŠ›ID',
  `selected_faction_name` varchar(50) DEFAULT NULL COMMENT 'é€‰æ‹©çš„åŠ¿åŠ›åç§°',
  `selected_avatar` varchar(255) DEFAULT NULL COMMENT 'é€‰æ‹©çš„å¤´åƒè·¯å¾„',
  `character_name` varchar(50) DEFAULT NULL COMMENT 'è§’è‰²å',
  `remaining_silver` int(11) DEFAULT '50' COMMENT 'å‰©ä½™é“¶ä¸¤ï¼ˆåˆå§‹50ï¼‰',
  `random_cost` int(11) DEFAULT '10' COMMENT 'æ¯æ¬¡éšæœºè´¹ç”¨ï¼ˆå›ºå®š10ï¼‰',
  `current_batch` int(11) DEFAULT '1' COMMENT 'å½“å‰æŸ¥çœ‹çš„æ‰¹æ¬¡å·',
  `random_batches` json DEFAULT NULL COMMENT 'æ‰€æœ‰éšæœºæ‰¹æ¬¡åŽ†å²',
  `selected_option_batch` int(11) DEFAULT NULL COMMENT 'é€‰ä¸­æ–¹æ¡ˆçš„æ‰¹æ¬¡å·',
  `selected_option_index` int(11) DEFAULT NULL COMMENT 'é€‰ä¸­æ–¹æ¡ˆåœ¨æ‰¹æ¬¡ä¸­çš„ç´¢å¼•ï¼ˆ0-2ï¼‰',
  `selected_troops` json DEFAULT NULL COMMENT 'é€‰æ‹©çš„åˆå§‹éƒ¨é˜Ÿï¼ˆtroop_idæ•°ç»„ï¼Œæœ€å¤š2ä¸ªï¼‰',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'åˆ›å»ºæ—¶é—´',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'æ›´æ–°æ—¶é—´',
  `expires_at` datetime DEFAULT NULL COMMENT 'è¿‡æœŸæ—¶é—´ï¼ˆåˆ›å»ºåŽ7å¤©ï¼‰',
  PRIMARY KEY (`player_id`),
  KEY `idx_expires` (`expires_at`),
  CONSTRAINT `temp_character_creation_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='è§’è‰²åˆ›å»ºè¿›åº¦è¡¨ï¼ˆä¸´æ—¶æ•°æ®ï¼Œè§’è‰²åˆ›å»ºå®ŒæˆåŽåˆ é™¤ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `temp_character_ranking_snapshots`
--

DROP TABLE IF EXISTS `temp_character_ranking_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_character_ranking_snapshots` (
  `player_id` varchar(8) NOT NULL COMMENT ' ID',
  `server_id` varchar(64) NOT NULL COMMENT 'accounts.serverId',
  `bucket` varchar(48) NOT NULL COMMENT ' main:playergarrison:2:char1',
  `ranking_score` decimal(18,8) NOT NULL,
  `luck` decimal(14,6) NOT NULL,
  `combat` decimal(14,6) NOT NULL,
  `courage` decimal(14,6) NOT NULL,
  `command` decimal(14,6) NOT NULL,
  `intelligence` decimal(14,6) NOT NULL,
  `politics` decimal(14,6) NOT NULL,
  `charm` decimal(14,6) NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '14',
  PRIMARY KEY (`player_id`,`bucket`),
  KEY `idx_srv_bucket` (`server_id`,`bucket`),
  KEY `idx_srv_bucket_ranking_score` (`server_id`,`bucket`,`ranking_score`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='14';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `temp_ranking_snapshots`
--

DROP TABLE IF EXISTS `temp_ranking_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_ranking_snapshots` (
  `player_id` varchar(4) NOT NULL COMMENT 'ID',
  `event_id` varchar(50) NOT NULL COMMENT '/ID',
  `snapshot_battle_score` bigint(20) DEFAULT '0',
  `snapshot_events_completed` int(11) DEFAULT '0',
  `snapshot_reputation` bigint(20) DEFAULT '0',
  `snapshot_contribution` bigint(20) DEFAULT '0',
  `snapshot_silver` bigint(20) DEFAULT '0',
  `snapshot_food` bigint(20) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `frozen_at` datetime DEFAULT NULL COMMENT 'set when scores frozen',
  `frozen_delta_battle` int(11) DEFAULT NULL,
  `frozen_delta_events` int(11) DEFAULT NULL,
  `frozen_delta_rep_contrib` int(11) DEFAULT NULL,
  `frozen_delta_silver_food` int(11) DEFAULT NULL,
  PRIMARY KEY (`player_id`,`event_id`),
  KEY `idx_event` (`event_id`),
  CONSTRAINT `temp_ranking_snapshots_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='+7';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `texts`
--

DROP TABLE IF EXISTS `texts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `texts` (
  `text_id` varchar(50) NOT NULL COMMENT 'ID',
  `type` enum('player','legion','system','reward') NOT NULL,
  `sender_id` varchar(4) NOT NULL COMMENT 'ID',
  `sender_name` varchar(50) NOT NULL,
  `sender_position` varchar(50) DEFAULT NULL,
  `receiver_id` varchar(4) DEFAULT NULL COMMENT 'ID',
  `target_legion_id` varchar(50) DEFAULT NULL COMMENT 'ID',
  `subject` varchar(100) NOT NULL,
  `content` varchar(1000) NOT NULL,
  `attachments` json DEFAULT NULL,
  `is_claimed` tinyint(1) DEFAULT '0',
  `claimed_at` datetime DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`text_id`),
  KEY `idx_receiver` (`receiver_id`,`is_read`,`is_deleted`,`created_at`),
  KEY `idx_sender` (`sender_id`,`created_at`),
  KEY `idx_legion` (`target_legion_id`,`created_at`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_type` (`type`),
  CONSTRAINT `fk_texts_receiver_players` FOREIGN KEY (`receiver_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_texts_sender_players` FOREIGN KEY (`sender_id`) REFERENCES `players` (`player_id`) ON DELETE CASCADE,
  CONSTRAINT `texts_ibfk_3` FOREIGN KEY (`target_legion_id`) REFERENCES `legions` (`legion_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `wars`
--

DROP TABLE IF EXISTS `wars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `wars` (
  `war_id` varchar(50) NOT NULL,
  `war_name` varchar(100) NOT NULL,
  `war_type` enum('siege','defense','field') NOT NULL,
  `target_city_id` varchar(50) NOT NULL,
  `target_city_name` varchar(50) NOT NULL,
  `faction_kills` json DEFAULT NULL,
  `status` enum('active','completed') DEFAULT 'active',
  `winner_faction_id` varchar(50) DEFAULT NULL,
  `npc_total` int(11) DEFAULT '0',
  `npc_killed` int(11) DEFAULT '0',
  `start_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `end_time` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`war_id`),
  KEY `idx_target_city` (`target_city_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-04  1:58:51
