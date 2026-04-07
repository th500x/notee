/**
 * 「开战」与 battleTroops 提交的时序约定（事件战 / 战役战统一说明）
 *
 * `useBattleEngine` 里的 `playBattleRound` → `executeSingleRound` 闭包捕获的是**渲染当时**的
 * `battleTroops`。事件战 / 攻城在玩家点「开始战斗」**之前**不会再改部队坐标（init 里已写好），
 * 因此直接 `playBattleRoundRef.current()` 即可，不会踩闭包。
 *
 * 战役战在点「开始战斗」**同一交互内**才把战略格部署写入战术坐标（`setBattleTroops`），若随后
 * 立即调用上一帧的 `playBattleRound`，引擎仍读到**旧坐标**。故必须先 `flushSync` 提交部队，
 * 再在 `queueMicrotask` 里调用**已由 ref 指向的最新** `playBattleRound`。
 *
 * 凡「先改 troops 再开战」的路径都应走本工具；仅开战不改 troops 的路径用 ref 直调即可。
 */

import { flushSync } from 'react-dom';

/**
 * @param {(t: object[]) => void} setBattleTroops — 通常为 `useBattleMap` 的 `setBattleTroops`
 * @param {object[]} nextTroops — 完整下一帧阵容（含更新后的 x/y）
 * @param {{ current: () => void }} playRoundRef — 每渲染同步 `ref.current = engine.playBattleRound`
 * @param {(() => void) | undefined} beforePlay — 在 microtask 前同步执行（如 `toggleBattle`）
 */
export function commitBattleTroopsThenPlayRound(setBattleTroops, nextTroops, playRoundRef, beforePlay) {
  flushSync(() => {
    setBattleTroops(nextTroops);
  });
  if (typeof beforePlay === 'function') beforePlay();
  queueMicrotask(() => {
    const fn = playRoundRef?.current;
    if (import.meta.env.DEV) console.warn('[commitBattleTroopsThenPlayRound] microtask: fn=', typeof fn);
    if (typeof fn === 'function') fn();
  });
}
