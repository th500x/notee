/**
 * 城市系统API路由
 *
 * 提供城市信息查询、攻城发起、战斗结果记录、归属判定
 *
 * @module backend/routes/cities
 */

const express = require('express');
const router = express.Router();
const cityService = require('../services/cityService');
const roadEncounterService = require('../services/roadEncounterService');
const { pool } = require('../database/connection');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const citySchemas = require('../middleware/validationSchemas/cities');
const {
  getTacticTokenCount,
  tryConsumeTacticTokenOnce,
  refundTacticTokenOnce,
  TACTIC_TOKEN_COST_PER_SIEGE_BATTLE,
  TACTIC_TOKEN_ITEM_ID,
} = require('../services/tacticTokenService');

router.use(requireAuth);

/**
 * GET /api/cities
 */
router.get('/', validateQuery(citySchemas.listCitiesQuery), async (req, res, next) => {
  try {
    const { season, junId, jun_id } = req.query;
    const jid = String(junId || jun_id || '').trim();
    const seasonTrim = season ? String(season).trim() : '';
    const cities = await cityService.listCitiesForApi({
      season: seasonTrim || undefined,
      junId: jid || undefined,
    });
    res.json({ success: true, cities, count: cities.length });
  } catch (error) {
    return next(wrap500(error, '获取城市列表失败'));
  }
});

/**
 * GET /api/cities/road-presence
 */
router.get('/road-presence', citySchemas.validateRoadPresenceQuery, async (req, res, next) => {
  try {
    const { season, junId, jun_id } = req.query;
    const jid = String(junId || jun_id || '').trim();
    const s = String(season || '').trim();
    const caller = String(req.query.playerId || req.query.player_id || '').trim();
    const out = await roadEncounterService.getRoadPresence(s, jid, caller);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  } catch (error) {
    return next(wrap500(error, '获取道路 presence 失败'));
  }
});

/**
 * GET /api/cities/active-pve-siege-wars
 */
router.get(
  '/active-pve-siege-wars',
  validateQuery(citySchemas.activePveSiegeWarsQuery),
  async (req, res, next) => {
    try {
      const season = String(req.query.season || '').trim();
      const playerId = String(req.query.playerId || req.query.player_id || '').trim();
      const factionId = String(req.query.factionId || req.query.faction_id || '').trim();
      if (req.player.role !== 'admin' && String(req.player.sub) !== playerId) {
        return res.status(403).json({ success: false, error: '无权访问他人数据' });
      }
      const wars = await cityService.listActivePveSiegeTargetsForMap({ playerId, factionId, season });
      res.json({ success: true, wars, count: wars.length });
    } catch (error) {
      return next(wrap500(error, '获取活跃 PVE 攻城列表失败'));
    }
  },
);

/**
 * GET /api/cities/active-pve-base-camps — 大地图渲染 PVE 攻方大本营 footprint
 */
router.get(
  '/active-pve-base-camps',
  validateQuery(citySchemas.activePveBaseCampsQuery),
  async (req, res, next) => {
    try {
      const season = String(req.query.season || 'san_1').trim() || 'san_1';
      const pveWarBaseCampService = require('../services/pveWarBaseCampService');
      const camps = await pveWarBaseCampService.listActivePveBaseCampsForMap({ season });
      res.json({ success: true, camps, count: camps.length });
    } catch (error) {
      if (error.statusCode === 503 || error.code === 'PVE_BASE_CAMP_SCHEMA') {
        return res.status(503).json({
          success: false,
          error: error.message,
          code: 'PVE_BASE_CAMP_SCHEMA',
        });
      }
      return next(wrap500(error, '获取 PVE 大本营列表失败'));
    }
  },
);

/**
 * GET /api/cities/war/:warId
 */
router.get('/war/:warId', validateParams(citySchemas.warIdParam), async (req, res, next) => {
  try {
    const war = await cityService.getWarStatus(req.params.warId);
    if (!war) return res.status(404).json({ success: false, error: '战事不存在' });
    res.json({ success: true, data: war });
  } catch (error) {
    return next(wrap500(error, '获取战事状态失败'));
  }
});

/**
 * POST /api/cities/siege-result
 */
router.post('/siege-result', validateBody(citySchemas.siegeResultBody), async (req, res, next) => {
  try {
    const { warId, playerId, factionId, killedIndices, result, silverSpent,
      battleScore, battleReportSaved,
      defenderType, defenderPlayerId, defenderGarrisonSlot, garrisonUnits, npcBatchIndex,
      defenderLineupTroopUpdates } = req.body;

    const data = await cityService.recordSiegeResult(
      warId, playerId, factionId, killedIndices || [], result || 'win', silverSpent || 0,
      {
        defenderType, defenderPlayerId, defenderGarrisonSlot, garrisonUnits, npcBatchIndex,
        battleScore, battleReportSaved,
        defenderLineupTroopUpdates,
      },
    );
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '记录攻城结果失败'));
  }
});

/**
 * GET /api/cities/:cityId
 */
