/**
 * 战略大地图 2×2 锚点格：类型、城名、可选长官名（与 tooltip / `cityService` 长官字段一致）。
 */

const OBJECT_TO_TYPE = {
  city_major: '大城',
  city_medium: '中城',
  city_small: '小城',
  gate: '关隘',
  fort: '据点',
};

const CITY_TYPE_TO_LABEL = {
  city_major: '大城',
  city_medium: '中城',
  city_small: '小城',
  gate: '关隘',
  fort: '据点',
};

/**
 * @param {object|null|undefined} cityRow - `/api/cities` 行 snake_case / camelCase
 * @param {object|null|undefined} anchorCell - 锚点格（含 cityName、object）
 * @param {string|null|undefined} effectiveObject - 锚点 object 键
 * @returns {{ line1: string, line2: string, line3?: string } | null} - 非 2×2 战略城点或无锚点时返回 null；`line3` 为长官名（有数据时）
 */
export function getStrategicMapCityLabelLines(cityRow, anchorCell, effectiveObject) {
  if (!effectiveObject || !OBJECT_TO_TYPE[effectiveObject]) return null;

  const ct = cityRow?.city_type || cityRow?.cityType;
  const line1 =
    (ct && CITY_TYPE_TO_LABEL[ct]) || OBJECT_TO_TYPE[effectiveObject] || '城池';

  let line2 = '';
  let line3 = null;
  if (cityRow) {
    const rowType = cityRow.city_type || cityRow.cityType;
    if (rowType === 'fort' || effectiveObject === 'fort') {
      const st = cityRow.build_status || cityRow.buildStatus || 'empty';
      if (st === 'built') {
        line2 =
          (cityRow.custom_name || cityRow.customName || '').trim() ||
          (cityRow.city_name || cityRow.cityName || '').trim() ||
          (anchorCell?.cityName || '').trim() ||
          '据点';
      } else {
        line2 = '可建造';
      }
    } else {
      line2 =
        (cityRow.city_name || cityRow.cityName || '').trim() ||
        (anchorCell?.cityName || '').trim() ||
        '—';
      const lord = (cityRow.lordCharacterName ?? cityRow.lord_character_name ?? '').trim();
      if (lord) line3 = lord;
    }
  } else {
    if (effectiveObject === 'fort') {
      line2 = (anchorCell?.cityName || '').trim() || '可建造';
    } else {
      line2 = (anchorCell?.cityName || '').trim() || '—';
    }
  }

  const out = { line1, line2 };
  if (line3) out.line3 = line3;
  return out;
}
