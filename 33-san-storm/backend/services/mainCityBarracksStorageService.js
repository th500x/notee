/**
 * 主城驻军所仓库：部队卡转入 / 转出（与编组「军营」池互斥，转出受军营部队张数上限约束）
 */

const { pool } = require('../database/connection');
const { getEligibleBarracksTroopInstanceIds } = require('./playerBarracksTroopPoolService');

const MAX_LINEUP_BARRACKS_TROOPS = 20;

/**
 * @param {string} playerId
 * @param {unknown} bodyIds
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function transferIn(playerId, bodyIds) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (!Array.isArray(bodyIds)) return { ok: false, status: 400, error: 'instanceIds 须为数组' };

  const ids = [...new Set(bodyIds.map((x) => String(x || '').trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, status: 400, error: '未选择部队卡' };

  const eligible = new Set(await getEligibleBarracksTroopInstanceIds(pid));
  for (const id of ids) {
    if (!eligible.has(id)) {
      return { ok: false, status: 400, error: '仅可将当前军营池内的部队转入驻军所仓库（须未上阵、未在驻地槽、次数未满或传奇）' };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const id of ids) {
      const [r] = await conn.query(
        `UPDATE player_cards
         SET main_city_barracks_storage = 1
         WHERE instance_id = ? AND player_id = ?
           AND card_type = 'troop'
           AND IFNULL(is_equipped, 0) = 0
           AND IFNULL(main_city_barracks_storage, 0) = 0`,
        [id, pid],
      );
      if (!r || r.affectedRows !== 1) {
        await conn.rollback();
        return { ok: false, status: 400, error: '转入失败：卡牌状态已变更，请刷新后重试' };
      }
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]main_city_barracks_storage['`]/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error:
          '数据库缺少 main_city_barracks_storage 列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[mainCityBarracksStorageService] transferIn', e);
    return { ok: false, status: 500, error: '转入驻军所仓库失败' };
  } finally {
    conn.release();
  }
}

/**
 * @param {string} playerId
 * @param {unknown} bodyIds
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function transferOut(playerId, bodyIds) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  if (!Array.isArray(bodyIds)) return { ok: false, status: 400, error: 'instanceIds 须为数组' };

  const ids = [...new Set(bodyIds.map((x) => String(x || '').trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, status: 400, error: '未选择部队卡' };

  const poolCount = (await getEligibleBarracksTroopInstanceIds(pid)).length;
  const slotsLeft = MAX_LINEUP_BARRACKS_TROOPS - poolCount;
  if (slotsLeft < ids.length) {
    return {
      ok: false,
      status: 400,
      error:
        slotsLeft <= 0
          ? `军营部队栏已满（${MAX_LINEUP_BARRACKS_TROOPS} 张），无法转出。请先在编组或驻地中整理后再试。`
          : `军营部队栏仅剩 ${slotsLeft} 个空位，当前选中了 ${ids.length} 张，请减少选中张数后重试。`,
    };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const id of ids) {
      const [r] = await conn.query(
        `UPDATE player_cards
         SET main_city_barracks_storage = 0
         WHERE instance_id = ? AND player_id = ?
           AND card_type = 'troop'
           AND IFNULL(main_city_barracks_storage, 0) = 1`,
        [id, pid],
      );
      if (!r || r.affectedRows !== 1) {
        await conn.rollback();
        return { ok: false, status: 400, error: '转出失败：卡牌不在驻军所仓库或状态已变更，请刷新后重试' };
      }
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]main_city_barracks_storage['`]/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error:
          '数据库缺少 main_city_barracks_storage 列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[mainCityBarracksStorageService] transferOut', e);
    return { ok: false, status: 500, error: '转出到军营失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  transferIn,
  transferOut,
  MAX_LINEUP_BARRACKS_TROOPS,
};
