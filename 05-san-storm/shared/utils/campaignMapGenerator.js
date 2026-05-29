/**
 * 战役地图模拟生成（16×20，四象限各 8×10）
 *
 * 与 `mapGenerator.js`（8×10 事件战）分离；输入为战役 CSV / preset 行（象限 DSL）。
 * 算法为**可复现占位**：按 seed 在象限内投放地形簇、对象点、特效标记，供预览与管线联调。
 * 多种底板时：双种子 **Voronoi**（距两随机锚点曼哈顿距离 + 微抖动），边界呈曲线状；象限缝另做 `smoothQuadBaseBoundaries`。
 *
 * 地形约定：
 * - `siege:N` — **轴对齐矩形**（规整城廓；**16 格为 4×4**），且仅在象限**中心带**生成（四周各 `SIEGE_EDGE_MARGIN` 格不投放 siege）。放不下矩形时回退为连通 blob。
 * - `river` / `river:N` — **链状河流**；`military_camp` 不占河道。
 * - `military_camp:K` — **K 座军营**，每座占地 **2×1**（横向两格），两格均为 `military_camp` 且落在 **siege** 上（若该象限无 siege 则无法放置）。
 * - **军营先于塔、栅投放**，避免单格对象占用军营 2×1 所需格。
 * - **部队与塔/栅/军营**等：仅落在象限内**最大**可通行四连通块（非河、非湖）上；仅**底板与地形层**可被河流/地图边缘切成小孤岛。
 * - **`fire` 特效**：非纯装饰（战斗上有伤害/减速等），与功能性对象一致，须落在从象限边缘**可达**的格上；且禁止 `river` / `lake`；优先级 ①`forest` ②无地形叠加 ③`hill`；不与对象同格。
 * - 全图地形合并后做接缝平滑；**再放对象与特效**，避免河岸修正把对象「泡进河里」。
 *
 * @see docs/90-assets/91-2-MAP_AUTO_GENERATION.md
 * @see docs/90-assets/91-3-CAMPAIGN_MAP_GENERATION.md
 * @see docs/tools/campaign/README.md
 */

import { parseIdColonCount } from './parseIdColonCount.js';
import { placeCampaignNpcUnits } from './campaignUnitsPlacement.js';
import { computeLargestPassableComponentLocal } from './campaignQuadReachability.js';
import presetSan1Camp1001V1 from '../data/campaign/san_1_camp_1001_v1.preset.json' with { type: 'json' };
import presetSan1Camp1001V2 from '../data/campaign/san_1_camp_1001_v2.preset.json' with { type: 'json' };

/** 模拟生成用：campaign_id → 与仓库 `shared/data/campaign/*.preset.json` 同步的预设对象 */
export const CAMPAIGN_PRESETS_BY_ID = {
  san_1_camp_1001_v1: presetSan1Camp1001V1,
  san_1_camp_1001_v2: presetSan1Camp1001V2,
};

export const CAMPAIGN_PRESET_IDS = Object.keys(CAMPAIGN_PRESETS_BY_ID);

export function getCampaignPresetById(campaignId) {
  return CAMPAIGN_PRESETS_BY_ID[campaignId] ?? null;
}

/** 与 SeededRandom 一致：\[1, 2147483646\] */
export function randomCampaignMapSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    let v = buf[0] % 2147483646;
    if (v <= 0) v += 2147483645;
    return v;
  }
  return 1 + Math.floor(Math.random() * 2147483646);
}

// ── 地图与象限（行 0 为上，列 0 为左）──────────────────────────────────────────
export const CAMPAIGN_MAP_WIDTH = 16;
export const CAMPAIGN_MAP_HEIGHT = 20;
export const QUAD_W = 8;
export const QUAD_H = 10;

/** 象限四周各禁止若干格投放 siege（中心带才允许城防区） */
export const SIEGE_EDGE_MARGIN = 2;

