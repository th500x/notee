/**
 * 章节战棋：config_chapters* + player_progress.chapter_progress
 * @see docs/02-chapter-tactical/60-1 · 60-3 Phase 2
 */

const { pool } = require('../database/connection');
const Player = require('../models/Player');
const statisticsDeltaService = require('./statisticsDeltaService');
const {
  getTacticTokenCount,
  tryConsumeTacticTokenOnce,
  refundTacticTokenOnce,
} = require('./tacticTokenService');

function parseJson(raw, fallback = {}) {
  if (raw == null) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  return typeof raw === 'object' ? raw : fallback;
}

function parseProgressMap(raw) {
  return parseJson(raw, {});
}

async function getChapterProgressMap(playerId) {
  const [rows] = await pool.query(
    'SELECT chapter_progress FROM player_progress WHERE player_id = ?',
    [playerId],
  );
  if (!rows[0]) {
    await pool.query(
      'INSERT IGNORE INTO player_progress (player_id, chapter_progress) VALUES (?, ?)',
      [playerId, JSON.stringify({})],
    );
    return {};
  }
  return parseProgressMap(rows[0].chapter_progress);
}

async function saveChapterProgressMap(playerId, map) {
  await pool.query(
    `INSERT INTO player_progress (player_id, chapter_progress) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE chapter_progress = VALUES(chapter_progress)`,
    [playerId, JSON.stringify(map)],
  );
}

function splitNextIds(node) {
  const out = [];
  if (node.next_node_id) out.push(String(node.next_node_id).trim());
  if (node.next_node_ids) {
    for (const p of String(node.next_node_ids).split(/[;|]/)) {
      const id = p.trim();
      if (id) out.push(id);
    }
  }
  return [...new Set(out.filter(Boolean))];
}

/** 由 next 边反推：nodeId → 前驱列表 */
function buildIncomingMap(nodes) {
  const incoming = new Map();
  for (const n of nodes) incoming.set(n.node_id, []);
  for (const n of nodes) {
    for (const nxt of splitNextIds(n)) {
      if (!incoming.has(nxt)) incoming.set(nxt, []);
      incoming.get(nxt).push(n.node_id);
    }
  }
  return incoming;
}

function ensureChapterProg(progress, chapterId) {
  const cur = progress[chapterId] || {};
  return {
    status: cur.status || 'in_progress',
    completed_nodes: Array.isArray(cur.completed_nodes) ? [...cur.completed_nodes] : [],
    nodes: cur.nodes && typeof cur.nodes === 'object' ? { ...cur.nodes } : {},
    chapter_reward_claimed: !!cur.chapter_reward_claimed,
  };
}

function isNodeCleared(prog, nodeId) {
  const st = prog.nodes?.[nodeId]?.status;
  if (st === 'cleared') return true;
  return (prog.completed_nodes || []).includes(nodeId);
}

function resolveNodeUiStatus(nodeId, prog, incomingMap) {
  if (isNodeCleared(prog, nodeId)) return 'cleared';
  const preds = incomingMap.get(nodeId) || [];
  if (preds.length === 0) return 'playable';
  const allPredsCleared = preds.every((p) => isNodeCleared(prog, p));
  return allPredsCleared ? 'playable' : 'locked';
}

async function listChapters(season = 'san_1') {
  const [rows] = await pool.query(
    `SELECT chapter_id, season, chapter_name, era, description, completion_rewards, sort_order
     FROM config_chapters WHERE season = ? AND enabled = 1
     ORDER BY sort_order ASC, chapter_id ASC`,
    [season],
  );
  return rows;
}

async function listNodes(chapterId) {
  const [rows] = await pool.query(
    `SELECT node_id, chapter_id, sort_order, node_type, ref_id, next_node_id, next_node_ids,
            lineup_slots_override, entry_token_cost, notes
     FROM config_chapter_nodes WHERE chapter_id = ?
     ORDER BY sort_order ASC, node_id ASC`,
    [chapterId],
  );
  return rows;
}

async function getNode(nodeId) {
  const [rows] = await pool.query(
    `SELECT node_id, chapter_id, sort_order, node_type, ref_id, next_node_id, next_node_ids,
            lineup_slots_override, entry_token_cost, notes
     FROM config_chapter_nodes WHERE node_id = ? LIMIT 1`,
    [nodeId],
  );
  return rows[0] || null;
}

async function getStage(stageId) {
  const [rows] = await pool.query(
    `SELECT * FROM config_chapter_stages WHERE stage_id = ? LIMIT 1`,
    [stageId],
  );
  return rows[0] || null;
}

async function getStory(storyId) {
  const [rows] = await pool.query(
    `SELECT story_id, chapter_id, title, lines_json, notes
     FROM config_chapter_stories WHERE story_id = ? LIMIT 1`,
    [storyId],
  );
  return rows[0] || null;
}

