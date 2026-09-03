/**
 * 战术内核 finalState → 自动对决写回口径适配器（17-5-3 阶段 2）
 *
 * 把 `runPvpTacticalDuel` 的 `{ winnerSide, finalState }` 映射成既有披挂/道路写回链
 * 期望的 `sim.*` 同形结构，使阶段 4 用战术内核替换 `runPvpAutoDuel` 时，
 * `applyAuthoritativePvpAutoDuelAttackerLineupCasualties` / `buildTroopsForAttackerScore` /
 * `buildTroopsForDefenderScore` / `recordAttackerCitySiegeResult` 等下游**无需改动**。
 *
 * 约定（canonical）：side 'a' = 攻方(attacker→faction 'player')、'b' = 守方(defender→faction 'enemy')。
 * 可经 attackerSide/defenderSide 覆盖（道路遭遇若反向编排）。
 *
 * 下游消费字段对齐：
 *   - 攻方伤亡写回：仅读 `attackerTroopsEnd[i].currentTroops`（按 index 对位 attackerSiegeNpcs）。
 *   - 战报计分：`calculateBattleScore` 读每条 troop 的 `faction`/`rarity`/`initialTroops|maxTroops`/`currentTroops`。
 *   - killedIndices：守方阵亡的 `npc.index`（缺省退化为数组下标），口径同 `runPvpAutoDuel`。
 */

/** finalState.units → Map(instanceId → unit) */
function buildByInstance(units) {
  const m = new Map();
  for (const u of units || []) {
    if (u && u.instanceId != null) m.set(u.instanceId, u);
  }
  return m;
}

/** 单条收尾 troop（计分 + 攻方写回所需最小字段，且与 runPvpAutoDuel.*TroopsEnd 同形） */
function endEntryFor(snap, finalUnit, faction) {
  const maxTroops = Math.max(0, Math.round(Number(snap?.maxTroops ?? snap?.currentTroops ?? 0) || 0));
  // initialTroops = 开战时实际兵力（与内核 snapshotToUnit 一致：snap.currentTroops ?? maxTroops）
  const initialTroops = Math.max(
    0,
    Math.round(Number(finalUnit?.initialTroops ?? snap?.currentTroops ?? maxTroops) || 0),
  );
  const rawCur = Number(finalUnit?.currentTroops ?? snap?.currentTroops ?? 0) || 0;
  const currentTroops = Math.max(0, Math.min(maxTroops || rawCur, Math.round(rawCur)));
  return {
    faction,
    rarity: snap?.rarity ?? 'common',
    troopType: snap?.troopType ?? 'infantry',
    maxTroops,
    initialTroops,
    currentTroops,
  };
}

/**
 * @param {object} params
 * @param {'a'|'b'|null} params.winnerSide          内核返回的胜方（平局 null）
 * @param {object} params.finalState                内核 finalState（须含 units[]）
 * @param {object[]} params.attackerSnapshot        攻方冻结快照（与内核 lineupSnapshots[attackerSide] 同序）
 * @param {object[]} params.defenderSnapshot        守方冻结快照（与内核 lineupSnapshots[defenderSide] 同序）
 * @param {'a'|'b'} [params.attackerSide='a']
 * @param {'a'|'b'} [params.defenderSide='b']
 * @returns {{ attackerWon: boolean, winnerSide: 'a'|'b'|null, attackerTroopsEnd: object[], defenderTroopsEnd: object[], killedIndices: number[], defenderLineupTroopUpdates: object[] }}
 */
function tacticalToAutoDuelResult({
  winnerSide,
  finalState,
  attackerSnapshot,
  defenderSnapshot,
  attackerSide = 'a',
  defenderSide = 'b',
} = {}) {
  if (!finalState || !Array.isArray(finalState.units)) {
    throw new Error('tacticalToAutoDuelResult: finalState.units 必须为数组');
  }
  if (!Array.isArray(attackerSnapshot) || !Array.isArray(defenderSnapshot)) {
    throw new Error('tacticalToAutoDuelResult: attackerSnapshot/defenderSnapshot 必须为数组');
  }

  const byInstance = buildByInstance(finalState.units);

  const attackerTroopsEnd = attackerSnapshot.map((snap, i) =>
    endEntryFor(snap, byInstance.get(`${attackerSide}_${i}`), 'player'),
  );
  const defenderTroopsEnd = defenderSnapshot.map((snap, i) =>
    endEntryFor(snap, byInstance.get(`${defenderSide}_${i}`), 'enemy'),
  );

  const killedIndices = [];
  defenderSnapshot.forEach((snap, i) => {
    if (defenderTroopsEnd[i].currentTroops <= 0) {
      killedIndices.push(snap?.index !== undefined ? snap.index : i);
    }
  });

  const defenderLineupTroopUpdates = defenderSnapshot
    .map((snap, i) => {
      const instanceId = snap?._troopInstanceId ?? snap?.instanceId ?? null;
      if (!instanceId) return null;
      return {
        instanceId,
        maxTroops: defenderTroopsEnd[i].maxTroops,
        currentTroops: defenderTroopsEnd[i].currentTroops,
      };
    })
    .filter(Boolean);

  return {
    attackerWon: winnerSide === attackerSide,
    winnerSide: winnerSide ?? null,
    attackerTroopsEnd,
    defenderTroopsEnd,
    killedIndices,
    defenderLineupTroopUpdates,
  };
}

module.exports = { tacticalToAutoDuelResult };
