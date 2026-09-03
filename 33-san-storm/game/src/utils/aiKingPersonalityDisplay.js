/**
 * AI 君主性格五维展示（与 `ai-kings.json` · `41-1-AI_KING_SYSTEM.md` §「personality」一致）
 */

/** @type {readonly { key: string, label: string, hint: string }[]} */
export const AI_KING_PERSONALITY_DIMS = [
  { key: 'aggression', label: '侵略', hint: '战事类谏言基准倾向' },
  { key: 'caution', label: '谨慎', hint: '守势与高风险否决（M2 参与饱和调制）' },
  { key: 'evolution', label: '发展', hint: '势力政策类谏言基准倾向' },
  { key: 'excitation', label: '赏赐', hint: '犒赏邮件频率与档位（M2 预留）' },
  { key: 'ambition', label: '野心', hint: '占城饱和与性格有效值调制' },
];

/** @param {number|null|undefined} v 0～1 */
export function formatAiKingPersonalityPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
}

/**
 * @param {Record<string, number>|null|undefined} personality
 * @returns {Array<{ key: string, label: string, hint: string, valueText: string }>}
 */
export function buildAiKingPersonalityRows(personality) {
  const p = personality && typeof personality === 'object' ? personality : {};
  return AI_KING_PERSONALITY_DIMS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    valueText: formatAiKingPersonalityPct(p[key]),
  }));
}
