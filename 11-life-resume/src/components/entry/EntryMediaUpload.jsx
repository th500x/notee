import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LIFE_DOCUMENT_ACCEPT,
  LIFE_MEDIA_MAX_PHOTOS,
  LIFE_PHOTO_MIME_TYPES,
  LIFE_VIDEO_MIME_TYPES,
  validateMediaUploadRequest,
} from '@shared/utils/lifeResumeMediaRules.js';
import {
  LIFE_PHOTO_AUTO_CROP_4K_PRESET_ID,
  LIFE_PHOTO_CROP_PRESETS,
} from '@shared/utils/lifeResumePhotoCrop.js';
import { requestUploadSign, uploadFileToSignedUrl } from '@/services/lifeResumeApi';
import { abandonOrphanUploads } from '@/utils/abandonOrphanUpload';
import { resolvePhotoOriginalFilename } from '@/utils/resolvePhotoOriginalFilename';
import { processPhotoFileWithPreset } from '@/utils/processEntryPhoto';
import EntryPhotoCropModal from '@/components/entry/EntryPhotoCropModal';

const BUNDLE_TABS = [
  { value: 'none', label: '无' },
  { value: 'photos', label: '照片' },
  { value: 'video', label: '视频' },
  { value: 'document', label: '文档' },
];

const AUTO_4K_PRESET_LABEL =
  LIFE_PHOTO_CROP_PRESETS.find((p) => p.id === LIFE_PHOTO_AUTO_CROP_4K_PRESET_ID)?.label ||
  '16:9 / 9:16 · 4K';

function createStagingToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

function resolveActiveMediaType(bundleType) {
  if (bundleType === 'video') return 'video';
  if (bundleType === 'document') return 'document';
  if (bundleType === 'photos') return 'photo';
  return null;
}

