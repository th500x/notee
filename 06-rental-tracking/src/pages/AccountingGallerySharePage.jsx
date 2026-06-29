import { useEffect, useState, useCallback } from 'react';
import PhotoViewer from '../components/PhotoViewer';
import { fetchPublicGallery, saveAllGalleryPhotos, downloadSinglePhoto } from '../utils/accountingGalleryShare';
import { formatCaptureTimeDisplay, getPhotoCaptureIso } from '../utils/photoCaptureTime';

/**
 * 账目单租金行 — 公开图库页（无需登录）
 * 路径：/06-rental-tracking/gallery/:token
 */
export default function AccountingGallerySharePage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState('');
  const [photos, setPhotos] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [saveProgress, setSaveProgress] = useState('');
  const [saving, setSaving] = useState(false);

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
      } catch (err) {
        if (!cancelled) {
          const msg = err.message || '加载失败';
          if (msg.includes('链接无效') || msg.includes('已失效')) {
            setError(
              '链接无效或尚未生效。常见原因：上传/分享后还没有点「保存到服务器」，或链接已被重新生成。请让分享方保存后再发链接。'
            );
          } else if (msg.includes('图库暂无图片')) {
            setError('该图库目前没有图片，请让分享方重新上传并保存。');
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

  const handleSaveAll = useCallback(async () => {
    if (!photos.length || saving) return;
    setSaving(true);
    setSaveProgress('准备中…');
    try {
      const mode = await saveAllGalleryPhotos(photos, room, (cur, total) => {
        setSaveProgress(`正在保存 ${cur}/${total}…`);
      });
      setSaveProgress(mode === 'share' ? '已通过系统分享面板保存' : '已全部触发下载');
    } catch (err) {
      setSaveProgress('');
      alert(err.message || '保存失败，请尝试逐张下载或长按图片保存');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveProgress(''), 4000);
    }
  }, [photos, room, saving]);

  const roomLabel = room?.trim() || '—';

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
        {loading && (
          <div className="text-center py-16 text-gray-500">加载中…</div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && photos.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存全部图片'}
              </button>
              {saveProgress && (
                <span className="text-sm text-gray-600">{saveProgress}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              手机端会优先打开系统分享面板；若无法一次全部保存，可点单张「下载」或长按图片保存。
            </p>

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
                      alt={photo.name || `图片 ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                  <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-gray-100">
                    <span className="text-xs text-gray-600">
                      拍摄 {formatCaptureTimeDisplay(getPhotoCaptureIso(photo))}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadSinglePhoto(room, photo, index).catch(() => {
                        alert('下载失败，请长按图片保存');
                      })}
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      下载
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !error && photos.length === 0 && (
          <div className="text-center py-16 text-gray-500">图库暂无图片</div>
        )}
      </main>

      {viewerIndex !== null && photos.length > 0 && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
