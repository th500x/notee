/**
 * 战役 Demo：从 preset quad_*_units_spec 解析 NPC 部队并占位。
 * 每条 `san_1_troop_*:N` 展开为 **N** 个地图单位（支）。
 *
 * - 投放仅在象限 **最大可通行连通块**（见 campaignQuadReachability.js）。
 * - **本象限每条边**（贴邻接象限的格）上最多 **3** 支；超出优先溢到邻象限，减轻象限缝「切割柱」。
 * - 象限内有火焰格时：约 50% 单位落在本象限火焰格（仍受边上限约束；不足则溢）。
 */

import { parseIdColonCount } from './parseIdColonCount.js';
import { computeLargestPassableComponentLocal } from './campaignQuadReachability.js';

const QUAD_W = 8;
const QUAD_H = 10;

const QUAD_ORIGIN = {
  A: [0, 0],
  B: [8, 0],
  C: [8, 10],
  D: [0, 10],
};

/** 贴地图边的格每边仍计 cap（与邻接象限的缝主要管 x=7 / x=0 等） */
const EDGE_CAP = 3;

const SPILL_ORDER = {
  A: ['B', 'D', 'C'],
  B: ['A', 'C', 'D'],
  C: ['B', 'D', 'A'],
  D: ['A', 'C', 'B'],
};

function cellKey(col, row) {
  return `${col},${row}`;
}

function localIndexToXY(li) {
  return { x: li % QUAD_W, y: Math.floor(li / QUAD_W) };
}

function quadIndexToGlobal(quadKey, localIndex) {
  const [ox, oy] = QUAD_ORIGIN[quadKey];
  const { x, y } = localIndexToXY(localIndex);
  return { col: ox + x, row: oy + y };
}

function terrainBlocksMovement(t) {
  return t === 'river' || t === 'lake';
}

/** @returns {string[]} top|right|bottom|left，内圈无 */
function getEdgesForLocal(li) {
  const { x, y } = localIndexToXY(li);
  const e = [];
  if (y === 0) e.push('top');
  if (y === QUAD_H - 1) e.push('bottom');
  if (x === 0) e.push('left');
  if (x === QUAD_W - 1) e.push('right');
  return e;
}

function isInteriorLocal(li) {
  const { x, y } = localIndexToXY(li);
  return x > 0 && x < QUAD_W - 1 && y > 0 && y < QUAD_H - 1;
}

function canPlaceEdgeCap(li, edgeCounts) {
  const edges = getEdgesForLocal(li);
  if (edges.length === 0) return true;
  return edges.every((ed) => edgeCounts[ed] < EDGE_CAP);
}

function registerEdgeCap(li, edgeCounts) {
  for (const ed of getEdgesForLocal(li)) {
    edgeCounts[ed] += 1;
  }
}

/**
 * @param {string} segment 单条 `ally1|char|troop:2|...`
 * @returns {{ faction: string, charId: string, troopId: string, morale: number } | null}
 */
export function parseCampaignUnitsSpecEntry(segment) {
  const s = String(segment ?? '').trim();
  if (!s) return null;
  const parts = s.split('|').map((p) => p.trim());
  const faction = parts[0];
  if (!faction || faction === 'player') return null;
  const charId = parts[1];
  if (!charId || charId === '-') return null;
  const troopTok = parts[2] || '';
  const parsed = parseIdColonCount(troopTok);
  const troopId = parsed ? parsed.id : '';
  let morale = 70;
  for (const p of parts) {
    const m = /^morale:(\d+)$/i.exec(p);
    if (m) morale = Math.min(100, parseInt(m[1], 10) || 70);
  }
  return { faction, charId, troopId, morale };
}

export function parseCampaignUnitsSpec(spec) {
  if (!spec || String(spec).trim() === '') return [];
  return String(spec)
    .split('||')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parseCampaignUnitsSpecEntry)
    .filter(Boolean);
}

export function expandCampaignUnitsSpec(spec) {
  if (!spec || String(spec).trim() === '') return [];
  const out = [];
  for (const seg of String(spec)
    .split('||')
    .map((x) => x.trim())
    .filter(Boolean)) {
    const entry = parseCampaignUnitsSpecEntry(seg);
    if (!entry) continue;
    const parts = seg.split('|').map((p) => p.trim());
    const troopTok = parts[2] || '';
    const parsed = parseIdColonCount(troopTok);
    const n = parsed && parsed.count > 0 ? parsed.count : 1;
    for (let i = 0; i < n; i++) {
      out.push({
        faction: entry.faction,
        charId: entry.charId,
        troopId: entry.troopId,
        morale: entry.morale,
        stackIndex: i,
        stackTotal: n,
      });
    }
  }
  return out;
}

function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function collectFireLocalIndices(cells, quadKey) {
  const out = [];
  for (let li = 0; li < 80; li++) {
    const { col, row } = quadIndexToGlobal(quadKey, li);
    if (cells[row][col].effect === 'fire') out.push(li);
  }
  return out;
}

function collectSpillPool(cells, quadKey, used) {
  const non = collectUnitPoolForQuad(cells, quadKey, used, 'nonfire');
  if (non.length > 0) return non;
  return collectUnitPoolForQuad(cells, quadKey, used, 'any');
}

/**
 * @param {'fire' | 'nonfire' | 'any'} mode
 */
