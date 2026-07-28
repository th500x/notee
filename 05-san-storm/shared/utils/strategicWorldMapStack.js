/**
 * 战略大地图 · S1 豫州叠图（31-1）
 *
 * P4 定稿几何（JUN_MAP_LAYOUT_2x1_DRAFT §3）：
 *   颍川 16×40 @ (0,0) + 右上 VOID 16×40 @ (16,0) + 汝南 32×20 @ (0,40)
 *   → 世界 **32×60** L 形。废止旧 C3 飞地行政特例。
 *
 * 仍导出 `buildSan1YuVerticalStackFromMergedPayloads` 作为加载入口（内部分派 L / 同宽垂直 / 单郡）。
 */

/** 颍川行高；亦为「上半带」高度（含 VOID） */
export const STRATEGIC_COUNTY_MAP_ROWS = 40;

/** S1 豫州叠图郡顺序（叙事：颍川上、汝南下） */
export const SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER = ['san_1_jun_yingchuan', 'san_1_jun_runan'];

/** L 形世界包络 */
export const SAN1_YU_L_WORLD_COLS = 32;
export const SAN1_YU_L_WORLD_ROWS = 60;
export const SAN1_YU_YINGCHUAN_COLS = 16;
export const SAN1_YU_YINGCHUAN_ROWS = 40;
export const SAN1_YU_RUNAN_COLS = 32;
export const SAN1_YU_RUNAN_ROWS = 20;
export const SAN1_YU_RUNAN_WORLD_ROW_OFFSET = 40;

/**
 * @param {string} junId
 * @returns {{ cols: number, rows: number, profile: string }|null}
 */
export function san1YuJunLayoutSpec(junId) {
  const j = String(junId || '').trim();
  if (j === 'san_1_jun_yingchuan') {
    return { cols: SAN1_YU_YINGCHUAN_COLS, rows: SAN1_YU_YINGCHUAN_ROWS, profile: '2x1_v' };
  }
  if (j === 'san_1_jun_runan') {
    return { cols: SAN1_YU_RUNAN_COLS, rows: SAN1_YU_RUNAN_ROWS, profile: '2x1_h' };
  }
  return null;
}

/**
 * L 形右上 VOID：`wx∈[16,31]` `wy∈[0,39]`（不可立足 / 不可行军）
 * @param {number} gx 世界列
 * @param {number} gy 世界行
 */
export function isSan1YuLStackVoidCell(gx, gy) {
  const gxi = Math.trunc(Number(gx));
  const gyi = Math.trunc(Number(gy));
  if (!Number.isFinite(gxi) || !Number.isFinite(gyi)) return false;
  return gxi >= SAN1_YU_YINGCHUAN_COLS && gxi < SAN1_YU_L_WORLD_COLS && gyi >= 0 && gyi < SAN1_YU_YINGCHUAN_ROWS;
}

/**
 * 行政郡 id（道路郡界着色）。VOID 返回 `null`（无行政）。
 * @param {number} gx
 * @param {number} gy 世界行
 * @returns {'san_1_jun_yingchuan'|'san_1_jun_runan'|null}
 */
export function san1YuStrategicAdminJunIdAtWorldCell(gx, gy) {
  const gxi = Math.trunc(Number(gx));
  const gyi = Math.trunc(Number(gy));
  if (!Number.isFinite(gxi) || !Number.isFinite(gyi)) return 'san_1_jun_yingchuan';
  if (isSan1YuLStackVoidCell(gxi, gyi)) return null;
  if (gyi >= SAN1_YU_RUNAN_WORLD_ROW_OFFSET) return 'san_1_jun_runan';
  if (gxi >= 0 && gxi < SAN1_YU_YINGCHUAN_COLS && gyi >= 0 && gyi < SAN1_YU_YINGCHUAN_ROWS) {
    return 'san_1_jun_yingchuan';
  }
  return null;
}

/**
 * L 形接缝引导线：颍川南缘 × 汝南 A 北缘（`y=40, x∈[0,16]`）+ 颍川东缘邻 VOID（`x=16, y∈[0,40]`）。
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {string}
 */
