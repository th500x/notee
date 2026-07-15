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
  calcHourlyQuotaWithRestWindow,
  EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
} = require('../utils/hourlyQuotaWithRestWindow');

router.use(requireAuth);

const SIEGE_REFILL_PER_HOUR = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.refillPerHour;
const SIEGE_MAX_QUOTA = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.maxQuota;

function calcSiegeQuota(remaining, lastRefillTs) {
  return calcHourlyQuotaWithRestWindow(remaining, lastRefillTs, new Date(), EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS);
}

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
 */
router.get(
  '/:cityId/siege-quota',
  validateParams(citySchemas.cityIdParam),
  validateQuery(citySchemas.siegeQuotaQuery),
  async (req, res, next) => {
    try {
      const { playerId } = req.query;
      await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
      const [rows] = await pool.query(
        'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ?',
        [playerId],
      );
      const row = rows[0] || {};
      const saved = calcSiegeQuota(row.siege_quota_remaining, row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null);
      if (saved.lastRefillTs !== (row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null) || saved.remaining !== row.siege_quota_remaining) {
        await pool.query(
          'UPDATE player_events SET siege_quota_remaining = ?, siege_quota_refill_ts = ? WHERE player_id = ?',
          [saved.remaining, String(saved.lastRefillTs), playerId],
        );
      }
      res.json({
        success: true,
        data: {
          remaining: saved.remaining,
          lastRefillTs: saved.lastRefillTs,
          max: SIEGE_MAX_QUOTA,
          refillPerHour: SIEGE_REFILL_PER_HOUR,
        },
      });
    } catch (error) {
      return next(wrap500(error, '获取攻城配额失败'));
    }
  },
);

/**
 * POST /api/cities/:cityId/siege-quota
 * `consume` / `refund` / `fillMax` 运维与遗留 hook；**开战扣次**见 `cityService.consumeSiegeQuotaForBattleStart`（17-4 §2.4）。
 */
router.post(
  '/:cityId/siege-quota',
  validateParams(citySchemas.cityIdParam),
  validateBody(citySchemas.siegeQuotaBody),
  async (req, res, next) => {
    try {
      const { playerId, action } = req.body;
      await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
      const [rows] = await pool.query(
        'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ?',
        [playerId],
      );
      const row = rows[0] || {};
      const current = calcSiegeQuota(row.siege_quota_remaining, row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null);
      let newRemaining = current.remaining;
      if (action === 'consume') {
        if (newRemaining <= 0) return res.status(400).json({ success: false, error: '攻城次数不足' });
        newRemaining -= 1;
      } else if (action === 'refund') {
        newRemaining = Math.min(newRemaining + 1, SIEGE_MAX_QUOTA);
      } else if (action === 'fillMax') {
        newRemaining = SIEGE_MAX_QUOTA;
      }
      await pool.query(
        'UPDATE player_events SET siege_quota_remaining = ?, siege_quota_refill_ts = ? WHERE player_id = ?',
        [newRemaining, String(current.lastRefillTs), playerId],
      );
      res.json({
        success: true,
        data: { remaining: newRemaining, lastRefillTs: current.lastRefillTs, max: SIEGE_MAX_QUOTA },
      });
    } catch (error) {
      return next(wrap500(error, '更新攻城配额失败'));
    }
  },
);

module.exports = router;
