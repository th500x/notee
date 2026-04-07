/**
 * 玩家路由
 *
 * 纯 HTTP 适配层：参数解析、格式校验、Service 调用、响应序列化。
 * 不包含任何直接 SQL；业务逻辑均委托对应 Service。
 */

const express = require('express');
const Player = require('../models/Player');
const PlayerService = require('../services/playerService');
const equipmentSetService = require('../services/equipmentSetService');
const characterRankService = require('../services/characterRankService');
const playerCardLineupService = require('../services/playerCardLineupService');
const playerExploreEventService = require('../services/playerExploreEventService');
const playerExploreQuotaService = require('../services/playerExploreQuotaService');
const playerItemsService = require('../services/playerItemsService');
const playerRerollService = require('../services/playerRerollService');
const playerProfileService = require('../services/playerProfileService');
const playerStatisticsService = require('../services/playerStatisticsService');
const playerEventRewardsService = require('../services/playerEventRewardsService');
const playerCreationService = require('../services/playerCreationService');

const router = express.Router();

// ── 头像 ────────────────────────────────────────────────────────────────────

/**
 * GET /api/players/avatars
 * 获取可用头像列表（按分类分组）
 */
router.get('/avatars', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const avatarDir = path.join(__dirname, '../../public/assets/san_1_ui_card/avatar');
    if (!fs.existsSync(avatarDir)) {
      return res.json({ success: true, data: { categories: [] } });
    }

    const categoryLabels = {
      '01_elder_male_scholar':   '白须儒雅',
      '02_elder_male_warrior':   '白须老将',
      '03_elder_female_noble':   '年上贵妇',
      '04_elder_female_folk':    '年上内助',
      '05_mid_male_scholar':     '中年谋士',
      '06_mid_male_warrior':     '中年将军',
      '07_mid_female_noble':     '人妻少妇',
      '08_mid_female_warrior':   '人妻女将',
      '09_young_male_scholar':   '青年书生',
      '10_young_male_warrior':   '青年将官',
      '11_young_female_scholar': '青年才女',
      '12_young_female_warrior': '青年女侠',
    };

    const dirs = fs.readdirSync(avatarDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    const categories = dirs.map(dir => {
      const dirPath = path.join(avatarDir, dir.name);
      const files   = fs.readdirSync(dirPath)
        .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
        .sort();
      return {
        id:      dir.name,
        label:   categoryLabels[dir.name] || dir.name,
        avatars: files.map(f => `assets/san_1_ui_card/avatar/${dir.name}/${f}`),
      };
    }).filter(c => c.avatars.length > 0);

    res.json({ success: true, data: { categories } });
  } catch (error) {
    console.error('[Players] 获取头像列表失败:', error);
    res.status(500).json({ success: false, error: '获取头像列表失败', message: error.message });
  }
});

// ── 账号检查 ─────────────────────────────────────────────────────────────────

/**
 * GET /api/players/check/:playerId
 * 检查玩家是否存在
 */
router.get('/check/:playerId', async (req, res) => {
  try {
    const exists = await Player.exists(req.params.playerId);
    res.json({ success: true, data: { exists } });
  } catch (error) {
    console.error('[Players] 检查玩家失败:', error);
    res.status(500).json({ success: false, error: '检查玩家失败', message: error.message });
  }
});

const textsRouter = require('./texts');
router.use('/:playerId/texts', textsRouter);

// ── 玩家基础信息 ──────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId
 * 获取玩家信息（含 tutorial_step）
 */
router.get('/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await Player.getById(playerId);
    if (!player) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    player.tutorial_step = await playerProfileService.getTutorialStep(playerId);
    res.json({ success: true, data: player });
  } catch (error) {
    console.error('[Players] 获取玩家信息失败:', error);
    res.status(500).json({ success: false, error: '获取玩家信息失败', message: error.message });
  }
});

// ── 角色创建辅助 ──────────────────────────────────────────────────────────────

/**
 * POST /api/players/generate-attributes
 * 生成属性方案（9选1）
 */
