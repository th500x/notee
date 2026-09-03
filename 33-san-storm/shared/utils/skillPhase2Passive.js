/**
 * 将领被动 · 阶段2（触发 / 条件减伤 / 首击免疫）——与 `skillPhase1Passive` 并列，供战斗装配与 `combatSystem` 消费。
 * 契约：`docs/00/20-data-layer/23-SKILL_SYSTEM.md` 阶段2；`skill-template.csv` 中 `implementation_phase === 2` 的 passive。
 */

/** 仅含以下 key 的 passive `special_effect` 整段才纳入阶段2合并（与阶段1「全非白名单则跳过」一致） */
const PHASE2_SEGMENT_KEYS = new Set(['firsthitimmune', 'conditionalreduction']);

/**
 * @param {string|null|undefined} specialEffect
 * @returns {{ segments: { key: string, value: string }[], invalid: boolean }}
 */
export function parsePhase2SpecialEffectSegments(specialEffect) {
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
    if (!PHASE2_SEGMENT_KEYS.has(key)) return { segments: [], invalid: true };
    segments.push({ key, value });
  }
  return { segments, invalid: false };
}

/**
 * 被动且 `special_effect` 每一段均为阶段2 key，且至少一段
 */
export function isPassiveSkillPhase2Only(skill) {
  if (!skill || skill.type !== 'passive') return false;
  const { segments, invalid } = parsePhase2SpecialEffectSegments(skill.specialEffect);
  if (invalid || segments.length === 0) return false;
  return true;
}

/**
 * 解析 `conditionalReduction:troops<=3:15%` 中 value 部分
 * @returns {{ op: string, threshold: number, rate: number } | null}
 */
export function parseConditionalReductionValue(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const m = /^troops\s*(<=|>=|==|>|<)\s*(\d+)\s*:\s*(.+)$/i.exec(s);
  if (!m) return null;
  const op = m[1];
  const threshold = parseInt(m[2], 10);
  if (!Number.isFinite(threshold)) return null;
  let rateStr = m[3].trim();
  let rate;
  if (rateStr.endsWith('%')) {
    const n = parseFloat(rateStr.replace('%', ''));
    if (Number.isNaN(n)) return null;
    rate = n / 100;
  } else {
    const n = parseFloat(rateStr);
    if (Number.isNaN(n)) return null;
    rate = n;
  }
  if (!(rate > 0) || rate > 0.95) return null;
  return { op, threshold, rate };
}

function emptyPhase2Config() {
  return {
    firstHitImmune: false,
    conditionalReductions: [],
  };
}

/**
 * 自一条阶段2被动累入 config
 */
export function accumulatePhase2FromPassiveSkill(skill, into = emptyPhase2Config()) {
  const { segments } = parsePhase2SpecialEffectSegments(skill.specialEffect);
  for (const { key, value } of segments) {
    if (key === 'firsthitimmune') {
      const n = parseInt(String(value).trim(), 10);
      if (Number.isFinite(n) && n > 0) into.firstHitImmune = true;
    } else if (key === 'conditionalreduction') {
      const rule = parseConditionalReductionValue(value);
      if (rule) into.conditionalReductions.push(rule);
    }
  }
  return into;
}

/**
 * @param {string[]} skillIds
 * @param {Record<string, object>} skillsMap
 */
export function buildPhase2DefensiveConfigFromSkillIds(skillIds, skillsMap) {
  const cfg = emptyPhase2Config();
  const seen = new Set();
  for (const id of skillIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sk = skillsMap[id];
    if (!isPassiveSkillPhase2Only(sk)) continue;
    accumulatePhase2FromPassiveSkill(sk, cfg);
  }
  return cfg;
}

/**
 * 将阶段2静态配置挂到将领对象（`_skillPhase2Combat`）；无效果时不挂载
 */
export function attachPhase2CombatToCharacter(charLike, config) {
  if (!charLike) return charLike;
  const next = { ...charLike };
  const has =
    config &&
    (config.firstHitImmune || (config.conditionalReductions && config.conditionalReductions.length > 0));
  if (!has) {
    delete next._skillPhase2Combat;
    return next;
  }
  next._skillPhase2Combat = {
    firstHitImmune: !!config.firstHitImmune,
    conditionalReductions: [...(config.conditionalReductions || [])],
  };
  return next;
}

/**
 * 场上存活且同 `faction` 的部队数（与坚韧「场上部队数」一致：同阵营编制数）
 */
export function countLivingTroopsOfFaction(battleTroops, faction) {
  if (!battleTroops || !faction) return 0;
  return battleTroops.filter((t) => t.faction === faction && t.currentTroops > 0).length;
}

export function conditionalReductionRuleApplies(rule, livingCount) {
  if (!rule || !Number.isFinite(livingCount)) return false;
  const n = livingCount;
  const th = rule.threshold;
  switch (rule.op) {
    case '<=': return n <= th;
    case '>=': return n >= th;
    case '<': return n < th;
    case '>': return n > th;
    case '==': return n === th;
    default: return false;
  }
}

/**
 * 对「已过完阶段1」的 raw 伤害再叠阶段2条件减免（乘在总伤上，与物/谋减伤同层）
 * @param {object|null|undefined} defTroop 防守方部队（取 faction）
 * @param {object|null|undefined} dc defTroop.character
 * @param {number} totalDmg
 * @param {object[]|null|undefined} battleTroops
 */
export function applyPhase2ConditionalIncomingMult(defTroop, dc, totalDmg, battleTroops) {
  const p2 = dc?._skillPhase2Combat;
  const rules = p2?.conditionalReductions;
  if (!rules?.length || !battleTroops || !defTroop) return totalDmg;
  const living = countLivingTroopsOfFaction(battleTroops, defTroop.faction);
  let mult = 1;
  for (const rule of rules) {
    if (conditionalReductionRuleApplies(rule, living)) mult *= (1 - rule.rate);
  }
  return totalDmg * mult;
}

/**
 * 每场战斗开始时为每支部队初始化可变状态（首击免疫次数按将领配置，**每支部队独立**）
 */
export function initBattlePhase2Runtime(battleTroops) {
  if (!Array.isArray(battleTroops)) return;
  for (const t of battleTroops) {
    const p2 = t.character?._skillPhase2Combat;
    const charges = p2?.firstHitImmune ? 1 : 0;
    t._phase2Runtime = { firstHitImmuneCharges: charges };
  }
}

/**
 * 结算兵力扣减前：若仍有首击免疫次数，则本次扣减为 0 并消耗一次。
 * @returns {{ casualties: number, immuneTriggered: boolean }}
 */
export function resolveIncomingCasualtiesWithPhase2FirstHit(troop, rawCasualties) {
  const raw = Math.max(0, Math.round(Number(rawCasualties) || 0));
  if (raw <= 0) return { casualties: 0, immuneTriggered: false };
  const rt = troop?._phase2Runtime;
  if (!rt || rt.firstHitImmuneCharges <= 0) {
    return { casualties: raw, immuneTriggered: false };
  }
  rt.firstHitImmuneCharges -= 1;
  return { casualties: 0, immuneTriggered: true };
}

/**
 * 预览用：不修改 `_phase2Runtime`
 */
export function previewCasualtiesAfterPhase2FirstHit(troop, rawCasualties) {
  const raw = Math.max(0, Math.round(Number(rawCasualties) || 0));
  if (raw <= 0) return 0;
  const ch = (troop?._phase2Runtime?.firstHitImmuneCharges ?? 0);
  if (ch > 0) return 0;
  return raw;
}
