/**
 * 11-life-resume 照片裁剪预设（输出像素 + 取景比例）
 * 须与 lifeResumePhotoCrop.cjs 同步
 */

/** @typedef {{ id: string, label: string, kind: 'square' | 'ratio' }} CropPresetDef */

export const LIFE_PHOTO_CROP_PRESETS = [
  { id: 'square_1080', label: '1:1 · 1080', kind: 'square', size: 1080 },
  { id: 'square_2160', label: '1:1 · 2160', kind: 'square', size: 2160 },
  { id: 'ratio_4_3', label: '4:3 / 3:4', kind: 'ratio', ratioKey: '4:3' },
  { id: 'ratio_16_9', label: '16:9 / 9:16', kind: 'ratio', ratioKey: '16:9' },
  { id: 'ratio_16_9_4k', label: '16:9 / 9:16 · 4K', kind: 'ratio', ratioKey: '16:9_4k' },
];

const RATIO_OUTPUT = {
  '4:3': {
    landscape: { width: 1440, height: 1080, aspect: 4 / 3 },
    portrait: { width: 1080, height: 1440, aspect: 3 / 4 },
  },
  '16:9': {
    landscape: { width: 1920, height: 1080, aspect: 16 / 9 },
    portrait: { width: 1080, height: 1920, aspect: 9 / 16 },
  },
  '16:9_4k': {
    landscape: { width: 3840, height: 2160, aspect: 16 / 9 },
    portrait: { width: 2160, height: 3840, aspect: 9 / 16 },
  },
};

export function isLandscapeImage(naturalWidth, naturalHeight) {
  return Number(naturalWidth) >= Number(naturalHeight);
}

/**
 * @param {string} presetId
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {{ aspect: number, outputWidth: number, outputHeight: number, presetLabel: string } | null}
 */
export function resolvePhotoCropTarget(presetId, naturalWidth, naturalHeight) {
  const preset = LIFE_PHOTO_CROP_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  if (preset.kind === 'square') {
    return {
      aspect: 1,
      outputWidth: preset.size,
      outputHeight: preset.size,
      presetLabel: preset.label,
    };
  }

  const orient = isLandscapeImage(naturalWidth, naturalHeight) ? 'landscape' : 'portrait';
  const spec = RATIO_OUTPUT[preset.ratioKey][orient];
  return {
    aspect: spec.aspect,
    outputWidth: spec.width,
    outputHeight: spec.height,
    presetLabel: `${preset.label} → ${spec.width}×${spec.height}`,
  };
}

/** 放大倍数（相对裁剪区像素），用于 UI 提示 */
export function computePhotoUpscaleFactor(cropPixels, outputWidth, outputHeight) {
  if (!cropPixels?.width || !cropPixels?.height) return 1;
  return Math.max(outputWidth / cropPixels.width, outputHeight / cropPixels.height);
}

/** 是否建议提示「原图较小，放大后可能发糊」 */
export function shouldWarnPhotoUpscale(factor, threshold = 1.5) {
  return Number.isFinite(factor) && factor > threshold;
}

/** 跳过裁剪弹窗时默认使用的 4K 比例预设 */
export const LIFE_PHOTO_AUTO_CROP_4K_PRESET_ID = 'ratio_16_9_4k';

/**
 * 按目标宽高比做居中最大取景（与裁剪弹窗默认 zoom=1 居中一致）
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeCenterCropPixels(naturalWidth, naturalHeight, aspect) {
  const nw = Number(naturalWidth);
  const nh = Number(naturalHeight);
  const targetAspect = Number(aspect);
  if (!(nw > 0) || !(nh > 0) || !(targetAspect > 0)) {
    return { x: 0, y: 0, width: Math.max(1, nw || 1), height: Math.max(1, nh || 1) };
  }
  const imageAspect = nw / nh;
  let width;
  let height;
  let x;
  let y;
  if (imageAspect > targetAspect) {
    height = nh;
    width = height * targetAspect;
    x = (nw - width) / 2;
    y = 0;
  } else {
    width = nw;
    height = width / targetAspect;
    x = 0;
    y = (nh - height) / 2;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}