export function buildSan1YuStrategicSeamGuidePathD(mapColumns, mapRows) {
  const W = Math.max(0, Math.trunc(Number(mapColumns)) || 0);
  const H = Math.max(0, Math.trunc(Number(mapRows)) || 0);
  if (W < 2 || H < 2) return '';

  const pieces = [];
  const seamY = SAN1_YU_RUNAN_WORLD_ROW_OFFSET;
  const voidX = SAN1_YU_YINGCHUAN_COLS;

  if (H >= SAN1_YU_L_WORLD_ROWS && W >= SAN1_YU_L_WORLD_COLS) {
    const xSeamEnd = Math.min(W, voidX);
    if (xSeamEnd > 0) pieces.push(`M 0 ${seamY} L ${xSeamEnd} ${seamY}`);
    if (voidX <= W) pieces.push(`M ${voidX} 0 L ${voidX} ${Math.min(H, seamY)}`);
  } else if (H > STRATEGIC_COUNTY_MAP_ROWS && W > 0) {
    pieces.push(`M 0 ${STRATEGIC_COUNTY_MAP_ROWS} L ${W} ${STRATEGIC_COUNTY_MAP_ROWS}`);
  }

  return pieces.join(' ');
}

/**
 * @param {string} junId
 * @returns {number} 世界行起点（颍川 0、汝南 40）
 */
export function stackWorldRowOffsetForJunId(junId) {
  const j = String(junId || '').trim();
  if (j === 'san_1_jun_runan') return SAN1_YU_RUNAN_WORLD_ROW_OFFSET;
  return 0;
}

/**
 * @param {string} junId
 * @param {number} localGy
 * @returns {number}
 */
export function stackWorldGyFromLocalJunRow(junId, localGy) {
  return stackWorldRowOffsetForJunId(junId) + Math.max(0, Math.trunc(Number(localGy)));
}

/**
 * 世界行 → 郡内行。可选 `worldGx`：落在 VOID 时返回 null。
 * @param {number} worldGy
 * @param {number} [worldGx]
 * @returns {{ junId: string, localGy: number } | null}
 */
export function stackLocalJunRowFromWorldGy(worldGy, worldGx) {
  const wy = Math.trunc(Number(worldGy));
  if (!Number.isFinite(wy) || wy < 0) return null;

  if (wy < SAN1_YU_YINGCHUAN_ROWS) {
    if (worldGx != null && worldGx !== '') {
      const gx = Math.trunc(Number(worldGx));
      if (Number.isFinite(gx) && isSan1YuLStackVoidCell(gx, wy)) return null;
    }
    return { junId: 'san_1_jun_yingchuan', localGy: wy };
  }

  if (wy < SAN1_YU_L_WORLD_ROWS) {
    return {
      junId: 'san_1_jun_runan',
      localGy: wy - SAN1_YU_RUNAN_WORLD_ROW_OFFSET,
    };
  }
  return null;
}

function cloneCellShallow(cell) {
  if (!cell || typeof cell !== 'object') return cell;
  return { ...cell };
}

function makeVoidCell(col, row) {
  return {
    col,
    row,
    base: 'plain_wasteland',
    terrain: null,
    object: null,
    effect: null,
    isVoid: true,
    voidBand: true,
  };
}

function detectRunanIs2x1h(runan) {
  if (!runan || typeof runan !== 'object') return false;
  const cols = Number(runan.mapColumns);
  const rows = Number(runan.mapRows);
  const profile = String(runan.layout_profile || runan.layoutProfile || '').trim();
  if (profile === '2x1_h' && cols === SAN1_YU_RUNAN_COLS && rows === SAN1_YU_RUNAN_ROWS) return true;
  return cols === SAN1_YU_RUNAN_COLS && rows === SAN1_YU_RUNAN_ROWS;
}

function detectYingchuanIs2x1v(yingchuan) {
  if (!yingchuan || typeof yingchuan !== 'object') return false;
  const cols = Number(yingchuan.mapColumns);
  const rows = Number(yingchuan.mapRows);
  const profile = String(yingchuan.layout_profile || yingchuan.layoutProfile || '').trim();
  if (profile === '2x1_v' && cols === SAN1_YU_YINGCHUAN_COLS && rows === SAN1_YU_YINGCHUAN_ROWS) {
    return true;
  }
  return cols === SAN1_YU_YINGCHUAN_COLS && rows === SAN1_YU_YINGCHUAN_ROWS;
}

/**
 * P4：颍川 16×40 + VOID + 汝南 32×20 → 世界 32×60
 * @param {{ yingchuan: object, runan: object }} p
 */
