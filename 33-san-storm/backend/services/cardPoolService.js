/**
 * 卡池抽取服务（临时模拟方案）
 * 
 * @description 模拟满发展度3000的卡池抽取，未来可迁移到正式势力抽卡系统
 * @module backend/services/cardPoolService
 */

const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');
const { runPlayerMilestoneCheckSafe } = require('./milestoneHookHelper');
const factionPolicyService = require('./factionPolicyService');
const factionReserveService = require('./factionReserveService');
const playerItemsService = require('./playerItemsService');
const {
  parseEchoSlots,
  appendPoolEchoSlot,
  buildEchoState,
  canAddPoolEcho,
  SEASON_BADGE_ITEM_ID,
} = require('../../shared/utils/characterEchoCombat.cjs');

// ── 概率配置（模拟满发展度3000）─────────────────────────────

const DRAW_PROBABILITIES = {
  legendary: 0.05,
  epic:      0.10,
  rare:      0.30,
  common:    0.55,
};

const {
  HALF_DAY_DRAW_LIMIT,
  HALF_DAY_TOTAL_SLOTS,
  DRAW_CHANNEL_SILVER,
  DRAW_CHANNEL_BADGE,
  BADGE_BATCH_ITEM_ID,
  BADGE_BATCH_COST,
  DRAW_COST_TIERS,
  BATCH_DRAW_QUOTA_OPS,
  BATCH_DRAW_BONUS_OPS,
  BATCH_DRAW_TOTAL_OPS,
  getBatchDrawTotalCost,
  canChannelBatch,
  normalizeDrawChannel,
} = require('../../shared/utils/cardPoolDrawEconomy.cjs');
const {
  computeLegendaryDrawProbabilities,
  computePityAfterLegendaryDelivered,
} = require('../../shared/utils/factionLegendaryReserve.cjs');
const {
  listItemPoolPrizesForStatus,
  rollItemPrize,
  grantItemPrize,
} = require('./itemCardPoolPrizes');

// ── 抽取限制 ─────────────────────────────────────────────────

const DAILY_DRAW_LIMIT = HALF_DAY_DRAW_LIMIT;
const PITY_THRESHOLD = 50;
const EXPIRES_DAYS = 14;

/** 读取用：合法计数 ≥0；可超过阈值（储备为 0 时保底继续累加 51、52…） */
function normalizePityCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

const DAILY_RARITY_CAP = { legendary: 1, epic: 2 };

// ── 补偿常量 ─────────────────────────────────────────────────

const CHARACTER_DUPLICATE_COMPENSATION = { common: 20, rare: 40, epic: 60, legendary: 80 };
const {
  CHARACTER_LIMIT_BY_RARITY,
  TROOP_LIMIT_BY_RARITY,
} = require('../../shared/utils/cardPoolRarityLimits.cjs');
const { getMaxBattleCount } = require('../../shared/utils/troopMaxBattleCount.cjs');
/** 无可抽候选时仍返回银两补偿（与返回体 compensation 一致，须实际入账） */
const NO_CARD_AVAILABLE_SILVER = 20;
/** 部队按稀有度实例数达上限时的粮草补偿（与 22-1 §6.1 一致） */
const TROOP_RARITY_LIMIT_COMPENSATION = { common: 100, rare: 200, epic: 300, legendary: 400 };
/** 与 22-1-TROOP_SYSTEM §4.2、troopMaxBattleCount 一致（发卡时盖章） */

// ── 工具函数 ─────────────────────────────────────────────────

/**
 * 按固定概率表抽取稀有度（与 config 里该稀有度有多少张卡无关）。
 * 先定稀有度，再在 SQL 中对该稀有度候选行 ORDER BY RAND() LIMIT 1 均匀抽一张。
 * P(抽到某张具体卡 | 已定为该稀有度) = 1 / 该稀有度候选行数，但 P(定为该稀有度) 不变。
 */
function rollRarity(legendaryQuota = 0) {
  const probs = computeLegendaryDrawProbabilities(legendaryQuota);
  const rand = Math.random();
  let cumulative = 0;
  for (const [rarity, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (rand < cumulative) return rarity;
  }
  return 'common';
}

async function applyPoolCompensation(connection, playerId, factionId, compensation) {
  if (!compensation || compensation.amount == null) return;
  const fid = String(factionId || '').trim();
  const t = String(compensation.type || '').toLowerCase();
  const amount = Math.max(0, Math.floor(Number(compensation.amount) || 0));
  if (amount === 0) return;
  if (t === 'silver') {
    if (fid) {
      await factionReserveService.deductPoolOnConnection(connection, fid, { silver: amount }, {
        allowNegative: true,
        ledgerCategory: factionReserveService.CATEGORY.CARD_POOL_COMPENSATION,
      });
    }
    await connection.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [amount, playerId]);
  } else if (t === 'food') {
    if (fid) {
      await factionReserveService.deductPoolOnConnection(connection, fid, { food: amount }, {
        allowNegative: true,
        ledgerCategory: factionReserveService.CATEGORY.CARD_POOL_COMPENSATION,
      });
    }
    await connection.query('UPDATE players SET food = food + ? WHERE player_id = ?', [amount, playerId]);
  }
}

function parseFactionId(factionId) {
  const parts = String(factionId || '').split('_');
  const m = String(factionId || '').match(/_faction_(\d+)/);
  let factionNumber = '0';
  if (m) {
    const nz = m[1].replace(/^0+/, '');
    factionNumber = nz ? nz.charAt(0) : '0';
  }
  return {
    season: parts.slice(0, 2).join('_'),
    factionNumber,
  };
}

/** 将领全服唯一：已持有的 character_id 不可再进入候选池 */
async function getOwnedCharacterCardIds(connection, playerId) {
  const [rows] = await connection.query(
    "SELECT card_id FROM player_cards WHERE player_id = ? AND card_type = 'character'",
    [playerId]
  );
  return rows.map((r) => r.card_id);
}

/**
 * 将领稀有度上限计数范围（与 draw 的 poolSeason Tab + 势力映射一致）。
 * - san_1：本势力段 + 通用 0 段
 * - san_0：本势力 `san0Band` 段（汉室 2 / 黄巾 1 / 其余 0 …，见 factionPolicyDefaults）
 */
function buildCharacterRarityLimitScope(poolSeason, { factionNumber, san0Band } = {}) {
  if (poolSeason === 'san_0') {
    const band = String(san0Band ?? '').trim();
    if (!band) {
      return { whereExtra: " AND card_id LIKE 'san_0_char_%'", params: [] };
    }
    return { whereExtra: ' AND card_id LIKE ?', params: [`san_0_char_${band}%`] };
  }
  if (poolSeason === 'san_1') {
    const fn = String(factionNumber ?? '0');
    return {
      whereExtra: ' AND (card_id LIKE ? OR card_id LIKE ?)',
      params: [`san_1_char_${fn}%`, 'san_1_char_0%'],
    };
  }
  return { whereExtra: '', params: [] };
}

