/**
 * 战略大地图 · 多郡垂直拼接：多份郡级 `*_merged.json`（各 32×40）在同一视口内按世界行堆叠。
 * 约定：自上而下与 `SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER` 一致（当前 S1 豫州为颍川上、汝南下）。
 * 与 `players.road_jun_id` + 郡内 `(gx,gy)` 一致：世界行偏移集中在此模块，避免游戏侧散落魔法数。
 */

/** 单郡标准画布行数（与 `junCountyMapGenerator` 郡合并 32×40 一致） */
export const STRATEGIC_COUNTY_MAP_ROWS = 40;

/** S1 豫州大地图垂直条带顺序：上行颍川、下行汝南（扩展时只改此表与合并逻辑） */
export const SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER = ['san_1_jun_yingchuan', 'san_1_jun_runan'];

/**
 * 颍川郡合并画布 32×40 内：**大象限 C** 原 (16,20)，其内 **战役子块 C**（小象限 A3 / 右下 8×10）相对偏移 (8,10)，
 * 即郡内 gx∈[24,31]、gy∈[30,39]（与 `campaignMapGenerator.QUAD_ORIGIN.C` 嵌在 `COUNTY_MAJOR_QUAD_ORIGIN.C` 内一致）。
 * 口语「颍川 C3」划属汝南行政，**非**整个大象限 C（16×31, gy≥20）。
 */
const SAN1_YU_YINGCHUAN_FILE_C3_MIN_GX = 24;
const SAN1_YU_YINGCHUAN_FILE_C3_MIN_GY = 30;
const SAN1_YU_YINGCHUAN_FILE_C3_MAX_GX = 31;
const SAN1_YU_YINGCHUAN_FILE_C3_MAX_GY = 39;

/**
 * S1 豫州战略格网：道路「郡界」着色等用的 **行政郡** id（非叠放文件来源）。
 * - 世界行 `gy >= 40`：汝南合并带。
 * - `gy < 40` 且格落在颍川文件 **C3**（大象限 C 内右下 8×10）：汝南。
 * - 其余上半带：颍川。
 *
 * @param {number} gx
 * @param {number} gy 世界行（叠放画布）
 * @returns {'san_1_jun_yingchuan' | 'san_1_jun_runan'}
 */
export function san1YuStrategicAdminJunIdAtWorldCell(gx, gy) {
  const gxi = Math.trunc(Number(gx));
  const gyi = Math.trunc(Number(gy));
  if (!Number.isFinite(gxi) || !Number.isFinite(gyi)) return 'san_1_jun_yingchuan';
  if (gyi >= STRATEGIC_COUNTY_MAP_ROWS) return 'san_1_jun_runan';
  if (
    gxi >= SAN1_YU_YINGCHUAN_FILE_C3_MIN_GX &&
    gxi <= SAN1_YU_YINGCHUAN_FILE_C3_MAX_GX &&
    gyi >= SAN1_YU_YINGCHUAN_FILE_C3_MIN_GY &&
    gyi <= SAN1_YU_YINGCHUAN_FILE_C3_MAX_GY
  ) {
    return 'san_1_jun_runan';
  }
  return 'san_1_jun_yingchuan';
}

/**
 * S1 豫州叠图：行政郡可读的几何「接缝」折线（格网坐标，与道路 `viewBox` 一致）。
 * - **叠带缝**：`y = 40` 上仅 `x ∈ [0,24]` 画横线（C3 正下亦为汝南，不画 24～32 段，避免误缝）。
 * **C3 周界**（与颍川其余分界）：`x=24` 自 `y=40` 上至 `y=30`，再 `y=30` 至 `x=32`，再 `x=32` 下至 `y=40`（与叠带缝一笔相连，呈「┌」接横线状）。
 * 单郡高度（无下叠）时：仅画 C3 矩形周界。
 *
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {string} SVG path `d`，可能为空串
 */
export function buildSan1YuStrategicSeamGuidePathD(mapColumns, mapRows) {
  const W = Math.max(0, Math.trunc(Number(mapColumns)) || 0);
  const H = Math.max(0, Math.trunc(Number(mapRows)) || 0);
  if (W < 2 || H < 2) return '';

  const xL = SAN1_YU_YINGCHUAN_FILE_C3_MIN_GX;
  const xR = Math.min(W, SAN1_YU_YINGCHUAN_FILE_C3_MAX_GX + 1);
  const yT = SAN1_YU_YINGCHUAN_FILE_C3_MIN_GY;
  const yB = STRATEGIC_COUNTY_MAP_ROWS;
  const pieces = [];

  if (H > STRATEGIC_COUNTY_MAP_ROWS && W > 0 && xL <= W && xR > xL && yT < yB) {
    const xSeamEnd = Math.min(W, xL);
    pieces.push(`M 0 ${yB} L ${xSeamEnd} ${yB} L ${xL} ${yT} L ${xR} ${yT} L ${xR} ${yB}`);
  } else if (W > xL && H > yT && xR > xL) {
    const yBB = Math.min(H, yB);
    if (yBB > yT) {
      pieces.push(`M ${xL} ${yT} L ${xR} ${yT} L ${xR} ${yBB} L ${xL} ${yBB} L ${xL} ${yT}`);
    }
  }

  return pieces.join(' ');
}

