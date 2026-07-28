/**
 * 章节战棋 · 可变尺寸程序生图（须与 chapterStageMapGenerator.cjs 同步）
 *
 * 入参 map_w×map_h；产出与战役战斗兼容的 cells（供 buildCampaignBattleMapResult）。
 * 连通失败挖廊道 / 换 seed；超限抛错（禁止静默坏图）。
 *
 * @see docs/02-chapter-tactical/60-1-CHAPTER_TACTICAL_SYSTEM.md §14
 */

import { resolveChapterDeployRects } from './chapterDeployPatterns.js';
import { parseChapterStageRoster, parseTerrainRatios } from './chapterStageRoster.js';

const BLOCKING = new Set(['river', 'lake']);
const MAX_SEED_TRIES = 24;

/**
 * @param {number} seed
 * @returns {() => number}
 */
export function createChapterSeededRng(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStageSeed(stageId, mapSeed) {
  if (mapSeed != null && mapSeed !== '' && Number.isFinite(Number(mapSeed))) {
    return Number(mapSeed) >>> 0;
  }
  const str = String(stageId || 'chapter_stage');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function emptyCell(col, row) {
  return {
    col,
    row,
    base: 'plain_grassland',
    terrain: '',
    object: '',
    effect: '',
  };
}

function isBlockingTerrain(t) {
  return BLOCKING.has(String(t || ''));
}

function cellPassable(cell) {
  if (!cell) return false;
  if (isBlockingTerrain(cell.terrain)) return false;
  if (cell.object) return false;
  return true;
}

/**
 * 3×3 分区索引 0..8（左上=0 … 右下=8）
 */
function regionIndex(col, row, w, h) {
  const cx = Math.min(2, Math.floor((col / Math.max(1, w)) * 3));
  const cy = Math.min(2, Math.floor((row / Math.max(1, h)) * 3));
  return cy * 3 + cx;
}

/**
 * 从白话 brief 推断地形偏好分区
 * @returns {Record<string, number[]>} terrain -> region indices
 */
function briefRegionBias(brief) {
  const t = String(brief || '');
  const bias = {
    hill: [],
    forest: [],
    river: [],
    wasteland: [],
  };
  if (/左上|西北/.test(t) && /山|丘/.test(t)) bias.hill.push(0);
  if (/右上|东北/.test(t) && /山|丘/.test(t)) bias.hill.push(2);
  if (/左下|西南/.test(t) && /山|丘/.test(t)) bias.hill.push(6);
  if (/右下|东南/.test(t) && /山|丘/.test(t)) bias.hill.push(8);
  if (/中部|中央/.test(t) && /山|丘|冈/.test(t)) bias.hill.push(4);
  if (/北/.test(t) && /林|树/.test(t)) bias.forest.push(1);
  if (/南/.test(t) && /林|树/.test(t)) bias.forest.push(7);
  if (/右/.test(t) && /林|树/.test(t)) bias.forest.push(2, 5, 8);
  if (/左/.test(t) && /林|树/.test(t)) bias.forest.push(0, 3, 6);
  if (/中/.test(t) && /河|川/.test(t)) bias.river.push(3, 4, 5);
  if (/穿/.test(t) && /河/.test(t)) bias.river.push(3, 4, 5);
  if (/枯草|荒|营/.test(t)) bias.wasteland.push(4, 5, 7, 8);
  return bias;
}

function listCellsInRegions(w, h, regions) {
  const set = new Set(regions);
  const out = [];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (set.has(regionIndex(col, row, w, h))) out.push({ col, row });
    }
  }
  return out;
}

