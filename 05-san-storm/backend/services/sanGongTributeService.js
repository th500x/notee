/**
 * 三公府 · 互动 · 朝贡：销毁军营池内部队卡或将领卡，按稀有度发放固定贡献；
 * 传奇部队卡 +1 部队传奇储备，传奇将领卡 +1 将领传奇储备。
 */

const { pool } = require('../database/connection');
const {
  getEligibleBarracksTroopInstanceIds,
  getEligibleBarracksCharacterInstanceIds,
} = require('./playerBarracksTroopPoolService');
const { tributeCompensationPerTroopCard } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');
const statisticsDeltaService = require('./statisticsDeltaService');

const MAX_TROOP_PER_CALENDAR_DAY = 5;
const MAX_CHARACTER_PER_CALENDAR_DAY = 1;

const TRIBUTE_KIND = Object.freeze({
  troop: {
    cardType: 'troop',
    maxPerDay: MAX_TROOP_PER_CALENDAR_DAY,
    dateCol: 'san_gong_tribute_date',
    countCol: 'san_gong_tribute_count',
    label: '部队',
    eligibleError: '仅可朝贡当前军营池内的部队卡（未上阵、未在驻地槽、次数未满或传奇）',
    deleteError: '销毁部队卡失败（可能已上阵或在驻地），请刷新后重试',
    emptySelectError: '请选择至少一张部队卡',
    legendaryLedger: 'TRIBUTE_LEGENDARY_TROOP',
    legendaryField: 'troop',
  },
  character: {
    cardType: 'character',
    maxPerDay: MAX_CHARACTER_PER_CALENDAR_DAY,
    dateCol: 'san_gong_tribute_character_date',
    countCol: 'san_gong_tribute_character_count',
    label: '将领',
    eligibleError: '仅可朝贡当前军营池内的将领卡（未上阵、未在驻地槽）',
    deleteError: '销毁将领卡失败（可能已上阵或在驻地），请刷新后重试',
    emptySelectError: '请选择至少一张将领卡',
    legendaryLedger: 'TRIBUTE_LEGENDARY_CHARACTER',
    legendaryField: 'character',
  },
});

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeTributeKind(raw) {
  const k = String(raw || 'troop').toLowerCase();
  return k === 'character' ? 'character' : 'troop';
}

function readDailyUsed(row, kindConfig, todayStr) {
  const stored = mysqlDateToYmd(row[kindConfig.dateCol]);
  if (!stored || stored !== todayStr) return 0;
  return Math.max(0, Math.min(kindConfig.maxPerDay, Number(row[kindConfig.countCol]) || 0));
}

function buildDailyStatus(used, maxPerDay) {
  return {
    usedToday: used,
    remainingToday: Math.max(0, maxPerDay - used),
    maxPerDay,
  };
}

/**
 * @param {string} playerId
 * @returns {Promise<{ troop: object, character: object }>}
 */
async function getTributeDailyStatus(playerId) {
  const pid = String(playerId || '').trim();
  const emptyTroop = buildDailyStatus(0, MAX_TROOP_PER_CALENDAR_DAY);
  const emptyCharacter = buildDailyStatus(0, MAX_CHARACTER_PER_CALENDAR_DAY);
  if (!pid) return { troop: emptyTroop, character: emptyCharacter };

  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  const [rows] = await pool.query(
    `SELECT san_gong_tribute_date, san_gong_tribute_count,
            san_gong_tribute_character_date, san_gong_tribute_character_count
     FROM player_events WHERE player_id = ?`,
    [pid],
  );
  const row = rows[0] || {};
  const [dr] = await pool.query('SELECT CURDATE() AS d');
  const todayStr = mysqlDateToYmd(dr[0].d);
  const troopUsed = readDailyUsed(row, TRIBUTE_KIND.troop, todayStr);
  const characterUsed = readDailyUsed(row, TRIBUTE_KIND.character, todayStr);
  return {
    troop: buildDailyStatus(troopUsed, MAX_TROOP_PER_CALENDAR_DAY),
    character: buildDailyStatus(characterUsed, MAX_CHARACTER_PER_CALENDAR_DAY),
  };
}

/**
 * @param {string} playerId
 * @param {string[]} instanceIds
 * @param {'troop'|'character'} [cardType]
 */
