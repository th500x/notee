/**
 * 征发 AI 军团 · 前军 / 后军模拟战（11-3 §5.4 / §5.5.2 · 实装段3）
 *
 * **临时方案（M2）**：从攻方势力可抽卡池随机抽 5 张部队卡，对目标城 NPC/驻地守军
 * 4 张一批进行服务端 `runSiegePvpSkirmish` 快速结算；不写 `battles` 行，战果写入
 * `factionBulletinService`（category=war）。
 *
 * **未来（11-2 LEGION）**：改由 AI 君主专属军团（20 人编制）提供阵容，本模块仅切换数据源。
 *
 * @module services/aiConscriptLegionService
 */

const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const cityService = require('./cityService');
const factionPolicyService = require('./factionPolicyService');
const warPhaseService = require('./warPhaseService');
const WarPvp = require('../models/WarPvp');
const { runSiegePvpSkirmish } = require('./siegePvpSkirmish');

const ASSAULT_ATTACKER_SLOTS = 5;
const ASSAULT_DEFENDER_SLOTS = 4;
const QUOTA_PER_WINDOW = 20;
/** 每场间隔 4 秒（11-3 §5.5.2 · 3～5 秒取固定 4） */
const INTER_BATTLE_DELAY_MS = 4000;

/** 防止同一场战事同窗口重复启动调度 */
const runningAssaultKeys = new Set();

function assaultRunKey(pvpWarId, kind) {
  return `${pvpWarId}:${kind}`;
}

function parseFactionTroopPool(factionId) {
  const m = String(factionId || '').match(/_faction_(\d+)/);
  let factionNumber = '0';
  if (m) {
    const nz = m[1].replace(/^0+/, '');
    factionNumber = nz ? nz.charAt(0) : '0';
  }
  return { season: 'san_1', factionNumber };
}

async function loadSmallMapEnemyRosterEsm() {
  const filePath = path.join(__dirname, '../../shared/utils/smallMapEnemyRoster.js');
  return import(pathToFileURL(filePath).href);
}

/**
 * 将 `config_troops` 行转为 `runSiegePvpSkirmish` 用 NPC 形状。
 *
 * @param {object} troop
 * @param {object|null} character
 * @param {number} index
 */
function configTroopToSiegeNpc(troop, character, index) {
  return {
    index,
    troopId: troop.troop_id,
    troopName: troop.troop_name,
    rarity: troop.rarity,
    maxTroops: troop.max_troops,
    currentTroops: troop.max_troops,
    attack: troop.attack,
    defense: troop.defense,
    speed: troop.speed,
    movement: troop.movement,
    attackRange: troop.attack_range,
    troopType: troop.troop_type,
    weaponType: troop.weapon_type,
    character: character
      ? {
          characterId: character.character_id,
          name: character.character_name || character.courtesy_name || '征发将领',
          courtesyName: character.courtesy_name || character.character_name || '征发将领',
          rarity: character.rarity,
          luck: character.luck,
          courage: character.courage,
          combat: character.combat,
          command: character.command,
          intelligence: character.intelligence,
          politics: character.politics,
          charm: character.charm,
          traitModifier: character.trait_modifier || 0,
        }
      : null,
    alive: true,
  };
}

/**
 * 按稀有度从势力池抽一支部队（与 `cityService.generateNpcGarrison` / 卡池口径对齐）。
 */
async function pickTroopByRarityFromFactionPool(factionId, rarity) {
  const sm = await loadSmallMapEnemyRosterEsm();
  const { season, factionNumber } = parseFactionTroopPool(factionId);
  const recruitEff = await factionPolicyService.getEffectiveRecruit(factionId);
  const [troops] = await pool.query('SELECT * FROM config_troops WHERE season = ?', [season]);
  const poolFaction = factionId;
  const troopPool = sm.filterTroopsByFactionId(troops, poolFaction);
  let troop = sm.pickRandomTroopByRarity(troopPool, rarity);
  if (!troop) troop = sm.pickRandomTroopByRarity(troops, rarity);
  if (!troop && troops.length) troop = troops[Math.floor(Math.random() * troops.length)];
  if (!troop) return null;

  let character = null;
  const [chars] = await pool.query('SELECT * FROM config_characters WHERE season = ?', [season]);
  const charPool = sm.filterCharactersByFactionId(chars, poolFaction);
  const charRarity = rarity === 'common' ? 'rare' : rarity;
  character = sm.pickRandomCharacterByRarity(charPool, charRarity);
  if (!character) character = sm.pickRandomCharacterByRarity(chars, charRarity);

  return configTroopToSiegeNpc(troop, character, 0);
}

