/**
 * 驻守/上阵编组的防守单位构建服务
 *
 * 职责：
 *   - 属性加成计算（称号/成就/宝物/装备套）
 *   - 将领属性修正 applyCharBonusToCharData
 *   - 构建防守战斗单位：buildDefenseUnits（驻地槽）/ buildDefenseUnitsFromMainLineup（上阵编组）
 *   - 披挂 PVP 服务端裁定后写回攻城方兵力
 *   - 格式转换：mapBuiltUnitsToSiegeNpcFormat
 *
 * 注意：此模块只处理「构建」逻辑；驻守 CRUD、城市防守者查询仍在 garrisonService.js。
 * 所有外部调用者仍通过 garrisonService 的再导出访问，无需更改 import 路径。
 *
 * @module backend/services/garrisonBuildService
 */

const { pool } = require('../database/connection');
const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');
const equipmentSetService = require('./equipmentSetService');
const {
  attachPositionCombatBonuses,
  loadPositionCombatBonusesForPlayer,
} = require('../../shared/utils/positionCombatBonuses.cjs');

/** 单部队参战最低兵力（兵力为 0 不参战；总兵力验证在 saveGarrison / initiateSiege） */
const MIN_TROOPS_TO_DEFEND = 1;

// ── 属性加成计算 ──────────────────────────────────────────────────────────────

/** special_effect 字段映射 → player_cards bonus 字段 */
const EFFECT_FIELD_MAP = {
  'max_troops_bonus': 'bonus_max_troops',
  'attack_bonus':     'bonus_attack',
  'defense_bonus':    'bonus_defense',
  'speed_bonus':      'bonus_speed',
  'movement_bonus':   'bonus_movement',
};

function parseSpecialEffect(effectStr) {
  if (!effectStr) return {};
  const bonus = {};
  effectStr.split(';').forEach((part) => {
    const [key, val] = part.trim().split(':');
    if (!key || !val) return;
    const field = EFFECT_FIELD_MAP[key];
    if (field) bonus[field] = parseInt(val) || 0;
  });
  return bonus;
}

async function getCardSpecialEffect(cardType, cardId) {
  const tableMap = {
    title:       { table: 'config_titles',       idField: 'title_id' },
    achievement: { table: 'config_achievements',  idField: 'achievement_id' },
  };
  const cfg = tableMap[cardType];
  if (!cfg) return {};
  const [rows] = await pool.query(
    `SELECT special_effect FROM ${cfg.table} WHERE ${cfg.idField} = ?`,
    [cardId],
  );
  return parseSpecialEffect(rows[0]?.special_effect);
}

/** target 对象上累加 bonus 所有字段（修改 target 本身，无返回值） */
function addAttrBonus(target, bonus = {}) {
  if (!bonus || typeof bonus !== 'object') return;
  Object.entries(bonus).forEach(([k, v]) => {
    target[k] = (target[k] || 0) + (Number(v) || 0);
  });
}

