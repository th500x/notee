/**
 * AI 玩家单人日常编排（42-1 §4.1/§4.2 · 42-2 Step 5）
 *
 * 把单个 AI 一轮被唤起时要做的事按 **§4.2 顺序** 串起来，遵循「**先移动、后执行**」：
 *   ① 战事（攻/守）：移动到位（presence）；攻方到大本营后对目标城打满攻城（Step 7b，复用真人攻城链）。
 *   ② 封赏抽卡：先移动到本势力中城/大城 → `aiPlayerGachaService.runAiGacha`。
 *   ③ 匪寨：先移动到匪寨 POI → `aiPlayerBanditService.runAiBanditRaids`（后端 runPvpAutoDuel）。
 *   ④ 探索：在当前城就地 `aiPlayerExplorePolicy.runAiExploreOnce` 至配额/安全事件用尽。
 *
 * **道路 PVP（Step 7a）**：任意一次移动若在路上踏入敌对真人/AI 的格子，`moveAlongRoad` 会登记一条
 * `road_encounters`（AI 为攻方，status='fighting'）。本编排在每次移动后用与真人攻方**同一条**
 * `roadEncounterService.resolveAuthoritativeRoadEncounter` 服务端权威结算（战斗/兵力/败退迁城全复用），
 * **不回避**真人（产品口径）。AI 作为守方时无需主动动作——由对方攻方按同一入口结算。
 *
 * 战斗段前的上阵编组由 `aiPlayerBanditService` 内部 `refreshAiPlayerLineup` 保证（§7.2）。
 * 移动、抽卡、匪寨、探索的「能不能做」一律由各自 service（配额/银两/门闸）裁定；
 * 本编排**不**伪造位置门闸、**不**静默吞错：每段失败 `console.error` 后继续下一段，并在汇总里如实记录。
 *
 * 无断点（MVP）：一轮没跑完也不存进度，下次被唤起重新评估（与 42-1「不做子任务断点」一致）。
 *
 * @module services/aiPlayerDailyOrchestrator
 */

const movementPlanner = require('./aiPlayerMovementPlanner');
const gachaService = require('./aiPlayerGachaService');
const banditService = require('./aiPlayerBanditService');
const warService = require('./aiPlayerWarService');
const explorePolicy = require('./aiPlayerExplorePolicy');
const roadEncounterService = require('./roadEncounterService');
const Player = require('../models/Player');

const LOG = '[aiPlayer][orchestrator]';

/** 探索单点循环硬上限（远大于探索配额上限，仅防异常空转） */
const EXPLORE_LOOP_CAP = 40;

/** 防止同一 AI 被并发重复编排（与 aiConscriptLegionService.runningAssaultKeys 同思路） */
const runningPlayers = new Set();

/**
 * 解析探索就地点：优先本势力中/大城（与抽卡同城），退主城，再退道路所在郡 —— 仅作为
 * `filterExploreEventsPool` 的 `locationId`（wilderness/market 类按 city_id 匹配，explore/mystery 类通配）。
 * @param {object} state movementPlanner.loadPlayerRoadState 结果
 * @returns {Promise<string|null>}
 */
async function resolveExploreLocationId(state) {
  const gacha = await movementPlanner.resolveGachaCityTarget(state);
  if (gacha?.cityId) return gacha.cityId;
  if (state?.mainCityId) return state.mainCityId;
  return null;
}

/**
 * 在指定就地点探索到「配额用尽 / 无安全事件 / 出错」为止。
 * @param {string} playerId
 * @param {string} locationId
 */
async function runExploreUntilDone(playerId, locationId) {
  const results = [];
  let explored = 0;
  let stopReason = 'cap';
  for (let i = 0; i < EXPLORE_LOOP_CAP; i++) {
    // eslint-disable-next-line no-await-in-loop
    const r = await explorePolicy.runAiExploreOnce(playerId, { locationId });
    if (!r.ok) {
      console.error(`${LOG} explore 出错 player=${playerId} loc=${locationId}: ${r.error}`);
      stopReason = `error:${r.reason || r.error}`;
      break;
    }
    if (r.explored === false) {
      stopReason = r.reason; // no_quota | no_safe_event
      break;
    }
    explored += 1;
    results.push({ eventId: r.eventId, optionKey: r.optionKey, fortune: r.fortune });
  }
  return { explored, stopReason, results };
}

