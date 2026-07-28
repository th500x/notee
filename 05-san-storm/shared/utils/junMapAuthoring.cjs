/**
 * 战略大地图作者层纯函数（31-1 · P0+）
 * 槽位校验、Meowa 尺寸、CDN URL 收集。须与 junMapAuthoring.js 同步。
 */

const JUN_BATTLEFIELD_OBJECT = 'jun_battlefield';

const LAYOUT_PROFILES = new Set(['2x1_v', '2x1_h', '2x2']);

/** slots.cities[].kind：与库 `cities.city_type` / 地图 object 四型对齐 */
const SLOT_CITY_KINDS = new Set([
  'city_major',
  'city_medium',
  'city_small',
  'city_gate',
]);

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function collectHttpUrls(value) {
  const out = new Set();
  function walk(v) {
    if (typeof v === 'string') {
      if (/^https?:\/\//i.test(v)) out.add(v);
      return;
    }
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    for (const item of Object.values(v)) walk(item);
  }
  walk(value);
  return [...out].sort();
}

/**
 * @param {string} url
 * @returns {string}
 */
function urlBasename(url) {
  try {
    const u = new URL(url);
    const raw = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return raw || url;
  } catch {
    const parts = String(url).split('/');
    return decodeURIComponent(parts[parts.length - 1] || url);
  }
}

/**
 * @param {object|null|undefined} map — meowa-map.json 的 `map` 或顶层含 widthTiles 的对象
 * @param {{ mapColumns: number, mapRows: number }} expected
 * @returns {{ ok: boolean, errors: string[], widthTiles?: number, heightTiles?: number, tileSize?: number }}
 */
function assertMeowaMapSize(map, expected) {
  const errors = [];
  if (!map || typeof map !== 'object') {
    return { ok: false, errors: ['meowa map 缺失或非对象'] };
  }
  const widthTiles = Number(map.widthTiles ?? map.mapColumns);
  const heightTiles = Number(map.heightTiles ?? map.mapRows);
  const tileSize = Number(map.tileSize);
  if (!Number.isFinite(widthTiles) || !Number.isFinite(heightTiles)) {
    errors.push('缺少 widthTiles/heightTiles');
  } else {
    if (widthTiles !== expected.mapColumns) {
      errors.push(`widthTiles=${widthTiles} 期望 ${expected.mapColumns}`);
    }
    if (heightTiles !== expected.mapRows) {
      errors.push(`heightTiles=${heightTiles} 期望 ${expected.mapRows}`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    widthTiles: Number.isFinite(widthTiles) ? widthTiles : undefined,
    heightTiles: Number.isFinite(heightTiles) ? heightTiles : undefined,
    tileSize: Number.isFinite(tileSize) ? tileSize : undefined,
  };
}

/**
 * @param {object|null|undefined} slots — *.slots.json
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
function validateJunSlots(slots) {
  const errors = [];
  const warnings = [];
  if (!slots || typeof slots !== 'object') {
    return { ok: false, errors: ['slots 缺失或非对象'], warnings };
  }

  if (!slots.junId || typeof slots.junId !== 'string') {
    errors.push('junId 必填');
  }
  if (!LAYOUT_PROFILES.has(slots.layoutProfile)) {
    errors.push(`layoutProfile 非法: ${slots.layoutProfile}`);
  }

  const mapColumns = Number(slots.mapColumns);
  const mapRows = Number(slots.mapRows);
  if (!Number.isFinite(mapColumns) || mapColumns <= 0) errors.push('mapColumns 非法');
  if (!Number.isFinite(mapRows) || mapRows <= 0) errors.push('mapRows 非法');

  const cities = Array.isArray(slots.cities) ? slots.cities : null;
  if (!cities) {
    errors.push('cities 须为数组');
  } else {
    if (cities.length === 0) errors.push('cities 不能为空');
    const ids = new Set();
    for (let i = 0; i < cities.length; i += 1) {
      const c = cities[i];
      const label = `cities[${i}]`;
      if (!c || typeof c !== 'object') {
        errors.push(`${label} 非对象`);
        continue;
      }
      if (!c.cityId || typeof c.cityId !== 'string') errors.push(`${label}.cityId 必填`);
      else if (ids.has(c.cityId)) errors.push(`${label}.cityId 重复: ${c.cityId}`);
      else ids.add(c.cityId);
      if (c.footprint && c.footprint !== '2x2') {
        errors.push(`${label}.footprint 须为 2x2（城/关）`);
      }
      if (!c.kind || !SLOT_CITY_KINDS.has(c.kind)) {
        errors.push(
          `${label}.kind 须为 city_major|city_medium|city_small|city_gate（与 city_type 对齐；勿写 medium/small）`,
        );
      }
      const ax = c.anchorGx;
      const ay = c.anchorGy;
      const axSet = ax != null && ax !== '';
      const aySet = ay != null && ay !== '';
      if (axSet !== aySet) {
        errors.push(`${label} anchorGx/anchorGy 须成对填写或同为 null`);
      }
      if (axSet && aySet) {
        const gx = Number(ax);
        const gy = Number(ay);
        if (!Number.isInteger(gx) || !Number.isInteger(gy)) {
          errors.push(`${label} 锚点须为整数格`);
        } else if (
          Number.isFinite(mapColumns) &&
          Number.isFinite(mapRows) &&
          (gx < 0 || gy < 0 || gx + 1 >= mapColumns || gy + 1 >= mapRows)
        ) {
          errors.push(`${label} 2x2 锚点越界 (${gx},${gy})`);
        }
      } else {
        warnings.push(`${label} 坐标未录入（待工坊点选）`);
      }
    }
  }

  const bf = slots.battlefield;
  if (!bf || typeof bf !== 'object') {
    errors.push('battlefield 必填');
  } else {
    if (!bf.battlefieldId || typeof bf.battlefieldId !== 'string') {
      errors.push('battlefield.battlefieldId 必填');
    }
    if (bf.object && bf.object !== JUN_BATTLEFIELD_OBJECT) {
      warnings.push(
        `battlefield.object=${bf.object}（约定枚举为 ${JUN_BATTLEFIELD_OBJECT}）`,
      );
    }
    const entries = bf.entryCells;
    if (entries == null) {
      warnings.push('battlefield.entryCells 未定义（待工坊点选）');
    } else if (!Array.isArray(entries)) {
      errors.push('battlefield.entryCells 须为数组');
    } else if (entries.length === 0) {
      warnings.push('battlefield.entryCells 为空（待工坊点选）');
    } else {
      if (entries.length !== 4) {
        warnings.push(`battlefield.entryCells 长度=${entries.length}（颍川约定 4 角）`);
      }
      for (let i = 0; i < entries.length; i += 1) {
        const cell = entries[i];
        const gx = Number(cell?.gx ?? cell?.[0]);
        const gy = Number(cell?.gy ?? cell?.[1]);
        if (!Number.isInteger(gx) || !Number.isInteger(gy)) {
          errors.push(`battlefield.entryCells[${i}] 非法`);
        } else if (
          Number.isFinite(mapColumns) &&
          Number.isFinite(mapRows) &&
          (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows)
        ) {
          errors.push(`battlefield.entryCells[${i}] 越界 (${gx},${gy})`);
        }
      }
    }
    const ir = bf.infoRect;
    if (ir != null) {
      if (typeof ir !== 'object') {
        errors.push('battlefield.infoRect 须为对象');
      } else {
        const ax = Number(ir.anchorGx);
        const ay = Number(ir.anchorGy);
        const w = Number(ir.width);
        const h = Number(ir.height);
        if (!Number.isInteger(ax) || !Number.isInteger(ay) || !Number.isInteger(w) || !Number.isInteger(h)) {
          errors.push('battlefield.infoRect 锚点/宽高须为整数');
        } else if (w <= 0 || h <= 0) {
          errors.push('battlefield.infoRect width/height 须为正');
        } else if (
          Number.isFinite(mapColumns) &&
          Number.isFinite(mapRows) &&
          (ax < 0 || ay < 0 || ax + w > mapColumns || ay + h > mapRows)
        ) {
          errors.push(`battlefield.infoRect 越界 anchor=(${ax},${ay}) ${w}x${h}`);
        }
      }
    }
    if (bf.banditPoiId != null && typeof bf.banditPoiId !== 'string') {
      errors.push('battlefield.banditPoiId 须为字符串');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = {
  JUN_BATTLEFIELD_OBJECT,
  LAYOUT_PROFILES,
  SLOT_CITY_KINDS,
  collectHttpUrls,
  urlBasename,
  assertMeowaMapSize,
  validateJunSlots,
};
