/**
 * 势力政策服务（11-3 实装段1）
 *
 * 负责长效政策的：
 *   - 读：`getEffectivePolicy(factionId, category)` / `getPanelForFaction(factionId)`（缺行回退到 `factionPolicyDefaults`）
 *   - 写：`submitLongTermProposal(...)`（走 `passiveApprovalService` → 通过则 upsert + 落 CD；驳回仅落 CD）
 *
 * 单点读路径：城战分成、俸禄 Bonus、招贤池、内政加成 — 段2~4 所有效果消费 **必须** 经
 * `getEffective*`；**禁止** 各 service 自行 `pool.query('SELECT ... FROM faction_policies')`
 * 兜底（与 notee-code-quality P0 一致）。
 *
 * 审计：审批结果由 `passiveApprovalService` 写结构化日志 `[passiveApproval]`；本服务再叠一行
 * `[factionPolicy]` 关键摘要，便于排错。
 *
 * @module services/factionPolicyService
 * @see 11-3-FACTION_POLICY_SYSTEM.md
 * @see 11-3-FACTION_POLICY_SYSTEM-IMPLEMENTATION-PLAN.md §6 实装段1
 */

const { pool } = require('../database/connection');
const { httpError } = require('../utils/httpError');
const passiveApprovalService = require('./passiveApprovalService');
const aiKingConfigService = require('./aiKingConfigService');
const policyProposerAuth = require('./policyProposerAuth');
const defaults = require('./factionPolicyDefaults');
const factionReserveService = require('./factionReserveService');

/**
 * 行 → 驼峰（API/前端口径）。
 * `config_json` MariaDB JSON 列：mysql2 默认会自动解析；若驱动配置不同导致为字符串，做一次 JSON.parse 兜底。
 *
 * @param {object} row - `SELECT * FROM faction_policies`
 * @returns {object|null}
 */
function formatFactionPolicyRow(row) {
  if (!row) return null;
  let config = row.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (_) {
      config = null;
    }
  }
  return {
    id: row.id,
    factionId: row.faction_id,
    policyCategory: row.policy_category,
    config: config || {},
    lastOutcome: row.last_outcome || null,
    lastOutcomeAt: row.last_outcome_at || null,
    nextEligibleAt: row.next_eligible_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**
 * 查询单条政策行（按 (factionId, category) 唯一）。
 *
 * @param {string} factionId
 * @param {string} category
 * @returns {Promise<object|null>}
 */
async function findFactionPolicyRow(factionId, category) {
  const [rows] = await pool.query(
    `SELECT id, faction_id, policy_category, config_json,
            last_outcome, last_outcome_at, next_eligible_at,
            created_at, updated_at
       FROM faction_policies
      WHERE faction_id = ? AND policy_category = ?
      LIMIT 1`,
    [factionId, category],
  );
  return rows[0] || null;
}

/**
 * 取该势力下所有政策行（按类目分组）。
 *
 * @param {string} factionId
 * @returns {Promise<Record<string, object>>} 以 `policy_category` 为键
 */
async function findAllPoliciesByFaction(factionId) {
  const [rows] = await pool.query(
    `SELECT id, faction_id, policy_category, config_json,
            last_outcome, last_outcome_at, next_eligible_at,
            created_at, updated_at
       FROM faction_policies
      WHERE faction_id = ?`,
    [factionId],
  );
  const map = {};
  for (const r of rows) {
    map[r.policy_category] = r;
  }
  return map;
}

/**
 * 取势力某类目的「当前生效配置」：有 `faction_policies` 行则用行内 `config_json`（驳回不覆盖 config），
 * 否则回退 `factionPolicyDefaults.getDefaultConfigForCategory(category)`。
 *
 * @param {string} factionId
 * @param {string} category
 * @returns {Promise<{ source: 'row'|'default', config: object, row: object|null }>}
 */
async function getEffectivePolicy(factionId, category) {
  if (!defaults.isValidCategory(category)) {
    throw new Error(`[factionPolicyService] 未知 policy_category: ${category}`);
  }
  const row = await findFactionPolicyRow(factionId, category);
  if (row) {
    const formatted = formatFactionPolicyRow(row);
    return { source: 'row', config: formatted.config || {}, row: formatted };
  }
  return {
    source: 'default',
    config: defaults.getDefaultConfigForCategory(category),
    row: null,
  };
}

/**
 * 校验类目 CD：若 `next_eligible_at` 仍在未来，抛 409（前端不应到此，但服务端兜底防绕过）。
 *
 * @param {object|null} row - `findFactionPolicyRow` 返回值
 * @param {string} category
 * @throws HttpError(409, ...) 仍在冷却时
 */
function assertCategoryEligible(row, category) {
  if (!row || !row.next_eligible_at) return;
  const eligibleAt = new Date(row.next_eligible_at).getTime();
  if (!Number.isFinite(eligibleAt)) return;
  if (Date.now() < eligibleAt) {
    throw httpError(
      409,
      `「${defaults.POLICY_CATEGORY_LABELS[category] || category}」仍在冷却，未到再次提议时间。`,
      'POLICY_CATEGORY_COOLDOWN',
    );
  }
}

/**
 * 取势力当前占有城数（饱和调制用，与 `aiKingActiveDecisionService.fetchFactionCityCount` 同口径）。
 * 在服务内再写一遍轻量查询，避免跨服务循环依赖。
 *
 * @param {string} factionId
 * @returns {Promise<number>}
 */
async function fetchFactionCityCountForKing(factionId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM cities WHERE faction_id = ?',
    [factionId],
  );
  return Number(rows[0]?.c || 0);
}

