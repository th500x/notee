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
const equipmentSetService = require('../services/equipmentSetService');
const characterRankService = require('../services/characterRankService');
const { getFactionFromTroopId } = require('../services/troopIdHelpers');
const playerCardLineupService = require('../services/playerCardLineupService');
const playerExploreEventService = require('../services/playerExploreEventService');
const playerExploreQuotaService = require('../services/playerExploreQuotaService');
const playerItemsService = require('../services/playerItemsService');
const playerRerollService = require('../services/playerRerollService');
const playerProfileService = require('../services/playerProfileService');
const playerEventRewardsService = require('../services/playerEventRewardsService');

const router = express.Router();

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

const textsRouter = require('./texts');
router.use('/:playerId/texts', textsRouter);

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

/**
 * GET /api/players/:playerId/profile
 * 获取玩家完整档案（基础信息 + 卡牌）
 * 用于GamePage状态栏和编组Tab
 */
/**
 * GET /api/players/:playerId/character-rank?bucket=main:player
 * bucket：main:player | main:character1 | main:character2 | garrison:槽位:char1|char2
 */
router.get('/:playerId/character-rank', async (req, res) => {
  try {
    const { playerId } = req.params;
    const bucket = req.query.bucket;
    if (!bucket || typeof bucket !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 bucket 参数' });
    }
    const data = await characterRankService.getCharacterRankForBucket(playerId, bucket);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Players] character-rank 失败:', error);
    res.status(500).json({ success: false, error: '查询将领排名失败', message: error.message });
  }
});

