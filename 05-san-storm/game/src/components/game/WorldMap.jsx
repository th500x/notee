/**
 * 大地图组件（临时版）
 * 
 * @description 使用游戏介绍时随机选中的背景图作为大地图
 *              TODO: 后续替换为正式的交互式大地图
 */

const BG_CACHE_KEY = 'game_intro_bg';
const BG_DIR = 'assets/san_1_map/bg/';
const DEFAULT_BG = 'av1_00001_.png';

/** 从 localStorage 读取缓存的背景图路径 */
function getCachedBg() {
  try {
    const cached = localStorage.getItem(BG_CACHE_KEY);
    if (cached) {
      const { file } = JSON.parse(cached);
      if (file) return BG_DIR + file;
    }
  } catch {}
  return BG_DIR + DEFAULT_BG;
}

export default function WorldMap() {
  const bgPath = getCachedBg();
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <div className="relative w-full h-full">
      {/* 背景地图 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${baseUrl}${bgPath})` }}
      />

      {/* 半透明遮罩 + 提示 */}
      <div className="absolute inset-0 bg-black/10" />

      {/* 中央提示 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 
                      px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm">
        <p className="text-white/70 text-xs text-center">
          🗺️ 大地图 — 点击下方导航进入各功能
        </p>
      </div>
    </div>
  );
}