/**
 * Upsert 一行长效政策（INSERT … ON DUPLICATE KEY UPDATE config_json/CD/outcome）。
 * 仅在 service 内部使用：审批通过后写入新配置，或驳回后只更新 CD。
 *
 * @param {object} conn - mysql2 连接（事务）
 * @param {object} input - { factionId, category, config, outcome, outcomeAt, nextEligibleAt }
 * @param {boolean} [updateConfig=true] - 驳回时不更新 config（保留旧配置）
 */
async function upsertFactionPolicy(conn, input, updateConfig = true) {
  const { factionId, category, config, outcome, outcomeAt, nextEligibleAt } = input;
  const configStr = JSON.stringify(config || {});
  if (updateConfig) {
    await conn.query(
      `INSERT INTO faction_policies
         (faction_id, policy_category, config_json, last_outcome, last_outcome_at, next_eligible_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         config_json = VALUES(config_json),
         last_outcome = VALUES(last_outcome),
         last_outcome_at = VALUES(last_outcome_at),
         next_eligible_at = VALUES(next_eligible_at)`,
      [factionId, category, configStr, outcome, outcomeAt, nextEligibleAt],
    );
  } else {
    // 驳回：保留 config_json（若行存在则不变；不存在则用提案配置占位以满足 NOT NULL）
    await conn.query(
      `INSERT INTO faction_policies
         (faction_id, policy_category, config_json, last_outcome, last_outcome_at, next_eligible_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_outcome = VALUES(last_outcome),
         last_outcome_at = VALUES(last_outcome_at),
         next_eligible_at = VALUES(next_eligible_at)`,
      [factionId, category, configStr, outcome, outcomeAt, nextEligibleAt],
    );
  }
}

/**
 * 提交一条 **长效** 政策提案，跑被动审批，落库。
 *
 * 事务边界：审批是内存计算（无副作用），upsert 单语句即可；不强行 `beginTransaction`，
 * 但走单连接以便错误可追溯。
 *
 * @param {object} input
 * @param {string} input.factionId          - 提议方势力 id（必须有 AI 君主配置）
 * @param {string} input.category           - 长效四类之一
 * @param {object} input.config             - 提案 config（经 `validateConfigForCategory` 规范化）
 * @param {string} input.proposerPlayerId   - 提议玩家 id（审计）
 * @param {string} [input.proposalId]       - 调用方可传；默认 service 生成
 * @returns {Promise<{
 *   approval: object,
 *   policy: object,
 *   approved: boolean,
 *   proposalId: string,
 * }>}
 */
