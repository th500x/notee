/**
 * 战略大地图多格 POI 锚点格：匪寨 / 攻方大本营叠字（城池已改右上势力旗，类型改走 tooltip）。
 */

const OBJECT_TO_TYPE = {
  city_major: '大城',
  city_medium: '中城',
  city_small: '小城',
  city_gate: '关隘',
};

function isBanditStrategicObject(effectiveObject) {
  return effectiveObject === 'bandit_horiz' || effectiveObject === 'bandit_vert';
}

const CITY_TYPE_TO_LABEL = {
  city_major: '大城',
  city_medium: '中城',
  city_small: '小城',
  city_gate: '关隘',
};

/**
 * `cities.city_type` / 地图 object → 中文类型（大城/中城/小城/关隘）。
 * @param {string|null|undefined} cityTypeOrObject
 * @returns {string|null}
 */
export function getStrategicCityTypeLabel(cityTypeOrObject) {
  const k = String(cityTypeOrObject || '').trim();
  if (!k) return null;
  return CITY_TYPE_TO_LABEL[k] || OBJECT_TO_TYPE[k] || null;
}

/**
 * @param {object|null|undefined} cityRow - `/api/cities` 行 snake_case / camelCase
 * @param {object|null|undefined} anchorCell - 锚点格（含 cityName、object）
 * @param {string|null|undefined} effectiveObject - 锚点 object 键
 * @returns {{ line1: string, line2: string, line3?: string } | null} - 非战略多格 POI 或无锚点 object 映射时返回 null；`line3` 为长官名（有数据时）
 */
export function getStrategicMapCityLabelLines(cityRow, anchorCell, effectiveObject) {
  if (!effectiveObject) return null;
  if (
    effectiveObject === 'pvp_camp_single' ||
    effectiveObject === 'pvp_camp_horiz' ||
    effectiveObject === 'pvp_camp_vert'
  ) {
    return { line1: '', line2: '营' };
  }
  const banditTile = isBanditStrategicObject(effectiveObject);
  if (!banditTile && !OBJECT_TO_TYPE[effectiveObject]) return null;

  const ct = cityRow?.city_type || cityRow?.cityType;
  const line1 = banditTile
    ? ''
    : (ct && CITY_TYPE_TO_LABEL[ct]) || OBJECT_TO_TYPE[effectiveObject] || '城池';

  let line2 = '';
  let line3 = null;
  if (cityRow) {
    line2 =
      (cityRow.city_name || cityRow.cityName || '').trim() ||
      (anchorCell?.cityName || '').trim() ||
      '—';
    const lord = (cityRow.lordCharacterName ?? cityRow.lord_character_name ?? '').trim();
    if (lord) line3 = lord;
  } else if (banditTile) {
    line2 = (anchorCell?.cityName || '').trim() || '—';
  } else {
    line2 = (anchorCell?.cityName || '').trim() || '—';
  }

  const out = { line1, line2 };
  if (line3) out.line3 = line3;
  return out;
}
