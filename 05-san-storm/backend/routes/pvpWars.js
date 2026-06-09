/**
 * PVP 势力战事 API（17-2 M2）
 *
 * 路径前缀：/api/pvp-wars
 *
 * 端点：
 *   POST   /proposals                   - 高阶官职玩家发起战事提案 → AI 君主被动审批 → 通过则创建草案并 **落大本营激活时** 自势力池扣发动消耗（见 17-2 / `warInitiationCostService`）
 *   GET    /preview-approval            - 客户端预览大致通过率 [base, base×1.2 clamped to 1]
 *   GET    /remonstrance-panel           - 三公府势力战事：郡邻接谏言候选 + 并行上限 + 审批预览（须本势力）
 *   GET    /                            - 列表（filters: status / factionId / season）
 *   GET    /:id                         - 单场战事详情
 *   GET    /by-city/:cityId/active      - 该城当前 pending/active 战事（无 → 200 + null）
 *   POST   /:id/place-base-camp         - 攻方放置城外大本营 + pending → active
 *   POST   /:id/cancel                  - 取消战事（攻方放弃 / 管理员）
 *   POST   /:id/base-camp-siege         - 守方发起对攻方大本营的攻击：返回 NPC 批次
 *   POST   /:id/base-camp-siege-result  - 写回大本营 NPC 战斗结果 + 触发胜负检查
 *   POST   /:id/city-siege              - 攻方对目标城出击：返回防守者批次（披挂 / 普通驻守 / NPC）
 *   POST   /:id/city-siege-result       - 写回攻方对目标城战斗结果（三类防守者通用）
 *   POST   /tick                        - 调试入口：手动跑一次胜负 tick（生产挂 cron）
 *
 * 鉴权：与 cities / battles 一致，requireAuth 顶层挂载。M2 不细化角色权限。
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500, httpError } = require('../utils/httpError');
const { pool } = require('../database/connection');
const pvpWarService = require('../services/pvpWarService');
const passiveApprovalService = require('../services/passiveApprovalService');
const aiKingConfigService = require('../services/aiKingConfigService');
const aiKingActiveDecisionService = require('../services/aiKingActiveDecisionService');
const WarPvp = require('../models/WarPvp');
const Player = require('../models/Player');
const cityService = require('../services/cityService');
const gameTimeService = require('../services/gameTimeService');
const warInitiationCostService = require('../services/warInitiationCostService');
const policyProposerAuth = require('../services/policyProposerAuth');
const warPolicyTransientService = require('../services/warPolicyTransientService');
const remonstranceTributeService = require('../services/remonstranceTributeService');
const { normalizeTributeSilver } = require('../../shared/utils/remonstranceTributeSilver.cjs');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const pvpWarSchemas = require('../middleware/validationSchemas/pvpWars');

/**
 * 取势力当前占有城数（启用 *_eff 饱和调制时供被动审批 / 主动决策共用）。
 * 同 `aiKingActiveDecisionService.fetchFactionCityCount`；在路由层重复一次轻量查询，
 * 避免跨服务循环 require。
 */
async function fetchFactionCityCountForKing(factionId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM cities WHERE faction_id = ?',
    [factionId],
  );
  return Number(rows[0]?.c || 0);
}

router.use(requireAuth);

// ==================== 提案与审批 ====================

/**
 * GET /api/pvp-wars/preview-approval?factionId=...&proposalType=war|policy
 * 仅返回区间 [base, min(1, base × 1.2)]；当次仍走完整骰子+抽检。
 */
router.get('/preview-approval', validateQuery(pvpWarSchemas.previewApprovalQuery), async (req, res, next) => {
  try {
    const { factionId, proposalType, tributeSilver: rawTributeSilver = 0 } = req.query;
    if (!aiKingConfigService.hasKingForFaction(String(factionId))) {
      return res.status(404).json({ success: false, error: '该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）' });
    }
    const tributeSilver = normalizeTributeSilver(rawTributeSilver);
    if (tributeSilver == null) {
      throw httpError(400, '上供银两须为 100 的整数倍（0 表示不上供）', 'TRIBUTE_SILVER_INVALID');
    }
    const cityCount = await fetchFactionCityCountForKing(String(factionId));
    const range = passiveApprovalService.previewApprovalRange({
      factionId: String(factionId),
      proposalType,
      cityCount,
      tributeSilver,
    });
    res.json({ success: true, data: range });
  } catch (error) {
    return next(wrap500(error, '获取审批预览失败'));
  }
});

