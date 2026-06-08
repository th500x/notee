/**
 * POST /api/players/:playerId/rewards — 探索/事件选项奖励发放（与 routes/players 对外 JSON 一致）
 */

const { pool } = require('../database/connection');
const { calculateFortune, executeRewards } = require('./rewardService');
const {
  getItemSpecialEffect,
  applyTroopRepairEffect,
  isTroopDurabilityRepairEffect,
  isLegendaryTroopRepairEffect,
  isCoreTroopRepairEffect,
} = require('./troopRepairService');
const playerExploreEventService = require('./playerExploreEventService');
const statisticsDeltaService = require('./statisticsDeltaService');
const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');
const {
  parseExplorePunishBattleLock,
  buildExplorePunishBattleLock,
  isPendingPunishRewardRequest,
  lockedFortuneToInternal,
  fortuneToApiPayload,
} = require('../../shared/utils/explorePunishBattleSessionLock.cjs');

/**
 * @param {string} playerId
 * @param {object} body - req.body
 * @returns {Promise<
 *   | { ok: true; data: object }
 *   | { ok: false; status: number; json: object }
 * >}
 */
async function executeEventRewards(playerId, body) {
  const {
    eventId,
    optionKey,
    playerAttrs,
    general1Attrs,
    general2Attrs,
    minigameResult,
    minigameSilverDelta,
    battleResult,
    battleSilverSpent,
    battleScore,
  } = body || {};

  if (!eventId || !optionKey) {
    return { ok: false, status: 400, json: { success: false, error: '缺少 eventId 或 optionKey' } };
  }

  const [playerRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [playerId]);
  if (playerRows.length === 0) {
    return { ok: false, status: 404, json: { success: false, error: '玩家不存在' } };
  }
  const factionId = playerRows[0].faction_id;

  await playerExploreEventService.maybeResetExploreEventChainsDaily(playerId);

  const [eventRows] = await pool.query(
    'SELECT option_a, option_b, required_items, chain_id, chain_level FROM config_events WHERE event_id = ?',
    [eventId]
  );
  if (eventRows.length === 0) {
    return { ok: false, status: 404, json: { success: false, error: '事件不存在' } };
  }

  const optionRaw = optionKey === 'A' ? eventRows[0].option_a : eventRows[0].option_b;
  const option = typeof optionRaw === 'string' ? JSON.parse(optionRaw) : optionRaw;
  if (!option) {
    return { ok: false, status: 400, json: { success: false, error: '无效的选项' } };
  }

  const skipTroopRepairOnConsume =
    playerExploreEventService.isTroopChainFinaleInsuranceOption(eventId, optionKey);

  if (eventRows[0].required_items) {
    const eventItems = eventRows[0].required_items;
    option.requiredItems = option.requiredItems
      ? `${eventItems};${option.requiredItems}`
      : eventItems;
  }

  const { sessionLock: existingSessionLockRaw } = await playerExploreEventService.getExploreEvents(playerId);
  const existingPunishLock = parseExplorePunishBattleLock(existingSessionLockRaw);

  if (existingPunishLock && !battleResult) {
    if (!isPendingPunishRewardRequest(existingPunishLock, eventId, optionKey, battleResult)) {
      return {
        ok: false,
        status: 409,
        json: {
          success: false,
          error: '探索惩罚战进行中，请先完成战斗',
          code: 'EXPLORE_PUNISH_BATTLE_PENDING',
        },
      };
    }
  } else if (existingPunishLock && battleResult) {
    if (
      existingPunishLock.eventId !== String(eventId) ||
      existingPunishLock.optionKey !== optionKey
    ) {
      return {
        ok: false,
        status: 409,
        json: {
          success: false,
          error: '探索惩罚战进行中，请先完成当前战斗结算',
          code: 'EXPLORE_PUNISH_BATTLE_PENDING',
        },
      };
    }
  }

  // 仅事件链防重复；普通探索可重复。链上一环已完成但未拿下一环信物时可重做（与 filterExploreEventsPool 一致）
  if (eventRows[0].chain_id) {
    const [eventProgress] = await pool.query('SELECT explore_events FROM player_events WHERE player_id = ?', [
      playerId,
    ]);
    if (eventProgress[0]) {
      let events = {};
      try {
        events =
          typeof eventProgress[0].explore_events === 'string'
            ? JSON.parse(eventProgress[0].explore_events)
            : eventProgress[0].explore_events || {};
      } catch {}
      if (events[eventId]?.status === 'completed') {
        const stranded = await playerExploreEventService.isExploreChainStrandedRedo(
          playerId,
          eventRows[0].chain_id,
          eventRows[0].chain_level
        );
        if (!stranded) {
          return {
            ok: false,
            status: 400,
            json: { success: false, error: '事件已完成，不可重复领取奖励' },
          };
        }
      }
    }
  }

  let punishBattleReplay = false;
  let fortune;
  if (existingPunishLock && isPendingPunishRewardRequest(existingPunishLock, eventId, optionKey, battleResult)) {
    fortune = lockedFortuneToInternal(existingPunishLock.lockedFortune);
    punishBattleReplay = true;
  } else if (option.mainFactor === 'minigame' && minigameResult) {
    const dice = minigameResult === 'victory' ? Math.floor(Math.random() * 6) + 1 : 2;
    fortune =
      minigameResult === 'victory'
        ? { fortuneName: dice >= 5 ? '鸿运' : '吉', multiplier: 1.0, dice, finalRate: 100 }
        : { fortuneName: '凶', multiplier: 0.5, dice, finalRate: 40 };
  } else if (battleResult) {
    fortune =
      battleResult === 'victory'
        ? { fortuneName: '凶', multiplier: 0.8, dice: 3, finalRate: 60 }
        : { fortuneName: '大凶', multiplier: 0.5, dice: 1, finalRate: 30 };
  } else {
    fortune = calculateFortune(
      option,
      playerAttrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 },
      general1Attrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 },
      general2Attrs || { luck: 5, courage: 5, combat: 5, command: 5, intelligence: 5, politics: 5, charm: 5 }
    );
  }

  if (punishBattleReplay) {
    return {
      ok: true,
      data: {
        fortune: fortuneToApiPayload(fortune),
        rewards: [],
        bonusRewards: [],
        punishBattlePending: true,
      },
    };
  }

  /** 事件级 `required_items` 中的链钥匙道具（如 item_troop_tag）；见 config_events.required_items */
  const eventRequiredItemsRaw = eventRows[0].required_items
    ? String(eventRows[0].required_items).trim()
    : '';
  const eventChainItemKeys = new Set();
  if (eventRequiredItemsRaw) {
    for (const s of eventRequiredItemsRaw.split(';')) {
      const seg = playerExploreEventService.parseEventCostSegment(s);
      if (!seg) continue;
      if (seg.key && (seg.key.startsWith('item_') || seg.key.includes('_item_'))) {
        eventChainItemKeys.add(seg.key);
      }
    }
  }

  /**
   * 因子判定 → 凶/大凶 → 先进惩罚战：首次 POST /rewards 无 battleResult 时若已扣链钥匙，
   * 战后第二次 POST 会再扣一次 → 400 道具不足。此处暂缓扣事件级链钥匙，待带 battleResult 的结算再扣。
   * （吉/鸿运直接领奖不走战斗，仍在本请求扣。）
   */
  const deferEventChainItemsUntilBattle =
    !battleResult &&
    optionKey === 'A' &&
    !!option.triggerBattle &&
    eventChainItemKeys.size > 0 &&
    (fortune.fortuneName === '凶' || fortune.fortuneName === '大凶');

  const resourceFields = ['silver', 'food', 'reputation', 'contribution', 'morale'];
  let troopRepairResults = [];
  let deferredRepairSegments = [];

  if (option.requiredItems) {
    const costSegments = option.requiredItems
      .split(';')
      .map((s) => playerExploreEventService.parseEventCostSegment(s))
      .filter(Boolean);

    const immediateSegments = [];
    deferredRepairSegments = [];
    for (const seg of costSegments) {
      const { key } = seg;
      if (resourceFields.includes(key)) {
        immediateSegments.push(seg);
        continue;
      }
      if (key.includes('_item_') || key.startsWith('item_')) {
        if (deferEventChainItemsUntilBattle && eventChainItemKeys.has(key)) {
          continue;
        }
        const specialEffect = await getItemSpecialEffect(key);
        if (
          isTroopDurabilityRepairEffect(specialEffect) &&
          playerExploreEventService.shouldDeferTroopRepairAfterBattleRewards(option, battleResult, fortune, optionKey)
        ) {
          deferredRepairSegments.push(seg);
        } else {
          immediateSegments.push(seg);
        }
      } else {
        immediateSegments.push(seg);
      }
    }

    const [prePlayer] = await pool.query(
      'SELECT items, silver, food, reputation, contribution, morale FROM players WHERE player_id = ?',
      [playerId]
    );
    if (!prePlayer[0]) {
      return { ok: false, status: 404, json: { success: false, error: '玩家不存在' } };
    }
    const pr = prePlayer[0];
    let inv = {};
    if (pr.items) {
      inv = typeof pr.items === 'string' ? JSON.parse(pr.items) : pr.items;
    }

    for (const { key, amount } of costSegments) {
      if (resourceFields.includes(key)) {
        const cur = Number(pr[key]) || 0;
        if (cur < amount) {
          return { ok: false, status: 400, json: { success: false, error: `${key}不足` } };
        }
      } else if (key.includes('_item_') || key.startsWith('item_')) {
        const cur = Number(inv[key]) || 0;
        if (cur < amount) {
          return {
            ok: false,
            status: 400,
            json: {
              success: false,
              error: '道具不足',
              detail: { itemId: key, need: amount, have: cur },
            },
          };
        }
        if (!skipTroopRepairOnConsume) {
          const specialEffect = await getItemSpecialEffect(key);
          if (isTroopDurabilityRepairEffect(specialEffect)) {
            if (isLegendaryTroopRepairEffect(specialEffect)) {
              const [chk] = await pool.query(
                `SELECT instance_id FROM player_cards
                 WHERE player_id = ? AND card_type = 'troop' AND rarity = 'legendary' LIMIT 1`,
                [playerId]
              );
              if (chk.length === 0) {
                return {
                  ok: false,
                  status: 400,
                  json: { success: false, error: '暂无传奇部队，无法完成整编旧部' },
                };
              }
            } else if (isCoreTroopRepairEffect(specialEffect)) {
              const [chk] = await pool.query(
                `SELECT instance_id FROM player_cards
                 WHERE player_id = ? AND card_type = 'troop' AND rarity = 'core' LIMIT 1`,
                [playerId]
              );
              if (chk.length === 0) {
                return {
                  ok: false,
                  status: 400,
                  json: { success: false, error: '暂无核心部队，无法完成整编旧部' },
                };
              }
            }
          }
        }
      }
    }

    let immediateResourceSilver = 0;
    let immediateResourceFood = 0;
    let immediateResourceContribution = 0;
    for (const { key, amount } of immediateSegments) {
      if (resourceFields.includes(key)) {
        await pool.query(`UPDATE players SET ${key} = GREATEST(0, ${key} - ?) WHERE player_id = ?`, [
          amount,
          playerId,
        ]);
        const a = Math.max(0, Math.floor(Number(amount) || 0));
        if (key === 'silver') immediateResourceSilver += a;
        if (key === 'food') immediateResourceFood += a;
        if (key === 'contribution') immediateResourceContribution += a;
      } else if (key.includes('_item_') || key.startsWith('item_')) {
        const [itemRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
        let items = {};
        if (itemRows[0]?.items) {
          items = typeof itemRows[0].items === 'string' ? JSON.parse(itemRows[0].items) : itemRows[0].items;
        }
        items[key] = (items[key] || 0) - amount;
        if (items[key] <= 0) delete items[key];
        await pool.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), playerId]);

        if (!skipTroopRepairOnConsume) {
          const specialEffect = await getItemSpecialEffect(key);
          if (isTroopDurabilityRepairEffect(specialEffect)) {
            for (let u = 0; u < amount; u++) {
              try {
                const one = await applyTroopRepairEffect(pool.query.bind(pool), playerId, specialEffect);
                troopRepairResults.push(one);
              } catch (e) {
                if (e.code === 'NO_LEGENDARY_TROOP') {
                  return {
                    ok: false,
                    status: 400,
                    json: { success: false, error: '暂无传奇部队，无法完成整编旧部' },
                  };
                }
                if (e.code === 'NO_CORE_TROOP') {
                  return {
                    ok: false,
                    status: 400,
                    json: { success: false, error: '暂无核心部队，无法完成整编旧部' },
                  };
                }
                throw e;
              }
            }
          }
        }
      }
    }
    await statisticsDeltaService.incrementSpent(playerId, {
      silver: immediateResourceSilver,
      food: immediateResourceFood,
      contribution: immediateResourceContribution,
    });
  }

  let rewardStr = option.rewards || '';

  let bonusRewardStr = '';
  if (fortune.fortuneName === '鸿运' && option.bonusRewards) {
    bonusRewardStr = option.bonusRewards;
  }

  const result = await executeRewards(playerId, rewardStr, fortune.multiplier, factionId);

  let bonusResult = null;
  if (bonusRewardStr) {
    bonusResult = await executeRewards(playerId, bonusRewardStr, 1.0, factionId);
  }

  if (deferredRepairSegments.length && battleResult === 'victory') {
    let deferredResourceSilver = 0;
    let deferredResourceFood = 0;
    let deferredResourceContribution = 0;
    for (const { key, amount } of deferredRepairSegments) {
      if (resourceFields.includes(key)) {
        await pool.query(`UPDATE players SET ${key} = GREATEST(0, ${key} - ?) WHERE player_id = ?`, [
          amount,
          playerId,
        ]);
        const a = Math.max(0, Math.floor(Number(amount) || 0));
        if (key === 'silver') deferredResourceSilver += a;
        if (key === 'food') deferredResourceFood += a;
        if (key === 'contribution') deferredResourceContribution += a;
      } else if (key.includes('_item_') || key.startsWith('item_')) {
        const [itemRows] = await pool.query('SELECT items FROM players WHERE player_id = ?', [playerId]);
        let items = {};
        if (itemRows[0]?.items) {
          items = typeof itemRows[0].items === 'string' ? JSON.parse(itemRows[0].items) : itemRows[0].items;
        }
        items[key] = (items[key] || 0) - amount;
        if (items[key] <= 0) delete items[key];
        await pool.query('UPDATE players SET items = ? WHERE player_id = ?', [JSON.stringify(items), playerId]);

        if (!skipTroopRepairOnConsume) {
          const specialEffect = await getItemSpecialEffect(key);
          if (isTroopDurabilityRepairEffect(specialEffect)) {
            for (let u = 0; u < amount; u++) {
              try {
                const one = await applyTroopRepairEffect(pool.query.bind(pool), playerId, specialEffect);
                troopRepairResults.push(one);
              } catch (e) {
                if (e.code === 'NO_LEGENDARY_TROOP') {
                  return {
                    ok: false,
                    status: 400,
                    json: { success: false, error: '暂无传奇部队，无法完成整编旧部' },
                  };
                }
                if (e.code === 'NO_CORE_TROOP') {
                  return {
                    ok: false,
                    status: 400,
                    json: { success: false, error: '暂无核心部队，无法完成整编旧部' },
                  };
                }
                throw e;
              }
            }
          }
        }
      }
    }
    await statisticsDeltaService.incrementSpent(playerId, {
      silver: deferredResourceSilver,
      food: deferredResourceFood,
      contribution: deferredResourceContribution,
    });
  }

  if (battleSilverSpent && battleSilverSpent > 0) {
    const bs = Math.max(0, Math.floor(Number(battleSilverSpent) || 0));
    await pool.query('UPDATE players SET silver = GREATEST(0, silver - ?) WHERE player_id = ?', [
      bs,
      playerId,
    ]);
    await statisticsDeltaService.incrementSpent(playerId, { silver: bs });
  }

  if (minigameSilverDelta && minigameSilverDelta !== 0) {
    if (minigameSilverDelta > 0) {
      await pool.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [
        minigameSilverDelta,
        playerId,
      ]);
      await statisticsDeltaService.recordEarned(playerId, {
        silver: Math.max(0, Math.floor(Number(minigameSilverDelta) || 0)),
      });
    } else {
      await pool.query('UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?', [
        minigameSilverDelta,
        playerId,
      ]);
      const spent = Math.max(0, Math.floor(-Number(minigameSilverDelta) || 0));
      if (spent > 0) await statisticsDeltaService.incrementSpent(playerId, { silver: spent });
    }
    console.log(`[PlayerEventRewards] 迷你游戏筹码结算: playerId=${playerId}, delta=${minigameSilverDelta}`);
  }

  // 探索事件战：客户端在战报 POST /api/battles 成功后勿再传 battleScore，否则会与 battleService.applyBattleScore 重复累加（场均虚高）
  if (battleScore && battleScore > 0) {
    console.log(`[PlayerEventRewards] 更新战斗积分: playerId=${playerId}, battleScore=${battleScore}`);
    await pool.query('UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?', [
      battleScore,
      playerId,
    ]);
  } else {
    console.log(
      `[PlayerEventRewards] 战斗积分未更新: battleScore=${battleScore}, battleResult=${battleResult}`
    );
  }

  // 选项 A + triggerBattle + 凶/大凶：先无 battleResult、战后再带 battleResult；第一次勿写入完成态，否则战后第二次会 400
  const pendingPunishBattle =
    optionKey === 'A' &&
    option.triggerBattle &&
    !battleResult &&
    (fortune.fortuneName === '凶' || fortune.fortuneName === '大凶');
  if (eventRows[0].chain_id && !pendingPunishBattle) {
    await playerExploreEventService.recordExploreChainEventCompleted(
      playerId,
      eventId,
      eventRows[0].chain_id,
      eventRows[0].chain_level
    );
  }

  const shouldCountEventCompletion = !pendingPunishBattle;
  if (shouldCountEventCompletion) {
    await pool.query(
      'UPDATE player_statistics SET total_events_completed = total_events_completed + 1 WHERE player_id = ?',
      [playerId],
    );
  }

  const milestoneUnlock = await runPlayerMilestoneCheckSafe(playerId, 'event_complete');

  if (pendingPunishBattle) {
    await playerExploreEventService.setExploreSessionLock(
      playerId,
      buildExplorePunishBattleLock({ eventId, optionKey, lockedFortune: fortune }),
    );
  } else if (battleResult) {
    await playerExploreEventService.setExploreSessionLock(playerId, null);
  }

  return {
    ok: true,
    data: {
      fortune: fortuneToApiPayload(fortune),
      rewards: result.details,
      bonusRewards: bonusResult ? bonusResult.details : [],
      ...(milestoneUnlock
        ? {
            milestoneUnlock: {
              titles: milestoneUnlock.titles?.newlyGranted || [],
              achievements: milestoneUnlock.achievements?.newlyGranted || [],
            },
          }
        : {}),
      ...(troopRepairResults.length ? { troopRepair: troopRepairResults } : {}),
    },
  };
}

module.exports = {
  executeEventRewards,
};
