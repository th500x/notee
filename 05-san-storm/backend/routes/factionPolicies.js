/**
 * 势力政策 API（11-3 实装段1 · 长效政策）
 *
 * @see 11-3-FACTION_POLICY_SYSTEM.md §7
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateQuery } = require('../middleware/validation');
const factionPolicySchemas = require('../middleware/validationSchemas/factionPolicies');
const Player = require('../models/Player');
const factionPolicyService = require('../services/factionPolicyService');
const policyProposerAuth = require('../services/policyProposerAuth');
const aiKingConfigService = require('../services/aiKingConfigService');

router.use(requireAuth);

router.get('/panel', validateQuery(factionPolicySchemas.panelQuery), async (req, res, next) => {
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
      return res.status(404).json({
        success: false,
        error: '该势力暂未配置 AI 君主（M2 仅汉室/黄巾/刘备）',
      });
    }

    const data = await factionPolicyService.getPanelForFaction(factionId);

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

router.post(
  '/proposals/long-term',
  validateBody(factionPolicySchemas.longTermProposalBody),
  async (req, res, next) => {
    try {
      const { factionId, category, config, proposalId } = req.body;
      const accountId = req.player?.sub;
      if (!accountId) {
        return res.status(401).json({ success: false, error: '未登录' });
      }
      const playerRow = await Player.getById(String(accountId));
      if (!playerRow || String(playerRow.faction_id || '').trim() !== factionId) {
        return res.status(403).json({ success: false, error: '势力与当前角色不符' });
      }
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
        return next(error);
      }
      return next(wrap500(error, '提交势力政策提案失败'));
    }
  },
);

module.exports = router;