/**
 * POST /api/pvp-wars/proposals
 * Body: {
 *   season: 'san_1',
 *   attackerFactionId,
 *   targetCityId,
 *   proposerPlayerId,
 *   proposalId?,                // 调用方可传入用于审计追踪
 *   serverId?,
 *   transientPolicies?: {       // 11-3 §4 临时政策 · 合并审批/扣费/激活（合意 2026-05-25）
 *     frontAssault?: boolean,
 *     rearAssault?: boolean,
 *     imperialMarch?: boolean,
 *   },
 * }
 *
 * 鉴权（11-3 §7.1 · 2026-05-25 收紧）：提议者 `current_position_id` 必须为
 * **大将军 / 大司空**；势力身份必须与 `attackerFactionId` 一致。不符合 → 403。
 *
 * 返回：
 *   { approval: <审批审计>, war?: <若通过则返回新建草案 pvp war>, draftCreated: bool, transientPoliciesApplied?: object }
 */
router.post('/proposals', validateBody(pvpWarSchemas.proposalsBody), async (req, res, next) => {
  try {
    const {
      season = 'san_1',
      attackerFactionId,
      targetCityId,
      proposerPlayerId,
      proposalId,
      serverId,
      transientPolicies: rawTransientPolicies,
      tributeSilver: rawTributeSilver = 0,
    } = req.body;
    const tributeSilver = normalizeTributeSilver(rawTributeSilver);
    if (tributeSilver == null) {
      throw httpError(400, '上供银两须为 100 的整数倍（0 表示不上供）', 'TRIBUTE_SILVER_INVALID');
    }
    if (!aiKingConfigService.hasKingForFaction(attackerFactionId)) {
      return res.status(400).json({
        success: false,
        error: `该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）：${attackerFactionId}`,
      });
    }

    // 提议者职务校验（11-3 §7.1 · 2026-05-25 · 战事谏言 + 临时政策同步收紧到大将军/大司空）
    const proposerPid = String(proposerPlayerId || '').trim();
    if (!proposerPid) {
      throw httpError(400, '缺少 proposerPlayerId（战事谏言须由具体官员提交）', 'MISSING_PROPOSER');
    }
    const proposerPlayer = await Player.getById(proposerPid);
    if (!proposerPlayer) {
      throw httpError(404, '提议者玩家不存在', 'PROPOSER_NOT_FOUND');
    }
    if (String(proposerPlayer.faction_id || '').trim() !== String(attackerFactionId).trim()) {
      throw httpError(403, '提议者势力身份与发起方不符', 'PROPOSER_FACTION_MISMATCH');
    }
    // 大将军 / 大司空 才可提交战事谏言（同步支配临时政策）
    policyProposerAuth.assertPolicyProposer(proposerPlayer, policyProposerAuth.POLICY_SCOPE.TRANSIENT);

    if (tributeSilver > 0) {
      await remonstranceTributeService.assertPlayerCanAffordTribute(pool, proposerPid, tributeSilver);
    }

    // 规整临时政策 + 业务级合法性预检（后军禁开等 4xx）
    const normalizedPolicies = warPolicyTransientService.normalizeTransientPolicies(rawTransientPolicies);

    const seasonKey = String(season || 'san_1').trim() || 'san_1';
    const tid = String(targetCityId || '').trim();
    const { pvpTargets, pveTargets, pvpExcludedActiveWar } =
      await aiKingActiveDecisionService.collectCandidateTargets(attackerFactionId, seasonKey);

    let proposalKind = null;
    let remonstranceRow = null;
    const pveRow = (pveTargets || []).find((c) => String(c.city_id) === tid);
    const pvpRow = (pvpTargets || []).find((c) => String(c.city_id) === tid);
    const excludedRow = (pvpExcludedActiveWar || []).find((c) => String(c.city_id) === tid);
    if (pveRow) {
      proposalKind = 'pve';
      remonstranceRow = pveRow;
    } else if (pvpRow) {
      proposalKind = 'pvp';
      remonstranceRow = pvpRow;
    } else if (excludedRow) {
      throw httpError(409, '该城已有进行中 PVP 战事，无法重复谏言', 'ACTIVE_PVP_WAR_ON_CITY');
    } else {
      throw httpError(400, '目标城不在当前谏言邻接候选内', 'REMONSTRANCE_TARGET_INVALID');
    }
    if (remonstranceRow._remonstranceMapRangeOk !== true) {
      throw httpError(400, '目标超出战略地图谏言距离', 'REMONSTRANCE_MAP_RANGE');
    }

    if (proposalKind === 'pve') {
      if (warPolicyTransientService.computeTotalFees(normalizedPolicies).breakdown.length > 0) {
        throw httpError(400, '中立城 PVE 战事不支持临时政策', 'PVE_TRANSIENT_POLICY_NOT_ALLOWED');
      }
      const pvePart = await cityService.getActivePveSiegeParticipationForFaction(attackerFactionId, {
        season: seasonKey,
      });
      if (
        Number(pvePart.count) >= cityService.MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION
      ) {
        throw httpError(
          409,
          `贵方势力进行中的中立城 PVE 攻城已达上限（${cityService.MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION}）`,
          'PVE_WAR_CAP',
        );
      }
    }

    const cityCount = await fetchFactionCityCountForKing(attackerFactionId);

    let tributeResult = { tributeSilver: 0, contributionGranted: 0 };
    if (tributeSilver > 0) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        tributeResult = await remonstranceTributeService.applyRemonstranceTributeOnConnection(conn, {
          playerId: proposerPid,
          factionId: attackerFactionId,
          tributeSilver,
        });
        await conn.commit();
      } catch (tributeErr) {
        try {
          await conn.rollback();
        } catch (_) {
          /* ignore */
        }
        throw tributeErr;
      } finally {
        conn.release();
      }
    }

    const approval = passiveApprovalService.resolvePassiveApproval({
      factionId: attackerFactionId,
      proposalType: passiveApprovalService.PROPOSAL_TYPE_WAR,
      proposalId: proposalId || `prop_${attackerFactionId}_${targetCityId}_${Date.now()}`,
      cityCount,
      tributeSilver,
    });

    if (!approval.approved) {
      return res.json({
        success: true,
        data: {
          approval,
          draftCreated: false,
          tribute: tributeResult,
          /** 驳回时回传客户端勾选，便于前端展示「提议未通过」；上供银两已划入势力储备 */
          transientPoliciesProposed: normalizedPolicies,
        },
      });
    }

    const nm = String(proposerPlayer.character_name || '').trim();
    const proposer = { kind: 'player', playerId: proposerPid, displayName: nm || proposerPid };

    if (proposalKind === 'pve') {
      try {
        const opened = await cityService.openPveWarOnNeutralCity(tid, {
          openedByCharacterId: proposerPlayer.character_id || null,
          bulletinFactionId: attackerFactionId,
        });
        return res.json({
          success: true,
          data: {
            approval,
            draftCreated: true,
            proposalKind: 'pve',
            pveWar: opened,
            warId: opened.warId,
            proposerPlayerId,
            tribute: tributeResult,
          },
        });
      } catch (createErr) {
        const code = createErr.status || createErr.statusCode || 409;
        return res.status(code).json({
          success: false,
          error: createErr.publicMessage || createErr.message,
          code: createErr.code || undefined,
          approval,
        });
      }
    }

    let war = null;
    try {
      war = await pvpWarService.createPvpWarDraftAndActivate({
        season: seasonKey,
        attackerFactionId,
        targetCityId: tid,
        serverId,
        proposer,
        transientPolicies: normalizedPolicies,
      });
    } catch (createErr) {
      // 储备不足 / 后军禁开 等业务级错误已经是 4xx — 透传 status；其它走 409 兜底
      const code = createErr.status || createErr.statusCode || 409;
      return res.status(code).json({
        success: false,
        error: createErr.publicMessage || createErr.message,
        code: createErr.code || undefined,
        approval,
      });
    }

    return res.json({
      success: true,
      data: {
        approval,
        draftCreated: true,
        proposalKind: 'pvp',
        war,
        proposerPlayerId,
        transientPoliciesApplied: normalizedPolicies,
        tribute: tributeResult,
      },
    });
  } catch (error) {
    return next(wrap500(error, '提交战事提案失败'));
  }
});

