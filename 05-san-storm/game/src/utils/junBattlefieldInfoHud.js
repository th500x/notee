/**
 * 郡战场中心 4×4 信息叠层：占位势力占比（合计 100%；远期接真实算法）。
 * 须与产品三势力展示一致；非权威玩法数据。
 */
export const JUN_BATTLEFIELD_FACTION_SHARE_PLACEHOLDER = [
  { key: 'sanwang', label: '三王', pct: 34 },
  { key: 'hanshi', label: '汉室', pct: 33 },
  { key: 'huangjin', label: '黄巾', pct: 33 },
];

/**
 * @param {object[][]|null|undefined} cells
 * @returns {Map<string, { width: number, height: number, displayName: string, banditPoiId: string|null, battlefieldId: string }>}
 *   key = `${gx},${gy}` 仅信息区左上角格
 */
export function buildBattlefieldInfoHudAnchorMap(cells) {
  /** @type {Map<string, { minX:number, minY:number, maxX:number, maxY:number, displayName:string, banditPoiId:string|null, battlefieldId:string }>} */
  const groups = new Map();
  if (!Array.isArray(cells)) return new Map();
  for (let gy = 0; gy < cells.length; gy += 1) {
    const row = cells[gy];
    if (!Array.isArray(row)) continue;
    for (let gx = 0; gx < row.length; gx += 1) {
      const cell = row[gx];
      const zone = cell?.battlefieldZone ?? cell?.battlefield_zone;
      if (zone !== 'info') continue;
      const bfId = String(cell.battlefieldId ?? cell.battlefield_id ?? '').trim();
      if (!bfId) continue;
      const g = groups.get(bfId) || {
        minX: gx,
        minY: gy,
        maxX: gx,
        maxY: gy,
        displayName: '',
        banditPoiId: null,
        battlefieldId: bfId,
      };
      g.minX = Math.min(g.minX, gx);
      g.minY = Math.min(g.minY, gy);
      g.maxX = Math.max(g.maxX, gx);
      g.maxY = Math.max(g.maxY, gy);
      const dn = cell.battlefieldDisplayName ?? cell.battlefield_display_name;
      if (dn) g.displayName = String(dn);
      const bp = cell.banditPoiId ?? cell.bandit_poi_id;
      if (bp) g.banditPoiId = String(bp).trim();
      groups.set(bfId, g);
    }
  }
  /** @type {Map<string, { width: number, height: number, displayName: string, banditPoiId: string|null, battlefieldId: string }>} */
  const out = new Map();
  for (const g of groups.values()) {
    out.set(`${g.minX},${g.minY}`, {
      width: g.maxX - g.minX + 1,
      height: g.maxY - g.minY + 1,
      displayName: g.displayName || '郡战场',
      banditPoiId: g.banditPoiId,
      battlefieldId: g.battlefieldId,
    });
  }
  return out;
}