/** 军营占位：每座军营横向 2×1 格 */
export const MILITARY_CAMP_WIDTH = 2;
export const MILITARY_CAMP_HEIGHT = 1;

/** 无写数量时，河流默认总格数（避免 `river` 被解析成 1 格）；并限制在 {@link RIVER_CELLS_MAX} 内 */
export const DEFAULT_RIVER_CELLS_PER_QUAD = 17;

/** §② 未写 `river:N` 而由叙事稿填数时，建议 10～24；生成器对显式 `river:N` 也钳制在此区间，避免河格过多成块 */
export const RIVER_CELLS_MIN = 10;
export const RIVER_CELLS_MAX = 24;

/** 无写数量时，森林/丘陵等散点默认格数（可选） */
export const DEFAULT_SCATTER_TERRAIN_CELLS = 10;

/** A左上 B右上 C右下 D左下 → [globalCol0, globalRow0] 象限原点（左上格） */
export const QUAD_ORIGIN = {
  A: [0, 0],
  B: [8, 0],
  C: [8, 10],
  D: [0, 10],
};

// ── 伪随机（与 mapGenerator 同族 LCG，便于独立复现）──────────────────────────
class SeededRandom {
  constructor(seed) {
    this._state = seed != null ? Number(seed) % 2147483647 : Math.floor(Math.random() * 2147483647);
    if (this._state <= 0) this._state += 2147483646;
  }
  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
}

function parseSemicolonList(str) {
  if (!str || String(str).trim() === '') return [];
  return String(str)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} quadTerrain - e.g. "siege:16;hill;river"
 * @returns {{ id: string, count: number }[]}
 */
function parseTileSpecList(quadTerrain) {
  return parseSemicolonList(quadTerrain)
    .map(parseIdColonCount)
    .filter(Boolean);
}

function localXYToIndex(x, y) {
  return y * QUAD_W + x;
}

function localIndexToXY(li) {
  return { x: li % QUAD_W, y: Math.floor(li / QUAD_W) };
}

function quadIndexToGlobal(quadKey, localIndex) {
  const [ox, oy] = QUAD_ORIGIN[quadKey];
  const { x, y } = localIndexToXY(localIndex);
  return { col: ox + x, row: oy + y };
}

/** 四邻域（象限内线性索引） */
function neighbors4Local(li) {
  const { x, y } = localIndexToXY(li);
  const out = [];
  if (x > 0) out.push(localXYToIndex(x - 1, y));
  if (x < QUAD_W - 1) out.push(localXYToIndex(x + 1, y));
  if (y > 0) out.push(localXYToIndex(x, y - 1));
  if (y < QUAD_H - 1) out.push(localXYToIndex(x, y + 1));
  return out;
}

/** 可投放 siege 的象限内格（排除四周各 margin 格） */
function buildSiegeAllowedLocalIndices() {
  const set = new Set();
  for (let y = SIEGE_EDGE_MARGIN; y < QUAD_H - SIEGE_EDGE_MARGIN; y++) {
    for (let x = SIEGE_EDGE_MARGIN; x < QUAD_W - SIEGE_EDGE_MARGIN; x++) {
      set.add(localXYToIndex(x, y));
    }
  }
  return set;
}

const SIEGE_ALLOWED_LOCAL = buildSiegeAllowedLocalIndices();

/** 可投放 siege 的中心带宽度、高度（象限内局部坐标） */
const SIEGE_INNER_W = QUAD_W - 2 * SIEGE_EDGE_MARGIN;
const SIEGE_INNER_H = QUAD_H - 2 * SIEGE_EDGE_MARGIN;

/**
 * 将 N 分解为可放入中心带 (SIEGE_INNER_W × SIEGE_INNER_H) 的轴对齐矩形边长 (w,h)，w×h=N。
 * 多组解时优先更接近正方形（|w−h| 小）。
 * @returns {Array<[number, number]>}
 */
