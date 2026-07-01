/**
 * AI 玩家封赏抽卡（42-1 §5.1 / 42-2 Step 5）
 *
 * 走真人**同一条** `cardPoolService.drawFromPool`：扣 `players.silver`、写 `player_cards` /
 * 抽卡记录、入势力储备、保底与残影逻辑**原样执行**，不复制第二套抽卡实现。
 *
 * MVP 行为：对将领 / 部队池各自**单抽**到「本半天窗额度用尽」或「银两不足」为止
 * （`drawFromPool` 到达上限/银两不足时抛错，即本循环的正常终止条件）。
 *
 * 残影（重复将领三选一）：机制为对**已持有**将领的重复卡做 `attack`/`defense`/`convert`
 * （往残影槽加成或转化补偿，**非**「在三名未持有将领里挑一个」）。
 * **策略（用户 2026-06-30 确认）**：优先填**攻击残影槽**至 2/2，满后再 `convert`。
 *
 * @module services/aiPlayerGachaService
 */

const cardPoolService = require('./cardPoolService');

const LOG = '[aiPlayer][gacha]';

/**
 * 残影三选一策略：残影槽未满 → `attack`（填槽加成）；已满 → `convert`（转化补偿）。
 * @param {{ canAttack?: boolean, poolSlotsUsed?: number, poolSlotsMax?: number }|null|undefined} echoState
 *        来自 `drawFromPool` 返回的 `echoState`（`buildEchoState`）。
 * @returns {'attack'|'convert'}
 */
function chooseEchoChoice(echoState) {
  return echoState && echoState.canAttack ? 'attack' : 'convert';
}

/** 防御性上限：单池循环硬上限，避免异常时空转（远大于半天窗额度）。 */
const MAX_DRAWS_PER_POOL = 50;

/**
 * 对单个卡池单抽到额度/银两用尽。
 * @param {string} playerId
 * @param {'character'|'troop'} poolType
 * @returns {Promise<{ poolType:string, draws:number, stopReason:string, remainingSilver:number|null }>}
 */
async function drainPool(playerId, poolType) {
  const poolSeason = poolType === 'character' ? 'san_1' : null;
  let draws = 0;
  let stopReason = 'max_iter';
  let remainingSilver = null;

  for (let i = 0; i < MAX_DRAWS_PER_POOL; i++) {
    let res;
    try {
      res = await cardPoolService.drawFromPool(playerId, poolType, {
        drawMode: 'single',
        poolSeason,
      });
    } catch (e) {
      // 正常终止：额度用尽 / 银两不足；其余视为异常但仍停止本池
      stopReason = e.message || 'draw_error';
      break;
    }
    draws += 1;
    remainingSilver = res.remainingSilver ?? remainingSilver;

    // 将领重复 → 必须先处理残影三选一，否则下次抽卡会被后端拦截
    if (res.echoChoiceRequired && res.pendingEchoDrawId) {
      const choice = chooseEchoChoice(res.echoState);
      try {
        await cardPoolService.resolveEchoChoice(playerId, res.pendingEchoDrawId, choice);
      } catch (e) {
        // 残影槽已满（422）兜回 convert（保底，避免阻断后续抽卡）；其余视为异常停本池
        if (choice !== 'convert' && Number(e.statusCode) === 422) {
          try {
            await cardPoolService.resolveEchoChoice(playerId, res.pendingEchoDrawId, 'convert');
          } catch (e2) {
            console.error(
              `${LOG} resolveEchoChoice convert 兜底失败 player=${playerId} drawId=${res.pendingEchoDrawId}: ${e2.message}`,
            );
            stopReason = `echo_resolve_failed:${e2.message}`;
            break;
          }
        } else {
          console.error(
            `${LOG} resolveEchoChoice 失败 player=${playerId} drawId=${res.pendingEchoDrawId} choice=${choice}: ${e.message}`,
          );
          stopReason = `echo_resolve_failed:${e.message}`;
          break;
        }
      }
    }

    if ((res.remainingDraws ?? 0) <= 0) {
      stopReason = 'window_exhausted';
      break;
    }
  }

  return { poolType, draws, stopReason, remainingSilver };
}

/**
 * 让一个 AI 玩家把当前半天窗的封赏抽卡额度尽量消耗掉。
 *
 * @param {string} playerId
 * @param {{ poolTypes?: Array<'character'|'troop'> }} [opts]
 * @returns {Promise<{ ok:true, playerId:string, pools:Array<{poolType:string,draws:number,stopReason:string,remainingSilver:number|null}>, totalDraws:number }>}
 */
async function runAiGacha(playerId, { poolTypes = ['troop', 'character'] } = {}) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, error: '缺少 playerId' };

  const pools = [];
  for (const poolType of poolTypes) {
    // eslint-disable-next-line no-await-in-loop
    const r = await drainPool(pid, poolType);
    pools.push(r);
  }
  const totalDraws = pools.reduce((s, p) => s + p.draws, 0);
  return { ok: true, playerId: pid, pools, totalDraws };
}

module.exports = {
  chooseEchoChoice,
  MAX_DRAWS_PER_POOL,
  drainPool,
  runAiGacha,
};
