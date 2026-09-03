/**
 * 事件选项 `factor` 串解析（CSV `option_*_factor` → luck / always / minigame 判定）。
 *
 * 格式：
 * - `type-a` / `type-b` — 策划简写，等价于 luck + balanced + 门槛（见 docs/01-jun-exploration/10-core-system/14-1-EVENT_SYSTEM.md §6）；运行时展开，不当作独立主因子
 * - `always` — 无运势骰子
 * - `minigame:gobang:easy` — 第一段固定 `minigame`，其后为「游戏:难度」（可含多个 `:`）
 * - `luck:7:strategist:6` — luck + 队伍运气门槛 + 副因子类型 + 副因子门槛
 */

/** @typedef {{ mainFactor: string, mainRequirement: string|number|null, subFactors: string|null, subRequirement: string|number|null }} OptionFactorFields */

/**
 * @param {string|null|undefined} factor
 * @returns {OptionFactorFields|null}
 */
export function parseOptionFactor(factor) {
  if (factor == null) return null;
  const trimmed = String(factor).trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  const head = parts[0];

  if (head === 'always') {
    return {
      mainFactor: 'always',
      mainRequirement: null,
      subFactors: null,
      subRequirement: null,
    };
  }

  if (head === 'minigame') {
    const rest = parts.slice(1).join(':');
    return {
      mainFactor: 'minigame',
      mainRequirement: rest || null,
      subFactors: null,
      subRequirement: null,
    };
  }

  if (head === 'luck') {
    const mainReqRaw = parts[1];
    const subType = parts[2] != null ? String(parts[2]).trim() : '';
    const subReqRaw = parts[3];

    let mainRequirement = null;
    if (mainReqRaw != null && String(mainReqRaw).trim() !== '') {
      const ms = String(mainReqRaw).trim();
      mainRequirement = /^\d+$/.test(ms) ? parseInt(ms, 10) : ms;
    }

    let subRequirement = null;
    if (subReqRaw != null && String(subReqRaw).trim() !== '') {
      const ss = String(subReqRaw).trim();
      subRequirement = /^\d+$/.test(ss) ? parseInt(ss, 10) : ss;
    }

    return {
      mainFactor: 'luck',
      mainRequirement,
      subFactors: subType || null,
      subRequirement,
    };
  }

  return null;
}

/**
 * 从选项对象取因子字段：优先 `factor` 串；兼容旧 JSON（mainFactor 四列）。
 * @param {Record<string, unknown>|null|undefined} option
 * @returns {OptionFactorFields|null}
 */
export function getOptionFactorFields(option) {
  if (!option || typeof option !== 'object') return null;

  const rawFactor = option.factor != null ? String(option.factor).trim() : '';
  if (rawFactor) {
    let parsed = parseOptionFactor(rawFactor);
    if (!parsed) {
      const t = rawFactor.toLowerCase();
      if (t === 'type-a') parsed = parseOptionFactor('luck:7:balanced:7');
      else if (t === 'type-b') parsed = parseOptionFactor('luck:10:balanced:10');
      else if (t === 'luck') parsed = parseOptionFactor('luck:7:balanced:7');
    }
    if (parsed) return parsed;
  }

  const mf = option.mainFactor != null ? String(option.mainFactor).trim() : '';
  if (mf === 'type-a') return parseOptionFactor('luck:7:balanced:7');
  if (mf === 'type-b') return parseOptionFactor('luck:10:balanced:10');

  if (option.mainFactor != null && option.mainFactor !== '') {
    return {
      mainFactor: String(option.mainFactor),
      mainRequirement:
        option.mainRequirement !== undefined && option.mainRequirement !== null
          ? option.mainRequirement
          : null,
      subFactors:
        option.subFactors !== undefined && option.subFactors != null && String(option.subFactors).trim() !== ''
          ? String(option.subFactors)
          : null,
      subRequirement:
        option.subRequirement !== undefined && option.subRequirement !== null
          ? option.subRequirement
          : null,
    };
  }

  return null;
}
