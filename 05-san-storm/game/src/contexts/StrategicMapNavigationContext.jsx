import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const StrategicMapNavigationContext = createContext(null);

/**
 * 战略大地图：由 `WorldStrategicMapGrid` 注册
 * - `scrollToStrategicCell(gx,gy)` 视口滚动
 * - `resolveStrategicAnchorForCityId(cityId)` 从当前格网解析锚点（库中 position 为空时州郡跳转用）
 * - `queueScrollToCityId(cityId)` / `peekPendingScrollToCityId` / `clearPendingScrollToCityId`：Tab 外发起「定位某城」时暂存，地图挂载后消费
 */
export function StrategicMapNavigationProvider({ children }) {
  const handlerRef = useRef(null);
  const resolveAnchorRef = useRef(null);
  const pendingCityScrollRef = useRef(null);

  const registerScrollToStrategicCell = useCallback((fn) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const registerResolveStrategicAnchorForCityId = useCallback((fn) => {
    resolveAnchorRef.current = fn;
    return () => {
      if (resolveAnchorRef.current === fn) resolveAnchorRef.current = null;
    };
  }, []);

  const scrollToStrategicCell = useCallback((gx, gy) => {
    const fn = handlerRef.current;
    if (typeof fn === 'function') fn(gx, gy);
  }, []);

  const resolveStrategicAnchorForCityId = useCallback((cityId) => {
    const fn = resolveAnchorRef.current;
    if (typeof fn !== 'function' || cityId == null || String(cityId).trim() === '') return null;
    return fn(String(cityId));
  }, []);

  const queueScrollToCityId = useCallback((cityId) => {
    const id = cityId != null ? String(cityId).trim() : '';
    if (!id) return;
    pendingCityScrollRef.current = id;
  }, []);

  const peekPendingScrollToCityId = useCallback(() => {
    const id = pendingCityScrollRef.current;
    return id != null && String(id).trim() !== '' ? String(id).trim() : null;
  }, []);

  const clearPendingScrollToCityId = useCallback(() => {
    pendingCityScrollRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      registerScrollToStrategicCell,
      registerResolveStrategicAnchorForCityId,
      scrollToStrategicCell,
      resolveStrategicAnchorForCityId,
      queueScrollToCityId,
      peekPendingScrollToCityId,
      clearPendingScrollToCityId,
    }),
    [
      registerScrollToStrategicCell,
      registerResolveStrategicAnchorForCityId,
      scrollToStrategicCell,
      resolveStrategicAnchorForCityId,
      queueScrollToCityId,
      peekPendingScrollToCityId,
      clearPendingScrollToCityId,
    ],
  );

  return (
    <StrategicMapNavigationContext.Provider value={value}>{children}</StrategicMapNavigationContext.Provider>
  );
}

export function useStrategicMapNavigation() {
  const ctx = useContext(StrategicMapNavigationContext);
  return ctx;
}
