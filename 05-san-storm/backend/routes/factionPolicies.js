/**
 * 势力政策 API（11-3 实装段1 · 长效政策）
 *
 * 路径前缀：/api/faction-policies
 *
 * 端点：
 *   GET  /panel?factionId=...                - 朝政「势力政策」面板：四类当前配置 + CD + 审批预览
 *   POST /proposals/long-term                - 长效政策谏言（大司马 / 大司空）→ AI 君主审批 → 通过则 upsert
 *
 * 临时政策（前军/后军/御驾）属实装段3，**不** 在本路由（在 PVP 宣战链中嵌入）。
 *
 * 鉴权：与 pvp-wars 同：顶层 `router.use(requireAuth)`，写操作再校验玩家所属势力 + 官职白名单。
 *
 * @see 11-3-FACTION_POLICY_SYSTEM.md §7
 * @see 11-3-FACTION_POLICY_SYSTEM-IMPLEMENTATION-PLAN.md §6 实装段1
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const Player = require('../models/Player');
const factionPolicyService = require('../services/factionPolicyService');
const policyProposerAuth = require('../services/policyProposerAuth');
const aiKingConfigService = require('../services/aiKingConfigService');

router.use(requireAuth);

/**
 * GET /api/faction-policies/panel?factionId=...
 *
 * 朝政「势力政策」面板：四类当前生效配置 + CD + 审批预览。
 * 须登录；`factionId` 须与当前角色所属势力一致（避免越权窥探他势力运营策略）。
 */
router.get('/panel', async (req, res, next) => {
  try {
    const factionId = String(req.query.factionId || '').trim();
    if (!factionId) {
      return res.status(400).json({ success: false, error: '缺少 factionId' });
    }
    const accountId = req.player?.sub;
    if (!accountId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    const playerRow = await Player.getById(String(accountId));
    if (!playerRow || String(playerRow.faction_id || '').trim() !== factionId) {
      return res.status(403).json({ success: false, error: '势力与当前角色不符' });
    }
    if (!aiKingConfigService.hasKingForFaction(factionId)) {
      return res.status(404).json({
        success: false,
        error: '该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）',
      });
    }

    const data = await factionPolicyService.getPanelForFaction(factionId);

    // 附带「当前玩家是否有谏言权」给前端置灰按钮（不阻塞 panel 拉取本身）
    const currentPositionId = String(playerRow.current_position_id || '').trim();
    const canProposeLongTerm = policyProposerAuth.canProposePolicy(
      currentPositionId,
      policyProposerAuth.POLICY_SCOPE.LONG_TERM,
    );
    const canProposeTransient = policyProposerAuth.canProposePolicy(
      currentPositionId,
      policyProposerAuth.POLICY_SCOPE.TRANSIENT,
    );

    res.json({
      success: true,
      data: {
        ...data,
        proposer: {
          playerId: playerRow.player_id,
          currentPositionId: currentPositionId || null,
          currentPositionName: playerRow.current_position_name || null,
          canProposeLongTerm,
          canProposeTransient,
        },
      },
    });
  } catch (error) {
    return next(wrap500(error, '获取势力政策面板失败'));
  }
});

/**
 * POST /api/faction-policies/proposals/long-term
 *
 * Body: {
 *   factionId,
 *   category: 'ration_bonus' | 'siege_reward' | 'recruit' | 'domestic_goal',
 *   config:   <类目对应 schema>,
 *   proposalId?: string,
 * }
 *
 * 返回：{ approval, policy, approved, proposalId }
 *   - approved=true ：`policy.config` 已切换到提案配置，`nextEligibleAt` = now + 24h
 *   - approved=false：`policy.config` 维持旧值（首次则为提案配置占位），`nextEligibleAt` = now + 12h
 */
router.post('/proposals/long-term', async (req, res, next) => {
  try {
    const { factionId, category, config, proposalId } = req.body || {};
    if (!factionId) {
      return res.status(400).json({ success: false, error: '缺少 factionId' });
    }
    const accountId = req.player?.sub;
    if (!accountId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    const playerRow = await Player.getById(String(accountId));
    if (!playerRow || String(playerRow.faction_id || '').trim() !== factionId) {
      return res.status(403).json({ success: false, error: '势力与当前角色不符' });
    }
    // 谏言职务白名单（11-3 §7.1）：长效仅大司马 / 大司空
    policyProposerAuth.assertPolicyProposer(playerRow, policyProposerAuth.POLICY_SCOPE.LONG_TERM);

    const result = await factionPolicyService.submitLongTermProposal({
      factionId,
      category,
      config,
      proposerPlayerId: playerRow.player_id,
      proposalId,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    if (error && error.status && error.status < 500) {
      // 业务级 4xx（含 409 CD / 403 权限 / 400 参数）：交给 errorHandler 透出 publicMessage
      return next(error);
    }
    return next(wrap500(error, '提交势力政策提案失败'));
  }
});

module.exports = router;
