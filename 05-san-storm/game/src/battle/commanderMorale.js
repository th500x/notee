/**
 * 战术图士气：同将领多 stack 共用士气池（按 commander 键同步）。
 * 歼灭一支 stack：该将领所属指挥官 −10（仍存活的其他 stack 同步）；
 * 对立方每个仍有兵的将领 +1（按将领去重，不因 stack 数量叠乘）。
 */

export const MORALE_NUM_MIN = 0;
export const MORALE_NUM_MAX = 120;

/** 击灭敌方 stack：己方每个仍有兵的将领 +N（按将领去重，17-1 §5） */
export const MORALE_DELTA_ON_ENEMY_STACK_KILLED = 1;
/** 己方 stack 被歼：该将领 −N（同将多 stack 同步） */
export const MORALE_DELTA_ON_OWN_STACK_ELIMINATED = -10;

export function clampMoraleValue(m) {
  const n = Math.round(Number(m) || 0);
  return Math.max(MORALE_NUM_MIN, Math.min(MORALE_NUM_MAX, n));
}

/**
 * @param {object} troop
 * @returns {string}
 */
export function commanderMoraleKey(troop) {
  if (!troop) return '∅';
  const fac = troop.faction || 'neutral';
  if (troop.lineupSlot) {
    return `${fac}|ls:${troop.lineupSlot}`;
  }
  if (troop.campaignCharId) {
    return `${fac}|cc:${troop.campaignCharId}`;
  }
  const ch = troop.character;
  const cid = ch?.id ?? ch?.character_id ?? ch?.characterId ?? troop.characterId;
  if (cid) {
    return `${fac}|id:${String(cid)}`;
  }
  const nm = (ch?.courtesyName || ch?.name || ch?.courtesy_name || troop.displayName || '').trim();
  if (nm) {
    return `${fac}|n:${nm}`;
  }
  return `${fac}|tid:${troop.id}`;
}

function isOpposingKillerFaction(victimFaction, tFaction) {
  if (victimFaction === 'enemy') {
    return tFaction === 'player' || tFaction === 'ally';
  }
  return tFaction === 'enemy';
}

/**
 * 对同阵营、同 commander 键下所有仍存活 stack 应用士气增量（并 clamp）。
 * @param {object[]} battleTroops
 * @param {object} referenceTroop
 * @param {number} delta
 */
export function applyMoraleDeltaToCommander(battleTroops, referenceTroop, delta) {
  if (!referenceTroop || !Array.isArray(battleTroops)) return;
  const key = commanderMoraleKey(referenceTroop);
  const fac = referenceTroop.faction;
  for (const t of battleTroops) {
    if (!t || t.faction !== fac) continue;
    if (commanderMoraleKey(t) !== key) continue;
    if (t.currentTroops <= 0) continue;
    t.morale = clampMoraleValue((t.morale ?? 70) + delta);
  }
}

/**
 * 部队被歼灭时的士气结算（在 `troop.currentTroops` 置 0 之前或之后均可：歼灭的 stack 不参与加算）。
 * @param {object[]} battleTroops
 * @param {object} eliminatedTroop
 */
export function applyMoraleOnStackEliminated(battleTroops, eliminatedTroop) {
  if (!eliminatedTroop || !Array.isArray(battleTroops)) return;
  applyMoraleDeltaToCommander(battleTroops, eliminatedTroop, MORALE_DELTA_ON_OWN_STACK_ELIMINATED);

  const victimFaction = eliminatedTroop.faction;
  const seen = new Set();
  for (const t of battleTroops) {
    if (!t) continue;
    if (!isOpposingKillerFaction(victimFaction, t.faction)) continue;
    if (t.currentTroops <= 0) continue;
    const dedupe = `${t.faction}|${commanderMoraleKey(t)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    applyMoraleDeltaToCommander(battleTroops, t, MORALE_DELTA_ON_ENEMY_STACK_KILLED);
  }
}

/**
 * 战后士气持久化：按 **主公 / 将领卡** 去重（非部队卡）。
 * 分组键与战中 `commanderMoraleKey` 一致；终值取同组 **存活 stack 的最高士气**（避免死兵残留旧值）。
 *
 * @param {object[]} playerTroops 战术结束时的我方 battleTroops
 * @returns {Array<{ target: 'player'|'card', instanceId?: string, morale: number }>}
 */
export function buildMoralePersistUpdatesFromBattleTroops(playerTroops) {
  if (!Array.isArray(playerTroops) || playerTroops.length === 0) return [];

  /** @type {Map<string, { target: 'player'|'card', instanceId?: string, morale: number }>} */
  const byBattleKey = new Map();

  for (const t of playerTroops) {
    if (!t) continue;
    const battleKey = commanderMoraleKey(t);
    const morale = clampMoraleValue(t.morale ?? 70);
    const alive = (t.currentTroops ?? 0) > 0;
    const isPlayerCommander =
      t.commanderMoraleTarget === 'player' ||
      t.lineupSlot === 'player' ||
      (!t.lineupSlot && !t.commanderInstanceId);
    const prev = byBattleKey.get(battleKey);
    if (!prev) {
      byBattleKey.set(battleKey, {
        target: isPlayerCommander ? 'player' : 'card',
        instanceId: isPlayerCommander ? undefined : t.commanderInstanceId,
        morale,
        _alive: alive,
      });
      continue;
    }
    if (alive && !prev._alive) {
      byBattleKey.set(battleKey, {
        ...prev,
        morale,
        instanceId: prev.instanceId || t.commanderInstanceId,
        _alive: true,
      });
    } else if (alive === prev._alive) {
      byBattleKey.set(battleKey, {
        ...prev,
        morale: Math.max(prev.morale, morale),
        instanceId: prev.instanceId || t.commanderInstanceId,
      });
    } else if (prev._alive && !alive) {
      byBattleKey.set(battleKey, {
        ...prev,
        morale: Math.max(prev.morale, morale),
        instanceId: prev.instanceId || t.commanderInstanceId,
      });
    }
  }

  /** @type {Map<string, { target: 'player'|'card', instanceId?: string, morale: number }>} */
  const merged = new Map();
  for (const entry of byBattleKey.values()) {
    const persistKey =
      entry.target === 'player'
        ? '__player__'
        : `card:${String(entry.instanceId || '').trim()}`;
    if (entry.target === 'card' && !entry.instanceId) continue;
    const prev = merged.get(persistKey);
    if (!prev || entry.morale > prev.morale) {
      merged.set(persistKey, {
        target: entry.target,
        instanceId: entry.instanceId,
        morale: entry.morale,
      });
    }
  }

  const updates = [];
  for (const entry of merged.values()) {
    if (entry.target === 'player') {
      updates.push({ target: 'player', morale: entry.morale });
    } else if (entry.instanceId) {
      updates.push({ target: 'card', instanceId: entry.instanceId, morale: entry.morale });
    }
  }
  return updates;
}
