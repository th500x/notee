/**
 * 将领被动 · 阶段1（纯数值 / 常驻百分比）技能：从 `specialEffect` 字符串解析并与战斗/面板共用。
 * 契约见 `docs/00-base/04-2-DATA_TERM_DICTIONARY.md`、`docs/20-data-layer/23-SKILL_SYSTEM.md` 阶段1首批。
 *
 * 规则：仅处理 `type === 'passive'` 且 `specialEffect` 中**每一段** key 均在下表内；
 * 若任一段无法识别则**整技能跳过**（避免半套效果）。
 */

/** 七维 + 全属性 */
export const PHASE1_CORE_ATTR_KEYS = [
  'luck',
  'courage',
  'combat',
  'command',
  'intelligence',
  'politics',
  'charm',
];

/** 除七维外，阶段1允许的 special_effect key（与 CSV / 术语表一致，小写匹配） */
export const PHASE1_EXTRA_KEYS = new Set([
  'allattributes',
  'damagebonus',
  'damagereduction',
  'physicalreduction',
  'strategyreduction',
  'strategyvulnerable',
  'critrate',
  'hitrate',
  'dodgerate',
  'cavalrydamage',
  'infantrydamage',
  'cavalryrange',
  'infantryrange',
]);

const ALL_PHASE1 = new Set([
  ...PHASE1_CORE_ATTR_KEYS.map((k) => k.toLowerCase()),
  ...PHASE1_EXTRA_KEYS,
]);

function emptyBundle() {
  return {
    luck: 0,
    courage: 0,
    combat: 0,
    command: 0,
    intelligence: 0,
    politics: 0,
    charm: 0,
    damageBonus: 0,
    damageReduction: 0,
    physicalReduction: 0,
    strategyReduction: 0,
    strategyVulnerable: 0,
    critRate: 0,
    hitRate: 0,
    dodgeRate: 0,
    cavalryDamage: 0,
    infantryDamage: 0,
    cavalryRange: 0,
    infantryRange: 0,
  };
}

/**
 * 解析 `+10%` / `10%` / `+1.5` / `-0.5` → 数值（百分比以小数表示，如 10% → 0.1）
 */
export function parsePhase1Scalar(raw) {
  if (raw == null || raw === '') return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  if (s.endsWith('%')) {
    const n = parseFloat(s.replace('%', ''));
    if (Number.isNaN(n)) return 0;
    return n / 100;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * @param {string|null|undefined} specialEffect
 * @returns {{ segments: { key: string, value: string }[], invalid: boolean }}
 */
export function parsePhase1SpecialEffectSegments(specialEffect) {
  if (specialEffect == null || String(specialEffect).trim() === '') {
    return { segments: [], invalid: false };
  }
  const parts = String(specialEffect)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const segments = [];
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx <= 0) return { segments: [], invalid: true };
    const key = p.slice(0, idx).trim().toLowerCase();
    const value = p.slice(idx + 1).trim();
    if (!ALL_PHASE1.has(key)) return { segments: [], invalid: true };
    segments.push({ key, value });
  }
  return { segments, invalid: false };
}

/**
 * 是否整段 passive 可纳入阶段1（任一段 key 越界则 false）
 */
export function isPassiveSkillPhase1NumericOnly(skill) {
  if (!skill || skill.type !== 'passive') return false;
  const { segments, invalid } = parsePhase1SpecialEffectSegments(skill.specialEffect);
  if (invalid) return false;
  if (segments.length === 0) return false;
  return true;
}

/**
 * 自一条技能累加到 bundle（调用前已校验 isPassiveSkillPhase1NumericOnly）
 */
