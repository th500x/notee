/**
 * 配置数据API路由
 * 提供将领、部队、技能等配置数据
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { pool } = require('../database/connection');
const { validateTroopQuery, validateTroopId } = require('../middleware/validation');
const { wrap500 } = require('../utils/httpError');

/**
 * 获取所有部队配置
 * GET /api/config/troops
 *
 * 查询参数：
 * - season: 赛季ID（可选，如：san_1）
 * - rarity: 稀有度（可选，如：common, rare, epic, legendary, core）
 * - troopType: 兵种类型（可选，如：infantry, cavalry, archer）
 */
router.get('/troops', validateTroopQuery, async (req, res, next) => {
  try {
    const { season, rarity, troopType } = req.query;

    const troops = await configService.getTroops({ season, rarity, troopType });

    res.json({ success: true, troops, count: troops.length });
  } catch (error) {
    return next(wrap500(error, '获取部队配置失败'));
  }
});

/**
 * 获取单个部队配置
 * GET /api/config/troops/:id
 */
router.get('/troops/:id', validateTroopId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const troop = await configService.getTroopById(id);

    if (!troop) {
      return res.status(404).json({ success: false, message: '部队不存在' });
    }

    res.json({ success: true, troop });
  } catch (error) {
    return next(wrap500(error, '获取部队配置失败'));
  }
});

/**
 * 获取所有将领配置
 * GET /api/config/characters
 *
 * 查询参数：
 * - season: 赛季ID（可选，如：san_1）
 * - rarity: 稀有度（可选，如：common, rare, epic, legendary, core）
 * - faction: 势力（可选，如：刘备、曹操）
 * - characterType: 将领类型（可选，如：military, strategist, balanced）
 * - stage: 生涯（可选，如：early, middle, late）
 */
router.get('/characters', async (req, res, next) => {
  try {
    const { season, rarity, faction, characterType, stage } = req.query;

    const characters = await configService.getCharacters({
      season,
      rarity,
      faction,
      characterType,
      stage,
    });

    res.json({ success: true, characters, count: characters.length });
  } catch (error) {
    return next(wrap500(error, '获取将领配置失败'));
  }
});

/**
 * 获取单个将领配置
 * GET /api/config/characters/:id
 */
router.get('/characters/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const character = await configService.getCharacterById(id);

    if (!character) {
      return res.status(404).json({ success: false, message: '将领不存在' });
    }

    res.json({ success: true, character });
  } catch (error) {
    return next(wrap500(error, '获取将领配置失败'));
  }
});

/**
 * 获取所有装备件配置
 * GET /api/config/equipment
 *
 * 查询参数：
 * - season: 赛季ID（可选）
 * - equipmentType: weapon / armor / accessory（可选）
 * - rarity: common / rare / epic / legendary / core（可选）
 */
router.get('/equipment', async (req, res, next) => {
  try {
    const { season, equipmentType, rarity } = req.query;
    const equipment = await configService.getEquipment({ season, equipmentType, rarity });

    res.json({ success: true, equipment, count: equipment.length });
  } catch (error) {
    return next(wrap500(error, '获取装备件配置失败'));
  }
});

/**
 * 获取单个装备件配置
 * GET /api/config/equipment/:id
 */
router.get('/equipment/:id', async (req, res, next) => {
  try {
    const equipment = await configService.getEquipmentById(req.params.id);

    if (!equipment) {
      return res.status(404).json({ success: false, message: '装备件不存在' });
    }

    res.json({ success: true, equipment });
  } catch (error) {
    return next(wrap500(error, '获取装备件配置失败'));
  }
});

/**
 * 获取单个称号配置
 * GET /api/config/titles/:id
 */
router.get('/titles/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM config_titles WHERE title_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '称号不存在' });
    const t = rows[0];
    let attributeBonus = {};
    try { attributeBonus = typeof t.attribute_bonus === 'string' ? JSON.parse(t.attribute_bonus) : (t.attribute_bonus || {}); } catch {}
    // 从ID解析稀有度
    const rarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
    const parts = t.title_id.split('_');
    const rarity = rarityMap[parts[parts.length - 1]?.charAt(0)] || 'common';
    res.json({
      success: true,
      title: {
        id: t.title_id, name: t.title_name, rarity,
        description: t.description, displayName: t.display_name,
        attributeBonus, specialEffect: t.special_effect, specialEffectDesc: t.special_effect_desc,
      }
    });
  } catch (error) {
    return next(wrap500(error, '获取称号配置失败'));
  }
});

/**
 * 获取事件配置
 * GET /api/config/events
 *
 * 查询参数：
 * - location: 触发地点（可选，如占位符或主城 id：`san_1_city_2_yangdi`）
 * - triggerContext: 触发场景（可选，如：explore、tutorial）
 */
router.get('/events', async (req, res, next) => {
  try {
    const { location, triggerContext } = req.query;
    const events = await configService.getEvents({ location, triggerContext });
    res.json({ success: true, events, count: events.length });
  } catch (error) {
    return next(wrap500(error, '获取事件配置失败'));
  }
});

/**
 * 获取单个事件配置
 * GET /api/config/events/:id
 */
router.get('/events/:id', async (req, res, next) => {
  try {
    const event = await configService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在' });
    }
    res.json({ success: true, event });
  } catch (error) {
    return next(wrap500(error, '获取事件配置失败'));
  }
});

/**
 * 获取道具配置
 * GET /api/config/items
 */
router.get('/items', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT item_id, item_name, description, item_type, special_effect FROM config_items ORDER BY item_id'
    );
    res.json({ success: true, items: rows });
  } catch (error) {
    return next(wrap500(error, '获取道具配置失败'));
  }
});

module.exports = router;
