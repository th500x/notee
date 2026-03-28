/**
 * 玩家路由
 * 
 * @description 处理玩家角色相关的API请求
 */

const express = require('express');
const Player = require('../models/Player');
const PlayerService = require('../services/playerService');
const { pool } = require('../database/connection');
const { formatTroopData } = require('../services/configService');
const { calculateFortune, executeRewards, FORTUNE_MULTIPLIERS } = require('../services/rewardService');

const router = express.Router();

// ── 卡牌特效 → 部队卡加成 通用机制 ──────────────────────────

/** special_effect 字段映射 → player_cards bonus 字段 */
const EFFECT_FIELD_MAP = {
  'max_troops_bonus': 'bonus_max_troops',
  'attack_bonus': 'bonus_attack',
  'defense_bonus': 'bonus_defense',
  'speed_bonus': 'bonus_speed',
  'movement_bonus': 'bonus_movement',
};

/** 解析 special_effect 字符串为 bonus 对象 */
function parseSpecialEffect(effectStr) {
  if (!effectStr) return {};
  const bonus = {};
  effectStr.split(';').forEach(part => {
    const [key, val] = part.trim().split(':');
    if (!key || !val) return;
    const field = EFFECT_FIELD_MAP[key];
    if (field) bonus[field] = parseInt(val) || 0;
  });
  return bonus;
}

/** 根据 card_type 和 card_id 查询配置表获取 special_effect */
async function getCardSpecialEffect(pool, cardType, cardId) {
  const tableMap = {
    'title': { table: 'config_titles', idField: 'title_id' },
    'achievement': { table: 'config_achievements', idField: 'achievement_id' },
    // 未来扩展：treasure、equipmentSet 等
  };
  const cfg = tableMap[cardType];
  if (!cfg) return {};
  const [rows] = await pool.query(
    `SELECT special_effect FROM ${cfg.table} WHERE ${cfg.idField} = ?`, [cardId]
  );
  return parseSpecialEffect(rows[0]?.special_effect);
}

