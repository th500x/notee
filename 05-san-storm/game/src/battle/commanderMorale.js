/**
 * 战术图士气：同将领多 stack 共用士气池（按 commander 键同步）。
 * 歼灭一支 stack：该将领所属指挥官 −8（仍存活的其他 stack 同步）；
 * 对立方每个仍有兵的将领 +10（按将领去重，不因 stack 数量叠乘）。
 */

export const MORALE_NUM_MIN = 0;
export const MORALE_NUM_MAX = 120;

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
  applyMoraleDeltaToCommander(battleTroops, eliminatedTroop, -8);

  const victimFaction = eliminatedTroop.faction;
  const seen = new Set();
  for (const t of battleTroops) {
    if (!t) continue;
    if (!isOpposingKillerFaction(victimFaction, t.faction)) continue;
    if (t.currentTroops <= 0) continue;
    const dedupe = `${t.faction}|${commanderMoraleKey(t)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    applyMoraleDeltaToCommander(battleTroops, t, 10);
  }
}