async function submitLongTermProposal(input) {
  const {
    factionId,
    category,
    config,
    proposerPlayerId = null,
    proposalId: passedProposalId,
  } = input || {};

  if (!factionId) {
    throw httpError(400, '缺少 factionId', 'POLICY_MISSING_FACTION');
  }
  if (!defaults.isValidCategory(category)) {
    throw httpError(400, `未知 policy_category: ${category}`, 'POLICY_INVALID_CATEGORY');
  }
  const v = defaults.validateConfigForCategory(category, config || {});
  if (!v.ok) {
    throw httpError(400, v.error, 'POLICY_INVALID_CONFIG');
  }
  if (!aiKingConfigService.hasKingForFaction(factionId)) {
    throw httpError(
      400,
      `该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）：${factionId}`,
      'POLICY_NO_KING',
    );
  }

  const existingRow = await findFactionPolicyRow(factionId, category);
  assertCategoryEligible(existingRow, category);

  // 招贤类目「审批通过且由 OFF→ON」的一次性扣费校验：储备不足直接 400，**不消费 CD**
  // （与战事谏言一致 — 战事在 createPvpWarDraftAndActivate 内才扣费；招贤无激活步骤，
  //   故 storage check 放在审批之前确保储备够，再让审批跑；审批驳回 → 不扣费，仅 12h CD）
  let recruitFeeContext = null;
  if (category === defaults.POLICY_CATEGORIES.RECRUIT) {
    const nextEnabled = !!v.normalized.enabled;
    const prevEnabled = !!(
      existingRow &&
      existingRow.last_outcome === 'approved' &&
      (() => {
        try {
          const cfg =
            typeof existingRow.config_json === 'string'
              ? JSON.parse(existingRow.config_json)
              : existingRow.config_json;
          return !!cfg?.enabled;
        } catch (_) {
          return false;
        }
      })()
    );
    const mapping = defaults.getRecruitMappingForFaction(factionId);
    const shouldChargeIfApproved = nextEnabled && !prevEnabled;
    recruitFeeContext = {
      nextEnabled,
      prevEnabled,
      san0Band: mapping.san0Band,
      openCostSilver: mapping.openCostSilver,
      shouldChargeIfApproved,
    };
    if (shouldChargeIfApproved && mapping.openCostSilver > 0) {
      // 先读储备：足额才进入审批；不足直接 400 + 不写 CD
      const poolBal = await factionReserveService.getPoolBalance(pool, factionId);
      const reserve = poolBal?.silver ?? 0;
      if (reserve < mapping.openCostSilver) {
        throw httpError(
          400,
          `势力储备银两不足以开启招贤纳士（需 ${mapping.openCostSilver}，当前 ${reserve}）`,
          'POLICY_INSUFFICIENT_FACTION_RESERVES',
        );
      }
    }
  }

  const proposalId =
    String(passedProposalId || '').trim() ||
    `policy_${factionId}_${category}_${Date.now()}`;

  const cityCount = await fetchFactionCityCountForKing(factionId);
  const approval = passiveApprovalService.resolvePassiveApproval({
    factionId,
    proposalType: passiveApprovalService.PROPOSAL_TYPE_POLICY,
    proposalId,
    cityCount,
  });

  const now = new Date();
  const cdMs = approval.approved
    ? defaults.CD_AFTER_APPROVED_MS
    : defaults.CD_AFTER_REJECTED_MS;
  const nextEligibleAt = new Date(now.getTime() + cdMs);

  /**
   * 招贤类目：审批通过 + OFF→ON 时同事务扣势力池银两（`faction_reserve` · pool）。
   * 储备不足在审批前已抛 400 拦截；这里再 FOR UPDATE 二次校验，避免并发把储备先扣空。
   * 若并发夺扣发生 → 抛 409，**回滚事务、不消费 CD**。
   */
  const conn = await pool.getConnection();
  let chargedSilver = 0;
  try {
    await conn.beginTransaction();
    if (
      approval.approved &&
      recruitFeeContext &&
      recruitFeeContext.shouldChargeIfApproved &&
      recruitFeeContext.openCostSilver > 0
    ) {
      const poolBalLocked = await factionReserveService.getPoolBalance(conn, factionId, {
        forUpdate: true,
      });
      const reserve = poolBalLocked.silver;
      if (reserve < recruitFeeContext.openCostSilver) {
        throw httpError(
          409,
          `势力储备银两不足以开启招贤纳士（需 ${recruitFeeContext.openCostSilver}，当前 ${reserve}）`,
          'POLICY_INSUFFICIENT_FACTION_RESERVES',
        );
      }
      await factionReserveService.deductPoolOnConnection(conn, factionId, {
        silver: recruitFeeContext.openCostSilver,
        food: 0,
      });
      chargedSilver = recruitFeeContext.openCostSilver;
    }
    await upsertFactionPolicy(
      conn,
      {
        factionId,
        category,
        config: v.normalized,
        outcome: approval.approved ? 'approved' : 'rejected',
        outcomeAt: now,
        nextEligibleAt,
      },
      // 仅 approved 时覆盖 `config_json`；驳回保留旧配置（若行已存在）
      !!approval.approved,
    );
    await conn.commit();
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }

  const row = await findFactionPolicyRow(factionId, category);
  const policy = formatFactionPolicyRow(row);

  console.log(
    '[factionPolicy]',
    JSON.stringify({
      action: 'submit_long_term',
      factionId,
      category,
      approved: approval.approved,
      proposerPlayerId,
      proposalId,
      nextEligibleAt: nextEligibleAt.toISOString(),
      configApplied: approval.approved ? v.normalized : null,
      chargedSilver,
    }),
  );

  return {
    approval,
    policy,
    approved: !!approval.approved,
    proposalId,
    chargedSilver,
  };
}

