/**
 * usePollingFetch - 通用轮询 fetch hook（基础设施级）
 *
 * @description
 *   把"周期性调用一个异步函数 + 在组件卸载时停下 + race 安全"这一**重复模板**抽成共享 hook。
 *
 *   **设计原则**：仅做"机制"，不替业务做决策；调用方自行从 `data` 拼业务状态、自行决定何时
 *   `pause`。具体业务流程（PVP 静默 challengeId / 攻城裁定时序等）应继续走**专用 hook**
 *   （`usePvpDefenseAlertPoll` 等），由专用 hook 内部使用 `usePollingFetch` 而**不是**直接 `setInterval`。
 *
 * @example
 *   const { data, error, refetch } = usePollingFetch(
 *     () => playerAPI.fetchPendingPvpDefense(playerId),
 *     3000,
 *     { enabled: !!playerId },
 *   );
 *
 * @param {() => Promise<any>} fetchFn 单次轮询动作；返回 Promise（或值）
 * @param {number} intervalMs 周期；`<= 0` 等价于禁用
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] false 时不启动 / 不调用 fetchFn
 * @param {boolean} [options.runImmediately=true] true 时挂载 / enabled 切开后立刻发一次；false 等一个 interval
 * @param {boolean} [options.pauseOnHidden=false] true 时 `document.hidden` 切到隐藏后暂停 ticker，可见后立刻补一次
 * @returns {{ data: any, error: Error|null, refetch: () => Promise<void> }}
 *
 * @module hooks/usePollingFetch
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function usePollingFetch(fetchFn, intervalMs, options = {}) {
  const {
    enabled = true,
    runImmediately = true,
    pauseOnHidden = false,
  } = options;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // 用 ref 持有最新的 fetchFn，避免每次重渲染都重启 interval（与 React Query 的 stable callback 同思路）
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const stoppedRef = useRef(false);

  const tick = useCallback(async () => {
    if (stoppedRef.current) return;
    try {
      const result = await fetchFnRef.current();
      if (!stoppedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (!stoppedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !Number.isFinite(intervalMs) || intervalMs <= 0) {
      return undefined;
    }
    stoppedRef.current = false;
    let timer = null;

    const start = () => {
      if (timer) return;
      if (runImmediately) tick();
      timer = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (pauseOnHidden) {
      const onVisChange = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener('visibilitychange', onVisChange);
      if (!document.hidden) start();
      return () => {
        stoppedRef.current = true;
        document.removeEventListener('visibilitychange', onVisChange);
        stop();
      };
    }

    start();
    return () => {
      stoppedRef.current = true;
      stop();
    };
  }, [enabled, intervalMs, runImmediately, pauseOnHidden, tick]);

  // 调用方需要"立刻刷一次"时（如用户点刷新按钮）
  const refetch = useCallback(async () => {
    stoppedRef.current = false;
    await tick();
  }, [tick]);

  return { data, error, refetch };
}

export default usePollingFetch;
