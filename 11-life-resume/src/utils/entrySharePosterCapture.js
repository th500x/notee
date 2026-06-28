/**
 * 片段分享海报 DOM → PNG（html2canvas）。
 */

/**
 * @param {HTMLElement} element
 * @param {{ backgroundColor?: string, scale?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function captureSharePosterElementToBlob(element, options = {}) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: options.backgroundColor ?? '#ffffff',
    scale: options.scale ?? 2,
    logging: false,
    useCORS: true,
  });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
  });
  return blob;
}
