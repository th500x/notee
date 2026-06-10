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
 * 将领卡 70×70 立绘框 URL：优先配置 `avatar`，否则按 `character_id` 拼 avatars 目录。
 * @param {{ characterId?: string|null, avatar?: string|null, baseUrl?: string }} opts
 * @returns {string|null}
 */
export function resolveCharacterCardPortraitSrc({ characterId, avatar, baseUrl = '' }) {
  const root = normalizeGamePublicBase(baseUrl);
  const explicit = avatar != null && String(avatar).trim() !== '' ? String(avatar).trim() : null;
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) return explicit;
    const path = explicit.replace(/^\//, '');
    return `${root}${path}`;
  }
  const rel = characterPortraitRelativePath(characterId);
  return rel ? `${root}${rel}` : null;
}
