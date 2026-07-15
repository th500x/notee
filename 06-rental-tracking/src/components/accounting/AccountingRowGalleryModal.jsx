import { useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
      const maxPanelHeight = isMobile ? Math.min(vh * 0.85, 680) : Math.min(vh * 0.88, 720);

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

const fieldCls =
  'w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-500';

/**
 * 账目单租金行 — 图库（Google Drive + 房源说明 + 分享）
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
  const [shareHint, setShareHint] = useState('');

  const roomLabel = row?.room?.trim() || '（未填房号）';
  const panelStyle = useGalleryPanelStyle(anchorEl, isOpen);
  const listing = normalizeGalleryListing(row?.galleryListing);
  const driveUrl = (row?.galleryDriveFolderUrl || '').trim();

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

  const handleDriveUrlBlur = (raw) => {
    const normalized = normalizeGalleryDriveFolderUrl(raw);
    const patch = { galleryDriveFolderUrl: normalized };
    if (normalized && !row?.galleryShareToken) {
      patch.galleryShareToken = newGalleryShareToken();
    }
    patchRow(patch);
  };

  const handleShare = async () => {
    if (!driveUrl) {
      alert('请先粘贴 Google 云端硬盘文件夹链接');
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
    if (!driveUrl) return;
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

  if (!isOpen || !row || !panelStyle) return null;

  const shareUrl = row.galleryShareToken ? buildGalleryShareUrl(row.galleryShareToken) : '';

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
            <p className="text-[11px] text-white/85 mt-0.5">Google 云端硬盘 · 填写说明后保存</p>
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
              onClick={handleShare}
              disabled={!driveUrl}
              className="px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              分享
            </button>
            {driveUrl ? (
              <button
                type="button"
                onClick={handleRegenerateLink}
                className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                重新生成链接
              </button>
            ) : null}
          </div>

          {shareHint ? <p className="text-sm text-emerald-700">{shareHint}</p> : null}
          {shareUrl ? (
            <p className="text-[11px] text-gray-500 break-all" title={shareUrl}>
              分享链接：{shareUrl}
            </p>
          ) : null}

          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <label htmlFor="gallery-drive-url" className="block text-xs font-medium text-gray-700">
              Google 云端硬盘文件夹 <span className="text-red-600">*</span>
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
              在 Drive 上传图片后，粘贴「知道链接的人可查看」的文件夹链接。图片仅存放在 Google，不在本站上传。
            </p>
          </div>

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
            disabled={saving || !onSaveToServer}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存到服务器'}
          </button>
          <p className="mt-1.5 text-[10px] text-gray-500 text-center">
            与页面底部保存相同，会保存整张账目单
          </p>
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