function buildTroopRarityLimitScope(poolSeason, { factionNumber, san0Band } = {}) {
  if (poolSeason === 'san_0') {
    const band = String(san0Band ?? '').trim();
    if (!band) {
      return { whereExtra: " AND card_id LIKE 'san_0_troop_%'", params: [] };
    }
    return { whereExtra: ' AND card_id LIKE ?', params: [`san_0_troop_${band}%`] };
  }
  if (poolSeason === 'san_1') {
    const fn = String(factionNumber ?? '0');
    return {
      whereExtra: ' AND (card_id LIKE ? OR card_id LIKE ?)',
      params: [`san_1_troop_${fn}%`, 'san_1_troop_0%'],
    };
  }
  return { whereExtra: '', params: [] };
}

function getCharacterCompensationSilver(rarity) {
  const normRarity = String(rarity ?? 'common').toLowerCase();
  return CHARACTER_DUPLICATE_COMPENSATION[normRarity] ?? 20;
}

function getTroopRarityLimitCompensation(rarity) {
  const normRarity = String(rarity ?? 'common').toLowerCase();
  return TROOP_RARITY_LIMIT_COMPENSATION[normRarity] ?? 100;
}

async function countCharacterCardsByRarityInPoolScope(
  connection, playerId, rarity, poolSeason, scopeOpts,
) {
  const { whereExtra, params } = buildCharacterRarityLimitScope(poolSeason, scopeOpts);
  const [cntRows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM player_cards
     WHERE player_id = ? AND card_type = 'character' AND rarity = ?${whereExtra}`,
    [playerId, rarity, ...params]
  );
  return Number(cntRows[0]?.cnt || 0);
}

async function countTroopCardsByRarityInPoolScope(
  connection, playerId, rarity, poolSeason, scopeOpts,
) {
  const { whereExtra, params } = buildTroopRarityLimitScope(poolSeason, scopeOpts);
  const [cntRows] = await connection.query(
    `SELECT COUNT(*) AS cnt FROM player_cards
     WHERE player_id = ? AND card_type = 'troop' AND rarity = ?${whereExtra}`,
    [playerId, rarity, ...params]
  );
  return Number(cntRows[0]?.cnt || 0);
}

// ── 核心：抽取卡牌 ───────────────────────────────────────────

/**
 * 校验并归一化抽取方式：仅接受两条独立半天通道（银两十连 / 真三徽章抽），
 * 不再支持单抽（含旧 'single'）。
 * @param {string} drawMode
 * @returns {'batch'|'badge_batch'}
 */
function normalizeDrawModeStrict(drawMode) {
  const dm = String(drawMode || '').trim().toLowerCase();
  if (dm === 'batch') return 'batch';
  if (dm === 'badge_batch') return 'badge_batch';
  throw new Error('无效的抽取方式：仅支持银两十连（batch）或真三徽章抽（badge_batch），单抽已下线');
}

/** 抽取方式 → 半天窗通道 */
function channelForDrawMode(drawMode) {
  return drawMode === 'badge_batch' ? DRAW_CHANNEL_BADGE : DRAW_CHANNEL_SILVER;
}

/** 半天窗通道中文标签（报错用） */
function channelLabel(channel) {
  return channel === DRAW_CHANNEL_BADGE ? '真三徽章抽' : '银两十连';
}

/**
 * 读取玩家 `players.items`（JSON 列）为对象；兼容字符串/对象两种驱动返回形态。
 */
function parsePlayerItemsColumn(rawItems) {
  if (!rawItems) return {};
  return typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems;
}

/**
 * 校验并扣减真三徽章（`item_badge_storm` ×`BADGE_BATCH_COST`），返回扣减后的 items 对象与剩余数量。
 * 调用方需在同一事务内已对 players 行 `FOR UPDATE`。
 */
function deductBadgeBatchCost(rawItems) {
  const items = parsePlayerItemsColumn(rawItems);
  const current = Math.max(0, Math.floor(Number(items[BADGE_BATCH_ITEM_ID]) || 0));
  if (current < BADGE_BATCH_COST) {
    throw new Error(`真三徽章不足，需要${BADGE_BATCH_COST}个，当前${current}个`);
  }
  const remaining = current - BADGE_BATCH_COST;
  if (remaining <= 0) {
    delete items[BADGE_BATCH_ITEM_ID];
  } else {
    items[BADGE_BATCH_ITEM_ID] = remaining;
  }
  return { items, remaining: Math.max(0, remaining) };
}

/** 抽取后本半天窗双通道剩余情况（供响应体与 getPoolStatus 共用口径） */
async function computeHalfDaySlotsInfo(connection, playerId, poolType) {
  const silverUsed = await getHalfDayChannelQuota(connection, playerId, poolType, DRAW_CHANNEL_SILVER);
  const badgeUsed = await getHalfDayChannelQuota(connection, playerId, poolType, DRAW_CHANNEL_BADGE);
  const canSilverBatch = canChannelBatch(silverUsed);
  const canBadgeBatch = canChannelBatch(badgeUsed);
  return {
    canSilverBatch,
    canBadgeBatch,
    remainingSlots: (canSilverBatch ? 1 : 0) + (canBadgeBatch ? 1 : 0),
  };
}

/**
 * 道具卡池抽取（独立半天配额；不走将领/部队保底与传奇储备）
 * @param {string} playerId
 * @param {{ drawMode?: 'batch'|'badge_batch' }} [options]
 */
async function drawFromItemPool(playerId, options = {}) {
  const drawMode = normalizeDrawModeStrict(options.drawMode);
  const channel = channelForDrawMode(drawMode);
  const poolType = 'item';
  const label = '道具';
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [playerRows] = await connection.query(
      'SELECT player_id, silver, faction_id, items FROM players WHERE player_id = ? FOR UPDATE',
      [playerId],
    );
    if (playerRows.length === 0) throw new Error('玩家不存在');
    const player = playerRows[0];

    const channelUsed = await getHalfDayChannelQuota(connection, playerId, poolType, channel);
    if (!canChannelBatch(channelUsed)) {
      throw new Error(`本半天窗${label}卡池${channelLabel(channel)}额度已用完（每半天窗仅 1 次）`);
    }

    const totalDrawOperations = BATCH_DRAW_TOTAL_OPS;
    let drawCost = 0;
    let pendingItemsUpdate = null;
    let badgeRemaining = null;
    if (channel === DRAW_CHANNEL_BADGE) {
      const { items, remaining } = deductBadgeBatchCost(player.items);
      pendingItemsUpdate = items;
      badgeRemaining = remaining;
    } else {
      drawCost = getBatchDrawTotalCost();
      if (player.silver < drawCost) {
        throw new Error(`银两不足，需要${drawCost}银两，当前${player.silver}银两`);
      }
    }

    if (channel === DRAW_CHANNEL_BADGE) {
      await connection.query(
        'UPDATE players SET items = ? WHERE player_id = ?',
        [JSON.stringify(pendingItemsUpdate), playerId],
      );
    } else {
      await connection.query(
        'UPDATE players SET silver = silver - ? WHERE player_id = ?',
        [drawCost, playerId],
      );
      if (player.faction_id) {
        await factionReserveService.ensurePoolRow(connection, player.faction_id);
        await factionReserveService.creditPoolOnConnection(connection, player.faction_id, { silver: drawCost }, {
          ledgerCategory: factionReserveService.CATEGORY.CARD_POOL_DRAW,
        });
      }
    }

    const results = [];
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    let foodEarned = 0;

    for (let opIdx = 0; opIdx < totalDrawOperations; opIdx += 1) {
      const isBonusOp = opIdx >= BATCH_DRAW_QUOTA_OPS;
      const quotaWeight = isBonusOp ? 0 : 1;
      const drawnAtExpr = `DATE_ADD(NOW(), INTERVAL ${opIdx} SECOND)`;

      const prize = rollItemPrize();
      const granted = await grantItemPrize(connection, playerId, prize);
      if (granted.kind === 'food') {
        foodEarned += Math.max(0, Math.floor(Number(granted.amount) || 0));
      }

      await connection.query(
        `INSERT INTO temp_card_pool_draws
         (player_id, pool_type, rarity, card_id, compensated, echo_choice_status,
          pity_count, drawn_at, expires_at, quota_weight, draw_channel)
         VALUES (?, ?, ?, ?, 0, 'none', 0, ${drawnAtExpr}, ?, ?, ?)`,
        [
          playerId,
          poolType,
          'common',
          granted.prizeId || prize.id,
          expiresAt,
          quotaWeight,
          channel,
        ],
      );

      results.push({
        ...granted,
        pityCount: 0,
      });
    }

    const slotsInfo = await computeHalfDaySlotsInfo(connection, playerId, poolType);

    await connection.commit();

    if (foodEarned > 0) {
      await statisticsDeltaService.recordEarned(playerId, { food: foodEarned });
    }
    if (drawCost > 0) {
      await statisticsDeltaService.incrementSpent(playerId, { silver: drawCost });
    }

    const [updatedPlayer] = await connection.query(
      'SELECT silver FROM players WHERE player_id = ?',
      [playerId],
    );

    return {
      success: true,
      poolType,
      drawMode,
      poolSeason: null,
      cost: drawCost,
      ...(channel === DRAW_CHANNEL_BADGE
        ? {
            costItemId: BADGE_BATCH_ITEM_ID,
            costItemQuantity: BADGE_BATCH_COST,
            stormBadgeRemaining: badgeRemaining,
          }
        : {}),
      remainingSilver: updatedPlayer[0].silver,
      remainingDraws: slotsInfo.remainingSlots,
      remainingSlots: slotsInfo.remainingSlots,
      slotLimit: HALF_DAY_TOTAL_SLOTS,
      canSilverBatch: slotsInfo.canSilverBatch,
      canBadgeBatch: slotsInfo.canBadgeBatch,
      nextDrawCost: null,
      cards: results,
      pityCount: 0,
      batchDrawOperations: totalDrawOperations,
      batchBonusOperations: BATCH_DRAW_BONUS_OPS,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 执行卡池抽取
 *
 * @param {string} playerId - 玩家ID
 * @param {'troop'|'character'|'item'} poolType - 卡池类型
 * @param {{ poolSeason?: 'san_1'|'san_0'|null, drawMode?: 'batch'|'badge_batch' }} [options]
 * @returns {Promise<Object>} 抽取结果
 */
async function drawFromPool(playerId, poolType, options = {}) {
  if (poolType === 'item') {
    return drawFromItemPool(playerId, options);
  }
  const poolSeason = options.poolSeason ?? null;
  const drawMode = normalizeDrawModeStrict(options.drawMode);
  const channel = channelForDrawMode(drawMode);
  if (poolSeason != null && poolSeason !== 'san_0' && poolSeason !== 'san_1') {
    throw new Error('无效的卡池赛季');
  }
  if (poolSeason === 'san_0' && poolType !== 'character') {
    throw new Error('楚汉争霸池仅支持将领抽取');
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 获取玩家信息
    const [playerRows] = await connection.query(
      'SELECT player_id, silver, faction_id, items FROM players WHERE player_id = ? FOR UPDATE',
      [playerId]
    );
    if (playerRows.length === 0) throw new Error('玩家不存在');
    const player = playerRows[0];

    if (poolType === 'character') {
      const pendingEchoId = await getPendingEchoChoiceOnConnection(connection, playerId);
      if (pendingEchoId) {
        throw new Error('请先完成待处理的重复将领三选一');
      }
    }

    const label = poolType === 'troop' ? '部队' : '将领';

    const channelUsed = await getHalfDayChannelQuota(connection, playerId, poolType, channel);
    if (!canChannelBatch(channelUsed)) {
      throw new Error(`本半天窗${label}卡池${channelLabel(channel)}额度已用完（每半天窗仅 1 次）`);
    }

    const totalDrawOperations = BATCH_DRAW_TOTAL_OPS;
    let drawCost = 0;
    let pendingItemsUpdate = null;
    let badgeRemaining = null;
    if (channel === DRAW_CHANNEL_BADGE) {
      const { items, remaining } = deductBadgeBatchCost(player.items);
      pendingItemsUpdate = items;
      badgeRemaining = remaining;
    } else {
      drawCost = getBatchDrawTotalCost();
      if (player.silver < drawCost) {
        throw new Error(`银两不足，需要${drawCost}银两，当前${player.silver}银两`);
      }
    }

    // 4. 获取今日已获得的稀有度统计
    const todayRarityCounts = await getTodayRarityCounts(connection, playerId, poolType);

    // 5. 获取保底计数（最新一条记录的 pity_count）
    const pityCount = await getPityCount(connection, playerId, poolType);

    // 5b. 招贤纳士政策（11-3 §3.3）：政策为「approved + enabled」时追加 san_0 段映射（楚汉时代池）
    //   - 仅在本次抽取入口读一次，避免每张卡都跑一次 SQL
    //   - `san_0_char_*` 与默认 `likeNeutral`（`san_1_char_0xxx` 本赛季通用 50 张）前缀不同，
    //     两个池子互不重叠：招贤 ON 后真的会多出对应势力的楚汉时代段（扶苏/项羽/刘邦…）
    const recruitEff = await factionPolicyService.getEffectiveRecruit(player.faction_id);
    if (poolSeason === 'san_0') {
      if (!recruitEff?.enabled || !recruitEff.san0Band) {
        throw new Error('招贤纳士未开启，无法从楚汉争霸池抽取');
      }
    }

    // 6. 扣除代价：银两通道扣银两并划入势力储备；徽章通道扣 item_badge_storm（不入账银两、不划势力储备）
    if (channel === DRAW_CHANNEL_BADGE) {
      await connection.query(
        'UPDATE players SET items = ? WHERE player_id = ?',
        [JSON.stringify(pendingItemsUpdate), playerId],
      );
    } else {
      await connection.query(
        'UPDATE players SET silver = silver - ? WHERE player_id = ?',
        [drawCost, playerId]
      );
      if (player.faction_id) {
        await factionReserveService.ensurePoolRow(connection, player.faction_id);
        await factionReserveService.creditPoolOnConnection(connection, player.faction_id, { silver: drawCost }, {
          ledgerCategory: factionReserveService.CATEGORY.CARD_POOL_DRAW,
        });
      }
    }

    // 7. 锁定势力储备并读取传奇额度
    let legendaryQuota = 0;
    if (player.faction_id) {
      const poolBal = await factionReserveService.getPoolBalance(connection, player.faction_id, { forUpdate: true });
      legendaryQuota = poolType === 'troop'
        ? (poolBal?.troopLegendary ?? 0)
        : (poolBal?.characterLegendary ?? 0);
    }

    // 8. 执行抽取（12 次操作，其中后 2 次为赠送；银两十连与徽章抽等价对待）
    const cardsPerDraw = poolType === 'troop' ? 2 : 1;
    const results = [];
    let runningPity = pityCount;
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    let operationsCompleted = 0;

    for (let opIdx = 0; opIdx < totalDrawOperations; opIdx += 1) {
      const isBonusOp = opIdx >= BATCH_DRAW_QUOTA_OPS;
      const quotaWeightFirstCard = isBonusOp ? 0 : 1;
      const drawnAtExpr = `DATE_ADD(NOW(), INTERVAL ${opIdx} SECOND)`;

      for (let cardIdx = 0; cardIdx < cardsPerDraw; cardIdx += 1) {
        const quotaWeight = cardIdx === 0 ? quotaWeightFirstCard : 0;
        const result = await drawSingleCard(
          connection, playerId, poolType, player.faction_id,
          runningPity, todayRarityCounts, results,
          recruitEff,
          poolSeason,
          legendaryQuota,
        );

        const legendaryDelivered = result.rarity === 'legendary' && !result.compensated;
        if (legendaryDelivered && player.faction_id) {
          const kind = poolType === 'troop' ? 'troop' : 'character';
          const ledgerCat = poolType === 'troop'
            ? factionReserveService.CATEGORY.CARD_POOL_LEGENDARY_TROOP
            : factionReserveService.CATEGORY.CARD_POOL_LEGENDARY_CHARACTER;
          await factionReserveService.deductLegendaryQuotaOnConnection(connection, player.faction_id, kind, {
            ledgerCategory: ledgerCat,
          });
          legendaryQuota = Math.max(0, legendaryQuota - 1);
        }

        const pityBefore = runningPity;
        if (legendaryDelivered) {
          runningPity = computePityAfterLegendaryDelivered(pityBefore, PITY_THRESHOLD);
        } else {
          runningPity += 1;
        }
        result.pityCount = runningPity;

        const echoStatus = result.echoChoiceRequired ? 'pending' : 'none';
        const echoPayload = result.echoChoicePayload
          ? JSON.stringify(result.echoChoicePayload)
          : null;
        const [insertResult] = await connection.query(
          `INSERT INTO temp_card_pool_draws
           (player_id, pool_type, rarity, card_id, compensated, echo_choice_status, echo_choice_payload,
            pity_count, drawn_at, expires_at, quota_weight, draw_channel)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${drawnAtExpr}, ?, ?, ?)`,
          [
            playerId,
            poolType,
            result.rarity,
            result.cardId,
            result.compensated ? 1 : 0,
            echoStatus,
            echoPayload,
            runningPity,
            expiresAt,
            quotaWeight,
            channel,
          ],
        );
        if (result.echoChoiceRequired) {
          result.pendingEchoDrawId = insertResult.insertId;
        }

        results.push(result);

        if (!result.compensated) {
          todayRarityCounts[result.rarity] = (todayRarityCounts[result.rarity] || 0) + 1;
        }
        // 残影三选一不中断批量：银两十连 / 徽章抽均跑满 12 次操作，与旧十连行为一致
      }

      operationsCompleted += 1;
    }

    const quotaUsed = Math.min(operationsCompleted, BATCH_DRAW_QUOTA_OPS);
    const paddingNeeded = BATCH_DRAW_QUOTA_OPS - quotaUsed;
    await insertBatchQuotaPadding(
      connection, playerId, poolType, paddingNeeded, runningPity, expiresAt, channel,
    );

    const slotsInfo = await computeHalfDaySlotsInfo(connection, playerId, poolType);

    await connection.commit();

    let compensationSilver = 0;
    let compensationFood = 0;
    for (const r of results) {
      if (!r.compensated || !r.compensation || r.compensation.amount == null) continue;
      const t = String(r.compensation.type || '').toLowerCase();
      const a = Math.max(0, Math.floor(Number(r.compensation.amount) || 0));
      if (t === 'silver') compensationSilver += a;
      else if (t === 'food') compensationFood += a;
    }
    if (compensationSilver > 0 || compensationFood > 0) {
      await statisticsDeltaService.recordEarned(playerId, {
        ...(compensationSilver > 0 ? { silver: compensationSilver } : {}),
        ...(compensationFood > 0 ? { food: compensationFood } : {}),
      });
    }

    if (drawCost > 0) {
      await statisticsDeltaService.incrementSpent(playerId, { silver: drawCost });
    }

    if (poolType === 'character' && results.some((r) => !r.compensated && r.cardId)) {
      runPlayerMilestoneCheckSafe(playerId, 'character_card_granted').catch(() => {});
    }

    // 查询更新后的银两
    const [updatedPlayer] = await connection.query(
      'SELECT silver FROM players WHERE player_id = ?', [playerId]
    );

    const cardsPublic = results.map(({ pityForced, pityBlockedByQuota, pityCount: _pc, echoChoicePayload: _dp, ...c }) => c);
    const echoQueue = results
      .filter((r) => r.echoChoiceRequired && r.pendingEchoDrawId)
      .map((r) => ({
        pendingEchoDrawId: r.pendingEchoDrawId,
        cardId: r.cardId,
        cardName: r.cardName,
        rarity: r.rarity,
        echoState: r.echoState,
      }));
    const pendingCard = echoQueue[0] ?? null;

    return {
      success: true,
      poolType,
      drawMode,
      poolSeason: poolSeason || (poolType === 'character' ? 'san_1' : null),
      cost: drawCost,
      ...(channel === DRAW_CHANNEL_BADGE
        ? {
            costItemId: BADGE_BATCH_ITEM_ID,
            costItemQuantity: BADGE_BATCH_COST,
            stormBadgeRemaining: badgeRemaining,
          }
        : {}),
      remainingSilver: updatedPlayer[0].silver,
      remainingDraws: slotsInfo.remainingSlots,
      remainingSlots: slotsInfo.remainingSlots,
      slotLimit: HALF_DAY_TOTAL_SLOTS,
      canSilverBatch: slotsInfo.canSilverBatch,
      canBadgeBatch: slotsInfo.canBadgeBatch,
      nextDrawCost: null,
      cards: cardsPublic,
      pityCount: runningPity,
      ...(echoQueue.length > 0 ? { echoQueue } : {}),
      batchDrawOperations: operationsCompleted,
      batchBonusOperations: BATCH_DRAW_BONUS_OPS,
      ...(pendingCard
        ? {
            echoChoiceRequired: true,
            pendingEchoDrawId: pendingCard.pendingEchoDrawId,
            echoState: pendingCard.echoState,
          }
        : {}),
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 构建抽卡候选 ID 的 LIKE 条件（主赛季 / 楚汉 Tab / 默认合并）。
 *
 * @returns {{ whereFragment: string, likeParams: string[] }}
 */
function buildDrawPoolLikeClause({
  season, idPrefix, factionNumber, idField, recruitEff, poolSeason,
}) {
  const likeFaction = `${season}_${idPrefix}_${factionNumber}%`;
  const likeNeutral = `${season}_${idPrefix}_0%`;
  const recruitLike =
    recruitEff && recruitEff.enabled && recruitEff.san0Band
      ? `san_0_${idPrefix}_${recruitEff.san0Band}%`
      : null;

  if (poolSeason === 'san_0') {
    if (!recruitLike) {
      throw new Error('招贤纳士未开启，无法从楚汉争霸池抽取');
    }
    return {
      whereFragment: `${idField} LIKE ?`,
      likeParams: [recruitLike],
    };
  }

  if (poolSeason === 'san_1') {
    return {
      whereFragment: `(${idField} LIKE ? OR ${idField} LIKE ?)`,
      likeParams: [likeFaction, likeNeutral],
    };
  }

  const extra = recruitLike ? ` OR ${idField} LIKE ?` : '';
  return {
    whereFragment: `(${idField} LIKE ? OR ${idField} LIKE ?${extra})`,
    likeParams: recruitLike ? [likeFaction, likeNeutral, recruitLike] : [likeFaction, likeNeutral],
  };
}

/**
 * 抽取单张卡牌（不写入记录，由调用方统一写入）
 */
async function drawSingleCard(
  connection, playerId, poolType, factionId, currentPity, todayRarityCounts, previousResults,
  recruitEff = null, poolSeason = null, legendaryQuota = 0,
) {
  const { season, factionNumber } = parseFactionId(factionId);
  const limitScopeOpts = {
    factionNumber,
    san0Band: recruitEff?.san0Band ?? null,
  };

  const quota = Math.max(0, Math.floor(Number(legendaryQuota) || 0));

  // 决定稀有度（储备为 0 时自然传奇概率为 0；达保底且储备>0 才强制传奇）
  let rarity = rollRarity(quota);

  let pityForced = false;
  if (currentPity >= PITY_THRESHOLD - 1 && quota > 0) {
    rarity = 'legendary';
    pityForced = true;
  }

  // 每日上限降级
  if (rarity === 'legendary' && (todayRarityCounts.legendary || 0) >= DAILY_RARITY_CAP.legendary) {
    rarity = 'epic';
  }
  if (rarity === 'epic' && (todayRarityCounts.epic || 0) >= DAILY_RARITY_CAP.epic) {
    rarity = 'rare';
  }

  /** 达保底但储备为 0：不强制传奇，保底计数继续累加 */
  const pityBlockedByQuota = currentPity >= PITY_THRESHOLD - 1 && quota <= 0;

  /** 硬保底已触发但被每日稀有度上限降级为非传奇 */
  const pityLegendarySuppressed = pityForced && rarity !== 'legendary';

  // 从config表随机选卡（本势力 + 通用势力0）
  const table = poolType === 'troop' ? 'config_troops' : 'config_characters';
  const idField = poolType === 'troop' ? 'troop_id' : 'character_id';
  const nameField = poolType === 'troop' ? 'troop_name' : 'character_name';
  const idPrefix = poolType === 'troop' ? 'troop' : 'char';

  const excludeIds = previousResults.filter(r => r.cardId).map(r => r.cardId);

  /** 将领池：同稀有度内先排除已拥有，优先未持有；若该稀有度已全部拥有则同稀有度正常随机（可走重复补偿） */
  let ownedCharacterIds = [];
  if (poolType === 'character') {
    ownedCharacterIds = await getOwnedCharacterCardIds(connection, playerId);
  }

  const excludePoolIdsPrimary = poolType === 'character'
    ? [...new Set([...excludeIds, ...ownedCharacterIds])]
    : [...excludeIds];

  const excludeClausePrimary = excludePoolIdsPrimary.length > 0
    ? ` AND ${idField} NOT IN (${excludePoolIdsPrimary.map(() => '?').join(',')})`
    : '';

  const { whereFragment, likeParams } = buildDrawPoolLikeClause({
    season,
    idPrefix,
    factionNumber,
    idField,
    recruitEff,
    poolSeason,
  });

  // 仅在已确定的 rarity 下，在符合条件的行中均匀随机（多一张同稀有度卡不会改变上文的 rollRarity 概率）
  let query = `SELECT ${idField} AS card_id, ${nameField} AS card_name, rarity
    FROM ${table}
    WHERE rarity = ? AND ${whereFragment}${excludeClausePrimary}
    ORDER BY RAND() LIMIT 1`;
  let params = [rarity, ...likeParams, ...excludePoolIdsPrimary];

  let [rows] = await connection.query(query, params);

  if (rows.length === 0 && poolType === 'character') {
    const excludeClauseDupOnly = excludeIds.length > 0
      ? ` AND ${idField} NOT IN (${excludeIds.map(() => '?').join(',')})`
      : '';
    const dupQuery = `SELECT ${idField} AS card_id, ${nameField} AS card_name, rarity
      FROM ${table}
      WHERE rarity = ? AND ${whereFragment}${excludeClauseDupOnly}
      ORDER BY RAND() LIMIT 1`;
    const dupParams = [rarity, ...likeParams, ...excludeIds];
    [rows] = await connection.query(dupQuery, dupParams);
  }

  if (rows.length === 0) {
    const compensation = { type: 'silver', amount: NO_CARD_AVAILABLE_SILVER };
    await applyPoolCompensation(connection, playerId, factionId, compensation);
    return {
      rarity,
      cardId: null,
      cardName: null,
      compensated: true,
      compensation,
      reason: 'no_card_available',
      pityForced,
      pityLegendarySuppressed,
      pityBlockedByQuota,
    };
  }

  const card = rows[0];

  // ── 部队卡：检查持有上限 ──
  if (poolType === 'troop') {
    const normRarity = String(rarity ?? 'common').toLowerCase();
    const limit = TROOP_LIMIT_BY_RARITY[normRarity] || 20;
    const ownedInScope = await countTroopCardsByRarityInPoolScope(
      connection, playerId, normRarity, poolSeason, limitScopeOpts,
    );
    if (ownedInScope >= limit) {
      const comp = getTroopRarityLimitCompensation(normRarity);
      const compensation = { type: 'food', amount: comp };
      await applyPoolCompensation(connection, playerId, factionId, compensation);
      return {
        rarity,
        cardId: card.card_id,
        cardName: card.card_name,
        compensated: true,
        compensation,
        reason: 'troop_rarity_limit',
        rarityLimit: { owned: ownedInScope, max: limit },
        pityForced,
        pityLegendarySuppressed,
        pityBlockedByQuota,
      };
    }

    // 插入部队卡实例
    const instanceId = `${card.card_id}_${playerId}_${Date.now()}`;
    const [troopConfig] = await connection.query(`SELECT max_troops FROM ${table} WHERE ${idField} = ?`, [card.card_id]);
    const maxTroops = troopConfig[0]?.max_troops || 200;

    await connection.query(
      `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity, current_troops, battle_count, max_battle_count, obtained_at)
       VALUES (?, ?, 'troop', ?, ?, ?, 0, ?, NOW())`,
      [instanceId, playerId, card.card_id, rarity, maxTroops, getMaxBattleCount(rarity)]
    );

    return { rarity, cardId: card.card_id, cardName: card.card_name, instanceId, compensated: false, pityForced, pityBlockedByQuota };
  }

  // ── 将领卡：重复优先于稀有度上限 → 两阶段三选一（21-1 §8.3）──
  if (poolType === 'character') {
    const [existing] = await connection.query(
      `SELECT instance_id, character_echo_slots FROM player_cards
       WHERE player_id = ? AND card_id = ? AND card_type = 'character'`,
      [playerId, card.card_id],
    );
    if (existing.length > 0) {
      const normRarity = String(rarity ?? 'common').toLowerCase();
      const slots = parseEchoSlots(existing[0].character_echo_slots);
      const echoState = buildEchoState(slots);
      return {
        rarity,
        cardId: card.card_id,
        cardName: card.card_name,
        compensated: false,
        echoChoiceRequired: true,
        echoChoicePayload: {
          targetInstanceId: existing[0].instance_id,
          cardId: card.card_id,
          cardName: card.card_name,
          rarity: normRarity,
          poolSeason: poolSeason || 'san_1',
          poolEchoSlotsUsed: echoState.poolSlotsUsed,
        },
        echoState,
        pityForced,
        pityLegendarySuppressed,
        pityBlockedByQuota,
      };
    }

    const normRarity = String(rarity ?? 'common').toLowerCase();
    const charLimit = CHARACTER_LIMIT_BY_RARITY[normRarity];
    if (charLimit != null) {
      const ownedInScope = await countCharacterCardsByRarityInPoolScope(
        connection, playerId, normRarity, poolSeason, limitScopeOpts,
      );
      if (ownedInScope >= charLimit) {
        const comp = getCharacterCompensationSilver(normRarity);
        const compensation = { type: 'silver', amount: comp };
        await applyPoolCompensation(connection, playerId, factionId, compensation);
        return {
          rarity,
          cardId: card.card_id,
          cardName: card.card_name,
          compensated: true,
          compensation,
          reason: 'character_rarity_limit',
          rarityLimit: { owned: ownedInScope, max: charLimit },
          pityForced,
          pityLegendarySuppressed,
          pityBlockedByQuota,
        };
      }
    }

    const instanceId = `${card.card_id}_${playerId}_${Date.now()}`;
    // 查询将领的trait_modifier计算初始士气
    const [charConfig] = await connection.query(
      `SELECT trait_modifier FROM config_characters WHERE character_id = ?`, [card.card_id]
    );
    const traitMod = charConfig[0]?.trait_modifier ?? 0;
    const initialMorale = 70 + traitMod * 2;

    await connection.query(
      `INSERT INTO player_cards (instance_id, player_id, card_type, card_id, rarity, morale, obtained_at)
       VALUES (?, ?, 'character', ?, ?, ?, NOW())`,
      [instanceId, playerId, card.card_id, rarity, initialMorale]
    );

    return {
      rarity, cardId: card.card_id, cardName: card.card_name, instanceId, compensated: false,
      pityForced, pityLegendarySuppressed, pityBlockedByQuota,
    };
  }

  return {
    rarity, cardId: null, compensated: true, reason: 'unknown_pool',
    pityForced, pityLegendarySuppressed, pityBlockedByQuota,
  };
}

// ── 半天周期工具函数 ─────────────────────────────────────────

/**
 * 获取当前半天周期的起始时间SQL表达式（墙钟，与 MySQL 会话时区一致）
 * 12:00~23:59 → 今天 12:00:00
 * 08:00~11:59 → 今天 08:00:00
 * 00:00~07:59 → 昨天 12:00:00（仍属「午间起」半日窗口，跨午夜）
 * 每个周期独立 10 次额度（3+3+4 银两梯度），每天共 20 次/卡池
 */
const HALF_DAY_START_SQL =
  "IF(HOUR(NOW()) >= 12, CONCAT(CURDATE(), ' 12:00:00'), IF(HOUR(NOW()) >= 8, CONCAT(CURDATE(), ' 08:00:00'), CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 12:00:00')))";

// ── 辅助查询函数 ─────────────────────────────────────────────

/**
 * 获取当前半天周期内指定通道（银两 / 真三徽章）已用的通道额度
 * （quota_weight 累加 + 旧数据秒级去重，均仅在该通道筛选范围内计）：
 * - 银两通道：draw_channel IS NULL（旧数据视为银两）或 draw_channel='silver'
 * - 徽章通道：draw_channel='badge'
 */
async function getHalfDayChannelQuota(connection, playerId, poolType, channel) {
  const ch = normalizeDrawChannel(channel);
  const channelFilter = ch === DRAW_CHANNEL_BADGE
    ? "draw_channel = 'badge'"
    : "(draw_channel IS NULL OR draw_channel = 'silver')";
  const [rows] = await connection.query(
    `SELECT
       COALESCE(SUM(CASE WHEN quota_weight IS NOT NULL THEN quota_weight ELSE 0 END), 0) AS weighted,
       COUNT(DISTINCT CASE WHEN quota_weight IS NULL THEN DATE_FORMAT(drawn_at, '%Y-%m-%d %H:%i:%s') END) AS legacy
     FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ? AND ${channelFilter} AND drawn_at >= ${HALF_DAY_START_SQL}`,
    [playerId, poolType]
  );
  return Number(rows[0]?.weighted || 0) + Number(rows[0]?.legacy || 0);
}

/**
 * 十连（或徽章抽）因重复三选一提前结束时，补齐本窗剩余额度计数（compensated 占位行）
 */
async function insertBatchQuotaPadding(connection, playerId, poolType, padCount, pityCount, expiresAt, drawChannel) {
  if (padCount <= 0) return;
  for (let i = 0; i < padCount; i += 1) {
    await connection.query(
      `INSERT INTO temp_card_pool_draws
       (player_id, pool_type, rarity, card_id, compensated, echo_choice_status, pity_count, drawn_at, expires_at, quota_weight, draw_channel)
       VALUES (?, ?, 'common', NULL, 1, 'none', ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, 1, ?)`,
      [playerId, poolType, pityCount, 200 + i, expiresAt, drawChannel],
    );
  }
}

/**
 * 获取今日（全天）各稀有度实际获取数量（不含补偿）
 * 稀有度上限全天共享：传奇1张/天、史诗2张/天
 */
async function getTodayRarityCounts(connection, playerId, poolType) {
  const [rows] = await connection.query(
    `SELECT rarity, COUNT(*) AS cnt FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ? AND DATE(drawn_at) = CURDATE() AND compensated = FALSE
     GROUP BY rarity`,
    [playerId, poolType]
  );
  const counts = {};
  rows.forEach(r => { counts[r.rarity] = r.cnt; });
  return counts;
}

/**
 * 获取保底计数（最新一条记录的 pity_count）
 */
async function getPityCount(connection, playerId, poolType) {
  const [rows] = await connection.query(
    `SELECT pity_count FROM temp_card_pool_draws
     WHERE player_id = ? AND pool_type = ?
     ORDER BY id DESC LIMIT 1`,
    [playerId, poolType]
  );
  return rows.length > 0 ? normalizePityCount(rows[0].pity_count) : 0;
}

// ── 查询接口 ─────────────────────────────────────────────────

/**
 * 查询玩家未完成的将领重复三选一（echo_choice_status=pending）
 */
async function getPendingEchoChoice(playerId) {
  const [rows] = await pool.query(
    `SELECT id, pool_type, rarity, card_id, echo_choice_payload
     FROM temp_card_pool_draws
     WHERE player_id = ? AND echo_choice_status = 'pending'
     ORDER BY id ASC LIMIT 1`,
    [playerId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  let payload = row.echo_choice_payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  const poolSlotsUsed = payload?.poolEchoSlotsUsed ?? 0;
  return {
    pendingEchoDrawId: row.id,
    poolType: row.pool_type,
    cardId: row.card_id,
    cardName: payload?.cardName || row.card_id,
    rarity: row.rarity || payload?.rarity || 'common',
    echoState: {
      poolSlotsUsed,
      poolSlotsMax: 2,
    },
  };
}

async function getPendingEchoChoiceOnConnection(connection, playerId) {
  const [rows] = await connection.query(
    `SELECT id FROM temp_card_pool_draws
     WHERE player_id = ? AND echo_choice_status = 'pending'
     ORDER BY id ASC LIMIT 1`,
    [playerId],
  );
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * 获取卡池状态（剩余次数、保底进度等）
 */
async function getPoolStatus(playerId) {
  const [playerRows] = await pool.query(
    'SELECT silver, faction_id, items FROM players WHERE player_id = ?', [playerId]
  );
  if (playerRows.length === 0) throw new Error('玩家不存在');

  const playerItems = parsePlayerItemsColumn(playerRows[0].items);
  const stormBadgeCount = Math.max(0, Math.floor(Number(playerItems[BADGE_BATCH_ITEM_ID]) || 0));

  // 当前半天周期内各卡池两条通道（银两十连 / 真三徽章抽）各自的额度用量
  const troopSilverUsed = await getHalfDayChannelQuota(pool, playerId, 'troop', DRAW_CHANNEL_SILVER);
  const troopBadgeUsed = await getHalfDayChannelQuota(pool, playerId, 'troop', DRAW_CHANNEL_BADGE);
  const charSilverUsed = await getHalfDayChannelQuota(pool, playerId, 'character', DRAW_CHANNEL_SILVER);
  const charBadgeUsed = await getHalfDayChannelQuota(pool, playerId, 'character', DRAW_CHANNEL_BADGE);
  const itemSilverUsed = await getHalfDayChannelQuota(pool, playerId, 'item', DRAW_CHANNEL_SILVER);
  const itemBadgeUsed = await getHalfDayChannelQuota(pool, playerId, 'item', DRAW_CHANNEL_BADGE);

  // 保底计数
  const [troopPity] = await pool.query(
    `SELECT pity_count FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'troop' ORDER BY id DESC LIMIT 1`,
    [playerId]
  );
  const [charPity] = await pool.query(
    `SELECT pity_count FROM temp_card_pool_draws WHERE player_id = ? AND pool_type = 'character' ORDER BY id DESC LIMIT 1`,
    [playerId]
  );

  const factionId = playerRows[0].faction_id;
  let poolBal = { troopLegendary: 0, characterLegendary: 0 };
  if (factionId) {
    try {
      poolBal = (await factionReserveService.getPoolBalance(pool, factionId)) || poolBal;
    } catch {
      /* 预览降级 */
    }
  }
  const troopQuota = poolBal.troopLegendary ?? 0;
  const charQuota = poolBal.characterLegendary ?? 0;

  let recruit = { enabled: false, san0Band: null, catalogCount: 0 };
  try {
    const recruitEff = await factionPolicyService.getEffectiveRecruit(factionId);
    if (recruitEff?.enabled && recruitEff.san0Band) {
      const band = String(recruitEff.san0Band);
      recruit = { enabled: true, san0Band: band, catalogCount: 0 };
      const [catRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM config_characters
          WHERE character_id LIKE ? AND rarity != 'core'`,
        [`san_0_char_${band}%`],
      );
      recruit.catalogCount = Number(catRows[0]?.cnt || 0);
    }
  } catch {
    /* 预览降级：无招贤 Tab */
  }

  const pendingEchoChoice = await getPendingEchoChoice(playerId);
  const batchDrawTotalCost = getBatchDrawTotalCost();

  /** 单个卡池的双通道状态（银两十连 / 真三徽章抽），供 troop/character/item 共用口径 */
  function buildChannelStatus(silverUsed, badgeUsed) {
    const canSilverBatch = canChannelBatch(silverUsed);
    const canBadgeBatch = canChannelBatch(badgeUsed);
    return {
      canSilverBatch,
      canBadgeBatch,
      canBatchDraw: canSilverBatch, // 兼容旧字段：仅代表银两通道
      remainingDraws: (canSilverBatch ? 1 : 0) + (canBadgeBatch ? 1 : 0),
      remainingSlots: (canSilverBatch ? 1 : 0) + (canBadgeBatch ? 1 : 0),
      dailyLimit: HALF_DAY_TOTAL_SLOTS,
      slotLimit: HALF_DAY_TOTAL_SLOTS,
      nextDrawCost: null,
      batchDrawTotalCost,
      badgeBatchCost: BADGE_BATCH_COST,
      badgeBatchItemId: BADGE_BATCH_ITEM_ID,
    };
  }

  return {
    silver: playerRows[0].silver,
    factionId,
    stormBadgeCount,
    badgeBatchCost: BADGE_BATCH_COST,
    badgeBatchItemId: BADGE_BATCH_ITEM_ID,
    drawCostTiers: DRAW_COST_TIERS,
    batchDrawTotalCost,
    batchDrawBonusOps: BATCH_DRAW_BONUS_OPS,
    batchDrawTotalOps: BATCH_DRAW_TOTAL_OPS,
    slotLimit: HALF_DAY_TOTAL_SLOTS,
    factionLegendaryQuota: { troop: troopQuota, character: charQuota },
    recruit,
    pendingEchoChoice,
    poolSeasons: {
      base: { season: 'san_1', label: '黄巾之乱' },
      recruit: { season: 'san_0', label: '楚汉争霸' },
    },
    troop: {
      ...buildChannelStatus(troopSilverUsed, troopBadgeUsed),
      drawCostTiers: DRAW_COST_TIERS,
      cardsPerDraw: 2,
      pityCount: troopPity.length > 0 ? normalizePityCount(troopPity[0].pity_count) : 0,
      pityThreshold: PITY_THRESHOLD,
      legendaryQuota: troopQuota,
      probabilities: computeLegendaryDrawProbabilities(troopQuota),
    },
    character: {
      ...buildChannelStatus(charSilverUsed, charBadgeUsed),
      drawCostTiers: DRAW_COST_TIERS,
      cardsPerDraw: 1,
      pityCount: charPity.length > 0 ? normalizePityCount(charPity[0].pity_count) : 0,
      pityThreshold: PITY_THRESHOLD,
      legendaryQuota: charQuota,
      probabilities: computeLegendaryDrawProbabilities(charQuota),
    },
    item: {
      ...buildChannelStatus(itemSilverUsed, itemBadgeUsed),
      drawCostTiers: DRAW_COST_TIERS,
      cardsPerDraw: 1,
      prizes: listItemPoolPrizesForStatus(),
    },
    probabilities: computeLegendaryDrawProbabilities(troopQuota),
  };
}

