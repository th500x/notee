/**
 * AI 玩家匪寨爬塔（42-1 §5.0 / §5.3 · 42-2 Step 5）
 *
 * 真人匪寨是「前端小图模拟 → POST /api/battles(pve_bandit)」；后端无替玩家打 PVE 的函数。
 * 故 AI 在**后端**用 `runPvpAutoDuel` 对该层匪寨 NPC 阵容推演，再走真人**同一条结算**：
 *   - 攻方阵容：AI 自己的**上阵编组**（`garrisonService.buildDefenseUnitsFromMainLineup`
 *     + `mapBuiltUnitsToSiegeNpcFormat`，与披挂 PVP 服务端结算同源，**同 ×10 数值口径**）；
 *   - 守方阵容：该层匪寨档 NPC（`smallMapEnemyRoster.banditNpcSlotRaritiesFromLayer`
 *     + `buildSmallMapEnemyRosterPicks` 选兵，复用 `aiConscriptLegionService.configTroopToSiegeNpc` 映射）；
 *   - 战后兵力/耐久/战数回写：`applyAuthoritativePvpAutoDuelAttackerLineupCasualties`（同披挂 PVP）；
 *   - 胜利推进：`banditRaidSettlementService.applyBanditRaidVictory`（cleared_layers / 个人 nextLayer / 季勋章）；
 *   - 配额：`playerBanditRaidQuotaService`（郡共享攻打次数），**正常打满**，耐久由现有匪寨自动生成机制补充。
 *
 * 照抄 `aiConscriptLegionService` 的「后端 runPvpAutoDuel 打 NPC」范式，**不**新造第二套战斗引擎。
 * 战斗失败不静默：异常 `console.error` 并停止本匪寨当轮（不吞错、不改库进度）。
 *
 * @module services/aiPlayerBanditService
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const garrisonService = require('./garrisonService');
const { refreshAiPlayerLineup } = require('./aiPlayerLineupService');
const banditQuota = require('./playerBanditRaidQuotaService');
const banditRaidSettlementService = require('./banditRaidSettlementService');
const { configTroopToSiegeNpc } = require('./aiConscriptLegionService');
const { runPvpAutoDuel } = require('./pvp/auto-duel/pvpAutoDuelSim');

const LOG = '[aiPlayer][bandit]';
const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

let _rosterEsm = null;
function loadRosterEsm() {
  if (!_rosterEsm) {
    const fp = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
    _rosterEsm = import(pathToFileURL(fp).href);
  }
  return _rosterEsm;
}

/** `san_1_bandit_1_yingchuan` → `san_1` */
function seasonFromBanditPoiId(banditPoiId) {
  const m = String(banditPoiId || '').match(/^(san_\d+)_bandit_/i);
  return m ? m[1] : 'san_1';
}

/**
 * 构建某层匪寨守军 NPC（与真人小图档位一致：层→稀有度槽→选兵→×10 NPC）。
 * @param {number} layer 战斗层 1…20
 * @param {string} season
 * @returns {Promise<object[]>}
 */
async function buildBanditLayerDefenders(layer, season) {
  const roster = await loadRosterEsm();
  const slotRarities = roster.banditNpcSlotRaritiesFromLayer(layer);
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [season]);
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [season]);
  const troopPool = roster.filterTroopsForSmallMapPveEnemy(troops);
  const charPool = roster.filterCharactersByFactionId(chars, roster.PVE_NPC_DEFAULT_FACTION_ID);
  const picks = roster.buildSmallMapEnemyRosterPicks(troopPool, charPool, slotRarities);

  const defenders = [];
  for (let i = 0; i < picks.troops.length; i++) {
    const ch = i < 2 ? picks.pairChars[0] : picks.pairChars[1];
    defenders.push(configTroopToSiegeNpc(picks.troops[i], ch || null, i));
  }
  return defenders;
}

/**
 * 取 AI 当前上阵编组的攻方 NPC（含战后兵力口径）。空 → 无可战部队。
 * @param {string} playerId
 * @returns {Promise<object[]>}
 */
async function buildAttackerFromLineup(playerId) {
  const raw = await garrisonService.buildDefenseUnitsFromMainLineup(playerId);
  return garrisonService.mapBuiltUnitsToSiegeNpcFormat(raw);
}

/**
 * 让一个 AI 玩家对单个匪寨打到「配额用尽 / 个人塔通关 / 全服耐久耗尽 / 战败 / 无可战部队」为止。
 *
 * @param {string} playerId
 * @param {string} banditPoiId 匪寨地图对象 ID `san_*_bandit_*`
 * @param {{ maxBattles?: number }} [opts]
 * @returns {Promise<{
 *   ok: boolean, error?: string, playerId: string, banditPoiId: string,
 *   battles: number, wins: number, lastLayer: number|null, stopReason: string,
 *   results?: Array<{ layer:number, won:boolean, settled:boolean, settleError?:string }>
 * }>}
 */