/**
 * 征发攻方 5 张阵容：模拟玩家 5 队上阵 — 槽位稀有度略高于守军四槽（末槽传奇）。
 */
async function buildAttackerRoster(factionId, cityType) {
  const sm = await loadSmallMapEnemyRosterEsm();
  const tier = sm.resolveCityBanditTier(cityType, null);
  const slots = sm.banditTierSlotRarities(tier);
  const attackerRarities = [
    slots[0] || 'rare',
    slots[1] || 'rare',
    slots[2] || 'epic',
    slots[3] || 'epic',
    'legendary',
  ];
  const roster = [];
  for (let i = 0; i < ASSAULT_ATTACKER_SLOTS; i++) {
    const unit = await pickTroopByRarityFromFactionPool(factionId, attackerRarities[i]);
    if (!unit) {
      throw new Error(`[aiConscript] 无法为势力 ${factionId} 抽取征发部队（槽 ${i}）`);
    }
    unit.index = i;
    roster.push(unit);
  }
  return roster;
}

/**
 * 守方本批 4 张：优先取目标城仍存活的 NPC 前 4 支；不足则按匪寨档生成虚拟守军。
 */
async function buildDefenderBatch(cityId, cityType) {
  const city = await cityService.getCityInfo(cityId);
  if (!city) throw new Error(`[aiConscript] 目标城不存在: ${cityId}`);
  const { units } = cityService.parseNpcGarrisonStored(city.npc_garrison);
  const alive = (units || []).filter((u) => u && u.alive);
  if (alive.length >= ASSAULT_DEFENDER_SLOTS) {
    return alive.slice(0, ASSAULT_DEFENDER_SLOTS).map((u, i) => ({ ...u, index: u.index != null ? u.index : i }));
  }

  const sm = await loadSmallMapEnemyRosterEsm();
  const tier = sm.resolveCityBanditTier(cityType, cityId);
  const batch = [];
  for (let i = 0; i < ASSAULT_DEFENDER_SLOTS; i++) {
    const rarity = sm.siegeNpcRarityAtTroopIndex(i, tier);
    const unit = await pickTroopByRarityFromFactionPool(
      sm.resolveSiegeNpcFactionIdForTroopPool(city),
      rarity,
    );
    if (!unit) throw new Error('[aiConscript] 守军虚拟批次生成失败');
    unit.index = 1000 + i;
    batch.push(unit);
  }
  return batch;
}

/**
 * 将模拟战击杀写回 `cities.npc_garrison`（仅当守方为真实 NPC 索引）。
 */
async function applyNpcKillsToCity(conn, cityId, killedGlobalIndices) {
  if (!killedGlobalIndices.length) return { killCount: 0, captured: false };
  const [cityRows] = await conn.query(
    'SELECT npc_garrison, npc_garrison_alive FROM cities WHERE city_id = ? FOR UPDATE',
    [cityId],
  );
  if (!cityRows.length) throw new Error('[aiConscript] 目标城不存在');
  const { units: unitArr } = cityService.parseNpcGarrisonStored(cityRows[0].npc_garrison);
  if (!unitArr || !unitArr.length) return { killCount: 0, captured: false };

  let killCount = 0;
  for (const idx of killedGlobalIndices) {
    if (idx == null || idx < 0 || idx >= unitArr.length) continue;
    const u = unitArr[idx];
    if (u && u.alive) {
      u.alive = false;
      killCount += 1;
    }
  }
  const aliveAfter = unitArr.filter((u) => u.alive).length;
  await conn.query(
    'UPDATE cities SET npc_garrison = ?, npc_garrison_alive = ? WHERE city_id = ?',
    [cityService.serializeNpcGarrisonStored(unitArr, new Date()), aliveAfter, cityId],
  );
  return { killCount, captured: aliveAfter === 0 };
}

