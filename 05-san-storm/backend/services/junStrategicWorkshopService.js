/**
 * 郡战略图工坊（31-1 · P2）：槽位 + Meowa 本地包 → 写入 merged / cities.position_*
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const {
  validateJunSlots,
  JUN_BATTLEFIELD_OBJECT,
} = require('../../shared/utils/junMapAuthoring.cjs');
const { buildJunMergedFromMeowa } = require('../../shared/utils/meowaToJunMerged.cjs');
const { isJunBattlefieldEntryCell } = require('../../shared/utils/junBattlefieldCell.cjs');
const {
  normalizeRoadCellList,
  buildStrategicObjectFootprintBlockedSet,
  ROAD_CONNECTIVITY_4,
} = require('../../shared/utils/strategicRoadOverlay.js');
const SAN_STORM_ROOT = path.join(__dirname, '../..');
const SLOTS_DIR = path.join(SAN_STORM_ROOT, 'docs/tools/map/slots');
const MEOWA_ROOT = path.join(SAN_STORM_ROOT, 'docs/tools/map/meowa');
const MERGED_WORK_DIR = path.join(SAN_STORM_ROOT, 'docs/tools/map/merged');

function mergedJsonRelPath(junId) {
  return `data/worldmap/${String(junId || '').trim()}_merged.json`;
}

function publicMergedAbsPath(junId) {
  return path.join(SAN_STORM_ROOT, 'public', mergedJsonRelPath(junId));
}

function slotsAbsPath(junId) {
  return path.join(SLOTS_DIR, `${junId}.slots.json`);
}

function meowaDir(junId) {
  return path.join(MEOWA_ROOT, junId);
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function writeJson(absPath, data) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function listWorkshopCatalog() {
  if (!fs.existsSync(SLOTS_DIR)) return [];
  const out = [];
  for (const name of fs.readdirSync(SLOTS_DIR)) {
    if (!name.endsWith('.slots.json')) continue;
    const abs = path.join(SLOTS_DIR, name);
    try {
      const slots = readJson(abs);
      const junId = String(slots.junId || name.replace(/\.slots\.json$/, '')).trim();
      const meowaLocal = path.join(meowaDir(junId), 'meowa-map.local.json');
      const mergedAbs = publicMergedAbsPath(junId);
      out.push({
        junId,
        displayName: slots.displayName || junId,
        layoutProfile: slots.layoutProfile || null,
        mapColumns: Number(slots.mapColumns) || null,
        mapRows: Number(slots.mapRows) || null,
        citySlotCount: Array.isArray(slots.cities) ? slots.cities.length : 0,
        hasMeowaLocal: fs.existsSync(meowaLocal),
        hasMerged: fs.existsSync(mergedAbs),
        hasPreview: fs.existsSync(path.join(meowaDir(junId), 'preview.png')),
      });
    } catch {
      /* skip broken slot files */
    }
  }
  out.sort((a, b) => String(a.junId).localeCompare(String(b.junId)));
  return out;
}

/**
 * 从 merged.cells 反推城锚点（左上角）与战场**入口**格（不含信息区）。
 */
