import { useEffect, useState, useCallback, useMemo } from 'react';
import PhotoViewer from '../components/PhotoViewer';
import {
  fetchPublicGallery,
  saveAllGalleryPhotos,
  downloadSinglePhoto
} from '../utils/accountingGalleryShare';
import { formatCaptureTimeDisplay, getPhotoCaptureIso } from '../utils/photoCaptureTime';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';
import { buildDriveFolderEmbedUrl } from '../utils/galleryDriveLink';
import {
  resolveGalleryShareLocale,
  getGalleryShareMessages,
  translateGalleryShareError,
  galleryShareHtmlLang
} from '../utils/galleryShareI18n';

/**
 * 账目单租金行 — 公开图库页
 * 双轨：历史 Google Drive 链接仍可用；有 OSS photos 时提供「下载全部」
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const locale = useMemo(() => resolveGalleryShareLocale(), []);
  const t = useMemo(() => getGalleryShareMessages(locale), [locale]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [photos, setPhotos] = useState([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [listing, setListing] = useState({});
  const [viewerIndex, setViewerIndex] = useState(null);
  const [saveProgress, setSaveProgress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.lang = galleryShareHtmlLang(locale);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPublicGallery(token);
        if (cancelled) return;
        setRoom(data.room || '');
        setPhotos(Array.isArray(data.photos) ? data.photos : []);
        setDriveFolderUrl(data.driveFolderUrl || '');
        setListing(data.listing || {});
      } catch (err) {
        if (!cancelled) {
          setError(translateGalleryShareError(locale, err.message || t.errorLoadFailed));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, locale, t.errorLoadFailed]);

  const handleSaveAll = useCallback(async () => {
    if (!photos.length || saving) return;
    setSaving(true);
    setSaveProgress(t.savePreparing);
    try {
      const mode = await saveAllGalleryPhotos(token, photos, room, (cur, total) => {
        setSaveProgress(t.saveProgress.replace('{cur}', String(cur)).replace('{total}', String(total)));
      });
      setSaveProgress(mode === 'share' ? t.saveDoneShare : t.saveDoneSequential);
    } catch (err) {
      setSaveProgress('');
      alert(err.message || t.saveFailed);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveProgress(''), 4000);
    }
  }, [photos, room, saving, token, t]);

  const roomLabel = room?.trim() || '—';
  const hasPhotos = photos.length > 0;
  const hasDrive = !!driveFolderUrl?.trim();
  const hasContent = hasPhotos || hasDrive;
  const listingLines = useMemo(
    () => buildGalleryListingDisplayLines(listing, locale),
    [listing, locale]
  );
  const driveEmbedUrl = useMemo(
    () => (hasDrive ? buildDriveFolderEmbedUrl(driveFolderUrl) : ''),
    [hasDrive, driveFolderUrl]
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">{t.pageTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t.roomLabel}：<span className="font-semibold text-gray-900">{roomLabel}</span>
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && <div className="text-center py-16 text-gray-500">{t.loading}</div>}

        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && hasContent && (
          <>
            {listingLines.length > 0 ? (
              <section className="mb-5 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-900">{t.listingTitle}</h2>
                </div>
                <dl className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {listingLines.map((line) => (
                    <div key={`${line.label}-${line.value}`} className="text-sm">
                      <dt className="text-gray-500 text-xs">{line.label}</dt>
                      <dd
                        className={`font-medium ${
                          line.valueTone === 'rented'
                            ? 'text-emerald-600'
                            : line.valueTone === 'vacant'
                              ? 'text-red-600'
                              : 'text-gray-900'
                        }`}
                      >
                        {line.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {/* 历史数据：仅有 Google Drive 时仍可预览 / 打开 */}
            {hasDrive ? (
              <section className="mb-5 bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">
                  <h2 className="text-sm font-semibold text-gray-900">{t.drivePreviewTitle}</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    {hasPhotos ? t.driveLegacyWithOssHint : t.drivePreviewHint}
                  </p>
                </div>
                {driveEmbedUrl ? (
                  <iframe
                    title={t.iframeTitle}
                    src={driveEmbedUrl}
                    className="w-full border-0 bg-gray-50"
                    style={{ minHeight: 'min(72vh, 640px)' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <p className="px-4 py-8 text-sm text-gray-500 text-center">{t.embedFallback}</p>
                )}
                <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                  <a
                    href={driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    {t.openInDrive}
                  </a>
                  <span className="text-xs text-gray-500">{t.openInDriveHint}</span>
                </div>
              </section>
            ) : null}

            {/* 新流程：OSS 图片 + 下载全部 */}
            {hasPhotos ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? t.savingAll : t.saveAll}
                  </button>
                  {saveProgress ? <span className="text-sm text-gray-600">{saveProgress}</span> : null}
                </div>
                <p className="text-xs text-gray-500 mb-4">{t.saveAllHint}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        className="block w-full aspect-[4/3] bg-gray-100"
                        onClick={() => setViewerIndex(index)}
                      >
                        <img
                          src={photo.url}
                          alt={photo.name || `${t.photoAlt} ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-gray-100">
                        <span className="text-xs text-gray-600">
                          {t.capturedLabel} {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            downloadSinglePhoto(token, room, photo, index).catch(() => {
                              alert(t.downloadFailed);
                            })
                          }
                          className="text-xs text-blue-600 hover:underline shrink-0"
                        >
                          {t.downloadOne}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}

        {!loading && !error && !hasContent && (
          <div className="text-center py-16 text-gray-500">{t.emptyGallery}</div>
        )}
      </main>

      {viewerIndex !== null && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}
