/**
 * 匪寨爬塔：战报 `pve_bandit` 胜利后事务内推进 **`bandits`** 与 **`player_progress.bandit_progress`**。
 * 与 `playerBanditRaidQuotaService` 共用 JSON 桶名 **`byBanditMapObjectId`**。
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const campaignService = require('./campaignService');

const BUCKET = 'byBanditMapObjectId';
const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

let rewardsModPromise = null;
function loadBanditRaidRewards() {
  if (!rewardsModPromise) {
    const fp = path.join(__dirname, '../../shared/utils/banditRaidLayerRewards.js');
    rewardsModPromise = import(pathToFileURL(fp).href);
  }
  return rewardsModPromise;
}

function parseBanditProgress(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return { ...raw };
  return {};
}

/**
 * @param {string} playerId
 * @param {{ banditPoiId: string, attackedLayer: number }} payload
 * @returns {Promise<{ ok: boolean, error?: string, nextStored?: number, banditBadgeGranted?: { itemId: string, quantity: number, displayName: string|null }, banditBadgeError?: string }>}
 */
async function applyBanditRaidVictory(playerId, payload) {
  const banditPoiId = String(payload?.banditPoiId || '').trim();
  const attackedLayer = Math.floor(Number(payload?.attackedLayer));
  if (!BANDIT_MAP_OBJECT_ID_RE.test(banditPoiId)) {
    return { ok: false, error: '无效的匪寨地图对象 ID' };
  }
  if (!Number.isFinite(attackedLayer) || attackedLayer < 1) {
    return { ok: false, error: '无效的 attackedLayer' };
  }

  const { BANDIT_PERSONAL_TOTAL_LAYERS, banditCombatLayerFromStoredNext, banditStoredNextLayerAfterVictory } =
    await loadBanditRaidRewards();
  const maxP = Math.max(1, Math.floor(Number(BANDIT_PERSONAL_TOTAL_LAYERS)) || 20);
  if (attackedLayer > maxP) {
    return { ok: false, error: '层数越界' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT bandit_progress FROM player_progress WHERE player_id = ? FOR UPDATE',
      [playerId],
    );
    const row = rows[0] || {};
    const bp = parseBanditProgress(row.bandit_progress);
    if (!bp[BUCKET] || typeof bp[BUCKET] !== 'object') bp[BUCKET] = {};
    const prevEntry = bp[BUCKET][banditPoiId] && typeof bp[BUCKET][banditPoiId] === 'object' ? { ...bp[BUCKET][banditPoiId] } : {};
    const rawStored = prevEntry.nextLayer;
    const s0 = Math.floor(Number(rawStored));
    const storedNext =
      !Number.isFinite(s0) || s0 < 1 ? 1 : Math.min(maxP + 1, Math.max(1, s0));
    const expectedCombat = banditCombatLayerFromStoredNext(storedNext, maxP);
    if (expectedCombat == null) {
      await conn.rollback();
      return { ok: false, error: '匪寨个人进度已通关' };
    }
    if (expectedCombat !== attackedLayer) {
      await conn.rollback();
      return { ok: false, error: '层数与服务器进度不一致' };
    }

    const newStored = banditStoredNextLayerAfterVictory(attackedLayer, maxP);
    const { raid: _legacyRaid, ...prevWithoutRaid } = prevEntry;
    bp[BUCKET][banditPoiId] = {
      ...prevWithoutRaid,
      nextLayer: newStored,
    };

    const [uBand] = await conn.query(
      `UPDATE bandits SET cleared_layers = cleared_layers + 1
       WHERE bandit_id = ? AND status = 'active' AND cleared_layers < max_layers`,
      [banditPoiId],
    );
    if (uBand.affectedRows > 0) {
      await conn.query(
        `UPDATE bandits SET status = 'closed', closed_at = NOW()
         WHERE bandit_id = ? AND cleared_layers >= max_layers`,
        [banditPoiId],
      );
    }

    await conn.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
      JSON.stringify(bp),
      playerId,
    ]);

    await conn.commit();

    let banditBadgeGranted = null;
    let banditBadgeError = null;
    if (attackedLayer === maxP) {
      try {
        const bg = await campaignService.grantSeasonBadgeToPlayer(playerId, 1);
        if (bg.ok) banditBadgeGranted = bg.badge;
        else banditBadgeError = bg.error || 'badge grant failed';
      } catch (be) {
        banditBadgeError = be.message || 'badge grant failed';
        console.error('[banditRaidSettlement] grantSeasonBadgeToPlayer:', be);
      }
    }

    return { ok: true, nextStored: newStored, banditBadgeGranted, banditBadgeError };
  } catch (e) {
    await conn.rollback();
    return { ok: false, error: e.message || '匪寨结算失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  applyBanditRaidVictory,
};
