/**
 * 战术图友军 NPC 单位形状（御驾亲征 / 宝物助阵等共用）
 * 须与 battleAllyNpcUnit.cjs 同步
 */

function dbNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/** 配置库 ×10 存储 → 战斗用 0–10 量纲（与 formatTroopData / formatCharacterData 一致） */
function gameScale(v, fb = 0) {
  return dbNum(v, fb) / 10;
}

/** 将领七维缺省 5（对应库内 50） */
function charAttr(v) {
  if (v == null || v === '') return 5;
  return dbNum(v) / 10;
}

/**
 * @param {{ characterRow?: object|null, troopRow: object, index?: number, sourceFlags?: object }} params
 * @returns {object|null}
 */
export function buildBattleAllyNpcUnit({ characterRow, troopRow, index, sourceFlags = {} }) {
  if (!troopRow) return null;
  const displayName = characterRow
    ? (characterRow.courtesy_name || characterRow.character_name || characterRow.characterName || characterRow.name)
    : null;
  const maxTroops = dbNum(troopRow.max_troops ?? troopRow.maxTroops);
  return {
    index: index ?? 9000,
    troopId: troopRow.troop_id || troopRow.id,
    troopName: troopRow.troop_name || troopRow.name,
    rarity: troopRow.rarity,
    maxTroops,
    currentTroops: maxTroops,
    attack: gameScale(troopRow.attack),
    defense: gameScale(troopRow.defense),
    speed: dbNum(troopRow.speed),
    movement: dbNum(troopRow.movement),
    attackRange: dbNum(troopRow.attack_range ?? troopRow.attackRange, 1),
    troopType: troopRow.troop_type || troopRow.troopType,
    weaponType: troopRow.weapon_type || troopRow.weaponType,
    alive: true,
    ...sourceFlags,
    character: characterRow
      ? {
          characterId: characterRow.character_id || characterRow.id,
          name: displayName,
          courtesyName: displayName,
          rarity: characterRow.rarity,
          luck: charAttr(characterRow.luck),
          courage: charAttr(characterRow.courage),
          combat: charAttr(characterRow.combat),
          command: charAttr(characterRow.command),
          intelligence: charAttr(characterRow.intelligence),
          politics: charAttr(characterRow.politics),
          charm: charAttr(characterRow.charm),
          traitModifier: dbNum(characterRow.trait_modifier ?? characterRow.traitModifier),
          troopAffinity: characterRow.troop_affinity || characterRow.troopAffinity || null,
          skill_1: characterRow.skill_1 || null,
          skill_2: characterRow.skill_2 || null,
        }
      : null,
  };
}
