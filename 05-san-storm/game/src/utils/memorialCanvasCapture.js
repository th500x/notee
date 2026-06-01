/**
 * 战斗纪念图 DOM → PNG（html2canvas）。
 * 离屏 768×1152 海报需 iframe 克隆渲染；html-to-image/foreignObject 对此场景会产出空白图。
 */

/**
 * @param {HTMLElement} element
 * @param {{ backgroundColor?: string, scale?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function captureMemorialElementToBlob(element, options = {}) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: options.backgroundColor ?? '#1a1512',
    scale: options.scale ?? 1,
    logging: false,
    useCORS: true,
  });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
  });
  return blob;
}
