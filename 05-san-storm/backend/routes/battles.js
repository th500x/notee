/**
 * 战斗记录API路由
 * 提供战斗记录的保存、查询、收藏功能
 * 战后副作用（积分/宝箱/兵力/士气/耐久）全部委托 battleService 处理
 */

const express = require('express');
const router = express.Router();
const battleService = require('../services/battleService');
const campaignService = require('../services/campaignService');
const statisticsDeltaService = require('../services/statisticsDeltaService');
const smallMapBattleLootService = require('../services/smallMapBattleLootService');
const banditRaidSettlementService = require('../services/banditRaidSettlementService');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');

/**
 * 鉴权：本路由全部端点都依赖 query/body 中的 `playerId` 读写玩家私有数据，
 * 故顶层挂 `requireAuth` 关闭匿名访问。
 *
 * **未在本轮处理**：细粒度 `requireSelf`（要求 token.sub === query.playerId / body.playerId）
 * 留待下一阶段；当前实现允许"已登录用户在 body 内填别人 id"，
 * 与 `routes/pvp.js#assertSelf` 的细粒度自校验一致后，再在每个 handler 里补 helper。
 */
router.use(requireAuth);

/**
 * 获取玩家战斗记录列表
 * GET /api/battles?playerId=xxx&filter=all
 * 
 * 查询参数：
 * - playerId: 玩家ID（必填）
 * - filter: 筛选类型（可选，默认all）
 *   - all: 全部
 *   - pvp: 所有PVP战斗
 *   - campaign: 战役PVE
 *   - event: 事件PVE
 *   - favorited: 仅收藏
 */
router.get('/', async (req, res, next) => {
  try {
    const { playerId, filter } = req.query;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId参数'
      });
    }

    const battles = await battleService.getBattles(playerId, filter);

    res.json({
      success: true,
      battles,
      count: battles.length
    });
  } catch (error) {
    return next(wrap500(error, '获取战斗记录失败'));
  }
});

