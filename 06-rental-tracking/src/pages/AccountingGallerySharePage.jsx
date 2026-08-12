import { useEffect, useState, useCallback, useMemo } from 'react';
import PhotoViewer from '../components/PhotoViewer';
import {
  fetchPublicGallery,
  saveAllGalleryPhotos,
  downloadSinglePhoto
} from '../utils/accountingGalleryShare';
import { formatCaptureTimeDisplay, getPhotoCaptureIso } from '../utils/photoCaptureTime';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';
// Drive 方案暂时停用
// import { buildDriveFolderEmbedUrl } from '../utils/galleryDriveLink';
import {
  resolveGalleryShareLocale,
  getGalleryShareMessages,
  translateGalleryShareError,
  galleryShareHtmlLang
} from '../utils/galleryShareI18n';

/**
 * 账目单租金行 — 公开图库页（OSS 图片 + 下载全部 + 房源说明）
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const locale = useMemo(() => resolveGalleryShareLocale(), []);
  const t = useMemo(() => getGalleryShareMessages(locale), [locale]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [photos, setPhotos] = useState([]);
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
  const listingLines = useMemo(
    () => buildGalleryListingDisplayLines(listing, locale),
    [listing, locale]
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

        {!loading && !error && hasPhotos && (
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

            {/*
            // —— Google Drive 嵌入预览（暂时停用）——
            */}

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
        )}

        {!loading && !error && !hasPhotos && (
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
