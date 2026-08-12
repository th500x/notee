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
import {
  detectRestrictedInAppBrowser,
  tryOpenInSystemBrowser,
  copyCurrentPageUrl
} from '../utils/inAppBrowser';
import { formatCaptureTimeDisplay, getPhotoCaptureIso } from '../utils/photoCaptureTime';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';
import {
  resolveGalleryShareLocale,
  getGalleryShareMessages,
  translateGalleryShareError,
  galleryShareHtmlLang
} from '../utils/galleryShareI18n';
import { buildOssImageUrl } from '../utils/ossImageUrl';

/**
 * 账目单租金行 — 公开图库页（OSS 图片 + 系统分享 / 下载）
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const locale = useMemo(() => resolveGalleryShareLocale(), []);
  const t = useMemo(() => getGalleryShareMessages(locale), [locale]);
  const inApp = useMemo(() => detectRestrictedInAppBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [photos, setPhotos] = useState([]);
  const [listing, setListing] = useState({});
  const [viewerIndex, setViewerIndex] = useState(null);
  const [saveProgress, setSaveProgress] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparedFiles, setPreparedFiles] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [canShareFiles, setCanShareFiles] = useState(false);
  /** 多批分享：等待用户再点「继续分享第 N 批」 */
  const [shareContinue, setShareContinue] = useState(null);
  const supportsShareRef = useRef(false);
  const continueShareResolverRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = galleryShareHtmlLang(locale);
  }, [locale]);

  useEffect(() => {
    const ok = probeCanShareFiles();
    supportsShareRef.current = ok;
    setCanShareFiles(ok);
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

  const handleOpenInBrowser = useCallback(() => {
    setSaveProgress(t.openInBrowserBusy);
    const jumped = tryOpenInSystemBrowser();
    if (!jumped) {
      setSaveProgress(t.inAppSaveBlocked);
      setTimeout(() => setSaveProgress(''), 5000);
    } else {
      setTimeout(() => setSaveProgress(''), 3000);
    }
  }, [t]);

  const handleCopyLink = useCallback(async () => {
    try {
      await copyCurrentPageUrl();
      setCopyHint(t.copyPageLinkDone);
      setTimeout(() => setCopyHint(''), 4000);
    } catch {
      setCopyHint(t.copyPageLinkFailed);
      setTimeout(() => setCopyHint(''), 4000);
    }
  }, [t]);

  /** 一次性下载全部（与单张「下载」相同代理方式） */
  const handleDownloadAll = useCallback(async () => {
    if (!photos.length || downloading || preparing || sharing) return;
    if (inApp.restricted) {
      handleOpenInBrowser();
      return;
    }
    setDownloading(true);
    setSaveProgress(t.saveProgress.replace('{cur}', '0').replace('{total}', String(photos.length)));
    try {
      await downloadAllViaProxyUrls(token, photos, room, (cur, total) => {
        setSaveProgress(t.saveProgress.replace('{cur}', String(cur)).replace('{total}', String(total)));
      });
      setSaveProgress(t.saveDoneSequential);
      setTimeout(() => setSaveProgress(''), 4000);
    } catch (err) {
      setSaveProgress('');
      alert(err.message || t.saveFailed);
    } finally {
      setDownloading(false);
    }
  }, [photos, downloading, preparing, sharing, room, token, t, inApp.restricted, handleOpenInBrowser]);

  const waitForShareContinue = useCallback(
    (next, total) =>
      new Promise((resolve) => {
        continueShareResolverRef.current = resolve;
        setShareContinue({ cur: next, total });
        setSaveProgress(
          t.shareBatchContinueHint
            .replace('{cur}', String(next))
            .replace('{total}', String(total))
        );
      }),
    [t]
  );

  /**
   * 「分享到应用」：未准备时先拉取；准备后分享（>9 张按批，每批后再点继续）
   */
  const handleShareToApp = useCallback(async () => {
    // 多批：用户点「继续分享」解除等待
    if (continueShareResolverRef.current) {
      const resolve = continueShareResolverRef.current;
      continueShareResolverRef.current = null;
      setShareContinue(null);
      resolve();
      return;
    }

    if (!photos.length || preparing || downloading || sharing) return;
    if (inApp.restricted) {
      handleOpenInBrowser();
      return;
    }
    supportsShareRef.current = probeCanShareFiles();
    setCanShareFiles(supportsShareRef.current);
    if (!supportsShareRef.current) {
      setSaveProgress(t.shareUnsupported);
      setTimeout(() => setSaveProgress(''), 5000);
      return;
    }

    if (!preparedFiles?.length) {
      setPreparing(true);
      setPreparedFiles(null);
      setSaveProgress(t.savePreparing);
      try {
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
      return;
    }

    setSharing(true);
    setSaveProgress(t.sharingHint);
    try {
      const mode = await shareGalleryPhotoFiles(
        preparedFiles,
        room,
        (cur, total) => {
          if (total > 1) {
            setSaveProgress(
              t.shareBatchProgress.replace('{cur}', String(cur)).replace('{total}', String(total))
            );
          }
        },
        { onNeedContinue: waitForShareContinue }
      );
      if (mode === 'share') {
        setSaveProgress(t.shareAllBatchesDone);
        setTimeout(() => setSaveProgress(''), 5000);
      } else {
        setSaveProgress(t.shareUnsupported);
      }
    } catch (err) {
      setSaveProgress('');
      alert(err.message || t.saveFailed);
    } finally {
      continueShareResolverRef.current = null;
      setShareContinue(null);
      setSharing(false);
    }
  }, [
    photos,
    preparing,
    downloading,
    sharing,
    preparedFiles,
    room,
    token,
    t,
    inApp.restricted,
    handleOpenInBrowser,
    waitForShareContinue
  ]);

  const roomLabel = room?.trim() || '—';
  const hasPhotos = photos.length > 0;
  const listingLines = useMemo(
    () => buildGalleryListingDisplayLines(listing, locale),
    [listing, locale]
  );
  const readyCount = preparedFiles?.length || 0;
  const appLabel = inApp.label || 'App';
  const busy = downloading || preparing || (sharing && !shareContinue);

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
            {inApp.restricted ? (
              <section className="mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50 shadow-sm space-y-3">
                <h2 className="text-sm font-semibold text-amber-950">
                  {t.inAppBannerTitle.replace('{app}', appLabel)}
                </h2>
                <p className="text-sm text-amber-900 leading-relaxed">{t.inAppBannerBody}</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {inApp.os === 'ios' ? t.inAppHowToIos : t.inAppHowToAndroid}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenInBrowser}
                    className="px-4 py-2.5 rounded-lg bg-amber-700 text-white font-medium hover:bg-amber-800"
                  >
                    {t.openInBrowser}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-lg bg-white border border-amber-400 text-amber-950 font-medium hover:bg-amber-100"
                  >
                    {t.copyPageLink}
                  </button>
                </div>
                {copyHint ? <p className="text-xs text-amber-900">{copyHint}</p> : null}
              </section>
            ) : null}

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
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                <button
                  type="button"
                  onClick={inApp.restricted ? handleOpenInBrowser : handleDownloadAll}
                  disabled={busy && !inApp.restricted}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {inApp.restricted
                    ? t.openInBrowser
                    : downloading
                      ? t.downloadingAll
                      : t.downloadToPhone}
                </button>
                {!inApp.restricted && canShareFiles ? (
                  <button
                    type="button"
                    onClick={handleShareToApp}
                    disabled={busy}
                    className={`px-4 py-2.5 rounded-lg font-medium disabled:opacity-50 ${
                      readyCount > 0 || shareContinue
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-white border border-emerald-500 text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    {preparing
                      ? t.preparingShare
                      : shareContinue
                        ? t.continueShareBatch
                            .replace('{cur}', String(shareContinue.cur))
                            .replace('{total}', String(shareContinue.total))
                        : sharing
                          ? t.sharingBusy
                          : t.shareToApp}
                  </button>
                ) : null}
                {saveProgress ? (
                  <span className="text-sm text-gray-600">{saveProgress}</span>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                {inApp.restricted ? t.inAppSaveBlocked : t.actionsHint}
              </p>
              {!inApp.restricted && readyCount > 0 ? (
                <p className="text-sm text-gray-800 font-medium">
                  {t.readyCountLabel.replace('{n}', String(readyCount))}
                  <span className="ml-2 text-xs font-normal text-gray-500">{t.shareToAppHint}</span>
                </p>
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
                      src={buildOssImageUrl(photo.url, 'thumb')}
                      alt={photo.name || `${t.photoAlt} ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                  <div className="px-1.5 py-1.5 sm:px-2 flex items-center justify-between gap-1 border-t border-gray-100">
                    <span className="text-[10px] sm:text-xs text-gray-600 truncate min-w-0">
                      {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (inApp.restricted) {
                          handleOpenInBrowser();
                          return;
                        }
                        downloadSinglePhoto(token, room, photo, index).catch(() => {
                          alert(t.downloadFailed);
                        });
                      }}
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
