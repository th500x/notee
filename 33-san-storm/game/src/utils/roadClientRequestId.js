/**
 * 道路写操作 clientRequestId：在「打开确认框 / 拦截面板」时生成一次，提交与重试复用，避免连点换 id 导致重复扣费。
 */
export function createRoadClientRequestId(kind = 'road') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