/**
 * 批量读取某配置表的 attribute_bonus 字段，返回 { id → bonusObject } 映射。
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 */
async function loadConfigAttributeBonusMap(conn, table, idField, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (uniq.length === 0) return {};
  const ph = uniq.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT ${idField} AS id, attribute_bonus FROM ${table} WHERE ${idField} IN (${ph})`,
    uniq,
  );
  const map = {};
  for (const r of rows) {
    let ab = {};
    if (r.attribute_bonus) {
      try { ab = typeof r.attribute_bonus === 'string' ? JSON.parse(r.attribute_bonus) : r.attribute_bonus; } catch {}
    }
    map[r.id] = ab || {};
  }
  return map;
}

/**
 * 将装备/称号等加成叠加到将领属性对象，返回新对象（不修改原始 charData）。
 * DB 值为 0-100 scale（×10），此处均以 /10 折算为显示值。
 */
function applyCharBonusToCharData(charData, bonus) {
  const b = bonus || {};
  return {
    ...charData,
    combat:       Number(charData.combat || 0)       + (Number(b.combat || 0) / 10),
    command:      Number(charData.command || 0)      + (Number(b.command || 0) / 10),
    intelligence: Number(charData.intelligence || 0) + (Number(b.intelligence || 0) / 10),
    luck:         Number(charData.luck || 0)         + (Number(b.luck || 0) / 10),
    courage:      Number(charData.courage || 0)      + (Number(b.courage || 0) / 10),
  };
}

/**
 * 读取玩家「上阵编组」的属性加成（称号/成就/宝物/装备套），按槽位分组。
 * 返回 { player: {}, character1: {}, character2: {} }。
 *
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 */
async function getMainLineupAttributeBonusBySlot(conn, playerId) {
  const out = { player: {}, character1: {}, character2: {} };
  const [equipped] = await conn.query(
    `SELECT instance_id, card_type, card_id, equipped_by, equipment_set_data
     FROM player_cards
     WHERE player_id = ? AND is_equipped = TRUE
       AND card_type IN ('title','achievement','treasure','equipmentSet')`,
    [playerId],
  );

  const titleIds    = equipped.filter((c) => c.card_type === 'title').map((c) => c.card_id);
  const achIds      = equipped.filter((c) => c.card_type === 'achievement').map((c) => c.card_id);
  const treasureIds = equipped.filter((c) => c.card_type === 'treasure').map((c) => c.card_id);

  const [titleMap, achMap, treasureMap] = await Promise.all([
    loadConfigAttributeBonusMap(conn, 'config_titles',       'title_id',       titleIds),
    loadConfigAttributeBonusMap(conn, 'config_achievements', 'achievement_id', achIds),
    loadConfigAttributeBonusMap(conn, 'config_treasures',    'treasure_id',    treasureIds),
  ]);

  const [equipRows] = await conn.query(
    `SELECT pc.instance_id, pc.bound_equipment_set_instance_id,
            ce.luck_bonus, ce.courage_bonus, ce.combat_bonus, ce.command_bonus,
            ce.intelligence_bonus, ce.politics_bonus, ce.charm_bonus
     FROM player_cards pc
     LEFT JOIN config_equipment ce ON ce.equipment_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'equipment'`,
    [playerId],
  );
  const equipBonusByInstance = {};
  const boundPieceIdsBySet = {};
  for (const e of equipRows) {
    equipBonusByInstance[e.instance_id] = {
      luck: Number(e.luck_bonus || 0), courage: Number(e.courage_bonus || 0),
      combat: Number(e.combat_bonus || 0), command: Number(e.command_bonus || 0),
      intelligence: Number(e.intelligence_bonus || 0),
      politics: Number(e.politics_bonus || 0), charm: Number(e.charm_bonus || 0),
    };
    if (e.bound_equipment_set_instance_id) {
      if (!boundPieceIdsBySet[e.bound_equipment_set_instance_id]) {
        boundPieceIdsBySet[e.bound_equipment_set_instance_id] = [];
      }
      boundPieceIdsBySet[e.bound_equipment_set_instance_id].push(e.instance_id);
    }
  }

  for (const card of equipped) {
    const slot = card.equipped_by || 'player';
    if (!out[slot]) out[slot] = {};
    if (card.card_type === 'title')       addAttrBonus(out[slot], titleMap[card.card_id] || {});
    if (card.card_type === 'achievement') addAttrBonus(out[slot], achMap[card.card_id] || {});
    if (card.card_type === 'treasure')    addAttrBonus(out[slot], treasureMap[card.card_id] || {});
    if (card.card_type === 'equipmentSet') {
      const d = equipmentSetService.parseSetData(card.equipment_set_data);
      const slotPieceIds = [
        d.weapon_instance_id, d.armor_instance_id, d.accessory_1_instance_id, d.accessory_2_instance_id,
      ].filter(Boolean);
      const boundPieceIds = boundPieceIdsBySet[card.instance_id] || [];
      const pieceIds = boundPieceIds.length > 0 ? boundPieceIds : slotPieceIds;
      const sum = {};
      pieceIds.forEach((pid) => addAttrBonus(sum, equipBonusByInstance[pid] || {}));
      addAttrBonus(out[slot], sum);
    }
  }
  return out;
}

/**
 * 读取驻守槽配置的属性加成，按将领槽（char1/char2）分组。
 * 返回 { char1: {}, char2: {} }。
 *
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {object} garrisonSlot - player_garrison 行
 */
async function getGarrisonSlotAttributeBonusByChar(conn, garrisonSlot) {
  const out = { char1: {}, char2: {} };
  if (!garrisonSlot) return out;

  const effectIds = [
    garrisonSlot.char1_title, garrisonSlot.char1_achievement,
    garrisonSlot.char1_treasure, garrisonSlot.char1_equipment_card,
    garrisonSlot.char2_title, garrisonSlot.char2_achievement,
    garrisonSlot.char2_treasure, garrisonSlot.char2_equipment_card,
  ].filter(Boolean);
  if (effectIds.length === 0) return out;

  const ph = effectIds.map(() => '?').join(',');
  const [cards] = await conn.query(
    `SELECT instance_id, card_type, card_id, equipment_set_data
     FROM player_cards
     WHERE player_id = ? AND instance_id IN (${ph})`,
    [garrisonSlot.player_id, ...effectIds],
  );
  const byInstance = {};
  cards.forEach((c) => { byInstance[c.instance_id] = c; });

  const titleIds    = cards.filter((c) => c.card_type === 'title').map((c) => c.card_id);
  const achIds      = cards.filter((c) => c.card_type === 'achievement').map((c) => c.card_id);
  const treasureIds = cards.filter((c) => c.card_type === 'treasure').map((c) => c.card_id);

  const [titleMap, achMap, treasureMap] = await Promise.all([
    loadConfigAttributeBonusMap(conn, 'config_titles',       'title_id',       titleIds),
    loadConfigAttributeBonusMap(conn, 'config_achievements', 'achievement_id', achIds),
    loadConfigAttributeBonusMap(conn, 'config_treasures',    'treasure_id',    treasureIds),
  ]);

  const [equipRows] = await conn.query(
    `SELECT pc.instance_id, pc.bound_equipment_set_instance_id,
            ce.luck_bonus, ce.courage_bonus, ce.combat_bonus, ce.command_bonus,
            ce.intelligence_bonus, ce.politics_bonus, ce.charm_bonus
     FROM player_cards pc
     LEFT JOIN config_equipment ce ON ce.equipment_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'equipment'`,
    [garrisonSlot.player_id],
  );
  const equipBonusByInstance = {};
  const boundPieceIdsBySet = {};
  for (const e of equipRows) {
    equipBonusByInstance[e.instance_id] = {
      luck: Number(e.luck_bonus || 0), courage: Number(e.courage_bonus || 0),
      combat: Number(e.combat_bonus || 0), command: Number(e.command_bonus || 0),
      intelligence: Number(e.intelligence_bonus || 0),
      politics: Number(e.politics_bonus || 0), charm: Number(e.charm_bonus || 0),
    };
    if (e.bound_equipment_set_instance_id) {
      if (!boundPieceIdsBySet[e.bound_equipment_set_instance_id]) {
        boundPieceIdsBySet[e.bound_equipment_set_instance_id] = [];
      }
      boundPieceIdsBySet[e.bound_equipment_set_instance_id].push(e.instance_id);
    }
  }

  const applyOne = (charKey, instanceId) => {
    if (!instanceId) return;
    const c = byInstance[instanceId];
    if (!c) return;
    if (c.card_type === 'title')       addAttrBonus(out[charKey], titleMap[c.card_id] || {});
    if (c.card_type === 'achievement') addAttrBonus(out[charKey], achMap[c.card_id] || {});
    if (c.card_type === 'treasure')    addAttrBonus(out[charKey], treasureMap[c.card_id] || {});
    if (c.card_type === 'equipmentSet') {
      const d = equipmentSetService.parseSetData(c.equipment_set_data);
      const slotPieceIds = [
        d.weapon_instance_id, d.armor_instance_id, d.accessory_1_instance_id, d.accessory_2_instance_id,
      ].filter(Boolean);
      const boundPieceIds = boundPieceIdsBySet[c.instance_id] || [];
      const pieceIds = boundPieceIds.length > 0 ? boundPieceIds : slotPieceIds;
      const sum = {};
      pieceIds.forEach((pid) => addAttrBonus(sum, equipBonusByInstance[pid] || {}));
      addAttrBonus(out[charKey], sum);
    }
  };

  applyOne('char1', garrisonSlot.char1_title);
  applyOne('char1', garrisonSlot.char1_achievement);
  applyOne('char1', garrisonSlot.char1_treasure);
  applyOne('char1', garrisonSlot.char1_equipment_card);
  applyOne('char2', garrisonSlot.char2_title);
  applyOne('char2', garrisonSlot.char2_achievement);
  applyOne('char2', garrisonSlot.char2_treasure);
  applyOne('char2', garrisonSlot.char2_equipment_card);

  return out;
}

// ── 防守单位构建 ──────────────────────────────────────────────────────────────

/**
 * 从驻守配置构建战斗单位（用于异步 PVE 防守）。
 * 只有 currentTroops >= MIN_TROOPS_TO_DEFEND 的部队才参战。
 *
 * @param {object} garrisonSlot - player_garrison 的一行
 * @returns {Promise<Array>} 战斗单位数组（格式与 battlePlayerBuilder 一致）
 */
async function buildDefenseUnits(garrisonSlot) {
  const units = [];
  const defenderPosBonuses = await loadPositionCombatBonusesForPlayer(pool, garrisonSlot.player_id);
  const withPositionCombat = (charData) =>
    attachPositionCombatBonuses(charData, defenderPosBonuses);
  const garrisonAttrBonusByChar = await getGarrisonSlotAttributeBonusByChar(pool, garrisonSlot);
  const charSlots = [
    { cardField: 'char1_card', troop1Field: 'char1_troop1', troop2Field: 'char1_troop2' },
    { cardField: 'char2_card', troop1Field: 'char2_troop1', troop2Field: 'char2_troop2' },
  ];

  for (const cs of charSlots) {
    const charInstanceId = garrisonSlot[cs.cardField];
    if (!charInstanceId) continue;

    const [charRows] = await pool.query(
      `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.morale,
              cc.character_name, cc.luck, cc.courage, cc.combat, cc.command,
              cc.intelligence, cc.politics, cc.charm, cc.trait, cc.trait_modifier,
              cc.skill_1, cc.skill_2, cc.troop_affinity
       FROM player_cards pc
       JOIN config_characters cc ON pc.card_id = cc.character_id
       WHERE pc.instance_id = ?`,
      [charInstanceId],
    );
    if (charRows.length === 0) continue;
    const charCfg = charRows[0];

    const charDataBase = {
      name: charCfg.character_name,
      courtesyName: charCfg.character_name,
      combat:       charCfg.combat / 10,
      command:      charCfg.command / 10,
      intelligence: charCfg.intelligence / 10,
      luck:         charCfg.luck / 10,
      courage:      charCfg.courage / 10,
      traitModifier: charCfg.trait_modifier || 0,
    };
    const charKey = cs.cardField === 'char1_card' ? 'char1' : 'char2';
    const charData = withPositionCombat(
      applyCharBonusToCharData(charDataBase, garrisonAttrBonusByChar[charKey] || {}),
    );

    const troopInstanceIds = [garrisonSlot[cs.troop1Field], garrisonSlot[cs.troop2Field]].filter(Boolean);
    for (const troopInstId of troopInstanceIds) {
      const [troopRows] = await pool.query(
        `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
                pc.battle_count, pc.max_battle_count, pc.veteran_bonus_pct,
                pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
                ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
                ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability,
                ct.troop_weight
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.instance_id = ?`,
        [troopInstId],
      );
      if (troopRows.length === 0) continue;
      const t = troopRows[0];

      const maxTroops = (t.max_troops || 0) + (t.bonus_max_troops || 0);
      const currentTroops = t.current_troops ?? maxTroops;
      if (currentTroops < MIN_TROOPS_TO_DEFEND) continue;
      const vetMult = 1 + (Number(t.veteran_bonus_pct) || 0) / 100;

      units.push({
        troop: {
          id: t.card_id,
          instanceId: t.instance_id,
          name: t.troop_name,
          rarity: t.rarity || 'common',
          troopType: t.troop_type,
          weaponType: t.weapon_type,
          attack:   ((t.attack || 0) / 10 + (t.bonus_attack || 0) / 10) * vetMult,
          defense:  ((t.defense || 0) / 10 + (t.bonus_defense || 0) / 10) * vetMult,
          speed:    Math.round(((t.speed || 0) + (t.bonus_speed || 0)) * vetMult),
          movement: Math.round(((t.movement || 0) + (t.bonus_movement || 0)) * vetMult),
          range:    t.range || 1,
          maxTroops,
          troopWeight: t.troop_weight || 1,
          battleCount: t.battle_count ?? 0,
          maxBattleCount: t.max_battle_count ?? 60,
          skills: [],
        },
        character: charData,
        currentTroops,
        maxTroops,
        morale: charCfg.morale ?? 70,
        _garrisonPlayerId: garrisonSlot.player_id,
        _garrisonSlot: garrisonSlot.garrison_slot,
        _garrisonCityId: garrisonSlot.city_id || null,
      });
    }
  }

  return units;
}

/**
 * 从玩家「上阵编组」（is_equipped 部队）构建战斗单位，与驻地编组无关。
 * _garrisonSlot 固定为 0，表示非驻守槽（战后不刷 player_garrison 失活）。
 *
 * @param {string} defenderPlayerId
 * @returns {Promise<Array>} 与 buildDefenseUnits 相同元素形状
 */
async function buildDefenseUnitsFromMainLineup(defenderPlayerId) {
  const units = [];
  const defenderPosBonuses = await loadPositionCombatBonusesForPlayer(pool, defenderPlayerId);
  const withPositionCombat = (charData) =>
    attachPositionCombatBonuses(charData, defenderPosBonuses);
  const attrBonusBySlot = await getMainLineupAttributeBonusBySlot(pool, defenderPlayerId);
  const [pRows] = await pool.query(
    `SELECT player_id, character_name, combat, command, intelligence, politics, charm, courage, luck, morale
     FROM players WHERE player_id = ?`,
    [defenderPlayerId],
  );
  const pRow = pRows[0];
  if (!pRow) return units;

  const pushUnit = (t, charData, charMorale) => {
    const maxTroops = (t.max_troops || 0) + (t.bonus_max_troops || 0);
    const currentTroops = t.current_troops ?? maxTroops;
    if (currentTroops < MIN_TROOPS_TO_DEFEND) return;
    const vetMult = 1 + (Number(t.veteran_bonus_pct) || 0) / 100;
    units.push({
      troop: {
        id: t.card_id,
        instanceId: t.instance_id,
        name: t.troop_name,
        rarity: t.rarity || 'common',
        troopType: t.troop_type,
        weaponType: t.weapon_type,
        attack:   ((t.attack || 0) / 10 + (t.bonus_attack || 0) / 10) * vetMult,
        defense:  ((t.defense || 0) / 10 + (t.bonus_defense || 0) / 10) * vetMult,
        speed:    Math.round(((t.speed || 0) + (t.bonus_speed || 0)) * vetMult),
        movement: Math.round(((t.movement || 0) + (t.bonus_movement || 0)) * vetMult),
        range:    t.range || 1,
        maxTroops,
        troopWeight: t.troop_weight || 1,
        battleCount: t.battle_count ?? 0,
        maxBattleCount: t.max_battle_count ?? 60,
        skills: [],
      },
      character: charData,
      currentTroops,
      maxTroops,
      morale: charMorale ?? 70,
      _garrisonPlayerId: defenderPlayerId,
      _garrisonSlot: 0,
    });
  };

  // 主公本人 + 主公部队槽
  const [playerTroopRows] = await pool.query(
    `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
            pc.battle_count, pc.max_battle_count, pc.veteran_bonus_pct,
            pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
            ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
            ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability, ct.troop_weight
     FROM player_cards pc
     JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.is_equipped = TRUE
       AND pc.equipped_by = 'player' AND pc.equipped_slot = 'troop'`,
    [defenderPlayerId],
  );
  if (playerTroopRows.length > 0) {
    const charDataBase = {
      name: pRow.character_name, courtesyName: pRow.character_name,
      combat: pRow.combat / 10, command: pRow.command / 10,
      intelligence: pRow.intelligence / 10, luck: pRow.luck / 10,
      courage: pRow.courage / 10, traitModifier: 0,
    };
    pushUnit(
      playerTroopRows[0],
      withPositionCombat(applyCharBonusToCharData(charDataBase, attrBonusBySlot.player || {})),
      pRow.morale ?? 70,
    );
  }

  // 将领 1/2 各自部队槽
  for (const cs of [
    { by: 'character1', troopSlots: ['troop1', 'troop2'] },
    { by: 'character2', troopSlots: ['troop1', 'troop2'] },
  ]) {
    const [charRows] = await pool.query(
      `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.morale,
              cc.character_name, cc.luck, cc.courage, cc.combat, cc.command,
              cc.intelligence, cc.politics, cc.charm, cc.trait, cc.trait_modifier
       FROM player_cards pc
       JOIN config_characters cc ON pc.card_id = cc.character_id
       WHERE pc.player_id = ? AND pc.is_equipped = TRUE
         AND pc.card_type = 'character' AND pc.equipped_by = ? AND pc.equipped_slot = 'character'`,
      [defenderPlayerId, cs.by],
    );
    if (charRows.length === 0) continue;
    const charCfg = charRows[0];
    const charDataBase = {
      name: charCfg.character_name, courtesyName: charCfg.character_name,
      combat: charCfg.combat / 10, command: charCfg.command / 10,
      intelligence: charCfg.intelligence / 10, luck: charCfg.luck / 10,
      courage: charCfg.courage / 10, traitModifier: charCfg.trait_modifier || 0,
    };
    const charData = withPositionCombat(
      applyCharBonusToCharData(charDataBase, attrBonusBySlot[cs.by] || {}),
    );

    for (const slot of cs.troopSlots) {
      const [troopRows] = await pool.query(
        `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
                pc.battle_count, pc.max_battle_count, pc.veteran_bonus_pct,
                pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
                ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
                ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability, ct.troop_weight
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.player_id = ? AND pc.is_equipped = TRUE
           AND pc.card_type = 'troop' AND pc.equipped_by = ? AND pc.equipped_slot = ?`,
        [defenderPlayerId, cs.by, slot],
      );
      if (troopRows.length === 0) continue;
      pushUnit(troopRows[0], charData, charCfg.morale ?? 70);
    }
  }

  return units;
}

// ── 披挂 PVP 服务端结算 ───────────────────────────────────────────────────────

/**
 * 披挂 PVP 服务端裁定：按推演终态写回攻城方「上阵编组」兵力，
 * 并全员部队卡 battle_count+1（对齐 POST /battles）。
 *
 * @param {string}   playerId
 * @param {object[]} attackerSiegeNpcs  mapBuiltUnitsToSiegeNpcFormat 结果
 * @param {object[]} attackerTroopsEnd  runSiegePvpSkirmish.attackerTroopsEnd
 */
async function applyAuthoritativeSiegePvpAttackerLineupCasualties(playerId, attackerSiegeNpcs, attackerTroopsEnd) {
  if (!playerId || !Array.isArray(attackerSiegeNpcs) || !Array.isArray(attackerTroopsEnd)) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE player_cards
       SET battle_count = LEAST(
         GREATEST(COALESCE(battle_count, 0), 0) + 1,
         COALESCE(max_battle_count, 60)
       ),
       lifetime_battle_count = COALESCE(lifetime_battle_count, 0) + 1
       WHERE player_id = ? AND card_type = 'troop' AND is_equipped = TRUE`,
      [playerId],
    );
    for (let i = 0; i < attackerSiegeNpcs.length; i++) {
      const npc = attackerSiegeNpcs[i];
      const end = attackerTroopsEnd[i];
      if (!npc?._troopInstanceId || !end) continue;
      const maxT = Number(npc.maxTroops) || 9999;
      const cur = Math.max(0, Math.min(maxT, Math.round(Number(end.currentTroops) || 0)));
      await conn.query(
        'UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?',
        [cur, cur < maxT ? new Date() : null, npc._troopInstanceId, playerId],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  await applyTroopDurabilityExhaustion((sql, params) => pool.query(sql, params), playerId);
}

/**
 * 将 buildDefenseUnits/buildDefenseUnitsFromMainLineup 输出转为攻城 API npcGarrison 格式
 * （与 cityService.initiateSiege 一致）。
 */
function mapBuiltUnitsToSiegeNpcFormat(units) {
  if (!Array.isArray(units)) return [];
  return units.map((u, i) => ({
    index: i,
    troopId:    u.troop.id,
    troopName:  u.troop.name,
    rarity:     u.troop.rarity,
    troopType:  u.troop.troopType,
    weaponType: u.troop.weaponType,
    attack:     Math.round(u.troop.attack * 10),
    defense:    Math.round(u.troop.defense * 10),
    speed:      u.troop.speed,
    movement:   u.troop.movement,
    attackRange: u.troop.range,
    maxTroops:  u.troop.maxTroops,
    currentTroops: u.currentTroops,
    character: u.character
      ? {
          name:          u.character.name,
          courtesyName:  u.character.courtesyName || u.character.name,
          luck:          Math.round(u.character.luck * 10),
          courage:       Math.round(u.character.courage * 10),
          combat:        Math.round(u.character.combat * 10),
          command:       Math.round(u.character.command * 10),
          intelligence:  Math.round(u.character.intelligence * 10),
          politics:      50,
          charm:         50,
          traitModifier: u.character.traitModifier || 0,
          ...(u.character.positionBonuses ? { positionBonuses: u.character.positionBonuses } : {}),
        }
      : null,
    alive: true,
    _isPlayerDefender:  true,
    _garrisonPlayerId:  u._garrisonPlayerId,
    _garrisonSlot:      u._garrisonSlot,
    _garrisonCityId:    u._garrisonCityId ?? null,
    _troopInstanceId:   u.troop.instanceId,
  }));
}

module.exports = {
  MIN_TROOPS_TO_DEFEND,
  addAttrBonus,
  applyCharBonusToCharData,
  getMainLineupAttributeBonusBySlot,
  getGarrisonSlotAttributeBonusByChar,
  buildDefenseUnits,
  buildDefenseUnitsFromMainLineup,
  applyAuthoritativeSiegePvpAttackerLineupCasualties,
  mapBuiltUnitsToSiegeNpcFormat,
};
