/**
 * 开局介绍 / 更新公告全屏层共用的随机插画背景（localStorage 缓存）
 */
import { ILLUS_BG_FILES as BG_IMAGES, ILLUS_BG_DIR as BG_DIR } from '@/data/illusBgFiles';

const BG_CACHE_KEY = 'game_intro_bg';
const BG_CACHE_DAYS = 7;

export function getRandomGameIntroBackgroundUrl() {
  try {
    const cached = localStorage.getItem(BG_CACHE_KEY);
    if (cached) {
      const { file, expires } = JSON.parse(cached);
      if (Date.now() < expires && BG_IMAGES.includes(file)) {
        return BG_DIR + file;
      }
    }
  } catch { /* ignore */ }
  const file = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
  try {
    localStorage.setItem(
      BG_CACHE_KEY,
      JSON.stringify({
        file,
        expires: Date.now() + BG_CACHE_DAYS * 86400000,
      })
    );
  } catch { /* ignore */ }
  return BG_DIR + file;
}