/**
 * 获取单条战斗记录详情
 * GET /api/battles/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const battle = await battleService.getBattleDetail(req.params.id);

    if (!battle) {
      return res.status(404).json({
        success: false,
        message: '战斗记录不存在'
      });
    }

    res.json({
      success: true,
      battle
    });
  } catch (error) {
    return next(wrap500(error, '获取战斗详情失败'));
  }
});

/**
 * 保存战斗记录
 * POST /api/battles
 * 
 * Body: {
 *   battleId, playerId, warId?,
 *   battleType, opponentType, opponentId?, opponentName?,
 *   result,
 *   playerTeam?, opponentTeam?, battleLog?,
 *   totalDamageDealt?, totalDamageTaken?, totalKills?, duration?,
 *   rewards?
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    const { battleId, playerId, battleType, opponentType, result } = req.body;

    // 必填字段校验
    if (!battleId || !playerId || !battleType || !opponentType || !result) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：battleId, playerId, battleType, opponentType, result'
      });
    }

    // 枚举值校验
    const validBattleTypes = [
      'pvp_field',
      'pvp_siege',
      'pvp_defense',
      'pve_campaign',
      'pve_event',
      'pve_siege',
      'pve_bandit',
    ];
    const validOpponentTypes = ['player', 'campaign_enemy', 'event_enemy'];
    const validResults = ['win', 'lose', 'draw'];

    if (!validBattleTypes.includes(battleType)) {
      return res.status(400).json({ success: false, message: `无效的battleType: ${battleType}` });
    }
    if (!validOpponentTypes.includes(opponentType)) {
      return res.status(400).json({ success: false, message: `无效的opponentType: ${opponentType}` });
    }
    if (!validResults.includes(result)) {
      return res.status(400).json({ success: false, message: `无效的result: ${result}` });
    }

    const battle = await battleService.saveBattle(req.body);

    const { rewards, chestRewards, troopCasualties, moraleUpdates } = req.body;

    // statistics 场次/胜负/杀伤 在 battleService.saveBattle 内累加（与攻城等服务端写战报共用）
    // 战役：客户端上报自动战斗银两 + 出征粮草（避免与事件奖励/攻城结算重复计数）
    if (battleType === 'pve_campaign') {
      await statisticsDeltaService.incrementSpent(playerId, {
        silver: Math.max(0, Math.floor(Number(req.body.battleSilverSpent) || 0)),
        food: Math.max(0, Math.floor(Number(req.body.deploymentFoodSpent) || 0)),
      });
    }

    // 战役 PVE：写入 player_progress.campaign_progress
    if (!req.body.recordOnly && battleType === 'pve_campaign') {
      const campaignId = rewards?.campaignId || req.body.campaignId;
      if (campaignId) {
        try {
          const battleScore = rewards?.battleScore ?? req.body.battleScore;
          await campaignService.applyBattleSettlement({
            playerId,
            campaignId,
            battleId,
            result,
            battleScore,
          });
        } catch (ce) {
          console.error('[battles] campaign settlement:', ce);
        }
      }
    }

    // 仅写入战报（驻守防守 recordOnly）：补积分后直接返回，不改兵力/士气/耐久/宝箱
    if (req.body.recordOnly) {
      await battleService.applyBattleScore(playerId, rewards?.battleScore);
      return res.status(201).json({ success: true, battle });
    }

    // 积分、宝箱、部队/玩家状态均委托 battleService，与主流程路径隔离
    await battleService.applyBattleScore(playerId, rewards?.battleScore);
    await battleService.saveChestRewards(playerId, chestRewards);
    const postEffects = await battleService.applyBattlePostEffects(playerId, { troopCasualties, moraleUpdates });

    let banditBadgeGranted = null;
    let banditBadgeError = null;
    if (!req.body.recordOnly && result === 'win' && battleType === 'pve_bandit' && rewards?.banditRaidSettlement) {
      const settle = await banditRaidSettlementService.applyBanditRaidVictory(playerId, rewards.banditRaidSettlement);
      if (!settle.ok) {
        return res.status(400).json({
          success: false,
          message: settle.error || '匪寨进度结算失败',
        });
      }
      if (settle.banditBadgeGranted) banditBadgeGranted = settle.banditBadgeGranted;
      if (settle.banditBadgeError) banditBadgeError = settle.banditBadgeError;
    }

    if (!req.body.recordOnly && result === 'win' && rewards?.smallMapPveLoot) {
      try {
        await smallMapBattleLootService.applyDeclaredSmallMapPveLoot(playerId, rewards.smallMapPveLoot);
      } catch (lootErr) {
        console.error('[battles] smallMapPveLoot 发放失败:', lootErr);
      }
    }

    res.status(201).json({
      success: true,
      battle,
      veteranPromotions: postEffects?.veteranPromotions || [],
      ...(banditBadgeGranted ? { banditBadgeGranted } : {}),
      ...(banditBadgeError ? { banditBadgeError } : {}),
    });
  } catch (error) {
    // 这里有意保留多行 console.error 诊断（仅服务端可见），便于查 SQL / sqlMessage / sqlCode；
    // 前端响应统一走 errorHandler，不再带 sqlMessage / sqlCode 等数据库元信息回传
    console.error('[battles] ========================================');
    console.error('[battles] 保存战斗记录失败:', error && error.message);
    if (error && error.sqlMessage) console.error('[battles] MySQL:', error.code, error.sqlMessage);
    console.error('[battles] ========================================');
    return next(wrap500(error, '保存战斗记录失败'));
  }
});

/**
 * 收藏战斗
 * POST /api/battles/favorite
 * Body: { playerId, battleId }
 */
router.post('/favorite', async (req, res, next) => {
  try {
    const { playerId, battleId } = req.body;

    if (!playerId || !battleId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId或battleId'
      });
    }

    const result = await battleService.favoriteBattle(playerId, battleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    return next(wrap500(error, '收藏失败'));
  }
});

/**
 * 取消收藏
 * POST /api/battles/unfavorite
 * Body: { playerId, battleId }
 */
router.post('/unfavorite', async (req, res, next) => {
  try {
    const { playerId, battleId } = req.body;

    if (!playerId || !battleId) {
      return res.status(400).json({
        success: false,
        message: '缺少playerId或battleId'
      });
    }

    const result = await battleService.unfavoriteBattle(playerId, battleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    return next(wrap500(error, '取消收藏失败'));
  }
});

module.exports = router;