function factorPairsSiegeRectangle(n) {
  if (n <= 0) return [];
  const pairs = [];
  const maxW = SIEGE_INNER_W;
  const maxH = SIEGE_INNER_H;
  for (let w = 1; w <= maxW; w++) {
    if (n % w !== 0) continue;
    const h = n / w;
    if (h < 1 || h > maxH) continue;
    pairs.push([w, h]);
  }
  pairs.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]));
  return pairs;
}

/**
 * 在中心带内随机选一轴对齐 w×h 矩形，格均未被占用且 ⊆ siege 允许区；失败返回 []。
 * @param {SeededRandom} rng
 * @param {number} w
 * @param {number} h
 * @param {Set<number>} occupiedSet
 * @returns {number[]}
 */
function tryPlaceSiegeRectangle(rng, w, h, occupiedSet) {
  const minX = SIEGE_EDGE_MARGIN;
  const minY = SIEGE_EDGE_MARGIN;
  const maxSx = QUAD_W - SIEGE_EDGE_MARGIN - w;
  const maxSy = QUAD_H - SIEGE_EDGE_MARGIN - h;
  if (maxSx < minX || maxSy < minY) return [];

  const candidates = [];
  for (let sy = minY; sy <= maxSy; sy++) {
    for (let sx = minX; sx <= maxSx; sx++) {
      let ok = true;
      for (let dy = 0; dy < h && ok; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const li = localXYToIndex(sx + dx, sy + dy);
          if (!SIEGE_ALLOWED_LOCAL.has(li) || occupiedSet.has(li)) {
            ok = false;
            break;
          }
        }
      }
      if (ok) candidates.push({ sx, sy });
    }
  }
  if (!candidates.length) return [];
  const { sx, sy } = rng.pick(candidates);
  const out = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      out.push(localXYToIndex(sx + dx, sy + dy));
    }
  }
  return out;
}

/**
 * 优先用轴对齐矩形铺满 n 格（16→4×4）；若无合法分解或放不下则返回 []，由调用方回退 blob。
 */
function placeSiegeRegularOrEmpty(rng, n, occupiedSet) {
  const nCap = Math.min(n, SIEGE_ALLOWED_LOCAL.size);
  const pairs = factorPairsSiegeRectangle(nCap);
  for (const [w, h] of pairs) {
    const placed = tryPlaceSiegeRectangle(rng, w, h, occupiedSet);
    if (placed.length === nCap) return placed;
  }
  return [];
}

/** 行军/放置功能对象：不可进入的叠加地形（与战斗可达性约定对齐时可复用） */
export function terrainBlocksMovement(t) {
  return t === 'river' || t === 'lake';
}

/**
 * 从象限四边格出发，经四连通、非阻断地形，可达的象限内线性索引集合
 */
function computeReachableLocal(cells, quadKey) {
  const passable = (li) => {
    const { col, row } = quadIndexToGlobal(quadKey, li);
    const t = cells[row][col].terrain;
    return !terrainBlocksMovement(t);
  };

  const reachable = new Set();
  const queue = [];

  const tryEdge = (li) => {
    if (!passable(li) || reachable.has(li)) return;
    reachable.add(li);
    queue.push(li);
  };

  for (let x = 0; x < QUAD_W; x++) {
    tryEdge(localXYToIndex(x, 0));
    tryEdge(localXYToIndex(x, QUAD_H - 1));
  }
  for (let y = 1; y < QUAD_H - 1; y++) {
    tryEdge(localXYToIndex(0, y));
    tryEdge(localXYToIndex(QUAD_W - 1, y));
  }

  while (queue.length) {
    const cur = queue.shift();
    for (const nb of neighbors4Local(cur)) {
      if (!passable(nb) || reachable.has(nb)) continue;
      reachable.add(nb);
      queue.push(nb);
    }
  }
  return reachable;
}

/**
 * 在象限内取 count 个不重复格，避开 occupied / forbidden；若提供 whitelist 则仅从中选取
 */
