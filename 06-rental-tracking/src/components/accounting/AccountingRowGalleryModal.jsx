import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import PhotoViewer from '../PhotoViewer';
import { uploadService } from '../../services/uploadService';
import { enrichUploadedPhoto, formatCaptureTimeDisplay, getPhotoCaptureIso } from '../../utils/photoCaptureTime';
import {
  newGalleryShareToken,
  copyGalleryShareUrl,
  buildGalleryShareUrl
} from '../../utils/accountingGalleryShare';
import { config } from '../../config';

const PANEL_MAX_WIDTH = 672;

function useGalleryPanelStyle(anchorEl, isOpen) {
  const [panelStyle, setPanelStyle] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) {
      setPanelStyle(null);
      return undefined;
    }

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      const panelWidth = Math.min(PANEL_MAX_WIDTH, vw - 16);
      const maxPanelHeight = isMobile ? Math.min(vh * 0.72, 520) : Math.min(vh * 0.82, 640);

      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(8, Math.min(left, vw - panelWidth - 8));

      let top = rect.bottom + 8;
      if (top + maxPanelHeight > vh - 8) {
        top = rect.top - maxPanelHeight - 8;
      }
      if (top < 8) {
        top = Math.max(8, rect.top);
      }

      setPanelStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
        maxHeight: `${maxPanelHeight}px`
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorEl, isOpen]);

  return panelStyle;
}

/**
 * 账目单租金行 — 图片库管理（上传 / 预览 / 删除 / 分享）
 */
export function AccountingRowGalleryModal({
  isOpen,
  row,
  anchorEl,
  galleryUnsaved,
  saving = false,
  onSaveToServer,
  onClose,
  onUpdateRow
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [shareHint, setShareHint] = useState('');

  const photos = row?.photos || [];
  const roomLabel = row?.room?.trim() || '（未填房号）';
  const panelStyle = useGalleryPanelStyle(anchorEl, isOpen);

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
    setUploadProgress({ current: 0, total: files.length, fileName: files[0]?.name || '' });
    try {
      const results = await uploadService.uploadPhotosUnlimited(files, (p) => setUploadProgress(p));
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
      setUploadProgress(null);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('确定删除这张照片？删除后请点下方「保存到服务器」。')) return;
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
    if (galleryUnsaved) {
      alert(
        '图库改动尚未保存到服务器，他人打开链接会显示「链接无效」。\n\n请先点本窗口下方「保存到服务器」，保存成功后再点「分享」。'
      );
      return;
    }
    try {
      const token = ensureShareToken();
      await copyGalleryShareUrl(token);
      setShareHint('链接已复制，可直接发给他人');
      setTimeout(() => setShareHint(''), 3000);
    } catch (err) {
      alert(err.message || '复制失败');
    }
  };

  const handleRegenerateLink = () => {
    if (!photos.length) return;
    if (
      !confirm(
        '重新生成链接后，旧链接将立即失效。确定继续？\n\n生成后请再次点击「分享」，并保存到服务器。'
      )
    ) {
      return;
    }
    patchRow({ galleryShareToken: newGalleryShareToken() });
    setShareHint('已生成新链接；保存到服务器后，再点「分享」复制');
  };

  const handleSaveToServer = async () => {
    if (!onSaveToServer || saving) return;
    const result = await onSaveToServer({ quiet: true });
    if (result?.success) {
      setShareHint('已保存到服务器，现在可以点「分享」复制链接');
      setTimeout(() => setShareHint(''), 4000);
    } else if (result?.error) {
      alert(result.error);
    }
  };

  if (!isOpen || !row || !panelStyle) return null;

  const shareUrl = row.galleryShareToken ? buildGalleryShareUrl(row.galleryShareToken) : '';
  const progressPct =
    uploadProgress && uploadProgress.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 0;

  const panel = (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed z-50 flex flex-col bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="gallery-modal-title"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white shrink-0">
          <div className="min-w-0">
            <h3 id="gallery-modal-title" className="text-base font-semibold truncate">
              图片库 · {roomLabel}
            </h3>
            <p className="text-[11px] text-white/85 mt-0.5">单张 ≤10MB · 上传后请保存</p>
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

        <div className="px-4 py-3 space-y-3 overflow-y-auto min-h-0 flex-1">
          {galleryUnsaved ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              图库有未保存改动：请点下方「保存到服务器」，分享链接才会生效。
            </p>
          ) : null}

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

          {uploading && uploadProgress ? (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-600">
                正在上传 {uploadProgress.current}/{uploadProgress.total}
                {uploadProgress.fileName ? ` · ${uploadProgress.fileName}` : ''}
              </p>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-200 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500">{progressPct}%</p>
            </div>
          ) : null}

          {shareHint ? <p className="text-sm text-emerald-700">{shareHint}</p> : null}
          {shareUrl ? (
            <p className="text-[11px] text-gray-500 break-all" title={shareUrl}>
              当前链接：{shareUrl}
            </p>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {photos.length === 0 ? (
            <div className="py-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg text-sm">
              暂无图片，点击「选择图片」上传
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                  <div className="px-2 py-1 text-[10px] text-gray-600 bg-white border-t border-gray-100">
                    {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 text-white text-xs hover:bg-red-700"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleSaveToServer}
            disabled={saving || uploading || !onSaveToServer}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存到服务器'}
          </button>
          <p className="mt-1.5 text-[10px] text-gray-500 text-center">
            与页面底部保存相同，会保存整张账目单
          </p>
        </div>
      </div>

      {viewerIndex !== null && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );

  return createPortal(panel, document.body);
}
