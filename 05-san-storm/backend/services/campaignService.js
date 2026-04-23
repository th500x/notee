/**
 * 战役：config_campaigns + player_progress.campaign_progress
 * @see docs/10-core-system/16-CAMPAIGN_SYSTEM.md §7–§8
 */

const { pool } = require('../database/connection');
const gameTimeService = require('./gameTimeService');
const Player = require('../models/Player');
const playerItemsService = require('./playerItemsService');
const statisticsDeltaService = require('./statisticsDeltaService');
const {
  CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED,
  CAMPAIGN_MAX_CHALLENGE_PLAYS,
} = require('../config/campaignConfig');

/** 战后综合分 → 评级与倍率（与 16 §7 / 19-1 一致） */
function gradeFromBattleScore(score) {
  const s = Number(score) || 0;
  if (s >= 5000) return { grade: 'S', multiplier: 2.0 };
  if (s >= 3000) return { grade: 'A', multiplier: 1.5 };
  if (s >= 1000) return { grade: 'B', multiplier: 1.2 };
  if (s >= 500) return { grade: 'C', multiplier: 1.0 };
  return { grade: 'D', multiplier: 0.8 };
}

/**
 * 持久化用：在每次战役战报落库时，把 bestScore/bestGrade 写成「runs 里所有胜利局的最高 score」与已有 bestScore 的较大者。
 * 这样即使曾出现字段与 runs 不一致（旧数据、异常 PATCH 等），玩家后续任意一次结算（含败局）也会把最高分写正；领奖只读已存字段即可，无需再算一遍。
 * @param {{ bestScore?: unknown, runs?: Array<{ result?: string, score?: unknown }> }} prog
 * @returns {{ bestScore: number|null, bestGrade: string|null }}
 */
function reconcileCampaignBestFromProg(prog) {
  let maxS = null;
  for (const r of prog.runs || []) {
    if (r?.result !== 'win') continue;
    const s = Number(r.score);
    if (!Number.isFinite(s) || s < 0) continue;
    if (maxS == null || s > maxS) maxS = s;
  }
  const fieldS = prog.bestScore != null ? Number(prog.bestScore) : NaN;
  if (Number.isFinite(fieldS) && fieldS >= 0 && (maxS == null || fieldS > maxS)) {
    maxS = fieldS;
  }
  if (maxS == null) return { bestScore: null, bestGrade: null };
  return { bestScore: maxS, bestGrade: gradeFromBattleScore(maxS).grade };
}

/**
 * 解析 era 如 `184年4月上旬` → 该旬首日游戏历日期
 */
function parseEraToGameDate(era) {
  if (!era || typeof era !== 'string') return null;
  const m = era.trim().match(/^(\d+)年(\d+)月(上旬|中旬|下旬)$/);
  if (!m) return null;
  const day = { 上旬: 1, 中旬: 11, 下旬: 21 }[m[3]];
  if (day == null) return null;
  return { year: Number(m[1]), month: Number(m[2]), day };
}