/**
 * 取「城战奖赏」当前生效拆分比例（参战势力银两/粮草拆分）。
 *
 * **语义与 `getEffectivePolicy` 一致**（11-3 §2.2 · 段2 已实装）：
 *   - **无 `faction_policies` 行** → **`defaultPersonalSharePct`（80/20）**，无需君主批准
 *   - **有行** → 用行内 `config_json.personalSharePct`（仅 **approved** 提案会覆盖 config；驳回保留旧配置）
 *   - 谏言 / 审批仅用于 **修改** 比例，不改变「实装后默认即 80/20」
 *
 * 与 `getEffectiveRationBonus` / `getEffectiveRecruit` 不同：后二者「无 approved 行」时不生效（0% / OFF）；
 * 城战奖赏在 M2 段2 起 **默认即拆分**。
 *
 * @param {string} factionId
 * @returns {Promise<{
 *   personalSharePct: number,
 *   source: 'category_default' | 'policy_row',
 *   row: object|null,
 * }>}
 */
async function getEffectiveSiegeReward(factionId) {
  const { source, config, row } = await getEffectivePolicy(
    factionId,
    defaults.POLICY_CATEGORIES.SIEGE_REWARD,
  );
  const rawPct = Number(config?.personalSharePct);
  const personalSharePct = Number.isFinite(rawPct)
    ? Math.max(0, Math.min(100, Math.round(rawPct)))
    : defaults.SIEGE_REWARD.defaultPersonalSharePct;
  return {
    personalSharePct,
    source: source === 'row' ? 'policy_row' : 'category_default',
    row,
  };
}

/**
 * 取「内政目标」当前生效维度（人口 / 商业 / 农业 / 军事 / 文化）。
 *
 * **当前状态**：内政玩法（§3.4）尚未实装，**本函数仅作单点读 hook 占位** —— 未来内政服务在加算
 * 贡献奖励 +50% 时 **必须** 通过本函数取生效目标，**禁止** 自行 SQL 兜底（与 notee-code-quality P0 一致）。
 *
 * 语义同其它 `getEffective*`（除城战奖赏外）：未 approved → 返回 `goal=null`（即「无加成」）。
 *
 * @param {string} factionId
 * @returns {Promise<{
 *   goal: 'population'|'commerce'|'agriculture'|'military'|'culture'|null,
 *   source: 'approved_row' | 'pre_stage_default',
 *   row: object|null,
 * }>}
 */