// ==================== 列表 / 详情 ====================

/**
 * GET /api/pvp-wars?status=active|pending|completed|failed|cancelled&factionId=...&season=...&limit=...
 */
router.get('/', validateQuery(pvpWarSchemas.listWarsQuery), async (req, res, next) => {
  try {
    const { status, factionId, season, limit } = req.query;
    const wars = await WarPvp.listWars({
      status: status ? String(status).split(',').filter(Boolean) : undefined,
      factionId: factionId || undefined,
      season: season || undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, wars, count: wars.length });
  } catch (error) {
    return next(wrap500(error, '获取战事列表失败'));
  }
});

/**
 * GET /api/pvp-wars/by-city/:cityId/active
 */
router.get('/by-city/:cityId/active', validateParams(pvpWarSchemas.cityIdParam), async (req, res, next) => {
  try {
    const war = await WarPvp.getActiveByCity(req.params.cityId);
    res.json({ success: true, data: war || null });
  } catch (error) {
    return next(wrap500(error, '查询城市当前 PVP 战事失败'));
  }
});

/**
 * GET /api/pvp-wars/king-recent-decision?factionId=...
 *
 * 必须注册在 `GET /:id` **之前**，否则 `king-recent-decision` 会被当成战事 id 查库 → 404。
 * 给「君主口谕」前端拉势力君主最近一次主动决策动向（内存留痕，TTL 60 分钟）。
 * 无任何最近动向时返回 `data: null`，前端 fallback 到闲聊池。
 */
