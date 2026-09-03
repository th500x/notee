/**
 * 生成短且唯一的 battle_id（适配 battles.battle_id 历史长度 VARCHAR(50)）
 * 勿再拼接完整 war_id，否则极易超过 50 导致 INSERT 失败或截断后主键冲突。
 */

const crypto = require('crypto');

/**
 * @param {string} prefix 建议 ≤8 字符，如 pvp_att / pvp_def
 * @returns {string} 总长 ≤ 48
 */
function newShortBattleId(prefix = 'bat') {
  const p = String(prefix || 'bat').replace(/[^a-z0-9_]/gi, '').slice(0, 12) || 'bat';
  const t = Date.now().toString(36);
  const r = crypto.randomBytes(8).toString('hex');
  const id = `${p}_${t}_${r}`;
  return id.length <= 48 ? id : id.slice(0, 48);
}

module.exports = { newShortBattleId };
