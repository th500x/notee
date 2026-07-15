/**
 * 势力政策默认值与类目常量（11-3 §8.4 · 不建 `config_faction_policy_defaults` 表）
 *
 * 单源：长效四类的 **可调范围、默认配置、CD 时长、ENUM 枚举** 等「全势力相同」常量都在这里。
 * 凡 `factionPolicyService.getEffective*` 在缺行时回退用的默认值，**必须** 走本模块；
 * 业务 service 内 **禁止** 写 `|| 80`、`|| { bonusPct: 10 }` 等散装兜底（与 notee-code-quality P0 一致）。
 *
 * 按势力不同的差异化默认（如招贤段、汉室免费费用）走 **`config_factions` / CSV**，不在本模块写
 * `if (factionId === '...')`（与 san-storm-data-layer 一致；招贤段在实装段2 由 `factionRecruitPoolService` 读 `config_factions`）。
 *
 * @module services/factionPolicyDefaults
 * @see 11-3-FACTION_POLICY_SYSTEM.md §3、§8.4
 */

/** 长效政策类目（与 `faction_policies.policy_category` ENUM 一一对应；DDL 是权威） */
const POLICY_CATEGORIES = Object.freeze({
  RATION_BONUS: 'ration_bonus',
  SIEGE_REWARD: 'siege_reward',
  RECRUIT: 'recruit',
  DOMESTIC_GOAL: 'domestic_goal',
});

const POLICY_CATEGORY_LIST = Object.freeze([
  POLICY_CATEGORIES.RATION_BONUS,
  POLICY_CATEGORIES.SIEGE_REWARD,
  POLICY_CATEGORIES.RECRUIT,
  POLICY_CATEGORIES.DOMESTIC_GOAL,
]);

/** 朝政区域中文展示名（与 11-3 §3 文案一致；前端可同时引用避免散写） */
const POLICY_CATEGORY_LABELS = Object.freeze({
  [POLICY_CATEGORIES.RATION_BONUS]: '粮饷加成',
  [POLICY_CATEGORIES.SIEGE_REWARD]: '城战奖赏',
  [POLICY_CATEGORIES.RECRUIT]: '招贤纳士',
  [POLICY_CATEGORIES.DOMESTIC_GOAL]: '内政目标',
});

/**
 * CD 时长（11-3 §3.0）：通过 24h、驳回 12h。
 * 写入 `faction_policies.next_eligible_at`；前端只读展示倒计时。
 */
const CD_AFTER_APPROVED_MS = 24 * 60 * 60 * 1000;
const CD_AFTER_REJECTED_MS = 12 * 60 * 60 * 1000;

/**
 * §3.1 粮饷加成 Bonus：调节自势力池给 **个人俸禄基数 `B`** 追加的比例。
 * - 可调范围 5%～50%，步进 1%（前端滑条/+−）
 * - 实装段1 仅落表 + 审批；段4 才在 `claimStipend` 同事务消费
 * - **无政策行** 时默认 **0%（无 Bonus）**：与「未提案前不发 Bonus」语义一致
 */
const RATION_BONUS = Object.freeze({
  minPct: 5,
  maxPct: 50,
  stepPct: 1,
  /** 未提案前默认；提案落地后由 `config_json.bonusPct` 接管 */
  defaultPct: 0,
  /** 前端「举荐起步值」用，向玩家展示「合理初值」；非生效默认 */
  recommendedInitialPct: 10,
});

/**
 * §3.2 城战奖赏：攻城净收益中 **银两、粮草** 拆分（声望/贡献不受本类目影响，永远 100% 个人）。
 * - 个人份额 0%～100%，势力份额 = 100 − 个人；个人取整后余数留势力池
 * - 默认 **80 / 20**（11-3 R4）；M2 段2 起 **无 DB 行即按此默认拆分**，无需君主批准
 * - 谏言 / 审批仅用于 **修改** 比例；有行时用 `config_json.personalSharePct`（驳回不覆盖已生效 config）
 * - **段2 接入前** 曾用 `preStageFallbackPersonalSharePct`（100%）；已废止，勿再引用
 */
const SIEGE_REWARD = Object.freeze({
  minPersonalSharePct: 0,
  maxPersonalSharePct: 100,
  stepPct: 1,
  /** 实装后无 DB 行时的生效默认（11-3 R4） */
  defaultPersonalSharePct: 80,
  /** @deprecated 段2 前临时值；`getEffectiveSiegeReward` 已改用 `defaultPersonalSharePct` */
  preStageFallbackPersonalSharePct: 100,
});

