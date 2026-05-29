/**
 * AI 君主主动决策服务（M2）
 *
 * 与 41-1-AI_KING_SYSTEM.md §8 一致：
 *   1. 单次入口在「战事 / 政策」两类意图间按 *_eff 加权抽签
 *      （战事 ← aggressionEff；政策 ← evolutionEff）。
 *   2. 战事意图：
 *      - 候选目标集合 = 「郡邻接 + 城阵营色」后，再与战略缩略图 **「最近 3 敌对 / 最近 3 中立」**（`computeStrategicMiniMapProximityHighlights` + `cities.position_x/y`）求交；仅余集参与 AI 抽样
 *        · PVP 红色敌对城  → `pvpWarService.createPvpWarDraft`（去除已存在 active 战事的城）
 *        · PVE 白色 NPC 城 → `cityService.openPveWarOnNeutralCity`（幂等：已有 active wars 行直接复用；
 *          无 NPC 守军时按现有 `generateNpcGarrison` 自动生成）
 *   3. 势力政策意图：11-3 `faction_policies` DDL **已落地**（实装段1）；玩家被动谏言走
 *      `routes/factionPolicies.js` + `factionPolicyService.submitLongTermProposal`。AI 君主
 *      **主动**写库（"君主自决修改政策"）属新玩法行为，需产品授权（哪些类目可主动改、频率、
 *      是否允许覆盖玩家近期谏言通过的配置等）；M2 仍保留日志意图 + `recordRecentDecision` 内存
 *      留痕，前端「君主口谕」可读取。见 41-1 §8 §阶段4「保留日志意图」。
 *
 * `proposerPlayerId` 口径：主动通道用 **AI 君主自身 `character_id`**（如 `san_1_char_7001`）；
 * 与玩家被动通道（真实 `player_id`）显式区分；当前 `wars_pvp` 表无 proposer 列，所以
 * 仅以日志关键字 `[aiKing][active]` 留痕，不做兜底替换。
 *
 * 与被动审批的关系：本服务不调用 `passiveApprovalService`；两条通道独立运行
 * （41-1 §8 §3「主动 / 被动两条通道」）。
 *
 * @module backend/services/aiKingActiveDecisionService
 */

const { pool } = require('../database/connection');
const aiKingConfigService = require('./aiKingConfigService');
const pvpWarService = require('./pvpWarService');
const cityService = require('./cityService');
const WarPvp = require('../models/WarPvp');
const {
  computeSaturatedPersonality,
} = require('../utils/aiKingPersonalityEff');
const { isAllowedPlayerCityPoiCityType } = require('../../shared/utils/strategicMarchPoi.js');
const strategicWarTargetProximityService = require('./strategicWarTargetProximityService');

/** 意图类型常量；与 41-1 §8 §3 表「编码示意」一致。 */
const INTENT_TYPE = Object.freeze({
  WAR_PVP: 'active_war_intent_pvp',
  WAR_PVE: 'active_war_intent_pve',
  POLICY: 'active_policy_intent',
  NONE: 'none',
});

/** 默认 season（与 17-2 一致）；若将来多赛季可由调用方注入覆盖。 */
const DEFAULT_SEASON = 'san_1';

/**
 * 「最近一次主动决策」内存留痕：
 *   - 每次 `decide` 末尾覆盖该势力的 latest entry；
 *   - 提供给「君主口谕」前端在切槽时显示当下君主动向（GET /api/pvp-wars/king-recent-decision）；
 *   - 默认窗口 60 分钟内有效，过期回退闲聊池；
 *   - **不入库**：与「重启恢复方案 B」原则一致 —— 进程重启即丢失，无需 DDL。
 */
const RECENT_DECISION_TTL_MS = 60 * 60 * 1000;
const lastDecisionByFaction = new Map();

function recordRecentDecision(audit) {
  if (!audit?.factionId) return;
  lastDecisionByFaction.set(audit.factionId, {
    ...audit,
    decidedAt: Date.now(),
  });
}

/**
 * 取势力最近一次主动决策摘要；超过 `withinMs` 视为过期，返回 null。
 *
 * @param {string} factionId
 * @param {{ withinMs?: number }} [opts]
 * @returns {object|null}
 */
function getRecentDecision(factionId, opts = {}) {
  const withinMs = Number.isFinite(opts.withinMs) ? opts.withinMs : RECENT_DECISION_TTL_MS;
  const entry = lastDecisionByFaction.get(factionId);
  if (!entry) return null;
  if (Date.now() - entry.decidedAt > withinMs) return null;
  return entry;
}

/**
 * 取势力当前占有城数（用于 `*_eff` 饱和判定）。
 *
 * @param {string} factionId
 * @returns {Promise<number>}
 */
