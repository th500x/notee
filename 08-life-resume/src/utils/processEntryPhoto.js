import Pica from 'pica';
import { LIFE_PHOTO_MIME_TYPES } from '@shared/utils/lifeResumeMediaRules.js';
import {
  computeCenterCropPixels,
  resolvePhotoCropTarget,
} from '@shared/utils/lifeResumePhotoCrop.js';

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
export function buildProcessedPhotoFile(originalFile, blob, displayFilename = null) {
  const mime = resolveExportMime(originalFile.type);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const sourceName = displayFilename || originalFile.name || 'photo';
  const base = String(sourceName).replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
}

/**
 * 跳过裁剪弹窗：按预设居中取景并导出（与弹窗内同套 resolve + render）
 * @param {File} file
 * @param {string} presetId
 * @param {string|null} displayFilename
 * @returns {Promise<File>}
 */
export async function processPhotoFileWithPreset(file, presetId, displayFilename = null) {
  const imageSrc = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(imageSrc);
    const target = resolvePhotoCropTarget(presetId, image.naturalWidth, image.naturalHeight);
    if (!target) {
      throw new Error('无法解析裁剪比例');
    }
    const cropPixels = computeCenterCropPixels(
      image.naturalWidth,
      image.naturalHeight,
      target.aspect
    );
    const blob = await renderCroppedPhotoBlob({
      imageSrc,
      cropPixels,
      outputWidth: target.outputWidth,
      outputHeight: target.outputHeight,
      mimeType: file.type,
    });
    return buildProcessedPhotoFile(file, blob, displayFilename);
  } finally {
    URL.revokeObjectURL(imageSrc);
  }
}
