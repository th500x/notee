import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import PhotoViewer from '../PhotoViewer';
import { uploadService } from '../../services/uploadService';
import {
  enrichUploadedPhotoFromFile,
  formatCaptureTimeDisplay,
  getPhotoCaptureIso
} from '../../utils/photoCaptureTime';
import {
  newGalleryShareToken,
  copyGalleryShareUrl,
  buildGalleryShareUrl
} from '../../utils/accountingGalleryShare';
import { normalizeGalleryDriveFolderUrl } from '../../utils/galleryDriveLink';
import {
  normalizeGalleryListing,
  GALLERY_LAYOUT_OPTIONS,
  GALLERY_TV_TYPE_OPTIONS,
  GALLERY_INTERNET_OPTIONS,
  GALLERY_OCCUPANCY_OPTIONS
} from '../../utils/galleryListing';
import { config } from '../../config';

const PANEL_MAX_WIDTH = 672;
const VIEWPORT_PAD = 12;

/**
 * 图库弹窗定位：优先在视口内居中，保证完整可见。
 */
function useGalleryPanelStyle(isOpen) {
  const [panelStyle, setPanelStyle] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelStyle(null);
      return undefined;
    }

    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const panelWidth = Math.min(PANEL_MAX_WIDTH, vw - VIEWPORT_PAD * 2);
      const maxPanelHeight = Math.min(vh - VIEWPORT_PAD * 2, Math.round(vh * 0.92));
      const left = Math.max(VIEWPORT_PAD, Math.round((vw - panelWidth) / 2));
      const top = VIEWPORT_PAD;

      setPanelStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${panelWidth}px`,
        maxHeight: `${maxPanelHeight}px`
      });
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  return panelStyle;
}

const fieldCls =
  'w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-500';

/**
 * 账目单租金行 — 图库（OSS 上传为主 + 兼容历史 Google Drive 链接 + 房源说明 + 分享）
 */
export function AccountingRowGalleryModal({
  isOpen,
  row,
  savedRow,
  // 仍由父组件传入（打开时滚入视区）；面板改为视口居中
  anchorEl: _anchorEl,
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
  const driveUrl = (row?.galleryDriveFolderUrl || '').trim();
  const canShareGallery = photos.length > 0 || !!driveUrl;
  const roomLabel = row?.room?.trim() || '（未填房号）';
  const panelStyle = useGalleryPanelStyle(isOpen);
  const listing = normalizeGalleryListing(row?.galleryListing);

  const patchRow = useCallback(
    (patch) => {
      if (!row?.id) return;
      onUpdateRow(row.id, patch);
    },
    [row?.id, onUpdateRow]
  );

  const patchListing = useCallback(
    (field, value) => {
      patchRow({
        galleryListing: {
          ...normalizeGalleryListing(row?.galleryListing),
          [field]: value
        }
      });
    },
    [row?.galleryListing, patchRow]
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
      const newPhotos = [];
      for (let i = 0; i < results.length; i += 1) {
        newPhotos.push(await enrichUploadedPhotoFromFile(results[i].photo, files[i]));
      }
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

  const handleDeleteAllPhotos = async () => {
    if (!photos.length || uploading) return;
    if (
      !confirm(
        `确定删除全部 ${photos.length} 张图片？\n\n云端会立即删除；删完后请点「保存到服务器」同步账目单。`
      )
    ) {
      return;
    }
    try {
      await uploadService.deletePhotos(photos.map((p) => p.id));
      patchRow({ photos: [] });
      setShareHint('已全部删除，请保存到服务器');
      setTimeout(() => setShareHint(''), 4000);
    } catch (err) {
      alert(`删除失败：${err.message || '未知错误'}`);
    }
  };

  const handleDriveUrlBlur = (raw) => {
    const normalized = normalizeGalleryDriveFolderUrl(raw);
    const patch = { galleryDriveFolderUrl: normalized };
    if (normalized && !row?.galleryShareToken) {
      patch.galleryShareToken = newGalleryShareToken();
    }
    patchRow(patch);
  };

  const handleShare = async () => {
    if (!canShareGallery) {
      alert('请先上传照片，或保留/填写 Google 云端硬盘文件夹链接');
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
      setShareHint('图库链接已复制');
      setTimeout(() => setShareHint(''), 4000);
    } catch (err) {
      alert(err.message || '复制失败');
    }
  };

  const handleRegenerateLink = () => {
    if (!canShareGallery) return;
    if (
      !confirm(
        '重新生成链接后，旧链接将立即失效。确定继续？\n\n生成后请保存到服务器，再点「分享」复制新链接。'
      )
    ) {
      return;
    }
    patchRow({ galleryShareToken: newGalleryShareToken() });
    setShareHint('已生成新链接；保存到服务器后，再点「分享」');
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

  const handleRequestClose = async () => {
    if (uploading) return;

    const savedPhotos = savedRow?.photos || [];
    const savedIds = new Set(savedPhotos.map((p) => p.id));
    const orphanIds = photos.filter((p) => !savedIds.has(p.id)).map((p) => p.id);

    if (orphanIds.length > 0) {
      const ok = window.confirm(
        `有 ${orphanIds.length} 张图片已上传到云端，但尚未保存到服务器。\n\n关闭后将删除这些图片；若想保留，请先点「保存到服务器」。\n\n确定关闭？`
      );
      if (!ok) return;
      try {
        await uploadService.deletePhotos(orphanIds);
      } catch (err) {
        const stillClose = window.confirm(
          `云端删除失败（${err.message || '未知错误'}）。仍要关闭吗？未保存的图片可能残留在云端。`
        );
        if (!stillClose) return;
      }
      patchRow({
        photos: savedPhotos,
        galleryShareToken: savedRow?.galleryShareToken || '',
        galleryDriveFolderUrl: savedRow?.galleryDriveFolderUrl || '',
        galleryListing: savedRow?.galleryListing || row?.galleryListing
      });
    }

    onClose();
  };

  if (!isOpen || !row || !panelStyle) return null;

  const shareUrl = row.galleryShareToken ? buildGalleryShareUrl(row.galleryShareToken) : '';
  const progressPct =
    uploadProgress && uploadProgress.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 0;

  const panel = (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleRequestClose} aria-hidden="true" />
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
            <p className="text-[11px] text-white/85 mt-0.5">
              OSS 上传（推荐）· 兼容原 Drive 链接 · 单张 ≤{config.oss.maxFileSize / 1024 / 1024}MB
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
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
            {canShareGallery ? (
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                分享
              </button>
            ) : null}
            {canShareGallery ? (
              <button
                type="button"
                onClick={handleRegenerateLink}
                className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                重新生成链接
              </button>
            ) : null}
            {photos.length > 0 ? (
              <button
                type="button"
                onClick={handleDeleteAllPhotos}
                disabled={uploading}
                className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                全部删除 OSS
              </button>
            ) : null}
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
              分享链接：{shareUrl}
            </p>
          ) : null}

          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <label htmlFor="gallery-drive-url" className="block text-xs font-medium text-gray-700">
              Google 云端硬盘文件夹（历史兼容 · 可保留）
            </label>
            <input
              id="gallery-drive-url"
              type="url"
              value={row.galleryDriveFolderUrl || ''}
              onChange={(e) => patchRow({ galleryDriveFolderUrl: e.target.value })}
              onBlur={(e) => handleDriveUrlBlur(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
              className={fieldCls}
            />
            <p className="text-[10px] text-gray-500 leading-snug">
              生产端已有 Drive 链接请勿清空；新图建议用上方「选择图片」上传到 OSS，手机端即可「下载全部」。
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {photos.length === 0 ? (
            <div className="py-6 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg text-sm px-3">
              {driveUrl
                ? '暂无 OSS 图片（公开页仍显示下方 Drive 预览）。可继续上传到 OSS 以支持手机一键下载。'
                : '暂无图片，点击「选择图片」上传到 OSS'}
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

          <div className="space-y-2 pt-1 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-700">房源说明（分享页展示）</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <span className="text-[10px] text-gray-600 block mb-1">出租状态</span>
                <div
                  className="flex rounded-lg border border-gray-300 overflow-hidden text-xs"
                  role="group"
                  aria-label="出租状态"
                >
                  {GALLERY_OCCUPANCY_OPTIONS.map((o) => {
                    const active = listing.occupancy === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => patchListing('occupancy', o.value)}
                        className={`flex-1 py-1.5 px-2 transition-colors ${
                          active
                            ? o.value === 'rented'
                              ? 'bg-emerald-600 text-white font-medium'
                              : 'bg-red-600 text-white font-medium'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">公寓</span>
                <input
                  type="text"
                  value={listing.condo}
                  onChange={(e) => patchListing('condo', e.target.value)}
                  className={fieldCls}
                  placeholder="自行填写"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">楼栋</span>
                <input
                  type="text"
                  value={listing.building}
                  onChange={(e) => patchListing('building', e.target.value)}
                  className={fieldCls}
                  placeholder="自行填写"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">租金（baht）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={listing.rentBaht}
                  onChange={(e) => patchListing('rentBaht', e.target.value)}
                  className={fieldCls}
                  placeholder="例如 15000"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">押金（baht）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={listing.depositBaht}
                  onChange={(e) => patchListing('depositBaht', e.target.value)}
                  className={fieldCls}
                  placeholder="例如 30000"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">面积（sqm）</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={listing.areaSqm}
                  onChange={(e) => patchListing('areaSqm', e.target.value)}
                  className={fieldCls}
                  placeholder="例如 35"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">户型</span>
                <select
                  value={listing.layout}
                  onChange={(e) => patchListing('layout', e.target.value)}
                  className={fieldCls}
                >
                  {GALLERY_LAYOUT_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">电费</span>
                <input
                  type="text"
                  value={listing.electricFee}
                  onChange={(e) => patchListing('electricFee', e.target.value)}
                  className={fieldCls}
                  placeholder="自行填写"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">水费</span>
                <input
                  type="text"
                  value={listing.waterFee}
                  onChange={(e) => patchListing('waterFee', e.target.value)}
                  className={fieldCls}
                  placeholder="自行填写"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">电视 · 尺寸（inch）</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={listing.tvInch}
                  onChange={(e) => patchListing('tvInch', e.target.value)}
                  className={fieldCls}
                  placeholder="例如 43"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">电视 · 类型</span>
                <select
                  value={listing.tvType}
                  onChange={(e) => patchListing('tvType', e.target.value)}
                  className={fieldCls}
                >
                  {GALLERY_TV_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">网络</span>
                <select
                  value={listing.internet}
                  onChange={(e) => patchListing('internet', e.target.value)}
                  className={fieldCls}
                >
                  {GALLERY_INTERNET_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">门禁</span>
                <input
                  type="text"
                  value={listing.doorAccess}
                  onChange={(e) => patchListing('doorAccess', e.target.value)}
                  className={fieldCls}
                  placeholder="自行填写"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-gray-600">拍摄日期（选填）</span>
                <input
                  type="date"
                  value={listing.shootDate || ''}
                  onChange={(e) => patchListing('shootDate', e.target.value)}
                  className={fieldCls}
                />
              </label>
            </div>
          </div>
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