router.get('/king-recent-decision', validateQuery(pvpWarSchemas.factionIdQuery), async (req, res, next) => {
  try {
    const { factionId } = req.query;
    if (!aiKingConfigService.hasKingForFaction(String(factionId))) {
      return res.json({ success: true, data: null });
    }
    const last = aiKingActiveDecisionService.getRecentDecision(String(factionId));
    res.json({ success: true, data: last || null });
  } catch (error) {
    return next(wrap500(error, '获取君主最近动向失败'));
  }
});

function formatRemonstranceCityRow(r) {
  if (!r) return null;
  return {
    cityId: r.city_id,
    cityName: r.city_name || null,
    cityType: r.city_type || null,
    junId: r.jun_id || null,
    defenderFactionId: r.faction_id || null,
    inMapWarRemonstranceRange: r._remonstranceMapRangeOk === true,
    activePvpWarId: r._activePvpWarId || null,
  };
}

/**
 * GET /api/pvp-wars/remonstrance-panel?factionId=...&season=san_1
 *
 * 三公府 · 势力战事：与 `aiKingActiveDecisionService.collectCandidateTargets` 同口径的可谏言目标（PVP/PVE），
 * 及当前势力战事并行上限、战事类被动审批预览。须登录且 `factionId` 与当前角色一致。
 * `season`（可选，默认 `san_1`）：计 **PVE 进行中条数** 时仅统计 **目标城** 属该赛季的 `wars`，与 `listActivePveSiegeTargetsForMap` / 大地图 active PVE 列表一致。
 */
