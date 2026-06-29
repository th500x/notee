import { useEffect, useState, useMemo } from 'react';
import { fetchPublicGallery } from '../utils/accountingGalleryShare';
import { buildDriveFolderEmbedUrl } from '../utils/galleryDriveLink';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';
import {
  resolveGalleryShareLocale,
  getGalleryShareMessages,
  translateGalleryShareError,
  galleryShareHtmlLang
} from '../utils/galleryShareI18n';

/**
 * 账目单租金行 — 公开图库页（Google Drive 预览 + 房源说明）
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const locale = useMemo(() => resolveGalleryShareLocale(), []);
  const t = useMemo(() => getGalleryShareMessages(locale), [locale]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [listing, setListing] = useState({});

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

  const roomLabel = room?.trim() || '—';
  const hasDrive = !!driveFolderUrl?.trim();
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

        {!loading && !error && hasDrive && (
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
                      <dd className="text-gray-900 font-medium">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">
                <h2 className="text-sm font-semibold text-gray-900">{t.drivePreviewTitle}</h2>
                <p className="text-xs text-gray-600 mt-1">{t.drivePreviewHint}</p>
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
          </>
        )}

        {!loading && !error && !hasDrive && (
          <div className="text-center py-16 text-gray-500">{t.emptyGallery}</div>
        )}
      </main>
    </div>
  );
}
