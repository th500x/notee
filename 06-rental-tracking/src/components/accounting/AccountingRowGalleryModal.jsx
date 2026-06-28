import { useRef, useState, useCallback } from 'react';
import PhotoViewer from '../PhotoViewer';
import { uploadService } from '../../services/uploadService';
import { enrichUploadedPhoto, formatCaptureTimeDisplay, getPhotoCaptureIso } from '../../utils/photoCaptureTime';
import {
  newGalleryShareToken,
  copyGalleryShareUrl,
  buildGalleryShareUrl
} from '../../utils/accountingGalleryShare';
import { config } from '../../config';

/**
 * 账目单租金行 — 图片库管理（上传 / 预览 / 删除 / 分享）
 */
export function AccountingRowGalleryModal({ isOpen, row, onClose, onUpdateRow }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [shareHint, setShareHint] = useState('');

  const photos = row?.photos || [];
  const roomLabel = row?.room?.trim() || '（未填房号）';

  const patchRow = useCallback(
    (patch) => {
      if (!row?.id) return;
      onUpdateRow(row.id, patch);
    },
    [row?.id, onUpdateRow]
  );

  const ensureShareToken = useCallback(() => {
    if (row?.galleryShareToken) return row.galleryShareToken;
    const token = newGalleryShareToken();
    patchRow({ galleryShareToken: token });
    return token;
  }, [row?.galleryShareToken, patchRow]);

  const handlePickFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const maxBytes = config.oss.maxFileSize;
    for (const f of files) {
      if (f.size > maxBytes) {
        alert(`「${f.name}」超过 ${maxBytes / 1024 / 1024}MB 上限`);
        return;
      }
      if (!config.oss.allowedTypes.includes(f.type)) {
        alert(`「${f.name}」格式不支持，请使用 JPG / PNG`);
        return;
      }
    }

    setUploading(true);
    try {
      const results = await uploadService.uploadPhotosUnlimited(files);
      const newPhotos = results.map((r, i) => enrichUploadedPhoto(r.photo, files[i]?.name));
      const nextPhotos = [...photos, ...newPhotos];
      const patch = { photos: nextPhotos };
      if (!row.galleryShareToken && nextPhotos.length > 0) {
        patch.galleryShareToken = newGalleryShareToken();
      }
      patchRow(patch);
    } catch (err) {
      console.error(err);
      alert(`上传失败：${err.message || '未知错误'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('确定删除这张照片？删除后请记得点击页面底部「保存到服务器」。')) return;
    try {
      await uploadService.deletePhoto(photoId);
      patchRow({ photos: photos.filter((p) => p.id !== photoId) });
    } catch (err) {
      alert(`删除失败：${err.message || '未知错误'}`);
    }
  };

  const handleShare = async () => {
    if (!photos.length) {
      alert('请先上传至少一张照片');
      return;
    }
    try {
      const token = ensureShareToken();
      await copyGalleryShareUrl(token);
      setShareHint('链接已复制到剪贴板');
      setTimeout(() => setShareHint(''), 2500);
    } catch (err) {
      alert(err.message || '复制失败');
    }
  };

  const handleRegenerateLink = () => {
    if (!photos.length) return;
    if (
      !confirm(
        '重新生成链接后，旧链接将立即失效。确定继续？\n\n生成后请再次点击「分享」并保存到服务器。'
      )
    ) {
      return;
    }
    patchRow({ galleryShareToken: newGalleryShareToken() });
    setShareHint('已生成新链接，请点「分享」复制');
  };

  if (!isOpen || !row) return null;

  const shareUrl = row.galleryShareToken ? buildGalleryShareUrl(row.galleryShareToken) : '';

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-4 sm:my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">图片库 · {roomLabel}</h3>
              <p className="text-xs text-white/85 mt-1">
                单张 ≤10MB · 改完请点页面底部「保存到服务器」
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-2xl leading-none hover:opacity-80"
              aria-label="关闭"
            >
              ×
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePickFiles}
                disabled={uploading}
                className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? '上传中…' : photos.length ? '继续上传' : '选择图片'}
              </button>
              {photos.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    分享
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateLink}
                    className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    重新生成链接
                  </button>
                </>
              )}
            </div>

            {shareHint && <p className="text-sm text-emerald-700">{shareHint}</p>}
            {shareUrl && (
              <p className="text-xs text-gray-500 break-all" title={shareUrl}>
                当前链接：{shareUrl}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {photos.length === 0 ? (
              <div className="py-12 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                暂无图片，点击「选择图片」上传
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
                  >
                    <button
                      type="button"
                      className="block w-full aspect-square"
                      onClick={() => setViewerIndex(index)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.name || `图片 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="px-2 py-1.5 text-[11px] text-gray-600 bg-white border-t border-gray-100">
                      {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-600/90 text-white text-xs hover:bg-red-700"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerIndex !== null && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