async function getChapter(chapterId) {
  const [rows] = await pool.query(
    `SELECT chapter_id, season, chapter_name, era, description, completion_rewards, sort_order
     FROM config_chapters WHERE chapter_id = ? AND enabled = 1 LIMIT 1`,
    [chapterId],
  );
  return rows[0] || null;
}

function formatStageForClient(row) {
  if (!row) return null;
  return {
    stageId: row.stage_id,
    stageName: row.stage_name,
    chapterId: row.chapter_id,
    mapW: row.map_w,
    mapH: row.map_h,
    lineupSlots: row.lineup_slots,
    deployPattern: row.deploy_pattern,
    terrainBrief: row.terrain_brief,
    terrainRatios: row.terrain_ratios,
    enemyRoster: row.enemy_roster,
    allyRoster: row.ally_roster,
    maxRounds: row.max_rounds,
    minRounds: row.min_rounds,
    winCondition: parseJson(row.win_condition, null),
    loseCondition: parseJson(row.lose_condition, null),
    rewardSilver: row.reward_silver,
    rewardFood: row.reward_food,
    mapRef: row.map_ref,
    mapSeed: row.map_seed,
  };
}

function formatStoryForClient(row) {
  if (!row) return null;
  return {
    storyId: row.story_id,
    chapterId: row.chapter_id,
    title: row.title,
    lines: parseJson(row.lines_json, []),
  };
}

/**
 * GET center：章节列表 + 节点态 + 兵符
 */
