/**
 * BGM 曲目与缓存约定
 *
 * 定稿文件目录：public/assets/san_1_audio/bgm/
 * 提示词与 Suno 流程：docs/00/90-assets/99-7-PROMPT_MUSIC_SUNO.md
 */

/** 场景 ID → 文件名（与 public/assets/san_1_audio/bgm/ 一致） */
export const BGM_TRACK_FILES = {
  theme_main: 'theme_main_Dawn Realm Fade.mp3',
  battle_small: 'battle_small_Roadside Erhu Ambush.mp3',
  battle_campaign: 'battle_large_Bianzhong Thunder.mp3',
};

/** 默认播放音量 0～1 */
export const BGM_DEFAULT_VOLUME = 0.5;

/** 曲目切换淡入淡出时长（毫秒） */
export const BGM_CROSSFADE_MS = 1200;

/**
 * 静态 MP3 建议 HTTP 缓存（生产部署 Cache-Control max-age）
 * 90 天：BGM 变更频率低，利于回流玩家；更新曲目时改文件名或 query 破缓存
 */
export const BGM_RECOMMENDED_HTTP_CACHE_MAX_AGE_SEC = 90 * 24 * 60 * 60;

const BGM_ASSET_DIR = 'assets/san_1_audio/bgm/';

/**
 * @param {keyof typeof BGM_TRACK_FILES} sceneId
 * @returns {string}
 */
export function resolveBgmUrl(sceneId) {
  const file = BGM_TRACK_FILES[sceneId];
  if (!file) return '';
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${BGM_ASSET_DIR}${encodeURIComponent(file)}`;
}
