/**
 * 将领卡立绘：`public/assets/characters/avatars/{character_id}.png`（99-5 AIDXL 产出）。
 * 无文件时由 UI `onError` 回退占位，不在此做存在性探测。
 */
import { normalizeGamePublicBase } from './troopIconUrls.js';

export const CHARACTER_PORTRAIT_AVATAR_DIR = 'assets/characters/avatars';

const CHARACTER_ID_RE = /^san_\d+_char_\d+$/;

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
 * 将领卡 70×70 立绘框 URL：优先配置 `avatar`，否则按 `character_id` 拼 avatars 目录。
 * @param {{ characterId?: string|null, avatar?: string|null, baseUrl?: string }} opts
 * @returns {string|null}
 */
export function resolveCharacterCardPortraitSrc({ characterId, avatar, baseUrl = '' }) {
  const root = normalizeGamePublicBase(baseUrl);
  const rel = resolveCharacterPortraitRelPath({ characterId, avatar });
  if (!rel) return null;
  if (/^https?:\/\//i.test(rel)) return rel;
  return `${root}${rel.replace(/^\//, '')}`;
}