async function incrementWarSideStatsNpcKills(pvpWarId, killCount) {
  if (killCount <= 0) return;
  const war = await WarPvp.getById(pvpWarId);
  if (!war) return;
  const side = war.sideStats && typeof war.sideStats === 'object' ? { ...war.sideStats } : {};
  side.attacker = side.attacker || { battles: 0, wins: 0, losses: 0, npcKills: 0 };
  side.attacker.npcKills = (side.attacker.npcKills || 0) + killCount;
  side.attacker.battles = (side.attacker.battles || 0) + 1;
  if (killCount > 0) side.attacker.wins = (side.attacker.wins || 0) + 1;
  await WarPvp.updatePvpWar(pvpWarId, { sideStats: side });
}

async function persistPhaseSnapshotQuota(pvpWarId, assaultKind, snapshotMutator) {
  const warPolicyTransientService = require('./warPolicyTransientService');
  const row = await warPolicyTransientService.getPoliciesForWar(pvpWarId);
  if (!row || !row.phaseSnapshotJson) return;
  const snap = { ...row.phaseSnapshotJson };
  snapshotMutator(snap);
  await pool.query(
    'UPDATE wars_pvp_policies SET phase_snapshot_json = ? WHERE pvp_war_id = ?',
    [JSON.stringify(snap), pvpWarId],
  );
}

function classifyOutcome(attackerWon, killCount, stoppedEarly) {
  if (stoppedEarly || !attackerWon || killCount < 1) return 'poor';
  if (killCount >= 2) return 'good';
  return 'poor';
}

/**
 * 执行一轮征发窗内至多 QUOTA_PER_WINDOW 场模拟战。
 *
 * @param {object} war - formatted wars_pvp
 * @param {'front'|'rear'} assaultKind
 */
async function runConscriptAssaultWindow(war, assaultKind) {
  const key = assaultRunKey(war.pvpWarId, assaultKind);
  if (runningAssaultKeys.has(key)) return;
  runningAssaultKeys.add(key);

  const factionBulletinService = require('./factionBulletinService');
  const campLabel = assaultKind === 'front' ? '征发军团·前营' : '征发军团·后营';
  const cityName = war.targetCityName || war.targetCityId;
  let totalKills = 0;
  let battlesRun = 0;
  let stoppedEarly = false;
  let lastOutcome = 'poor';

  try {
    const city = await cityService.getCityInfo(war.targetCityId);
    const cityType = city?.city_type || 'city_small';
    let attackerRoster = await buildAttackerRoster(war.attackerFactionId, cityType);

    for (let n = 0; n < QUOTA_PER_WINDOW; n++) {
      const warNow = await WarPvp.getById(war.pvpWarId);
      if (!warNow || warNow.status !== WarPvp.WAR_PVP_STATUS.ACTIVE) break;

      const policiesRow = await require('./warPolicyTransientService').getPoliciesForWar(war.pvpWarId);
      if (!policiesRow) break;
      const phaseSnap = warPhaseService.getPhaseSnapshot(warNow, policiesRow);
      const inWindow =
        assaultKind === 'front'
          ? phaseSnap.phase === warPhaseService.PHASE.FRONT_ARMY
          : phaseSnap.phase === warPhaseService.PHASE.REAR_ARMY;
      if (!inWindow) break;

      const aliveAttackers = attackerRoster.filter((u) => (u.currentTroops ?? u.maxTroops) > 0);
      if (!aliveAttackers.length) {
        stoppedEarly = true;
        break;
      }

      const defenders = await buildDefenderBatch(war.targetCityId, cityType);
      if (!defenders.length) break;

      const seed = `conscript|${war.pvpWarId}|${assaultKind}|${n}|${Date.now()}`;
      const sim = runSiegePvpSkirmish(attackerRoster, defenders, seed);
      battlesRun += 1;

      attackerRoster = sim.attackerTroopsEnd.map((t, i) => ({
        ...attackerRoster[i],
        ...t,
        index: i,
      }));

      const killedGlobal = (sim.killedIndices || [])
        .map((localIdx) => defenders[localIdx]?.index)
        .filter((gi) => gi != null && gi < 10000);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const { killCount } = await applyNpcKillsToCity(conn, war.targetCityId, killedGlobal);
        await conn.commit();
        totalKills += killCount;
        await incrementWarSideStatsNpcKills(war.pvpWarId, killCount);
      } catch (e) {
        await conn.rollback();
        console.error('[aiConscript] applyNpcKills failed:', e.message);
      } finally {
        conn.release();
      }

      lastOutcome = classifyOutcome(sim.attackerWon, killedGlobal.length, false);

      if ((sim.attackerTroopsEnd || []).every((t) => (t.currentTroops ?? 0) <= 0)) {
        stoppedEarly = true;
        break;
      }

      const quotaKey = assaultKind === 'front' ? 'frontAssault' : 'rearAssault';
      await persistPhaseSnapshotQuota(war.pvpWarId, assaultKind, (snap) => {
        const block = snap[quotaKey];
        if (block) block.quotaRemaining = Math.max(0, QUOTA_PER_WINDOW - battlesRun);
      });

      if (n < QUOTA_PER_WINDOW - 1) {
        await new Promise((r) => setTimeout(r, INTER_BATTLE_DELAY_MS));
      }
    }

    factionBulletinService.logConscriptAssaultSummary({
      factionId: war.attackerFactionId,
      campLabel,
      cityName,
      outcome: lastOutcome,
      totalKills,
      battlesRun,
      stoppedEarly,
    });

    await persistPhaseSnapshotQuota(war.pvpWarId, assaultKind, (snap) => {
      const quotaKey = assaultKind === 'front' ? 'frontAssault' : 'rearAssault';
      const block = snap[quotaKey];
      if (block) {
        block.quotaRemaining = Math.max(0, QUOTA_PER_WINDOW - battlesRun);
        block.stopped = true;
      }
    });
  } catch (err) {
    console.error(`[aiConscript] ${assaultKind} window error ${war.pvpWarId}:`, err.message);
  } finally {
    runningAssaultKeys.delete(key);
  }
}

