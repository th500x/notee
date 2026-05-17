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
const {
  calcHourlyQuotaWithRestWindow,
  EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS,
} = require('../utils/hourlyQuotaWithRestWindow');

/**
 * 鉴权：含 GET 城况列表 / 详情 / 道路 presence + POST 攻城 / 配额变更等。
 * 现阶段所有端点都在登录后调用（角色创建步骤完成 → 进入大地图 → 才会触发 cities API），
 * 顶层挂 `requireAuth` 关闭匿名访问。细粒度 `requireSelf` 留下一阶段。
 */
router.use(requireAuth);

// ── 攻城配额（与探索配额算法同源：`hourlyQuotaWithRestWindow.js`） ──
const SIEGE_REFILL_PER_HOUR = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.refillPerHour;
const SIEGE_MAX_QUOTA = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.maxQuota;
const SIEGE_REST_START = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.restHourStart;
const SIEGE_REST_END = EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS.restHourEnd;

function calcSiegeQuota(remaining, lastRefillTs) {
  return calcHourlyQuotaWithRestWindow(remaining, lastRefillTs, new Date(), EXPLORATION_AND_SIEGE_QUOTA_DEFAULTS);
}

/**
 * GET /api/cities
 * 获取所有城市列表
 */
router.get('/', async (req, res, next) => {
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
 * GET /api/cities/road-presence?season=san_1&junId=...
 * 返回郡内 **在线** 他人道路坐标摘要 + road_encounters 锁格（02 §2.1.2（3）、31-6 §十二）。
 * 注意：本路由必须在 `/:cityId` 之前注册，避免被其吞掉。
 */
router.get('/road-presence', async (req, res, next) => {
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
 * GET /api/cities/active-pve-siege-wars?season=san_1&playerId=…&factionId=…
 * 大地图「攻城」钮：与 `wars_pvp` 共用攻城次数；返回本人有参与的 **active PVE wars** 目标城列表（见 cityService.listActivePveSiegeTargetsForMap）。
 * 须在 `/:cityId` 之前注册。
 */
router.get('/active-pve-siege-wars', async (req, res, next) => {
  try {
    const season = String(req.query.season || '').trim();
    const playerId = String(req.query.playerId || req.query.player_id || '').trim();
    const factionId = String(req.query.factionId || req.query.faction_id || '').trim();
    if (!season) return res.status(400).json({ success: false, error: '缺少 season' });
    if (!playerId || !factionId) {
      return res.status(400).json({ success: false, error: '缺少 playerId / factionId' });
    }
    if (req.player.role !== 'admin' && String(req.player.sub) !== playerId) {
      return res.status(403).json({ success: false, error: '无权访问他人数据' });
    }
    const wars = await cityService.listActivePveSiegeTargetsForMap({ playerId, factionId, season });
    res.json({ success: true, wars, count: wars.length });
  } catch (error) {
    return next(wrap500(error, '获取活跃 PVE 攻城列表失败'));
  }
});

/**
 * GET /api/cities/:cityId
 * 获取单个城市详情（含 NPC 守军）
 */
router.get('/:cityId', async (req, res, next) => {
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
 * 为城市生成/刷新 NPC 守军
 */
router.post('/:cityId/generate-npc', async (req, res, next) => {
  try {
    const raw = req.body?.troopCountOverride ?? req.body?.troopCount;
    const n = raw != null && raw !== '' ? Number(raw) : NaN;
    const opts = Number.isFinite(n) && n > 0 ? { troopCountOverride: Math.floor(n) } : {};
    const result = await cityService.generateNpcGarrison(req.params.cityId, opts);
    res.json({ success: true, data: result });
  } catch (error) {
    return next(wrap500(error, '生成NPC守军失败'));
  }
});

/**
 * POST /api/cities/:cityId/siege
 * 发起攻城战（返回 NPC 守军供前端战斗使用）
 * body: { playerId }
 */
router.post('/:cityId/siege', async (req, res, next) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ success: false, error: '缺少 playerId' });

    const result = await cityService.initiateSiege(req.params.cityId, playerId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Cities] 发起攻城失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cities/siege-result
 * 记录攻城战斗结果
 * body: { warId, playerId, factionId, killedIndices, result }
 */
router.post('/siege-result', async (req, res, next) => {
  try {
    const { warId, playerId, factionId, killedIndices, result, silverSpent,
            battleScore, battleReportSaved,
            defenderType, defenderPlayerId, defenderGarrisonSlot, garrisonUnits, npcBatchIndex,
            defenderLineupTroopUpdates } = req.body;
    if (!warId || !playerId || !factionId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const data = await cityService.recordSiegeResult(
      warId, playerId, factionId, killedIndices || [], result || 'win', silverSpent || 0,
      {
        defenderType, defenderPlayerId, defenderGarrisonSlot, garrisonUnits, npcBatchIndex,
        battleScore, battleReportSaved,
        defenderLineupTroopUpdates,
      }
    );
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '记录攻城结果失败'));
  }
});

/**
 * GET /api/cities/:cityId/active-war
 * 获取城市当前活跃战事（势力击杀排行）
 */
router.get('/:cityId/active-war', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM wars WHERE target_city_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [req.params.cityId]
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
 * 获取攻城配额（与探索配额机制一致）
 */
router.get('/:cityId/siege-quota', async (req, res, next) => {
  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ success: false, error: '缺少 playerId' });
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ?',
      [playerId]
    );
    const row = rows[0] || {};
    const saved = calcSiegeQuota(row.siege_quota_remaining, row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null);
    if (saved.lastRefillTs !== (row.siege_quota_refill_ts ? Number(row.siege_quota_refill_ts) : null) || saved.remaining !== row.siege_quota_remaining) {
      await pool.query(
        'UPDATE player_events SET siege_quota_remaining = ?, siege_quota_refill_ts = ? WHERE player_id = ?',
        [saved.remaining, String(saved.lastRefillTs), playerId]
      );
    }
    res.json({ success: true, data: { remaining: saved.remaining, lastRefillTs: saved.lastRefillTs, max: SIEGE_MAX_QUOTA, refillPerHour: SIEGE_REFILL_PER_HOUR } });
  } catch (error) {
    return next(wrap500(error, '获取攻城配额失败'));
  }
});

/**
 * POST /api/cities/:cityId/siege-quota
 * 更新攻城配额
 * body: { playerId, action: 'consume' | 'refund' | 'fillMax' }
 */
router.post('/:cityId/siege-quota', async (req, res, next) => {
  try {
    const { playerId, action } = req.body;
    if (!playerId || !['consume', 'refund', 'fillMax'].includes(action)) {
      return res.status(400).json({ success: false, error: '参数错误' });
    }
    await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [playerId]);
    const [rows] = await pool.query(
      'SELECT siege_quota_remaining, siege_quota_refill_ts FROM player_events WHERE player_id = ?',
      [playerId]
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
      [newRemaining, String(current.lastRefillTs), playerId]
    );
    res.json({ success: true, data: { remaining: newRemaining, lastRefillTs: current.lastRefillTs, max: SIEGE_MAX_QUOTA } });
  } catch (error) {
    return next(wrap500(error, '更新攻城配额失败'));
  }
});

/**
 * GET /api/cities/war/:warId
 * 获取战事状态
 */
router.get('/war/:warId', async (req, res, next) => {
  try {
    const war = await cityService.getWarStatus(req.params.warId);
    if (!war) return res.status(404).json({ success: false, error: '战事不存在' });
    res.json({ success: true, data: war });
  } catch (error) {
    return next(wrap500(error, '获取战事状态失败'));
  }
});

module.exports = router;