/**
 * @param {string} junId
 * @returns {number} 该郡在垂直叠放中的世界行起点（向下为正；颍川 0、汝南 40）
 */
export function stackWorldRowOffsetForJunId(junId) {
  const j = String(junId || '').trim();
  let off = 0;
  for (const jid of SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER) {
    if (jid === j) return off;
    off += STRATEGIC_COUNTY_MAP_ROWS;
  }
  return 0;
}

/**
 * @param {string} junId
 * @param {number} localGy 郡内 0…39
 * @returns {number} 叠放画布上的世界行
 */
export function stackWorldGyFromLocalJunRow(junId, localGy) {
  return stackWorldRowOffsetForJunId(junId) + Math.max(0, Math.trunc(Number(localGy)));
}

/**
 * @param {number} worldGy
 * @returns {{ junId: string, localGy: number } | null}
 */
export function stackLocalJunRowFromWorldGy(worldGy) {
  const wy = Math.trunc(Number(worldGy));
  if (!Number.isFinite(wy) || wy < 0) return null;
  let base = 0;
  for (const jid of SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER) {
    if (wy < base + STRATEGIC_COUNTY_MAP_ROWS) {
      return { junId: jid, localGy: wy - base };
    }
    base += STRATEGIC_COUNTY_MAP_ROWS;
  }
  return null;
}

function cloneCellShallow(cell) {
  if (!cell || typeof cell !== 'object') return cell;
  return { ...cell };
}

/**
 * 将颍川、汝南两份合并 JSON 垂直拼成单一 `cells` / `roadCells`（世界坐标行）。
 * @param {{ yingchuan: object, runan: object|null }} p
 * @returns {{ ok: true, cells: object[][], mapColumns: number, mapRows: number, roadCells: Array<{gx:number,gy:number}>, roadConnectivity: '4'|'8', season: string } | { ok: false, error: string }}
 */
export function buildSan1YuVerticalStackFromMergedPayloads({ yingchuan, runan }) {
  const top = yingchuan && typeof yingchuan === 'object' ? yingchuan : null;
  if (!top?.cells?.length || !Array.isArray(top.cells[0])) {
    return { ok: false, error: '颍川合并图无效' };
  }
  const bottom = runan && typeof runan === 'object' ? runan : null;
  const W = Number(top.mapColumns) || 32;
  const Hslice = Math.min(
    STRATEGIC_COUNTY_MAP_ROWS,
    Number(top.mapRows) || STRATEGIC_COUNTY_MAP_ROWS,
    top.cells.length,
  );
  const slices = [{ data: top, offset: 0 }];
  if (bottom?.cells?.length && Array.isArray(bottom.cells[0])) {
    slices.push({ data: bottom, offset: Hslice });
  }

  const merged = [];
  const roadCells = [];
  let season = String(top.season || 'san_1').trim() || 'san_1';
  let roadConnectivity = top.roadConnectivity === '8' ? '8' : '4';

  for (const { data, offset } of slices) {
    if (String(data.season || '').trim()) season = String(data.season).trim();
    if (data.roadConnectivity === '8') roadConnectivity = '8';
    const rows = data.cells;
    const h = Math.min(rows.length, Hslice, STRATEGIC_COUNTY_MAP_ROWS);
    for (let lr = 0; lr < h; lr++) {
      const row = rows[lr];
      const outRow = [];
      for (let c = 0; c < W; c++) {
        const cell = row?.[c];
        outRow.push(cell && typeof cell === 'object' ? cloneCellShallow(cell) : cell ?? null);
      }
      merged.push(outRow);
    }
    const rc = Array.isArray(data.roadCells) ? data.roadCells : [];
    for (const rcItem of rc) {
      const gx = Number(rcItem?.gx ?? rcItem?.[0]);
      const gy = Number(rcItem?.gy ?? rcItem?.[1]);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
      roadCells.push({ gx: Math.trunc(gx), gy: Math.trunc(gy) + offset });
    }
  }

  return {
    ok: true,
    cells: merged,
    mapColumns: W,
    mapRows: merged.length,
    roadCells,
    roadConnectivity,
    season,
  };
}