export function accumulatePhase1FromPassiveSkill(skill, into = emptyBundle()) {
  const { segments } = parsePhase1SpecialEffectSegments(skill.specialEffect);
  for (const { key, value } of segments) {
    const v = parsePhase1Scalar(value);
    if (key === 'allattributes') {
      for (const k of PHASE1_CORE_ATTR_KEYS) into[k] += v;
      continue;
    }
    const mapKey =
      key === 'luck' ? 'luck'
      : key === 'courage' ? 'courage'
      : key === 'combat' ? 'combat'
      : key === 'command' ? 'command'
      : key === 'intelligence' ? 'intelligence'
      : key === 'politics' ? 'politics'
      : key === 'charm' ? 'charm'
      : key === 'damagebonus' ? 'damageBonus'
      : key === 'damagereduction' ? 'damageReduction'
      : key === 'physicalreduction' ? 'physicalReduction'
      : key === 'strategyreduction' ? 'strategyReduction'
      : key === 'strategyvulnerable' ? 'strategyVulnerable'
      : key === 'critrate' ? 'critRate'
      : key === 'hitrate' ? 'hitRate'
      : key === 'dodgerate' ? 'dodgeRate'
      : key === 'cavalrydamage' ? 'cavalryDamage'
      : key === 'infantrydamage' ? 'infantryDamage'
      : key === 'cavalryrange' ? 'cavalryRange'
      : key === 'infantryrange' ? 'infantryRange'
      : null;
    if (mapKey) into[mapKey] += v;
  }
  return into;
}

/**
 * @param {string[]} skillIds
 * @param {Record<string, object>} skillsMap id → skill 行（与 skills.json 一致）
 */
export function buildPhase1BundleFromSkillIds(skillIds, skillsMap) {
  const bundle = emptyBundle();
  const seen = new Set();
  for (const id of skillIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sk = skillsMap[id];
    if (!isPassiveSkillPhase1NumericOnly(sk)) continue;
    accumulatePhase1FromPassiveSkill(sk, bundle);
  }
  return bundle;
}

/** 将领卡 config 或 characters.json 行：收集 skill_1 / skill_2 / skills[] */
export function collectCharacterSkillIdsFromConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return [];
  const out = [];
  const push = (x) => {
    if (x && typeof x === 'string' && !out.includes(x)) out.push(x);
  };
  push(cfg.skill_1);
  push(cfg.skill_2);
  if (Array.isArray(cfg.skills)) {
    for (const s of cfg.skills) push(typeof s === 'string' ? s : s?.id);
  }
  return out;
}

/**
 * 将阶段1七维增量合入「卡片显示用」将领属性（与 CharacterCard 入参同刻度，通常为 0–10 小数）
 */
export function applyPhase1CoreDeltasToCharacterProps(characterLike, bundle) {
  if (!characterLike || !bundle) return characterLike;
  const next = { ...characterLike };
  for (const k of PHASE1_CORE_ATTR_KEYS) {
    const cur = next[k];
    const base = typeof cur === 'number' && !Number.isNaN(cur) ? cur : 0;
    next[k] = base + (bundle[k] || 0);
  }
  return next;
}

/**
 * 战斗用：将领对象（已含 combat 等）叠七维 + 挂载 `_skillPhase1Combat` 供 combatSystem 消费
 */
export function attachPhase1CombatToCharacter(charObj, bundle) {
  if (!charObj || !bundle) return charObj;
  const next = { ...charObj };
  for (const k of PHASE1_CORE_ATTR_KEYS) {
    const cur = next[k];
    const base = typeof cur === 'number' && !Number.isNaN(cur) ? cur : 0;
    next[k] = base + (bundle[k] || 0);
  }
  next._skillPhase1Combat = {
    damageBonus: bundle.damageBonus,
    damageReduction: bundle.damageReduction,
    physicalReduction: bundle.physicalReduction,
    strategyReduction: bundle.strategyReduction,
    strategyVulnerable: bundle.strategyVulnerable,
    critRate: bundle.critRate,
    hitRate: bundle.hitRate,
    dodgeRate: bundle.dodgeRate,
    cavalryDamage: bundle.cavalryDamage,
    infantryDamage: bundle.infantryDamage,
    cavalryRange: bundle.cavalryRange,
    infantryRange: bundle.infantryRange,
  };
  return next;
}

/**
 * 部队射程：按兵种叠加骑兵/步兵距离加成（整数格）
 */
export function phase1RangeBonusForTroopType(bundle, troopType) {
  if (!bundle || !troopType) return 0;
  if (troopType === 'cavalry') return Math.round(bundle.cavalryRange || 0);
  if (troopType === 'infantry') return Math.round(bundle.infantryRange || 0);
  return 0;
}

/**
 * 兵种伤害乘子：1 + 对应被动（仅匹配兵种时）
 */
export function phase1TroopTypeDamageMult(bundle, troopType) {
  if (!bundle || !troopType) return 1;
  if (troopType === 'cavalry') return 1 + (bundle.cavalryDamage || 0);
  if (troopType === 'infantry') return 1 + (bundle.infantryDamage || 0);
  return 1;
}
