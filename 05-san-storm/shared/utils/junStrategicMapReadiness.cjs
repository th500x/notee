/**
 * 郡战略图「可玩 / 可列表」就绪判定（31-1）
 * 须与 junStrategicMapReadiness.js 同步。
 */

function isJunStrategicMapPlayReady(mergedJson) {
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

function junMeowaPreviewPublicRelPath(junId) {
  const j = String(junId || '').trim();
  return `data/worldmap/previews/${j}.png`;
}

module.exports = {
  isJunStrategicMapPlayReady,
  junMeowaPreviewPublicRelPath,
};
