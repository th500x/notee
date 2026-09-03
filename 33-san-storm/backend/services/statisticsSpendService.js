/**

 * @deprecated 请优先使用 `statisticsDeltaService`（`applyResourceDelta` / `recordEarned` / `incrementSpent`）。

 * 保留本模块仅为兼容既有 `require('./statisticsSpendService')`。

 */

const { incrementSpent } = require('./statisticsDeltaService');



module.exports = {

  incrementSpent,

};

