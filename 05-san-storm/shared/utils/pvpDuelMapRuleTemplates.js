/**
 * PvP 对决地图 · rule_profile 模板（无 seed / duel_map_id）
 * @see docs/tools/map/PVP_DUEL_MAP_RULES.md §4
 * @see docs/tools/map/PVP_DUEL_MAP_RULES.md
 */

export const PVP_DUEL_GENERATOR_VERSION = 'pvp-duel.v1';

const CANONICAL_DEFAULT = {
  attackerDeployZone: 'deployA',
  defenderDeployZone: 'deployB',
};

const RULE_DEFAULTS = {
  forbidChest: true,
  forbidTrap: true,
  placementZones: ['deployA', 'deployB'],
  forbidColumns: [0, 7],
  forbidBorderRows: false,
};

/** @type {Record<string, { rule_profile: string, label: string, base: object, rules: object, canonical: object }>} */
export const PVP_DUEL_RULE_TEMPLATES = {
  balanced: {
    rule_profile: 'balanced',
    label: '均衡',
    base: { bgTheme: 'grassland', forceComplexity: 'standard' },
    rules: {
      ...RULE_DEFAULTS,
      objectsPerSide: {
        deployA: { rock: 1, fence: 1 },
        deployB: { rock: 1, fence: 1 },
      },
    },
    canonical: { ...CANONICAL_DEFAULT },
  },
  choke: {
    rule_profile: 'choke',
    label: '隘口',
    base: { bgTheme: 'grassland', forceComplexity: 'complex' },
    rules: {
      ...RULE_DEFAULTS,
      centerBand: { rows: [4, 5], terrainBias: 'forest' },
      objectsPerSide: {
        deployA: { rock: 2, fence: 0 },
        deployB: { rock: 2, fence: 1 },
      },
    },
    canonical: { ...CANONICAL_DEFAULT },
  },
  river: {
    rule_profile: 'river',
    label: '河道',
    base: { bgTheme: 'grassland', forceComplexity: 'simple' },
    rules: {
      ...RULE_DEFAULTS,
      objectsPerSide: {
        deployA: { rock: 0, fence: 0 },
        deployB: { rock: 0, fence: 0 },
      },
      /** 横贯河道：中间两行（默认 y=4,5）；左右各一列旱路，其余列随机 1～2 格河 */
      crossRiverBand: {
        rows: [4, 5],
        leftRoadColumnPool: [1, 2, 3],
        rightRoadColumnPool: [4, 5, 6],
      },
    },
    canonical: { ...CANONICAL_DEFAULT },
  },
  hill_focus: {
    rule_profile: 'hill_focus',
    label: '高地',
    base: { bgTheme: 'grassland', forceComplexity: 'standard' },
    rules: {
      ...RULE_DEFAULTS,
      combatTerrainBias: 'hill',
      objectsPerSide: {
        deployA: { rock: 1, fence: 0 },
        deployB: { rock: 1, fence: 0 },
      },
    },
    canonical: { ...CANONICAL_DEFAULT },
  },
  obstacle_rich: {
    rule_profile: 'obstacle_rich',
    label: '障碍',
    base: { bgTheme: 'grassland', forceComplexity: 'standard' },
    rules: {
      ...RULE_DEFAULTS,
      placementZones: ['deployA', 'deployB', 'combat'],
      objectsPerSide: {
        deployA: { rock: 2, fence: 2 },
        deployB: { rock: 2, fence: 2 },
        combat: { rock: 1, fence: 1 },
      },
    },
    canonical: { ...CANONICAL_DEFAULT },
  },
};

export const RULE_PROFILE_IDS = Object.keys(PVP_DUEL_RULE_TEMPLATES);

export function getPvpDuelRuleTemplate(ruleProfile) {
  return PVP_DUEL_RULE_TEMPLATES[ruleProfile] ?? null;
}

/** 管理页预览用：由 profile 拼出无 seed 的 preset 壳 */
export function buildTemplatePreset(ruleProfile) {
  const tpl = getPvpDuelRuleTemplate(ruleProfile);
  if (!tpl) return null;
  return {
    generator_version: PVP_DUEL_GENERATOR_VERSION,
    rule_profile: tpl.rule_profile,
    base: { ...tpl.base },
    rules: JSON.parse(JSON.stringify(tpl.rules)),
    canonical: { ...tpl.canonical },
    notes: `模板 ${tpl.label}（${ruleProfile}）；固化时请填写 duel_map_id 与 seed`,
  };
}
