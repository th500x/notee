/**
 * 势力政策长效谏言 · 君主批复口谕（批准 / 驳回模板）。
 *
 * 按 `ai-kings.json` · `speechStyle` 分桶；与 `KingEdictPanel` 口谕壳同形展示。
 *
 * @module data/texts/kingPolicyRemonstranceLines
 */

const APPROVED_BY_STYLE = Object.freeze({
  decadent: [
    (label) => `……罢了，${label}这档子事，准了便是。`,
    (label) => `嗯，${label}就按爱卿说的办吧，莫再聒噪。`,
  ],
  benevolent: [
    (label) => `卿言有理，${label}准奏，速速推行以慰民心。`,
    (label) => `利民之举，${label}准了，望卿与有司尽心。`,
  ],
  overlord: [
    (label) => `${label}？好，朕准了。`,
    (label) => `准。${label}即日起施行，勿误国计。`,
  ],
  moderate: [
    (label) => `所奏${label}，准。`,
    (label) => `${label}之事，依卿所议，准奏。`,
  ],
  tyrant: [
    (label) => `${label}，准。莫误了时辰。`,
    (label) => `准奏。${label}从速办理，迟则治罪。`,
  ],
});

const REJECTED_BY_STYLE = Object.freeze({
  decadent: [
    (label) => `卿所奏${label}未合时宜，且退，日后再议。`,
    (label) => `${label}？朕心未决，此议暂不许可。`,
  ],
  benevolent: [
    (label) => `此举虽意善，${label}尚非其时，且缓行之。`,
    (label) => `${label}之议，朕再思之，卿且候旨。`,
  ],
  overlord: [
    (label) => `${label}之事，朕自有权衡，暂不许可。`,
    (label) => `谏章已阅，${label}不准，勿复再奏。`,
  ],
  moderate: [
    (label) => `${label}之议，暂缓。`,
    (label) => `所奏${label}，不准。`,
  ],
  tyrant: [
    (label) => `${label}？驳回。再有妄言，军法从事。`,
    (label) => `不准。${label}之议，勿再提。`,
  ],
});

function hashSeed(seed) {
  const s = String(seed ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFromPool(pool, label, seed) {
  const arr = Array.isArray(pool) && pool.length ? pool : [];
  if (!arr.length) return `${label}。`;
  const idx = hashSeed(seed) % arr.length;
  return arr[idx](label);
}

/**
 * @param {{
 *   approved: boolean,
 *   policyLabel: string,
 *   speechStyle?: string,
 *   seed?: string|number,
 * }} input
 * @returns {string}
 */
export function buildPolicyRemonstranceVerdictLine({
  approved,
  policyLabel,
  speechStyle = 'benevolent',
  seed = '',
}) {
  const label = String(policyLabel || '此项政策').trim();
  const style = APPROVED_BY_STYLE[speechStyle] ? speechStyle : 'benevolent';
  const bucket = approved ? APPROVED_BY_STYLE[style] : REJECTED_BY_STYLE[style];
  const fallback = approved ? APPROVED_BY_STYLE.benevolent : REJECTED_BY_STYLE.benevolent;
  const pool = bucket || fallback;
  return pickFromPool(pool, label, seed);
}
