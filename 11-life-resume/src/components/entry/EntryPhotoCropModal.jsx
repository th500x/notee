import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const CROP_VIEWPORT_HEIGHT_CLASS = 'h-[min(52vw,260px)] sm:h-64';

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
  const [cropperEpoch, setCropperEpoch] = useState(0);
  const [cropperReady, setCropperReady] = useState(false);
  const [upscaleFactor, setUpscaleFactor] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const croppedAreaPixelsRef = useRef(null);
  const objectUrlRef = useRef('');
  const cropperReadyTimerRef = useRef(null);

  const clearCropperReadyTimer = useCallback(() => {
    if (cropperReadyTimerRef.current != null) {
      window.clearTimeout(cropperReadyTimerRef.current);
      cropperReadyTimerRef.current = null;
    }
  }, []);

  const scheduleCropperReady = useCallback(() => {
    clearCropperReadyTimer();
    setCropperReady(false);
    cropperReadyTimerRef.current = window.setTimeout(() => {
      setCropperReady(true);
      cropperReadyTimerRef.current = null;
    }, 48);
  }, [clearCropperReadyTimer]);

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
      setCropperEpoch(0);
      setCropperReady(false);
      setError('');
      clearCropperReadyTimer();
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
    setCropperEpoch((value) => value + 1);
    setError('');
    scheduleCropperReady();

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setError('无法读取图片，请换一张重试');
    };
    img.src = url;

    return () => {
      clearCropperReadyTimer();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [open, file, clearCropperReadyTimer, scheduleCropperReady]);

  const cropTarget = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return null;
    return resolvePhotoCropTarget(presetId, naturalSize.width, naturalSize.height);
  }, [presetId, naturalSize]);

  const upscaleWarning = shouldWarnPhotoUpscale(upscaleFactor);

  const orientationHint = useMemo(() => {
    if (!naturalSize.width) return '';
    return isLandscapeImage(naturalSize.width, naturalSize.height) ? '横图' : '竖图';
  }, [naturalSize]);

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
      setUpscaleFactor((prev) =>
        Math.abs(prev - nextFactor) < 0.05 ? prev : nextFactor
      );
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
    setCropperEpoch((value) => value + 1);
    setError('');
    scheduleCropperReady();
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="关闭"
        onClick={() => !processing && onCancel?.()}
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
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
          className={`relative w-full ${CROP_VIEWPORT_HEIGHT_CLASS} bg-slate-900 shrink-0 overflow-hidden`}
        >
          {imageSrc && cropTarget && cropperReady && (
            <Cropper
              key={`${presetId}-${cropperEpoch}`}
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={cropTarget.aspect}
              objectFit="contain"
              zoomWithScroll={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
          {imageSrc && cropTarget && !cropperReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              正在调整取景框…
            </div>
          )}
          {imageSrc && !cropTarget && !error && (
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
              disabled={processing || !cropperReady}
              className="flex-1"
              onChange={(e) => setZoom(Number(e.target.value))}
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
            disabled={processing || !cropTarget || !cropperReady}
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