router.post('/generate-attributes', async (req, res) => {
  try {
    const { rarity = 'common' } = req.body;
    const options = await PlayerService.generateAttributeOptions(rarity);
    res.json({ success: true, data: { options } });
  } catch (error) {
    console.error('[Players] 生成属性方案失败:', error);
    res.status(500).json({ success: false, error: '生成属性方案失败', message: error.message });
  }
});

/**
 * POST /api/players/validate-name
 * 验证角色名（格式 + 重名检查）
 */
router.post('/validate-name', async (req, res) => {
  try {
    const { characterName, serverId } = req.body;
    const validation = PlayerService.validateCharacterName(characterName);
    if (!validation.valid) {
      return res.json({ success: true, data: { valid: false, error: validation.error } });
    }
    const nameTaken = await Player.isNameTaken(characterName, serverId);
    if (nameTaken) {
      return res.json({ success: true, data: { valid: false, error: '该角色名已被使用，请重新输入' } });
    }
    res.json({ success: true, data: { valid: true } });
  } catch (error) {
    console.error('[Players] 验证角色名失败:', error);
    res.status(500).json({ success: false, error: '验证角色名失败', message: error.message });
  }
});

/**
 * POST /api/players/create
 * 创建玩家角色
 */
router.post('/create', async (req, res) => {
  try {
    const {
      playerId, characterName, factionId, factionName,
      attributes, skills, initialTroops, serverId, initialSilver, avatar,
    } = req.body;

    if (!playerId || !characterName || !factionId || !factionName || !attributes || !serverId) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const player = await PlayerService.createCharacter({
      playerId, characterName, factionId, factionName, attributes,
      skills: skills || null, serverId, initialSilver: initialSilver || 0, avatar: avatar || null,
    });

    if (initialTroops && initialTroops.length > 0) {
      await PlayerService.addInitialTroops(playerId, initialTroops);
    }

    res.json({ success: true, message: '角色创建成功', data: player });
  } catch (error) {
    console.error('[Players] 创建角色失败:', error);
    res.status(500).json({ success: false, error: error.message || '创建角色失败' });
  }
});

/**
 * GET /api/players/:playerId/factions/available
 * 获取可用势力列表（含当前玩家数与推荐标记）
 */
