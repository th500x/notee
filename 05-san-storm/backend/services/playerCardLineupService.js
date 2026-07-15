/**
 * 编组：卡牌特效 → 部队加成、将领槽修复、装备/卸下
 * 由 routes/players.js 调用，保持 API 不变。
 */

const { pool } = require('../database/connection');
const characterRankService = require('./characterRankService');
const {
  CARD_TROOP_EFFECT_CARD_TYPES,
  loadCardTroopSpecialEffectBonus,
  parseCardTroopSpecialEffect,
} = require('../../shared/utils/cardTroopSpecialEffect.cjs');
const {
  getPlayerFactionTroopMaxTroopsBonus,
} = require('./factionGameplayBonusService');

const EFFECT_CARD_TYPES = CARD_TROOP_EFFECT_CARD_TYPES;

async function getCardSpecialEffect(poolConn, cardType, cardId) {
  return loadCardTroopSpecialEffectBonus(poolConn, cardType, cardId);
}

/** 装备卡牌时：将特效加成写入同一 equippedBy 下的所有部队卡 */
async function applyCardBonusToTroops(poolConn, playerId, equippedBy, cardType, cardId) {
  const bonus = await getCardSpecialEffect(poolConn, cardType, cardId);
  if (Object.keys(bonus).length === 0) return;

  const sets = Object.entries(bonus)
    .map(([field, val]) => `${field} = ${field} + ${val}`)
    .join(', ');
  await poolConn.query(
    `UPDATE player_cards SET ${sets}
     WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
    [playerId, equippedBy]
  );
  if (bonus.bonus_max_troops) {
    await poolConn.query(
      `UPDATE player_cards SET last_troops_lost_at = NOW()
       WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE
       AND last_troops_lost_at IS NULL`,
      [playerId, equippedBy]
    );
  }
  console.log(`[CardBonus] 应用特效: ${cardType}/${cardId} → ${equippedBy} 部队卡 (${JSON.stringify(bonus)})`);
}

/**
 * 编组「将领卡」数据修复：拉档前执行
 */
async function repairLineupCharacterCards(poolConn, playerId) {
  let fixed = 0;
  const [orphans] = await poolConn.query(
    `SELECT instance_id FROM player_cards
     WHERE player_id = ?
       AND card_type = 'character'
       AND is_equipped = TRUE
       AND (
         equipped_by NOT IN ('character1', 'character2')
         OR equipped_slot IS NULL
         OR equipped_slot != 'character'
       )`,
    [playerId]
  );
  for (const row of orphans) {
    const [r] = await poolConn.query(
      `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
       WHERE instance_id = ? AND player_id = ?`,
      [row.instance_id, playerId]
    );
    fixed += r.affectedRows || 0;
  }
  for (const by of ['character1', 'character2']) {
    const [dups] = await poolConn.query(
      `SELECT instance_id FROM player_cards
       WHERE player_id = ?
         AND card_type = 'character'
         AND is_equipped = TRUE
         AND equipped_by = ?
         AND equipped_slot = 'character'
       ORDER BY obtained_at DESC, instance_id DESC`,
      [playerId, by]
    );
    if (dups.length <= 1) continue;
    for (let i = 1; i < dups.length; i++) {
      const [r] = await poolConn.query(
        `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
         WHERE instance_id = ? AND player_id = ?`,
        [dups[i].instance_id, playerId]
      );
      fixed += r.affectedRows || 0;
    }
  }
  if (fixed > 0) {
    console.log(`[Players] repairLineupCharacterCards: player=${playerId} fixed=${fixed}`);
    characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
  }
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function equipCard(playerId, body) {
  const { instanceId, equippedBy, equippedSlot } = body;

  if (!instanceId || !equippedBy || !equippedSlot) {
    return { ok: false, status: 400, error: '缺少必要参数' };
  }

  const [cards] = await pool.query(
    'SELECT * FROM player_cards WHERE instance_id = ? AND player_id = ?',
    [instanceId, playerId]
  );
  if (cards.length === 0) {
    return { ok: false, status: 404, error: '卡牌不存在' };
  }

  const lineupExtraService = require('./lineupExtraService');
  if (await lineupExtraService.isInstanceInExtra(playerId, instanceId)) {
    return {
      ok: false,
      status: 400,
      error: '该卡牌已在上阵编组 Extra 中，请先卸下再装备 Main',
    };
  }

  const cardToEquip = cards[0];
  if (
    cardToEquip.card_type === 'troop' &&
    cardToEquip.rarity === 'core' &&
    cardToEquip.max_battle_count != null
  ) {
    const used = Math.max(0, cardToEquip.battle_count ?? 0);
    if (used >= cardToEquip.max_battle_count) {
      return {
        ok: false,
        status: 400,
        error: '核心(金)部队耐久已耗尽，无法再次装备上阵，仅作纪念与下赛季继承',
      };
    }
  }

  if (
    cardToEquip.card_type === 'treasure' &&
    cardToEquip.uses_remaining != null &&
    Number(cardToEquip.uses_remaining) <= 0
  ) {
    return { ok: false, status: 400, error: '宝物使用次数已耗尽，无法装备' };
  }

  if (cardToEquip.card_type === 'character') {
    if (!['character1', 'character2'].includes(equippedBy) || equippedSlot !== 'character') {
      return { ok: false, status: 400, error: '将领卡只能装备在将领1 / 将领2 的将领槽' };
    }
  }

  const [oldCards] = await pool.query(
    `SELECT instance_id, card_type, card_id FROM player_cards
     WHERE player_id = ? AND equipped_by = ? AND equipped_slot = ? AND is_equipped = TRUE`,
    [playerId, equippedBy, equippedSlot]
  );
  if (oldCards.length > 0) {
    const oldIds = oldCards.map((o) => o.instance_id);
    await pool.query(
      `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
       WHERE player_id = ? AND instance_id IN (${oldIds.map(() => '?').join(',')})`,
      [playerId, ...oldIds]
    );
    for (const old of oldCards) {
      if (old.card_type === 'troop') {
        await pool.query(
          `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
             WHERE instance_id = ?`,
          [old.instance_id]
        );
      }
    }
    if (oldCards.some((o) => EFFECT_CARD_TYPES.includes(o.card_type))) {
      await pool.query(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
        [playerId, equippedBy]
      );
      const [remainingEffects] = await pool.query(
        `SELECT card_type, card_id FROM player_cards
           WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
           AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
        [playerId, equippedBy, ...EFFECT_CARD_TYPES]
      );
      for (const ec of remainingEffects) {
        await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
      }
    }
  }

  await pool.query(
    `UPDATE player_cards SET is_equipped = TRUE, equipped_by = ?, equipped_slot = ?
       WHERE instance_id = ? AND player_id = ?`,
    [equippedBy, equippedSlot, instanceId, playerId]
  );

  const needRecalc =
    EFFECT_CARD_TYPES.includes(cardToEquip.card_type) || cardToEquip.card_type === 'troop';
  if (needRecalc) {
    await pool.query(
      `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
         WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
      [playerId, equippedBy]
    );
    const [effectCards] = await pool.query(
      `SELECT card_type, card_id FROM player_cards
         WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
         AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
      [playerId, equippedBy, ...EFFECT_CARD_TYPES]
    );
    for (const ec of effectCards) {
      await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
    }
    const [troopsToCheck] = await pool.query(
      `SELECT pc.instance_id, pc.current_troops, pc.bonus_max_troops, pc.last_troops_lost_at, ct.max_troops AS cfg_max
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.player_id = ? AND pc.equipped_by = ? AND pc.card_type = 'troop' AND pc.is_equipped = TRUE`,
      [playerId, equippedBy]
    );
    for (const t of troopsToCheck) {
      const maxTroops = (t.cfg_max || 0) + (t.bonus_max_troops || 0);
      const hasCap = (t.current_troops || 0) < maxTroops;
      if (hasCap && !t.last_troops_lost_at) {
        await pool.query('UPDATE player_cards SET last_troops_lost_at = NOW() WHERE instance_id = ?', [
          t.instance_id,
        ]);
      } else if (!hasCap && t.last_troops_lost_at) {
        await pool.query('UPDATE player_cards SET last_troops_lost_at = NULL WHERE instance_id = ?', [
          t.instance_id,
        ]);
      }
    }
  }

  console.log(`[Players] 装备卡牌: ${instanceId} → ${equippedBy}/${equippedSlot}`);
  characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
  return { ok: true };
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function unequipCard(playerId, body) {
  const { instanceId } = body;
  if (!instanceId) {
    return { ok: false, status: 400, error: '缺少 instanceId' };
  }

  const [cardRows] = await pool.query(
    'SELECT card_type, card_id, equipped_by FROM player_cards WHERE instance_id = ? AND player_id = ?',
    [instanceId, playerId]
  );
  const cardInfo = cardRows[0];
  const equippedBy = cardInfo?.equipped_by;

  await pool.query(
    `UPDATE player_cards SET is_equipped = FALSE, equipped_by = NULL, equipped_slot = NULL
       WHERE instance_id = ? AND player_id = ?`,
    [instanceId, playerId]
  );

  if (cardInfo && equippedBy) {
    if (cardInfo.card_type === 'troop') {
      await pool.query(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE instance_id = ?`,
        [instanceId]
      );
      const [troopState] = await pool.query(
        `SELECT pc.current_troops, pc.last_troops_lost_at, ct.max_troops AS cfg_max
           FROM player_cards pc JOIN config_troops ct ON pc.card_id = ct.troop_id
           WHERE pc.instance_id = ?`,
        [instanceId]
      );
      if (troopState[0]) {
        const maxTroops = troopState[0].cfg_max || 0;
        const hasCap = (troopState[0].current_troops || 0) < maxTroops;
        if (hasCap && !troopState[0].last_troops_lost_at) {
          await pool.query('UPDATE player_cards SET last_troops_lost_at = NOW() WHERE instance_id = ?', [
            instanceId,
          ]);
        }
      }
    }
    if (EFFECT_CARD_TYPES.includes(cardInfo.card_type)) {
      await pool.query(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
           WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
        [playerId, equippedBy]
      );
      const [remainingEffects] = await pool.query(
        `SELECT card_type, card_id FROM player_cards
           WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
           AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
        [playerId, equippedBy, ...EFFECT_CARD_TYPES]
      );
      for (const ec of remainingEffects) {
        await applyCardBonusToTroops(pool, playerId, equippedBy, ec.card_type, ec.card_id);
      }
    }
  }

  console.log(`[Players] 卸下卡牌: ${instanceId}`);
  characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
  return { ok: true };
}