function pickQuadCells(rng, count, occupied, forbidden, whitelist) {
  const forb = forbidden || new Set();
  const occ = occupied instanceof Set ? occupied : new Set(occupied);
  const pool = whitelist
    ? [...whitelist].filter((i) => !occ.has(i) && !forb.has(i))
    : null;
  const maxPick = pool ? pool.length : 80 - occ.size - forb.size;
  const set = new Set([...occ, ...forb]);
  const out = [];
  let guard = 0;
  const target = Math.min(count, Math.max(0, maxPick));
  while (out.length < target && guard < 12000) {
    guard += 1;
    const i = pool ? rng.pick(pool) : rng.int(0, 79);
    if (pool && !pool.includes(i)) continue;
    if (!pool && (set.has(i) || forb.has(i))) continue;
    if (set.has(i)) continue;
    set.add(i);
    out.push(i);
  }
  return out;
}

/**
 * 从 seedIdx 起 BFS 扩张，至多 n 格（整块连通）；allowedSet 存在时仅占用允许的格
 */
function growContiguousBlob(rng, seedIdx, n, occupiedSet, forbidden, allowedSet) {
  const forb = forbidden || new Set();
  const allowed = allowedSet || null;
  const chosen = [];
  if (n <= 0) return chosen;
  if (allowed && !allowed.has(seedIdx)) return chosen;
  const used = new Set([...occupiedSet, ...forb]);
  if (used.has(seedIdx) || seedIdx < 0 || seedIdx > 79) return chosen;
  used.add(seedIdx);
  chosen.push(seedIdx);
  const queue = [seedIdx];
  while (chosen.length < n && queue.length) {
    const cur = queue.shift();
    const neigh = neighbors4Local(cur).filter((nb) => {
      if (used.has(nb)) return false;
      if (allowed && !allowed.has(nb)) return false;
      return true;
    });
    const shuffled = [...neigh].sort(() => rng.next() - 0.5);
    for (const nb of shuffled) {
      if (chosen.length >= n) break;
      used.add(nb);
      chosen.push(nb);
      queue.push(nb);
    }
  }
  return chosen;
}

/**
 * 河流：随机游走链；不覆盖 forbidden（如已有 siege）
 * @param {Set<number>|undefined} connectTo — 已存在的河格，新段优先从邻格接出
 */
function growRiverChain(rng, targetCells, occupied, forbidden, connectTo) {
  const forb = forbidden || new Set();
  const riverCells = [];
  if (targetCells <= 0) return riverCells;

  const free = [];
  for (let i = 0; i < 80; i++) {
    if (!occupied.has(i) && !forb.has(i)) free.push(i);
  }
  if (!free.length) return riverCells;

  const preferConnect = connectTo && connectTo.size > 0;
  const bridgeStarters = preferConnect
    ? free.filter((i) => neighbors4Local(i).some((j) => connectTo.has(j)))
    : [];
  let cur =
    bridgeStarters.length > 0 ? rng.pick(bridgeStarters) : rng.pick(free);
  const riverSet = new Set();
  riverSet.add(cur);
  riverCells.push(cur);

  while (riverCells.length < targetCells) {
    const neigh = neighbors4Local(cur).filter((i) => !occupied.has(i) && !forb.has(i) && !riverSet.has(i));
    if (neigh.length) {
      cur = rng.pick(neigh);
      riverSet.add(cur);
      riverCells.push(cur);
      continue;
    }
    const starters = free.filter((i) => !riverSet.has(i) && !occupied.has(i) && !forb.has(i));
    const candidates = starters.filter((i) =>
      neighbors4Local(i).some((j) => riverSet.has(j) || (connectTo && connectTo.has(j)))
    );
    const pool = candidates.length ? candidates : starters;
    if (!pool.length) break;
    cur = rng.pick(pool);
    riverSet.add(cur);
    riverCells.push(cur);
  }

  return riverCells;
}