function collectUnitPoolForQuad(cells, quadKey, used, mode) {
  const mainland = computeLargestPassableComponentLocal(cells, quadKey);
  const pool = [];
  for (const li of mainland) {
    const { col, row } = quadIndexToGlobal(quadKey, li);
    const k = cellKey(col, row);
    if (used.has(k)) continue;
    const c = cells[row][col];
    if (c.object) continue;
    if (terrainBlocksMovement(c.terrain)) continue;
    if (mode === 'fire' && c.effect !== 'fire') continue;
    if (mode === 'nonfire' && c.effect === 'fire') continue;
    pool.push(li);
  }
  return pool;
}

function partitionInteriorFirst(pool, rng) {
  const int = [];
  const ext = [];
  for (const li of pool) {
    if (isInteriorLocal(li)) int.push(li);
    else ext.push(li);
  }
  shuffleInPlace(rng, int);
  shuffleInPlace(rng, ext);
  return [...int, ...ext];
}

function assignUnit(cells, col, row, unit, used) {
  used.add(cellKey(col, row));
  cells[row][col].campaignUnit = {
    faction: unit.faction,
    charId: unit.charId,
    troopId: unit.troopId,
    morale: unit.morale,
  };
}

/** 溢入邻象限：不施加本象限边上限 */
function pickFirstFromPool(cells, quadKey, pool, used, mode, rng) {
  const list = [...pool];
  shuffleInPlace(rng, list);
  for (const li of list) {
    const { col, row } = quadIndexToGlobal(quadKey, li);
    if (used.has(cellKey(col, row))) continue;
    const c = cells[row][col];
    if (c.object) continue;
    if (terrainBlocksMovement(c.terrain)) continue;
    if (mode === 'fire' && c.effect !== 'fire') continue;
    if (mode === 'nonfire' && c.effect === 'fire') continue;
    return { li, col, row, quadKey };
  }
  return null;
}

function pickFirstFromPoolHome(cells, homeQ, pool, used, mode, edgeCounts, applyCap, rng) {
  const list = partitionInteriorFirst(pool, rng);
  for (const li of list) {
    const { col, row } = quadIndexToGlobal(homeQ, li);
    if (used.has(cellKey(col, row))) continue;
    const c = cells[row][col];
    if (c.object) continue;
    if (terrainBlocksMovement(c.terrain)) continue;
    if (mode === 'fire' && c.effect !== 'fire') continue;
    if (mode === 'nonfire' && c.effect === 'fire') continue;
    if (applyCap && !canPlaceEdgeCap(li, edgeCounts)) continue;
    return { li, col, row, quadKey: homeQ };
  }
  return null;
}

export function placeCampaignNpcUnits(cells, preset, rng) {
  const used = new Set();

  const quadsNpc = [
    { key: 'A', specKey: 'quad_A_units_spec' },
    { key: 'B', specKey: 'quad_B_units_spec' },
    { key: 'D', specKey: 'quad_D_units_spec' },
  ];

  for (const { key: homeQ, specKey } of quadsNpc) {
    const units = expandCampaignUnitsSpec(preset[specKey] || '');
    if (units.length === 0) continue;

    const edgeCounts = { top: 0, right: 0, bottom: 0, left: 0 };

    const hasFire = collectFireLocalIndices(cells, homeQ).length > 0;
    const targetFire = hasFire ? Math.round(units.length * 0.5) : 0;

    let ui = 0;
    let firePlaced = 0;
    while (firePlaced < targetFire && ui < units.length) {
      const pool = collectUnitPoolForQuad(cells, homeQ, used, 'fire');
      const pick = pickFirstFromPoolHome(cells, homeQ, pool, used, 'fire', edgeCounts, true, rng);
      if (!pick) break;
      assignUnit(cells, pick.col, pick.row, units[ui++], used);
      registerEdgeCap(pick.li, edgeCounts);
      firePlaced += 1;
    }

    while (ui < units.length) {
      const before = ui;

      const poolH = collectUnitPoolForQuad(cells, homeQ, used, 'nonfire');
      let pick = pickFirstFromPoolHome(cells, homeQ, poolH, used, 'nonfire', edgeCounts, true, rng);
      if (pick) {
        assignUnit(cells, pick.col, pick.row, units[ui++], used);
        registerEdgeCap(pick.li, edgeCounts);
        continue;
      }

      for (const q of SPILL_ORDER[homeQ]) {
        let pool = collectSpillPool(cells, q, used);
        pick = pickFirstFromPool(cells, q, pool, used, 'nonfire', rng);
        if (!pick) {
          pool = collectUnitPoolForQuad(cells, q, used, 'any');
          pick = pickFirstFromPool(cells, q, pool, used, 'any', rng);
        }
        if (pick) {
          assignUnit(cells, pick.col, pick.row, units[ui++], used);
          break;
        }
      }

      if (ui > before) continue;

      const poolRelax = collectUnitPoolForQuad(cells, homeQ, used, 'nonfire');
      pick = pickFirstFromPoolHome(cells, homeQ, poolRelax, used, 'nonfire', edgeCounts, false, rng);
      if (pick) {
        assignUnit(cells, pick.col, pick.row, units[ui++], used);
        registerEdgeCap(pick.li, edgeCounts);
        continue;
      }

      break;
    }
  }
}

