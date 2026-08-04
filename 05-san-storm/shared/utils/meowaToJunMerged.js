/**
 * Meowa 郡草图 → 战略语义 merged（31-1 · P1）
 * 须与 meowaToJunMerged.cjs 同步。
 *
 * 水域：meowa tilesetId=water → cell.terrain='lake'（城落点禁 lake/river）
 * 城/战场：由槽位坐标写入（P2 工坊填充后生效）；P1 可无坐标。
 */

import { validateJunSlots } from './junMapAuthoring.js';

export const WATER_TILESET_IDS = new Set(['water', 'lava']);

/**
 * @param {object} meowaMap — meowa-map 的 `map` 节点
 * @returns {Record<string|number, { tilesetId?: string }|null>}
 */
export function resolveMeowaStampGrid(meowaMap) {
  if (!meowaMap || typeof meowaMap !== 'object') return {};
  if (meowaMap.grid && typeof meowaMap.grid === 'object') return meowaMap.grid;
  const layers = Array.isArray(meowaMap.layers) ? meowaMap.layers : [];
  const def = layers.find((l) => l && l.name === 'default layer' && l.grid);
  if (def?.grid) return def.grid;
  const any = layers.find((l) => l && l.grid);
  return any?.grid || {};
}

/**
 * @param {object} meowaMap
 * @param {{ mapColumns: number, mapRows: number }} size
 * @returns {{ cells: object[][], waterCount: number, grassCount: number, emptyCount: number }}
 */
export function buildCellsFromMeowaMap(meowaMap, size) {
  const cols = Number(size.mapColumns);
  const rows = Number(size.mapRows);
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols <= 0 || rows <= 0) {
    throw new Error('mapColumns/mapRows 非法');
  }
  const widthTiles = Number(meowaMap.widthTiles ?? meowaMap.mapColumns);
  const heightTiles = Number(meowaMap.heightTiles ?? meowaMap.mapRows);
  if (widthTiles !== cols || heightTiles !== rows) {
    throw new Error(
      `Meowa 尺寸 ${widthTiles}x${heightTiles} 与目标 ${cols}x${rows} 不一致`,
    );
  }

  const stampGrid = resolveMeowaStampGrid(meowaMap);
  const cells = [];
  let waterCount = 0;
  let grassCount = 0;
  let emptyCount = 0;

  for (let row = 0; row < rows; row += 1) {
    const line = [];
    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col;
      const stamp = stampGrid[idx] ?? stampGrid[String(idx)] ?? null;
      const tilesetId = stamp && typeof stamp === 'object' ? stamp.tilesetId : null;
      const isWater = tilesetId != null && WATER_TILESET_IDS.has(String(tilesetId));
      if (isWater) waterCount += 1;
      else if (tilesetId) grassCount += 1;
      else emptyCount += 1;

      const quad = row < Math.floor(rows / 2) ? 'A' : 'B';
      line.push({
        col,
        row,
        base: 'plain_grassland',
        terrain: isWater ? 'lake' : null,
        object: null,
        effect: null,
        quad,
        meowaTilesetId: tilesetId || null,
      });
    }
    cells.push(line);
  }

  return { cells, waterCount, grassCount, emptyCount };
}

/**
 * 在 cells 上打城 2×2（锚点左上角）
 * @param {object[][]} cells
 * @param {{ cityId: string, name?: string, kind?: string, anchorGx: number, anchorGy: number }[]} cities
 */
