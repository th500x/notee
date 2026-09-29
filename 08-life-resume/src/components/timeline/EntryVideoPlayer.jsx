export default function EntryVideoPlayer({ media = [] }) {
  const video = media.find((item) => item.mediaType === 'video' && item.url);
  if (!video) return null;

  return (
    <div className="mt-3 rounded-lg overflow-hidden bg-black border border-slate-200">
      <video
        className="w-full max-h-80"
        controls
        playsInline
        preload="metadata"
        src={video.url}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}
