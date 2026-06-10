/**
 * 将后端 `buildBattleAllyNpcUnit` 形状转为 SmallMapBattle / buildSiegeUnits 友军单位。
 * 御驾亲征、宝物助阵等共用。
 */

/**
 * @param {object|null} npc
 * @returns {object|null}
 */
export function battleAllyNpcToUnit(npc) {
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
          trait: raw.trait,
          traitModifier: raw.traitModifier ?? raw.trait_modifier ?? 0,
          skill_1: raw.skill_1 ?? raw.skill1 ?? null,
          skill_2: raw.skill_2 ?? raw.skill2 ?? null,
        }
      : null,
    morale: 85,
    imperialMarch: !!npc.imperialMarch,
    treasureBattleAlly: !!npc.treasureBattleAlly,
    _npcIndex: npc.index,
  };
}

/** @param {object[]|null|undefined} npcs */
export function battleAllyNpcsToUnits(npcs) {
  return (npcs || []).map(battleAllyNpcToUnit).filter(Boolean);
}

/** @deprecated 使用 battleAllyNpcToUnit */
export function imperialMarchNpcToAllyUnit(npc) {
  return battleAllyNpcToUnit(npc);
}