function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function paintTerrain(cells, w, h, ratios, brief, rng, avoidRects) {
  const total = w * h;
  const bias = briefRegionBias(brief);
  const avoid = new Set();
  for (const rect of avoidRects || []) {
    if (!rect) continue;
    for (let r = rect.rowMin; r <= rect.rowMax; r++) {
      for (let c = rect.colMin; c <= rect.colMax; c++) {
        avoid.add(`${c},${r}`);
      }
    }
  }

  const order = ['river', 'hill', 'forest', 'wasteland'];
  for (const key of order) {
    const pct = ratios[key];
    if (!(pct > 0)) continue;
    const need = Math.max(0, Math.round((pct / 100) * total));
    if (need <= 0) continue;
    const preferred = listCellsInRegions(w, h, bias[key]?.length ? bias[key] : [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const pool = shuffle(
      rng,
      preferred.filter((p) => !avoid.has(`${p.col},${p.row}`)),
    );
    let painted = 0;
    for (const p of pool) {
      if (painted >= need) break;
      const cell = cells[p.row][p.col];
      if (cell.terrain) continue;
      if (key === 'wasteland') {
        cell.base = 'plain_wasteland';
        cell.terrain = '';
      } else if (key === 'river') {
        cell.terrain = 'river';
      } else if (key === 'hill') {
        cell.terrain = 'hill';
      } else if (key === 'forest') {
        cell.terrain = 'forest';
      }
      painted += 1;
    }
  }
}

function rectPassableCells(cells, rect) {
  const out = [];
  if (!rect) return out;
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      if (cellPassable(cells[row]?.[col])) out.push({ col, row });
    }
  }
  return out;
}

function keyOf(col, row) {
  return `${col},${row}`;
}

/**
 * BFS：玩家部署区任一点 ↔ 敌方部署区任一点
 */
function areDeploysConnected(cells, playerRect, enemyRect) {
  const starts = rectPassableCells(cells, playerRect);
  const goals = new Set(rectPassableCells(cells, enemyRect).map((p) => keyOf(p.col, p.row)));
  if (!starts.length || !goals.size) return false;
  const h = cells.length;
  const w = cells[0].length;
  const visited = new Set();
  const q = [];
  for (const s of starts) {
    const k = keyOf(s.col, s.row);
    visited.add(k);
    q.push(s);
  }
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const cur = q.shift();
    if (goals.has(keyOf(cur.col, cur.row))) return true;
    for (const [dx, dy] of dirs) {
      const nc = cur.col + dx;
      const nr = cur.row + dy;
      if (nc < 0 || nr < 0 || nc >= w || nr >= h) continue;
      const k = keyOf(nc, nr);
      if (visited.has(k)) continue;
      if (!cellPassable(cells[nr][nc])) continue;
      visited.add(k);
      q.push({ col: nc, row: nr });
    }
  }
  return false;
}

/** 直线挖廊：把阻挡格改回草地 */
function carveCorridor(cells, from, to) {
  let c = from.col;
  let r = from.row;
  const path = [];
  while (c !== to.col || r !== to.row) {
    path.push({ col: c, row: r });
    if (c !== to.col) c += c < to.col ? 1 : -1;
    else if (r !== to.row) r += r < to.row ? 1 : -1;
  }
  path.push({ col: to.col, row: to.row });
  for (const p of path) {
    const cell = cells[p.row]?.[p.col];
    if (!cell) continue;
    if (isBlockingTerrain(cell.terrain) || cell.object) {
      cell.terrain = '';
      cell.object = '';
      cell.base = 'plain_grassland';
    }
  }
}

function ensureConnectivity(cells, playerRect, enemyRect, rng) {
  if (areDeploysConnected(cells, playerRect, enemyRect)) return true;
  const starts = rectPassableCells(cells, playerRect);
  const goals = rectPassableCells(cells, enemyRect);
  if (!starts.length || !goals.length) {
    // 部署区被挡死：清空部署区阻挡
    for (const rect of [playerRect, enemyRect]) {
      for (let row = rect.rowMin; row <= rect.rowMax; row++) {
        for (let col = rect.colMin; col <= rect.colMax; col++) {
          const cell = cells[row][col];
          cell.terrain = '';
          cell.object = '';
          cell.base = 'plain_grassland';
        }
      }
    }
  }
  const sPool = rectPassableCells(cells, playerRect);
  const gPool = rectPassableCells(cells, enemyRect);
  if (!sPool.length || !gPool.length) return false;
  const from = sPool[Math.floor(rng() * sPool.length)];
  const to = gPool[Math.floor(rng() * gPool.length)];
  carveCorridor(cells, from, to);
  return areDeploysConnected(cells, playerRect, enemyRect);
}

