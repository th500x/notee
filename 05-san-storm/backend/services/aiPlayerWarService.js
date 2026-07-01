/**
 * AI 玩家战事 · 城池围攻（42-1 §5.4 · 42-2 Step 7b）
 *
 * 真人攻城是「移动到攻方大本营 → 客户端 BattleArena 打防守者 → 回 POST 结算」。AI 没有 UI，
 * 故在**后端**用与真人**完全相同**的入口与结算链推演每一场：
 *   `pvpWarService.resolveAuthoritativeAttackerCitySiege(pvpWarId, playerId)`
 *   = `initiateAttackerCitySiege`（扣攻城次数 + 按真人优先级选披挂/驻守/NPC 防守者并抢锁）
 *   → 战术内核 `runPvpTacticalDuel`（守城方享城防加成）
 *   → `recordAttackerCitySiegeResult`（side_stats / 守军减员 / 攻陷易主 handoff / 释放锁）。
 *
 * 配额即真人同一桶（`player_events.siege_quota_*`）：**正常打满**直至次数用尽 / 无可攻守军 /
 * 阶段门禁 / 上阵不足 / 战败 / 城已攻陷。逻辑上 AI 攻城与真人攻城**无实质区别**，
 * 唯一差异是中段战斗在服务端推演。失败不静默：异常 `console.error` 并停止本场战事当轮。
 *
 * @module services/aiPlayerWarService
 */

const cityService = require('./cityService');
const pvpWarService = require('./pvpWarService');
const { refreshAiPlayerLineup } = require('./aiPlayerLineupService');

const LOG = '[aiPlayer][war]';

/** 单场战事单轮攻城硬上限（远大于攻城配额上限，仅防异常空转） */
const SIEGE_LOOP_CAP = 30;

/**
 * 让一个 AI 玩家对一场进行中的攻方战事打到「次数用尽 / 无守军 / 阶段门禁 / 上阵不足 / 战败 / 攻陷」为止。
 *
 * @param {string} playerId
 * @param {string} pvpWarId
 * @param {{ maxBattles?: number }} [opts]
 * @returns {Promise<{
 *   ok: boolean, error?: string, playerId: string, pvpWarId: string,
 *   battles: number, wins: number, captured: boolean, stopReason: string,
 *   results?: Array<{ won:boolean, defenderType:string, killCount:number, captured:boolean }>
 * }>}
 */
async function runAiSiege(playerId, pvpWarId, { maxBattles = SIEGE_LOOP_CAP } = {}) {
  const pid = String(playerId || '').trim();
  const warId = String(pvpWarId || '').trim();
  if (!pid || !warId) {
    return { ok: false, error: '缺少 playerId / pvpWarId', playerId: pid, pvpWarId: warId, battles: 0, wins: 0, captured: false, stopReason: 'bad_args' };
  }

  // 战前编组：满足上阵兵力下限才开打（与真人攻城门闸一致；initiate 内部也会再校验）
  let lineup;
  try {
    lineup = await refreshAiPlayerLineup(pid);
  } catch (e) {
    console.error(`${LOG} refreshAiPlayerLineup 失败 player=${pid}: ${e.message}`);
    return { ok: false, error: e.message, playerId: pid, pvpWarId: warId, battles: 0, wins: 0, captured: false, stopReason: 'lineup_error' };
  }
  if (!lineup.meetsBattleGate) {
    return { ok: true, playerId: pid, pvpWarId: warId, battles: 0, wins: 0, captured: false, stopReason: 'lineup_gate' };
  }

  const results = [];
  let battles = 0;
  let wins = 0;
  let captured = false;
  let stopReason = 'max_battles';

  const cap = Math.max(1, Math.min(SIEGE_LOOP_CAP, Number(maxBattles) || SIEGE_LOOP_CAP));
  for (let n = 0; n < cap; n++) {
    // 1) 先看攻城次数（只读，避免 throw 控流；真人同一桶）
    // eslint-disable-next-line no-await-in-loop
    const remaining = await cityService.getSiegeQuotaRemaining(pid);
    if (remaining <= 0) {
      stopReason = 'no_quota';
      break;
    }

    // 2) 服务端权威一场攻城（扣次数 + 选防守者 + 推演 + 结算，全复用真人链）
    // eslint-disable-next-line no-await-in-loop
    const res = await pvpWarService.resolveAuthoritativeAttackerCitySiege(warId, pid);
    if (!res.ok) {
      // initiate 类正常停（次数不足/无守军/阶段门禁/上阵不足/各线交战中）→ stop；推演异常 → error
      stopReason = res.stop ? `stop:${res.reason}` : `error:${res.error}`;
      break;
    }

    battles += 1;
    results.push({
      won: !!res.attackerWon,
      defenderType: res.defenderType,
      killCount: res.killCount ?? 0,
      captured: !!res.siegeCompleted,
    });

    if (res.siegeCompleted) {
      captured = true;
      wins += 1;
      stopReason = 'city_captured';
      break;
    }
    if (!res.attackerWon) {
      stopReason = 'defeat';
      break;
    }
    wins += 1;
  }

  return { ok: true, playerId: pid, pvpWarId: warId, battles, wins, captured, stopReason, results };
}

module.exports = {
  SIEGE_LOOP_CAP,
  runAiSiege,
};
