/**
 * 势力政策 · 前端展示文案与类目枚举（11-3）
 *
 * 单源：长效四类、临时三类的中文术语 / 简介 / 表单单位等。drawer / modal 一律从本模块取，
 * 避免组件内散写 if/else 文案。与后端 `factionPolicyDefaults` 的 ENUM 字符串 **保持一致**。
 *
 * @module constants/factionPolicyLabels
 */

/** 长效政策类目 ENUM（与后端 `policy_category` 同值） */
export const POLICY_CATEGORY = Object.freeze({
  RATION_BONUS: 'ration_bonus',
  SIEGE_REWARD: 'siege_reward',
  RECRUIT: 'recruit',
  DOMESTIC_GOAL: 'domestic_goal',
});

/** 四类按朝政面板展示顺序排列（与 11-3 §3 顺序一致） */
export const POLICY_CATEGORY_ORDER = [
  POLICY_CATEGORY.RATION_BONUS,
  POLICY_CATEGORY.SIEGE_REWARD,
  POLICY_CATEGORY.RECRUIT,
  POLICY_CATEGORY.DOMESTIC_GOAL,
];

/** 类目展示元信息：icon / label / 简介 / 表单提示等 */
export const POLICY_CATEGORY_META = Object.freeze({
  [POLICY_CATEGORY.RATION_BONUS]: {
    icon: '🍚',
    label: '粮饷加成',
    summary:
      '在三公府「俸禄」发放同事务，自势力池为玩家追加 Bonus（5%～50%）；势力池不足时仅 Bonus 不发，基础俸禄照常。',
    formKind: 'percentSlider',
    minPct: 5,
    maxPct: 50,
    stepPct: 1,
    /** config.bonusPct */
    valueKey: 'bonusPct',
    valueLabel: (pct) => `Bonus 比例 ${Number(pct ?? 0)}%`,
  },
  [POLICY_CATEGORY.SIEGE_REWARD]: {
    icon: '⚖️',
    label: '城战奖赏',
    summary:
      '攻城净银两 / 净粮草，在「玩家个人」与「势力池」之间的分配比例；声望、贡献、装备掉落不受本政策影响。',
    formKind: 'percentSlider',
    minPct: 0,
    maxPct: 100,
    stepPct: 1,
    valueKey: 'personalSharePct',
    valueLabel: (pct) => `个人份额 ${Number(pct ?? 0)}% · 势力池 ${100 - Number(pct ?? 0)}%`,
  },
  [POLICY_CATEGORY.RECRUIT]: {
    icon: '🎓',
    label: '招贤纳士',
    summary:
      '开启后为本势力追加一段 san_0 将领池映射（按势力固定），不修改概率表本体；汉室免费，其余势力需一次性支付银两。',
    formKind: 'toggle',
    valueKey: 'enabled',
    valueLabel: (enabled) => (enabled ? '已开启' : '已关闭'),
  },
  [POLICY_CATEGORY.DOMESTIC_GOAL]: {
    icon: '🧭',
    label: '内政目标',
    summary:
      '五选一：人口 / 商业 / 农业 / 军事 / 文化。所选维度的内政贡献奖励 +50%（待内政玩法专篇接通；当前为占位）。',
    formKind: 'singleChoice',
    valueKey: 'goal',
    options: [
      { value: 'population', label: '人口' },
      { value: 'commerce', label: '商业' },
      { value: 'agriculture', label: '农业' },
      { value: 'military', label: '军事' },
      { value: 'culture', label: '文化' },
    ],
    valueLabel: (goal) => {
      if (!goal) return '未选定';
      const map = { population: '人口', commerce: '商业', agriculture: '农业', military: '军事', culture: '文化' };
      return `目标 · ${map[goal] || goal}`;
    },
  },
});

/** 审批结果的中文展示 */
export const POLICY_OUTCOME_LABEL = Object.freeze({
  approved: '已批准',
  rejected: '已驳回',
});

/** 提议权 scope（与后端 `policyProposerAuth.POLICY_SCOPE` 同值） */
export const POLICY_SCOPE = Object.freeze({
  LONG_TERM: 'long_term',
  TRANSIENT: 'transient',
});

/** 战事临时政策（11-3 §4 · 仅 PVP 宣战谏言合并审批） */
export const TRANSIENT_POLICY_KEY = Object.freeze({
  FRONT_ASSAULT: 'frontAssault',
  REAR_ASSAULT: 'rearAssault',
  IMPERIAL_MARCH: 'imperialMarch',
});

export const TRANSIENT_POLICY_META = Object.freeze({
  [TRANSIENT_POLICY_KEY.FRONT_ASSAULT]: {
    label: '前军突击',
    summary: '战事激活后第 5～10 分钟，AI 征发军团对目标城守军模拟突击（最多 20 场）。',
    feeKey: 'frontAssault',
  },
  [TRANSIENT_POLICY_KEY.REAR_ASSAULT]: {
    label: '后军突击',
    summary: '中军期后首个整点起 5 分钟内，AI 后军再突击（最多 20 场）；该窗内玩家不可攻城。',
    feeKey: 'rearAssault',
  },
  [TRANSIENT_POLICY_KEY.IMPERIAL_MARCH]: {
    label: '御驾亲征',
    summary: '战事激活后 1 小时内，对 NPC/驻地守军出击时附带君主指挥的传奇友军（不含披挂 PVP）。',
    feeKey: 'imperialMarch',
  },
});

export const TRANSIENT_POLICY_ORDER = [
  TRANSIENT_POLICY_KEY.FRONT_ASSAULT,
  TRANSIENT_POLICY_KEY.REAR_ASSAULT,
  TRANSIENT_POLICY_KEY.IMPERIAL_MARCH,
];

/** 表单初值：从后端 panel.config 取，缺失时按 meta 默认 */
export function readPolicyConfigInitial(category, config) {
  const meta = POLICY_CATEGORY_META[category];
  if (!meta) return {};
  const cfg = config || {};
  switch (meta.formKind) {
    case 'percentSlider': {
      const v = Number(cfg[meta.valueKey]);
      // 缺省/0 时回退一个「合理初值」便于滑条可见：粮饷 5%、城战 80%
      const fallback = category === POLICY_CATEGORY.RATION_BONUS ? meta.minPct : 80;
      return { [meta.valueKey]: Number.isFinite(v) && v > 0 ? v : fallback };
    }
    case 'toggle':
      return { [meta.valueKey]: !!cfg[meta.valueKey] };
    case 'singleChoice':
      return { [meta.valueKey]: cfg[meta.valueKey] || meta.options[0].value };
    default:
      return {};
  }
}
