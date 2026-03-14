/**
 * 玩家路由
 * 
 * @description 处理玩家角色相关的API请求
 */

const express = require('express');
const Player = require('../models/Player');
const PlayerService = require('../services/playerService');
const { pool } = require('../database/connection');

const router = express.Router();

/**
 * GET /api/players/avatars
 * 获取可用头像列表
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
        data: { avatars: [] }
      });
    }
    
    const files = fs.readdirSync(avatarDir)
      .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .sort();
    
    const avatars = files.map(f => `assets/san_1_ui_card/avatar/${f}`);
    
    res.json({
      success: true,
      data: { avatars }
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

    // 解析special_ability JSON，将其展开为独立字段
    const processedTroops = troops.map(troop => {
      let specialAbility = {};
      try {
        specialAbility = typeof troop.special_ability === 'string' 
          ? JSON.parse(troop.special_ability) 
          : troop.special_ability || {};
      } catch (e) {
        console.error(`解析special_ability失败 (${troop.troop_id}):`, e);
      }

      return {
        troop_id: troop.troop_id,
        troop_name: troop.troop_name,
        rarity: troop.rarity,
        troop_type: troop.troop_type,
        weapon_type: troop.weapon_type, // 添加weapon_type字段
        attack: troop.attack,
        defense: troop.defense,
        max_troops: troop.max_troops,
        speed: troop.speed,
        movement: troop.movement,
        range: troop.attack_range,
        // 从troop_id推断势力
        faction: getFactionFromTroopId(troop.troop_id),
        // 从special_ability中提取
        skills: specialAbility.skills || [],
        infantry_counter: specialAbility.counters?.infantry || 1,
        cavalry_counter: specialAbility.counters?.cavalry || 1,
        archer_counter: specialAbility.counters?.archer || 1,
        siege_counter: specialAbility.counters?.siege || 1,
        plain_adapt: specialAbility.adaptation?.plain || 1,
        hill_adapt: specialAbility.adaptation?.hill || 1,
        forest_adapt: specialAbility.adaptation?.forest || 1,
        siege_adapt: specialAbility.adaptation?.siege || 1,
        // description字段
        description: troop.description || ''
      };
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

module.exports = router;