router.get('/:playerId/factions/available', async (req, res) => {
  try {
    const { playerId } = req.params;
    console.log('[Factions] 获取可用势力列表, playerId:', playerId);
    const result = await playerCreationService.getAvailableFactions(playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    res.json({ success: true, data: { factions: result.factions } });
  } catch (error) {
    console.error('[Players] 获取可用势力失败:', error);
    res.status(500).json({ success: false, error: '获取可用势力失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/troops/initial
 * 获取初始部队选项
 */
router.get('/:playerId/troops/initial', async (req, res) => {
  try {
    const { factionId } = req.query;
    if (!factionId) {
      return res.status(400).json({ success: false, error: '缺少势力ID' });
    }
    const result = await playerCreationService.getInitialTroopOptions(factionId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Players] 获取初始部队选项失败:', error);
    res.status(500).json({ success: false, error: '获取初始部队选项失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/creation-progress
 * 获取角色创建进度草稿
 */
router.get('/:playerId/creation-progress', async (req, res) => {
  try {
    const progress = await playerCreationService.getCreationProgress(req.params.playerId);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('[Players] 获取角色创建进度失败:', error);
    res.status(500).json({ success: false, error: '获取角色创建进度失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/creation-progress
 * 保存角色创建进度草稿
 */
router.post('/:playerId/creation-progress', async (req, res) => {
  try {
    await playerCreationService.saveCreationProgress(req.params.playerId, req.body);
    res.json({ success: true, message: '进度已保存' });
  } catch (error) {
    console.error('[Players] 保存角色创建进度失败:', error);
    res.status(500).json({ success: false, error: '保存角色创建进度失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/generate-attributes-batch
 * 生成属性方案（新批次），扣除银两
 */
router.post('/:playerId/generate-attributes-batch', async (req, res) => {
  try {
    const { rarity = 'common' } = req.body;
    const result = await playerCreationService.generateAttributesBatch(req.params.playerId, rarity);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '未找到角色创建进度' });
    }
    if (result.insufficientSilver) {
      return res.status(400).json({ success: false, error: `银两不足，需要${result.cost}银两才能重新随机` });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 生成属性批次失败:', error);
    res.status(500).json({ success: false, error: '生成属性批次失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/select-option
 * 选择属性方案
 */
router.post('/:playerId/select-option', async (req, res) => {
  try {
    const { batch, index } = req.body;
    if (batch === undefined || index === undefined) {
      return res.status(400).json({ success: false, error: '缺少批次号或索引' });
    }
    await playerCreationService.selectAttributeOption(req.params.playerId, batch, index);
    res.json({ success: true, message: '方案已选择' });
  } catch (error) {
    console.error('[Players] 选择属性方案失败:', error);
    res.status(500).json({ success: false, error: '选择属性方案失败', message: error.message });
  }
});

/**
 * DELETE /api/players/:playerId/creation-progress
 * 删除角色创建进度草稿（角色创建完成后调用）
 */
router.delete('/:playerId/creation-progress', async (req, res) => {
  try {
    await playerCreationService.deleteCreationProgress(req.params.playerId);
    res.json({ success: true, message: '进度已删除' });
  } catch (error) {
    console.error('[Players] 删除角色创建进度失败:', error);
    res.status(500).json({ success: false, error: '删除角色创建进度失败', message: error.message });
  }
});

// ── 玩家档案与进度 ────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/character-rank?bucket=…
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

/**
 * GET /api/players/:playerId/statistics
 * 个人中心「统计」：读取 statistics 表一行（camelCase）
 */
router.get('/:playerId/statistics', async (req, res) => {
  try {
    const result = await playerStatisticsService.getPlayerStatistics(req.params.playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '统计数据不存在' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 获取统计数据失败:', error);
    res.status(500).json({ success: false, error: '获取统计数据失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/profile
 * 获取玩家完整档案（基础信息 + 卡牌）
 */
router.get('/:playerId/profile', async (req, res) => {
  try {
    const result = await playerProfileService.getPlayerProfile(req.params.playerId);
    if (result.notFound) {
      return res.status(404).json({ success: false, error: '玩家不存在' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 获取玩家档案失败:', error);
    res.status(500).json({ success: false, error: '获取玩家档案失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/progress/tutorial
 * 更新新手引导进度
 * body: { step }
 */
router.post('/:playerId/progress/tutorial', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { step } = req.body;
    if (!step || typeof step !== 'number' || step < 1) {
      return res.status(400).json({ success: false, error: '无效的步骤编号' });
    }
    await playerProfileService.updateTutorialProgress(playerId, step);
    res.json({ success: true, data: { tutorial_step: step } });
  } catch (error) {
    console.error('[Players] 更新新手引导进度失败:', error);
    res.status(500).json({ success: false, error: '更新进度失败' });
  }
});

// ── 卡牌装备（阵容编组） ──────────────────────────────────────────────────────

/**
 * POST /api/players/:playerId/cards/equip
 * 装备卡牌到指定槽位
 * body: { instanceId, equippedBy, equippedSlot }
 */
router.post('/:playerId/cards/equip', async (req, res) => {
  try {
    const result = await playerCardLineupService.equipCard(req.params.playerId, req.body);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
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
    const result = await playerCardLineupService.unequipCard(req.params.playerId, req.body);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true });
  } catch (error) {
    console.error('[Players] 卸下卡牌失败:', error);
    res.status(500).json({ success: false, error: '卸下卡牌失败', message: error.message });
  }
});

// ── 装备套装 ──────────────────────────────────────────────────────────────────

/** 装备套装 Service 错误码 → HTTP 响应映射 */
function equipmentSetHttpFromError(err) {
  const table = {
    INVALID_SLOT:                [400, '槽位无效'],
    SET_NOT_FOUND:               [404, '套装卡不存在'],
    RENAME_DRAFT_USE_FINALIZE:   [400, '草稿套装请通过「完成封装」命名'],
    EQUIPMENT_NOT_FOUND:         [404, '装备件不存在'],
    ALREADY_EQUIPPED:            [400, '该装备件已上阵，请先卸下'],
    TYPE_MISMATCH:               [400, '装备类型与槽位不符'],
    BOUND_ELSEWHERE:             [400, '该装备件已编入其他套装'],
    DUPLICATE_PIECE:             [400, '套装内不能重复放入同一件'],
    CANNOT_REMOVE_FINALIZED_SLOT:[400, '已封装装备卡仅支持更换，不可卸下'],
    INVALID_NAME:                [400, '名称需在 1～12 字'],
    ALREADY_FINALIZED:           [400, '该套装已命名'],
    INCOMPLETE:                  [400, '四个槽位均需放入装备件后才能命名'],
  };
  const row = table[err?.code];
  if (row) return { status: row[0], body: { success: false, error: row[1], code: err.code } };
  return null;
}

/**
 * GET /api/players/:playerId/equipment-set/draft
 * 获取或创建当前唯一草稿装备卡
 */
router.get('/:playerId/equipment-set/draft', async (req, res) => {
  try {
    const row  = await equipmentSetService.getOrCreateDraftSet(req.params.playerId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({ success: true, data: { instance_id: row.instance_id, equipment_set_data: data } });
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
    const row  = await equipmentSetService.getEquipmentSetById(playerId, setInstanceId);
    const data = equipmentSetService.parseSetData(row.equipment_set_data);
    res.json({ success: true, data: { instance_id: row.instance_id, equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
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
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    const data = await equipmentSetService.renameEquipmentSet(req.params.playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
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
    const { setInstanceId, slot, equipmentInstanceId } = req.body || {};
    if (!setInstanceId || !slot) {
      return res.status(400).json({ success: false, error: '缺少 setInstanceId 或 slot' });
    }
    const data = await equipmentSetService.assignSlot(
      req.params.playerId, setInstanceId, slot, equipmentInstanceId || null,
    );
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
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
    const { setInstanceId, displayName } = req.body || {};
    if (!setInstanceId) return res.status(400).json({ success: false, error: '缺少 setInstanceId' });
    const data = await equipmentSetService.finalizeSet(req.params.playerId, setInstanceId, displayName);
    res.json({ success: true, data: { equipment_set_data: data } });
  } catch (error) {
    const mapped = equipmentSetHttpFromError(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    console.error('[Players] equipment-set finalize:', error);
    res.status(500).json({ success: false, error: '命名套装失败', message: error.message });
  }
});

// ── 事件系统 ──────────────────────────────────────────────────────────────────

/**
 * POST /api/players/:playerId/rewards
 * 执行奖励发放（后端重新计算 multiplier，不信任前端传值）
 */
router.post('/:playerId/rewards', async (req, res) => {
  try {
    const out = await playerEventRewardsService.executeEventRewards(req.params.playerId, req.body);
    if (!out.ok) return res.status(out.status).json(out.json);
    res.json({ success: true, data: out.data });
  } catch (error) {
    console.error('[Players] 执行奖励失败:', error);
    res.status(500).json({ success: false, error: '执行奖励失败', message: error.message });
  }
});

/**
 * GET /api/players/:playerId/events/explore
 * 获取玩家探索事件进度（含每日重置检查）
 */
router.get('/:playerId/events/explore', async (req, res) => {
  try {
    const result = await playerExploreEventService.getExploreEvents(req.params.playerId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Players] 获取探索事件进度失败:', error);
    res.status(500).json({ success: false, error: '获取探索事件进度失败' });
  }
});

/**
 * POST /api/players/:playerId/events
 * 记录事件进度
 * body: { eventId, eventType, status?, data? }
 */
router.post('/:playerId/events', async (req, res) => {
  try {
    const { eventId, eventType, status = 'completed', data = {} } = req.body;
    if (!eventId || !eventType) {
      return res.status(400).json({ success: false, error: '缺少 eventId 或 eventType' });
    }
    const result = await playerExploreEventService.recordEventProgress(
      req.params.playerId, { eventId, eventType, status, data },
    );
    if (result.badRequest) {
      return res.status(400).json({ success: false, error: result.badRequest });
    }
    res.json({ success: true, data: { eventId: result.eventId, field: result.field, status: result.status } });
  } catch (error) {
    console.error('[Players] 记录事件进度失败:', error);
    res.status(500).json({ success: false, error: '记录事件进度失败', message: error.message });
  }
});

// ── 道具 ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/items
 * 获取玩家道具列表
 */
router.get('/:playerId/items', async (req, res) => {
  try {
    const result = await playerItemsService.listItems(req.params.playerId);
    if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
    res.json({ success: true, data: { items: result.items } });
  } catch (error) {
    console.error('[Players] 获取道具失败:', error);
    res.status(500).json({ success: false, error: '获取道具失败', message: error.message });
  }
});

/**
 * POST /api/players/:playerId/items
 * 添加道具（事件奖励发放）
 * body: { itemId, quantity? }
 */
router.post('/:playerId/items', async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const result = await playerItemsService.addItem(req.params.playerId, itemId, quantity);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: { itemId: result.itemId, quantity: result.quantity } });
  } catch (error) {
    console.error('[Players] 添加道具失败:', error);
    res.status(500).json({ success: false, error: '添加道具失败', message: error.message });
  }
});

/**
 * DELETE /api/players/:playerId/items
 * 消耗道具（事件链 required_items 扣除）
 * body: { itemId, quantity? }
 */
router.delete('/:playerId/items', async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const result = await playerItemsService.consumeItem(req.params.playerId, itemId, quantity);
    if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: { itemId: result.itemId, remaining: result.remaining } });
  } catch (error) {
    console.error('[Players] 消耗道具失败:', error);
    res.status(500).json({ success: false, error: '消耗道具失败', message: error.message });
  }
});

// ── 探索配额 ──────────────────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/explore-quota
 * 获取探索配额（服务端计算恢复，防跨浏览器重复恢复）
 */
router.get('/:playerId/explore-quota', async (req, res) => {
  try {
    const data = await playerExploreQuotaService.getExploreQuotaState(req.params.playerId);
    res.json({
      success: true,
      data: {
        remaining:      data.remaining,
        lastRefillTs:   data.lastRefillTs,
        max:            data.max,
        refillPerHour:  data.refillPerHour,
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
    const { action } = req.body;
    if (!['consume', 'refund', 'fillMax'].includes(action)) {
      return res.status(400).json({ success: false, error: '无效的 action' });
    }
    const result = await playerExploreQuotaService.applyExploreQuotaAction(req.params.playerId, action);
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 更新探索配额失败:', error);
    res.status(500).json({ success: false, error: '更新探索配额失败' });
  }
});

// ── 属性随机（在线随机） ───────────────────────────────────────────────────────

/**
 * GET /api/players/:playerId/reroll-status
 * 获取属性随机状态
 */
router.get('/:playerId/reroll-status', async (req, res) => {
  try {
    const result = await playerRerollService.getRerollStatus(req.params.playerId);
    if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
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
    const result = await playerRerollService.rerollAttributes(req.params.playerId);
    if (result.notFound)   return res.status(404).json({ success: false, error: '玩家不存在' });
    if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
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
    const { batch, index } = req.body;
    const result = await playerRerollService.rerollConfirm(req.params.playerId, batch, index);
    if (result.notFound)   return res.status(404).json({ success: false, error: '玩家不存在' });
    if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[Players] 确认属性方案失败:', error);
    res.status(500).json({ success: false, error: '确认属性方案失败', message: error.message });
  }
});

module.exports = router;