/**
 * 道路 PVP（Step 7a）：移动若踏入敌对玩家格触发遭遇（AI 为攻方），用真人攻方同一条
 * `resolveAuthoritativeRoadEncounter` 服务端权威结算。AI 为守方的遭遇由对方攻方结算，本函数跳过。
 *
 * @param {string} playerId
 * @param {object|null} encounter moveAlongRoad 返回的 encounter（{ encounterId, attackerPlayerId, status, ... }）
 * @returns {Promise<null | { ok:boolean, encounterId:string, attackerWon?:boolean, defenderId?:string, error?:string }>}
 */
async function resolveRoadEncounterIfAny(playerId, encounter) {
  if (!encounter || encounter.status !== 'fighting' || !encounter.encounterId) return null;
  if (String(encounter.attackerPlayerId || '').trim() !== playerId) return null; // 仅作为攻方主动结算
  try {
    const res = await roadEncounterService.resolveAuthoritativeRoadEncounter(playerId, encounter.encounterId);
    if (!res.ok) {
      console.error(
        `${LOG} 道路遭遇结算失败 player=${playerId} enc=${encounter.encounterId}: [${res.status}] ${res.error}`,
      );
      return { ok: false, encounterId: encounter.encounterId, error: res.error };
    }
    const attackerWon = !!res.data?.attackerWon;
    console.log(
      `${LOG} 道路遭遇 player=${playerId} enc=${encounter.encounterId} ` +
        `vs=${encounter.defenderPlayerId} attackerWon=${attackerWon}`,
    );
    return {
      ok: true,
      encounterId: encounter.encounterId,
      attackerWon,
      defenderId: encounter.defenderPlayerId != null ? String(encounter.defenderPlayerId) : undefined,
    };
  } catch (e) {
    console.error(`${LOG} 道路遭遇异常 player=${playerId} enc=${encounter.encounterId}: ${e.message}`);
    return { ok: false, encounterId: encounter.encounterId, error: e.message };
  }
}

/**
 * 单个移动意图：尽力就位，结果如实返回（移动失败只记录，不阻断后续段）。
 * 移动若触发道路遭遇（AI 为攻方）→ 立即服务端权威结算并把结果挂在 `r.roadEncounter`。
 * @param {string} playerId
 * @param {string} intent movementPlanner.MOVE_INTENT 之一
 */
async function moveStep(playerId, intent) {
  try {
    const r = await movementPlanner.planAndMove(playerId, intent);
    if (!r.ok) {
      console.error(`${LOG} 移动失败 player=${playerId} intent=${intent}: ${r.error}`);
      return r;
    }
    if (r.encounter) {
      r.roadEncounter = await resolveRoadEncounterIfAny(playerId, r.encounter);
    }
    return r;
  } catch (e) {
    console.error(`${LOG} 移动异常 player=${playerId} intent=${intent}: ${e.message}`);
    return { ok: false, moved: false, intent, error: e.message };
  }
}

/**
 * 跑一个 AI 玩家的一轮日常（§4.2 顺序）。
 *
 * @param {string} playerId
 * @returns {Promise<{
 *   ok: boolean, playerId: string, skipped?: 'already_running'|'no_player', error?: string,
 *   steps?: { warAttack?: object, siege?: object, warDefend?: object, gachaMove?: object,
 *            gacha?: object, banditMove?: object, bandit?: object, explore?: object }
 * }>}
 */
