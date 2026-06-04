/**
 * 势力银粮储备 · 统一数据访问（`faction_reserve` 表）
 *
 * - `category = pool`：当前余额 + 日恢复幂等日
 * - 入账/出账 category：按大类累计统计（非逐笔流水）
 *
 * @see 11-3-FACTION_POLICY_SYSTEM.md · 势力储备入账/出账
 */

const { pool } = require('../database/connection');

const CATEGORY = Object.freeze({
  POOL: 'pool',
  DAILY_RECOVERY: 'daily_recovery',
  DAILY_LEGENDARY_RECOVERY: 'daily_legendary_recovery',
  SIEGE_SETTLEMENT: 'siege_settlement',
  WAR_START: 'war_start',
  MARCH_FOOD: 'march_food',
  STIPEND_BONUS: 'stipend_bonus',
  CARD_POOL_DRAW: 'card_pool_draw',
  CARD_POOL_COMPENSATION: 'card_pool_compensation',
  CARD_POOL_LEGENDARY_TROOP: 'card_pool_legendary_troop',
  CARD_POOL_LEGENDARY_CHARACTER: 'card_pool_legendary_character',
  TRIBUTE_LEGENDARY_TROOP: 'tribute_legendary_troop',
});

const CREDIT_CATEGORY_META = [
  {
    key: CATEGORY.DAILY_RECOVERY,
    label: '每日恢复',
    hint: '每日 00:00 按国力档与占城规模入账',
  },
  {
    key: CATEGORY.SIEGE_SETTLEMENT,
    label: '结算入账',
    hint: '攻城战斗净收益中按城战奖赏政策划入势力池的部分',
  },
  {
    key: CATEGORY.CARD_POOL_DRAW,
    label: '卡池抽卡',
    hint: '封赏卡池抽取费用划入势力银储备',
  },
];

const LEGENDARY_CREDIT_CATEGORY_META = [
  {
    key: CATEGORY.DAILY_LEGENDARY_RECOVERY,
    label: '每日恢复',
    hint: '每日 00:00 按军事/文化标量入账（军事÷5→部队，文化÷5→将领）',
    legendaryScope: 'both',
  },
  {
    key: CATEGORY.TRIBUTE_LEGENDARY_TROOP,
    label: '传奇朝贡',
    hint: '三公府朝贡传奇部队卡额外 +1 部队传奇储备',
    legendaryScope: 'troop',
  },
];

/** @deprecated 使用 CREDIT_CATEGORY_META */
const INCOME_CATEGORY_META = CREDIT_CATEGORY_META;

const EXPENSE_CATEGORY_META = [
  { key: CATEGORY.WAR_START, label: '战事消耗', hint: '开启战事（含发动费与宣战临时政策费）' },
  { key: CATEGORY.MARCH_FOOD, label: '行军消耗', hint: '玩家个人粮草不足时自势力池垫粮' },
  { key: CATEGORY.STIPEND_BONUS, label: '俸禄奖赏', hint: '封赏俸禄领取时的粮饷政策 Bonus' },
  {
    key: CATEGORY.CARD_POOL_COMPENSATION,
    label: '卡池补偿',
    hint: '重复/上限/无卡可用的银粮补偿自势力池垫付（可暂为负，日恢复回补）',
  },
];

const LEGENDARY_EXPENSE_CATEGORY_META = [
  {
    key: CATEGORY.CARD_POOL_LEGENDARY_TROOP,
    label: '部队卡池',
    hint: '封赏卡池成功发出部队传奇卡时扣减储备',
    legendaryScope: 'troop',
  },
  {
    key: CATEGORY.CARD_POOL_LEGENDARY_CHARACTER,
    label: '将领卡池',
    hint: '封赏卡池成功发出将领传奇卡时扣减储备',
    legendaryScope: 'character',
  },
];

/** @deprecated 使用 EXPENSE_CATEGORY_META */
const USAGE_CATEGORY_META = EXPENSE_CATEGORY_META;

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 */
async function ensurePoolRow(conn, factionId) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  await conn.query(
    `INSERT IGNORE INTO faction_reserve (faction_id, category, silver, food)
     VALUES (?, ?, 0, 0)`,
    [fid, CATEGORY.POOL],
  );
}