router.get('/remonstrance-panel', validateQuery(pvpWarSchemas.remonstrancePanelQuery), async (req, res, next) => {
  try {
    const factionId = String(req.query.factionId).trim();
    const accountId = req.player?.sub;
    if (!accountId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    const playerRow = await Player.getById(String(accountId));
    if (!playerRow || String(playerRow.faction_id || '').trim() !== factionId) {
      return res.status(403).json({ success: false, error: '势力与当前角色不符' });
    }
    if (!aiKingConfigService.hasKingForFaction(factionId)) {
      return res.status(404).json({ success: false, error: '该势力暂未配置 AI 君主' });
    }
    const season = String(req.query.season || '').trim() || 'san_1';
    const { pvpTargets, pveTargets, pvpExcludedActiveWar } =
      await aiKingActiveDecisionService.collectCandidateTargets(factionId, season);
    const cityCount = await fetchFactionCityCountForKing(factionId);
    const approvalPreview = passiveApprovalService.previewApprovalRange({
      factionId,
      proposalType: passiveApprovalService.PROPOSAL_TYPE_WAR,
      cityCount,
    });
    const pvpCount = await WarPvp.countActiveOrPendingByAttackerFaction(factionId);
    const pvePart = await cityService.getActivePveSiegeParticipationForFaction(factionId, { season });
    const pveCount = Number(pvePart.count) || 0;
    const maxPvp = pvpWarService.MAX_CONCURRENT_PVP_WARS_PER_ATTACKER_FACTION;
    const maxPve = cityService.MAX_CONCURRENT_PVE_WARS_PER_ATTACKER_FACTION;

    const factionReserveService = require('../services/factionReserveService');
    const poolBal = await factionReserveService.getPoolBalance(pool, factionId);
    const reserves = {
      silver: poolBal?.silver ?? 0,
      food: poolBal?.food ?? 0,
    };
    const gameTime = await gameTimeService.loadGameTimeForPlayer(String(accountId));
    const proposalCost = warInitiationCostService.buildProposalCostPanelPayload(gameTime, reserves);
    const transientPolicyFees = {
      frontAssault: warPolicyTransientService.POLICY_FEES.frontAssault,
      rearAssault: warPolicyTransientService.POLICY_FEES.rearAssault,
      imperialMarch: warPolicyTransientService.POLICY_FEES.imperialMarch,
    };

    res.json({
      success: true,
      data: {
        pvpTargets: (pvpTargets || []).map(formatRemonstranceCityRow).filter(Boolean),
        pveTargets: (pveTargets || []).map(formatRemonstranceCityRow).filter(Boolean),
        pvpExcludedActiveWar: (pvpExcludedActiveWar || []).map(formatRemonstranceCityRow).filter(Boolean),
        transientPolicyFees,
        warLimits: {
          pvpActiveOrPending: pvpCount,
          pvpMax: maxPvp,
          pveActiveParticipations: pveCount,
          pveMax: maxPve,
          atPvpCap: Number(pvpCount) >= maxPvp,
          atPveCap: pveCount >= maxPve,
          pveActiveWars: pvePart.wars || [],
        },
        approvalPreview,
        proposalCost,
      },
    });
  } catch (error) {
    return next(wrap500(error, '获取谏言面板失败'));
  }
});

/**
 * GET /api/pvp-wars/:id
 */
router.get('/:id', validateParams(pvpWarSchemas.warIdParam), async (req, res, next) => {
  try {
    const war = await WarPvp.getById(req.params.id);
    if (!war) return res.status(404).json({ success: false, error: '战事不存在' });
    res.json({ success: true, data: war });
  } catch (error) {
    return next(wrap500(error, '获取战事详情失败'));
  }
});

/**
 * GET /api/pvp-wars/:id/phase
 *
 * 单点查阶段（11-3 §5 实装段3）：返回当前阶段标签 + T0/T1/midArmyAt/tEnd/rearWindow +
 * 玩家是否允许攻城 + 临时政策开关。供前端战事浮层、阶段提示、玩家攻城按钮置灰使用。
 *
 * 若该场战事没有 `wars_pvp_policies` 行（未勾选任何临时政策），返回 `phase=mid_army`、
 * `playerSiegeAllowed=true`、`policies=null` — 与现行无阶段机口径兼容。
 */
router.get('/:id/phase', validateParams(pvpWarSchemas.warIdParam), async (req, res, next) => {
  try {
    const war = await WarPvp.getById(req.params.id);
    if (!war) return res.status(404).json({ success: false, error: '战事不存在' });
    const warPhaseService = require('../services/warPhaseService');
    const policiesRow = await warPolicyTransientService.getPoliciesForWar(req.params.id);
    if (!policiesRow) {
      // 兼容：无临时政策时不启用阶段机
      return res.json({
        success: true,
        data: {
          pvpWarId: war.pvpWarId,
          status: war.status,
          phase: war.status === 'active' ? warPhaseService.PHASE.MID_ARMY : warPhaseService.PHASE.NOT_ACTIVE,
          playerSiegeAllowed: war.status === 'active',
          policies: null,
        },
      });
    }
    const snap = warPhaseService.getPhaseSnapshot(war, policiesRow);
    res.json({
      success: true,
      data: {
        pvpWarId: war.pvpWarId,
        status: war.status,
        phase: snap.phase,
        t0: snap.t0 || null,
        t1: snap.t1 || null,
        midArmyAt: snap.midArmyAt || null,
        tEnd: snap.tEnd || null,
        rearWindow: snap.rearWindow || null,
        playerSiegeAllowed: snap.playerSiegeAllowed,
        reason: snap.reason || null,
        policies: {
          frontAssault: policiesRow.frontAssault,
          rearAssault: policiesRow.rearAssault,
          imperialMarch: policiesRow.imperialMarch,
          imperialMarchExpiresAt: policiesRow.imperialMarchExpiresAt,
          phaseSnapshotJson: policiesRow.phaseSnapshotJson,
        },
      },
    });
  } catch (error) {
    return next(wrap500(error, '获取战事阶段失败'));
  }
});

// ==================== 大本营生命周期 ====================

/**
 * POST /api/pvp-wars/:id/place-base-camp
 * Body: {} （锚点由算法择一；详见 17-2 §1.6 / 实现计划 §1.5、§12-D）
 */
router.post('/:id/place-base-camp', validateParams(pvpWarSchemas.warIdParam), async (req, res, next) => {
  try {
    const war = await pvpWarService.placeAttackerBaseCampAndActivate(req.params.id);
    res.json({ success: true, data: war });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/pvp-wars/:id/cancel
 * Body: { reason?: string, byAdmin?: bool, endedByOfficial?: bool } —— `endedByOfficial` 为真时写入「一品官职（position_level=1）主持结案」类公告
 */
router.post(
  '/:id/cancel',
  validateParams(pvpWarSchemas.warIdParam),
  validateBody(pvpWarSchemas.cancelWarBody),
  async (req, res, next) => {
  try {
    const { reason, byAdmin, endedByOfficial } = req.body;
    const war = await pvpWarService.cancelPvpWar(req.params.id, {
      reason,
      byAdmin,
      endedByOfficial: !!endedByOfficial,
    });
    res.json({ success: true, data: war });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  },
);

// ==================== 大本营 NPC 战斗握手 ====================

/**
 * POST /api/pvp-wars/:id/base-camp-siege
 * Body: { playerId }（守方）
 */
router.post(
  '/:id/base-camp-siege',
  validateParams(pvpWarSchemas.warIdParam),
  validateBody(pvpWarSchemas.playerIdBody),
  async (req, res, next) => {
  try {
    const { playerId } = req.body;
    const data = await pvpWarService.initiateBaseCampSiege(req.params.id, playerId);
    res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  },
);

/**
 * POST /api/pvp-wars/:id/base-camp-siege-result
 * Body: { playerId, killedIndices, result, silverSpent?, battleScore?, battleReportSaved? }
 */
router.post(
  '/:id/base-camp-siege-result',
  validateParams(pvpWarSchemas.warIdParam),
  validateBody(pvpWarSchemas.baseCampSiegeResultBody),
  async (req, res, next) => {
  try {
    const { playerId, killedIndices, result, battleScore, silverSpent, battleReportSaved } = req.body;
    const data = await pvpWarService.recordBaseCampSiegeResult(req.params.id, playerId, {
      killedIndices: killedIndices || [],
      result: result || 'win',
      battleScore: battleScore || 0,
      silverSpent: silverSpent || 0,
      battleReportSaved,
    });
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '写入大本营战斗结果失败'));
  }
  },
);

// ==================== 攻方对目标城战斗握手（三类防守者通用） ====================

/**
 * POST /api/pvp-wars/:id/city-siege
 * Body: { playerId }（攻方）
 *
 * 返回：{ defenderType: 'pvp_online'|'player_garrison'|'npc',
 *        npcGarrison: [...], defenderPlayerId?, defenderGarrisonSlot?, npcBatchIndex?, ... }
 */
router.post(
  '/:id/city-siege',
  validateParams(pvpWarSchemas.warIdParam),
  validateBody(pvpWarSchemas.playerIdBody),
  async (req, res, next) => {
  try {
    const { playerId } = req.body;
    const data = await pvpWarService.initiateAttackerCitySiege(req.params.id, playerId);
    res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  },
);

/**
 * POST /api/pvp-wars/:id/city-siege-result
 * Body: {
 *   playerId,
 *   defenderType: 'pvp_online'|'player_garrison'|'npc',
 *   defenderPlayerId?, defenderGarrisonSlot?,         // 玩家防守者分支
 *   garrisonUnits?, defenderLineupTroopUpdates?,      // 玩家防守者分支
 *   killedIndices, result, silverSpent?,
 *   battleScore?, battleReportSaved?,
 *   npcBatchIndex?,                                   // NPC 分支
 * }
 */
router.post(
  '/:id/city-siege-result',
  validateParams(pvpWarSchemas.warIdParam),
  validateBody(pvpWarSchemas.citySiegeResultBody),
  async (req, res, next) => {
  try {
    const {
      playerId,
      defenderType,
      defenderPlayerId,
      defenderGarrisonSlot,
      garrisonUnits,
      defenderLineupTroopUpdates,
      killedIndices,
      result,
      silverSpent,
      battleScore,
      battleReportSaved,
      npcBatchIndex,
    } = req.body;
    const data = await pvpWarService.recordAttackerCitySiegeResult(req.params.id, playerId, {
      defenderType: defenderType || 'npc',
      defenderPlayerId: defenderPlayerId || null,
      defenderGarrisonSlot: defenderGarrisonSlot ?? null,
      garrisonUnits: Array.isArray(garrisonUnits) ? garrisonUnits : [],
      defenderLineupTroopUpdates: Array.isArray(defenderLineupTroopUpdates)
        ? defenderLineupTroopUpdates
        : null,
      killedIndices: Array.isArray(killedIndices) ? killedIndices : [],
      result: result || 'win',
      silverSpent: Number(silverSpent) || 0,
      battleScore,
      battleReportSaved,
      npcBatchIndex,
    });
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '写入目标城战斗结果失败'));
  }
  },
);

/**
 * POST /api/pvp-wars/tick
 * 调试入口（实际由 server.js cron 自动跑）。
 */
router.post('/tick', async (req, res, next) => {
  try {
    const data = await pvpWarService.tickActivePvpWars();
    res.json({ success: true, data });
  } catch (error) {
    return next(wrap500(error, '战事 tick 失败'));
  }
});

/**
 * POST /api/pvp-wars/active-decision-dry-run
 * 调试 / dev：手动触发一次 AI 君主主动决策（不真调写库）。
 * Body: { factionId }
 */
router.post('/active-decision-dry-run', validateBody(pvpWarSchemas.factionIdBody), async (req, res, next) => {
  try {
    const { factionId } = req.body;
    if (!aiKingConfigService.hasKingForFaction(factionId)) {
      return res
        .status(404)
        .json({ success: false, error: '该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）' });
    }
    const result = await aiKingActiveDecisionService.decide({
      factionId,
      dryRun: true,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    return next(wrap500(error, '主动决策 dry-run 失败'));
  }
});

module.exports = router;