export function applyCityFootprints(cells, cities) {
  const rows = cells.length;
  const cols = cells[0]?.length || 0;
  for (const city of cities) {
    const gx = Number(city.anchorGx);
    const gy = Number(city.anchorGy);
    if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
    // slots.kind 权威为 city_*（与 city_type 对齐）；短写 major/medium/small 仅兼容旧稿
    const object =
      city.kind === 'city_gate'
        ? 'city_gate'
        : city.kind === 'city_major' || city.kind === 'major'
          ? 'city_major'
          : city.kind === 'city_medium' || city.kind === 'medium'
            ? 'city_medium'
            : city.kind === 'city_small' || city.kind === 'small'
              ? 'city_small'
              : 'city_small';
    for (let dy = 0; dy < 2; dy += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const x = gx + dx;
        const y = gy + dy;
        if (y < 0 || x < 0 || y >= rows || x >= cols) {
          throw new Error(`城 ${city.cityId} 2x2 越界 anchor=(${gx},${gy})`);
        }
        const cell = cells[y][x];
        if (cell.terrain === 'lake' || cell.terrain === 'river') {
          throw new Error(`城 ${city.cityId} 与水域重叠 (${x},${y})`);
        }
        if (cell.cityId && cell.cityId !== city.cityId) {
          throw new Error(`城 ${city.cityId} 与 ${cell.cityId} 重叠 (${x},${y})`);
        }
        if (cell.battlefieldId) {
          throw new Error(`城 ${city.cityId} 与战场入口重叠 (${x},${y})`);
        }
        cell.object = object;
        cell.cityId = city.cityId;
        cell.cityName = city.name || city.cityId;
      }
    }
  }
}

/**
 * 战场多格入口
 * @param {object[][]} cells
 * @param {{ battlefieldId: string, object?: string, banditPoiId?: string, entryCells?: Array<{gx:number,gy:number}|number[]> }} battlefield
 */
export function applyBattlefieldEntries(cells, battlefield) {
  if (!battlefield || !Array.isArray(battlefield.entryCells)) return;
  const rows = cells.length;
  const cols = cells[0]?.length || 0;
  const object = battlefield.object || 'jun_battlefield';
  const banditPoiId =
    battlefield.banditPoiId != null && String(battlefield.banditPoiId).trim()
      ? String(battlefield.banditPoiId).trim()
      : null;
  for (const raw of battlefield.entryCells) {
    const gx = Number(raw?.gx ?? raw?.[0]);
    const gy = Number(raw?.gy ?? raw?.[1]);
    if (!Number.isInteger(gx) || !Number.isInteger(gy)) {
      throw new Error('battlefield.entryCells 含非法格');
    }
    if (gy < 0 || gx < 0 || gy >= rows || gx >= cols) {
      throw new Error(`战场入口越界 (${gx},${gy})`);
    }
    const cell = cells[gy][gx];
    if (cell.cityId) {
      throw new Error(`战场入口与城重叠 (${gx},${gy})`);
    }
    cell.object = object;
    cell.battlefieldId = battlefield.battlefieldId;
    cell.battlefieldZone = 'entry';
    if (banditPoiId) cell.banditPoiId = banditPoiId;
    if (battlefield.displayName) cell.battlefieldDisplayName = String(battlefield.displayName);
  }
}

/**
 * 战场中心信息区（不叠旧瓦片立绘 object；写 battlefieldZone=info）
 * @param {object[][]} cells
 * @param {{ battlefieldId: string, banditPoiId?: string, infoRect?: { anchorGx:number, anchorGy:number, width:number, height:number } }} battlefield
 */
export function applyBattlefieldInfoRect(cells, battlefield) {
  const ir = battlefield?.infoRect;
  if (!battlefield || !ir || typeof ir !== 'object') return;
  const rows = cells.length;
  const cols = cells[0]?.length || 0;
  const ax = Number(ir.anchorGx);
  const ay = Number(ir.anchorGy);
  const w = Number(ir.width);
  const h = Number(ir.height);
  if (!Number.isInteger(ax) || !Number.isInteger(ay) || !Number.isInteger(w) || !Number.isInteger(h)) {
    throw new Error('battlefield.infoRect 非法');
  }
  const banditPoiId =
    battlefield.banditPoiId != null && String(battlefield.banditPoiId).trim()
      ? String(battlefield.banditPoiId).trim()
      : null;
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const x = ax + dx;
      const y = ay + dy;
      if (y < 0 || x < 0 || y >= rows || x >= cols) {
        throw new Error(`战场信息区越界 (${x},${y})`);
      }
      const cell = cells[y][x];
      if (cell.cityId) {
        throw new Error(`战场信息区与城重叠 (${x},${y})`);
      }
      if (cell.object === 'jun_battlefield' && cell.battlefieldZone === 'entry') {
        throw new Error(`战场信息区与入口重叠 (${x},${y})`);
      }
      cell.battlefieldId = battlefield.battlefieldId;
      cell.battlefieldZone = 'info';
      if (banditPoiId) cell.banditPoiId = banditPoiId;
      if (battlefield.displayName) cell.battlefieldDisplayName = String(battlefield.displayName);
    }
  }
}

