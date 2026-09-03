/**
 * 玩家主城（存卡）：设置 / 更换 cities.city_id
 * 规则：仅大城/中城、须与玩家同势力（城 faction_id = 玩家 faction_id）；
 * 首次（main_city_id IS NULL）免费；再次更换消耗银两 + 24h 冷却。
 */

const { pool } = require('../database/connection');
const statisticsDeltaService = require('./statisticsDeltaService');
const { relocateGarrisonToMainCity } = require('./garrisonService');

const MAIN_CITY_CHANGE_COST_SILVER = 500;
const MAIN_CITY_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const ALLOWED_TYPES = new Set(['city_major', 'city_medium']);

/**
 * @param {string} playerId
 * @param {string} cityId
 * @returns {Promise<{ ok: true, data: object } | { ok: false, status: number, error: string }>}
 */
async function setPlayerMainCity(playerId, cityId) {
  const pid = playerId != null ? String(playerId).trim() : '';
  const cid = cityId != null ? String(cityId).trim() : '';
  if (!pid || !cid) {
    return { ok: false, status: 400, error: '缺少 playerId 或 cityId' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [pRows] = await conn.query(
      `SELECT player_id, faction_id, silver, main_city_id, main_city_changed_at
       FROM players WHERE player_id = ? FOR UPDATE`,
      [pid],
    );
    const player = pRows[0];
    if (!player) {
      await conn.rollback();
      return { ok: false, status: 404, error: '玩家不存在' };
    }

    const [cRows] = await conn.query(
      `SELECT city_id, city_type, faction_id, status
       FROM cities WHERE city_id = ?`,
      [cid],
    );
    const city = cRows[0];
    if (!city) {
      await conn.rollback();
      return { ok: false, status: 404, error: '城市不存在' };
    }

    if (!ALLOWED_TYPES.has(city.city_type)) {
      await conn.rollback();
      return { ok: false, status: 400, error: '仅大城、中城可设为主城' };
    }

    if (!city.faction_id || city.faction_id !== player.faction_id) {
      await conn.rollback();
      return { ok: false, status: 403, error: '仅本势力已占领城池可设为主城' };
    }

    const currentMain = player.main_city_id ? String(player.main_city_id) : null;
    if (currentMain === cid) {
      await conn.commit();
      return {
        ok: true,
        data: {
          main_city_id: cid,
          main_city_changed_at: player.main_city_changed_at,
          silver: Number(player.silver) || 0,
          already: true,
        },
      };
    }

    const now = Date.now();
    const changedAtMs = player.main_city_changed_at
      ? new Date(player.main_city_changed_at).getTime()
      : null;

    if (currentMain != null) {
      const elapsed = changedAtMs != null && !Number.isNaN(changedAtMs) ? now - changedAtMs : MAIN_CITY_CHANGE_COOLDOWN_MS;
      if (elapsed < MAIN_CITY_CHANGE_COOLDOWN_MS) {
        const leftMin = Math.ceil((MAIN_CITY_CHANGE_COOLDOWN_MS - elapsed) / 60000);
        await conn.rollback();
        return {
          ok: false,
          status: 400,
          error: `更换主城冷却中，约 ${leftMin} 分钟后可再次更换`,
        };
      }
      const silver = Number(player.silver) || 0;
      if (silver < MAIN_CITY_CHANGE_COST_SILVER) {
        await conn.rollback();
        return {
          ok: false,
          status: 400,
          error: `银两不足，更换主城需 ${MAIN_CITY_CHANGE_COST_SILVER} 银两`,
        };
      }
      await conn.query(
        `UPDATE players SET
           silver = silver - ?,
           main_city_id = ?,
           main_city_changed_at = NOW()
         WHERE player_id = ?`,
        [MAIN_CITY_CHANGE_COST_SILVER, cid, pid],
      );
      await statisticsDeltaService.incrementSpent(pid, { silver: MAIN_CITY_CHANGE_COST_SILVER });
    } else {
      await conn.query(
        `UPDATE players SET main_city_id = ?, main_city_changed_at = NOW() WHERE player_id = ?`,
        [cid, pid],
      );
    }

    // 驻地编组仅挂主城：迁旧主城行 → 新城，并删除其它城池残留
    await relocateGarrisonToMainCity(conn, pid, currentMain, cid);

    const [after] = await conn.query(
      'SELECT silver, main_city_id, main_city_changed_at FROM players WHERE player_id = ?',
      [pid],
    );
    await conn.commit();

    return {
      ok: true,
      data: {
        main_city_id: after[0]?.main_city_id ?? cid,
        main_city_changed_at: after[0]?.main_city_changed_at ?? null,
        silver: Number(after[0]?.silver) || 0,
        costSilver: currentMain != null ? MAIN_CITY_CHANGE_COST_SILVER : 0,
      },
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    if (e && (e.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(e.message || ''))) {
      return {
        ok: false,
        status: 503,
        error:
          '数据库缺少主城列（main_city_id / main_city_changed_at）。请在 MySQL 执行 33-san-storm/backend/database/migrations 下的 add-players-main-city-id.sql 与 add-players-main-city-changed-at.sql，或在 backend 目录运行：node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[playerMainCityService] setPlayerMainCity', e);
    return { ok: false, status: 500, error: e.message || '设置主城失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  setPlayerMainCity,
  MAIN_CITY_CHANGE_COST_SILVER,
  MAIN_CITY_CHANGE_COOLDOWN_MS,
};