/**
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} db
 * @param {string} factionId
 * @param {{ forUpdate?: boolean }} [opts]
 * @returns {Promise<{ silver: number, food: number, recoveryAppliedDate: string|null } | null>}
 */
async function getPoolBalance(db, factionId, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return null;
  const lock = opts.forUpdate ? ' FOR UPDATE' : '';
  let rows;
  try {
    [rows] = await db.query(
      `SELECT silver, food, troop_legendary AS troopLegendary, character_legendary AS characterLegendary,
              recovery_applied_date AS recoveryAppliedDate
       FROM faction_reserve
       WHERE faction_id = ? AND category = ?${lock}`,
      [fid, CATEGORY.POOL],
    );
  } catch (e) {
    if (/Unknown column ['`]troop_legendary/i.test(e?.message || '')) {
      [rows] = await db.query(
        `SELECT silver, food, recovery_applied_date AS recoveryAppliedDate
         FROM faction_reserve
         WHERE faction_id = ? AND category = ?${lock}`,
        [fid, CATEGORY.POOL],
      );
    } else {
      throw e;
    }
  }
  if (!rows.length) {
    return { silver: 0, food: 0, troopLegendary: 0, characterLegendary: 0, recoveryAppliedDate: null };
  }
  const r = rows[0];
  const d = r.recoveryAppliedDate;
  let recoveryAppliedDate = null;
  if (d != null) {
    if (d instanceof Date) {
      recoveryAppliedDate = d.toISOString().slice(0, 10);
    } else {
      recoveryAppliedDate = String(d).slice(0, 10);
    }
  }
  return {
    silver: Number(r.silver) || 0,
    food: Number(r.food) || 0,
    troopLegendary: Number(r.troopLegendary) || 0,
    characterLegendary: Number(r.characterLegendary) || 0,
    recoveryAppliedDate,
  };
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ silver?: number, food?: number }} amounts
 */
/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ silver?: number, food?: number }} amounts
 * @param {{ ledgerCategory?: string }} [opts] 同时累计到收支详情（入账类 category）
 */
async function creditPoolOnConnection(conn, factionId, amounts = {}, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  const silver = Math.max(0, Math.floor(Number(amounts.silver) || 0));
  const food = Math.max(0, Math.floor(Number(amounts.food) || 0));
  if (silver === 0 && food === 0) return;
  await ensurePoolRow(conn, fid);
  await conn.query(
    `UPDATE faction_reserve
     SET silver = silver + ?, food = food + ?
     WHERE faction_id = ? AND category = ?`,
    [silver, food, fid, CATEGORY.POOL],
  );
  if (opts.ledgerCategory) {
    await addLedgerCategoryOnConnection(conn, fid, opts.ledgerCategory, { silver, food });
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ silver?: number, food?: number }} amounts
 * @param {{ errorCode?: string, errorPrefix?: string }} [opts]
 * @returns {Promise<{ silver: number, food: number }>}
 */
