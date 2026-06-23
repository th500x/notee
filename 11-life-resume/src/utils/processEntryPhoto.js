/**
 * 浏览器端裁剪 + Pica(Lanczos) 缩放，导出格式与源文件一致。
 */

import Pica from 'pica';
import { LIFE_PHOTO_MIME_TYPES } from '@shared/utils/lifeResumeMediaRules.js';

const pica = Pica({ features: ['js', 'wasm', 'cib'] });

const EXPORT_QUALITY = 0.92;

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法读取图片'));
    img.src = src;
  });
}

function resolveExportMime(originalMime) {
  const mime = String(originalMime || '').toLowerCase();
  if (LIFE_PHOTO_MIME_TYPES.includes(mime)) return mime;
  return 'image/jpeg';
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    const useQuality = mimeType === 'image/jpeg' || mimeType === 'image/webp';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片导出失败'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      useQuality ? EXPORT_QUALITY : undefined
    );
  });
}

/**
 * @param {object} params
 * @param {string} params.imageSrc object URL
 * @param {{ x: number, y: number, width: number, height: number }} params.cropPixels
 * @param {number} params.outputWidth
 * @param {number} params.outputHeight
 * @param {string} params.mimeType 原图 MIME，导出保持一致
 * @returns {Promise<Blob>}
 */
export async function renderCroppedPhotoBlob({
  imageSrc,
  cropPixels,
  outputWidth,
  outputHeight,
  mimeType,
}) {
  const image = await loadImageElement(imageSrc);
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(cropPixels.width));
  cropCanvas.height = Math.max(1, Math.round(cropPixels.height));
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error('浏览器不支持 Canvas');

  cropCtx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outputWidth;
  outCanvas.height = outputHeight;

  await pica.resize(cropCanvas, outCanvas, {
    filter: 'lanczos3',
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  return canvasToBlob(outCanvas, resolveExportMime(mimeType));
}

/**
 * @param {File} originalFile
 * @param {Blob} blob
 * @returns {File}
 */
export function buildProcessedPhotoFile(originalFile, blob) {
  const mime = resolveExportMime(originalFile.type);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const base = String(originalFile.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}