/** 装备卡牌时：将特效加成写入同一 equippedBy 下的所有部队卡 */
async function applyCardBonusToTroops(pool, playerId, equippedBy, cardType, cardId) {
  const bonus = await getCardSpecialEffect(pool, cardType, cardId);
  if (Object.keys(bonus).length === 0) return;

  const sets = Object.entries(bonus).map(([field, val]) => `${field} = ${field} + ${val}`).join(', ');
  await pool.query(
    `UPDATE player_cards SET ${sets}
     WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
    [playerId, equippedBy]
  );
  // 如果有兵力上限加成，部队卡会产生缺口，写入恢复起始时间
  if (bonus.bonus_max_troops) {
    await pool.query(
      `UPDATE player_cards SET last_troops_lost_at = NOW()
       WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE
       AND last_troops_lost_at IS NULL`,
      [playerId, equippedBy]
    );
  }
  console.log(`[CardBonus] 应用特效: ${cardType}/${cardId} → ${equippedBy} 部队卡 (${JSON.stringify(bonus)})`);
}

/** 需要触发特效的卡牌类型 */
const EFFECT_CARD_TYPES = ['title', 'achievement', 'treasure'];

/**
 * GET /api/players/avatars
 * 获取可用头像列表（按分类分组）
 */
router.get('/avatars', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // 头像目录路径
    const avatarDir = path.join(__dirname, '../../public/assets/san_1_ui_card/avatar');
    
    if (!fs.existsSync(avatarDir)) {
      return res.json({
        success: true,
        data: { categories: [] }
      });
    }
    
    // 分类中文名映射
    const categoryLabels = {
      '01_elder_male_scholar': '白须儒雅',
      '02_elder_male_warrior': '白须老将',
      '03_elder_female_noble': '年上贵妇',
      '04_elder_female_folk': '年上内助',
      '05_mid_male_scholar': '中年谋士',
      '06_mid_male_warrior': '中年将军',
      '07_mid_female_noble': '人妻少妇',
      '08_mid_female_warrior': '人妻女将',
      '09_young_male_scholar': '青年书生',
      '10_young_male_warrior': '青年将官',
      '11_young_female_scholar': '青年才女',
      '12_young_female_warrior': '青年女侠'
    };
    
    // 读取子目录
    const dirs = fs.readdirSync(avatarDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const categories = dirs.map(dir => {
      const dirPath = path.join(avatarDir, dir.name);
      const files = fs.readdirSync(dirPath)
        .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .sort();
      
      return {
        id: dir.name,
        label: categoryLabels[dir.name] || dir.name,
        avatars: files.map(f => `assets/san_1_ui_card/avatar/${dir.name}/${f}`)
      };
    }).filter(c => c.avatars.length > 0);
    
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('[Players] 获取头像列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取头像列表失败',
      message: error.message
    });
  }
});

/**
 * GET /api/players/check/:playerId
 * 检查玩家是否存在
 */
router.get('/check/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const exists = await Player.exists(playerId);

    res.json({
      success: true,
      data: { exists }
    });

  } catch (error) {
    console.error('[Players] 检查玩家失败:', error);
    res.status(500).json({
      success: false,
      error: '检查玩家失败',
      message: error.message
    });
  }
});

/**
 * GET /api/players/:playerId
 * 获取玩家信息
 */
router.get('/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.getById(playerId);

    if (!player) {
      return res.status(404).json({
        success: false,
        error: '玩家不存在'
      });
    }

    // 附加 tutorial_step
    const [progressRows] = await pool.query(
      'SELECT tutorial_current_step FROM player_progress WHERE player_id = ?',
      [playerId]
    );
    player.tutorial_step = progressRows[0]?.tutorial_current_step ?? 1;

    res.json({
      success: true,
      data: player
    });

  } catch (error) {
    console.error('[Players] 获取玩家信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取玩家信息失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/generate-attributes
 * 生成属性方案（9选1）
 */
router.post('/generate-attributes', async (req, res) => {
  try {
    const { rarity = 'common' } = req.body;

    const options = await PlayerService.generateAttributeOptions(rarity);

    res.json({
      success: true,
      data: { options }
    });

  } catch (error) {
    console.error('[Players] 生成属性方案失败:', error);
    res.status(500).json({
      success: false,
      error: '生成属性方案失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/validate-name
 * 验证角色名
 */
router.post('/validate-name', async (req, res) => {
  try {
    const { characterName, serverId } = req.body;

    // 验证格式
    const validation = PlayerService.validateCharacterName(characterName);
    if (!validation.valid) {
      return res.json({
        success: true,
        data: { valid: false, error: validation.error }
      });
    }

    // 检查是否重名
    const nameTaken = await Player.isNameTaken(characterName, serverId);
    if (nameTaken) {
      return res.json({
        success: true,
        data: { valid: false, error: '该角色名已被使用，请重新输入' }
      });
    }

    res.json({
      success: true,
      data: { valid: true }
    });

  } catch (error) {
    console.error('[Players] 验证角色名失败:', error);
    res.status(500).json({
      success: false,
      error: '验证角色名失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/create
 * 创建玩家角色
 */
router.post('/create', async (req, res) => {
  try {
    const {
      playerId,
      characterName,
      factionId,
      factionName,
      attributes, // 整数版本（×10）
      skills, // 技能 {skill_1, skill_2}
      initialTroops, // 初始部队卡ID数组
      serverId,
      initialSilver, // 剩余银两（从角色创建带入游戏）
      avatar // 头像路径
    } = req.body;

    // 数据验证
    if (!playerId || !characterName || !factionId || !factionName || !attributes || !serverId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }

    // 创建角色
    const player = await PlayerService.createCharacter({
      playerId,
      characterName,
      factionId,
      factionName,
      attributes,
      skills: skills || null,
      serverId,
      initialSilver: initialSilver || 0, // 默认0银两
      avatar: avatar || null
    });

    // 添加初始部队卡
    if (initialTroops && initialTroops.length > 0) {
      await PlayerService.addInitialTroops(playerId, initialTroops);
    }

    res.json({
      success: true,
      message: '角色创建成功',
      data: player
    });

  } catch (error) {
    console.error('[Players] 创建角色失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建角色失败'
    });
  }
});

/**
 * GET /api/players/:playerId/factions/available
 * 获取可用势力列表
 */
router.get('/:playerId/factions/available', async (req, res) => {
  try {
    const { playerId } = req.params;
    console.log('[Factions] 获取可用势力列表, playerId:', playerId);

    // 获取账号信息以确定赛季
    const [accounts] = await pool.query(
      'SELECT current_season, serverId FROM accounts WHERE id = ?',
      [playerId]
    );
    console.log('[Factions] 查询账号结果:', accounts);

    if (accounts.length === 0) {
      console.log('[Factions] 账号不存在');
      return res.status(404).json({
        success: false,
        error: '账号不存在'
      });
    }

    const { current_season, serverId } = accounts[0];
    console.log('[Factions] 账号信息 - 赛季:', current_season, '服务器:', serverId);

    // 如果是测试赛季 san_0_m1，使用 san_1 的势力数据
    const targetSeason = current_season === 'san_0_m1' ? 'san_1' : current_season;
    console.log('[Factions] 目标赛季:', targetSeason);

    // 查询可用势力
    const [factions] = await pool.query(`
      SELECT 
        f.faction_id, f.faction_name, f.faction_leader, f.icon, f.color,
        f.style, f.max_players, f.faction_bonuses, f.description, f.difficulty,
        c.character_name as leader_name
      FROM config_factions f
      LEFT JOIN config_characters c ON f.faction_leader = c.character_id
      WHERE f.season = ?
      ORDER BY f.faction_id ASC
    `, [targetSeason]);
    console.log('[Factions] 查询到势力数量:', factions.length);
    // 调试：打印第一个势力的完整数据
    if (factions.length > 0) {
      console.log('[Factions] 第一个势力完整数据:', JSON.stringify(factions[0], null, 2));
      console.log('[Factions] faction_bonuses 类型:', typeof factions[0].faction_bonuses);
      console.log('[Factions] description:', factions[0].description);
      console.log('[Factions] style:', factions[0].style);
      console.log('[Factions] difficulty:', factions[0].difficulty);
    }

    // 查询每个势力的当前玩家数，推导 recommended
    for (const faction of factions) {
      const [counts] = await pool.query(`
        SELECT COUNT(*) as player_count
        FROM players p
        JOIN accounts a ON p.player_id = a.id
        WHERE p.faction_id = ? AND a.serverId = ?
      `, [faction.faction_id, serverId]);

      faction.current_players = counts[0].player_count;
      faction.is_full = faction.current_players >= faction.max_players;
      faction.recommended = faction.difficulty === '简单';
    }

    console.log('[Factions] 返回势力列表');
    res.json({
      success: true,
      data: { factions }
    });

  } catch (error) {
    console.error('[Players] 获取可用势力失败:', error);
    res.status(500).json({
      success: false,
      error: '获取可用势力失败',
      message: error.message
    });
  }
});

/**
 * GET /api/players/:playerId/troops/initial
 * 获取初始部队选项
 */
router.get('/:playerId/troops/initial', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { factionId } = req.query;

    if (!factionId) {
      return res.status(400).json({
        success: false,
        error: '缺少势力ID'
      });
    }

    // 获取赛季ID
    const season = factionId.split('_').slice(0, 2).join('_');

    // 查询当前势力的rare部队卡
    // 势力部队ID格式：san_1_troop_1xxx（刘备）、san_1_troop_2xxx（曹操）等
    const factionNumber = factionId.split('_')[3]; // 从 san_1_faction_1001 提取 1001，取第一位 1
    const factionTroopPrefix = `${season}_troop_${factionNumber.charAt(0)}`;
    
    const [factionTroops] = await pool.query(`
      SELECT * FROM config_troops
      WHERE season = ? 
        AND rarity = 'rare'
        AND troop_id LIKE ?
      ORDER BY troop_id ASC
    `, [season, `${factionTroopPrefix}%`]);

    // 查询通用势力的rare部队卡
    // 通用部队ID格式：san_1_troop_0xxx
    const [commonTroops] = await pool.query(`
      SELECT * FROM config_troops
      WHERE season = ? 
        AND rarity = 'rare'
        AND troop_id LIKE ?
      ORDER BY troop_id ASC
    `, [season, `${season}_troop_0%`]);

    // 合并并返回
    const troops = [...factionTroops, ...commonTroops];

    // 解析special_ability JSON，使用统一的formatTroopData转换为camelCase
    const processedTroops = troops.map(troop => {
      const formatted = formatTroopData(troop);
      // 添加faction字段（从troop_id推断）
      formatted.faction = getFactionFromTroopId(troop.troop_id);
      return formatted;
    });

    res.json({
      success: true,
      data: { troops: processedTroops }
    });

  } catch (error) {
    console.error('[Players] 获取初始部队选项失败:', error);
    res.status(500).json({
      success: false,
      error: '获取初始部队选项失败',
      message: error.message
    });
  }
});

/**
 * GET /api/players/:playerId/creation-progress
 * 获取角色创建进度
 */
router.get('/:playerId/creation-progress', async (req, res) => {
  try {
    const { playerId } = req.params;

    const [rows] = await pool.query(
      'SELECT * FROM temp_character_creation WHERE player_id = ?',
      [playerId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null // 没有进度记录
      });
    }

    const progress = rows[0];
    
    // 解析JSON字段（mysql2可能已自动解析JSON类型字段）
    if (progress.random_batches && typeof progress.random_batches === 'string') {
      progress.random_batches = JSON.parse(progress.random_batches);
    }
    if (progress.selected_troops && typeof progress.selected_troops === 'string') {
      progress.selected_troops = JSON.parse(progress.selected_troops);
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('[Players] 获取角色创建进度失败:', error);
    res.status(500).json({
      success: false,
      error: '获取角色创建进度失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/:playerId/creation-progress
 * 保存角色创建进度
 */
router.post('/:playerId/creation-progress', async (req, res) => {
  try {
    const { playerId } = req.params;
    const progressData = req.body;

    // 设置过期时间（7天后）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 准备数据
    const data = {
      player_id: playerId,
      current_step: progressData.current_step || 1,
      selected_faction_id: progressData.selected_faction_id || null,
      selected_faction_name: progressData.selected_faction_name || null,
      selected_avatar: progressData.selected_avatar || null,
      character_name: progressData.character_name || null,
      remaining_silver: progressData.remaining_silver !== undefined ? progressData.remaining_silver : 50,
      random_cost: progressData.random_cost || 10,
      current_batch: progressData.current_batch || 1,
      random_batches: progressData.random_batches ? JSON.stringify(progressData.random_batches) : null,
      selected_option_batch: progressData.selected_option_batch || null,
      selected_option_index: progressData.selected_option_index || null,
      selected_troops: progressData.selected_troops ? JSON.stringify(progressData.selected_troops) : null,
      expires_at: expiresAt
    };

    // 使用 INSERT ... ON DUPLICATE KEY UPDATE
    await pool.query(`
      INSERT INTO temp_character_creation SET ?
      ON DUPLICATE KEY UPDATE
        current_step = VALUES(current_step),
        selected_faction_id = VALUES(selected_faction_id),
        selected_faction_name = VALUES(selected_faction_name),
        selected_avatar = VALUES(selected_avatar),
        character_name = VALUES(character_name),
        remaining_silver = VALUES(remaining_silver),
        random_cost = VALUES(random_cost),
        current_batch = VALUES(current_batch),
        random_batches = VALUES(random_batches),
        selected_option_batch = VALUES(selected_option_batch),
        selected_option_index = VALUES(selected_option_index),
        selected_troops = VALUES(selected_troops),
        updated_at = CURRENT_TIMESTAMP
    `, [data]);

    res.json({
      success: true,
      message: '进度已保存'
    });

  } catch (error) {
    console.error('[Players] 保存角色创建进度失败:', error);
    res.status(500).json({
      success: false,
      error: '保存角色创建进度失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/:playerId/generate-attributes-batch
 * 生成属性方案（新批次）
 */
router.post('/:playerId/generate-attributes-batch', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { rarity = 'common' } = req.body;

    // 获取当前进度
    const [rows] = await pool.query(
      'SELECT remaining_silver, random_cost, random_batches FROM temp_character_creation WHERE player_id = ?',
      [playerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '未找到角色创建进度'
      });
    }

    const { remaining_silver, random_cost, random_batches } = rows[0];
    const batches = random_batches 
      ? (typeof random_batches === 'string' ? JSON.parse(random_batches) : random_batches) 
      : [];
    const batchNumber = batches.length + 1;
    const cost = batchNumber === 1 ? 0 : random_cost; // 第一批免费

    // 检查银两是否足够
    if (remaining_silver < cost) {
      return res.status(400).json({
        success: false,
        error: `银两不足，需要${cost}银两才能重新随机`
      });
    }

    // 生成3个属性方案
    const options = await PlayerService.generateAttributeOptions(rarity);

    // 创建新批次
    const newBatch = {
      batch: batchNumber,
      timestamp: new Date().toISOString(),
      cost: cost,
      options: options
    };

    // 添加到批次数组
    batches.push(newBatch);

    // 扣除银两
    const newRemainingSilver = remaining_silver - cost;

    // 更新数据库
    await pool.query(`
      UPDATE temp_character_creation
      SET 
        remaining_silver = ?,
        current_batch = ?,
        random_batches = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `, [newRemainingSilver, batchNumber, JSON.stringify(batches), playerId]);

    res.json({
      success: true,
      data: {
        batch: batchNumber,
        timestamp: newBatch.timestamp,
        cost: cost,
        options: options,
        remaining_silver: newRemainingSilver
      }
    });

  } catch (error) {
    console.error('[Players] 生成属性批次失败:', error);
    res.status(500).json({
      success: false,
      error: '生成属性批次失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/:playerId/select-option
 * 选择属性方案
 */
router.post('/:playerId/select-option', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { batch, index } = req.body;

    if (batch === undefined || index === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少批次号或索引'
      });
    }

    // 更新选中的方案
    await pool.query(`
      UPDATE temp_character_creation
      SET 
        selected_option_batch = ?,
        selected_option_index = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `, [batch, index, playerId]);

    res.json({
      success: true,
      message: '方案已选择'
    });

  } catch (error) {
    console.error('[Players] 选择属性方案失败:', error);
    res.status(500).json({
      success: false,
      error: '选择属性方案失败',
      message: error.message
    });
  }
});

/**
 * DELETE /api/players/:playerId/creation-progress
 * 删除角色创建进度（角色创建完成后调用）
 */
router.delete('/:playerId/creation-progress', async (req, res) => {
  try {
    const { playerId } = req.params;

    await pool.query(
      'DELETE FROM temp_character_creation WHERE player_id = ?',
      [playerId]
    );

    res.json({
      success: true,
      message: '进度已删除'
    });

  } catch (error) {
    console.error('[Players] 删除角色创建进度失败:', error);
    res.status(500).json({
      success: false,
      error: '删除角色创建进度失败',
      message: error.message
    });
  }
});

// 辅助函数：从troop_id推断势力名称
function getFactionFromTroopId(troopId) {
  // troop_id格式：san_1_troop_1001
  // 第四部分的第一位数字代表势力：0=通用, 1=刘备, 2=曹操, 3=孙坚, 4=袁绍, 5=董卓, 6=汉室, 7=黄巾
  const parts = troopId.split('_');
  if (parts.length >= 4) {
    const factionCode = parts[3].charAt(0);
    const factionMap = {
      '0': '通用',
      '1': '刘备',
      '2': '曹操',
      '3': '孙坚',
      '4': '袁绍',
      '5': '董卓',
      '6': '汉室',
      '7': '黄巾'
    };
    return factionMap[factionCode] || '通用';
  }
  return '通用';
}

/**
 * GET /api/players/:playerId/profile
 * 获取玩家完整档案（基础信息 + 卡牌）
 * 用于GamePage状态栏和编组Tab
 */
router.get('/:playerId/profile', async (req, res) => {
  try {
    const { playerId } = req.params;

    // 1. 获取玩家基础信息
    const player = await Player.getById(playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        error: '玩家不存在'
      });
    }

    // 1.5 获取玩家进度（tutorial_current_step）
    const [progressRows] = await pool.query(
      'SELECT tutorial_current_step FROM player_progress WHERE player_id = ?',
      [playerId]
    );
    const tutorialStep = progressRows[0]?.tutorial_current_step ?? 1;

    // 1.6 获取官职完整配置（如果有官职）
    let positionConfig = null;
    if (player.current_position_id) {
      const [posRows] = await pool.query(
        `SELECT position_id, position_name, position_level, position_rank, rarity,
                icon, description, requirement, position_bonuses, permissions
         FROM config_positions WHERE position_id = ?`,
        [player.current_position_id]
      );
      if (posRows[0]) {
        const p = posRows[0];
        let bonuses = {};
        let perms = [];
        try { bonuses = typeof p.position_bonuses === 'string' ? JSON.parse(p.position_bonuses) : (p.position_bonuses || {}); } catch {}
        try { perms = typeof p.permissions === 'string' ? JSON.parse(p.permissions) : (p.permissions || []); } catch {}
        positionConfig = {
          id: p.position_id,
          name: p.position_name,
          level: p.position_level,
          rank: p.position_rank,
          rarity: p.rarity || 'common',
          icon: p.icon,
          description: p.description,
          requirement: p.requirement,
          permissions: perms,
          position_bonuses: {
            reputationBonus: bonuses.reputation || 0,
            contributionBonus: bonuses.contribution || 0,
            resourceBonus: bonuses.resource || 0,
            infantryBonus: bonuses.infantry || 0,
            cavalryBonus: bonuses.cavalry || 0,
            archerBonus: bonuses.archer || 0,
          },
        };
      }
    }

    // 2. 获取玩家所有卡牌（关联配置表读取固定属性）
    const [cards] = await pool.query(`
      SELECT 
        pc.instance_id,
        pc.card_type,
        pc.card_id,
        pc.rarity,
        pc.current_troops,
        pc.morale,
        pc.battle_count,
        pc.max_battle_count,
        pc.bonus_max_troops,
        pc.bonus_attack,
        pc.bonus_defense,
        pc.bonus_speed,
        pc.bonus_movement,
        pc.last_troops_lost_at,
        pc.is_equipped,
        pc.equipped_by,
        pc.equipped_slot,
        pc.obtained_at
      FROM player_cards pc
      WHERE pc.player_id = ?
      ORDER BY pc.is_equipped DESC, pc.card_type, pc.obtained_at
    `, [playerId]);

    // 2.5 自动结算部队卡兵力恢复（恢复速率：10兵/分钟，粮草消耗：恢复兵力/10）
    let playerFood = player.food || 0;
    for (const card of cards) {
      if (card.card_type !== 'troop' || !card.last_troops_lost_at) continue;
      // 查配置表获取 max_troops
      const [troopCfgRows] = await pool.query('SELECT max_troops FROM config_troops WHERE troop_id = ?', [card.card_id]);
      const cfgMaxTroops = troopCfgRows[0]?.max_troops || 0;
      const maxTroops = cfgMaxTroops + (card.bonus_max_troops || 0);
      const gap = maxTroops - (card.current_troops || 0);
      if (gap <= 0) {
        // 已满编，清除恢复状态
        await pool.query('UPDATE player_cards SET last_troops_lost_at = NULL WHERE instance_id = ?', [card.instance_id]);
        card.last_troops_lost_at = null;
        continue;
      }
      const elapsedMs = Date.now() - new Date(card.last_troops_lost_at).getTime();
      const elapsedMin = elapsedMs / 60000;
      const canRecover = Math.floor(elapsedMin * 10); // 每分钟恢复10兵
      if (canRecover <= 0) continue;
      const foodNeededForFull = Math.ceil(gap / 10);
      const foodAvailable = playerFood;
      const maxRecoverByFood = foodAvailable * 10;
      const actualRecover = Math.min(canRecover, gap, maxRecoverByFood);
      if (actualRecover <= 0) continue;
      const foodCost = Math.ceil(actualRecover / 10);
      // 更新数据库
      const newTroops = (card.current_troops || 0) + actualRecover;
      const isFull = newTroops >= maxTroops;
      await pool.query(
        `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ?`,
        [Math.min(newTroops, maxTroops), isFull ? null : card.last_troops_lost_at, card.instance_id]
      );
      await pool.query('UPDATE players SET food = food - ? WHERE player_id = ?', [foodCost, playerId]);
      // 更新内存中的值
      card.current_troops = Math.min(newTroops, maxTroops);
      if (isFull) card.last_troops_lost_at = null;
      playerFood -= foodCost;
      player.food = playerFood;
      console.log(`[TroopRecover] ${card.card_id}: +${actualRecover}兵 -${foodCost}粮 (${card.current_troops}/${maxTroops})`);
    }

    // 3. 为部队卡关联配置数据
    const troopCards = cards.filter(c => c.card_type === 'troop');
    let troopConfigs = {};
    if (troopCards.length > 0) {
      const troopIds = troopCards.map(c => c.card_id);
      const placeholders = troopIds.map(() => '?').join(',');
      const [configs] = await pool.query(`
        SELECT troop_id, troop_name, troop_type, weapon_type,
               rarity, attack, defense, speed, movement, \`range\`,
               max_troops, special_ability, description
        FROM config_troops
        WHERE troop_id IN (${placeholders})
      `, troopIds);
      configs.forEach(c => { troopConfigs[c.troop_id] = c; });
    }

    // 3b. 为装备件关联配置数据
    const equipCards = cards.filter(c => c.card_type === 'equipment');
    let equipConfigs = {};
    if (equipCards.length > 0) {
      const equipIds = equipCards.map(c => c.card_id);
      const placeholders2 = equipIds.map(() => '?').join(',');
      const [eConfigs] = await pool.query(`
        SELECT equipment_id, equipment_name, luck_bonus, courage_bonus,
               combat_bonus, command_bonus, intelligence_bonus, politics_bonus,
               charm_bonus, special_effect, special_effect_desc, description
        FROM config_equipment
        WHERE equipment_id IN (${placeholders2})
      `, equipIds);
      eConfigs.forEach(c => { equipConfigs[c.equipment_id] = c; });
    }

    // 3c. 为称号卡关联配置数据
    const titleCards = cards.filter(c => c.card_type === 'title');
    let titleConfigs = {};
    if (titleCards.length > 0) {
      const titleIds = titleCards.map(c => c.card_id);
      const placeholders3 = titleIds.map(() => '?').join(',');
      const [tConfigs] = await pool.query(`
        SELECT title_id, title_name, description, display_name,
               attribute_bonus, special_effect, special_effect_desc
        FROM config_titles
        WHERE title_id IN (${placeholders3})
      `, titleIds);
      tConfigs.forEach(c => { titleConfigs[c.title_id] = c; });
    }

    // 3d. 为将领卡关联配置数据
    const charCards = cards.filter(c => c.card_type === 'character');
    let charConfigs = {};
    if (charCards.length > 0) {
      const charIds = charCards.map(c => c.card_id);
      const placeholders4 = charIds.map(() => '?').join(',');
      const [cConfigs] = await pool.query(`
        SELECT character_id, character_name, rarity, stage, character_type,
               luck, courage, combat, command, intelligence, politics, charm,
               troop_affinity, trait, trait_modifier,
               skill_1, skill_2, character_extra
        FROM config_characters
        WHERE character_id IN (${placeholders4})
      `, charIds);
      cConfigs.forEach(c => { charConfigs[c.character_id] = c; });
    }

    // 装备件ID解析辅助函数
    const equipTypeMap = { '1': 'weapon', '2': 'armor', '3': 'accessory' };
    const equipRarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
    function parseEquipmentId(id) {
      // san_1_equip_T_RYYY → T=类型编号, R=稀有度首位
      const parts = id.split('_');
      const typeCode = parts[3] || '1';
      const seqStr = parts[4] || '1001';
      return {
        equipmentType: equipTypeMap[typeCode] || 'weapon',
        rarity: equipRarityMap[seqStr.charAt(0)] || 'common',
      };
    }

    // 4. 组装卡牌数据
    const enrichedCards = cards.map(card => {
      if (card.card_type === 'character' && charConfigs[card.card_id]) {
        const cfg = charConfigs[card.card_id];
        // 解析 character_extra JSON
        let extra = {};
        if (cfg.character_extra) {
          try { extra = typeof cfg.character_extra === 'string' ? JSON.parse(cfg.character_extra) : cfg.character_extra; } catch {}
        }
        return {
          ...card,
          config: {
            id: cfg.character_id,
            name: cfg.character_name,
            rarity: cfg.rarity,
            stage: cfg.stage,
            characterType: cfg.character_type,
            luck: cfg.luck / 10,
            courage: cfg.courage / 10,
            combat: cfg.combat / 10,
            command: cfg.command / 10,
            intelligence: cfg.intelligence / 10,
            politics: cfg.politics / 10,
            charm: cfg.charm / 10,
            troopAffinity: cfg.troop_affinity,
            trait: cfg.trait,
            traitModifier: cfg.trait_modifier,
            skills: [cfg.skill_1, cfg.skill_2].filter(Boolean),
            bond: Array.isArray(extra.bonds) ? extra.bonds.join(';') : (extra.bond || null),
            biography: extra.biography || null,
            description: extra.description || null,
            avatar: extra.avatar || null,
          }
        };
      }
      if (card.card_type === 'troop' && troopConfigs[card.card_id]) {
        const config = troopConfigs[card.card_id];
        // 使用统一的formatTroopData转换为camelCase
        const formatted = formatTroopData(config);
        // 添加faction字段
        formatted.faction = getFactionFromTroopId(config.troop_id);
        return {
          ...card,
          config: formatted
        };
      }
      if (card.card_type === 'equipment' && equipConfigs[card.card_id]) {
        const cfg = equipConfigs[card.card_id];
        const parsed = parseEquipmentId(card.card_id);
        return {
          ...card,
          config: {
            equipmentId: cfg.equipment_id,
            equipmentName: cfg.equipment_name,
            equipmentType: parsed.equipmentType,
            rarity: parsed.rarity,
            luckBonus: (cfg.luck_bonus || 0) / 10,
            courageBonus: (cfg.courage_bonus || 0) / 10,
            combatBonus: (cfg.combat_bonus || 0) / 10,
            commandBonus: (cfg.command_bonus || 0) / 10,
            intelligenceBonus: (cfg.intelligence_bonus || 0) / 10,
            politicsBonus: (cfg.politics_bonus || 0) / 10,
            charmBonus: (cfg.charm_bonus || 0) / 10,
            specialEffect: cfg.special_effect || null,
            specialEffectDesc: cfg.special_effect_desc || null,
            description: cfg.description || null,
          }
        };
      }
      if (card.card_type === 'title' && titleConfigs[card.card_id]) {
        const cfg = titleConfigs[card.card_id];
        // 从ID解析稀有度：san_1_title_1_5001 → 最后一段首位
        const idRarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
        const parts = card.card_id.split('_');
        const seqStr = parts[parts.length - 1] || '';
        const rarity = idRarityMap[seqStr.charAt(0)] || 'common';
        // 解析 attribute_bonus JSON
        let attributeBonus = {};
        if (cfg.attribute_bonus) {
          try { attributeBonus = typeof cfg.attribute_bonus === 'string' ? JSON.parse(cfg.attribute_bonus) : cfg.attribute_bonus; } catch {}
        }
        return {
          ...card,
          config: {
            id: cfg.title_id,
            name: cfg.title_name,
            rarity,
            description: cfg.description || null,
            displayName: cfg.display_name || null,
            attributeBonus,
            specialEffect: cfg.special_effect || null,
            specialEffectDesc: cfg.special_effect_desc || null,
          }
        };
      }
      return card;
    });

    // 5. 更新最后活跃时间
    await Player.updateLastActive(playerId);

    // 5. 计算已装备卡牌的属性加成总和（称号/成就/宝物的 attribute_bonus）
    // 按 equippedBy 分组，player/character1/character2 各自独立
    const attributeBonusBySlot = { player: {}, character1: {}, character2: {} };
    for (const card of enrichedCards) {
      if (!card.is_equipped || !card.config) continue;
      const ab = card.config.attributeBonus;
      if (!ab || typeof ab !== 'object') continue;
      const slot = card.equipped_by || 'player';
      if (!attributeBonusBySlot[slot]) attributeBonusBySlot[slot] = {};
      Object.entries(ab).forEach(([key, val]) => {
        attributeBonusBySlot[slot][key] = (attributeBonusBySlot[slot][key] || 0) + (parseInt(val) || 0);
      });
    }

    res.json({
      success: true,
      data: {
        player: {
          player_id: player.player_id,
          character_name: player.character_name,
          faction_id: player.faction_id,
          faction_name: player.faction_name,
          avatar: player.avatar,
          reputation: player.reputation,
          reputation_to_next: player.reputation_to_next,
          contribution: player.contribution,
          silver: player.silver,
          food: player.food,
          combat: player.combat,
          intelligence: player.intelligence,
          command: player.command,
          politics: player.politics,
          charm: player.charm,
          courage: player.courage,
          luck: player.luck,
          skill_1: player.skill_1,
          skill_2: player.skill_2,
          current_position_id: player.current_position_id,
          current_position_name: player.current_position_name,
          position_level: player.position_level,
          position_config: positionConfig,  // 官职完整配置（含加成/权限）
          morale: player.morale,
          items: player.items ? (typeof player.items === 'string' ? JSON.parse(player.items) : player.items) : {},
          troop_affinity: player.troop_affinity,
          trait: player.trait,
          trait_modifier: player.trait_modifier,
          bonus_backpack_capacity: player.bonus_backpack_capacity ?? 0,
          bonus_daily_events: player.bonus_daily_events ?? 0,
          tutorial_step: tutorialStep,
          attribute_bonus: attributeBonusBySlot.player,  // 玩家自身的属性加成
        },
        cards: enrichedCards,
        attributeBonusBySlot,  // 各角色的属性加成（前端用于将领卡显示）
      }
    });

  } catch (error) {
    console.error('[Players] 获取玩家档案失败:', error);
    res.status(500).json({
      success: false,
      error: '获取玩家档案失败',
      message: error.message
    });
  }
});