/**
 * §3.3 招贤纳士：开/关 + 势力固定 `san_0` 段映射。
 *
 * **本轮（实装段 2.2）取舍**：与协作者 2026-05-25 合意，段映射 / 一次性开启费 **直接用代码常量**，
 * 不再走 `config_factions` / CSV — 因为产品规则（R1 / R4）已经定稿且短期不会变；
 * 未来若 R3「招贤段细分」要把段映射做成可配置，再切换到 CSV 流水线（届时本模块降级为「兜底默认」）。
 * 11-3 §3.3 文档已同步更新此取舍，**禁止** 另立硬编码 `if (factionId === '...')` 的副本。
 *
 * - 「势力 → san_0 段（楚汉时代将领池）」对照（R1，11-3 §10.1 O2；ID 与 11-1 三大可玩势力对齐）：
 *   - 汉室 `san_1_faction_2001` → `san_0_*_2xxx`（楚汉西汉段：刘邦/张良/萧何/韩信…；开启免费）
 *   - 黄巾 `san_1_faction_3001` → `san_0_*_1xxx`（楚汉项楚段：项羽/龙且/季布…）
 *   - 三王 `san_1_faction_1001` → `san_0_*_0xxx`（楚汉秦末段：扶苏/章邯/赵高/李斯…）
 *
 * - 「势力 → 一次性开启费」：汉室 0；其余势力 2000 银（关闭后再开仍需再扣 2000）。
 *   仅在「审批通过 + 由关闭切换为开启」时扣费；ON→ON 重复审批 / OFF 提案均不扣费。
 *
 * - **池子关系说明（2026-05-25 订正）**：`san_0_char_*` 是 **楚汉时代将领池**，与
 *   `cardPoolService` 默认抽取的 `san_1_char_0xxx`（**本赛季三国通用 50 张**）是 **两个不同的池子**；
 *   招贤 ON / OFF 实际能抽到的池子 **真的不同**（OFF 抽不到楚汉时代段），各势力 ON 后都能多抽
 *   到对应段，不存在「白扣费」。赛季通用 50 张始终保留、与本政策无关。
 *
 * @typedef {{ san0Band: '0'|'1'|'2' }} RecruitMapping
 */
const RECRUIT = Object.freeze({
  /** 未提案前默认关闭 */
  defaultEnabled: false,
});

/**
 * 势力 → san_0 段（取 `character_id` / `troop_id` 第 `san_0_*_` 后第一位数字）。
 * 用作 `cardPoolService` 在抽卡时的额外 LIKE 段 `san_0_<kind>_<band>%`。
 *
 * **不在表内的势力**：视为「无映射」 — 招贤 ON 不追加任何段（前端 toggle 仍可提交，但 toggle 无效果）。
 */
const RECRUIT_SAN0_BAND_BY_FACTION = Object.freeze({
  san_1_faction_1001: '0', // 三王
  san_1_faction_2001: '2', // 汉室
  san_1_faction_3001: '1', // 黄巾
});

/**
 * 势力 → 一次性开启费（银两）。汉室 0；其余 2000（与 11-3 §3.3 一致）。
 * 仅在「审批通过 + 由关闭切换为开启」时扣费；关闭无费用，ON→ON 也不重复扣。
 */
const RECRUIT_OPEN_COST_SILVER_BY_FACTION = Object.freeze({
  san_1_faction_1001: 2000,
  san_1_faction_2001: 0,
  san_1_faction_3001: 2000,
});

/** 默认开启费（势力不在表里时的兜底）：与文档「黄巾与其余五势力 2000」一致，按 2000 取保守值。 */
const RECRUIT_OPEN_COST_SILVER_DEFAULT = 2000;

/**
 * 取势力当前的招贤映射元信息（用于面板展示与卡池采样）。
 *
 * @param {string} factionId
 * @returns {{ factionId: string, san0Band: string|null, openCostSilver: number }}
 */
function getRecruitMappingForFaction(factionId) {
  const fid = String(factionId || '').trim();
  return {
    factionId: fid,
    san0Band: RECRUIT_SAN0_BAND_BY_FACTION[fid] || null,
    openCostSilver:
      RECRUIT_OPEN_COST_SILVER_BY_FACTION[fid] != null
        ? RECRUIT_OPEN_COST_SILVER_BY_FACTION[fid]
        : RECRUIT_OPEN_COST_SILVER_DEFAULT,
  };
}

/**
 * §3.4 内政目标五选一：未来内政玩法 +50% 加成（段4 hook，玩法未就绪时 no-op）。
 */