/**
 * @param {object|null|undefined} previousMerged
 * @param {{ mapColumns: number, mapRows: number }} size
 * @returns {{ roadCells: Array<{gx:number,gy:number}>, roadConnectivity: string, preserved: boolean }}
 */
export function resolveRoadLayer(previousMerged, size) {
  const empty = { roadCells: [], roadConnectivity: '4', preserved: false };
  if (!previousMerged || typeof previousMerged !== 'object') return empty;
  const prevCols = Number(previousMerged.mapColumns);
  const prevRows = Number(previousMerged.mapRows);
  const roads = previousMerged.roadCells;
  if (!Array.isArray(roads) || roads.length === 0) return empty;
  if (prevCols !== size.mapColumns || prevRows !== size.mapRows) {
    return empty;
  }
  const roadCells = roads
    .map((r) => {
      if (Array.isArray(r)) return { gx: Number(r[0]), gy: Number(r[1]) };
      return { gx: Number(r.gx), gy: Number(r.gy) };
    })
    .filter((r) => Number.isInteger(r.gx) && Number.isInteger(r.gy));
  return {
    roadCells,
    roadConnectivity: previousMerged.roadConnectivity === '8' ? '8' : '4',
    preserved: roadCells.length > 0,
  };
}

/**
 * @param {object} opts
 * @param {object} opts.meowaDoc — 完整 meowa-map JSON
 * @param {object} opts.slots — *.slots.json
 * @param {object|null} [opts.previousMerged]
 * @param {object} [opts.visualRef]
 * @param {string} [opts.season]
 * @param {number|string} [opts.seed]
 */
export function buildJunMergedFromMeowa(opts) {
  const slots = opts?.slots;
  const slotCheck = validateJunSlots(slots);
  if (!slotCheck.ok) {
    throw new Error(`slots 校验失败: ${slotCheck.errors.join('; ')}`);
  }

  const meowaDoc = opts.meowaDoc;
  const meowaMap = meowaDoc?.map || meowaDoc;
  if (!meowaMap || typeof meowaMap !== 'object') {
    throw new Error('meowaDoc.map 缺失');
  }

  const size = {
    mapColumns: Number(slots.mapColumns),
    mapRows: Number(slots.mapRows),
  };

  const built = buildCellsFromMeowaMap(meowaMap, size);
  const placedCities = (slots.cities || [])
    .filter((c) => c.anchorGx != null && c.anchorGy != null)
    .map((c) => ({
      cityId: c.cityId,
      name: c.name,
      kind: c.kind,
      anchorGx: c.anchorGx,
      anchorGy: c.anchorGy,
    }));
  applyCityFootprints(built.cells, placedCities);
  applyBattlefieldEntries(built.cells, slots.battlefield);
  applyBattlefieldInfoRect(built.cells, slots.battlefield);

  const road = resolveRoadLayer(opts.previousMerged || null, size);
  const now = new Date().toISOString();

  return {
    merged: {
      version: Date.now(),
      junId: slots.junId,
      season: opts.season || 'san_1',
      generatedAt: now,
      seed: opts.seed ?? null,
      mapColumns: size.mapColumns,
      mapRows: size.mapRows,
      layout_profile: slots.layoutProfile,
      cells: built.cells,
      roadCells: road.roadCells,
      roadConnectivity: road.roadConnectivity,
      visualRef: opts.visualRef || null,
      source: {
        kind: 'meowa_to_jun_merged',
        pipeline: '31-1-P1',
      },
    },
    stats: {
      waterCount: built.waterCount,
      grassCount: built.grassCount,
      emptyCount: built.emptyCount,
      citiesPlaced: placedCities.length,
      battlefieldEntries: Array.isArray(slots.battlefield?.entryCells)
        ? slots.battlefield.entryCells.length
        : 0,
      roadPreserved: road.preserved,
      roadCellCount: road.roadCells.length,
      slotWarnings: slotCheck.warnings,
    },
  };
}