/**
 * POST /api/players/:playerId/progress/tutorial
 * 更新新手引导进度
 * body: { step } — 要设置的步骤编号
 */
router.post('/:playerId/progress/tutorial', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { step } = req.body;

    if (!step || typeof step !== 'number' || step < 1) {
      return res.status(400).json({ success: false, error: '无效的步骤编号' });
    }

    await pool.query(
      `UPDATE player_progress 
       SET tutorial_current_step = ?, 
           tutorial_completed = IF(? >= 10, TRUE, FALSE),
           tutorial_completed_at = IF(? >= 10, NOW(), NULL)
       WHERE player_id = ?`,
      [step, step, step, playerId]
    );

    res.json({ success: true, data: { tutorial_step: step } });
  } catch (error) {
    console.error('[Players] 更新新手引导进度失败:', error);
    res.status(500).json({ success: false, error: '更新进度失败' });
  }
});

/**
 * POST /api/players/:playerId/cards/equip
 * 装备卡牌到指定槽位
 * body: { instanceId, equippedBy, equippedSlot }
 */
router.post('/:playerId/cards/equip', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { instanceId, equippedBy, equippedSlot } = req.body;

    if (!instanceId || !equippedBy || !equippedSlot) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 验证卡牌归属
    const [cards] = await pool.query(
      'SELECT * FROM player_cards WHERE instance_id = ? AND player_id = ?',
      [instanceId, playerId]
    );
    if (cards.length === 0) {
      return res.status(404).json({ success: false, error: '卡牌不存在' });
    }

    // 先卸下该槽位上已有的卡牌（含称号特效清除）
    const [oldCards] = await pool.query(
      `SELECT instance_id, card_type, card_id FROM player_cards
       WHERE player_id = ? AND equipped_by = ? AND equipped_slot = ? AND is_equipped = TRUE`,
      [playerId, equippedBy, equippedSlot]
    );
    if (oldCards.length > 0) {
      await pool.query(
        `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
         WHERE instance_id = ?`,
        [oldCards[0].instance_id]
      );
      // 如果卸下的是部队卡，清零它的 bonus 字段（干净回背包）
      if (oldCards[0].card_type === 'troop') {
        await pool.query(
          `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE instance_id = ?`,
          [oldCards[0].instance_id]
        );
      }
      // 如果卸下的是效果卡，清零所有部队卡 bonus，再重新应用剩余效果卡
      if (EFFECT_CARD_TYPES.includes(oldCards[0].card_type)) {
        await pool.query(
          `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
          [playerId, equippedBy]
        );
        const [remainingEffects] = await pool.query(
          `SELECT card_type, card_id FROM player_cards
           WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
           AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
          [playerId, equippedBy, ...EFFECT_CARD_TYPES]
        );
        for (const ec of remainingEffects) {
          await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
        }
      }
    }

    // 装备新卡牌
    await pool.query(
      `UPDATE player_cards SET is_equipped = TRUE, equipped_by = ?, equipped_slot = ?
       WHERE instance_id = ? AND player_id = ?`,
      [equippedBy, equippedSlot, instanceId, playerId]
    );

    // 如果装备的卡牌有特效 或 是部队卡，统一走"清零+重新应用所有效果卡"的逻辑
    // 这样无论装备哪种卡牌，都不会出现叠加问题
    const needRecalc = EFFECT_CARD_TYPES.includes(cards[0].card_type) || cards[0].card_type === 'troop';
    if (needRecalc) {
      // 1. 清零该 equippedBy 下所有部队卡的 bonus 字段（不清除 last_troops_lost_at，保留恢复状态）
      await pool.query(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
         WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
        [playerId, equippedBy]
      );
      // 2. 重新应用所有已装备效果卡的加成（包括刚装备的这张）
      const [effectCards] = await pool.query(
        `SELECT card_type, card_id FROM player_cards
         WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
         AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
        [playerId, equippedBy, ...EFFECT_CARD_TYPES]
      );
      for (const ec of effectCards) {
        await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
      }
      // 3. 重算后检查：有兵力缺口但 last_troops_lost_at 为 NULL 的部队，补写恢复起始时间
      const [troopsToCheck] = await pool.query(
        `SELECT pc.instance_id, pc.current_troops, pc.bonus_max_troops, pc.last_troops_lost_at, ct.max_troops AS cfg_max
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.player_id = ? AND pc.equipped_by = ? AND pc.card_type = 'troop' AND pc.is_equipped = TRUE`,
        [playerId, equippedBy]
      );
      for (const t of troopsToCheck) {
        const maxTroops = (t.cfg_max || 0) + (t.bonus_max_troops || 0);
        const hasCap = (t.current_troops || 0) < maxTroops;
        if (hasCap && !t.last_troops_lost_at) {
          await pool.query('UPDATE player_cards SET last_troops_lost_at = NOW() WHERE instance_id = ?', [t.instance_id]);
        } else if (!hasCap && t.last_troops_lost_at) {
          await pool.query('UPDATE player_cards SET last_troops_lost_at = NULL WHERE instance_id = ?', [t.instance_id]);
        }
      }
    }

    console.log(`[Players] 装备卡牌: ${instanceId} → ${equippedBy}/${equippedSlot}`);
    res.json({ success: true });

  } catch (error) {
    console.error('[Players] 装备卡牌失败:', error);
    res.status(500).json({ success: false, error: '装备卡牌失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/cards/unequip
 * 卸下卡牌
 * body: { instanceId }
 */
router.post('/:playerId/cards/unequip', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { instanceId } = req.body;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: '缺少 instanceId' });
    }

    // 查询卡牌信息
    const [cardRows] = await pool.query(
      'SELECT card_type, card_id, equipped_by FROM player_cards WHERE instance_id = ? AND player_id = ?',
      [instanceId, playerId]
    );
    const cardInfo = cardRows[0];
    const equippedBy = cardInfo?.equipped_by;

    // 先执行卸下
    await pool.query(
      `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
       WHERE instance_id = ? AND player_id = ?`,
      [instanceId, playerId]
    );

    if (cardInfo && equippedBy) {
      // 如果卸下的是部队卡，清零它的 bonus（干净回背包），并确保兵力恢复状态正确
      if (cardInfo.card_type === 'troop') {
        await pool.query(
          `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE instance_id = ?`,
          [instanceId]
        );
        // 检查卸下的部队是否有兵力缺口，确保 last_troops_lost_at 正确
        const [troopState] = await pool.query(
          `SELECT pc.current_troops, pc.last_troops_lost_at, ct.max_troops AS cfg_max
           FROM player_cards pc JOIN config_troops ct ON pc.card_id = ct.troop_id
           WHERE pc.instance_id = ?`,
          [instanceId]
        );
        if (troopState[0]) {
          const maxTroops = troopState[0].cfg_max || 0; // 卸下后 bonus=0，用纯配置值
          const hasCap = (troopState[0].current_troops || 0) < maxTroops;
          if (hasCap && !troopState[0].last_troops_lost_at) {
            await pool.query('UPDATE player_cards SET last_troops_lost_at = NOW() WHERE instance_id = ?', [instanceId]);
          }
        }
      }
      // 如果卸下的是效果卡，清零所有部队卡 bonus 再重新应用剩余效果卡
      if (EFFECT_CARD_TYPES.includes(cardInfo.card_type)) {
        await pool.query(
          `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
          [playerId, equippedBy]
        );
        const [remainingEffects] = await pool.query(
          `SELECT card_type, card_id FROM player_cards
           WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
           AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
          [playerId, equippedBy, ...EFFECT_CARD_TYPES]
        );
        for (const ec of remainingEffects) {
          await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
        }
      }
    }

    console.log(`[Players] 卸下卡牌: ${instanceId}`);
    res.json({ success: true });

  } catch (error) {
    console.error('[Players] 卸下卡牌失败:', error);
    res.status(500).json({ success: false, error: '卸下卡牌失败', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 事件系统 API（阶段二）
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/players/:playerId/rewards
 * 执行奖励发放
 * 
 * body: {
 *   eventId: string,       // 事件ID
 *   optionKey: 'A' | 'B',  // 选择的选项
 *   playerAttrs: Object,   // 玩家角色属性（显示值）
 *   general1Attrs: Object, // 将领1属性（显示值）
 *   general2Attrs: Object, // 将领2属性（显示值）
 * }
 * 
 * 后端重新计算 multiplier，不信任前端传值
 */
router.post('/:playerId/rewards', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { eventId, optionKey, playerAttrs, general1Attrs, general2Attrs, minigameResult, minigameSilverDelta, battleResult, battleSilverSpent, battleScore } = req.body;

    if (!eventId || !optionKey) {
      return res.status(400).json({ success: false, error: '缺少 eventId 或 optionKey' });
    }

    // 1. 获取玩家信息（faction_id）
    const [playerRows] = await pool.query(
      'SELECT faction_id FROM players WHERE player_id = ?',
      [playerId]
    );
    if (playerRows.length === 0) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    const factionId = playerRows[0].faction_id;

    // 2. 获取事件配置
    const [eventRows] = await pool.query(
      'SELECT option_a, option_b, required_items, chain_id FROM config_events WHERE event_id = ?',
      [eventId]
    );
    if (eventRows.length === 0) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }

    // 解析选项JSON
    const optionRaw = optionKey === 'A' ? eventRows[0].option_a : eventRows[0].option_b;
    const option = typeof optionRaw === 'string' ? JSON.parse(optionRaw) : optionRaw;
    if (!option) {
      return res.status(400).json({ success: false, error: '无效的选项' });
    }

    // 事件级 required_items（事件链道具）合并到所选选项的 requiredItems
    if (eventRows[0].required_items) {
      const eventItems = eventRows[0].required_items;
      option.requiredItems = option.requiredItems
        ? `${eventItems};${option.requiredItems}`
        : eventItems;
    }

    // 2.5 检查事件是否已完成（仅事件链需要防重复，普通探索事件可重复触发）
    if (eventRows[0].chain_id) {
      const [eventProgress] = await pool.query(
        'SELECT explore_events FROM player_events WHERE player_id = ?', [playerId]
      );
      if (eventProgress[0]) {
        let events = {};
        try { events = typeof eventProgress[0].explore_events === 'string' ? JSON.parse(eventProgress[0].explore_events) : (eventProgress[0].explore_events || {}); } catch {}
        if (events[eventId]?.status === 'completed') {
          return res.status(400).json({ success: false, error: '事件已完成，不可重复领取奖励' });
        }
      }
    }

    // 3. 计算运势倍率
    let fortune;
    if (option.mainFactor === 'minigame' && minigameResult) {
      // 迷你游戏：由前端结果决定
      // 胜利=吉(×1.0)，失败=凶(×0.5)
      // 胜利时投骰子：5或6点触发 bonus_rewards
      const dice = minigameResult === 'victory' ? (Math.floor(Math.random() * 6) + 1) : 2;
      fortune = minigameResult === 'victory'
        ? { fortuneName: dice >= 5 ? '鸿运' : '吉', multiplier: 1.0, dice, finalRate: 100 }
        : { fortuneName: '凶', multiplier: 0.5, dice, finalRate: 40 };
    } else if (battleResult) {
      // 惩罚战斗后：战斗胜利恢复×0.8，失败×0.5
      fortune = battleResult === 'victory'
        ? { fortuneName: '凶', multiplier: 0.8, dice: 3, finalRate: 60 }
        : { fortuneName: '大凶', multiplier: 0.5, dice: 1, finalRate: 30 };
    } else {
      // 正常因子判定：后端重算
      fortune = calculateFortune(
        option,
        playerAttrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 },
        general1Attrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 },
        general2Attrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 }
      );
    }

    // 4. 扣除选项消耗（requiredItems）
    if (option.requiredItems) {
      const costItems = option.requiredItems.split(';').map(s => s.trim()).filter(Boolean);
      for (const costItem of costItems) {
        const [key, val] = costItem.split(':');
        const amount = parseInt(val) || 1; // 无数量默认1
        // 资源类型
        const resourceFields = ['silver', 'food', 'reputation', 'contribution', 'morale'];
        if (resourceFields.includes(key)) {
          await pool.query(
            `UPDATE players SET ${key} = GREATEST(0, ${key} - ?) WHERE player_id = ?`,
            [amount, playerId]
          );
        } else if (key.includes('_item_') || key.startsWith('item_')) {
          // 道具扣除（支持 san_1_item_xxx 和 item_xxx 两种格式）
          const [itemRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
          let items = {};
          if (itemRows[0]?.items) {
            items = typeof itemRows[0].items === 'string' ? JSON.parse(itemRows[0].items) : itemRows[0].items;
          }
          items[key] = (items[key] || 0) - amount;
          if (items[key] <= 0) delete items[key];
          await pool.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), playerId]);
        }
      }
    }

    // 5. 确定要发放的奖励字符串
    let rewardStr = option.rewards || '';

    // 鸿运额外奖励
    let bonusRewardStr = '';
    if (fortune.fortuneName === '鸿运' && option.bonusRewards) {
      bonusRewardStr = option.bonusRewards;
    }

    // 6. 执行基准奖励发放
    const result = await executeRewards(playerId, rewardStr, fortune.multiplier, factionId);

    // 7. 执行鸿运额外奖励（不受倍率影响，直接×1）
    let bonusResult = null;
    if (bonusRewardStr) {
      bonusResult = await executeRewards(playerId, bonusRewardStr, 1.0, factionId);
    }

    // 扣除战斗中消耗的银两
    if (battleSilverSpent && battleSilverSpent > 0) {
      await pool.query(
        'UPDATE players SET silver = GREATEST(0, silver - ?) WHERE player_id = ?',
        [battleSilverSpent, playerId]
      );
    }

    // 结算迷你游戏筹码盈亏（正数=赢，负数=输）
    if (minigameSilverDelta && minigameSilverDelta !== 0) {
      if (minigameSilverDelta > 0) {
        await pool.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [minigameSilverDelta, playerId]);
      } else {
        await pool.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [minigameSilverDelta, playerId]);
      }
      console.log(`[Players] 迷你游戏筹码结算: playerId=${playerId}, delta=${minigameSilverDelta}`);
    }

    // 更新战斗积分到 statistics
    if (battleScore && battleScore > 0) {
      console.log(`[Players] 更新战斗积分: playerId=${playerId}, battleScore=${battleScore}`);
      await pool.query(
        'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [battleScore, playerId]
      );
    } else {
      console.log(`[Players] 战斗积分未更新: battleScore=${battleScore}, battleResult=${battleResult}`);
    }

    res.json({
      success: true,
      data: {
        fortune: {
          name: fortune.fortuneName,
          multiplier: fortune.multiplier,
          dice: fortune.dice,
          diceMultiplier: fortune.diceMultiplier,
          baseScore: fortune.baseScore,
          finalRate: fortune.finalRate,
        },
        rewards: result.details,
        bonusRewards: bonusResult ? bonusResult.details : [],
      }
    });

  } catch (error) {
    console.error('[Players] 执行奖励失败:', error);
    res.status(500).json({ success: false, error: '执行奖励失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/items
 * 获取玩家道具列表
 */
router.get('/:playerId/items', async (req, res) => {
  try {
    const { playerId } = req.params;

    const [rows] = await pool.query(
      'SELECT items FROM players WHERE player_id = ?',
      [playerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }

    let items = {};
    if (rows[0].items) {
      items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
    }

    // 关联 config_items 获取道具名称和描述
    const itemIds = Object.keys(items);
    let itemConfigs = {};
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [configs] = await pool.query(
        `SELECT item_id, item_name, description, item_type FROM config_items WHERE item_id IN (${placeholders})`,
        itemIds
      );
      configs.forEach(c => { itemConfigs[c.item_id] = c; });
    }

    // 组装返回数据
    const itemList = itemIds.map(id => ({
      itemId: id,
      quantity: items[id],
      name: itemConfigs[id]?.item_name || id,
      description: itemConfigs[id]?.description || '',
      itemType: itemConfigs[id]?.item_type || 'event_key',
    })).filter(i => i.quantity > 0);

    res.json({ success: true, data: { items: itemList } });

  } catch (error) {
    console.error('[Players] 获取道具失败:', error);
    res.status(500).json({ success: false, error: '获取道具失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/items
 * 添加道具（事件奖励发放道具）
 * body: { itemId: string, quantity: number }
 */
router.post('/:playerId/items', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, error: '缺少 itemId' });
    }

    const [rows] = await pool.query(
      'SELECT items FROM players WHERE player_id = ?',
      [playerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }

    let items = {};
    if (rows[0].items) {
      items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
    }

    items[itemId] = (items[itemId] || 0) + quantity;

    await pool.query(
      'UPDATE players SET items = ? WHERE player_id = ?',
      [JSON.stringify(items), playerId]
    );

    res.json({ success: true, data: { itemId, quantity: items[itemId] } });

  } catch (error) {
    console.error('[Players] 添加道具失败:', error);
    res.status(500).json({ success: false, error: '添加道具失败', message: error.message });
  }
});

/**
 * DELETE /api/players/:playerId/items
 * 消耗道具（事件链 required_items 扣除）
 * body: { itemId: string, quantity: number }
 */
router.delete('/:playerId/items', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, error: '缺少 itemId' });
    }

    const [rows] = await pool.query(
      'SELECT items FROM players WHERE player_id = ?',
      [playerId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }

    let items = {};
    if (rows[0].items) {
      items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
    }

    const current = items[itemId] || 0;
    if (current < quantity) {
      return res.status(400).json({ success: false, error: `道具不足，当前持有 ${current}，需要 ${quantity}` });
    }

    items[itemId] = current - quantity;
    if (items[itemId] <= 0) {
      delete items[itemId];
    }

    await pool.query(
      'UPDATE players SET items = ? WHERE player_id = ?',
      [JSON.stringify(items), playerId]
    );

    res.json({ success: true, data: { itemId, remaining: items[itemId] || 0 } });

  } catch (error) {
    console.error('[Players] 消耗道具失败:', error);
    res.status(500).json({ success: false, error: '消耗道具失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/events/explore
 * 获取玩家探索事件进度
 */
router.get('/:playerId/events/explore', async (req, res) => {
  try {
    const { playerId } = req.params;
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT explore_events FROM player_events WHERE player_id = ?',
      [playerId]
    );
    let events = {};
    if (rows[0]?.explore_events) {
      events = typeof rows[0].explore_events === 'string'
        ? JSON.parse(rows[0].explore_events) : rows[0].explore_events;
    }
    res.json({ success: true, data: { events } });
  } catch (error) {
    console.error('[Players] 获取探索事件进度失败:', error);
    res.status(500).json({ success: false, error: '获取探索事件进度失败' });
  }
});

// ── 探索配额（服务端存储，防止跨浏览器重复恢复） ──────────────

const EXPLORE_REFILL_PER_HOUR = 6;
const EXPLORE_MAX_QUOTA = 18;
const EXPLORE_REST_START = 0;  // 00:00
const EXPLORE_REST_END = 8;    // 08:00

function isExploreRestHour(hour) { return hour >= EXPLORE_REST_START && hour < EXPLORE_REST_END; }

function getHourTs(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
}

function countExploreActiveHours(fromTs, toTs) {
  if (toTs <= fromTs) return 0;
  let count = 0, ts = fromTs, i = 0;
  while (ts < toTs && i < 48) {
    if (!isExploreRestHour(new Date(ts).getHours())) count++;
    ts += 3600000;
    i++;
  }
  return count;
}

function calcServerQuota(remaining, lastRefillTs) {
  const now = new Date();
  const currentHourTs = getHourTs(now);
  if (!lastRefillTs) {
    return { remaining: isExploreRestHour(now.getHours()) ? 0 : EXPLORE_REFILL_PER_HOUR, lastRefillTs: currentHourTs };
  }
  const activeHours = countExploreActiveHours(lastRefillTs, currentHourTs);
  if (activeHours > 0) {
    return { remaining: Math.min((remaining || 0) + activeHours * EXPLORE_REFILL_PER_HOUR, EXPLORE_MAX_QUOTA), lastRefillTs: currentHourTs };
  }
  return { remaining: remaining || 0, lastRefillTs };
}

/**
 * GET /api/players/:playerId/explore-quota
 * 获取探索配额（服务端计算恢复）
 */
router.get('/:playerId/explore-quota', async (req, res) => {
  try {
    const { playerId } = req.params;
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT explore_quota_remaining, explore_quota_refill_ts FROM player_events WHERE player_id = ?',
      [playerId]
    );
    const row = rows[0] || {};
    const saved = calcServerQuota(row.explore_quota_remaining, row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null);
    // 如果有恢复，写回DB
    if (saved.lastRefillTs !== (row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null) || saved.remaining !== row.explore_quota_remaining) {
      await pool.query(
        'UPDATE player_events SET explore_quota_remaining = ?, explore_quota_refill_ts = ? WHERE player_id = ?',
        [saved.remaining, String(saved.lastRefillTs), playerId]
      );
    }
    res.json({ success: true, data: { remaining: saved.remaining, lastRefillTs: saved.lastRefillTs, max: EXPLORE_MAX_QUOTA, refillPerHour: EXPLORE_REFILL_PER_HOUR } });
  } catch (error) {
    console.error('[Players] 获取探索配额失败:', error);
    res.status(500).json({ success: false, error: '获取探索配额失败' });
  }
});

/**
 * POST /api/players/:playerId/explore-quota
 * 更新探索配额（消耗/退还/填满）
 * body: { action: 'consume' | 'refund' | 'fillMax' }
 */
router.post('/:playerId/explore-quota', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { action } = req.body;
    if (!['consume', 'refund', 'fillMax'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的 action' });
    }
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT explore_quota_remaining, explore_quota_refill_ts FROM player_events WHERE player_id = ?',
      [playerId]
    );
    const row = rows[0] || {};
    const current = calcServerQuota(row.explore_quota_remaining, row.explore_quota_refill_ts ? Number(row.explore_quota_refill_ts) : null);
    let newRemaining = current.remaining;
    if (action === 'consume') {
      if (newRemaining <= 0) return res.status(400).json({ success: false, error: '探索次数不足' });
      newRemaining -= 1;
    } else if (action === 'refund') {
      newRemaining = Math.min(newRemaining + 1, EXPLORE_MAX_QUOTA);
    } else if (action === 'fillMax') {
      newRemaining = EXPLORE_MAX_QUOTA;
    }
    await pool.query(
      'UPDATE player_events SET explore_quota_remaining = ?, explore_quota_refill_ts = ? WHERE player_id = ?',
      [newRemaining, String(current.lastRefillTs), playerId]
    );
    res.json({ success: true, data: { remaining: newRemaining, lastRefillTs: current.lastRefillTs, max: EXPLORE_MAX_QUOTA } });
  } catch (error) {
    console.error('[Players] 更新探索配额失败:', error);
    res.status(500).json({ success: false, error: '更新探索配额失败' });
  }
});

/**
 * POST /api/players/:playerId/events
 * 记录事件进度
 * body: {
 *   eventId: string,
 *   eventType: number,  // 1-7 对应7种事件类型
 *   status: string,     // available/in_progress/completed
 *   data: Object        // 事件进度数据
 * }
 */
router.post('/:playerId/events', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { eventId, eventType, status = 'completed', data = {} } = req.body;

    if (!eventId || !eventType) {
      return res.status(400).json({ success: false, error: '缺少 eventId 或 eventType' });
    }

    // 事件类型 → 字段名映射
    const typeFieldMap = {
      1: 'historical_events',
      2: 'fictional_events',
      3: 'daily_events',
      4: 'weekly_events',
      5: 'mini_events',
      6: 'explore_events',
      7: 'reward_events',
    };

    const field = typeFieldMap[eventType];
    if (!field) {
      return res.status(400).json({ success: false, error: '无效的事件类型' });
    }

    // 确保 player_events 记录存在
    await pool.query(
      `INSERT IGNORE INTO player_events (player_id) VALUES (?)`,
      [playerId]
    );

    // 读取当前字段值
    const [rows] = await pool.query(
      `SELECT ${field} FROM player_events WHERE player_id = ?`,
      [playerId]
    );

    let events = {};
    if (rows[0]?.[field]) {
      events = typeof rows[0][field] === 'string'
        ? JSON.parse(rows[0][field])
        : rows[0][field];
    }

    // 写入事件记录
    events[eventId] = {
      status,
      ...data,
      updated_at: new Date().toISOString(),
    };

    // 更新字段
    await pool.query(
      `UPDATE player_events SET ${field} = ? WHERE player_id = ?`,
      [JSON.stringify(events), playerId]
    );

    res.json({ success: true, data: { eventId, field, status } });

  } catch (error) {
    console.error('[Players] 记录事件进度失败:', error);
    res.status(500).json({ success: false, error: '记录事件进度失败', message: error.message });
  }
});

// ── 属性随机系统 ─────────────────────────────────────────────

const REROLL_COST = { common: 10, rare: 50, epic: 250, legendary: 500, core: 750 };
const REROLL_DAILY_LIMIT = 2;

// 从官职稀有度映射表（与 position CSV 一致）
function getPositionRarity(positionLevel) {
  if (positionLevel <= 3) return 'core';
  if (positionLevel === 4) return 'legendary';
  if (positionLevel === 5) return 'epic';
  if (positionLevel <= 7) return 'rare';
  return 'common';
}

// 解析 MySQL DATE 为本地日期 YYYY-MM-DD 字符串（避免时区偏移）
// 不再使用 JS 日期比较，改用 MySQL CURDATE() 直接在 SQL 中判断

/**
 * GET /api/players/:playerId/reroll-status
 * 获取属性随机状态
 */
router.get('/:playerId/reroll-status', async (req, res) => {
  try {
    const { playerId } = req.params;
    // 每日次数用 CURDATE() 判断重置；批次记录始终返回（直到玩家确认选择后才清除）
    const [rows] = await pool.query(
      `SELECT position_level, silver,
              IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
              attr_reroll_batches,
              attr_reroll_selected_batch, attr_reroll_selected_index
       FROM players WHERE player_id = ?`,
      [playerId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: '玩家不存在' });

    const p = rows[0];
    const rarity = getPositionRarity(p.position_level ?? 8);
    const cost = REROLL_COST[rarity];
    const remaining = REROLL_DAILY_LIMIT - (p.today_used || 0);
    const batches = p.attr_reroll_batches
      ? (typeof p.attr_reroll_batches === 'string' ? JSON.parse(p.attr_reroll_batches) : p.attr_reroll_batches)
      : [];

    res.json({
      success: true,
      data: {
        rarity,
        cost,
        dailyLimit: REROLL_DAILY_LIMIT,
        remaining,
        silver: p.silver,
        batches,
        selectedBatch: p.attr_reroll_selected_batch,
        selectedIndex: p.attr_reroll_selected_index,
      }
    });
  } catch (error) {
    console.error('[Players] 获取属性随机状态失败:', error);
    res.status(500).json({ success: false, error: '获取属性随机状态失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/reroll-attributes
 * 执行属性随机（扣银两、生成3方案、记录批次）
 */
router.post('/:playerId/reroll-attributes', async (req, res) => {
  try {
    const { playerId } = req.params;
    const [rows] = await pool.query(
      `SELECT position_level, silver,
              IF(attr_reroll_date = CURDATE(), attr_reroll_count, 0) AS today_used,
              attr_reroll_batches
       FROM players WHERE player_id = ?`,
      [playerId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: '玩家不存在' });

    const p = rows[0];
    const rarity = getPositionRarity(p.position_level ?? 8);
    const cost = REROLL_COST[rarity];
    const remaining = REROLL_DAILY_LIMIT - (p.today_used || 0);

    if (remaining <= 0) {
      return res.status(400).json({ success: false, error: '今日属性随机次数已用完（上限2次/天）' });
    }
    if (p.silver < cost) {
      return res.status(400).json({ success: false, error: `银两不足，需要${cost}银两` });
    }

    // 生成3个方案（复用角色创建算法）
    const options = await PlayerService.generateAttributeOptions(rarity);

    // 批次记录始终累加，直到玩家确认选择后才清除
    const batches = p.attr_reroll_batches
      ? (typeof p.attr_reroll_batches === 'string' ? JSON.parse(p.attr_reroll_batches) : p.attr_reroll_batches)
      : [];
    const newBatch = {
      batch: batches.length + 1,
      timestamp: new Date().toISOString(),
      cost,
      rarity,
      options,
    };
    batches.push(newBatch);

    const newUsed = (p.today_used || 0) + 1;
    const newRemaining = REROLL_DAILY_LIMIT - newUsed;
    await pool.query(
      `UPDATE players SET
        silver = silver - ?,
        attr_reroll_date = CURDATE(),
        attr_reroll_count = ?,
        attr_reroll_batches = ?,
        attr_reroll_selected_batch = NULL,
        attr_reroll_selected_index = NULL
       WHERE player_id = ?`,
      [cost, newUsed, JSON.stringify(batches), playerId]
    );

    res.json({
      success: true,
      data: {
        batch: newBatch.batch,
        options,
        cost,
        remainingSilver: p.silver - cost,
        remaining: newRemaining,
        batches,
      }
    });
  } catch (error) {
    console.error('[Players] 属性随机失败:', error);
    res.status(500).json({ success: false, error: '属性随机失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/reroll-confirm
 * 确认选择属性方案（更新7属性+技能）
 */
router.post('/:playerId/reroll-confirm', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { batch, index } = req.body;
    if (batch == null || index == null) {
      return res.status(400).json({ success: false, error: '缺少 batch 或 index' });
    }

    const [rows] = await pool.query(
      'SELECT attr_reroll_batches FROM players WHERE player_id = ?',
      [playerId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: '玩家不存在' });

    const batches = rows[0].attr_reroll_batches
      ? (typeof rows[0].attr_reroll_batches === 'string' ? JSON.parse(rows[0].attr_reroll_batches) : rows[0].attr_reroll_batches)
      : [];
    const targetBatch = batches.find(b => b.batch === batch);
    if (!targetBatch) return res.status(400).json({ success: false, error: `批次 ${batch} 不存在` });
    if (index < 0 || index >= targetBatch.options.length) {
      return res.status(400).json({ success: false, error: `索引 ${index} 超出范围` });
    }

    const option = targetBatch.options[index];
    const attrs = option.attributesInt || {};
    // attributesInt 是 ×10 存储值；如果没有则从 attributes 手动 ×10
    const toInt = (v) => Math.round((v || 0) * 10);
    const luck = attrs.luck ?? toInt(option.attributes?.luck);
    const courage = attrs.courage ?? toInt(option.attributes?.courage);
    const combat = attrs.combat ?? toInt(option.attributes?.combat);
    const command = attrs.command ?? toInt(option.attributes?.command);
    const intelligence = attrs.intelligence ?? toInt(option.attributes?.intelligence);
    const politics = attrs.politics ?? toInt(option.attributes?.politics);
    const charm = attrs.charm ?? toInt(option.attributes?.charm);
    const skill1 = option.skills?.skill_1?.id || option.skills?.skill_1 || null;
    const skill2 = option.skills?.skill_2?.id || option.skills?.skill_2 || null;

    await pool.query(
      `UPDATE players SET
        luck = ?, courage = ?, combat = ?, command = ?,
        intelligence = ?, politics = ?, charm = ?,
        skill_1 = ?, skill_2 = ?,
        attr_reroll_batches = NULL,
        attr_reroll_selected_batch = ?,
        attr_reroll_selected_index = ?
       WHERE player_id = ?`,
      [luck, courage, combat, command, intelligence, politics, charm,
       skill1, skill2, batch, index, playerId]
    );

    res.json({
      success: true,
      data: {
        attributes: option.attributes,
        skills: option.skills,
        type: option.type,
        selectedBatch: batch,
        selectedIndex: index,
      }
    });
  } catch (error) {
    console.error('[Players] 确认属性方案失败:', error);
    res.status(500).json({ success: false, error: '确认属性方案失败', message: error.message });
  }
});

module.exports = router;
