import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  LIFE_PHOTO_CROP_PRESETS,
  computePhotoUpscaleFactor,
  isLandscapeImage,
  resolvePhotoCropTarget,
  shouldWarnPhotoUpscale,
} from '@shared/utils/lifeResumePhotoCrop.js';
import { renderCroppedPhotoBlob, buildProcessedPhotoFile } from '@/utils/processEntryPhoto';
import { validateMediaUploadRequest } from '@shared/utils/lifeResumeMediaRules.js';

const DEFAULT_PRESET_ID = 'square_1080';

/** 取景框在容器内按目标比例能放下的最大整数像素尺寸 */
function fitCropSize(containerWidth, containerHeight, aspect) {
  if (!containerWidth || !containerHeight || !aspect) return null;
  if (containerWidth / containerHeight > aspect) {
    const height = Math.floor(containerHeight);
    const width = Math.floor(height * aspect);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  const width = Math.floor(containerWidth);
  const height = Math.floor(width / aspect);
  return width > 0 && height > 0 ? { width, height } : null;
}

function nearlySameCrop(a, b) {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05;
}

function cropPixelsRoughlyEqual(a, b) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export default function EntryPhotoCropModal({ open, file, displayFilename = null, onCancel, onConfirm }) {
  const [imageSrc, setImageSrc] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [upscaleFactor, setUpscaleFactor] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  /** 打开弹窗后量一次并锁死，避免手机地址栏/滚动条抖动触发裁剪反馈环 */
  const [lockedViewport, setLockedViewport] = useState(null);

  const croppedAreaPixelsRef = useRef(null);
  const objectUrlRef = useRef('');
  const viewportRef = useRef(null);
  const interactingRef = useRef(false);

  useEffect(() => {
    if (!open || !file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
      setImageSrc('');
      setNaturalSize({ width: 0, height: 0 });
      setPresetId(DEFAULT_PRESET_ID);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      croppedAreaPixelsRef.current = null;
      setUpscaleFactor(1);
      setLockedViewport(null);
      setError('');
      return undefined;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setNaturalSize({ width: 0, height: 0 });
    setPresetId(DEFAULT_PRESET_ID);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    croppedAreaPixelsRef.current = null;
    setUpscaleFactor(1);
    setLockedViewport(null);
    setError('');

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setError('无法读取图片，请换一张重试');
    };
    img.src = url;

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [open, file]);

  useLayoutEffect(() => {
    if (!open) {
      setLockedViewport(null);
      return undefined;
    }

    let cancelled = false;
    const measure = () => {
      const el = viewportRef.current;
      if (!el || cancelled) return;
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 8 || height < 8) return;
      setLockedViewport((prev) => {
        if (prev && prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    };

    // 等一帧，让 bottom-sheet 布局稳定后再锁像素尺寸
    const raf = window.requestAnimationFrame(() => {
      measure();
      window.requestAnimationFrame(measure);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  const cropTarget = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return null;
    return resolvePhotoCropTarget(presetId, naturalSize.width, naturalSize.height);
  }, [presetId, naturalSize]);

  const cropSize = useMemo(() => {
    if (!lockedViewport || !cropTarget) return null;
    return fitCropSize(lockedViewport.width, lockedViewport.height, cropTarget.aspect);
  }, [lockedViewport, cropTarget]);

  const upscaleWarning = shouldWarnPhotoUpscale(upscaleFactor);

  const orientationHint = useMemo(() => {
    if (!naturalSize.width) return '';
    return isLandscapeImage(naturalSize.width, naturalSize.height) ? '横图' : '竖图';
  }, [naturalSize]);

  const handleCropChange = useCallback((next) => {
    setCrop((prev) => {
      if (!interactingRef.current && nearlySameCrop(prev, next)) return prev;
      return next;
    });
  }, []);

  const handleZoomChange = useCallback((next) => {
    setZoom((prev) => {
      if (!interactingRef.current && Math.abs(prev - next) < 0.001) return prev;
      return next;
    });
  }, []);

  const updateUpscaleFactor = useCallback(
    (pixels) => {
      if (!cropTarget || !pixels) {
        setUpscaleFactor(1);
        return;
      }
      const nextFactor = computePhotoUpscaleFactor(
        pixels,
        cropTarget.outputWidth,
        cropTarget.outputHeight
      );
      setUpscaleFactor((prev) => (Math.abs(prev - nextFactor) < 0.05 ? prev : nextFactor));
    },
    [cropTarget]
  );

  const handleCropComplete = useCallback(
    (_, pixels) => {
      if (cropPixelsRoughlyEqual(croppedAreaPixelsRef.current, pixels)) return;
      croppedAreaPixelsRef.current = pixels;
      updateUpscaleFactor(pixels);
    },
    [updateUpscaleFactor]
  );

  const handlePresetChange = (id) => {
    if (id === presetId) return;
    setPresetId(id);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    croppedAreaPixelsRef.current = null;
    setUpscaleFactor(1);
    setError('');
  };

  const handleConfirm = async () => {
    const croppedAreaPixels = croppedAreaPixelsRef.current;
    if (!file || !cropTarget || !croppedAreaPixels) {
      setError('请调整裁剪区域');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const blob = await renderCroppedPhotoBlob({
        imageSrc,
        cropPixels: croppedAreaPixels,
        outputWidth: cropTarget.outputWidth,
        outputHeight: cropTarget.outputHeight,
        mimeType: file.type,
      });
      const processed = buildProcessedPhotoFile(file, blob, displayFilename);
      const sizeCheck = validateMediaUploadRequest({
        mediaType: 'photo',
        mimeType: processed.type,
        sizeBytes: processed.size,
      });
      if (!sizeCheck.ok) {
        setError(sizeCheck.error);
        return;
      }
      onConfirm?.(processed);
    } catch (err) {
      setError(err.message || '处理图片失败');
    } finally {
      setProcessing(false);
    }
  };

  if (!open || !file) return null;

  const viewportStyle = lockedViewport
    ? {
        width: `${lockedViewport.width}px`,
        height: `${lockedViewport.height}px`,
        aspectRatio: 'unset',
        maxWidth: '100%',
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="关闭"
        onClick={() => !processing && onCancel?.()}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900">裁剪照片</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {orientationHint && `${orientationHint} · `}
              导出格式与原件一致（{file.type.replace('image/', '').toUpperCase()}）
            </p>
          </div>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 text-sm"
            disabled={processing}
            onClick={onCancel}
          >
            取消
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 shrink-0">
          <p className="text-xs text-slate-600 mb-2">输出比例</p>
          <div className="flex flex-wrap gap-2">
            {LIFE_PHOTO_CROP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={processing}
                className={[
                  'px-2.5 py-1 rounded-full text-xs border',
                  presetId === preset.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                ].join(' ')}
                onClick={() => handlePresetChange(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {cropTarget && (
            <p className="text-xs text-slate-500 mt-2">
              目标尺寸 {cropTarget.outputWidth}×{cropTarget.outputHeight}
            </p>
          )}
        </div>

        <div
          ref={viewportRef}
          className="relative w-full aspect-[4/3] bg-slate-900 shrink-0 overflow-hidden"
          style={viewportStyle}
        >
          {imageSrc && cropTarget && cropSize && (
            <Cropper
              key={presetId}
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={cropTarget.aspect}
              cropSize={cropSize}
              objectFit="contain"
              zoomWithScroll={false}
              onCropChange={handleCropChange}
              onZoomChange={handleZoomChange}
              onCropComplete={handleCropComplete}
              onInteractionStart={() => {
                interactingRef.current = true;
              }}
              onInteractionEnd={() => {
                interactingRef.current = false;
              }}
            />
          )}
          {imageSrc && (!cropTarget || !cropSize) && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              正在加载图片…
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 shrink-0">
          <label className="text-xs text-slate-600 flex items-center gap-2">
            缩放
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={processing || !cropSize}
              className="flex-1"
              onChange={(e) => {
                interactingRef.current = true;
                setZoom(Number(e.target.value));
              }}
              onPointerUp={() => {
                interactingRef.current = false;
              }}
              onMouseUp={() => {
                interactingRef.current = false;
              }}
              onTouchEnd={() => {
                interactingRef.current = false;
              }}
            />
          </label>
        </div>

        <div className="px-4 py-3 space-y-2 shrink-0">
          <div className="min-h-[2.75rem]">
            {upscaleWarning && croppedAreaPixelsRef.current && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                裁剪区域相对目标尺寸较小（约 {upscaleFactor.toFixed(1)} 倍放大），已用高质量算法处理，但可能略发糊。
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={processing || !cropTarget || !cropSize}
            className="w-full rounded-lg bg-indigo-600 text-white py-2.5 hover:bg-indigo-700 disabled:opacity-60"
            onClick={handleConfirm}
          >
            {processing ? '处理中…' : '确认并上传'}
          </button>
        </div>
      </div>
    </div>
  );
}