async function getChapterCenterPayload(playerId, season = 'san_1') {
  const chapters = await listChapters(season);
  const progress = await getChapterProgressMap(playerId);
  const tacticTokens = await getTacticTokenCount(playerId);

  const out = [];
  for (const ch of chapters) {
    const nodes = await listNodes(ch.chapter_id);
    const incoming = buildIncomingMap(nodes);
    const prog = ensureChapterProg(progress, ch.chapter_id);
    const nodeViews = nodes.map((n) => {
      const status = resolveNodeUiStatus(n.node_id, prog, incoming);
      const nodeProg = prog.nodes[n.node_id] || {};
      return {
        nodeId: n.node_id,
        sortOrder: n.sort_order,
        nodeType: n.node_type,
        refId: n.ref_id,
        nextNodeId: n.next_node_id || null,
        nextNodeIds: n.next_node_ids
          ? String(n.next_node_ids)
              .split(/[;|]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        entryTokenCost: Number(n.entry_token_cost) || 0,
        status,
        clearCount: Number(nodeProg.clear_count) || 0,
        bestStars: Number(nodeProg.best_stars) || 0,
        notes: n.notes || null,
      };
    });
    out.push({
      chapterId: ch.chapter_id,
      chapterName: ch.chapter_name,
      era: ch.era,
      description: ch.description,
      completionRewards: parseJson(ch.completion_rewards, {}),
      chapterRewardClaimed: !!prog.chapter_reward_claimed,
      canClaimReward:
        !prog.chapter_reward_claimed &&
        nodes.length > 0 &&
        nodes.every((n) => isNodeCleared(prog, n.node_id)),
      nodes: nodeViews,
    });
  }

  return { success: true, tacticTokens, chapters: out };
}

/**
 * 开战 / 开剧情：未通关战斗扣兵符
 */
async function startNode(playerId, chapterId, nodeId) {
  const node = await getNode(nodeId);
  if (!node || node.chapter_id !== chapterId) {
    return { ok: false, error: '节点不存在' };
  }
  const nodes = await listNodes(chapterId);
  const incoming = buildIncomingMap(nodes);
  const progress = await getChapterProgressMap(playerId);
  const prog = ensureChapterProg(progress, chapterId);
  const uiStatus = resolveNodeUiStatus(nodeId, prog, incoming);
  if (uiStatus === 'locked') {
    return { ok: false, error: '前序节点未通关' };
  }

  const cleared = uiStatus === 'cleared';
  const cost = Math.max(0, Math.floor(Number(node.entry_token_cost) || 0));
  let tokenCharged = 0;

  if (node.node_type === 'battle' && !cleared && cost > 0) {
    const ok = await tryConsumeTacticTokenOnce(playerId, null, cost);
    if (!ok) {
      return { ok: false, error: '兵符不足', code: 'NO_TACTIC_TOKEN' };
    }
    tokenCharged = cost;
  }

  try {
    if (node.node_type === 'story') {
      const story = await getStory(node.ref_id);
      if (!story) {
        if (tokenCharged) await refundTacticTokenOnce(playerId, null, tokenCharged);
        return { ok: false, error: '剧情配置缺失' };
      }
      return {
        ok: true,
        nodeType: 'story',
        cleared,
        tokenCharged: 0,
        tacticTokens: await getTacticTokenCount(playerId),
        story: formatStoryForClient(story),
      };
    }

    if (node.node_type === 'battle') {
      const stage = await getStage(node.ref_id);
      if (!stage) {
        if (tokenCharged) await refundTacticTokenOnce(playerId, null, tokenCharged);
        return { ok: false, error: '关卡配置缺失' };
      }
      return {
        ok: true,
        nodeType: 'battle',
        cleared,
        tokenCharged,
        tacticTokens: await getTacticTokenCount(playerId),
        stage: formatStageForClient(stage),
        lineupSlots: node.lineup_slots_override || stage.lineup_slots || 'main',
      };
    }

    if (tokenCharged) await refundTacticTokenOnce(playerId, null, tokenCharged);
    return { ok: false, error: `未知节点类型: ${node.node_type}` };
  } catch (e) {
    if (tokenCharged) {
      try {
        await refundTacticTokenOnce(playerId, null, tokenCharged);
      } catch (re) {
        console.error('[chapter] startNode refund failed:', re);
      }
    }
    throw e;
  }
}

function markNodeCleared(prog, nodeId) {
  const completed = new Set(prog.completed_nodes || []);
  completed.add(nodeId);
  const prev = prog.nodes[nodeId] || {};
  prog.nodes[nodeId] = {
    ...prev,
    status: 'cleared',
    clear_count: (Number(prev.clear_count) || 0) + 1,
    best_stars: Number(prev.best_stars) || 0,
  };
  prog.completed_nodes = [...completed];
  return prog;
}

/**
 * 剧情播完 / 显式完成节点
 */
async function completeNode(playerId, chapterId, nodeId) {
  const node = await getNode(nodeId);
  if (!node || node.chapter_id !== chapterId) {
    return { ok: false, error: '节点不存在' };
  }
  const nodes = await listNodes(chapterId);
  const incoming = buildIncomingMap(nodes);
  const progress = await getChapterProgressMap(playerId);
  const prog = ensureChapterProg(progress, chapterId);
  const uiStatus = resolveNodeUiStatus(nodeId, prog, incoming);
  if (uiStatus === 'locked') {
    return { ok: false, error: '前序节点未通关' };
  }

  // 战斗胜负应由战报结算；剧情可在此完成；已通关重播剧情也允许再标 cleared（clear_count+1）
  if (node.node_type === 'battle' && uiStatus !== 'cleared') {
    return { ok: false, error: '战斗节点须经战报胜利结算' };
  }

  markNodeCleared(prog, nodeId);
  if (nodes.every((n) => isNodeCleared(prog, n.node_id))) {
    prog.status = 'cleared';
  }
  progress[chapterId] = prog;
  await saveChapterProgressMap(playerId, progress);
  return { ok: true, progress: prog };
}

/**
 * pve_chapter 战后：仅胜利推进节点；失败不改进度、不退兵符
 */
async function applyBattleSettlement({ playerId, chapterId, nodeId, battleId, result }) {
  if (!playerId || !chapterId || !nodeId || !battleId) {
    return { ok: false, reason: 'missing fields' };
  }
  const node = await getNode(nodeId);
  if (!node || node.chapter_id !== chapterId || node.node_type !== 'battle') {
    return { ok: false, reason: 'invalid node' };
  }
  if (result !== 'win') {
    return { ok: true, advanced: false };
  }

  const progress = await getChapterProgressMap(playerId);
  const prog = ensureChapterProg(progress, chapterId);
  markNodeCleared(prog, nodeId);
  const nodes = await listNodes(chapterId);
  if (nodes.every((n) => isNodeCleared(prog, n.node_id))) {
    prog.status = 'cleared';
  }
  progress[chapterId] = prog;
  await saveChapterProgressMap(playerId, progress);
  return { ok: true, advanced: true, progress: prog };
}

async function claimChapterReward(playerId, chapterId) {
  const ch = await getChapter(chapterId);
  if (!ch) return { ok: false, error: '章节不存在' };
  const nodes = await listNodes(chapterId);
  const progress = await getChapterProgressMap(playerId);
  const prog = ensureChapterProg(progress, chapterId);
  if (prog.chapter_reward_claimed) return { ok: false, error: 'already claimed' };
  if (!nodes.length || !nodes.every((n) => isNodeCleared(prog, n.node_id))) {
    return { ok: false, error: '章节未全部通关' };
  }

  const rewards = parseJson(ch.completion_rewards, {});
  const silver = Math.max(0, Math.floor(Number(rewards.silver) || 0));
  const food = Math.max(0, Math.floor(Number(rewards.food) || 0));
  if (silver > 0 || food > 0) {
    await Player.updateResources(playerId, { silver, food });
    await statisticsDeltaService.recordEarned(playerId, { silver, food });
  }

  prog.chapter_reward_claimed = true;
  prog.chapter_reward_claimed_at = new Date().toISOString();
  prog.reward_silver_granted = silver;
  prog.reward_food_granted = food;
  progress[chapterId] = prog;
  await saveChapterProgressMap(playerId, progress);

  return { ok: true, granted: { silver, food } };
}

module.exports = {
  getChapterCenterPayload,
  startNode,
  completeNode,
  applyBattleSettlement,
  claimChapterReward,
  getChapterProgressMap,
  formatStageForClient,
};