function compareGameDate(a, b) {
  if (!a || !b) return 0;
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function eraSortKeyFromDate(d) {
  if (!d) return 99999999;
  return d.year * 10000 + d.month * 100 + d.day;
}

/** 战役中心下拉：括号内文案（与 `CampaignCenterPanel` 展示一致） */
function formatEraWithGongyuan(era) {
  const s = era == null ? '' : String(era).trim();
  if (!s) return '待定';
  if (s.startsWith('公元')) return s;
  return `公元${s}`;
}

/** @param {object} def @param {object} prog @param {object | null} gt */
function computeCampaignCenterDropdownParenInner(def, prog, gt) {
  const eraDate = parseEraToGameDate(def.era);
  const cur = gt ? { year: gt.year, month: gt.month, day: gt.day } : null;
  if (cur && eraDate && compareGameDate(cur, eraDate) < 0) {
    return formatEraWithGongyuan(def.era);
  }
  const rewardClaimed = !!prog.rewardClaimed;
  const playCount = Number(prog.playCount) || 0;
  const expired = isCampaignExpired(prog, gt);
  const challengeEnded = rewardClaimed || playCount >= CAMPAIGN_MAX_CHALLENGE_PLAYS || expired;
  if (challengeEnded) {
    return '挑战结束';
  }
  const exp = prog.expiresAfterGameDay;
  const elapsed = gt?.elapsedGameDays;
  if (CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED && exp != null && elapsed != null) {
    const rem = Math.max(0, exp - elapsed);
    if (rem > 0) return `剩余${rem}天`;
  }
  return '挑战开放中';
}

/** 海报文件名：与 Demo 一致，`_v1` 等变种共用同一张图时可去掉后缀 */
function posterFilenameForCampaignId(campaignId) {
  const s = String(campaignId);
  const base = s.replace(/_v\d+$/i, '');
  return `${base}.png`;
}

function parseProgressJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

async function getCampaignProgressMap(playerId) {
  const [rows] = await pool.query(
    'SELECT campaign_progress FROM player_progress WHERE player_id = ?',
    [playerId]
  );
  return parseProgressJson(rows[0]?.campaign_progress);
}

async function saveCampaignProgressMap(playerId, map) {
  await pool.query('UPDATE player_progress SET campaign_progress = ? WHERE player_id = ?', [
    JSON.stringify(map),
    playerId,
  ]);
}

/**
 * 首次解锁时写入 unlock 窗口（7 游戏日，自解锁当日起算）
 */
function syncUnlockFields(defs, gt, progress) {
  let next = { ...progress };
  let changed = false;
  if (!gt) return { next, changed };

  const cur = { year: gt.year, month: gt.month, day: gt.day };

  for (const def of defs) {
    const cid = def.campaign_id;
    const eraDate = parseEraToGameDate(def.era);
    if (!eraDate) continue;
    if (compareGameDate(cur, eraDate) < 0) continue;

    const p = next[cid] || {};
    if (p.unlockGameDay != null) continue;

    next[cid] = {
      ...p,
      unlocked: true,
      unlockGameDay: gt.elapsedGameDays,
      // CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED === true 时写入截止游戏日；false 时不写入（测试关闭七日窗）
      // 正式版：`CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED = true`，此处为：
      //   expiresAfterGameDay: gt.elapsedGameDays + 7
      ...(CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED
        ? { expiresAfterGameDay: gt.elapsedGameDays + 7 }
        : {}),
    };
    changed = true;
  }
  return { next, changed };
}

function isCampaignExpired(prog, gt) {
  // 测试关闭七日窗：不判过期（与 `expiresAfterGameDay` 是否残留无关）
  if (!CAMPAIGN_7DAY_CHALLENGE_WINDOW_ENABLED) return false;
  if (!gt || prog == null) return false;
  const exp = prog.expiresAfterGameDay;
  if (exp == null) return false;
  return gt.elapsedGameDays > exp;
}

async function listDefinitions(season = 'san_1') {
  const [rows] = await pool.query(
    `SELECT campaign_id, season, campaign_name, campaign_type, era, faction,
            max_rounds, min_rounds, completion_reward_silver, completion_reward_food, completion_reward_badge,
            description_1, description_2, description_3, sort_order
     FROM config_campaigns
     WHERE season = ? AND enabled = 1
     ORDER BY sort_order ASC, campaign_id ASC`,
    [season]
  );
  return rows;
}

async function getDefinition(campaignId) {
  const [rows] = await pool.query(
    `SELECT campaign_id, season, campaign_name, campaign_type, era, faction,
            max_rounds, min_rounds, completion_reward_silver, completion_reward_food, completion_reward_badge,
            description_1, description_2, description_3
     FROM config_campaigns WHERE campaign_id = ? AND enabled = 1 LIMIT 1`,
    [campaignId]
  );
  return rows[0] || null;
}

/**
 * 战役中心：合并配置、进度、可玩性；必要时持久化解锁字段
 */
async function getCampaignCenterPayload(playerId, season = 'san_1') {
  const defs = await listDefinitions(season);
  let progress = await getCampaignProgressMap(playerId);
  const gt = await gameTimeService.loadGameTimeForPlayer(playerId);

  const { next, changed } = syncUnlockFields(defs, gt, progress);
  if (changed) {
    progress = next;
    await saveCampaignProgressMap(playerId, progress);
  }

  const cur = gt ? { year: gt.year, month: gt.month, day: gt.day } : null;

  const campaigns = defs.map((def) => {
    const cid = def.campaign_id;
    const prog = progress[cid] || {};
    const eraDate = parseEraToGameDate(def.era);
    const eraUnlocked = cur && eraDate ? compareGameDate(cur, eraDate) >= 0 : false;
    const unlocked = prog.unlockGameDay != null || eraUnlocked;
    const expired = isCampaignExpired(prog, gt);
    const playCount = Number(prog.playCount) || 0;
    const rewardClaimed = !!prog.rewardClaimed;
    const playable =
      unlocked && !expired && !rewardClaimed && playCount < CAMPAIGN_MAX_CHALLENGE_PLAYS;

    return {
      ...def,
      posterFilename: posterFilenameForCampaignId(cid),
      /** 战役中心 `<select>` 选项括号内文案（不含括号） */
      dropdown_paren_inner: computeCampaignCenterDropdownParenInner(def, prog, gt),
      progress: {
        unlocked,
        expired,
        playCount,
        maxPlayCount: CAMPAIGN_MAX_CHALLENGE_PLAYS,
        rewardClaimed,
        playable,
        bestScore: prog.bestScore ?? null,
        bestGrade: prog.bestGrade ?? null,
        runs: Array.isArray(prog.runs) ? prog.runs : [],
        unlockGameDay: prog.unlockGameDay ?? null,
        expiresAfterGameDay: prog.expiresAfterGameDay ?? null,
      },
      eraSortKey: eraSortKeyFromDate(eraDate),
      playable,
    };
  });

  campaigns.sort((a, b) => a.eraSortKey - b.eraSortKey);

  const firstPlayable = campaigns.find((c) => c.playable);
  const autoOpenCampaignId = firstPlayable ? firstPlayable.campaign_id : null;

  return {
    gameTime: gt,
    campaigns,
    autoOpenCampaignId,
  };
}

/**
 * PATCH：按 campaign_id 合并 campaign_progress 中的对象（浅合并该键）
 */
async function patchCampaignProgress(playerId, patchByCampaignId) {
  if (!patchByCampaignId || typeof patchByCampaignId !== 'object') {
    throw new Error('invalid patch');
  }
  const map = await getCampaignProgressMap(playerId);
  for (const [cid, partial] of Object.entries(patchByCampaignId)) {
    if (!cid || typeof partial !== 'object') continue;
    map[cid] = { ...(map[cid] || {}), ...partial };
  }
  await saveCampaignProgressMap(playerId, map);
  return map;
}

/**
 * pve_campaign 战后更新进度（不计发奖；领奖走 claimCampaignReward）
 */
async function applyBattleSettlement({
  playerId,
  campaignId,
  battleId,
  result,
  battleScore,
}) {
  if (!campaignId || !playerId || !battleId) return { ok: false, reason: 'missing fields' };

  const def = await getDefinition(campaignId);
  if (!def) return { ok: false, reason: 'unknown campaign' };

  const gt = await gameTimeService.loadGameTimeForPlayer(playerId);
  let progress = await getCampaignProgressMap(playerId);
  const { next: synced } = syncUnlockFields([def], gt, progress);
  progress = synced;

  const prog = progress[campaignId] || {};
  const eraDate = parseEraToGameDate(def.era);
  if (gt && eraDate) {
    const cur = { year: gt.year, month: gt.month, day: gt.day };
    if (compareGameDate(cur, eraDate) < 0) {
      return { ok: false, reason: 'campaign locked' };
    }
  }

  if (prog.rewardClaimed) return { ok: false, reason: 'already claimed' };
  if (isCampaignExpired(prog, gt)) {
    progress[campaignId] = { ...prog, expired: true };
    await saveCampaignProgressMap(playerId, progress);
    return { ok: false, reason: 'expired' };
  }

  const playCount = Number(prog.playCount) || 0;
  if (playCount >= CAMPAIGN_MAX_CHALLENGE_PLAYS) return { ok: false, reason: 'no plays left' };

  const scoreNum = Number(battleScore);
  const { grade } = Number.isFinite(scoreNum) ? gradeFromBattleScore(scoreNum) : { grade: 'D' };
  const playedAt = new Date().toISOString();
  const runEntry = {
    score: Number.isFinite(scoreNum) ? scoreNum : 0,
    grade,
    battleId,
    result: result || 'lose',
    playedAt,
  };

  const runs = Array.isArray(prog.runs) ? [...prog.runs, runEntry] : [runEntry];
  const candidate = { ...prog, playCount: playCount + 1, runs };
  const { bestScore, bestGrade } = reconcileCampaignBestFromProg(candidate);

  const newProg = {
    ...prog,
    playCount: playCount + 1,
    runs,
    bestScore,
    bestGrade,
  };

  progress[campaignId] = newProg;
  await saveCampaignProgressMap(playerId, progress);

  return { ok: true, progress: newProg };
}

/**
 * completion_reward_badge 非空 → 发放赛季徽章道具（config_items / players.items JSON，与事件奖励道具同列）
 * 数字槽位仅用于卡牌展示与策划对照，当前赛季对应 item_season_badge。
 */
function resolveCampaignBadgeItemId(completionRewardBadge) {
  const raw = completionRewardBadge == null ? '' : String(completionRewardBadge).trim();
  if (!raw) return null;
  return 'item_season_badge';
}

async function getItemDisplayName(itemId) {
  if (!itemId) return null;
  const [rows] = await pool.query('SELECT item_name FROM config_items WHERE item_id = ? LIMIT 1', [itemId]);
  return rows[0]?.item_name || itemId;
}

/**
 * 按各次挑战中的最高分（bestScore）发奖并标记 rewardClaimed
 */
/**
 * 与 `claimCampaignReward` 中徽章发放同源：`resolveCampaignBadgeItemId` → **`item_season_badge`** + `playerItemsService.addItem`。
 * 匪寨通关第 20 层等场景复用（不经 `campaign_progress` 领奖状态机）。
 * @param {string} playerId
 * @param {number} [quantity]
 * @returns {Promise<{ ok: boolean, error?: string, badge?: { itemId: string, quantity: number, displayName: string|null } }>}
 */
async function grantSeasonBadgeToPlayer(playerId, quantity = 1) {
  const q = Math.max(1, Math.floor(Number(quantity)) || 1);
  const itemId = resolveCampaignBadgeItemId('1');
  if (!itemId) return { ok: false, error: 'no badge item' };
  const addRes = await playerItemsService.addItem(playerId, itemId, q);
  if (!addRes.ok) return { ok: false, error: addRes.error || 'badge grant failed' };
  const displayName = await getItemDisplayName(itemId);
  return { ok: true, badge: { itemId, quantity: q, displayName } };
}

async function claimCampaignReward(playerId, campaignId) {
  const def = await getDefinition(campaignId);
  if (!def) return { ok: false, error: 'unknown campaign' };

  const progress = await getCampaignProgressMap(playerId);
  const prog = progress[campaignId] || {};
  if (prog.rewardClaimed) return { ok: false, error: 'already claimed' };
  const playCount = Number(prog.playCount) || 0;
  if (playCount < 1) return { ok: false, error: 'no completed run' };

  const best = prog.bestScore != null ? Number(prog.bestScore) : null;
  if (best == null || !Number.isFinite(best) || best < 0) {
    return { ok: false, error: 'no valid best score' };
  }

  const { multiplier, grade } = gradeFromBattleScore(best);
  const silver = Math.floor(Number(def.completion_reward_silver) * multiplier);
  const food = Math.floor(Number(def.completion_reward_food) * multiplier);
  const badgeItemId = resolveCampaignBadgeItemId(def.completion_reward_badge);
  /** 与 §7 银两/粮草一致：基准 1 枚 × 档位倍率；D 档 0.8 → floor 为 0 不发徽章 */
  const badgeQty =
    badgeItemId != null ? Math.max(0, Math.floor(1 * multiplier)) : 0;

  await Player.updateResources(playerId, { silver, food });

  let badgeGranted = null;
  if (badgeItemId && badgeQty > 0) {
    const addRes = await playerItemsService.addItem(playerId, badgeItemId, badgeQty);
    if (!addRes.ok) {
      try {
        await Player.updateResources(playerId, { silver: -silver, food: -food });
      } catch (rollbackErr) {
        console.error('[campaign] claim rollback resources failed:', rollbackErr);
      }
      return { ok: false, error: addRes.error || 'badge grant failed' };
    }
    const displayName = await getItemDisplayName(badgeItemId);
    badgeGranted = { itemId: badgeItemId, quantity: badgeQty, displayName };
  }

  progress[campaignId] = {
    ...prog,
    bestScore: best,
    bestGrade: grade,
    rewardClaimed: true,
    rewardClaimedAt: new Date().toISOString(),
    rewardSilverGranted: silver,
    rewardFoodGranted: food,
    ...(badgeItemId && badgeQty > 0
      ? { rewardBadgeItemId: badgeItemId, rewardBadgeQty: badgeQty }
      : {}),
  };
  await saveCampaignProgressMap(playerId, progress);

  await statisticsDeltaService.recordEarned(playerId, { silver, food });

  return {
    ok: true,
    granted: {
      silver,
      food,
      grade,
      bestScore: best,
      bestGrade: grade,
      ...(badgeGranted ? { badge: badgeGranted } : {}),
    },
  };
}

module.exports = {
  gradeFromBattleScore,
  parseEraToGameDate,
  posterFilenameForCampaignId,
  listDefinitions,
  getDefinition,
  getCampaignProgressMap,
  getCampaignCenterPayload,
  patchCampaignProgress,
  applyBattleSettlement,
  claimCampaignReward,
  grantSeasonBadgeToPlayer,
};
