/**
 * GET /api/players/:playerId/profile 对外 JSON（camelCase）
 * @see docs/00/00-base/02-architecture-split/40-conventions.md §1.2
 */

/** @param {object|null|undefined} positionConfig */
export function formatPlayerPositionConfigForApi(positionConfig) {
  if (!positionConfig || typeof positionConfig !== 'object') return positionConfig ?? null;
  if (positionConfig.positionBonuses != null && positionConfig.position_bonuses == null) {
    return positionConfig;
  }
  const { position_bonuses: positionBonusesLegacy, positionBonuses, ...rest } = positionConfig;
  const bonuses = positionBonuses ?? positionBonusesLegacy ?? null;
  return {
    ...rest,
    ...(bonuses != null ? { positionBonuses: bonuses } : {}),
  };
}

/**
 * @param {object} player Player model row + enrichments
 * @param {object} extras
 */
export function formatPlayerForProfileApi(player, extras = {}) {
  if (!player || typeof player !== 'object') return player;
  if (player.playerId != null) {
    return {
      ...player,
      positionConfig: formatPlayerPositionConfigForApi(
        player.positionConfig ?? player.position_config ?? null,
      ),
    };
  }
  const {
    positionConfig = null,
    attributeBonus = {},
    latestResources = {},
  } = extras;

  return {
    playerId: player.player_id,
    characterName: player.character_name,
    factionId: player.faction_id,
    factionName: player.faction_name,
    avatar: player.avatar,
    reputation: player.reputation,
    reputationToNext: player.reputation_to_next,
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
    skill1: player.skill_1,
    skill2: player.skill_2,
    currentPositionId: player.current_position_id,
    currentPositionName: player.current_position_name,
    positionLevel: player.position_level,
    positionConfig: formatPlayerPositionConfigForApi(positionConfig),
    morale: player.morale,
    items: player.items
      ? (typeof player.items === 'string' ? JSON.parse(player.items) : player.items)
      : {},
    troopAffinity: player.troop_affinity,
    trait: player.trait,
    traitModifier: player.trait_modifier,
    onDuty: !!player.on_duty,
    onDutyCityId: player.on_duty_city_id || null,
    mainCityId: player.main_city_id || null,
    mainCityChangedAt: player.main_city_changed_at || null,
    roadJunId: player.road_jun_id || null,
    roadPositionX: player.road_position_x != null ? Number(player.road_position_x) : null,
    roadPositionY: player.road_position_y != null ? Number(player.road_position_y) : null,
    roadIntercept: player.road_intercept ? 1 : 0,
    roadUpdatedAt: player.road_updated_at || null,
    roadReserveDate: player.road_reserve_date || null,
    roadReserveUsed: Number(player.road_reserve_used) || 0,
    roadMoveFreeDate: player.road_move_free_date || null,
    roadMoveFreeUsed: Number(player.road_move_free_used) || 0,
    bonusBackpackCapacity: player.bonus_backpack_capacity ?? 0,
    bonusDailyEvents: player.bonus_daily_events ?? 0,
    attributeBonus: attributeBonus || {},
    roadClientNotice: player.road_client_notice ?? null,
  };
}

/** @param {object} card enriched player_cards row (+ optional config) */
export function formatPlayerCardForProfileApi(card) {
  if (!card || typeof card !== 'object') return card;
  if (card.cardType != null && card.instanceId != null) return card;
  const { config, ...rest } = card;
  return {
    instanceId: rest.instance_id,
    cardType: rest.card_type,
    cardId: rest.card_id,
    rarity: rest.rarity,
    currentTroops: rest.current_troops,
    morale: rest.morale,
    characterEchoSlots: (() => {
      const raw = rest.character_echo_slots ?? rest.characterEchoSlots;
      if (raw == null) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return raw;
    })(),
    battleCount: rest.battle_count,
    maxBattleCount: rest.max_battle_count,
    usesRemaining: rest.uses_remaining,
    bonusMaxTroops: rest.bonus_max_troops,
    bonusAttack: rest.bonus_attack,
    bonusDefense: rest.bonus_defense,
    bonusSpeed: rest.bonus_speed,
    bonusMovement: rest.bonus_movement,
    lifetimeBattleCount: rest.lifetime_battle_count,
    veteranTier: rest.veteran_tier,
    veteranBonusPct: rest.veteran_bonus_pct,
    lastTroopsLostAt: rest.last_troops_lost_at,
    isEquipped: !!rest.is_equipped,
    equippedBy: rest.equipped_by,
    equippedSlot: rest.equipped_slot,
    obtainedAt: rest.obtained_at,
    mainCityBarracksStorage: rest.main_city_barracks_storage,
    equipmentSetData: rest.equipment_set_data,
    boundEquipmentSetInstanceId: rest.bound_equipment_set_instance_id,
    ...(config != null ? { config } : {}),
  };
}

/** @param {{ player: object, cards: object[], attributeBonusBySlot: object, gameTime: object }} payload */
export function formatPlayerProfilePayloadForApi(payload) {
  const playerRow = payload.player || {};
  const attributeBonusBySlot = payload.attributeBonusBySlot || {};
  return {
    player: formatPlayerForProfileApi(playerRow, {
      positionConfig: playerRow.position_config ?? playerRow.positionConfig ?? null,
      attributeBonus: playerRow.attribute_bonus ?? playerRow.attributeBonus ?? {},
      latestResources: {
        silver: playerRow.silver,
        food: playerRow.food,
      },
    }),
    cards: (payload.cards || []).map(formatPlayerCardForProfileApi),
    attributeBonusBySlot,
    gameTime: payload.gameTime ?? null,
  };
}
