/**
 * 战略大地图格子 tooltip：在静态 cell（preset/合并图）上合并 `cities` 运行时字段。
 * 数据来源：`GET /api/cities?season=&junId=` + `loadSharedData('factions')` 解析势力名。
 */

/** 与 `cities.city_type` 一致；覆盖 preset 格上 `object`（如 city_medium）与种子不符时的标题 */
const CITY_TYPE_TOOLTIP = {
  city_major: { name: '大城', badge: '🏰' },
  city_medium: { name: '中城', badge: '🏯' },
  city_small: { name: '小城', badge: '🏘️' },
  gate: { name: '关隘', badge: '🚪' },
  fort: { name: '据点', badge: '🛡️' },
  wilderness: { name: '荒郊', badge: '🌾' },
  market: { name: '集市', badge: '🏮' },
};

/** 与玩法一致：有 faction_id 即视为占城态；库中误留 neutral 时仍显示为已占领 */
function formatCityStatusForTooltip(status, hasFactionId) {
  let s = status;
  if (hasFactionId && (s === 'neutral' || s == null || s === '')) {
    s = 'owned';
  }
  if (s === 'owned') return '已占领';
  if (s === 'neutral') return '中立';
  return s != null && s !== '' ? String(s) : '';
}

/**
 * @param {{ badge?: string, name?: string, attrs?: string } | null} info - buildCampaignCellTooltipInfo 结果
 * @param {object | null | undefined} cell - 格对象（含 cityId、cityName）
 * @param {object | null | undefined} cityRow - `cities` 表行（API：snake_case）
 * @param {Record<string, string>} factionNameById - faction_id → 显示名
 */
export function appendStrategicCityRuntimeToTooltipInfo(info, cell, cityRow, factionNameById = {}) {
  if (!info?.attrs || !cityRow || !cell?.cityId) return info;

  const ct = cityRow.city_type || cityRow.cityType;
  const typeUi = ct && CITY_TYPE_TOOLTIP[ct] ? CITY_TYPE_TOOLTIP[ct] : null;
  const infoPatched = typeUi ? { ...info, name: typeUi.name, badge: typeUi.badge } : info;

  const parts = [];
  const fid = cityRow.faction_id;
  if (fid) {
    parts.push(`归属势力：${factionNameById[fid] || fid}`);
  } else {
    parts.push('归属势力：中立（无势力）');
  }
  const statusLine = formatCityStatusForTooltip(cityRow.status, !!fid);
  if (statusLine) {
    parts.push(`城市状态：${statusLine}`);
  }
  if (cityRow.lord_player_id) {
    parts.push(`长官：${cityRow.lord_player_id}`);
  }
  if (cityRow.city_type === 'fort' && cityRow.built_by_player_id) {
    parts.push(`建造者：${cityRow.built_by_player_id}`);
  }
  const dbDisplay = cityRow.custom_name || cityRow.city_name;
  if (dbDisplay && dbDisplay !== cell.cityName) {
    parts.push(`登记名称：${dbDisplay}`);
  }

  if (parts.length === 0) return infoPatched;

  return {
    ...infoPatched,
    attrs: `${infoPatched.attrs}\n────────\n运行时（服务器）\n${parts.join('\n')}`,
  };
}
