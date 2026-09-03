/**
 * 头像清单服务
 *
 * @description
 *   把"按目录扫描可用头像"从路由内联同步 IO（`fs.readdirSync × N`）抽出来：
 *     - **异步 IO**：使用 `fs.promises.readdir`，不再阻塞 Node 事件循环
 *     - **进程内缓存**：扫描结果按 TTL 缓存（生产 5 分钟、开发 30 秒），命中后零 IO
 *     - **单飞（single-flight）**：缓存失效后并发请求只触发一次扫描，避免击穿
 *     - **目录缺失静默返回空**：与原行为一致
 *
 *   将来要切到 OSS 头像源（见 `CODE_REVIEW_2026_04_29.md` H5），只需在此处替换扫描实现 +
 *   `invalidateAvatarCache()`，路由层无需变更。
 *
 *   与 **必改 #2** 一致；缓存命中率应接近 100%（角色创建是低频操作，TTL 再短也够用）。
 *
 * @module services/avatarService
 */

const fs = require('fs').promises;
const path = require('path');

const AVATAR_DIR = path.join(__dirname, '../../public/assets/san_1_ui_card/avatar');

/** 与原 `routes/players.js` 内联映射保持一致；如新增分类目录需同步此处 */
const CATEGORY_LABELS = {
  '01_elder_male_scholar':   '白须儒雅',
  '02_elder_male_warrior':   '白须老将',
  '03_elder_female_noble':   '年上贵妇',
  '04_elder_female_folk':    '年上内助',
  '05_mid_male_scholar':     '中年谋士',
  '06_mid_male_warrior':     '中年将军',
  '07_mid_female_noble':     '人妻少妇',
  '08_mid_female_warrior':   '人妻女将',
  '09_young_male_scholar':   '青年书生',
  '10_young_male_warrior':   '青年将官',
  '11_young_female_scholar': '青年才女',
  '12_young_female_warrior': '青年女侠',
};

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp)$/i;

const DEFAULT_TTL_MS = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 30 * 1000;

function getTtlMs() {
  const raw = Number(process.env.AVATAR_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_TTL_MS;
}

let cacheEntry = null; // { categories: Array, expiresAt: number }
let inflight = null;   // Promise<Array> | null

/** 实际磁盘扫描。错误会向上抛；ENOENT 视为"无头像目录"返回空数组。 */
async function scan() {
  let dirEntries;
  try {
    dirEntries = await fs.readdir(AVATAR_DIR, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }

  const categoryDirs = dirEntries
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const categories = await Promise.all(
    categoryDirs.map(async (dir) => {
      const dirPath = path.join(AVATAR_DIR, dir.name);
      const files = await fs.readdir(dirPath);
      const avatars = files
        .filter((f) => IMAGE_EXT_RE.test(f))
        .sort()
        .map((f) => `assets/san_1_ui_card/avatar/${dir.name}/${f}`);
      return {
        id: dir.name,
        label: CATEGORY_LABELS[dir.name] || dir.name,
        avatars,
      };
    })
  );

  return categories.filter((c) => c.avatars.length > 0);
}

/**
 * 取头像分类清单（带 TTL 缓存 + 单飞）。
 * @returns {Promise<Array<{id:string,label:string,avatars:string[]}>>}
 */
async function getAvatarCategories() {
  const now = Date.now();
  if (cacheEntry && cacheEntry.expiresAt > now) return cacheEntry.categories;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const categories = await scan();
      cacheEntry = { categories, expiresAt: Date.now() + getTtlMs() };
      return categories;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** 强制清空缓存（管理脚本 / 切换 OSS 源等场景使用） */
function invalidateAvatarCache() {
  cacheEntry = null;
}

module.exports = {
  getAvatarCategories,
  invalidateAvatarCache,
};