export function buildSan1YuLStackFromMergedPayloads({ yingchuan, runan }) {
  const top = yingchuan && typeof yingchuan === 'object' ? yingchuan : null;
  const bottom = runan && typeof runan === 'object' ? runan : null;
  if (!top?.cells?.length || !Array.isArray(top.cells[0])) {
    return { ok: false, error: '颍川合并图无效' };
  }
  if (!bottom?.cells?.length || !Array.isArray(bottom.cells[0])) {
    return { ok: false, error: '汝南合并图无效（L 形需要 32×20 / 2x1_h）' };
  }
  if (!detectYingchuanIs2x1v(top)) {
    return {
      ok: false,
      error: `颍川须为 16×40 (2x1_v)，实际 ${top.mapColumns}x${top.mapRows}`,
    };
  }
  if (!detectRunanIs2x1h(bottom)) {
    return {
      ok: false,
      error: `汝南须为 32×20 (2x1_h)，实际 ${bottom.mapColumns}x${bottom.mapRows}`,
    };
  }

  const W = SAN1_YU_L_WORLD_COLS;
  const H = SAN1_YU_L_WORLD_ROWS;
  const merged = [];
  for (let wy = 0; wy < H; wy += 1) {
    const outRow = [];
    for (let wx = 0; wx < W; wx += 1) {
      if (wy < SAN1_YU_YINGCHUAN_ROWS) {
        if (wx < SAN1_YU_YINGCHUAN_COLS) {
          const cell = top.cells[wy]?.[wx];
          outRow.push(cell && typeof cell === 'object' ? cloneCellShallow(cell) : cell ?? null);
        } else {
          outRow.push(makeVoidCell(wx, wy));
        }
      } else {
        const ly = wy - SAN1_YU_RUNAN_WORLD_ROW_OFFSET;
        const cell = bottom.cells[ly]?.[wx];
        outRow.push(cell && typeof cell === 'object' ? cloneCellShallow(cell) : cell ?? null);
      }
    }
    merged.push(outRow);
  }

  const roadCells = [];
  const pushRoads = (data, worldGyOffset, maxGx, maxGy) => {
    const rc = Array.isArray(data.roadCells) ? data.roadCells : [];
    for (const item of rc) {
      const gx = Number(item?.gx ?? item?.[0]);
      const gy = Number(item?.gy ?? item?.[1]);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
      const tx = Math.trunc(gx);
      const ty = Math.trunc(gy) + worldGyOffset;
      if (tx < 0 || ty < 0 || tx >= maxGx || Math.trunc(gy) >= maxGy) continue;
      if (isSan1YuLStackVoidCell(tx, ty)) continue;
      roadCells.push({ gx: tx, gy: ty });
    }
  };
  pushRoads(top, 0, SAN1_YU_YINGCHUAN_COLS, SAN1_YU_YINGCHUAN_ROWS);
  pushRoads(bottom, SAN1_YU_RUNAN_WORLD_ROW_OFFSET, SAN1_YU_RUNAN_COLS, SAN1_YU_RUNAN_ROWS);

  let season = String(top.season || bottom.season || 'san_1').trim() || 'san_1';
  let roadConnectivity = '4';
  if (top.roadConnectivity === '8' || bottom.roadConnectivity === '8') roadConnectivity = '8';

  return {
    ok: true,
    cells: merged,
    mapColumns: W,
    mapRows: H,
    roadCells,
    roadConnectivity,
    season,
    mode: 'l_stack',
    includedJunIds: ['san_1_jun_yingchuan', 'san_1_jun_runan'],
    widthMismatch: false,
  };
}

/**
 * 同宽垂直叠（旧 32×40+32×40）；列宽不一致且非 L 形条件时仅颍川单郡。
 * @param {{ yingchuan: object, runan: object|null }} p
 */