/** 按槽位重算部队 bonus_*（先清零再叠当前仍有效的称号/成就/宝物） */
async function recalculateTroopBonusesForEquippedBy(poolConn, playerId, equippedBy) {
  if (!playerId || !equippedBy) return;
  await poolConn.query(
    `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
     WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
    [playerId, equippedBy],
  );
  const [remainingEffects] = await poolConn.query(
    `SELECT card_type, card_id, uses_remaining FROM player_cards
     WHERE player_id = ? AND equipped_by = ? AND is_equipped = TRUE
       AND card_type IN (${EFFECT_CARD_TYPES.map(() => '?').join(',')})`,
    [playerId, equippedBy, ...EFFECT_CARD_TYPES],
  );
  for (const ec of remainingEffects) {
    if (ec.card_type === 'treasure' && ec.uses_remaining != null && Number(ec.uses_remaining) <= 0) {
      continue;
    }
    await applyCardBonusToTroops(poolConn, playerId, equippedBy, ec.card_type, ec.card_id);
  }
  const factionMaxBonus = await getPlayerFactionTroopMaxTroopsBonus(poolConn, playerId);
  if (factionMaxBonus > 0) {
    await poolConn.query(
      `UPDATE player_cards SET bonus_max_troops = bonus_max_troops + ?
       WHERE player_id = ? AND equipped_by = ? AND card_type = 'troop' AND is_equipped = TRUE`,
      [factionMaxBonus, playerId, equippedBy],
    );
  }
  const [troops] = await poolConn.query(
    `SELECT pc.instance_id, pc.current_troops, pc.bonus_max_troops, ct.max_troops AS cfg_max
     FROM player_cards pc
     JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.equipped_by = ? AND pc.card_type = 'troop' AND pc.is_equipped = TRUE`,
    [playerId, equippedBy],
  );
  for (const t of troops) {
    const maxTroops = (t.cfg_max || 0) + (t.bonus_max_troops || 0);
    const cur = t.current_troops ?? maxTroops;
    if (cur > maxTroops) {
      await poolConn.query(
        'UPDATE player_cards SET current_troops = ? WHERE instance_id = ? AND player_id = ?',
        [maxTroops, t.instance_id, playerId],
      );
    }
  }
}

/** 未上阵部队：仅叠势力默认兵力加成（称号/宝物仅作用于已装备槽） */
async function applyFactionMaxTroopsToUnequippedTroops(poolConn, playerId) {
  if (!playerId) return;
  const factionMaxBonus = await getPlayerFactionTroopMaxTroopsBonus(poolConn, playerId);
  await poolConn.query(
    `UPDATE player_cards SET bonus_max_troops = ?
     WHERE player_id = ? AND card_type = 'troop'
       AND (is_equipped = FALSE OR is_equipped IS NULL OR equipped_by IS NULL)`,
    [factionMaxBonus, playerId],
  );
}

/** 上阵编组三槽 + 全部驻地行：同步部队 special_effect → bonus_*（与 equip/unequip 同口径） */
async function syncTroopEffectBonusesForPlayer(poolConn, playerId) {
  if (!playerId) return;
  for (const slot of ['player', 'character1', 'character2']) {
    await recalculateTroopBonusesForEquippedBy(poolConn, playerId, slot);
  }
  await applyFactionMaxTroopsToUnequippedTroops(poolConn, playerId);
  const garrisonService = require('./garrisonService');
  await garrisonService.refreshAllGarrisonTroopEffectBonuses(
    (sql, params) => poolConn.query(sql, params),
    playerId,
  );
}

module.exports = {
  EFFECT_CARD_TYPES,
  repairLineupCharacterCards,
  applyCardBonusToTroops,
  getCardSpecialEffect,
  parseSpecialEffect: parseCardTroopSpecialEffect,
  equipCard,
  unequipCard,
  recalculateTroopBonusesForEquippedBy,
  syncTroopEffectBonusesForPlayer,
};
