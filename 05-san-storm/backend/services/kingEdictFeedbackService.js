/**
 * 大地图「口谕」👍👎 嘉奖：按 20 分钟槽 + `scope`（`casual` / `active_war`）进程内幂等，写 `players` 资源 + 统计累计。
 *
 * @see docs/40-ai/41-1-AI_KING_SYSTEM.md ·「口谕互动嘉奖」
 */

const Player = require('../models/Player');
const { recordEarned } = require('./statisticsDeltaService');

/** 与 `game/src/components/game/KingEdictPanel.jsx` · `getSlotBoundaryKey` 同口径 */
function getSlotBoundaryKey(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = d.getHours();
  const slot = Math.floor(d.getMinutes() / 20);
  return `${y}-${mo}-${da}_${h}_${slot}`;
}

function randomIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** @type {Map<string, number>} key → 领取时刻 ms（仅用于 prune） */
const claimedAtByKey = new Map();

/**
 * @param {'casual'|'active_war'} scope - 闲聊口谕与「主动战事口谕」分轨幂等，避免同槽领过闲聊后无法再领战事嘉奖
 */
function claimKey(playerId, slotKey, scope = 'casual') {
  const s = scope === 'active_war' ? 'active_war' : 'casual';
  return `${String(playerId).trim()}|${slotKey}|${s}`;
}

function pruneClaimsIfNeeded() {
  if (claimedAtByKey.size < 8000) return;
  const now = Date.now();
  const ttl = 48 * 3600 * 1000;
  for (const [k, at] of claimedAtByKey) {
    if (now - at > ttl) claimedAtByKey.delete(k);
  }
  if (claimedAtByKey.size > 5000) claimedAtByKey.clear();
}

function buildRewardMessage(reaction, silverAdded, reputationAdded) {
  if (reaction === 'up') {
    return `龙颜欣然，赐银 ${silverAdded} 两。`;
  }
  if (reputationAdded > 0) {
    return `蒙赐声望 ${reputationAdded} 点。`;
  }
  return '此番未蒙声望之赐。';
}

/**
 * @param {string} playerId
 * @param {'up'|'down'} reaction
 * @param {{ scope?: 'casual'|'active_war' }} [opts]
 * @returns {Promise<{ ok: true, data: { slotKey, reaction, silverAdded?: number, reputationAdded?: number, message: string } } | { ok: false, status: number, error: string }>}
 */
async function submitKingEdictFeedback(playerId, reaction, opts = {}) {
  const pid = playerId != null ? String(playerId).trim() : '';
  if (!pid) {
    return { ok: false, status: 400, error: '缺少玩家标识' };
  }
  if (reaction !== 'up' && reaction !== 'down') {
    return { ok: false, status: 400, error: 'reaction 须为 up 或 down' };
  }
  const scope = opts.scope === 'active_war' ? 'active_war' : 'casual';

  const slotKey = getSlotBoundaryKey();
  const k = claimKey(pid, slotKey, scope);
  pruneClaimsIfNeeded();

  if (claimedAtByKey.has(k)) {
    return { ok: false, status: 409, error: '本时段口谕嘉奖已领过，请勿重复。' };
  }

  claimedAtByKey.set(k, Date.now());
  let silverAdded = 0;
  let reputationAdded = 0;
  try {
    if (reaction === 'up') {
      silverAdded = randomIntInclusive(20, 60);
      await Player.updateResources(pid, { silver: silverAdded });
      await recordEarned(pid, { silver: silverAdded });
    } else {
      reputationAdded = randomIntInclusive(0, 2);
      if (reputationAdded > 0) {
        await Player.updateResources(pid, { reputation: reputationAdded });
        await recordEarned(pid, { reputation: reputationAdded });
      }
    }
  } catch (e) {
    claimedAtByKey.delete(k);
    throw e;
  }

  const message = buildRewardMessage(reaction, silverAdded, reputationAdded);
  return {
    ok: true,
    data: {
      slotKey,
      scope,
      reaction,
      ...(reaction === 'up' ? { silverAdded } : { reputationAdded }),
      message,
    },
  };
}

module.exports = {
  getSlotBoundaryKey,
  submitKingEdictFeedback,
};