async function deductPoolOnConnection(conn, factionId, amounts = {}, opts = {}) {
  const fid = String(factionId || '').trim();
  const prefix = opts.errorPrefix || '[factionReserve]';
  const silver = Math.max(0, Math.floor(Number(amounts.silver) || 0));
  const food = Math.max(0, Math.floor(Number(amounts.food) || 0));
  if (!fid) {
    const err = new Error(`${prefix} 缺少 factionId`);
    err.code = 'FACTION_NOT_FOUND';
    throw err;
  }
  await ensurePoolRow(conn, fid);
  const allowNegative = !!opts.allowNegative;
  if (!allowNegative) {
    const bal = await getPoolBalance(conn, fid, { forUpdate: true });
    if (bal.silver < silver || bal.food < food) {
      const err = new Error(
        `${prefix} 势力银粮储备不足（需 ${silver} 银、${food} 粮；当前 ${bal.silver} 银、${bal.food} 粮）`,
      );
      err.code = opts.errorCode || 'INSUFFICIENT_FACTION_RESERVES';
      err.details = {
        reserveSilver: bal.silver,
        reserveFood: bal.food,
        needSilver: silver,
        needFood: food,
      };
      throw err;
    }
  } else {
    await getPoolBalance(conn, fid, { forUpdate: true });
  }
  if (silver > 0 || food > 0) {
    await conn.query(
      `UPDATE faction_reserve
       SET silver = silver - ?, food = food - ?
       WHERE faction_id = ? AND category = ?`,
      [silver, food, fid, CATEGORY.POOL],
    );
    if (opts.ledgerCategory) {
      await addLedgerCategoryOnConnection(conn, fid, opts.ledgerCategory, { silver, food });
    }
  }
  return { silver, food };
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {string} category
 * @param {{ silver?: number, food?: number }} amounts
 */
async function addLedgerCategoryOnConnection(conn, factionId, category, amounts = {}) {
  const fid = String(factionId || '').trim();
  const cat = String(category || '').trim();
  if (!fid || !cat || cat === CATEGORY.POOL) return;
  const silver = Math.max(0, Math.floor(Number(amounts.silver) || 0));
  const food = Math.max(0, Math.floor(Number(amounts.food) || 0));
  const troopLegendary = Math.max(0, Math.floor(Number(amounts.troopLegendary) || 0));
  const characterLegendary = Math.max(0, Math.floor(Number(amounts.characterLegendary) || 0));
  if (silver === 0 && food === 0 && troopLegendary === 0 && characterLegendary === 0) return;
  await conn.query(
    `INSERT INTO faction_reserve (faction_id, category, silver, food, troop_legendary, character_legendary)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       silver = silver + VALUES(silver),
       food = food + VALUES(food),
       troop_legendary = troop_legendary + VALUES(troop_legendary),
       character_legendary = character_legendary + VALUES(character_legendary)`,
    [fid, cat, silver, food, troopLegendary, characterLegendary],
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ troop?: number, character?: number }} amounts
 * @param {{ ledgerCategory?: string }} [opts]
 */
async function creditLegendaryQuotaOnConnection(conn, factionId, amounts = {}, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  const troop = Math.max(0, Math.floor(Number(amounts.troop) || 0));
  const character = Math.max(0, Math.floor(Number(amounts.character) || 0));
  if (troop === 0 && character === 0) return;
  await ensurePoolRow(conn, fid);
  await conn.query(
    `UPDATE faction_reserve
     SET troop_legendary = troop_legendary + ?,
         character_legendary = character_legendary + ?
     WHERE faction_id = ? AND category = ?`,
    [troop, character, fid, CATEGORY.POOL],
  );
  if (opts.ledgerCategory) {
    await addLedgerCategoryOnConnection(conn, fid, opts.ledgerCategory, {
      troopLegendary: troop,
      characterLegendary: character,
    });
  }
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {'troop'|'character'} kind
 * @param {{ ledgerCategory?: string }} [opts]
 */
async function deductLegendaryQuotaOnConnection(conn, factionId, kind, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  const isTroop = kind === 'troop';
  const col = isTroop ? 'troop_legendary' : 'character_legendary';
  await ensurePoolRow(conn, fid);
  await conn.query(
    `UPDATE faction_reserve SET ${col} = ${col} - 1 WHERE faction_id = ? AND category = ?`,
    [fid, CATEGORY.POOL],
  );
  if (opts.ledgerCategory) {
    await addLedgerCategoryOnConnection(conn, fid, opts.ledgerCategory, {
      troopLegendary: isTroop ? 1 : 0,
      characterLegendary: isTroop ? 0 : 1,
    });
  }
}

/** 出账累计（兼容旧名） */
async function addUsageOnConnection(conn, factionId, category, amounts = {}) {
  return addLedgerCategoryOnConnection(conn, factionId, category, amounts);
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {string} dateStr YYYY-MM-DD
 */
async function setRecoveryAppliedDateOnConnection(conn, factionId, dateStr) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  await ensurePoolRow(conn, fid);
  await conn.query(
    `UPDATE faction_reserve SET recovery_applied_date = ? WHERE faction_id = ? AND category = ?`,
    [dateStr, fid, CATEGORY.POOL],
  );
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} factionId
 * @param {{ silver: number, food: number, recoveryAppliedDate: string }} payload
 */
async function creditRecoveryOnConnection(conn, factionId, payload) {
  const fid = String(factionId || '').trim();
  if (!fid) return;
  const silver = Math.max(0, Math.floor(Number(payload.silver) || 0));
  const food = Math.max(0, Math.floor(Number(payload.food) || 0));
  await ensurePoolRow(conn, fid);
  await conn.query(
    `UPDATE faction_reserve
     SET silver = silver + ?,
         food = food + ?,
         recovery_applied_date = ?
     WHERE faction_id = ? AND category = ?`,
    [silver, food, payload.recoveryAppliedDate, fid, CATEGORY.POOL],
  );
  if (silver > 0 || food > 0) {
    await addLedgerCategoryOnConnection(conn, fid, CATEGORY.DAILY_RECOVERY, { silver, food });
  }
}

function buildCategoryRows(meta, byCat, hintOverrides = {}) {
  const categories = meta.map((m) => ({
    key: m.key,
    label: m.label,
    hint: hintOverrides[m.key] ?? m.hint,
    silver: byCat[m.key]?.silver || 0,
    food: byCat[m.key]?.food || 0,
  }));
  return {
    categories,
    totalSilver: categories.reduce((s, c) => s + c.silver, 0),
    totalFood: categories.reduce((s, c) => s + c.food, 0),
  };
}

function buildLegendaryCategoryRows(meta, byCat, hintOverrides = {}) {
  const categories = meta.map((m) => ({
    key: m.key,
    label: m.label,
    hint: hintOverrides[m.key] ?? m.hint,
    legendaryScope: m.legendaryScope || 'both',
    troopLegendary: byCat[m.key]?.troopLegendary || 0,
    characterLegendary: byCat[m.key]?.characterLegendary || 0,
  }));
  return {
    categories,
    totalTroopLegendary: categories.reduce((s, c) => s + c.troopLegendary, 0),
    totalCharacterLegendary: categories.reduce((s, c) => s + c.characterLegendary, 0),
  };
}

/**
 * @param {object|null|undefined} reserveRecoveryEstimate
 * @returns {string}
 */
function buildDailyRecoveryHint(reserveRecoveryEstimate) {
  const est = reserveRecoveryEstimate;
  if (!est || est.supplyTier == null) {
    return '无国力档时无每日恢复';
  }
  const fmt = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');
  return `银 ${fmt(est.estimatedSilverMin)}～${fmt(est.estimatedSilverMax)} · 粮 ${fmt(est.estimatedFoodMin)}～${fmt(est.estimatedFoodMax)}（0:00 入账）`;
}

/**
 * @param {string} factionId
 * @param {{ reserveRecoveryEstimate?: object|null }} [opts]
 */
async function getLedgerSummaryForFaction(factionId, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return null;
  const dailyRecoveryHint = buildDailyRecoveryHint(opts.reserveRecoveryEstimate);
  let rows;
  try {
    [rows] = await pool.query(
      `SELECT category, silver, food, troop_legendary AS troopLegendary, character_legendary AS characterLegendary
       FROM faction_reserve
       WHERE faction_id = ? AND category <> ?`,
      [fid, CATEGORY.POOL],
    );
  } catch (e) {
    if (/Unknown table ['`]faction_reserve/i.test(e?.message || '')) {
      return {
        credit: buildCategoryRows(CREDIT_CATEGORY_META, {}, { [CATEGORY.DAILY_RECOVERY]: dailyRecoveryHint }),
        expense: buildCategoryRows(EXPENSE_CATEGORY_META, {}),
        schemaMissing: true,
      };
    }
    if (/Unknown column ['`]troop_legendary/i.test(e?.message || '')) {
      [rows] = await pool.query(
        `SELECT category, silver, food FROM faction_reserve WHERE faction_id = ? AND category <> ?`,
        [fid, CATEGORY.POOL],
      );
    } else {
      throw e;
    }
  }
  const byCat = {};
  for (const r of rows) {
    byCat[r.category] = {
      silver: Number(r.silver) || 0,
      food: Number(r.food) || 0,
      troopLegendary: Number(r.troopLegendary) || 0,
      characterLegendary: Number(r.characterLegendary) || 0,
    };
  }
  return {
    credit: buildCategoryRows(CREDIT_CATEGORY_META, byCat, {
      [CATEGORY.DAILY_RECOVERY]: dailyRecoveryHint,
    }),
    expense: buildCategoryRows(EXPENSE_CATEGORY_META, byCat),
  };
}

/**
 * @param {string} factionId
 * @returns {Promise<{ categories: Array<object>, totalSilver: number, totalFood: number, schemaMissing?: boolean } | null>}
 */
async function getUsageSummaryForFaction(factionId) {
  const ledger = await getLedgerSummaryForFaction(factionId);
  if (!ledger) return null;
  return { ...ledger.expense, schemaMissing: ledger.schemaMissing };
}

/**
 * @param {{ military?: number, culture?: number }} totals
 * @returns {string}
 */
function buildDailyLegendaryRecoveryHint(totals) {
  const { computeDailyLegendaryRecovery } = require('../../shared/utils/factionLegendaryReserve.cjs');
  const { troop, character } = computeDailyLegendaryRecovery(totals?.military, totals?.culture);
  const fmt = (n) => Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('zh-CN');
  return `部队 ${fmt(troop)} · 将领 ${fmt(character)} 张/日（0:00 入账，军事÷5、文化÷5）`;
}

/**
 * @param {string} factionId
 * @param {{ factionTotals?: { military?: number, culture?: number } }} [opts]
 */
async function getLegendaryLedgerSummaryForFaction(factionId, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) return null;
  const dailyHint = buildDailyLegendaryRecoveryHint(opts.factionTotals);
  let rows;
  try {
    [rows] = await pool.query(
      `SELECT category, troop_legendary AS troopLegendary, character_legendary AS characterLegendary
       FROM faction_reserve
       WHERE faction_id = ? AND category <> ?`,
      [fid, CATEGORY.POOL],
    );
  } catch (e) {
    if (/Unknown table ['`]faction_reserve/i.test(e?.message || '')) {
      return {
        credit: buildLegendaryCategoryRows(LEGENDARY_CREDIT_CATEGORY_META, {}, {
          [CATEGORY.DAILY_LEGENDARY_RECOVERY]: dailyHint,
        }),
        expense: buildLegendaryCategoryRows(LEGENDARY_EXPENSE_CATEGORY_META, {}),
        schemaMissing: true,
      };
    }
    if (/Unknown column ['`]troop_legendary/i.test(e?.message || '')) {
      return {
        credit: buildLegendaryCategoryRows(LEGENDARY_CREDIT_CATEGORY_META, {}, {
          [CATEGORY.DAILY_LEGENDARY_RECOVERY]: dailyHint,
        }),
        expense: buildLegendaryCategoryRows(LEGENDARY_EXPENSE_CATEGORY_META, {}),
        schemaMissing: true,
      };
    }
    throw e;
  }
  const byCat = {};
  for (const r of rows) {
    byCat[r.category] = {
      troopLegendary: Number(r.troopLegendary) || 0,
      characterLegendary: Number(r.characterLegendary) || 0,
    };
  }
  return {
    credit: buildLegendaryCategoryRows(LEGENDARY_CREDIT_CATEGORY_META, byCat, {
      [CATEGORY.DAILY_LEGENDARY_RECOVERY]: dailyHint,
    }),
    expense: buildLegendaryCategoryRows(LEGENDARY_EXPENSE_CATEGORY_META, byCat),
  };
}

module.exports = {
  CATEGORY,
  CREDIT_CATEGORY_META,
  LEGENDARY_CREDIT_CATEGORY_META,
  INCOME_CATEGORY_META,
  EXPENSE_CATEGORY_META,
  LEGENDARY_EXPENSE_CATEGORY_META,
  CATEGORY_META: EXPENSE_CATEGORY_META,
  USAGE_CATEGORY_META,
  ensurePoolRow,
  getPoolBalance,
  creditPoolOnConnection,
  deductPoolOnConnection,
  creditLegendaryQuotaOnConnection,
  deductLegendaryQuotaOnConnection,
  addLedgerCategoryOnConnection,
  addUsageOnConnection,
  setRecoveryAppliedDateOnConnection,
  creditRecoveryOnConnection,
  buildDailyRecoveryHint,
  buildDailyLegendaryRecoveryHint,
  getLedgerSummaryForFaction,
  getLegendaryLedgerSummaryForFaction,
  getUsageSummaryForFaction,
};
