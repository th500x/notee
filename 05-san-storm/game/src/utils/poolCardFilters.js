/**
 * 卡池预览与后端 cardPoolService：从 faction_id / 配置卡 ID 解析「势力位」数字。
 * 勿用 split('_')[3].charAt(0)：faction 后缀 01、01001 等会得到错误的「0」。
 */

/**
 * @param {string|null|undefined} factionId 如 san_1_faction_1001
 * @returns {string|null} 势力位数字字符，如 '1'；无法解析时 null
 */
/**
 * 从玩家 faction_id 解析当前赛季（与 cardPoolService.parseFactionId 一致）。
 * @param {string|null|undefined} factionId 如 san_1_faction_1001
 * @returns {string} 如 san_1；无法解析时 san_1（当前游戏主赛季）
 */
export function poolSeasonFromPlayerFactionId(factionId) {
  const parts = String(factionId || '').split('_');
  if (parts.length >= 2 && parts[0] === 'san' && /^\d+$/.test(parts[1])) {
    return `${parts[0]}_${parts[1]}`;
  }
  return 'san_1';
}

export function poolFactionDigitFromPlayerFactionId(factionId) {
  if (factionId == null || factionId === '') return null;
  const m = String(factionId).match(/_faction_(\d+)/);
  if (!m) return null;
  const nz = m[1].replace(/^0+/, '');
  return nz ? nz.charAt(0) : '0';
}

/**
 * 配置卡 ID：取 `_troop_` / `_char_` 后的第一个数字（0001→0，1007→1）。
 * 兼容 DB/驱动把 character_id 当数字返回；若无 `_char_` 匹配则回退第四段首位（san_1_char_1007）。
 */
export function poolFactionDigitFromCardId(cardId, poolType) {
  if (cardId == null || cardId === '') return '';
  const id = String(cardId);
  const re = poolType === 'troop' ? /_troop_(\d)/i : /_char_(\d)/i;
  const m = id.match(re);
  if (m) return m[1];
  const parts = id.split('_');
  const seg = parts[3];
  if (seg && /^\d/.test(seg)) return seg.charAt(0);
  return '';
}

/**
 * @param {string} cardId
 * @param {'troop'|'character'} poolType
 * @param {string|null} playerFactionDigit
 */
export function cardMatchesPlayerPoolFaction(cardId, poolType, playerFactionDigit) {
  if (playerFactionDigit == null) return true;
  const d = poolFactionDigitFromCardId(cardId == null ? '' : cardId, poolType);
  return d === playerFactionDigit || d === '0';
}