async function runAiPlayerRoutine(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, playerId: pid, error: '缺少 playerId' };
  if (runningPlayers.has(pid)) {
    return { ok: true, playerId: pid, skipped: 'already_running' };
  }
  runningPlayers.add(pid);

  const steps = {};
  try {
    const state = await movementPlanner.loadPlayerRoadState(pid);
    if (!state) return { ok: false, playerId: pid, skipped: 'no_player' };
    console.log(`${LOG} start player=${pid} faction=${state.factionId} jun=${state.roadJunId}`);

    // 标记本轮「上线活跃」（复用真人同一 last_active_at / lastActiveAt 写法）。
    // 这一笔让 AI 在与真人**同一套**「近期活跃」判定里被视为在线：道路 presence 可见、
    // 路上可被真人遭遇（不再被当离线幽灵自动退让）、攻城时算守方在场。即「模拟真实在线玩家」口径。
    await Player.updateLastActive(pid);

    // ① 战事（攻/守）：移动就位；途中触发道路遭遇即权威结算（7a）。
    //    攻方移到大本营后，对该战事目标城打满攻城（7b，复用真人攻城链；可攻陷真人城）。
    steps.warAttack = await moveStep(pid, movementPlanner.MOVE_INTENT.ATTACK);
    const attackTarget = steps.warAttack?.target;
    if (attackTarget?.kind === 'attack' && attackTarget.targetPoiId) {
      try {
        steps.siege = await warService.runAiSiege(pid, attackTarget.targetPoiId);
      } catch (e) {
        console.error(`${LOG} 攻城异常 player=${pid} war=${attackTarget.targetPoiId}: ${e.message}`);
        steps.siege = { ok: false, error: e.message };
      }
    } else {
      steps.siege = { ok: true, skipped: 'no_attack_war' };
    }
    steps.warDefend = await moveStep(pid, movementPlanner.MOVE_INTENT.DEFEND);

    // ② 封赏抽卡：先到中/大城，再抽
    steps.gachaMove = await moveStep(pid, movementPlanner.MOVE_INTENT.GACHA);
    try {
      steps.gacha = await gachaService.runAiGacha(pid);
    } catch (e) {
      console.error(`${LOG} 抽卡异常 player=${pid}: ${e.message}`);
      steps.gacha = { ok: false, error: e.message };
    }

    // ③ 匪寨：先到匪寨 POI，再后端推演
    steps.banditMove = await moveStep(pid, movementPlanner.MOVE_INTENT.BANDIT);
    const banditPoiId = steps.banditMove?.target?.targetPoiId || null;
    if (banditPoiId) {
      try {
        steps.bandit = await banditService.runAiBanditRaids(pid, banditPoiId);
      } catch (e) {
        console.error(`${LOG} 匪寨异常 player=${pid} poi=${banditPoiId}: ${e.message}`);
        steps.bandit = { ok: false, error: e.message };
      }
    } else {
      steps.bandit = { ok: true, skipped: 'no_bandit_target' };
    }

    // ④ 探索：当前城就地，至配额/安全事件用尽
    const exploreLoc = await resolveExploreLocationId(state);
    if (exploreLoc) {
      steps.explore = await runExploreUntilDone(pid, exploreLoc);
    } else {
      steps.explore = { explored: 0, stopReason: 'no_location' };
    }

    console.log(
      `${LOG} done player=${pid} siegeBattles=${steps.siege?.battles ?? 0} ` +
        `gachaDraws=${steps.gacha?.totalDraws ?? 0} ` +
        `banditWins=${steps.bandit?.wins ?? 0} explored=${steps.explore?.explored ?? 0}`,
    );
    return { ok: true, playerId: pid, steps };
  } catch (e) {
    console.error(`${LOG} routine 异常 player=${pid}: ${e.message}`);
    return { ok: false, playerId: pid, error: e.message, steps };
  } finally {
    runningPlayers.delete(pid);
  }
}

module.exports = {
  EXPLORE_LOOP_CAP,
  resolveExploreLocationId,
  resolveRoadEncounterIfAny,
  runExploreUntilDone,
  runAiPlayerRoutine,
};