const DOMESTIC_GOAL = Object.freeze({
  options: Object.freeze(['population', 'commerce', 'agriculture', 'military', 'culture']),
  optionLabels: Object.freeze({
    population: '人口',
    commerce: '商业',
    agriculture: '农业',
    military: '军事',
    culture: '文化',
  }),
  /** 未提案前哨兵：null = 未选 */
  defaultGoal: null,
});

/**
 * 取类目默认 config_json（即 `faction_policies.config_json` 缺失时的回退）。
 *
 * @param {string} category - `POLICY_CATEGORIES.*` 之一
 * @returns {object} 该类目 config 的默认形态（与提案 payload 同 schema）
 */
function getDefaultConfigForCategory(category) {
  switch (category) {
    case POLICY_CATEGORIES.RATION_BONUS:
      return { bonusPct: RATION_BONUS.defaultPct };
    case POLICY_CATEGORIES.SIEGE_REWARD:
      return { personalSharePct: SIEGE_REWARD.defaultPersonalSharePct };
    case POLICY_CATEGORIES.RECRUIT:
      return { enabled: RECRUIT.defaultEnabled };
    case POLICY_CATEGORIES.DOMESTIC_GOAL:
      return { goal: DOMESTIC_GOAL.defaultGoal };
    default:
      throw new Error(`[factionPolicyDefaults] 未知 policy_category: ${category}`);
  }
}

/**
 * 校验提案 `config_json` 是否符合该类目的取值/枚举（业务级 4xx）。
 *
 * @param {string} category
 * @param {object} config - 客户端提交的 `config` 对象（驼峰）
 * @returns {{ ok: true, normalized: object } | { ok: false, error: string }}
 */
function validateConfigForCategory(category, config) {
  if (!config || typeof config !== 'object') {
    return { ok: false, error: 'config 必须为对象' };
  }
  switch (category) {
    case POLICY_CATEGORIES.RATION_BONUS: {
      const pct = Number(config.bonusPct);
      if (!Number.isFinite(pct)) return { ok: false, error: 'bonusPct 必须为数字' };
      const int = Math.round(pct);
      if (int < RATION_BONUS.minPct || int > RATION_BONUS.maxPct) {
        return {
          ok: false,
          error: `粮饷 Bonus 仅可在 ${RATION_BONUS.minPct}%～${RATION_BONUS.maxPct}% 之间`,
        };
      }
      return { ok: true, normalized: { bonusPct: int } };
    }
    case POLICY_CATEGORIES.SIEGE_REWARD: {
      const pct = Number(config.personalSharePct);
      if (!Number.isFinite(pct)) return { ok: false, error: 'personalSharePct 必须为数字' };
      const int = Math.round(pct);
      if (
        int < SIEGE_REWARD.minPersonalSharePct ||
        int > SIEGE_REWARD.maxPersonalSharePct
      ) {
        return {
          ok: false,
          error: `城战奖赏个人份额仅可在 ${SIEGE_REWARD.minPersonalSharePct}%～${SIEGE_REWARD.maxPersonalSharePct}% 之间`,
        };
      }
      return { ok: true, normalized: { personalSharePct: int } };
    }
    case POLICY_CATEGORIES.RECRUIT: {
      const enabled = !!config.enabled;
      return { ok: true, normalized: { enabled } };
    }
    case POLICY_CATEGORIES.DOMESTIC_GOAL: {
      const goal = String(config.goal || '').trim();
      if (!goal || !DOMESTIC_GOAL.options.includes(goal)) {
        return {
          ok: false,
          error: `内政目标必须为 ${DOMESTIC_GOAL.options.join(' / ')} 之一`,
        };
      }
      return { ok: true, normalized: { goal } };
    }
    default:
      return { ok: false, error: `未知 policy_category: ${category}` };
  }
}

/**
 * 判断 category 是否合法（用于路由层快速 400）。
 *
 * @param {string} category
 * @returns {boolean}
 */
function isValidCategory(category) {
  return POLICY_CATEGORY_LIST.includes(category);
}

module.exports = {
  POLICY_CATEGORIES,
  POLICY_CATEGORY_LIST,
  POLICY_CATEGORY_LABELS,
  CD_AFTER_APPROVED_MS,
  CD_AFTER_REJECTED_MS,
  RATION_BONUS,
  SIEGE_REWARD,
  RECRUIT,
  RECRUIT_SAN0_BAND_BY_FACTION,
  RECRUIT_OPEN_COST_SILVER_BY_FACTION,
  RECRUIT_OPEN_COST_SILVER_DEFAULT,
  getRecruitMappingForFaction,
  DOMESTIC_GOAL,
  getDefaultConfigForCategory,
  validateConfigForCategory,
  isValidCategory,
};
