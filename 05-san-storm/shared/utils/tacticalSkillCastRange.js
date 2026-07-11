/**
 * 战术地图：主动技施法曼哈顿射程（格），由技能 ID 中 **稀有度千位** 决定。
 * 格式：`san_{赛季}_skill_{类型}_{稀有度}{三位序号}`，如 `san_1_skill_1_3006` → 千位 `3`。
 * 与 `docs/00/00-base/04-1-ID_NAMING_GUIDE.md` §4 一致。
 */

/**
 * @param {string|null|undefined} skillId
 * @returns {1|2|3|4|5|null}
 */
export function parseTacticalSkillRarityDigit(skillId) {
  const s = String(skillId || '').trim();
  const m = s.match(/^san_\d+_skill_[1-4]_([1-5])\d{3}$/i);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return Number.isFinite(d) && d >= 1 && d <= 5 ? d : null;
}

/**
 * 核心/传奇 → 3 格；史诗/稀有 → 2 格；普通 → 1 格。无法解析时保守为 1。
 * @param {string|null|undefined} skillId
 * @returns {number}
 */
export function getTacticalActiveSkillCastRange(skillId) {
  const d = parseTacticalSkillRarityDigit(skillId);
  if (d === 5 || d === 4) return 3;
  if (d === 3 || d === 2) return 2;
  if (d === 1) return 1;
  return 1;
}