function extractPlacementsFromMerged(merged, slots) {
  const cities = (slots.cities || []).map((c) => ({
    ...c,
    anchorGx: c.anchorGx == null ? null : Number(c.anchorGx),
    anchorGy: c.anchorGy == null ? null : Number(c.anchorGy),
  }));
  const byId = new Map(cities.map((c) => [c.cityId, c]));
  const cityMins = new Map();
  const entryCells = [];
  const bfId = slots.battlefield?.battlefieldId || null;
  const cells = merged?.cells;

  if (Array.isArray(cells)) {
    for (let gy = 0; gy < cells.length; gy += 1) {
      const row = cells[gy] || [];
      for (let gx = 0; gx < row.length; gx += 1) {
        const cell = row[gx];
        if (!cell) continue;
        if (cell.cityId && byId.has(cell.cityId)) {
          const prev = cityMins.get(cell.cityId);
          if (!prev || gx < prev.gx || (gx === prev.gx && gy < prev.gy)) {
            cityMins.set(cell.cityId, { gx, gy });
          }
        }
        // 仅四角入口；勿把 battlefieldZone=info 的中心区当成入口（否则保存会报「信息区与入口重叠」）
        if (
          bfId &&
          String(cell.battlefieldId || '') === String(bfId) &&
          isJunBattlefieldEntryCell(cell)
        ) {
          entryCells.push({ gx, gy });
        }
      }
    }
  }

  for (const [cityId, min] of cityMins) {
    const c = byId.get(cityId);
    if (!c) continue;
    if (c.anchorGx == null || c.anchorGy == null) {
      c.anchorGx = min.gx;
      c.anchorGy = min.gy;
    }
  }

  const slotEntries = Array.isArray(slots.battlefield?.entryCells)
    ? slots.battlefield.entryCells
    : [];
  const resolvedEntries =
    entryCells.length > 0
      ? entryCells
      : slotEntries
          .map((raw) => ({
            gx: Number(raw?.gx ?? raw?.[0]),
            gy: Number(raw?.gy ?? raw?.[1]),
          }))
          .filter((p) => Number.isInteger(p.gx) && Number.isInteger(p.gy));

  return {
    cities,
    battlefield: {
      battlefieldId: slots.battlefield?.battlefieldId || null,
      displayName: slots.battlefield?.displayName || null,
      object: slots.battlefield?.object || JUN_BATTLEFIELD_OBJECT,
      banditPoiId: slots.battlefield?.banditPoiId || null,
      entryCells: resolvedEntries,
      infoRect: slots.battlefield?.infoRect || null,
      note: slots.battlefield?.note || null,
    },
  };
}