export default function EntryMediaUpload({
  entryId,
  mediaBundleType,
  mediaItems,
  onBundleTypeChange,
  onMediaItemsChange,
  initialPersistedOssKeys = null,
  saveCommittedRef = null,
  disabled = false,
}) {
  const stagingTokenRef = useRef(createStagingToken());
  const mediaItemsRef = useRef(mediaItems);
  const initialPersistedRef = useRef(initialPersistedOssKeys);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropSession, setCropSession] = useState(null);
  const [autoCrop4k, setAutoCrop4k] = useState(false);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => {
    initialPersistedRef.current = initialPersistedOssKeys;
  }, [initialPersistedOssKeys]);

  useEffect(() => {
    return () => {
      if (saveCommittedRef?.current) return;
      abandonOrphanUploads(mediaItemsRef.current, initialPersistedRef.current);
    };
  }, [saveCommittedRef]);

  const photoCount = useMemo(
    () => mediaItems.filter((item) => item.mediaType === 'photo').length,
    [mediaItems]
  );

  const hasDocument = useMemo(
    () => mediaItems.some((item) => item.mediaType === 'document'),
    [mediaItems]
  );

  const acceptTypes = useMemo(() => {
    if (mediaBundleType === 'photos') return LIFE_PHOTO_MIME_TYPES.join(',');
    if (mediaBundleType === 'video') return LIFE_VIDEO_MIME_TYPES.join(',');
    if (mediaBundleType === 'document') return LIFE_DOCUMENT_ACCEPT;
    return '';
  }, [mediaBundleType]);

  const handleTabChange = async (value) => {
    setUploadError('');

    let nextItems = [];
    if (value === 'none') {
      nextItems = [];
    } else if (value === 'video') {
      nextItems = mediaItems.filter((item) => item.mediaType === 'video').slice(0, 1);
    } else if (value === 'document') {
      nextItems = mediaItems.filter((item) => item.mediaType === 'document').slice(0, 1);
    } else if (value === 'photos') {
      nextItems = mediaItems.filter((item) => item.mediaType === 'photo').slice(0, LIFE_MEDIA_MAX_PHOTOS);
    }

    const removed = mediaItems.filter(
      (item) => !nextItems.some((next) => next.ossKey === item.ossKey)
    );
    await abandonOrphanUploads(removed, initialPersistedOssKeys);

    onBundleTypeChange(value);
    onMediaItemsChange(nextItems);
  };

  const uploadMediaFile = async (file, mediaType, originalFilenameOverride = null, options = {}) => {
    const { baseItems = mediaItems, manageUploading = true } = options;
    const originalFilename = originalFilenameOverride || file.name;
    const currentPhotoCount = baseItems.filter((item) => item.mediaType === 'photo').length;
    const check = validateMediaUploadRequest({
      mediaType,
      mimeType: file.type,
      sizeBytes: file.size,
      filename: originalFilename,
    });
    if (!check.ok) {
      setUploadError(check.error);
      return null;
    }

    if (mediaType === 'photo' && currentPhotoCount >= LIFE_MEDIA_MAX_PHOTOS) {
      setUploadError(`最多 ${LIFE_MEDIA_MAX_PHOTOS} 张照片`);
      return null;
    }

    if (manageUploading) {
      setUploading(true);
      setUploadError('');
    }
    try {
      const sortOrder = mediaType === 'photo' ? currentPhotoCount + 1 : 1;
      const sign = await requestUploadSign({
        entryId: entryId || null,
        stagingToken: entryId ? null : stagingTokenRef.current,
        mediaType: check.mediaType,
        mimeType: check.mimeType,
        sizeBytes: check.sizeBytes,
        originalFilename,
        sortOrder,
      });

      await uploadFileToSignedUrl(sign.data, file);

      const nextItem = {
        ossKey: sign.data.ossKey,
        mediaType: check.mediaType,
        mimeType: check.mimeType,
        sizeBytes: check.sizeBytes,
        sortOrder,
        originalFilename,
        previewUrl: mediaType === 'photo' ? URL.createObjectURL(file) : undefined,
      };

      const nextItems =
        mediaType === 'video' || mediaType === 'document'
          ? [nextItem]
          : [...baseItems, nextItem];
      onMediaItemsChange(nextItems);
      return nextItems;
    } catch (err) {
      setUploadError(err.message || '上传失败');
      return null;
    } finally {
      if (manageUploading) {
        setUploading(false);
      }
    }
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || disabled || uploading) return;

    setUploadError('');
    const mediaType = resolveActiveMediaType(mediaBundleType);
    if (!mediaType) return;

    if (mediaType === 'photo' && autoCrop4k) {
      const remaining = LIFE_MEDIA_MAX_PHOTOS - photoCount;
      if (remaining <= 0) {
        setUploadError(`最多 ${LIFE_MEDIA_MAX_PHOTOS} 张照片`);
        return;
      }
      const picked = files.slice(0, remaining);
      if (files.length > remaining) {
        setUploadError(`最多 ${LIFE_MEDIA_MAX_PHOTOS} 张照片，已按选择顺序取前 ${remaining} 张`);
      }

      setUploading(true);
      let workingItems = mediaItems;
      try {
        for (const file of picked) {
          const preCheck = validateMediaUploadRequest({
            mediaType: 'photo',
            mimeType: file.type,
            sizeBytes: file.size,
            skipSizeCheck: true,
          });
          if (!preCheck.ok) {
            setUploadError(preCheck.error);
            break;
          }
          const displayFilename = await resolvePhotoOriginalFilename(file);
          const processed = await processPhotoFileWithPreset(
            file,
            LIFE_PHOTO_AUTO_CROP_4K_PRESET_ID,
            displayFilename
          );
          const sizeCheck = validateMediaUploadRequest({
            mediaType: 'photo',
            mimeType: processed.type,
            sizeBytes: processed.size,
          });
          if (!sizeCheck.ok) {
            setUploadError(sizeCheck.error);
            break;
          }
          const nextItems = await uploadMediaFile(processed, 'photo', displayFilename, {
            baseItems: workingItems,
            manageUploading: false,
          });
          if (!nextItems) break;
          workingItems = nextItems;
        }
      } catch (err) {
        setUploadError(err.message || '按 4K 比例处理失败');
      } finally {
        setUploading(false);
      }
      return;
    }

    const file = files[0];
    if (!file) return;

    if (mediaType === 'photo') {
      const preCheck = validateMediaUploadRequest({
        mediaType: 'photo',
        mimeType: file.type,
        sizeBytes: file.size,
        skipSizeCheck: true,
      });
      if (!preCheck.ok) {
        setUploadError(preCheck.error);
        return;
      }
      if (photoCount >= LIFE_MEDIA_MAX_PHOTOS) {
        setUploadError(`最多 ${LIFE_MEDIA_MAX_PHOTOS} 张照片`);
        return;
      }
      const displayFilename = await resolvePhotoOriginalFilename(file);
      setCropSession({ file, displayFilename });
      return;
    }

    await uploadMediaFile(file, mediaType, file.name);
  };

  const handleCropConfirm = async (processedFile) => {
    const displayFilename = cropSession?.displayFilename || processedFile.name;
    setCropSession(null);
    await uploadMediaFile(processedFile, 'photo', displayFilename);
  };

  const removeItem = async (ossKey) => {
    const item = mediaItems.find((m) => m.ossKey === ossKey);
    if (item) {
      await abandonOrphanUploads([item], initialPersistedOssKeys);
    }
    onMediaItemsChange(mediaItems.filter((item) => item.ossKey !== ossKey));
  };

  const pickLabel =
    mediaBundleType === 'photos'
      ? '选择照片'
      : mediaBundleType === 'video'
        ? '选择视频'
        : mediaBundleType === 'document'
          ? '选择文档'
          : '';

  const hintText =
    mediaBundleType === 'photos'
      ? autoCrop4k
        ? `JPG / PNG / WebP，最多 3 张；已勾选「${AUTO_4K_PRESET_LABEL}」，可一次选最多 3 张（顺序按选择顺序），选图后居中裁切直接上传（横竖自动适配）`
        : 'JPG / PNG / WebP，最多 3 张；先裁剪，裁剪后单张 ≤10MB（1:1 / 4:3 / 16:9，横竖自动适配）'
      : mediaBundleType === 'video'
        ? 'MP4，≤50MB，最多 1 个'
        : mediaBundleType === 'document'
          ? 'PDF / Word / Excel / PPT / TXT，≤10MB，最多 1 个'
          : '';

  return (
    <section className="space-y-3">
      <EntryPhotoCropModal
        open={!!cropSession?.file}
        file={cropSession?.file}
        displayFilename={cropSession?.displayFilename}
        onCancel={() => setCropSession(null)}
        onConfirm={handleCropConfirm}
      />

      <p className="text-sm font-medium text-slate-800">媒体 · 本地上传</p>
      <p className="text-xs text-slate-500 -mt-1">照片、视频、文档只能选其一</p>
      <div className="flex flex-wrap gap-2">
        {BUNDLE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            disabled={disabled || uploading || !!cropSession}
            className={[
              'px-3 py-1.5 rounded-full text-sm border',
              mediaBundleType === tab.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50',
            ].join(' ')}
            onClick={() => handleTabChange(tab.value)}
          >
            {tab.label}
            {tab.value === 'photos' ? ` (${photoCount}/${LIFE_MEDIA_MAX_PHOTOS})` : ''}
            {tab.value === 'video' ? ` (${mediaItems.some((m) => m.mediaType === 'video') ? 1 : 0}/1)` : ''}
            {tab.value === 'document' ? ` (${hasDocument ? 1 : 0}/1)` : ''}
          </button>
        ))}
      </div>

      {mediaBundleType !== 'none' && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="file"
                className="sr-only"
                accept={acceptTypes}
                multiple={mediaBundleType === 'photos' && autoCrop4k}
                disabled={disabled || uploading || !!cropSession}
                onChange={handleFileChange}
              />
              {uploading ? '上传中…' : pickLabel}
            </label>
            {mediaBundleType === 'photos' && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={autoCrop4k}
                  disabled={disabled || uploading || !!cropSession}
                  onChange={(e) => setAutoCrop4k(e.target.checked)}
                />
                <span>{AUTO_4K_PRESET_LABEL}</span>
              </label>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">{hintText}</p>
        </div>
      )}

      {mediaItems.length > 0 && (
        <ul className="space-y-2">
          {mediaItems.map((item) => (
            <li
              key={item.ossKey}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 bg-slate-50"
            >
              {item.mediaType === 'photo' && (item.previewUrl || item.thumbUrl || item.url) && (
                <img
                  src={item.previewUrl || item.thumbUrl || item.url}
                  alt=""
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              {item.mediaType === 'video' && (
                <span className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center text-xs">
                  MP4
                </span>
              )}
              {item.mediaType === 'document' && (
                <span className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center text-lg">
                  📄
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{item.originalFilename || item.ossKey}</p>
                <p className="text-xs text-slate-500">{(item.sizeBytes / 1024).toFixed(0)} KB</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline shrink-0"
                  onClick={() => removeItem(item.ossKey)}
                >
                  移除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
    </section>
  );
}
