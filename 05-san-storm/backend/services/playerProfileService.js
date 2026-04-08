/**
 * GET /api/players/:playerId/profile 的完整档案构建（与 routes/players 对外 JSON 一致）
 */

const Player = require('../models/Player');
const { pool } = require('../database/connection');
const { formatTroopData } = require('./configService');
const garrisonService = require('./garrisonService');
const gameTimeService = require('./gameTimeService');
const equipmentSetService = require('./equipmentSetService');
const { getFactionFromTroopId } = require('./troopIdHelpers');
const playerCardLineupService = require('./playerCardLineupService');
const statisticsDeltaService = require('./statisticsDeltaService');

/**
 * @returns {Promise<{ notFound: true } | { data: object }>}
 */
async function getPlayerProfile(playerId) {
  const player = await Player.getById(playerId);
  if (!player) {
    return { notFound: true };
  }

  const clearedStaleOnDuty = await garrisonService.clearInvalidOnDutySelection(playerId);
  if (clearedStaleOnDuty) {
    player.on_duty = false;
    player.on_duty_city_id = null;
  }

  const [progressRows] = await pool.query(
    'SELECT tutorial_current_step FROM player_progress WHERE player_id = ?',
    [playerId]
  );
  const tutorialStep = progressRows[0]?.tutorial_current_step ?? 1;

  let positionConfig = null;
  if (player.current_position_id) {
    const [posRows] = await pool.query(
      `SELECT position_id, position_name, position_level, position_rank, rarity,
              icon, description, requirement, position_bonuses, permissions
       FROM config_positions WHERE position_id = ?`,
      [player.current_position_id]
    );
    if (posRows[0]) {
      const p = posRows[0];
      let bonuses = {};
      let perms = [];
      try {
        bonuses = typeof p.position_bonuses === 'string' ? JSON.parse(p.position_bonuses) : (p.position_bonuses || {});
      } catch {}
      try {
        perms = typeof p.permissions === 'string' ? JSON.parse(p.permissions) : (p.permissions || []);
      } catch {}
      positionConfig = {
        id: p.position_id,
        name: p.position_name,
        level: p.position_level,
        rank: p.position_rank,
        rarity: p.rarity || 'common',
        icon: p.icon,
        description: p.description,
        requirement: p.requirement,
        permissions: perms,
        position_bonuses: {
          reputationBonus: bonuses.reputation || 0,
          contributionBonus: bonuses.contribution || 0,
          resourceBonus: bonuses.resource || 0,
          infantryBonus: bonuses.infantry || 0,
          cavalryBonus: bonuses.cavalry || 0,
          archerBonus: bonuses.archer || 0,
        },
      };
    }
  }

  await playerCardLineupService.repairLineupCharacterCards(pool, playerId);

  const [cards] = await pool.query(
    `
      SELECT 
        pc.instance_id,
        pc.card_type,
        pc.card_id,
        pc.rarity,
        pc.current_troops,
        pc.morale,
        pc.battle_count,
        pc.max_battle_count,
        pc.bonus_max_troops,
        pc.bonus_attack,
        pc.bonus_defense,
        pc.bonus_speed,
        pc.bonus_movement,
        pc.last_troops_lost_at,
        pc.is_equipped,
        pc.equipped_by,
        pc.equipped_slot,
        pc.obtained_at,
        pc.equipment_set_data,
        pc.bound_equipment_set_instance_id
      FROM player_cards pc
      WHERE pc.player_id = ?
      ORDER BY pc.is_equipped DESC, pc.card_type, pc.obtained_at
    `,
    [playerId]
  );

  let playerFood = player.food || 0;
  for (const card of cards) {
    if (card.card_type !== 'troop' || !card.last_troops_lost_at) continue;
    const [troopCfgRows] = await pool.query('SELECT max_troops FROM config_troops WHERE troop_id = ?', [card.card_id]);
    const cfgMaxTroops = troopCfgRows[0]?.max_troops || 0;
    const maxTroops = cfgMaxTroops + (card.bonus_max_troops || 0);
    const gap = maxTroops - (card.current_troops || 0);
    if (gap <= 0) {
      await pool.query('UPDATE player_cards SET last_troops_lost_at = NULL WHERE instance_id = ?', [card.instance_id]);
      card.last_troops_lost_at = null;
      continue;
    }
    const t0Ms = new Date(card.last_troops_lost_at).getTime();
    const elapsedMs = Date.now() - t0Ms;
    const elapsedMin = elapsedMs / 60000;
    const canRecover = Math.floor(elapsedMin * 10);
    if (canRecover <= 0) continue;
    const foodNeededForFull = Math.ceil(gap / 10);
    const foodAvailable = playerFood;
    const maxRecoverByFood = foodAvailable * 10;
    const actualRecover = Math.min(canRecover, gap, maxRecoverByFood);
    if (actualRecover <= 0) continue;
    const foodCost = Math.ceil(actualRecover / 10);
    const newTroops = (card.current_troops || 0) + actualRecover;
    const isFull = newTroops >= maxTroops;
    const minutesConsumed = actualRecover / 10;
    const newLastTroopsLostAt = isFull ? null : new Date(t0Ms + minutesConsumed * 60000);
    await pool.query(
      `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ?`,
      [Math.min(newTroops, maxTroops), newLastTroopsLostAt, card.instance_id]
    );
    await pool.query('UPDATE players SET food = food - ? WHERE player_id = ?', [foodCost, playerId]);
    await statisticsDeltaService.incrementSpent(playerId, { food: foodCost });
    card.current_troops = Math.min(newTroops, maxTroops);
    if (isFull) card.last_troops_lost_at = null;
    else card.last_troops_lost_at = newLastTroopsLostAt;
    playerFood -= foodCost;
    player.food = playerFood;
    console.log(`[TroopRecover] ${card.card_id}: +${actualRecover}兵 -${foodCost}粮 (${card.current_troops}/${maxTroops})`);
  }

  const troopCards = cards.filter((c) => c.card_type === 'troop');
  let troopConfigs = {};
  if (troopCards.length > 0) {
    const troopIds = troopCards.map((c) => c.card_id);
    const placeholders = troopIds.map(() => '?').join(',');
    const [configs] = await pool.query(
      `
        SELECT troop_id, troop_name, troop_type, weapon_type,
               rarity, attack, defense, speed, movement, \`range\` AS troop_range,
               max_troops, special_ability, description
        FROM config_troops
        WHERE troop_id IN (${placeholders})
      `,
      troopIds
    );
    configs.forEach((c) => {
      troopConfigs[c.troop_id] = c;
    });
  }

  const equipCards = cards.filter((c) => c.card_type === 'equipment');
  let equipConfigs = {};
  if (equipCards.length > 0) {
    const equipIds = equipCards.map((c) => c.card_id);
    const placeholders2 = equipIds.map(() => '?').join(',');
    const [eConfigs] = await pool.query(
      `
        SELECT equipment_id, equipment_name, luck_bonus, courage_bonus,
               combat_bonus, command_bonus, intelligence_bonus, politics_bonus,
               charm_bonus, special_effect, special_effect_desc, description
        FROM config_equipment
        WHERE equipment_id IN (${placeholders2})
      `,
      equipIds
    );
    eConfigs.forEach((c) => {
      equipConfigs[c.equipment_id] = c;
    });
  }
  const equipBonusByInstance = {};
  for (const ec of equipCards) {
    const cfg = equipConfigs[ec.card_id];
    if (!cfg) continue;
    equipBonusByInstance[ec.instance_id] = {
      luck: Number(cfg.luck_bonus || 0),
      courage: Number(cfg.courage_bonus || 0),
      combat: Number(cfg.combat_bonus || 0),
      command: Number(cfg.command_bonus || 0),
      intelligence: Number(cfg.intelligence_bonus || 0),
      politics: Number(cfg.politics_bonus || 0),
      charm: Number(cfg.charm_bonus || 0),
    };
  }
  const boundPieceIdsBySet = {};
  for (const ec of equipCards) {
    const setId = ec.bound_equipment_set_instance_id;
    if (!setId) continue;
    if (!boundPieceIdsBySet[setId]) boundPieceIdsBySet[setId] = [];
    boundPieceIdsBySet[setId].push(ec.instance_id);
  }

  const titleCards = cards.filter((c) => c.card_type === 'title');
  let titleConfigs = {};
  if (titleCards.length > 0) {
    const titleIds = titleCards.map((c) => c.card_id);
    const placeholders3 = titleIds.map(() => '?').join(',');
    const [tConfigs] = await pool.query(
      `
        SELECT title_id, title_name, description, display_name,
               attribute_bonus, special_effect, special_effect_desc
        FROM config_titles
        WHERE title_id IN (${placeholders3})
      `,
      titleIds
    );
    tConfigs.forEach((c) => {
      titleConfigs[c.title_id] = c;
    });
  }

  const charCards = cards.filter((c) => c.card_type === 'character');
  let charConfigs = {};
  if (charCards.length > 0) {
    const charIds = charCards.map((c) => c.card_id);
    const placeholders4 = charIds.map(() => '?').join(',');
    const [cConfigs] = await pool.query(
      `
        SELECT character_id, character_name, rarity, stage, character_type,
               luck, courage, combat, command, intelligence, politics, charm,
               troop_affinity, trait, trait_modifier,
               skill_1, skill_2, character_extra
        FROM config_characters
        WHERE character_id IN (${placeholders4})
      `,
      charIds
    );
    cConfigs.forEach((c) => {
      charConfigs[c.character_id] = c;
    });
  }

  const equipTypeMap = { '1': 'weapon', '2': 'armor', '3': 'accessory' };
  const equipRarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
  const equipRarityScore = { common: 1, rare: 2, epic: 3, legendary: 4, core: 5 };
  const equipmentSetTierFromScore = (score) => {
    const s = Number(score) || 0;
    if (s <= 4) return 'common';
    if (s <= 8) return 'rare';
    if (s <= 12) return 'epic';
    if (s <= 16) return 'legendary';
    return 'core';
  };
  function parseEquipmentId(id) {
    const parts = id.split('_');
    const typeCode = parts[3] || '1';
    const seqStr = parts[4] || '1001';
    return {
      equipmentType: equipTypeMap[typeCode] || 'weapon',
      rarity: equipRarityMap[seqStr.charAt(0)] || 'common',
    };
  }
  const equipScoreByInstance = {};
  for (const ec of equipCards) {
    const parsed = parseEquipmentId(ec.card_id);
    const rarity = parsed.rarity || ec.rarity || 'common';
    equipScoreByInstance[ec.instance_id] = equipRarityScore[rarity] || 1;
  }

  const enrichedCards = cards.map((card) => {
    if (card.card_type === 'character' && charConfigs[card.card_id]) {
      const cfg = charConfigs[card.card_id];
      let extra = {};
      if (cfg.character_extra) {
        try {
          extra = typeof cfg.character_extra === 'string' ? JSON.parse(cfg.character_extra) : cfg.character_extra;
        } catch {}
      }
      return {
        ...card,
        config: {
          id: cfg.character_id,
          name: cfg.character_name,
          rarity: cfg.rarity,
          stage: cfg.stage,
          characterType: cfg.character_type,
          luck: cfg.luck / 10,
          courage: cfg.courage / 10,
          combat: cfg.combat / 10,
          command: cfg.command / 10,
          intelligence: cfg.intelligence / 10,
          politics: cfg.politics / 10,
          charm: cfg.charm / 10,
          troopAffinity: cfg.troop_affinity,
          trait: cfg.trait,
          traitModifier: cfg.trait_modifier,
          skills: [cfg.skill_1, cfg.skill_2].filter(Boolean),
          bond: Array.isArray(extra.bonds) ? extra.bonds.join(';') : (extra.bond || null),
          biography: extra.biography || null,
          description: extra.description || null,
          avatar: extra.avatar || null,
        },
      };
    }
    if (card.card_type === 'troop' && troopConfigs[card.card_id]) {
      const config = troopConfigs[card.card_id];
      const formatted = formatTroopData(config);
      formatted.faction = getFactionFromTroopId(config.troop_id);
      return {
        ...card,
        config: formatted,
      };
    }
    if (card.card_type === 'equipment' && equipConfigs[card.card_id]) {
      const cfg = equipConfigs[card.card_id];
      const parsed = parseEquipmentId(card.card_id);
      return {
        ...card,
        config: {
          equipmentId: cfg.equipment_id,
          equipmentName: cfg.equipment_name,
          equipmentType: parsed.equipmentType,
          rarity: parsed.rarity,
          luckBonus: (cfg.luck_bonus || 0) / 10,
          courageBonus: (cfg.courage_bonus || 0) / 10,
          combatBonus: (cfg.combat_bonus || 0) / 10,
          commandBonus: (cfg.command_bonus || 0) / 10,
          intelligenceBonus: (cfg.intelligence_bonus || 0) / 10,
          politicsBonus: (cfg.politics_bonus || 0) / 10,
          charmBonus: (cfg.charm_bonus || 0) / 10,
          specialEffect: cfg.special_effect || null,
          specialEffectDesc: cfg.special_effect_desc || null,
          description: cfg.description || null,
        },
      };
    }
    if (card.card_type === 'equipmentSet') {
      const d = equipmentSetService.parseSetData(card.equipment_set_data);
      const attr = {};
      const slotPieceIds = [
        d.weapon_instance_id,
        d.armor_instance_id,
        d.accessory_1_instance_id,
        d.accessory_2_instance_id,
      ].filter(Boolean);
      const boundPieceIds = boundPieceIdsBySet[card.instance_id] || [];
      const pieceIds = boundPieceIds.length > 0 ? boundPieceIds : slotPieceIds;
      for (const pid of pieceIds) {
        const b = equipBonusByInstance[pid];
        if (!b) continue;
        Object.entries(b).forEach(([k, v]) => {
          attr[k] = (attr[k] || 0) + (Number(v) || 0);
        });
      }
      const totalScore = pieceIds.reduce((sum, pid) => sum + (equipScoreByInstance[pid] || 1), 0);
      const setRarity = equipmentSetTierFromScore(totalScore);
      return {
        ...card,
        config: {
          equipmentSetShell: true,
          rarity: setRarity,
          displayName: d.display_name || null,
          weaponInstanceId: d.weapon_instance_id || null,
          armorInstanceId: d.armor_instance_id || null,
          accessory1InstanceId: d.accessory_1_instance_id || null,
          accessory2InstanceId: d.accessory_2_instance_id || null,
          totalScore,
          attributeBonus: attr,
        },
      };
    }
    if (card.card_type === 'title' && titleConfigs[card.card_id]) {
      const cfg = titleConfigs[card.card_id];
      const idRarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
      const parts = card.card_id.split('_');
      const seqStr = parts[parts.length - 1] || '';
      const rarity = idRarityMap[seqStr.charAt(0)] || 'common';
      let attributeBonus = {};
      if (cfg.attribute_bonus) {
        try {
          attributeBonus =
            typeof cfg.attribute_bonus === 'string' ? JSON.parse(cfg.attribute_bonus) : cfg.attribute_bonus;
        } catch {}
      }
      return {
        ...card,
        config: {
          id: cfg.title_id,
          name: cfg.title_name,
          rarity,
          description: cfg.description || null,
          displayName: cfg.display_name || null,
          attributeBonus,
          specialEffect: cfg.special_effect || null,
          specialEffectDesc: cfg.special_effect_desc || null,
        },
      };
    }
    return card;
  });

  await Player.updateLastActive(playerId);

  /** 资源可能在档案构建过程中被其他流程更新；末尾再读一次，避免顶栏银两/粮草滞后 */
  const [resourceRows] = await pool.query(
    'SELECT silver, food FROM players WHERE player_id = ?',
    [playerId]
  );
  const latestResources = resourceRows[0] || {};

  const attributeBonusBySlot = { player: {}, character1: {}, character2: {} };
  for (const card of enrichedCards) {
    if (!card.is_equipped || !card.config) continue;
    const ab = card.config.attributeBonus;
    if (!ab || typeof ab !== 'object') continue;
    const slot = card.equipped_by || 'player';
    if (!attributeBonusBySlot[slot]) attributeBonusBySlot[slot] = {};
    Object.entries(ab).forEach(([key, val]) => {
      attributeBonusBySlot[slot][key] = (attributeBonusBySlot[slot][key] || 0) + (Number(val) || 0);
    });
  }

  const garrisons = await garrisonService.getPlayerGarrisons(playerId);
  for (const g of garrisons) {
    for (const charKey of ['char1', 'char2']) {
      const effectFields = [`${charKey}_title`, `${charKey}_achievement`, `${charKey}_treasure`];
      for (const field of effectFields) {
        const instanceId = g[field];
        if (!instanceId) continue;
        const card = enrichedCards.find((c) => c.instance_id === instanceId);
        if (!card?.config?.attributeBonus) continue;
        const slotKey = `garrison${g.garrison_slot}_${charKey}`;
        if (!attributeBonusBySlot[slotKey]) attributeBonusBySlot[slotKey] = {};
        Object.entries(card.config.attributeBonus).forEach(([key, val]) => {
          attributeBonusBySlot[slotKey][key] = (attributeBonusBySlot[slotKey][key] || 0) + (Number(val) || 0);
        });
      }
    }
  }

  const gameTime = await gameTimeService.loadGameTimeForPlayer(playerId);

  return {
    data: {
      player: {
        player_id: player.player_id,
        character_name: player.character_name,
        faction_id: player.faction_id,
        faction_name: player.faction_name,
        avatar: player.avatar,
        reputation: player.reputation,
        reputation_to_next: player.reputation_to_next,
        contribution: player.contribution,
        silver: latestResources.silver ?? player.silver,
        food: latestResources.food ?? player.food,
        combat: player.combat,
        intelligence: player.intelligence,
        command: player.command,
        politics: player.politics,
        charm: player.charm,
        courage: player.courage,
        luck: player.luck,
        skill_1: player.skill_1,
        skill_2: player.skill_2,
        current_position_id: player.current_position_id,
        current_position_name: player.current_position_name,
        position_level: player.position_level,
        position_config: positionConfig,
        morale: player.morale,
        items: player.items ? (typeof player.items === 'string' ? JSON.parse(player.items) : player.items) : {},
        troop_affinity: player.troop_affinity,
        trait: player.trait,
        trait_modifier: player.trait_modifier,
        on_duty: !!player.on_duty,
        on_duty_city_id: player.on_duty_city_id || null,
        bonus_backpack_capacity: player.bonus_backpack_capacity ?? 0,
        bonus_daily_events: player.bonus_daily_events ?? 0,
        tutorial_step: tutorialStep,
        attribute_bonus: attributeBonusBySlot.player,
      },
      cards: enrichedCards,
      attributeBonusBySlot,
      gameTime,
    },
  };
}

// ── 新手引导进度 ──────────────────────────────────────────────────────────────

/**
 * 读取玩家的新手引导当前步骤（用于 GET /:playerId 附加 tutorial_step）。
 * @returns {number} 步骤编号，默认 1
 */
async function getTutorialStep(playerId) {
  const [rows] = await pool.query(
    'SELECT tutorial_current_step FROM player_progress WHERE player_id = ?',
    [playerId],
  );
  return rows[0]?.tutorial_current_step ?? 1;
}

/**
 * 更新新手引导进度（≥10 标记为完成）。
 */
async function updateTutorialProgress(playerId, step) {
  await pool.query(
    `UPDATE player_progress
     SET tutorial_current_step  = ?,
         tutorial_completed     = IF(? >= 10, TRUE, FALSE),
         tutorial_completed_at  = IF(? >= 10, NOW(), NULL)
     WHERE player_id = ?`,
    [step, step, step, playerId],
  );
}

module.exports = {
  getPlayerProfile,
  getTutorialStep,
  updateTutorialProgress,
};
