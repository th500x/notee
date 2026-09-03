/**
 * 郡战略图「可玩 / 可列表」就绪判定（31-1）
 * 须与 junStrategicMapReadiness.cjs 同步。
 *
 * 临时裁图、旧四象限产物不算就绪；须 Meowa/工坊权威（visualRef 或 source）。
 */

/**
 * @param {object|null|undefined} mergedJson — `*_merged.json` 根对象
 * @returns {boolean}
 */
export function isJunStrategicMapPlayReady(mergedJson) {
  if (!mergedJson || typeof mergedJson !== 'object') return false;
  const sourceKind = String(mergedJson.source?.kind || '').trim();
  if (/^temporary_crop/i.test(sourceKind)) return false;
  const visualKind = String(mergedJson.visualRef?.kind || '').trim();
  if (visualKind === 'meowa_local_pack') return true;
  if (
    sourceKind === 'jun_strategic_workshop' ||
    sourceKind === 'meowa_to_jun_merged'
  ) {
    return true;
  }
  return false;
}

/**
 * 游戏端静态预览路径（相对 `public/`）：`data/worldmap/previews/{junId}.png`
 * @param {string} junId
 * @returns {string}
 */
export function junMeowaPreviewPublicRelPath(junId) {
  const j = String(junId || '').trim();
  return `data/worldmap/previews/${j}.png`;
}

/**
 * @param {string} baseUrl — Vite BASE_URL，须可拼相对路径
 * @param {string} junId
 * @returns {string}
 */
export function junMeowaPreviewPublicUrl(baseUrl, junId) {
  const root = String(baseUrl || '').replace(/\/?$/, '/');
  return `${root}${junMeowaPreviewPublicRelPath(junId)}`;
}