async function runAiBanditRaids(playerId, banditPoiId, { maxBattles = banditQuota.RAID_MAX } = {}) {
  const pid = String(playerId || '').trim();
  const poiId = String(banditPoiId || '').trim();
  if (!pid) return { ok: false, error: '缺少 playerId', playerId: pid, banditPoiId: poiId, battles: 0, wins: 0, lastLayer: null, stopReason: 'no_player' };
  if (!BANDIT_MAP_OBJECT_ID_RE.test(poiId)) {
    return { ok: false, error: '无效的匪寨地图对象 ID', playerId: pid, banditPoiId: poiId, battles: 0, wins: 0, lastLayer: null, stopReason: 'bad_poi' };
  }

  const season = seasonFromBanditPoiId(poiId);

  // 战前编组：满足上阵兵力下限才开打（与真人开战门闸一致）
  let lineup;
  try {
    lineup = await refreshAiPlayerLineup(pid);
  } catch (e) {
    console.error(`${LOG} refreshAiPlayerLineup 失败 player=${pid}: ${e.message}`);
    return { ok: false, error: e.message, playerId: pid, banditPoiId: poiId, battles: 0, wins: 0, lastLayer: null, stopReason: 'lineup_error' };
  }
  if (!lineup.meetsBattleGate) {
    return { ok: true, playerId: pid, banditPoiId: poiId, battles: 0, wins: 0, lastLayer: null, stopReason: 'lineup_gate' };
  }

  const results = [];
  let battles = 0;
  let wins = 0;
  let lastLayer = null;
  let stopReason = 'max_battles';

  const cap = Math.max(1, Math.min(60, Number(maxBattles) || banditQuota.RAID_MAX));
  for (let n = 0; n < cap; n++) {
    // 1) 先确认有可战部队（避免空打白扣配额）
    // eslint-disable-next-line no-await-in-loop
    const attackerNpcs = await buildAttackerFromLineup(pid);
    if (!attackerNpcs.length) {
      stopReason = 'no_troops';
      break;
    }

    // 2) 配额 + 当前层
    // eslint-disable-next-line no-await-in-loop
    const stateRes = await banditQuota.getRaidQuotaState(pid, poiId);
    if (!stateRes.ok) {
      console.error(`${LOG} getRaidQuotaState 失败 player=${pid} poi=${poiId}: ${stateRes.error}`);
      stopReason = 'quota_state_error';
      break;
    }
    if (!stateRes.data.canBattle) {
      stopReason = stateRes.data.towerCompleted
        ? 'tower_completed'
        : (stateRes.data.remaining <= 0 ? 'no_quota' : 'world_depleted');
      break;
    }

    // eslint-disable-next-line no-await-in-loop
    const consume = await banditQuota.applyRaidQuotaAction(pid, poiId, 'consume');
    if (!consume.ok) {
      stopReason = consume.error || 'consume_failed';
      break;
    }
    const layer = Number(consume.data.nextLayer);
    lastLayer = layer;

    // 3) 守军 + 推演
    let sim;
    try {
      // eslint-disable-next-line no-await-in-loop
      const defenders = await buildBanditLayerDefenders(layer, season);
      const seed = `aiBandit|${poiId}|${pid}|${layer}|${n}|${Date.now()}`;
      sim = runPvpAutoDuel(attackerNpcs, defenders, seed);
    } catch (e) {
      console.error(`${LOG} runPvpAutoDuel 失败 player=${pid} poi=${poiId} layer=${layer}: ${e.message}`);
      stopReason = 'battle_error';
      break;
    }
    battles += 1;

    // 4) 战后回写攻方兵力 / 战数 / 耐久（与披挂 PVP 同源）
    try {
      // eslint-disable-next-line no-await-in-loop
      await garrisonService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties(
        pid,
        attackerNpcs,
        sim.attackerTroopsEnd,
      );
    } catch (e) {
      console.error(`${LOG} 回写攻方兵力失败 player=${pid} poi=${poiId} layer=${layer}: ${e.message}`);
      // 兵力回写失败不掩盖：停止本轮，避免继续在错误兵力上推演
      results.push({ layer, won: !!sim.attackerWon, settled: false, settleError: 'casualty_writeback_failed' });
      stopReason = 'casualty_error';
      break;
    }

    if (!sim.attackerWon) {
      results.push({ layer, won: false, settled: false });
      stopReason = 'defeat';
      break;
    }

    wins += 1;
    // 5) 胜利结算（推进 cleared_layers + 个人 nextLayer + 季勋章）
    // eslint-disable-next-line no-await-in-loop
    const settle = await banditRaidSettlementService.applyBanditRaidVictory(pid, {
      banditPoiId: poiId,
      attackedLayer: layer,
    });
    if (!settle.ok) {
      console.error(`${LOG} applyBanditRaidVictory 失败 player=${pid} poi=${poiId} layer=${layer}: ${settle.error}`);
      results.push({ layer, won: true, settled: false, settleError: settle.error });
      stopReason = 'settle_failed';
      break;
    }
    results.push({ layer, won: true, settled: true });
  }

  return { ok: true, playerId: pid, banditPoiId: poiId, battles, wins, lastLayer, stopReason, results };
}

module.exports = {
  seasonFromBanditPoiId,
  buildBanditLayerDefenders,
  buildAttackerFromLineup,
  runAiBanditRaids,
};