async function fetchFactionCityCount(factionId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS c FROM cities WHERE faction_id = ?",
    [factionId],
  );
  return Number(rows[0]?.c || 0);
}

/**
 * 收集与 AI 君主势力**已占城**所在郡 4 邻接的所有相关郡 id（含本郡自己）。
 * 数据源：`config_jun_node`（无向，jun_id_a < jun_id_b 字典序）。
 *
 * @param {string} factionId
 * @returns {Promise<Set<string>>} 郡 id 集合
 */
async function fetchAdjacentJunIdSet(factionId) {
  const [ownRows] = await pool.query(
    "SELECT DISTINCT jun_id FROM cities WHERE faction_id = ? AND jun_id IS NOT NULL",
    [factionId],
  );
  const ownJunIds = ownRows.map((r) => r.jun_id).filter(Boolean);
  if (!ownJunIds.length) return new Set();

  const placeholders = ownJunIds.map(() => '?').join(',');
  const [edgeRows] = await pool.query(
    `SELECT jun_id_a, jun_id_b FROM config_jun_node
       WHERE jun_id_a IN (${placeholders}) OR jun_id_b IN (${placeholders})`,
    [...ownJunIds, ...ownJunIds],
  );

  const set = new Set(ownJunIds);
  for (const row of edgeRows) {
    if (ownJunIds.includes(row.jun_id_a)) set.add(row.jun_id_b);
    if (ownJunIds.includes(row.jun_id_b)) set.add(row.jun_id_a);
  }
  return set;
}

/**
 * 候选目标集合（M2 §3 表）：PVP / PVE 一并查询；剔除：
 *   - 己方城；
 *   - PVP 路径：已存在 active `wars_pvp` 的城（同城唯一）；
 *   - **PVE（中立白）**：仅 `city_major` / `city_medium` / `city_small`（与 `isAllowedPlayerCityPoiCityType`、谏言面板一致；**不含 fort / gate 等**）。
 *   - **据点 `fort`**：仅当 `cityService.isCityOccupiedForNpcGarrison` 为真才进 PVP（与 `createPvpWarDraft` 一致）。
 *
 * @param {string} factionId
 * @param {string} [season] - 与 `cities.season` 一致，默认 `san_1`
 * @returns {Promise<{ pvpTargets: Array<object>, pveTargets: Array<object> }>}
 */
async function collectCandidateTargets(factionId, season = DEFAULT_SEASON) {
  const adjacentJunSet = await fetchAdjacentJunIdSet(factionId);
  if (!adjacentJunSet.size) {
    return { pvpTargets: [], pveTargets: [] };
  }
  const seasonKey = String(season || DEFAULT_SEASON).trim() || DEFAULT_SEASON;
  const placeholders = Array.from(adjacentJunSet).map(() => '?').join(',');
  const [cityRows] = await pool.query(
    `SELECT city_id, city_name, city_type, faction_id, status, jun_id
       FROM cities
       WHERE jun_id IN (${placeholders})
         AND COALESCE(NULLIF(TRIM(season), ''), 'san_1') = ?`,
    [...adjacentJunSet, seasonKey],
  );

  const pvpRaw = [];
  const pveTargets = [];
  for (const c of cityRows) {
    if (c.faction_id == null) {
      if (!isAllowedPlayerCityPoiCityType(c.city_type)) continue;
      pveTargets.push(c);
    } else if (c.faction_id !== factionId) {
      const ct = String(c.city_type || '').trim().toLowerCase();
      if (ct === 'fort' && !cityService.isCityOccupiedForNpcGarrison(c)) {
        continue;
      }
      pvpRaw.push(c);
    }
  }

  // 同城唯一：剔除已有 active wars_pvp 的城（红色城）
  const pvpTargets = [];
  for (const c of pvpRaw) {
    const existing = await WarPvp.getActiveByCity(c.city_id);
    if (!existing) pvpTargets.push(c);
  }

  const { hostileCityIds, neutralCityIds } =
    await strategicWarTargetProximityService.getProximityHighlightCityIds(factionId, seasonKey);
  const hostileSet = new Set(hostileCityIds);
  const neutralSet = new Set(neutralCityIds);
  for (const c of pvpTargets) {
    c._remonstranceMapRangeOk = hostileSet.has(String(c.city_id));
  }
  for (const c of pveTargets) {
    c._remonstranceMapRangeOk = neutralSet.has(String(c.city_id));
  }

  return { pvpTargets, pveTargets };
}

/**
 * 加权随机选一项；权重为 0 的项不会被选中。空 / 全 0 → null。
 *
 * @param {Array<{ key: string, weight: number }>} entries
 * @param {() => number} [rng]
 * @returns {string | null}
 */
