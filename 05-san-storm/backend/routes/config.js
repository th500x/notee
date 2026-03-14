/**
 * 配置数据API路由
 * 提供将领、部队、技能等配置数据
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { validateTroopQuery, validateTroopId } = require('../middleware/validation');

/**
 * 获取所有部队配置
 * GET /api/config/troops
 * 
 * 查询参数：
 * - season: 赛季ID（可选，如：san_1）
 * - rarity: 稀有度（可选，如：common, rare, epic, legendary, core）
 * - troopType: 兵种类型（可选，如：infantry, cavalry, archer）
 */
router.get('/troops', validateTroopQuery, async (req, res) => {
  try {
    const { season, rarity, troopType } = req.query;
    
    const troops = await configService.getTroops({
      season,
      rarity,
      troopType
    });
    
    res.json({
      success: true,
      troops,
      count: troops.length
    });
    
  } catch (error) {
    console.error('[config/troops] 获取部队配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取部队配置失败',
      error: error.message
    });
  }
});

/**
 * 获取单个部队配置
 * GET /api/config/troops/:id
 */
router.get('/troops/:id', validateTroopId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const troop = await configService.getTroopById(id);
    
    if (!troop) {
      return res.status(404).json({
        success: false,
        message: '部队不存在'
      });
    }
    
    res.json({
      success: true,
      troop
    });
    
  } catch (error) {
    console.error('[config/troops/:id] 获取部队配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取部队配置失败',
      error: error.message
    });
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
router.get('/characters', async (req, res) => {
  try {
    const { season, rarity, faction, characterType, stage } = req.query;
    
    const characters = await configService.getCharacters({
      season,
      rarity,
      faction,
      characterType,
      stage
    });
    
    res.json({
      success: true,
      characters,
      count: characters.length
    });
    
  } catch (error) {
    console.error('[config/characters] 获取将领配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取将领配置失败',
      error: error.message
    });
  }
});

/**
 * 获取单个将领配置
 * GET /api/config/characters/:id
 */
router.get('/characters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const character = await configService.getCharacterById(id);
    
    if (!character) {
      return res.status(404).json({
        success: false,
        message: '将领不存在'
      });
    }
    
    res.json({
      success: true,
      character
    });
    
  } catch (error) {
    console.error('[config/characters/:id] 获取将领配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取将领配置失败',
      error: error.message
    });
  }
});

module.exports = router;