function placeRiverTotal(rng, totalCells, occupied, forbidden) {
  const occ = new Set(occupied);
  const forb = forbidden || new Set();
  const out = [];
  let guard = 0;
  while (out.length < totalCells && guard < 400) {
    guard += 1;
    const need = totalCells - out.length;
    const connectTo = out.length ? new Set(out) : undefined;
    const chunk = growRiverChain(rng, need, occ, forb, connectTo);
    if (!chunk.length) break;
    chunk.forEach((i) => {
      occ.add(i);
      out.push(i);
    });
  }
  return { indices: out, occupied: occ };
}

/**
 * 荒地底板链（与河流同族随机游走），不占主导；wastelandSet 为象限内已铺荒地格。
 */
function growWastelandBaseChain(rng, targetCells, wastelandSet) {
  const out = [];
  if (targetCells <= 0) return out;
  const free = [];
  for (let i = 0; i < 80; i++) {
    if (!wastelandSet.has(i)) free.push(i);
  }
  if (!free.length) return out;
  let cur = rng.pick(free);
  while (out.length < targetCells) {
    if (!wastelandSet.has(cur)) {
      wastelandSet.add(cur);
      out.push(cur);
    }
    if (out.length >= targetCells) break;
    const neigh = neighbors4Local(cur).filter((i) => !wastelandSet.has(i));
    if (neigh.length) {
      cur = rng.pick(neigh);
      continue;
    }
    const starters = free.filter((i) => !wastelandSet.has(i));
    if (!starters.length) break;
    cur = rng.pick(starters);
  }
  return out;
}

function terrainCellCount(id, count) {
  if (id === 'river') {
    const raw = count === 1 ? DEFAULT_RIVER_CELLS_PER_QUAD : count;
    return Math.min(Math.max(Math.min(raw, 80), RIVER_CELLS_MIN), RIVER_CELLS_MAX);
  }
  if ((id === 'forest' || id === 'hill') && count === 1) return DEFAULT_SCATTER_TERRAIN_CELLS;
  return Math.min(count, 80);
}

const SEAM_TERRAINS = new Set(['river', 'lake', 'ford', 'forest', 'hill', 'road']);

function smoothQuadBoundaries(cells, rng, preset) {
  const riverOn = preset.boundary_river_continuity !== false;
  const roadOn = preset.boundary_road_continuity !== false;

  const tryMatch = (a, b) => {
    const ta = a.terrain;
    const tb = b.terrain;
    if (!riverOn && !roadOn) return;
    const waterish = new Set(['river', 'lake', 'ford']);
    const roadish = new Set(['road']);

    if (riverOn) {
      if (waterish.has(ta) && !tb) {
        if (rng.next() < 0.72) b.terrain = ta;
      } else if (waterish.has(tb) && !ta) {
        if (rng.next() < 0.72) a.terrain = tb;
      }
    }
    if (roadOn) {
      if (roadish.has(ta) && !tb) {
        if (rng.next() < 0.65) b.terrain = ta;
      } else if (roadish.has(tb) && !ta) {
        if (rng.next() < 0.65) a.terrain = tb;
      }
    }
    if (SEAM_TERRAINS.has(ta) && SEAM_TERRAINS.has(tb) && ta !== tb) {
      if (rng.next() < 0.45) {
        const pick = rng.next() < 0.5 ? ta : tb;
        a.terrain = pick;
        b.terrain = pick;
      }
    } else if (SEAM_TERRAINS.has(ta) && !tb && rng.next() < 0.38) {
      b.terrain = ta;
    } else if (SEAM_TERRAINS.has(tb) && !ta && rng.next() < 0.38) {
      a.terrain = tb;
    }
  };

  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < CAMPAIGN_MAP_HEIGHT; r++) {
      tryMatch(cells[r][7], cells[r][8]);
    }
    for (let c = 0; c < CAMPAIGN_MAP_WIDTH; c++) {
      tryMatch(cells[9][c], cells[10][c]);
    }
  }

  const bleed = (cFrom, cInto) => {
    if (!riverOn) return;
    const waterish = new Set(['river', 'lake', 'ford']);
    if (waterish.has(cFrom.terrain) && !cInto.terrain && rng.next() < 0.32) {
      cInto.terrain = cFrom.terrain;
    }
  };
  for (let r = 0; r < CAMPAIGN_MAP_HEIGHT; r++) {
    bleed(cells[r][7], cells[r][6]);
    bleed(cells[r][8], cells[r][9]);
  }
  for (let c = 0; c < CAMPAIGN_MAP_WIDTH; c++) {
    bleed(cells[9][c], cells[8][c]);
    bleed(cells[10][c], cells[11][c]);
  }
}

