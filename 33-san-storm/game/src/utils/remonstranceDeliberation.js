/** 政策/战事谏言：禀报君主动画最短展示时长（ms） */
export const REMONSTRANCE_DELIBERATION_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 等待 API 完成且不少于 `minMs`（默认 1s 仪式动画，与教程官职浮层一致）。
 *
 * @param {Promise<T>} promise
 * @param {number} [minMs]
 * @returns {Promise<{ result: T, elapsedMs: number }>}
 * @template T
 */
export async function awaitWithMinDuration(promise, minMs = REMONSTRANCE_DELIBERATION_MS) {
  const started = Date.now();
  try {
    const result = await promise;
    const elapsed = Date.now() - started;
    if (elapsed < minMs) {
      await sleep(minMs - elapsed);
    }
    return { result, elapsedMs: Math.max(elapsed, minMs) };
  } catch (err) {
    const elapsed = Date.now() - started;
    if (elapsed < minMs) {
      await sleep(minMs - elapsed);
    }
    throw err;
  }
}
