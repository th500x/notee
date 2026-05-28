/**
 * 将 `initiateAttackerCitySiege` 返回的 `imperialMarchAlly`（NPC 形状）
 * 转为 `buildSiegeUnits` 可用的友军单位。
 *
 * @param {object|null} npc
 * @returns {object|null}
 */
export function imperialMarchNpcToAllyUnit(npc) {
  if (!npc || !npc.troopId) return null;
  const raw = npc.character;
  const charName = raw
    ? (raw.courtesyName || raw.courtesy_name || raw.name || raw.character_name)
    : null;
  return {
    troop: {
      id: npc.troopId,
      name: npc.troopName,
      rarity: npc.rarity,
      troopType: npc.troopType,
      weaponType: npc.weaponType,
      attack: npc.attack,
      defense: npc.defense,
      speed: npc.speed,
      movement: npc.movement,
      range: npc.attackRange ?? npc.range,
      maxTroops: npc.maxTroops,
    },
    currentTroops: npc.currentTroops ?? npc.maxTroops,
    maxTroops: npc.maxTroops,
    character: raw
      ? {
          name: charName,
          courtesyName: charName,
          luck: raw.luck,
          courage: raw.courage,
          combat: raw.combat,
          command: raw.command,
          intelligence: raw.intelligence,
          politics: raw.politics,
          charm: raw.charm,
        }
      : null,
    morale: 85,
    imperialMarch: true,
    _npcIndex: npc.index,
  };
}