function placeRosterUnits(cells, units, rect, rng, used) {
  if (!units?.length || !rect) return;
  const slots = shuffle(rng, rectPassableCells(cells, rect)).filter(
    (p) => !used.has(keyOf(p.col, p.row)),
  );
  if (slots.length < units.length) {
    throw new Error(
      `[chapterStageMapGenerator] 部署区可用格 ${slots.length} 少于 roster 部队数 ${units.length}：` +
        '请增大 map_w/map_h 或减少 roster（不静默少放部队）',
    );
  }
  let si = 0;
  for (const u of units) {
    const pos = slots[si++];
    used.add(keyOf(pos.col, pos.row));
    cells[pos.row][pos.col].campaignUnit = {
      faction: u.faction,
      charId: u.charId,
      troopId: u.troopId,
      morale: u.morale,
      ...(u.commanderRole ? { commanderRole: u.commanderRole } : {}),
      ...(u.battleAiStyle ? { battleAiStyle: u.battleAiStyle } : {}),
    };
  }
}

/**
 * @param {object} stage
 * @param {{ seed?: number, maxTries?: number }} [options]
 * @returns {{
 *   width: number,
 *   height: number,
 *   seed: number,
 *   stageId: string,
 *   cells: object[][],
 *   deployRects: { player: object, enemy: object, ally?: object },
 * }}
 */
export function generateChapterStageMap(stage, options = {}) {
  const mapW = Math.floor(Number(stage?.map_w ?? stage?.mapW));
  const mapH = Math.floor(Number(stage?.map_h ?? stage?.mapH));
  if (!Number.isFinite(mapW) || !Number.isFinite(mapH) || mapW < 4 || mapH < 4) {
    throw new Error(`[chapterStageMapGenerator] 非法地图尺寸 map_w×map_h=${mapW}×${mapH}`);
  }
  if (mapW > 40 || mapH > 40) {
    throw new Error(`[chapterStageMapGenerator] 地图过大（上限 40）：${mapW}×${mapH}`);
  }

  const stageId = String(stage?.stage_id || stage?.stageId || 'unknown_stage');
  const baseSeed = hashStageSeed(stageId, options.seed ?? stage?.map_seed ?? stage?.mapSeed);
  const maxTries = Math.max(1, Math.floor(Number(options.maxTries) || MAX_SEED_TRIES));
  const pattern = stage?.deploy_pattern || stage?.deployPattern || 'player_south_enemy_north';
  const ratios = parseTerrainRatios(stage?.terrain_ratios || stage?.terrainRatios);
  const brief = stage?.terrain_brief || stage?.terrainBrief || '';
  const enemies = parseChapterStageRoster(stage?.enemy_roster || stage?.enemyRoster);
  const allies = parseChapterStageRoster(stage?.ally_roster || stage?.allyRoster);

  let lastErr = '';
  for (let tryI = 0; tryI < maxTries; tryI++) {
    const seed = (baseSeed + tryI * 9973) >>> 0;
    const rng = createChapterSeededRng(seed);
    const deployRects = resolveChapterDeployRects(pattern, mapW, mapH);
    const cells = Array.from({ length: mapH }, (_, row) =>
      Array.from({ length: mapW }, (_, col) => emptyCell(col, row)),
    );

    paintTerrain(cells, mapW, mapH, ratios, brief, rng, [
      deployRects.player,
      deployRects.enemy,
    ]);

    if (!ensureConnectivity(cells, deployRects.player, deployRects.enemy, rng)) {
      lastErr = `seed=${seed} 连通失败`;
      continue;
    }

    const used = new Set();
    placeRosterUnits(cells, enemies, deployRects.enemy, rng, used);
    const allyUnits = allies.filter((u) => u.faction === 'ally1' || u.faction === 'ally2');
    if (allyUnits.length) {
      const allyRect = deployRects.ally || deployRects.player;
      placeRosterUnits(cells, allyUnits, allyRect, rng, used);
    }

    if (!areDeploysConnected(cells, deployRects.player, deployRects.enemy)) {
      lastErr = `seed=${seed} 摆兵后连通失败`;
      continue;
    }

    return {
      width: mapW,
      height: mapH,
      seed,
      stageId,
      cells,
      deployRects,
    };
  }

  throw new Error(
    `[chapterStageMapGenerator] ${stageId} 在 ${maxTries} 次尝试后仍无法生成可连通地图（${lastErr}）`,
  );
}

export default { generateChapterStageMap, createChapterSeededRng };