function weightedPick(entries, rng = Math.random) {
  const positive = entries.filter((e) => Number(e.weight) > 0);
  if (!positive.length) return null;
  const total = positive.reduce((s, e) => s + e.weight, 0);
  if (!(total > 0)) return null;
  let u = rng() * total;
  for (const e of positive) {
    u -= e.weight;
    if (u <= 0) return e.key;
  }
  return positive[positive.length - 1].key;
}

/**
 * 单次「主动决策」入口。
 *
 * @param {object} input
 * @param {string} input.factionId
 * @param {object} [input.king] - 已加载的 king 对象；不传则按 factionId 查
 * @param {number} [input.slotIndex]
 * @param {string} [input.hourKey]
 * @param {boolean} [input.dryRun] - true 时仅日志，不真调写库
 * @param {() => number} [input.rng]
 * @returns {Promise<{
 *   factionId: string, intentType: string, ok: boolean, reason?: string,
 *   target?: object, war?: object, eff?: object, weights?: object,
 * }>}
 */
async function decide(input) {
  const { factionId, slotIndex = null, hourKey = null, dryRun = false } = input || {};
  const rng = input?.rng || Math.random;
  if (!factionId) throw new Error('[aiKing][active] decide 缺 factionId');

  const king = input?.king || aiKingConfigService.getKingByFactionId(factionId);
  const cityCount = await fetchFactionCityCount(factionId);
  const eff = computeSaturatedPersonality(king, cityCount);
  const weights = { war: eff.aggressionEff, policy: eff.evolutionEff };

  const auditPrefix =
    `[aiKing][active] factionId=${factionId} king=${king.characterName}` +
    `(${king.characterId}) hour=${hourKey || '-'} slot=${slotIndex} ` +
    `cityCount=${cityCount}/${eff.cityCountSaturation}${eff.saturated ? ' SATURATED' : ''}` +
    ` w_war=${weights.war.toFixed(3)} w_policy=${weights.policy.toFixed(3)}`;

  /**
   * 统一在所有 return 路径上记下「最近一次主动决策」（供口谕等前端拉取）。
   * 留下 king 身份、目标城概要与意图结论；不写库（与方案 B 原则一致）。
   */
  const finalize = (result) => {
    recordRecentDecision({
      factionId,
      intentType: result.intentType,
      ok: !!result.ok,
      reason: result.reason || null,
      target: result.target
        ? {
            cityId: result.target.city_id || null,
            cityName: result.target.city_name || null,
            factionId: result.target.faction_id || null,
            junId: result.target.jun_id || null,
          }
        : null,
      king: {
        characterId: king.characterId,
        characterName: king.characterName,
        courtesyName: king.courtesyName || null,
        speechStyle: king.speechStyle || null,
      },
      weights: result.weights,
      saturated: !!result.eff?.saturated,
      war: result.war
        ? { pvpWarId: result.war.pvpWarId || null, warId: result.war.war_id || null }
        : null,
      slotIndex: slotIndex ?? null,
      hourKey: hourKey || null,
      dryRun: !!dryRun,
    });
    return result;
  };

  const picked = weightedPick(
    [
      { key: 'war', weight: weights.war },
      { key: 'policy', weight: weights.policy },
    ],
    rng,
  );

  if (!picked) {
    console.log(`${auditPrefix} → skip (zero weights)`);
    return finalize({
      factionId,
      intentType: INTENT_TYPE.NONE,
      ok: false,
      reason: 'zero_weights',
      eff,
      weights,
    });
  }

  if (picked === 'policy') {
    // [TODO · 未来玩法精调] AI 主动改政策仍是「仅日志 + 内存留痕」基础框架。
    //   gated by product/gameplay authorization
    //   11-3 实装段1：`faction_policies` DDL 已建、玩家被动谏言链已通；AI **主动** 写库的产品
    //   行为（哪些类目可自决、频率、是否覆盖玩家已审批配置）尚未定稿，故保持仅日志意图 +
    //   `recordRecentDecision` 内存留痕（41-1 §8 §阶段4 / 11-3 §1.5 TODO 41-ai）。
    //   后续放开主动写库时，在 `factionPolicyService` 增加 `applyKingAutonomousChange(...)`
    //   即可（绕过被动审批 / 自带 24h CD）。
    console.log(`${auditPrefix} → intent=policy (autonomous write awaiting game-design authorization; log only)`);
    return finalize({
      factionId,
      intentType: INTENT_TYPE.POLICY,
      ok: true,
      reason: 'awaiting_autonomous_policy_design',
      eff,
      weights,
    });
  }

  // 战事意图：先收候选集合，再按战略缩略图「最近 3 敌对 / 最近 3 中立」过滤后供 AI 抽样（与谏言 `inMapWarRemonstranceRange` 同源）
  const warSeason = String(input?.season || '').trim() || DEFAULT_SEASON;
  const { pvpTargets, pveTargets } = await collectCandidateTargets(factionId, warSeason);
  const pvpForAi = pvpTargets.filter((c) => c._remonstranceMapRangeOk);
  const pveForAi = pveTargets.filter((c) => c._remonstranceMapRangeOk);
  if (!pvpForAi.length && !pveForAi.length) {
    console.log(`${auditPrefix} → intent=war but no candidate target (skip)`);
    // 战事意图被抽中但找不到目标（候选空集）：归为「考虑战事但时机未到」，
    // 在 intentType 上保留 war 标记（PVP 子键，因为 collectCandidateTargets 同时枚举两种）以便前端口谕识别。
    return finalize({
      factionId,
      intentType: INTENT_TYPE.WAR_PVP,
      ok: false,
      reason: 'no_war_candidate',
      eff,
      weights,
    });
  }
  // PVP 与 PVE 子分支按候选数量加权（数量越多越易被抽到）；空集自动退化为另一边。
  const subPick = weightedPick(
    [
      { key: 'pvp', weight: pvpForAi.length },
      { key: 'pve', weight: pveForAi.length },
    ],
    rng,
  );
  const targetList = subPick === 'pvp' ? pvpForAi : pveForAi;
  const target = targetList[Math.floor(rng() * targetList.length)];

  if (subPick === 'pvp') {
    if (dryRun) {
      console.log(
        `${auditPrefix} → intent=war/PVP target=${target.city_id}(${target.city_name}) faction=${target.faction_id} [DRY-RUN]`,
      );
      return finalize({
        factionId,
        intentType: INTENT_TYPE.WAR_PVP,
        ok: true,
        reason: 'dry_run',
        target,
        eff,
        weights,
      });
    }
    try {
      const war = await pvpWarService.createPvpWarDraftAndActivate({
        season: DEFAULT_SEASON,
        attackerFactionId: factionId,
        targetCityId: target.city_id,
        warName: `${target.city_name}之战（${king.characterName}起意）`,
        proposer: {
          kind: 'ai_king',
          displayName: String(king.characterName || '').trim() || '君主',
          playerId: null,
        },
      });
      console.log(
        `${auditPrefix} → intent=war/PVP createPvpWarDraft ok ` +
          `pvpWarId=${war.pvpWarId} target=${target.city_id}(${target.city_name})`,
      );
      return finalize({
        factionId,
        intentType: INTENT_TYPE.WAR_PVP,
        ok: true,
        target,
        war,
        eff,
        weights,
      });
    } catch (err) {
      console.error(
        `${auditPrefix} → intent=war/PVP createPvpWarDraft failed target=${target.city_id}: ${err.message}`,
      );
      return finalize({
        factionId,
        intentType: INTENT_TYPE.WAR_PVP,
        ok: false,
        reason: err.message,
        target,
        eff,
        weights,
      });
    }
  }

  // PVE 真调：cityService.openPveWarOnNeutralCity（与 initiateSiege 同口径，幂等）
  if (dryRun) {
    console.log(
      `${auditPrefix} → intent=war/PVE target=${target.city_id}(${target.city_name}) [DRY-RUN]`,
    );
    return finalize({
      factionId,
      intentType: INTENT_TYPE.WAR_PVE,
      ok: true,
      reason: 'dry_run',
      target,
      eff,
      weights,
    });
  }
  try {
    const opened = await cityService.openPveWarOnNeutralCity(target.city_id, {
      openedByCharacterId: king.characterId,
      bulletinFactionId: factionId,
    });
    console.log(
      `${auditPrefix} → intent=war/PVE openPveWar ${opened.created ? 'created' : 'reuse'} ` +
        `warId=${opened.warId} target=${target.city_id}(${target.city_name}) npcAlive=${opened.npcAlive}`,
    );
    return finalize({
      factionId,
      intentType: INTENT_TYPE.WAR_PVE,
      ok: true,
      target,
      war: opened.war,
      warId: opened.warId,
      created: opened.created,
      eff,
      weights,
    });
  } catch (err) {
    console.error(
      `${auditPrefix} → intent=war/PVE openPveWar failed target=${target.city_id}: ${err.message}`,
    );
    return finalize({
      factionId,
      intentType: INTENT_TYPE.WAR_PVE,
      ok: false,
      reason: err.message,
      target,
      eff,
      weights,
    });
  }
}

module.exports = {
  decide,
  collectCandidateTargets,
  fetchAdjacentJunIdSet,
  fetchFactionCityCount,
  weightedPick,
  getRecentDecision,
  INTENT_TYPE,
  DEFAULT_SEASON,
  RECENT_DECISION_TTL_MS,
};