const BASE_BLEND = new Set(['plain_grassland', 'plain_wasteland']);

/** 象限缝两侧绿地/荒地硬边软化（如乙|丙） */
function smoothQuadBaseBoundaries(cells, rng) {
  const tryMatch = (a, b) => {
    if (a.base === b.base) return;
    if (!BASE_BLEND.has(a.base) || !BASE_BLEND.has(b.base)) return;
    if (rng.next() < 0.48) {
      const pick = rng.next() < 0.5 ? a.base : b.base;
      a.base = pick;
      b.base = pick;
    } else if (rng.next() < 0.4) {
      b.base = a.base;
    } else if (rng.next() < 0.4) {
      a.base = b.base;
    }
  };

  for (let pass = 0; pass < 3; pass++) {
    for (let r = 0; r < CAMPAIGN_MAP_HEIGHT; r++) {
      tryMatch(cells[r][7], cells[r][8]);
    }
    for (let c = 0; c < CAMPAIGN_MAP_WIDTH; c++) {
      tryMatch(cells[9][c], cells[10][c]);
    }
  }
}

/** 象限内绿地/荒地边界再揉一轮，打断直尺边 */
function smoothBaseWithinQuad(cells, quadKey, rng) {
  for (let pass = 0; pass < 5; pass++) {
    const order = shuffleIndices(rng, [...Array(80).keys()]);
    for (const li of order) {
      const { col, row } = quadIndexToGlobal(quadKey, li);
      const c = cells[row][col];
      if (!BASE_BLEND.has(c.base)) continue;
      if (rng.next() > 0.3) continue;
      const nbLi = rng.pick(neighbors4Local(li));
      const { col: c2, row: r2 } = quadIndexToGlobal(quadKey, nbLi);
      const ob = cells[r2][c2].base;
      if (BASE_BLEND.has(ob)) c.base = ob;
    }
  }
}

/** 枚举象限内所有横向 2×1 块（左格 local 索引） */
function enumerate2x1HorizontalBlocks() {
  const blocks = [];
  for (let y = 0; y < QUAD_H; y++) {
    for (let x = 0; x < QUAD_W - 1; x++) {
      blocks.push([localXYToIndex(x, y), localXYToIndex(x + 1, y)]);
    }
  }
  return blocks;
}

/**
 * 两格均为 siege，且均在象限主大陆连通块上
 */
function isValidCamp2x1(cells, quadKey, block, mainland) {
  return block.every((li) => {
    if (!mainland.has(li)) return false;
    const { col, row } = quadIndexToGlobal(quadKey, li);
    return cells[row][col].terrain === 'siege';
  });
}

function shuffleBlocks(rng, blocks) {
  return [...blocks].sort(() => rng.next() - 0.5);
}

function shuffleIndices(rng, indices) {
  return [...indices].sort(() => rng.next() - 0.5);
}

/**
 * 火焰 fire：须在主大陆连通块上；① 林 ② 仅底板 ③ 丘；禁止河/湖；不与对象同格。
 * @param {Set<number>} mainland — `computeLargestPassableComponentLocal`
 */
