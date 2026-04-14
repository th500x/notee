/**
 * 事件奖励简写：reward-a～e（资源区间）、pack-a～e（装备+部队随机套），与 option_*_factor 的 type-a 类似由运行时展开。
 * 资源：区间内随机取整为基础值，再乘运势倍率（由 executeRewards / parseRewards 负责倍率）。
 * 卡包：与 random:equipment:* / random:troop:* 一致，部队从玩家势力卡池随机。
 */

/** @type {Record<string, string>} */
export const REWARD_PRESET_TEMPLATES = {
  a: 'silver:10-20;food:50-100',
  b: 'silver:15-25;food:75-125',
  c: 'silver:20-30;food:100-150',
  d: 'silver:25-35;food:125-175',
  e: 'silver:30-40;food:150-200',
};

/** 每套：1 件装备 + 1 张部队（同稀有度） */
/** @type {Record<string, { equipment: string, troop: string }>} */
export const PACK_PRESET_DEFS = {
  a: { equipment: 'common', troop: 'common' },
  b: { equipment: 'rare', troop: 'rare' },
  c: { equipment: 'epic', troop: 'epic' },
  d: { equipment: 'legendary', troop: 'legendary' },
  e: { equipment: 'core', troop: 'core' },
};

/**
 * @param {string} part - 如 silver:10-20 或 silver:100
 * @param {'roll' | 'mid'} mode
 */
function expandResourcePart(part, mode) {
  const p = part.trim();
  const colonIdx = p.indexOf(':');
  if (colonIdx < 0) return p;
  const res = p.slice(0, colonIdx);
  const rest = p.slice(colonIdx + 1);
  if (!rest.includes('-')) return p;
  const [loS, hiS] = rest.split('-');
  const lo = parseInt(String(loS).trim(), 10);
  const hi = parseInt(String(hiS).trim(), 10);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return p;
  const val =
    mode === 'mid'
      ? Math.round((lo + hi) / 2)
      : lo + Math.floor(Math.random() * (hi - lo + 1));
  return `${res}:${val}`;
}

/**
 * @param {string} template - silver:10-20;food:50-100
 * @param {'roll' | 'mid'} mode
 */
function expandResourceTemplate(template, mode) {
  return template
    .split(';')
    .map((x) => expandResourcePart(x.trim(), mode))
    .filter(Boolean)
    .join(';');
}

/**
 * 服务端结算：资源区间掷骰；卡包展开为 random: 串
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function expandRewardPresetsForExecute(str) {
  return expandRewardPresetsInternal(str, 'roll');
}

/**
 * 前端预览：资源取区间中点；卡包展开为 random: 串（与结算一致，仅资源数值为确定性）
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function expandRewardPresetsForPreview(str) {
  return expandRewardPresetsInternal(str, 'mid');
}

/**
 * @param {string|null|undefined} str
 * @param {'roll' | 'mid'} resourceMode
 */
function expandRewardPresetsInternal(str, resourceMode) {
  if (str == null || String(str).trim() === '') return '';
  return String(str)
    .split(';')
    .map((seg) => expandOneSegment(seg.trim(), resourceMode))
    .filter(Boolean)
    .join(';');
}

/**
 * @param {string} seg
 * @param {'roll' | 'mid'} resourceMode
 */
function expandOneSegment(seg, resourceMode) {
  if (!seg) return '';

  const packMatch = seg.match(/^pack-([a-e])(?::(\d+))?$/i);
  if (packMatch) {
    const key = packMatch[1].toLowerCase();
    const sets = packMatch[2] ? Math.max(1, parseInt(packMatch[2], 10) || 1) : 1;
    const def = PACK_PRESET_DEFS[key];
    if (!def) return seg;
    return `random:equipment:${def.equipment}:${sets};random:troop:${def.troop}:${sets}`;
  }

  const rewardMatch = seg.match(/^reward-([a-e])$/i);
  if (rewardMatch) {
    const key = rewardMatch[1].toLowerCase();
    const tmpl = REWARD_PRESET_TEMPLATES[key];
    if (!tmpl) return seg;
    return expandResourceTemplate(tmpl, resourceMode);
  }

  return seg;
}
