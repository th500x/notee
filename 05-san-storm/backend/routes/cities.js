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
const { pool } = require('../database/connection');

// ── 攻城配额（与探索配额机制一致） ──
const SIEGE_REFILL_PER_HOUR = 6;
const SIEGE_MAX_QUOTA = 18;
const SIEGE_REST_START = 0;
const SIEGE_REST_END = 8;

function isSiegeRestHour(h) { return h >= SIEGE_REST_START && h < SIEGE_REST_END; }
function getHourTs(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime(); }
function countActiveHours(from, to) {
  if (to <= from) return 0;
  let c = 0, ts = from, i = 0;
  while (ts < to && i < 48) { if (!isSiegeRestHour(new Date(ts).getHours())) c++; ts += 3600000; i++; }
  return c;
}
function calcSiegeQuota(remaining, lastRefillTs) {
  const now = new Date(), curTs = getHourTs(now);
  if (!lastRefillTs) return { remaining: isSiegeRestHour(now.getHours()) ? 0 : SIEGE_REFILL_PER_HOUR, lastRefillTs: curTs };
  const active = countActiveHours(lastRefillTs, curTs);
  if (active > 0) return { remaining: Math.min((remaining || 0) + active * SIEGE_REFILL_PER_HOUR, SIEGE_MAX_QUOTA), lastRefillTs: curTs };
  return { remaining: remaining || 0, lastRefillTs };
}

/**
 * GET /api/cities
 * 获取所有城市列表
 */
router.get('/', async (req, res) => {
  try {
    const { season } = req.query;
    const where = season ? 'WHERE season = ?' : '';
    const params = season ? [season] : [];
    const [rows] = await pool.query(`SELECT * FROM cities ${where} ORDER BY city_type, city_name`, params);

    const cities = rows.map(c => {
      let npcGarrison = null;
      if (c.npc_garrison) {
        npcGarrison = typeof c.npc_garrison === 'string' ? JSON.parse(c.npc_garrison) : c.npc_garrison;
      }
      return { ...c, npc_garrison: npcGarrison };
    });

    res.json({ success: true, cities, count: cities.length });
  } catch (error) {
    console.error('[Cities] 获取城市列表失败:', error);
    res.status(500).json({ success: false, error: '获取城市列表失败' });
  }
});

/**
 * GET /api/cities/:cityId
 * 获取单个城市详情（含 NPC 守军）
 */
router.get('/:cityId', async (req, res) => {
  try {
    const city = await cityService.getCityInfo(req.params.cityId);
    if (!city) return res.status(404).json({ success: false, error: '城市不存在' });
    res.json({ success: true, data: city });
  } catch (error) {
    console.error('[Cities] 获取城市详情失败:', error);
    res.status(500).json({ success: false, error: '获取城市详情失败' });
  }
});

/**
 * POST /api/cities/:cityId/generate-npc
 * 为城市生成/刷新 NPC 守军
 */
router.post('/:cityId/generate-npc', async (req, res) => {
  try {
    const result = await cityService.generateNpcGarrison(req.params.cityId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Cities] 生成NPC守军失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cities/:cityId/siege
 * 发起攻城战（返回 NPC 守军供前端战斗使用）
 * body: { playerId }
 */
router.post('/:cityId/siege', async (req, res) => {
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
router.post('/siege-result', async (req, res) => {
  try {
    const { warId, playerId, factionId, killedIndices, result, silverSpent,
            defenderType, defenderPlayerId, garrisonUnits } = req.body;
    if (!warId || !playerId || !factionId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const data = await cityService.recordSiegeResult(
      warId, playerId, factionId, killedIndices || [], result || 'win', silverSpent || 0,
      { defenderType, defenderPlayerId, garrisonUnits }
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Cities] 记录攻城结果失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cities/:cityId/active-war
 * 获取城市当前活跃战事（势力击杀排行）
 */
router.get('/:cityId/active-war', async (req, res) => {
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
    res.status(500).json({ success: false, error: '获取战事失败' });
  }
});

/**
 * GET /api/cities/:cityId/siege-quota
 * 获取攻城配额（与探索配额机制一致）
 */
router.get('/:cityId/siege-quota', async (req, res) => {
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
    console.error('[Cities] 获取攻城配额失败:', error);
    res.status(500).json({ success: false, error: '获取攻城配额失败' });
  }
});

/**
 * POST /api/cities/:cityId/siege-quota
 * 更新攻城配额
 * body: { playerId, action: 'consume' | 'refund' | 'fillMax' }
 */
router.post('/:cityId/siege-quota', async (req, res) => {
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
    console.error('[Cities] 更新攻城配额失败:', error);
    res.status(500).json({ success: false, error: '更新攻城配额失败' });
  }
});

/**
 * GET /api/cities/war/:warId
 * 获取战事状态
 */
router.get('/war/:warId', async (req, res) => {
  try {
    const war = await cityService.getWarStatus(req.params.warId);
    if (!war) return res.status(404).json({ success: false, error: '战事不存在' });
    res.json({ success: true, data: war });
  } catch (error) {
    console.error('[Cities] 获取战事状态失败:', error);
    res.status(500).json({ success: false, error: '获取战事状态失败' });
  }
});

module.exports = router;
