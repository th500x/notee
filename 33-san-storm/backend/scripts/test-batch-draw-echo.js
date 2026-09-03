/**
 * 本地验证十连遇残影仍跑满 12 次（需本窗额度 0、无 pending echo）
 */
const cardPoolService = require('../services/cardPoolService');

(async () => {
  const statusBefore = await cardPoolService.getPoolStatus('11JQ');
  console.log('before:', {
    charRemaining: statusBefore.character?.remainingDraws,
    charPity: statusBefore.character?.pityCount,
    pending: statusBefore.pendingEchoChoice,
  });

  if (statusBefore.pendingEchoChoice?.pendingEchoDrawId) {
    console.error('SKIP: 仍有 pending echo，请先处理或 reset');
    process.exit(1);
  }
  if ((statusBefore.character?.remainingDraws ?? 0) < 10) {
    console.error('SKIP: 本窗额度不足，请先 node scripts/reset-card-pool-quota-11jq.js');
    process.exit(1);
  }

  const res = await cardPoolService.drawFromPool('11JQ', 'character', {
    poolSeason: 'san_1',
    drawMode: 'batch',
  });

  console.log('draw result:', {
    success: res.success,
    drawMode: res.drawMode,
    cardCount: res.cards?.length,
    pityCount: res.pityCount,
    echoQueueLen: res.echoQueue?.length ?? 0,
    batchDrawOperations: res.batchDrawOperations,
  });
  if (res.cards) {
    res.cards.forEach((c, i) => {
      console.log(
        `#${i + 1}`,
        c.cardName || c.cardId || '(comp)',
        c.rarity,
        c.echoChoiceRequired ? 'ECHO' : '',
      );
    });
  }

  process.exit(0);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