export function buildSan1YuVerticalStackFromMergedPayloads({ yingchuan, runan }) {
  const top = yingchuan && typeof yingchuan === 'object' ? yingchuan : null;
  if (!top?.cells?.length || !Array.isArray(top.cells[0])) {
    return { ok: false, error: '颍川合并图无效' };
  }
  const bottom = runan && typeof runan === 'object' ? runan : null;

  if (detectYingchuanIs2x1v(top) && bottom && detectRunanIs2x1h(bottom)) {
    return buildSan1YuLStackFromMergedPayloads({ yingchuan: top, runan: bottom });
  }

  if (detectYingchuanIs2x1v(top) && bottom?.cells?.length) {
    const bottomW = Number(bottom.mapColumns);
    const bottomH = Number(bottom.mapRows);
    console.error(
      '[strategicWorldMapStack] 颍川已是 2x1_v，但汝南不是 32×20/2x1_h；P4 需要裁汝南或 Meowa。暂仅加载颍川单郡。',
      { runanCols: bottomW, runanRows: bottomH, layout: bottom.layout_profile },
    );
    return buildSingleCountyFromYingchuan(top, true);
  }

  const W = Number(top.mapColumns);
  if (!Number.isFinite(W) || W <= 0) {
    return { ok: false, error: '颍川合并图缺少有效 mapColumns' };
  }
  const Hslice = Math.min(
    STRATEGIC_COUNTY_MAP_ROWS,
    Number(top.mapRows) || STRATEGIC_COUNTY_MAP_ROWS,
    top.cells.length,
  );

  let includeBottom = false;
  let widthMismatch = false;
  if (bottom?.cells?.length && Array.isArray(bottom.cells[0])) {
    const bottomW = Number(bottom.mapColumns);
    if (!Number.isFinite(bottomW) || bottomW !== W) {
      widthMismatch = true;
      console.error(
        '[strategicWorldMapStack] 颍川/汝南 mapColumns 不一致且非 L 形条件，仅加载颍川单郡',
        {
          yingchuanCols: W,
          runanCols: Number.isFinite(bottomW) ? bottomW : null,
        },
      );
    } else {
      includeBottom = true;
    }
  }

  if (!includeBottom) {
    return buildSingleCountyFromYingchuan(top, widthMismatch);
  }

  const slices = [
    { data: top, offset: 0, junId: 'san_1_jun_yingchuan' },
    { data: bottom, offset: Hslice, junId: 'san_1_jun_runan' },
  ];
  const merged = [];
  const roadCells = [];
  let season = String(top.season || 'san_1').trim() || 'san_1';
  let roadConnectivity = top.roadConnectivity === '8' ? '8' : '4';
  const includedJunIds = [];

  for (const { data, offset, junId } of slices) {
    includedJunIds.push(junId);
    if (String(data.season || '').trim()) season = String(data.season).trim();
    if (data.roadConnectivity === '8') roadConnectivity = '8';
    const rows = data.cells;
    const h = Math.min(rows.length, Hslice, STRATEGIC_COUNTY_MAP_ROWS);
    for (let lr = 0; lr < h; lr += 1) {
      const row = rows[lr];
      const outRow = [];
      for (let c = 0; c < W; c += 1) {
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
      const tx = Math.trunc(gx);
      const ty = Math.trunc(gy) + offset;
      if (tx < 0 || tx >= W || ty < 0) continue;
      roadCells.push({ gx: tx, gy: ty });
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
    mode: 'vertical_stack',
    includedJunIds,
    widthMismatch: false,
  };
}

function buildSingleCountyFromYingchuan(top, widthMismatch) {
  const W = Number(top.mapColumns);
  const H = Math.min(
    Number(top.mapRows) || STRATEGIC_COUNTY_MAP_ROWS,
    top.cells.length,
  );
  const merged = [];
  for (let lr = 0; lr < H; lr += 1) {
    const row = top.cells[lr];
    const outRow = [];
    for (let c = 0; c < W; c += 1) {
      const cell = row?.[c];
      outRow.push(cell && typeof cell === 'object' ? cloneCellShallow(cell) : cell ?? null);
    }
    merged.push(outRow);
  }
  const roadCells = [];
  for (const rcItem of Array.isArray(top.roadCells) ? top.roadCells : []) {
    const gx = Number(rcItem?.gx ?? rcItem?.[0]);
    const gy = Number(rcItem?.gy ?? rcItem?.[1]);
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    const tx = Math.trunc(gx);
    const ty = Math.trunc(gy);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
    roadCells.push({ gx: tx, gy: ty });
  }
  return {
    ok: true,
    cells: merged,
    mapColumns: W,
    mapRows: merged.length,
    roadCells,
    roadConnectivity: top.roadConnectivity === '8' ? '8' : '4',
    season: String(top.season || 'san_1').trim() || 'san_1',
    mode: 'single_county',
    includedJunIds: ['san_1_jun_yingchuan'],
    widthMismatch: !!widthMismatch,
  };
}