async function submitCardTribute(playerId, instanceIds, cardType = 'troop') {
  const kindKey = normalizeTributeKind(cardType);
  const kind = TRIBUTE_KIND[kindKey];
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  const ids = [...new Set((instanceIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, status: 400, error: kind.emptySelectError };
  if (ids.length > kind.maxPerDay) {
    return { ok: false, status: 400, error: `单次最多选择 ${kind.maxPerDay} 张` };
  }

  const eligible = new Set(
    kindKey === 'character'
      ? await getEligibleBarracksCharacterInstanceIds(pid)
      : await getEligibleBarracksTroopInstanceIds(pid),
  );
  for (const id of ids) {
    if (!eligible.has(id)) {
      return { ok: false, status: 400, error: kind.eligibleError };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    const [peRows] = await conn.query(
      `SELECT san_gong_tribute_date, san_gong_tribute_count,
              san_gong_tribute_character_date, san_gong_tribute_character_count
       FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    if (!peRows.length) {
      await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    }
    const [pe2] = await conn.query(
      `SELECT san_gong_tribute_date, san_gong_tribute_count,
              san_gong_tribute_character_date, san_gong_tribute_character_count
       FROM player_events WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const pe = pe2[0] || {};
    const stored = mysqlDateToYmd(pe[kind.dateCol]);
    const used = readDailyUsed(pe, kind, todayStr);
    if (used + ids.length > kind.maxPerDay) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: `今日${kind.label}朝贡额度不足（已用 ${used}/${kind.maxPerDay}，本次选中 ${ids.length} 张）`,
      };
    }

    const [pRows] = await conn.query('SELECT faction_id FROM players WHERE player_id = ? LIMIT 1', [pid]);
    const factionId = pRows[0]?.faction_id;
    if (!factionId) {
      await conn.rollback();
      return { ok: false, status: 400, error: '无势力归属，无法朝贡' };
    }

    const ph = ids.map(() => '?').join(',');
    const [cardRows] = await conn.query(
      `SELECT instance_id, rarity FROM player_cards
       WHERE player_id = ? AND card_type = ? AND instance_id IN (${ph})`,
      [pid, kind.cardType, ...ids],
    );
    if (cardRows.length !== ids.length) {
      await conn.rollback();
      return { ok: false, status: 400, error: `部分${kind.label}卡不存在或已不在背包，请刷新后重试` };
    }

    let totalContribution = 0;
    let legendaryTributeCount = 0;
    for (const c of cardRows) {
      const { contribution } = tributeCompensationPerTroopCard(c.rarity);
      totalContribution += contribution;
      if (String(c.rarity || '').toLowerCase() === 'legendary') {
        legendaryTributeCount += 1;
      }
    }

    const [delRes] = await conn.query(
      `DELETE FROM player_cards WHERE player_id = ? AND card_type = ? AND instance_id IN (${ph})`,
      [pid, kind.cardType, ...ids],
    );
    if (!delRes || delRes.affectedRows !== ids.length) {
      await conn.rollback();
      return { ok: false, status: 400, error: kind.deleteError };
    }

    const newCount = stored === todayStr ? used + ids.length : ids.length;
    await conn.query(
      `UPDATE player_events SET ${kind.dateCol} = ?, ${kind.countCol} = ? WHERE player_id = ?`,
      [todayStr, newCount, pid],
    );

    if (totalContribution > 0) {
      await conn.query('UPDATE players SET contribution = contribution + ? WHERE player_id = ?', [
        totalContribution,
        pid,
      ]);
    }

    const factionReserveService = require('./factionReserveService');
    if (legendaryTributeCount > 0) {
      const legendaryAmounts =
        kind.legendaryField === 'character'
          ? { character: legendaryTributeCount }
          : { troop: legendaryTributeCount };
      await factionReserveService.creditLegendaryQuotaOnConnection(conn, factionId, legendaryAmounts, {
        ledgerCategory: factionReserveService.CATEGORY[kind.legendaryLedger],
      });
    }

    await conn.commit();

    await statisticsDeltaService.recordEarned(pid, {
      ...(totalContribution > 0 ? { contribution: totalContribution } : {}),
    });

    return {
      ok: true,
      cardType: kindKey,
      silver: 0,
      contribution: totalContribution,
      factionSilver: 0,
      factionFood: 0,
      troopLegendaryGranted: kindKey === 'troop' ? legendaryTributeCount : 0,
      characterLegendaryGranted: kindKey === 'character' ? legendaryTributeCount : 0,
      deleted: ids.length,
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_tribute/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少朝贡日限列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongTributeService] submitCardTribute', e);
    return { ok: false, status: 500, error: '朝贡处理失败' };
  } finally {
    conn.release();
  }
}

async function submitTroopTribute(playerId, instanceIds) {
  return submitCardTribute(playerId, instanceIds, 'troop');
}

module.exports = {
  getTributeDailyStatus,
  submitCardTribute,
  submitTroopTribute,
  MAX_TROOP_PER_CALENDAR_DAY,
  MAX_CHARACTER_PER_CALENDAR_DAY,
  MAX_PER_CALENDAR_DAY: MAX_TROOP_PER_CALENDAR_DAY,
};
