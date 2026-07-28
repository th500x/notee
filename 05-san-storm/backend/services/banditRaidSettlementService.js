/**
 * 匪寨爬塔：战报 `pve_bandit` 胜利后事务内推进 **`bandits`** 与 **`player_progress.bandit_progress`**。
 * 与 `playerBanditRaidQuotaService` 共用 JSON 桶名 **`byBanditMapObjectId`**。
 * 全服耐久扣到上限时：**重置满血**（不关实例）；尾刀者额外黄巾徽章。
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../database/connection');
const campaignService = require('./campaignService');
const { resolveJunIdForBanditPoiId } = require('./playerBanditRaidQuotaService');

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
 * @returns {Promise<{ ok: boolean, error?: string, nextStored?: number, worldRegenerated?: boolean, banditBadgeGranted?: { itemId: string, quantity: number, displayName: string|null }, banditBadgeError?: string }>}
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

  const junId = await resolveJunIdForBanditPoiId(banditPoiId);
  if (!junId) {
    return { ok: false, error: '无法解析匪寨所属郡' };
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
    const prevEntry =
      bp[BUCKET][banditPoiId] && typeof bp[BUCKET][banditPoiId] === 'object'
        ? { ...bp[BUCKET][banditPoiId] }
        : {};
    const rawStored = prevEntry.nextLayer;
    const s0 = Math.floor(Number(rawStored));
    const storedNext = !Number.isFinite(s0) || s0 < 1 || s0 > maxP ? 1 : s0;
    const expectedCombat = banditCombatLayerFromStoredNext(storedNext, maxP);
    if (expectedCombat !== attackedLayer) {
      await conn.rollback();
      return { ok: false, error: '层数与服务器进度不一致' };
    }

    const newStored = banditStoredNextLayerAfterVictory(attackedLayer, maxP);
    const {
      raid: _legacyRaid,
      postTowerStallCompletedAtMs: _stall,
      ...prevClean
    } = prevEntry;
    bp[BUCKET][banditPoiId] = {
      ...prevClean,
      nextLayer: newStored,
    };

    await conn.query(
      `INSERT INTO bandits (bandit_id, jun_id, slot_index, tile_key, max_layers, cleared_layers, status)
       VALUES (?, ?, 0, NULL, 200, 0, 'active')
       ON DUPLICATE KEY UPDATE
         jun_id = IF(COALESCE(jun_id, '') = '', VALUES(jun_id), jun_id),
         max_layers = IF(COALESCE(max_layers, 0) <= 0, 200, max_layers),
         cleared_layers = IF(cleared_layers IS NULL, 0, cleared_layers)`,
      [banditPoiId, junId],
    );

    const [uBand] = await conn.query(
      `UPDATE bandits SET cleared_layers = cleared_layers + 1
       WHERE bandit_id = ? AND status = 'active' AND cleared_layers < max_layers`,
      [banditPoiId],
    );
    if (uBand.affectedRows <= 0) {
      const [checkRows] = await conn.query(
        'SELECT status, cleared_layers, max_layers FROM bandits WHERE bandit_id = ? LIMIT 1',
        [banditPoiId],
      );
      const b = checkRows[0];
      await conn.rollback();
      if (!b) {
        return { ok: false, error: '匪寨世界实例不存在' };
      }
      if (String(b.status || '') !== 'active' || Number(b.cleared_layers) >= Number(b.max_layers)) {
        return { ok: false, error: '匪寨正在重生，请稍后重试' };
      }
      console.error('[banditRaidSettlement] cleared_layers 未推进', {
        playerId,
        banditPoiId,
        attackedLayer,
        status: b.status,
        clearedLayers: b.cleared_layers,
        maxLayers: b.max_layers,
      });
      return { ok: false, error: '匪寨全服耐久推进失败' };
    }

    const [afterRows] = await conn.query(
      'SELECT cleared_layers, max_layers FROM bandits WHERE bandit_id = ? LIMIT 1',
      [banditPoiId],
    );
    const after = afterRows[0];
    const clearedAfter = Number(after?.cleared_layers);
    const maxLayers = Number(after?.max_layers);
    let worldRegenerated = false;
    if (Number.isFinite(clearedAfter) && Number.isFinite(maxLayers) && clearedAfter >= maxLayers) {
      await conn.query(
        `UPDATE bandits
         SET cleared_layers = 0, status = 'active', closed_at = NULL
         WHERE bandit_id = ?`,
        [banditPoiId],
      );
      worldRegenerated = true;
    }

    await conn.query('UPDATE player_progress SET bandit_progress = ? WHERE player_id = ?', [
      JSON.stringify(bp),
      playerId,
    ]);

    await conn.commit();

    let badgeQty = 0;
    if (attackedLayer === maxP) badgeQty += 1;
    if (worldRegenerated) badgeQty += 1;

    let banditBadgeGranted = null;
    let banditBadgeError = null;
    if (badgeQty > 0) {
      try {
        const bg = await campaignService.grantSeasonBadgeToPlayer(playerId, badgeQty);
        if (bg.ok) banditBadgeGranted = bg.badge;
        else banditBadgeError = bg.error || 'badge grant failed';
      } catch (be) {
        banditBadgeError = be.message || 'badge grant failed';
        console.error('[banditRaidSettlement] grantSeasonBadgeToPlayer:', be);
      }
    }

    return {
      ok: true,
      nextStored: newStored,
      worldRegenerated,
      banditBadgeGranted,
      banditBadgeError,
    };
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
