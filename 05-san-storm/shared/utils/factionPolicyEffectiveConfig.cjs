/**
 * 势力政策 · 生效 config 读取（评估 / getEffective* 共用）
 *
 * 与 11-3「驳回保留已批准 config」一致；首次 INSERT 驳回的脏 config 不参与评估。
 *
 * @module shared/utils/factionPolicyEffectiveConfig
 */

/**
 * @param {object|null|undefined} existingRow - `faction_policies` 原始行
 * @returns {{ config: object, lastOutcome: string|null, createdAt: *, updatedAt: * }|null}
 */
function parsePolicyRow(existingRow) {
  if (!existingRow) return null;
  let config = existingRow.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = null;
    }
  }
  return {
    config: config && typeof config === 'object' ? config : {},
    lastOutcome: existingRow.last_outcome || null,
    createdAt: existingRow.created_at || null,
    updatedAt: existingRow.updated_at || null,
  };
}

/**
 * 驳回后 `config_json` 是否代表曾生效过的配置（UPDATE 保留时 `updated_at` 晚于 `created_at`）。
 *
 * @param {{ lastOutcome?: string|null, createdAt?: *, updatedAt?: * }|null|undefined} formatted
 * @returns {boolean}
 */
function policyRowConfigTrustworthy(formatted) {
  if (!formatted) return false;
  if (formatted.lastOutcome !== 'rejected') return true;
  const created = formatted.createdAt ? new Date(formatted.createdAt).getTime() : 0;
  const updated = formatted.updatedAt ? new Date(formatted.updatedAt).getTime() : 0;
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return true;
  return updated - created > 1000;
}

/**
 * 谏言效用评估 / 面板「当前」共用的生效 config（与 `factionPolicyService.getEffective*` 语义对齐）。
 *
 * @param {string} category - `policy_category` ENUM
 * @param {object|null|undefined} existingRow
 * @param {object} defaultConfig - `getDefaultConfigForCategory(category)`
 * @param {{
 *   rationMinPct?: number,
 *   rationMaxPct?: number,
 *   siegeDefaultPct?: number,
 *   domesticGoalOptions?: string[],
 * }|null|undefined} bounds
 * @returns {object}
 */
function getEffectiveConfigForAssess(category, existingRow, defaultConfig, bounds = null) {
  const fallback = defaultConfig && typeof defaultConfig === 'object' ? { ...defaultConfig } : {};
  const parsed = parsePolicyRow(existingRow);
  if (!parsed) return fallback;

  const trustworthy = policyRowConfigTrustworthy(parsed);
  const useStoredConfig =
    parsed.lastOutcome === 'approved' ||
    (parsed.lastOutcome === 'rejected' && trustworthy);
  if (!useStoredConfig) return fallback;

  const cfg = parsed.config;
  switch (category) {
    case 'recruit':
      return { enabled: !!cfg.enabled };
    case 'ration_bonus': {
      const minPct = Number(bounds?.rationMinPct) || 5;
      const maxPct = Number(bounds?.rationMaxPct) || 50;
      const pct = Math.round(Number(cfg.bonusPct));
      if (!Number.isFinite(pct) || pct <= 0) return fallback;
      return {
        bonusPct: Math.max(minPct, Math.min(maxPct, pct)),
      };
    }
    case 'siege_reward': {
      const defaultPct = Number(bounds?.siegeDefaultPct);
      const fallbackPct = Number.isFinite(defaultPct) ? defaultPct : 80;
      const pct = Math.round(Number(cfg.personalSharePct));
      if (!Number.isFinite(pct)) return { personalSharePct: fallbackPct };
      return { personalSharePct: Math.max(0, Math.min(100, pct)) };
    }
    case 'domestic_goal': {
      const options = Array.isArray(bounds?.domesticGoalOptions)
        ? bounds.domesticGoalOptions
        : [];
      const g = cfg.goal ? String(cfg.goal).trim() : '';
      if (!g || (options.length > 0 && !options.includes(g))) return fallback;
      return { goal: g };
    }
    default:
      return fallback;
  }
}

module.exports = {
  parsePolicyRow,
  policyRowConfigTrustworthy,
  getEffectiveConfigForAssess,
};