async function getEffectiveDomesticGoal(factionId) {
  const fallback = {
    goal: defaults.DOMESTIC_GOAL.defaultGoal, // null
    source: 'pre_stage_default',
    row: null,
  };
  const row = await findFactionPolicyRow(
    factionId,
    defaults.POLICY_CATEGORIES.DOMESTIC_GOAL,
  );
  if (!row) return fallback;
  const formatted = formatFactionPolicyRow(row);
  if (formatted.lastOutcome !== 'approved') {
    return { ...fallback, row: formatted };
  }
  const g = String(formatted.config?.goal || '').trim();
  if (!g || !defaults.DOMESTIC_GOAL.options.includes(g)) {
    return { ...fallback, row: formatted };
  }
  return {
    goal: g,
    source: 'approved_row',
    row: formatted,
  };
}

/**
 * 取「粮饷加成」当前生效 Bonus 百分比（俸禄发放合并用）。
 *
 * 须 **approved** 才生效：无行 / 未批准 → `bonusPct=0`（无 Bonus）。
 *
 * 俸禄发放（`sanGongStipendService.claimStipend`）须 **直接** 通过本函数读，**禁止** 自行 SQL 兜底。
 *
 * @param {string} factionId
 * @returns {Promise<{
 *   bonusPct: number,
 *   source: 'approved_row' | 'pre_stage_default',
 *   row: object|null,
 * }>}
 */
async function getEffectiveRationBonus(factionId) {
  const fallback = {
    bonusPct: defaults.RATION_BONUS.defaultPct,
    source: 'pre_stage_default',
    row: null,
  };
  const row = await findFactionPolicyRow(
    factionId,
    defaults.POLICY_CATEGORIES.RATION_BONUS,
  );
  if (!row) return fallback;
  const formatted = formatFactionPolicyRow(row);
  if (formatted.lastOutcome !== 'approved') {
    return { ...fallback, row: formatted };
  }
  const pct = Number(formatted.config?.bonusPct);
  if (!Number.isFinite(pct) || pct <= 0) {
    return { ...fallback, row: formatted };
  }
  // 钳制到合法区间（5～50）；防 DB 被异常写入超界
  const clamped = Math.max(
    defaults.RATION_BONUS.minPct,
    Math.min(defaults.RATION_BONUS.maxPct, Math.round(pct)),
  );
  return {
    bonusPct: clamped,
    source: 'approved_row',
    row: formatted,
  };
}

/**
 * 取「招贤纳士」当前是否生效及对应 `san_0` 段（卡池采样合并用）。
 *
 * 与 `getEffectiveSiegeReward` 不同：招贤须 **approved + enabled** 才生效。
 *
 * 卡池层（`cardPoolService.drawSingleCard`）须 **直接** 通过本函数读，**禁止** 自行 `pool.query` 兜底。
 *
 * @param {string} factionId
 * @returns {Promise<{
 *   enabled: boolean,
 *   san0Band: string|null,
 *   source: 'approved_row' | 'pre_stage_default',
 *   row: object|null,
 * }>}
 */
async function getEffectiveRecruit(factionId) {
  const fallback = {
    enabled: false,
    san0Band: null,
    source: 'pre_stage_default',
    row: null,
  };
  const row = await findFactionPolicyRow(factionId, defaults.POLICY_CATEGORIES.RECRUIT);
  if (!row) return fallback;
  const formatted = formatFactionPolicyRow(row);
  if (formatted.lastOutcome !== 'approved' || !formatted.config?.enabled) {
    return { ...fallback, row: formatted };
  }
  const mapping = defaults.getRecruitMappingForFaction(factionId);
  if (!mapping.san0Band) {
    // 势力不在映射表里 → 政策即使 approved 也无效（不追加段）
    return { ...fallback, row: formatted };
  }
  return {
    enabled: true,
    san0Band: mapping.san0Band,
    source: 'approved_row',
    row: formatted,
  };
}

