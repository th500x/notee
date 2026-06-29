import { useEffect, useState, useMemo } from 'react';
import { fetchPublicGallery } from '../utils/accountingGalleryShare';
import { buildDriveFolderEmbedUrl } from '../utils/galleryDriveLink';
import { buildGalleryListingDisplayLines } from '../utils/galleryListing';

/**
 * 账目单租金行 — 公开图库页（Google Drive 预览 + 房源说明）
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [listing, setListing] = useState({});

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
          const msg = err.message || '加载失败';
          if (msg.includes('链接无效') || msg.includes('已失效')) {
            setError(
              '链接无效或尚未生效。常见原因：填写后还没有点「保存到服务器」，或链接已被重新生成。请让分享方保存后再发链接。'
            );
          } else if (msg.includes('未配置 Google')) {
            setError('分享方尚未配置 Google 云端硬盘文件夹链接，请让对方在图库中粘贴链接并保存。');
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const roomLabel = room?.trim() || '—';
  const hasDrive = !!driveFolderUrl?.trim();
  const listingLines = useMemo(() => buildGalleryListingDisplayLines(listing), [listing]);
  const driveEmbedUrl = useMemo(
    () => (hasDrive ? buildDriveFolderEmbedUrl(driveFolderUrl) : ''),
    [hasDrive, driveFolderUrl]
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">图片库</h1>
          <p className="text-sm text-gray-600 mt-1">
            房号：<span className="font-semibold text-gray-900">{roomLabel}</span>
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && <div className="text-center py-16 text-gray-500">加载中…</div>}

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
                  <h2 className="text-sm font-semibold text-gray-900">房源说明</h2>
                </div>
                <dl className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {listingLines.map((line) => (
                    <div key={line.label} className="text-sm">
                      <dt className="text-gray-500 text-xs">{line.label}</dt>
                      <dd className="text-gray-900 font-medium">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section className="bg-white rounded-lg border border-emerald-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">
                <h2 className="text-sm font-semibold text-gray-900">Google 云端硬盘预览</h2>
                <p className="text-xs text-gray-600 mt-1">
                  点击下方网格可放大；批量下载请用下方按钮在 Google App 中打开（尤其安卓）。
                  若预览空白，请确认文件夹已设为「知道链接的人可查看」。
                </p>
              </div>
              {driveEmbedUrl ? (
                <iframe
                  title="Google 云端硬盘图片预览"
                  src={driveEmbedUrl}
                  className="w-full border-0 bg-gray-50"
                  style={{ minHeight: 'min(72vh, 640px)' }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <p className="px-4 py-8 text-sm text-gray-500 text-center">
                  无法嵌入预览，请使用下方按钮打开文件夹。
                </p>
              )}
              <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                <a
                  href={driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  在 Google 云端硬盘中打开
                </a>
                <span className="text-xs text-gray-500">下载、保存到相册请在 Google 页面操作</span>
              </div>
            </section>
          </>
        )}

        {!loading && !error && !hasDrive && (
          <div className="text-center py-16 text-gray-500">图库暂无内容</div>
        )}
      </main>
    </div>
  );
}