router.get('/:playerId/profile', async (req, res) => {
  try {
    const { playerId } = req.params;
    const result = await playerProfileService.getPlayerProfile(playerId);
    if (result.notFound) {
      return res.status(404).json({
        success: false,
        error: '玩家不存在'
      });
    }
    res.json({ success: true, data: result.data });
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
    const result = await playerCardLineupService.equipCard(playerId, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
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
    const result = await playerCardLineupService.unequipCard(playerId, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Players] 卸下卡牌失败:', error);
    res.status(500).json({ success: false, error: '卸下卡牌失败', message: error.message });
  }
});

function equipmentSetHttpFromError(err) {
  const table = {
    INVALID_SLOT: [400, '槽位无效'],
    SET_NOT_FOUND: [404, '套装卡不存在'],
    RENAME_DRAFT_USE_FINALIZE: [400, '草稿套装请通过「完成封装」命名'],
    EQUIPMENT_NOT_FOUND: [404, '装备件不存在'],
    ALREADY_EQUIPPED: [400, '该装备件已上阵，请先卸下'],
    TYPE_MISMATCH: [400, '装备类型与槽位不符'],
    BOUND_ELSEWHERE: [400, '该装备件已编入其他套装'],
    DUPLICATE_PIECE: [400, '套装内不能重复放入同一件'],
    CANNOT_REMOVE_FINALIZED_SLOT: [400, '已封装装备卡仅支持更换，不可卸下'],
    INVALID_NAME: [400, '名称需在 1～12 字'],
    ALREADY_FINALIZED: [400, '该套装已命名'],
    INCOMPLETE: [400, '四个槽位均需放入装备件后才能命名'],
  };
  const code = err && err.code;
  const row = table[code];
  if (row) {
    return { status: row[0], body: { success: false, error: row[1], code } };
  }
  return null;
}

/**
 * GET /api/players/:playerId/equipment-set/draft
 * 获取或创建当前唯一的草稿装备卡（equipmentSet）
 */
router.get('/:playerId/equipment-set/draft', async (req, res) => {
  try {
    const { playerId } = req.params;
    const row = await equipmentSetService.getOrCreateDraftSet(playerId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({
      success: true,
      data: {
        instance_id: row.instance_id,
        equipment_set_data: data,
      },
    });
  } catch (error) {
    console.error('[Players] equipment-set draft:', error);
    res.status(500).json({ success: false, error: '获取草稿套装失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/equipment-set/:setInstanceId
 * 单条套装（用于编辑已命名装备卡）
 */
router.get('/:playerId/equipment-set/:setInstanceId', async (req, res) => {
  try {
    const { playerId, setInstanceId } = req.params;
    const row = await equipmentSetService.getEquipmentSetById(playerId, setInstanceId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({
      success: true,
      data: {
        instance_id: row.instance_id,
        equipment_set_data: data,
      },
    });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[Players] equipment-set get:', error);
    res.status(500).json({ success: false, error: '读取套装失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/equipment-set/rename
 * body: { setInstanceId, displayName }
 */
router.post('/:playerId/equipment-set/rename', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) {
      return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    }
    const data = await equipmentSetService.renameEquipmentSet(playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[Players] equipment-set rename:', error);
    res.status(500).json({ success: false, error: '重命名失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/equipment-set/slot
 * body: { setInstanceId, slot, equipmentInstanceId|null }
 */
router.post('/:playerId/equipment-set/slot', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { setInstanceId, slot, equipmentInstanceId } = req.body || {};
    if (!setInstanceId || !slot) {
      return res.status(400).json({ success: false, error: '缺少 setInstanceId 或 slot' });
    }
    const data = await equipmentSetService.assignSlot(
      playerId,
      setInstanceId,
      slot,
      equipmentInstanceId || null
    );
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[Players] equipment-set slot:', error);
    res.status(500).json({ success: false, error: '更新套装槽位失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/equipment-set/finalize
 * body: { setInstanceId, displayName }
 */
router.post('/:playerId/equipment-set/finalize', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) {
      return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    }
    const data = await equipmentSetService.finalizeSet(playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[Players] equipment-set finalize:', error);
    res.status(500).json({ success: false, error: '命名套装失败', message: error.message });
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
    const out = await playerEventRewardsService.executeEventRewards(playerId, req.body);
    if (!out.ok) {
      return res.status(out.status).json(out.json);
    }
    res.json({ success: true, data: out.data });
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
    const result = await playerItemsService.listItems(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    res.json({ success: true, data: { items: result.items } });
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
    const result = await playerItemsService.addItem(playerId, itemId, quantity);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { itemId: result.itemId, quantity: result.quantity } });
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
    const result = await playerItemsService.consumeItem(playerId, itemId, quantity);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { itemId: result.itemId, remaining: result.remaining } });
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
    await playerExploreEventService.maybeResetExploreTroopChainsDaily(playerId);
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

// ── 探索配额（服务端存储，防止跨浏览器重复恢复） → playerExploreQuotaService

/**
 * GET /api/players/:playerId/explore-quota
 * 获取探索配额（服务端计算恢复）
 */
router.get('/:playerId/explore-quota', async (req, res) => {
  try {
    const { playerId } = req.params;
    const data = await playerExploreQuotaService.getExploreQuotaState(playerId);
    res.json({
      success: true,
      data: {
        remaining: data.remaining,
        lastRefillTs: data.lastRefillTs,
        max: data.max,
        refillPerHour: data.refillPerHour,
      },
    });
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
    const result = await playerExploreQuotaService.applyExploreQuotaAction(playerId, action);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.data });
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

// ── 属性随机系统 → playerRerollService

/**
 * GET /api/players/:playerId/reroll-status
 * 获取属性随机状态
 */
router.get('/:playerId/reroll-status', async (req, res) => {
  try {
    const { playerId } = req.params;
    const result = await playerRerollService.getRerollStatus(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    res.json({ success: true, data: result.data });
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
    const result = await playerRerollService.rerollAttributes(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    if (result.badRequest) {
      return res.status(400).json({ success: false, error: result.badRequest });
    }
    res.json({ success: true, data: result.data });
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
    const result = await playerRerollService.rerollConfirm(playerId, batch, index);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    if (result.badRequest) {
      return res.status(400).json({ success: false, error: result.badRequest });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 确认属性方案失败:', error);
    res.status(500).json({ success: false, error: '确认属性方案失败', message: error.message });
  }
});

module.exports = router;
