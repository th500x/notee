/**
 * 大地图内嵌入口：与门户「三国地图」同一套管理 UI（战役地图管理页结构），仅增加顶栏关闭。
 */
import JunCountyMapGeneratorManager from '@/components/admin/JunCountyMapGeneratorManager';

export default function JunCountyQuadPreviewPanel({ onClose }) {
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-30 flex justify-end items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
      <JunCountyMapGeneratorManager embedded />
    </div>
  );
}
