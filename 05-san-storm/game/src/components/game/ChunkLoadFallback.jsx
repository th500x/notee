/**
 * 懒加载分包时的占位（GamePage / WorldMap 共用，避免首包过大）。
 */
export default function ChunkLoadFallback({ label = '加载中…' }) {
  return (
    <div className="flex min-h-[8rem] flex-1 items-center justify-center py-12">
      <div className="text-center text-stone-400 text-sm">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-400 mb-2" />
        <div>{label}</div>
      </div>
    </div>
  );
}
