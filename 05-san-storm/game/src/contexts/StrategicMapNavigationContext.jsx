import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const StrategicMapNavigationContext = createContext(null);

/**
 * 战略大地图：由 `WorldStrategicMapGrid` 注册滚动实现，上层（如州郡跳转）调用 `scrollToStrategicCell`。
 */
export function StrategicMapNavigationProvider({ children }) {
  const handlerRef = useRef(null);

  const registerScrollToStrategicCell = useCallback((fn) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const scrollToStrategicCell = useCallback((gx, gy) => {
    const fn = handlerRef.current;
    if (typeof fn === 'function') fn(gx, gy);
  }, []);

  const value = useMemo(
    () => ({ registerScrollToStrategicCell, scrollToStrategicCell }),
    [registerScrollToStrategicCell, scrollToStrategicCell],
  );

  return (
    <StrategicMapNavigationContext.Provider value={value}>{children}</StrategicMapNavigationContext.Provider>
  );
}

export function useStrategicMapNavigation() {
  const ctx = useContext(StrategicMapNavigationContext);
  return ctx;
}