/**
 * 由 `tickActivePvpWars` 每轮调用：对 active 且已挂政策的战事检查阶段并启动征发窗。
 */
async function tickWarPhasePolicies() {
  const warPolicyTransientService = require('./warPolicyTransientService');
  const wars = await WarPvp.listWars({ status: ['active'], limit: 100 });
  for (const war of wars) {
    try {
      const policiesRow = await warPolicyTransientService.getPoliciesForWar(war.pvpWarId);
      if (!policiesRow) continue;
      const snap = warPhaseService.getPhaseSnapshot(war, policiesRow);
      const ps = policiesRow.phaseSnapshotJson || {};

      if (
        policiesRow.frontAssault &&
        snap.phase === warPhaseService.PHASE.FRONT_ARMY &&
        ps.frontAssault &&
        !ps.frontAssault.stopped &&
        (ps.frontAssault.quotaRemaining == null || ps.frontAssault.quotaRemaining > 0)
      ) {
        runConscriptAssaultWindow(war, 'front').catch((e) => {
          console.error('[aiConscript] front schedule error:', e.message);
        });
      }

      if (
        policiesRow.rearAssault &&
        snap.phase === warPhaseService.PHASE.REAR_ARMY &&
        ps.rearAssault &&
        !ps.rearAssault.stopped &&
        (ps.rearAssault.quotaRemaining == null || ps.rearAssault.quotaRemaining > 0)
      ) {
        runConscriptAssaultWindow(war, 'rear').catch((e) => {
          console.error('[aiConscript] rear schedule error:', e.message);
        });
      }
    } catch (e) {
      console.error(`[aiConscript] tick policy check ${war.pvpWarId}:`, e.message);
    }
  }
}

module.exports = {
  ASSAULT_ATTACKER_SLOTS,
  ASSAULT_DEFENDER_SLOTS,
  QUOTA_PER_WINDOW,
  INTER_BATTLE_DELAY_MS,
  buildAttackerRoster,
  buildDefenderBatch,
  runConscriptAssaultWindow,
  tickWarPhasePolicies,
};