function pickFireEffectLocalIndices(rng, cells, quadKey, count, mainland) {
  const tierForest = [];
  const tierBase = [];
  const tierHill = [];
  for (let li = 0; li < 80; li++) {
    if (!mainland.has(li)) continue;
    const { col, row } = quadIndexToGlobal(quadKey, li);
    const c = cells[row][col];
    const t = c.terrain;
    if (t === 'river' || t === 'lake') continue;
    if (c.object) continue;
    if (c.effect) continue;
    if (t === 'forest') tierForest.push(li);
    else if (t === 'hill') tierHill.push(li);
    else if (t == null || t === '') tierBase.push(li);
  }
  const pool = [
    ...shuffleIndices(rng, tierForest),
    ...shuffleIndices(rng, tierBase),
    ...shuffleIndices(rng, tierHill),
  ];
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * @returns {{ width: number, height: number, seed: number, campaignId: string, cells: Array<Array<object>> }}
 */
export function generateCampaignMapSimulated(preset, options = {}) {
  const seed = options.seed != null ? Number(options.seed) : randomCampaignMapSeed();
  const rng = new SeededRandom(seed);

  /** @type {CampaignCell[][]} */
  const cells = Array.from({ length: CAMPAIGN_MAP_HEIGHT }, (_, row) =>
    Array.from({ length: CAMPAIGN_MAP_WIDTH }, (_, col) => ({
      col,
      row,
      base: 'plain_grassland',
      terrain: null,
      object: null,
      effect: null,
      quad: row < QUAD_H ? (col < QUAD_W ? 'A' : 'B') : col < QUAD_W ? 'D' : 'C',
    }))
  );

  const quads = ['A', 'B', 'C', 'D'];

  // ── Phase 1：仅地形（象限循环）────────────────────────────────────────────
  for (const q of quads) {
    const baseStr = preset[`quad_${q}_base_tiles`] || '';
    const bases = parseSemicolonList(baseStr);
    const terrainStr = preset[`quad_${q}_terrain_tiles`] || '';

    /** @type {Set<number>} */
    const occupiedSet = new Set();

    if (bases.length === 1) {
      const b = bases[0];
      for (let li = 0; li < 80; li++) {
        const { col, row } = quadIndexToGlobal(q, li);
        cells[row][col].base = b;
      }
    } else if (bases.length >= 2) {
      const primary = bases[0];
      const secondary = bases[1];
      for (let li = 0; li < 80; li++) {
        const { col, row } = quadIndexToGlobal(q, li);
        cells[row][col].base = primary;
      }
      const secondaryBudget = rng.int(14, 24);
      const wastelandSet = new Set();
      let placedW = 0;
      while (placedW < secondaryBudget) {
        const need = Math.min(rng.int(4, 11), secondaryBudget - placedW);
        const chunk = growWastelandBaseChain(rng, need, wastelandSet);
        if (!chunk.length) break;
        for (const li of chunk) {
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].base = secondary;
          placedW += 1;
        }
      }
      smoothBaseWithinQuad(cells, q, rng);
    }

    const terrainItems = parseTileSpecList(terrainStr);
    const siegeForbiddenForRiver = new Set();

    for (const { id, count: rawCount } of terrainItems) {
      const count = terrainCellCount(id, rawCount);
      if (id === 'siege') {
        const maxSiege = SIEGE_ALLOWED_LOCAL.size;
        const n = Math.min(count, maxSiege);
        let placed = placeSiegeRegularOrEmpty(rng, n, occupiedSet);
        if (placed.length < n) {
          placed = [];
          const freeInSiege = [...SIEGE_ALLOWED_LOCAL].filter((i) => !occupiedSet.has(i));
          for (let tries = 0; tries < 100 && placed.length < n; tries++) {
            if (!freeInSiege.length) break;
            const seedLi = rng.pick(freeInSiege);
            const blob = growContiguousBlob(rng, seedLi, n, occupiedSet, null, SIEGE_ALLOWED_LOCAL);
            if (blob.length > placed.length) placed = blob;
            if (placed.length >= n) break;
          }
        }
        for (const li of placed.slice(0, n)) {
          occupiedSet.add(li);
          siegeForbiddenForRiver.add(li);
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].terrain = 'siege';
        }
      } else if (id === 'river') {
        const { indices } = placeRiverTotal(rng, count, occupiedSet, siegeForbiddenForRiver);
        for (const li of indices) {
          occupiedSet.add(li);
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].terrain = 'river';
        }
      } else {
        const n = Math.min(count, 80 - occupiedSet.size);
        const idxs = pickQuadCells(rng, n, occupiedSet, null, null);
        idxs.forEach((li) => occupiedSet.add(li));
        for (const li of idxs) {
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].terrain = id;
        }
      }
    }
  }

  smoothQuadBoundaries(cells, rng, preset);
  smoothQuadBaseBoundaries(cells, rng);

  // ── Phase 2：对象与特效（接缝后再算主大陆，避免对象落在修正后的河上）──────────
  for (const q of quads) {
    const objectStr = preset[`quad_${q}_object_tiles`] || '';
    const effectStr = preset[`quad_${q}_effect_tiles`] || '';

    const mainland = computeLargestPassableComponentLocal(cells, q);
    const functionalWhitelist = new Set([...mainland]);

    /** @type {Set<number>} */
    const objectOccupied = new Set();

    const objectItems = parseTileSpecList(objectStr);
    const campSpecs = objectItems.filter((o) => o.id === 'military_camp');
    const nonCampObjects = objectItems.filter((o) => o.id !== 'military_camp');

    const campCountTotal = campSpecs.reduce((s, o) => s + o.count, 0);
    const numCamps = Math.min(campCountTotal, 32);
    if (numCamps > 0) {
      const allBlocks = enumerate2x1HorizontalBlocks();
      let candidates = allBlocks.filter((b) => isValidCamp2x1(cells, q, b, mainland));
      candidates = shuffleBlocks(rng, candidates);

      let placedN = 0;
      for (const block of candidates) {
        if (placedN >= numCamps) break;
        const overlap = block.some((li) => objectOccupied.has(li));
        if (overlap) continue;
        block.forEach((li) => objectOccupied.add(li));
        placedN += 1;
        for (const li of block) {
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].object = 'military_camp';
        }
      }
    }

    for (const { id, count: rawCount } of nonCampObjects) {
      const count = Math.min(rawCount, 80);
      const idxs = pickQuadCells(rng, count, objectOccupied, null, functionalWhitelist);
      idxs.forEach((li) => objectOccupied.add(li));
      for (const li of idxs) {
        const { col, row } = quadIndexToGlobal(q, li);
        cells[row][col].object = id;
      }
    }

    const effectItems = parseTileSpecList(effectStr);
    for (const { id, count: rawCount } of effectItems) {
      const count = Math.min(rawCount, 80);
      if (id === 'fire') {
        const idxs = pickFireEffectLocalIndices(rng, cells, q, count, mainland);
        for (const li of idxs) {
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].effect = id;
        }
      } else {
        const idxs = pickQuadCells(rng, count, objectOccupied, null, null);
        idxs.forEach((li) => objectOccupied.add(li));
        for (const li of idxs) {
          const { col, row } = quadIndexToGlobal(q, li);
          cells[row][col].effect = id;
        }
      }
    }
  }

  placeCampaignNpcUnits(cells, preset, rng);

  return {
    width: CAMPAIGN_MAP_WIDTH,
    height: CAMPAIGN_MAP_HEIGHT,
    seed,
    campaignId: preset.campaign_id || '',
    cells,
  };
}

/** 长社之战 v1 preset（与叙事稿 / CSV 同步） */
export const CAMPAIGN_PRESET_SAN_1_CAMP_1001_V1 = presetSan1Camp1001V1;

/** 长社之战 v2 preset（见 `docs/tools/campaign/san_1_camp_1001_v2.md` §④） */
export const CAMPAIGN_PRESET_SAN_1_CAMP_1001_V2 = presetSan1Camp1001V2;
