/**
 * 片段分享海报 DOM → PNG（html2canvas）。
 * 按给定 CSS 宽高 × scale 输出；库量到 1339px 时仍对齐档位（如 1500×2676）。
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} outW
 * @param {number} outH
 * @param {string} fill
 * @returns {HTMLCanvasElement}
 */
function snapCanvasToSize(canvas, outW, outH, fill) {
  if (canvas.width === outW && canvas.height === outH) return canvas;
  const snapped = document.createElement('canvas');
  snapped.width = outW;
  snapped.height = outH;
  const ctx = snapped.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(canvas, 0, 0);
  return snapped;
}

/**
 * @param {HTMLElement} element
 * @param {{
 *   backgroundColor?: string,
 *   scale?: number,
 *   targetWidth?: number,
 *   targetHeight?: number,
 * }} [options]
 * @returns {Promise<Blob>}
 */
export async function captureSharePosterElementToBlob(element, options = {}) {
  const scale = options.scale ?? 2;
  const targetWidth = Math.round(options.targetWidth ?? element.offsetWidth);
  const targetHeight = Math.round(options.targetHeight ?? element.offsetHeight);
  const fill = options.backgroundColor ?? '#ffffff';
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: fill,
    scale,
    width: targetWidth,
    height: targetHeight,
    windowWidth: targetWidth,
    windowHeight: targetHeight,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    useCORS: true,
  });
  const snapped = snapCanvasToSize(canvas, targetWidth * scale, targetHeight * scale, fill);
  const blob = await new Promise((resolve, reject) => {
    snapped.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
  });
  return blob;
}
