/**
 * 探索开链兵符：与匪寨/攻城同源 `item_tactic_token`。
 * 仅 wild/mini 新开链（非 continueChain、非 tutorial）扣 1；关面板未选选项可退还。
 */

const tacticTokenService = require('./tacticTokenService');

const TACTIC_TOKEN_COST_PER_EXPLORE_CHAIN = 1;

/**
 * @param {string} playerId
 * @param {{ continueChain?: boolean, triggerContext?: string|null }} [opts]
 * @returns {Promise<{ ok: true, skipped?: boolean, remaining: number } | { ok: false, status: number, error: string }>}
 */
async function consumeExploreChainStart(playerId, opts = {}) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少玩家' };

  const ctx = String(opts.triggerContext || '').trim();
  if (ctx === 'tutorial') {
    const remaining = await tacticTokenService.getTacticTokenCount(pid);
    return { ok: true, skipped: true, remaining };
  }
  if (opts.continueChain === true) {
    const remaining = await tacticTokenService.getTacticTokenCount(pid);
    return { ok: true, skipped: true, remaining };
  }

  const charged = await tacticTokenService.tryConsumeTacticTokenOnce(
    pid,
    null,
    TACTIC_TOKEN_COST_PER_EXPLORE_CHAIN
  );
  if (!charged) {
    return { ok: false, status: 400, error: '兵符不足' };
  }
  const remaining = await tacticTokenService.getTacticTokenCount(pid);
  return { ok: true, remaining };
}

/**
 * @param {string} playerId
 * @returns {Promise<{ ok: true, remaining: number }>}
 */
async function refundExploreChainStart(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: true, remaining: 0 };
  await tacticTokenService.refundTacticTokenOnce(pid, null, TACTIC_TOKEN_COST_PER_EXPLORE_CHAIN);
  const remaining = await tacticTokenService.getTacticTokenCount(pid);
  return { ok: true, remaining };
}

/**
 * @param {string} playerId
 * @returns {Promise<{ remaining: number, costPerChain: number, costItemId: string }>}
 */
async function getExploreChainTokenState(playerId) {
  const remaining = await tacticTokenService.getTacticTokenCount(playerId);
  return {
    remaining,
    costPerChain: TACTIC_TOKEN_COST_PER_EXPLORE_CHAIN,
    costItemId: tacticTokenService.TACTIC_TOKEN_ITEM_ID,
  };
}

module.exports = {
  TACTIC_TOKEN_COST_PER_EXPLORE_CHAIN,
  consumeExploreChainStart,
  refundExploreChainStart,
  getExploreChainTokenState,
};