/**
 * 朝政面板：返回四类政策的当前生效配置 + CD + 审批预览（policy 类） + 提议白名单 id 列表。
 *
 * @param {string} factionId
 * @returns {Promise<{
 *   factionId: string,
 *   policies: Record<string, {
 *     category: string,
 *     label: string,
 *     source: 'row'|'default',
 *     config: object,
 *     lastOutcome: string|null,
 *     lastOutcomeAt: Date|null,
 *     nextEligibleAt: Date|null,
 *     cooldownActive: boolean,
 *   }>,
 *   approvalPreview: object|null,
 *   proposerPositionIds: { longTerm: string[], transient: string[] },
 *   defaults: object,
 * }>}
 */
async function getPanelForFaction(factionId) {
  if (!factionId) {
    throw httpError(400, '缺少 factionId', 'POLICY_MISSING_FACTION');
  }
  const hasKing = aiKingConfigService.hasKingForFaction(factionId);
  const rowsByCat = await findAllPoliciesByFaction(factionId);

  const now = Date.now();
  const policies = {};
  for (const cat of defaults.POLICY_CATEGORY_LIST) {
    const row = rowsByCat[cat] || null;
    let formatted = null;
    if (row) formatted = formatFactionPolicyRow(row);
    const eligibleAt = formatted?.nextEligibleAt
      ? new Date(formatted.nextEligibleAt).getTime()
      : null;
    policies[cat] = {
      category: cat,
      label: defaults.POLICY_CATEGORY_LABELS[cat] || cat,
      source: formatted ? 'row' : 'default',
      config: formatted ? formatted.config : defaults.getDefaultConfigForCategory(cat),
      lastOutcome: formatted?.lastOutcome || null,
      lastOutcomeAt: formatted?.lastOutcomeAt || null,
      nextEligibleAt: formatted?.nextEligibleAt || null,
      cooldownActive: Number.isFinite(eligibleAt) && eligibleAt > now,
    };
  }

  let approvalPreview = null;
  if (hasKing) {
    const cityCount = await fetchFactionCityCountForKing(factionId);
    approvalPreview = passiveApprovalService.previewApprovalRange({
      factionId,
      proposalType: passiveApprovalService.PROPOSAL_TYPE_POLICY,
      cityCount,
    });
  }

  // 招贤映射 + 当前势力储备：供 modal 展示「开启费 / 储备 / 是否会扣费」
  const recruitMapping = defaults.getRecruitMappingForFaction(factionId);
  let factionReserves = { silver: 0, food: 0 };
  {
    const poolBal = await factionReserveService.getPoolBalance(pool, factionId);
    if (poolBal) {
      factionReserves = { silver: poolBal.silver, food: poolBal.food };
    }
  }

  return {
    factionId,
    hasKing,
    policies,
    approvalPreview,
    factionReserves,
    recruitMapping,
    proposerPositionIds: {
      longTerm: policyProposerAuth.getProposerPositionIds(
        policyProposerAuth.POLICY_SCOPE.LONG_TERM,
      ),
      transient: policyProposerAuth.getProposerPositionIds(
        policyProposerAuth.POLICY_SCOPE.TRANSIENT,
      ),
    },
    defaults: {
      rationBonus: defaults.RATION_BONUS,
      siegeReward: defaults.SIEGE_REWARD,
      recruit: defaults.RECRUIT,
      domesticGoal: defaults.DOMESTIC_GOAL,
      cdAfterApprovedMs: defaults.CD_AFTER_APPROVED_MS,
      cdAfterRejectedMs: defaults.CD_AFTER_REJECTED_MS,
    },
  };
}

module.exports = {
  formatFactionPolicyRow,
  findFactionPolicyRow,
  findAllPoliciesByFaction,
  getEffectivePolicy,
  getEffectiveSiegeReward,
  getEffectiveRationBonus,
  getEffectiveRecruit,
  getEffectiveDomesticGoal,
  getPanelForFaction,
  submitLongTermProposal,
  assertCategoryEligible,
};
