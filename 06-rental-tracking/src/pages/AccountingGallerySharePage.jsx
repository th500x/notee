import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PhotoViewer from '../components/PhotoViewer';
import {
  fetchPublicGallery,
  prepareGalleryPhotoFiles,
  shareGalleryPhotoFiles,
  downloadAllViaProxyUrls,
  downloadSinglePhoto,
  probeCanShareFiles
} from '../utils/accountingGalleryShare';
import { formatCaptureTimeDisplay, getPhotoCaptureIso } from '../utils/photoCaptureTime';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';
import {
  resolveGalleryShareLocale,
  getGalleryShareMessages,
  translateGalleryShareError,
  galleryShareHtmlLang
} from '../utils/galleryShareI18n';

/**
 * 账目单租金行 — 公开图库页（OSS 图片 + 系统分享 / 下载）
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
  const [preparing, setPreparing] = useState(false);
  const [preparedFiles, setPreparedFiles] = useState(null);
  const [sharing, setSharing] = useState(false);
  const supportsShareRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = galleryShareHtmlLang(locale);
  }, [locale]);

  useEffect(() => {
    supportsShareRef.current = probeCanShareFiles();
  }, []);

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

  /** 手机：并行准备后二次点击走系统分享；PC 无分享时走代理逐张下载 */
  const handlePrepareAll = useCallback(async () => {
    if (!photos.length || preparing) return;
    supportsShareRef.current = probeCanShareFiles();
    setPreparing(true);
    setPreparedFiles(null);
    setSaveProgress(t.savePreparing);
    try {
      if (!supportsShareRef.current) {
        await downloadAllViaProxyUrls(token, photos, room, (cur, total) => {
          setSaveProgress(t.saveProgress.replace('{cur}', String(cur)).replace('{total}', String(total)));
        });
        setSaveProgress(t.saveDoneSequential);
        setTimeout(() => setSaveProgress(''), 4000);
        return;
      }
      const files = await prepareGalleryPhotoFiles(token, photos, room, (cur, total) => {
        setSaveProgress(t.prepareProgress.replace('{cur}', String(cur)).replace('{total}', String(total)));
      });
      setPreparedFiles(files);
      setSaveProgress(t.prepareReadyShare);
    } catch (err) {
      setPreparedFiles(null);
      setSaveProgress('');
      alert(err.message || t.saveFailed);
    } finally {
      setPreparing(false);
    }
  }, [photos, preparing, room, token, t]);

  const handleShareToAlbum = useCallback(async () => {
    if (!preparedFiles?.length || sharing) return;
    setSharing(true);
    setSaveProgress(t.sharingHint);
    try {
      const mode = await shareGalleryPhotoFiles(preparedFiles, room, (cur, total) => {
        if (total > 1) {
          setSaveProgress(
            t.shareBatchProgress.replace('{cur}', String(cur)).replace('{total}', String(total))
          );
        }
      });
      if (mode === 'share') {
        setSaveProgress(t.saveDoneShare);
        setTimeout(() => setSaveProgress(''), 5000);
      } else {
        setSaveProgress(t.shareUnsupported);
      }
    } catch (err) {
      setSaveProgress('');
      alert(err.message || t.saveFailed);
    } finally {
      setSharing(false);
    }
  }, [preparedFiles, room, sharing, t]);

  const roomLabel = room?.trim() || '—';
  const hasPhotos = photos.length > 0;
  const listingLines = useMemo(
    () => buildGalleryListingDisplayLines(listing, locale),
    [listing, locale]
  );
  const readyCount = preparedFiles?.length || 0;

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

            <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrepareAll}
                  disabled={preparing || sharing}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {preparing ? t.savingAll : t.saveAll}
                </button>
                {saveProgress ? (
                  <span className="text-sm text-gray-600">{saveProgress}</span>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">{t.saveAllHint}</p>

              {readyCount > 0 ? (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <p className="text-sm text-gray-800 font-medium">
                    {t.readyCountLabel.replace('{n}', String(readyCount))}
                  </p>
                  <button
                    type="button"
                    onClick={handleShareToAlbum}
                    disabled={sharing || preparing}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sharing ? t.sharingBusy : t.saveToAlbum}
                  </button>
                  <p className="text-xs text-gray-500">{t.albumVsDownloadHint}</p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-w-0"
                >
                  <button
                    type="button"
                    className="block w-full aspect-square bg-gray-100"
                    onClick={() => setViewerIndex(index)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name || `${t.photoAlt} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="px-1.5 py-1.5 sm:px-2 flex items-center justify-between gap-1 border-t border-gray-100">
                    <span className="text-[10px] sm:text-xs text-gray-600 truncate min-w-0">
                      {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadSinglePhoto(token, room, photo, index).catch(() => {
                          alert(t.downloadFailed);
                        })
                      }
                      className="text-[10px] sm:text-xs text-blue-600 hover:underline shrink-0"
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