function getWorkshopBundle(junId) {
  const jid = String(junId || '').trim();
  if (!jid) {
    const err = new Error('需要 junId');
    err.code = 'VALIDATION';
    throw err;
  }
  const slotsPath = slotsAbsPath(jid);
  if (!fs.existsSync(slotsPath)) {
    const err = new Error(`缺少槽位文件：docs/tools/map/slots/${jid}.slots.json`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const slots = readJson(slotsPath);
  const slotCheck = validateJunSlots(slots);
  if (!slotCheck.ok) {
    const err = new Error(`槽位校验失败：${slotCheck.errors.join('; ')}`);
    err.code = 'VALIDATION';
    throw err;
  }

  const meowaLocalPath = path.join(meowaDir(jid), 'meowa-map.local.json');
  const packPath = path.join(meowaDir(jid), 'meowa-pack.json');
  const previewPath = path.join(meowaDir(jid), 'preview.png');
  const mergedAbs = publicMergedAbsPath(jid);
  if (!fs.existsSync(meowaLocalPath)) {
    const err = new Error('缺少 meowa-map.local.json，请先跑 localize');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!fs.existsSync(mergedAbs)) {
    const err = new Error('缺少运行时 merged，请先跑 convert-meowa-to-merged-p1');
    err.code = 'NO_MERGED_FILE';
    throw err;
  }

  const merged = readJson(mergedAbs);
  const placements = extractPlacementsFromMerged(merged, slots);
  const pack = fs.existsSync(packPath) ? readJson(packPath) : null;

  return {
    junId: jid,
    slots: {
      ...slots,
      cities: placements.cities,
      battlefield: placements.battlefield,
    },
    merged: {
      junId: merged.junId || jid,
      mapColumns: Number(merged.mapColumns),
      mapRows: Number(merged.mapRows),
      layout_profile: merged.layout_profile || slots.layoutProfile,
      cells: merged.cells,
      roadCells: Array.isArray(merged.roadCells) ? merged.roadCells : [],
      roadConnectivity: merged.roadConnectivity === '8' ? '8' : '4',
      visualRef: merged.visualRef || null,
      version: merged.version || null,
      generatedAt: merged.generatedAt || null,
    },
    meowa: {
      hasLocalMap: true,
      hasPreview: fs.existsSync(previewPath),
      packLocalizedAt: pack?.localizedAt || null,
      previewPath: `docs/tools/map/meowa/${jid}/preview.png`,
    },
    warnings: slotCheck.warnings || [],
  };
}

function resolvePreviewAbsPath(junId) {
  const jid = String(junId || '').trim();
  const abs = path.join(meowaDir(jid), 'preview.png');
  if (!fs.existsSync(abs)) {
    const err = new Error('preview.png 不存在');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return abs;
}

function normalizeCityAnchorsPayload(rawCities, slotCities) {
  const byId = new Map((slotCities || []).map((c) => [c.cityId, c]));
  if (!Array.isArray(rawCities)) {
    const err = new Error('cities 须为数组');
    err.code = 'VALIDATION';
    throw err;
  }
  const out = [];
  for (const raw of rawCities) {
    const cityId = String(raw?.cityId || '').trim();
    if (!cityId || !byId.has(cityId)) {
      const err = new Error(`未知城槽 cityId=${cityId || '(空)'}`);
      err.code = 'VALIDATION';
      throw err;
    }
    const slot = byId.get(cityId);
    const anchorGx = raw.anchorGx == null || raw.anchorGx === '' ? null : Number(raw.anchorGx);
    const anchorGy = raw.anchorGy == null || raw.anchorGy === '' ? null : Number(raw.anchorGy);
    if (anchorGx != null || anchorGy != null) {
      if (!Number.isInteger(anchorGx) || !Number.isInteger(anchorGy)) {
        const err = new Error(`城 ${cityId} 锚点须为整数格坐标`);
        err.code = 'VALIDATION';
        throw err;
      }
    }
    out.push({
      ...slot,
      anchorGx,
      anchorGy,
    });
  }
  for (const slot of slotCities || []) {
    if (!out.some((c) => c.cityId === slot.cityId)) {
      out.push({
        ...slot,
        anchorGx: slot.anchorGx == null ? null : Number(slot.anchorGx),
        anchorGy: slot.anchorGy == null ? null : Number(slot.anchorGy),
      });
    }
  }
  out.sort((a, b) => (a.slot || 0) - (b.slot || 0));
  return out;
}

function normalizeEntryCellsPayload(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    const err = new Error('battlefield.entryCells 须为数组');
    err.code = 'VALIDATION';
    throw err;
  }
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const gx = Number(item?.gx ?? item?.[0]);
    const gy = Number(item?.gy ?? item?.[1]);
    if (!Number.isInteger(gx) || !Number.isInteger(gy)) {
      const err = new Error('battlefield.entryCells 含非法格');
      err.code = 'VALIDATION';
      throw err;
    }
    const k = `${gx},${gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ gx, gy });
  }
  out.sort((a, b) => a.gy - b.gy || a.gx - b.gx);
  return out;
}

async function updateCityPositionsInDb(cities) {
  let updated = 0;
  const notFound = [];
  for (const city of cities) {
    if (city.anchorGx == null || city.anchorGy == null) continue;
    const [r] = await pool.query(
      `UPDATE cities SET position_x = ?, position_y = ? WHERE city_id = ?`,
      [city.anchorGx, city.anchorGy, city.cityId],
    );
    if (r.affectedRows > 0) updated += 1;
    else notFound.push(city.cityId);
  }
  return { updated, skippedNotInDb: notFound };
}

/**
 * 整体保存：重算 cells（城/战场）+ 道路 + 写盘 + 城坐标入库 + 回写槽位锚点。
 */
async function saveWorkshop(payload) {
  const junId = String(payload?.junId || '').trim();
  if (!junId) {
    const err = new Error('需要 junId');
    err.code = 'VALIDATION';
    throw err;
  }

  const slotsPath = slotsAbsPath(junId);
  if (!fs.existsSync(slotsPath)) {
    const err = new Error(`缺少槽位文件 ${junId}.slots.json`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  const baseSlots = readJson(slotsPath);
  const meowaLocalPath = path.join(meowaDir(junId), 'meowa-map.local.json');
  if (!fs.existsSync(meowaLocalPath)) {
    const err = new Error('缺少 meowa-map.local.json');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const mergedAbs = publicMergedAbsPath(junId);
  if (!fs.existsSync(mergedAbs)) {
    const err = new Error('缺少运行时 merged');
    err.code = 'NO_MERGED_FILE';
    throw err;
  }

  const previousMerged = readJson(mergedAbs);
  const cities = normalizeCityAnchorsPayload(payload.cities, baseSlots.cities);
  const entryCells = normalizeEntryCellsPayload(
    payload.battlefield?.entryCells ?? payload.entryCells,
  );
  const roadConnectivity =
    payload.roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4;
  const roadCells = normalizeRoadCellList(payload.roadCells);

  const nextSlots = {
    ...baseSlots,
    cities: cities.map((c) => ({
      ...c,
      anchorGx: c.anchorGx,
      anchorGy: c.anchorGy,
    })),
    battlefield: {
      ...(baseSlots.battlefield || {}),
      battlefieldId: baseSlots.battlefield?.battlefieldId,
      displayName: baseSlots.battlefield?.displayName,
      object: baseSlots.battlefield?.object || JUN_BATTLEFIELD_OBJECT,
      entryCells,
      note: baseSlots.battlefield?.note,
    },
  };

  const slotCheck = validateJunSlots(nextSlots);
  if (!slotCheck.ok) {
    const err = new Error(`槽位校验失败：${slotCheck.errors.join('; ')}`);
    err.code = 'VALIDATION';
    throw err;
  }

  const meowaDoc = readJson(meowaLocalPath);
  const visualRef = previousMerged.visualRef || {
    kind: 'meowa_local_pack',
    junId,
    packRoot: `docs/tools/map/meowa/${junId}`,
    authoringMap: 'meowa-map.local.json',
    preview: 'preview.png',
  };

  let built;
  try {
    built = buildJunMergedFromMeowa({
      meowaDoc,
      slots: nextSlots,
      previousMerged: {
        mapColumns: Number(nextSlots.mapColumns),
        mapRows: Number(nextSlots.mapRows),
        roadCells,
        roadConnectivity,
      },
      visualRef,
      season: previousMerged.season || 'san_1',
      seed: previousMerged.seed ?? null,
    });
  } catch (e) {
    const err = new Error(e.message || '合并语义失败');
    err.code = 'VALIDATION';
    throw err;
  }

  const merged = built.merged;
  merged.source = {
    kind: 'jun_strategic_workshop',
    pipeline: '31-1-P2',
  };
  merged.roadCells = roadCells;
  merged.roadConnectivity = roadConnectivity;

  const mapColumns = Number(merged.mapColumns);
  const mapRows = Number(merged.mapRows);
  const blocked = buildStrategicObjectFootprintBlockedSet(merged.cells, mapColumns, mapRows);
  for (const { gx, gy } of roadCells) {
    if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows) {
      const err = new Error(`道路格越界：(${gx},${gy})`);
      err.code = 'OUT_OF_BOUNDS';
      throw err;
    }
    if (blocked.has(`${gx},${gy}`)) {
      const err = new Error(`道路格与城/关 2×2 冲突：(${gx},${gy})`);
      err.code = 'BLOCKED_CELL';
      throw err;
    }
  }

  writeJson(mergedAbs, merged);
  writeJson(path.join(MERGED_WORK_DIR, `${junId}_merged.json`), merged);
  writeJson(slotsPath, nextSlots);

  /** 同步 Meowa 预览到游戏静态目录，供大地图底板使用 */
  try {
    const previewSrc = path.join(meowaDir(junId), 'preview.png');
    if (fs.existsSync(previewSrc)) {
      const previewPublicDir = path.join(SAN_STORM_ROOT, 'public/data/worldmap/previews');
      fs.mkdirSync(previewPublicDir, { recursive: true });
      fs.copyFileSync(previewSrc, path.join(previewPublicDir, `${junId}.png`));
    }
  } catch (e) {
    console.warn('[junStrategicWorkshop] 同步 preview 到 public 失败', e?.message || e);
  }

  const db =
    payload?.skipDb === true
      ? { updated: 0, skippedNotInDb: [], skipped: true }
      : await updateCityPositionsInDb(cities);

  return {
    path: mergedJsonRelPath(junId),
    version: merged.version,
    mapColumns,
    mapRows,
    stats: built.stats,
    roadCellCount: roadCells.length,
    roadConnectivity,
    citiesDb: db,
    warnings: slotCheck.warnings || [],
  };
}

module.exports = {
  listWorkshopCatalog,
  getWorkshopBundle,
  resolvePreviewAbsPath,
  saveWorkshop,
  extractPlacementsFromMerged,
};