router.get('/:cityId', validateParams(citySchemas.cityIdParam), async (req, res, next) => {
  try {
    const city = await cityService.getCityInfo(req.params.cityId);
    if (!city) return res.status(404).json({ success: false, error: '城市不存在' });
    const { npcGarrisonLedgerAt, ...data } = city;
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '获取城市详情失败'));
  }
});

/**
 * POST /api/cities/:cityId/generate-npc
 */
router.post(
  '/:cityId/generate-npc',
  validateParams(citySchemas.cityIdParam),
  validateBody(citySchemas.generateNpcBody),
  async (req, res, next) => {
    try {
      const raw = req.body?.troopCountOverride ?? req.body?.troopCount;
      const n = raw != null && raw !== '' ? Number(raw) : NaN;
      const opts = Number.isFinite(n) && n > 0 ? { troopCountOverride: Math.floor(n) } : {};
      const result = await cityService.generateNpcGarrison(req.params.cityId, opts);
      res.json({ success: true, data: result });
    } catch (error) {
      return next(wrap500(error, '生成NPC守军失败'));
    }
  },
);

/**
 * POST /api/cities/:cityId/siege
 */
router.post(
  '/:cityId/siege',
  validateParams(citySchemas.cityIdParam),
  validateBody(citySchemas.siegeBody),
  async (req, res, next) => {
    try {
      const { playerId } = req.body;
      const result = await cityService.initiateSiege(req.params.cityId, playerId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[Cities] 发起攻城失败:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

/**
 * POST /api/cities/:cityId/siege-authoritative-resolve
 * Body: { playerId } — PVE 中立城权威一场（含结算）；供冲锋动画
 */
router.post(
  '/:cityId/siege-authoritative-resolve',
  validateParams(citySchemas.cityIdParam),
  validateBody(citySchemas.siegeBody),
  async (req, res) => {
    try {
      const { playerId, continueChain } = req.body;
      const data = await cityService.resolveAuthoritativePveSiege(req.params.cityId, playerId, {
        continueChain: continueChain === true,
      });
      if (!data?.ok) {
        return res.status(400).json({
          success: false,
          error: data?.reason || data?.error || '攻城自动战斗失败',
          stop: !!data?.stop,
        });
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error('[Cities] 攻城权威结算失败:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

/**
 * GET /api/cities/:cityId/active-war
 */
router.get('/:cityId/active-war', validateParams(citySchemas.cityIdParam), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [req.params.cityId],
    );
    if (!rows.length) return res.json({ success: true, data: null });
    const war = rows[0];
    let factionKills = {};
    if (war.faction_kills) {
      factionKills = typeof war.faction_kills === 'string' ? JSON.parse(war.faction_kills) : war.faction_kills;
    }
    res.json({ success: true, data: { ...war, faction_kills: factionKills } });
  } catch (error) {
    return next(wrap500(error, '获取战事失败'));
  }
});

/**
 * GET /api/cities/:cityId/siege-quota
 * 现返回持有兵符数（`item_tactic_token`）；路径保留兼容。开战扣减见 `cityService.consumeSiegeQuotaForBattleStart`。
 */
router.get(
  '/:cityId/siege-quota',
  validateParams(citySchemas.cityIdParam),
  validateQuery(citySchemas.siegeQuotaQuery),
  async (req, res, next) => {
    try {
      const { playerId } = req.query;
      const remaining = await getTacticTokenCount(playerId);
      res.json({
        success: true,
        data: {
          remaining,
          costPerBattle: TACTIC_TOKEN_COST_PER_SIEGE_BATTLE,
          costItemId: TACTIC_TOKEN_ITEM_ID,
        },
      });
    } catch (error) {
      return next(wrap500(error, '获取攻城兵符失败'));
    }
  },
);

/**
 * POST /api/cities/:cityId/siege-quota
 * 运维：`consume` / `refund` 兵符；**开战扣费**仍以 initiate 内 `consumeSiegeQuotaForBattleStart` 为准。
 */
router.post(
  '/:cityId/siege-quota',
  validateParams(citySchemas.cityIdParam),
  validateBody(citySchemas.siegeQuotaBody),
  async (req, res, next) => {
    try {
      const { playerId, action } = req.body;
      if (action === 'consume') {
        const ok = await tryConsumeTacticTokenOnce(playerId);
        if (!ok) return res.status(400).json({ success: false, error: '兵符不足' });
      } else if (action === 'refund') {
        await refundTacticTokenOnce(playerId);
      } else if (action === 'fillMax') {
        return res.status(400).json({ success: false, error: '攻城已改为兵符消耗，不再支持 fillMax 次数' });
      } else {
        return res.status(400).json({ success: false, error: '未知 action' });
      }
      const remaining = await getTacticTokenCount(playerId);
      res.json({
        success: true,
        data: {
          remaining,
          costPerBattle: TACTIC_TOKEN_COST_PER_SIEGE_BATTLE,
          costItemId: TACTIC_TOKEN_ITEM_ID,
        },
      });
    } catch (error) {
      return next(wrap500(error, '更新攻城兵符失败'));
    }
  },
);

module.exports = router;
