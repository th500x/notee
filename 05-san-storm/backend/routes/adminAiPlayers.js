/**
 * 管理员：AI 玩家管理（对接 game 管理端「AI 玩家管理」页面）
 *
 *   GET  /api/admin/ai-players/status                 只读总览（行为开关取自 .env / 调度内存态 / 各势力人数）
 *   POST /api/admin/ai-players/faction-count          { factionId, targetCount }  设某势力 AI 精确人数（多退少补）
 *   POST /api/admin/ai-players/faction-active         { factionId, active }  势力级休眠/唤醒（不删档）
 *   POST /api/admin/ai-players/run-sample             { factionId? }         立即唤起一名在岗 AI 跑一轮（便于观察/验收）
 *
 * **行为总开关**：由 `.env` 的 `AI_PLAYER_BEHAVIOR_ENABLED` 控制（启动时读，改后需重启后端）；
 *   本页只读展示，不在库里另存开关（避免为单开关单独建表）。
 * **安全**：与其它 game 管理端一致，页面由前端 `AdminPageGate`（主站 `notee-admin-token`）保护；
 *   本路由不再叠加口令（单运营）。人数下调/删档为可逆重建（可再 seed），非破坏赛季数据。
 */
const express = require('express');
const { wrap500 } = require('../utils/httpError');
const { AI_PLAYER_BEHAVIOR } = require('../config/aiPlayerBehavior');
const fillService = require('../services/aiPlayerFillService');
const { getActiveScheduler } = require('../services/aiPlayerBehaviorScheduler');

const router = express.Router();

function schedulerLiveStats() {
  const s = getActiveScheduler();
  if (!s) return { registered: false };
  return {
    registered: true,
    windowMinutes: s.windowMinutes,
    maxConcurrent: s.maxConcurrent,
    planned: s.plan ? s.plan.size : 0,
    running: s.runningIds ? s.runningIds.size : 0,
    queued: s.queue ? s.queue.length : 0,
    firedThisWindow: s.fired ? s.fired.size : 0,
  };
}

router.get('/status', async (req, res, next) => {
  try {
    const serverId = String(req.query.serverId || '').trim() || undefined;
    const overview = await fillService.getFactionAiOverview({ serverId });
    return res.json({
      success: true,
      runtime: {
        behaviorEnabled: !!AI_PLAYER_BEHAVIOR.behaviorEnabled,
        maxConcurrent: AI_PLAYER_BEHAVIOR.maxConcurrent,
        windowMinutes: AI_PLAYER_BEHAVIOR.windowMinutes,
      },
      scheduler: schedulerLiveStats(),
      serverId: overview.serverId,
      campaignSeason: overview.campaignSeason,
      factions: overview.factions,
    });
  } catch (err) {
    return next(wrap500(err, '获取 AI 玩家状态失败'));
  }
});

router.post('/faction-count', async (req, res, next) => {
  try {
    const { factionId, targetCount, serverId } = req.body || {};
    if (!factionId) return res.status(400).json({ success: false, error: '缺少 factionId' });
    const n = Number.parseInt(targetCount, 10);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      return res.status(400).json({ success: false, error: 'targetCount 须为 0~500 的整数' });
    }
    const result = await fillService.setFactionAiCount({ factionId, targetCount: n, serverId });
    return res.json({ success: true, ...result });
  } catch (err) {
    return next(wrap500(err, '设置势力 AI 人数失败'));
  }
});

router.post('/faction-active', async (req, res, next) => {
  try {
    const { factionId, active, serverId } = req.body || {};
    if (!factionId) return res.status(400).json({ success: false, error: '缺少 factionId' });
    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active 须为布尔' });
    }
    const result = await fillService.setFactionAiActive({ factionId, active, serverId });
    return res.json({ success: true, ...result });
  } catch (err) {
    return next(wrap500(err, '切换势力 AI 休眠失败'));
  }
});

router.post('/run-sample', async (req, res, next) => {
  try {
    const { pool } = require('../database/connection');
    const orchestrator = require('../services/aiPlayerDailyOrchestrator');
    const factionId = String(req.body?.factionId || '').trim();
    const params = [];
    let where = "a.account_type = 'ai' AND COALESCE(ai.is_active, 1) = 1";
    if (factionId) {
      where += ' AND p.faction_id = ?';
      params.push(factionId);
    }
    const [rows] = await pool.query(
      `SELECT p.player_id AS playerId
         FROM players p
         INNER JOIN accounts a ON a.id = p.player_id
         LEFT JOIN ai_players ai ON ai.player_id = p.player_id
        WHERE ${where}
        ORDER BY RAND() LIMIT 1`,
      params,
    );
    const pid = rows[0]?.playerId;
    if (!pid) return res.status(404).json({ success: false, error: '无在岗 AI 可唤起' });

    const result = await orchestrator.runAiPlayerRoutine(pid);
    const s = result.steps || {};
    return res.json({
      success: true,
      playerId: pid,
      ok: result.ok,
      summary: {
        siegeBattles: s.siege?.battles ?? 0,
        gachaDraws: s.gacha?.totalDraws ?? 0,
        banditWins: s.bandit?.wins ?? 0,
        explored: s.explore?.explored ?? 0,
        roadEncounterAttack: s.warAttack?.roadEncounter || null,
      },
    });
  } catch (err) {
    return next(wrap500(err, '唤起 AI 失败'));
  }
});

module.exports = router;
