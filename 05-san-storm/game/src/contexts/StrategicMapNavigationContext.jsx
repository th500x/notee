import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const StrategicMapNavigationContext = createContext(null);

/**
 * 战略大地图：由 `WorldStrategicMapGrid` 注册
 * - `scrollToStrategicCell(gx,gy)` 视口滚动
 * - `resolveStrategicAnchorForCityId(cityId)` 从当前格网解析锚点（库中 position 为空时州郡跳转用）
 */
export function StrategicMapNavigationProvider({ children }) {
  const handlerRef = useRef(null);
  const resolveAnchorRef = useRef(null);

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

  const value = useMemo(
    () => ({
      registerScrollToStrategicCell,
      registerResolveStrategicAnchorForCityId,
      scrollToStrategicCell,
      resolveStrategicAnchorForCityId,
    }),
    [registerScrollToStrategicCell, registerResolveStrategicAnchorForCityId, scrollToStrategicCell, resolveStrategicAnchorForCityId],
  );

  return (
    <StrategicMapNavigationContext.Provider value={value}>{children}</StrategicMapNavigationContext.Provider>
  );
}

export function useStrategicMapNavigation() {
  const ctx = useContext(StrategicMapNavigationContext);
  return ctx;
}
