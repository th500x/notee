/**
 * 将领卡立绘：`public/assets/characters/avatars/{character_id}.png`（99-5 AIDXL 产出）。
 * 落地 PNG **128×128**（AI 768 直出后缩放；卡面 70px、地图 pawn ≤40px）；批量缩放见
 * `docs/tools/character/resize-character-avatars-to-128.py`。
 * 无文件时不发起 `<img>` 请求（见 `character-portrait-manifest.json`），UI 直接占位，避免控制台 404 刷屏。
 */
import { normalizeGamePublicBase } from './troopIconUrls.js';
import portraitManifest from '../../public/data/shared/character-portrait-manifest.json';

export const CHARACTER_PORTRAIT_AVATAR_DIR = 'assets/characters/avatars';
/** 仓库内落地立绘边长（px）；与 99-5 §4 一致 */
export const CHARACTER_PORTRAIT_TARGET_PX = 128;

const CHARACTER_ID_RE = /^san_\d+_char_\d+$/;

/** @type {Set<string>} */
const CHARACTER_PORTRAIT_SHIPPED_IDS = new Set(
  Array.isArray(portraitManifest?.characterIds) ? portraitManifest.characterIds : [],
);

/**
 * 默认 avatars 目录下是否已有落地 PNG（路径解析规则不变，仅控制是否发起网络读取）。
 * 创角等 `assets/san_1_ui_card/avatar/…` 等非 avatars 路径仍允许尝试加载。
 * @param {{ characterId?: string|null, avatar?: string|null, relPath?: string|null }} opts
 * @returns {boolean}
 */
export function shouldAttemptCharacterPortraitNetworkLoad({ characterId, avatar, relPath = null }) {
  const rel = relPath || resolveCharacterPortraitRelPath({ characterId, avatar });
  if (!rel) return false;
  const norm = String(rel).replace(/^\//, '');
  if (!norm.startsWith(`${CHARACTER_PORTRAIT_AVATAR_DIR}/`)) return true;
  const id = String(characterId || '').trim();
  if (!CHARACTER_ID_RE.test(id)) return false;
  return CHARACTER_PORTRAIT_SHIPPED_IDS.has(id);
}

/**
 * @param {string|null|undefined} characterId
 * @returns {string|null} 相对 public 根的路径，如 `assets/characters/avatars/san_1_char_1001.png`
 */
export function characterPortraitRelativePath(characterId) {
  const id = String(characterId || '').trim();
  if (!CHARACTER_ID_RE.test(id)) return null;
  return `${CHARACTER_PORTRAIT_AVATAR_DIR}/${id}.png`;
}

/**
 * 将领配置 `avatar` / extra.avatar → 相对 public 根的路径。
 * 支持完整 `assets/...`、仅文件名 `san_1_char_1001.png`、创角 `assets/san_1_ui_card/avatar/...`。
 * @param {string|null|undefined} avatar
 * @param {string|null|undefined} [characterId]
 * @returns {string|null}
 */
export function normalizeCharacterAvatarRelPath(avatar, characterId) {
  if (avatar == null || String(avatar).trim() === '') return null;
  const s = String(avatar).trim().replace(/^\//, '');
  if (!s) return null;
  if (s.startsWith('assets/')) return s;
  if (/^san_\d+_char_\d+\.(png|jpe?g|gif|webp)$/i.test(s)) {
    return `${CHARACTER_PORTRAIT_AVATAR_DIR}/${s}`;
  }
  const id = String(characterId || '').trim();
  if (CHARACTER_ID_RE.test(id) && s === `${id}.png`) {
    return `${CHARACTER_PORTRAIT_AVATAR_DIR}/${s}`;
  }
  return s;
}

/**
 * 将领立绘相对路径：配置 avatar → 按 id 拼 avatars 目录 → null。
 * @param {{ characterId?: string|null, avatar?: string|null }} opts
 * @returns {string|null}
 */
export function resolveCharacterPortraitRelPath({ characterId, avatar }) {
  const fromCfg = normalizeCharacterAvatarRelPath(avatar, characterId);
  if (fromCfg) return fromCfg;
  return characterPortraitRelativePath(characterId);
}

/**
 * 与 {@link resolveCharacterPortraitRelPath} 同规则，但无落地 PNG 时返回 null（不发起 `<img>` 请求）。
 * @param {{ characterId?: string|null, avatar?: string|null }} opts
 * @returns {string|null}
 */
export function resolveCharacterPortraitRelPathForNetwork({ characterId, avatar }) {
  if (!shouldAttemptCharacterPortraitNetworkLoad({ characterId, avatar })) return null;
  return resolveCharacterPortraitRelPath({ characterId, avatar });
}

/**
 * 将领卡 70×70 立绘框 URL：优先配置 `avatar`，否则按 `character_id` 拼 avatars 目录。
 * 路径规则不变；无 manifest 登记文件时不返回 URL，由 UI 占位。
 * @param {{ characterId?: string|null, avatar?: string|null, baseUrl?: string }} opts
 * @returns {string|null}
 */
export function resolveCharacterCardPortraitSrc({ characterId, avatar, baseUrl = '' }) {
  if (!shouldAttemptCharacterPortraitNetworkLoad({ characterId, avatar })) return null;
  const root = normalizeGamePublicBase(baseUrl);
  const rel = resolveCharacterPortraitRelPath({ characterId, avatar });
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  return `${root}${rel.replace(/^\//, '')}`;
}