/**
 * 卡池重复残影三选一结算（21-1 §8.3.4）
 * @param {string} playerId
 * @param {number} pendingEchoDrawId temp_card_pool_draws.id
 * @param {'attack'|'defense'|'convert'} choice
 */
async function resolveEchoChoice(playerId, pendingEchoDrawId, choice) {
  const drawId = Math.floor(Number(pendingEchoDrawId));
  if (!drawId) throw new Error('无效的 pendingEchoDrawId');
  if (!['attack', 'defense', 'convert'].includes(choice)) {
    throw new Error('无效的三选一选项');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [drawRows] = await connection.query(
      `SELECT id, player_id, pool_type, rarity, card_id, echo_choice_status, echo_choice_payload
       FROM temp_card_pool_draws WHERE id = ? FOR UPDATE`,
      [drawId],
    );
    if (drawRows.length === 0) throw new Error('抽取记录不存在');
    const draw = drawRows[0];
    if (String(draw.player_id) !== String(playerId)) {
      const err = new Error('无权处理该抽取记录');
      err.statusCode = 403;
      throw err;
    }
    if (draw.echo_choice_status !== 'pending') {
      throw new Error('该重复选择已处理或无效');
    }
    if (draw.pool_type !== 'character') {
      throw new Error('仅将领卡池支持残影');
    }

    let payload = draw.echo_choice_payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }
    if (!payload?.targetInstanceId) throw new Error('重复选择数据损坏');

    const normRarity = String(draw.rarity ?? payload.rarity ?? 'common').toLowerCase();
    let compensation = null;
    let echoApplied = null;

    if (choice === 'attack' || choice === 'defense') {
      const [targetRows] = await connection.query(
        `SELECT instance_id, character_echo_slots FROM player_cards
         WHERE instance_id = ? AND player_id = ? AND card_type = 'character' FOR UPDATE`,
        [payload.targetInstanceId, playerId],
      );
      if (targetRows.length === 0) throw new Error('目标将领不存在');
      const slots = parseEchoSlots(targetRows[0].character_echo_slots);
      if (!canAddPoolEcho(slots)) {
        const err = new Error('卡池残影已满 2/2，仅可转化');
        err.statusCode = 422;
        throw err;
      }
      const nextSlots = appendPoolEchoSlot(slots, choice);
      await connection.query(
        'UPDATE player_cards SET character_echo_slots = ? WHERE instance_id = ?',
        [JSON.stringify(nextSlots), payload.targetInstanceId],
      );
      echoApplied = {
        targetInstanceId: payload.targetInstanceId,
        kind: choice,
        characterEchoSlots: nextSlots,
      };
    } else {
      if (normRarity === 'legendary') {
        await playerItemsService.addItem(playerId, SEASON_BADGE_ITEM_ID, 1);
        compensation = { type: 'item', itemId: SEASON_BADGE_ITEM_ID, amount: 1 };
      } else {
        const comp = getCharacterCompensationSilver(normRarity);
        await connection.query(
          'UPDATE players SET silver = silver + ? WHERE player_id = ?',
          [comp, playerId],
        );
        compensation = { type: 'silver', amount: comp };
        await statisticsDeltaService.recordEarned(playerId, { silver: comp });
      }
    }

    await connection.query(
      `UPDATE temp_card_pool_draws
       SET echo_choice_status = 'resolved', echo_choice_payload = ?
       WHERE id = ?`,
      [
        JSON.stringify({
          ...payload,
          resolvedChoice: choice,
          resolvedAt: new Date().toISOString(),
        }),
        drawId,
      ],
    );

    const [updatedPlayer] = await connection.query(
      'SELECT silver FROM players WHERE player_id = ?',
      [playerId],
    );

    await connection.commit();

    return {
      success: true,
      choice,
      pendingEchoDrawId: drawId,
      cardId: draw.card_id,
      cardName: payload.cardName || null,
      rarity: normRarity,
      compensation,
      echoApplied,
      remainingSilver: updatedPlayer[0]?.silver ?? null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ── 导出 ─────────────────────────────────────────────────────

module.exports = {
  drawFromPool,
  resolveEchoChoice,
  getPoolStatus,
  DRAW_PROBABILITIES,
  DAILY_DRAW_LIMIT,
  DRAW_COST_TIERS,
  PITY_THRESHOLD,
};
