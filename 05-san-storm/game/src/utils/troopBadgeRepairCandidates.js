/**
 * 部队徽章恢复：候选列表与展示名（编组-道具）
 */

export function troopCardDisplayName(card) {
  return (
    card?.config?.troopName ||
    card?.config?.name ||
    card?.troopName ||
    card?.name ||
    card?.cardId ||
    '部队'
  );
}

export function isWornLegendaryOrCoreTroop(card) {
  if (!card || card.cardType !== 'troop') return false;
  const rarity = String(card.config?.rarity || card.rarity || '').toLowerCase();
  if (rarity !== 'legendary' && rarity !== 'core') return false;
  return Math.max(0, Number(card.battleCount) || 0) > 0;
}

/**
 * @param {{ barracksTroops?: any[], mainTroops?: any[], extraTroops?: any[] }} pools
 * @returns {{ card: any, location: string }[]}
 */
export function buildBadgeRepairCandidates({
  barracksTroops = [],
  mainTroops = [],
  extraTroops = [],
} = {}) {
  /** @type {Map<string, { card: any, location: string }>} */
  const map = new Map();
  const put = (list, location) => {
    for (const card of list || []) {
      if (!isWornLegendaryOrCoreTroop(card)) continue;
      const id = card.instanceId;
      if (!id) continue;
      map.set(id, { card, location });
    }
  };
  // 后写覆盖：编组优先于军营
  put(barracksTroops, '军营');
  put(mainTroops, '编组 Main');
  put(extraTroops, '编组 Extra');
  return [...map.values()];
}
