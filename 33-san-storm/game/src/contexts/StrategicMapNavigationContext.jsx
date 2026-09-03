import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

const StrategicMapNavigationContext = createContext(null);

/**
 * 战略大地图：由 `WorldStrategicMapGrid` 注册
 * - `scrollToStrategicCell(gx,gy)` 视口滚动（格居中）
 * - `resolveStrategicAnchorForCityId(cityId)` 从当前格网解析锚点
 * - `queueScrollToCityId` / peek / clear：Tab 外发起「定位某城」
 * - 视口框：`getStrategicViewport` / `setStrategicViewportTopLeft` / `subscribeStrategicViewport`
 */
export function StrategicMapNavigationProvider({ children }) {
  const handlerRef = useRef(null);
  const resolveAnchorRef = useRef(null);
  const pendingCityScrollRef = useRef(null);
  const viewportApiRef = useRef(null);
  const viewportListenersRef = useRef(new Set());

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

  const notifyStrategicViewportChanged = useCallback(() => {
    for (const listener of viewportListenersRef.current) {
      try {
        listener();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const registerStrategicViewportApi = useCallback(
    (api) => {
      viewportApiRef.current = api;
      notifyStrategicViewportChanged();
      return () => {
        if (viewportApiRef.current === api) viewportApiRef.current = null;
        notifyStrategicViewportChanged();
      };
    },
    [notifyStrategicViewportChanged],
  );

  const getStrategicViewport = useCallback(() => {
    const api = viewportApiRef.current;
    if (!api || typeof api.getViewport !== 'function') return null;
    return api.getViewport();
  }, []);

  const setStrategicViewportTopLeft = useCallback(
    (gx, gy) => {
      const api = viewportApiRef.current;
      if (!api || typeof api.setViewportTopLeft !== 'function') return;
      api.setViewportTopLeft(gx, gy);
      notifyStrategicViewportChanged();
    },
    [notifyStrategicViewportChanged],
  );

  const getStrategicMapSize = useCallback(() => {
    const api = viewportApiRef.current;
    if (!api || typeof api.getMapSize !== 'function') return null;
    return api.getMapSize();
  }, []);

  const subscribeStrategicViewport = useCallback((listener) => {
    if (typeof listener !== 'function') return () => {};
    viewportListenersRef.current.add(listener);
    return () => {
      viewportListenersRef.current.delete(listener);
    };
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
      registerStrategicViewportApi,
      getStrategicViewport,
      setStrategicViewportTopLeft,
      getStrategicMapSize,
      subscribeStrategicViewport,
      notifyStrategicViewportChanged,
    }),
    [
      registerScrollToStrategicCell,
      registerResolveStrategicAnchorForCityId,
      scrollToStrategicCell,
      resolveStrategicAnchorForCityId,
      queueScrollToCityId,
      peekPendingScrollToCityId,
      clearPendingScrollToCityId,
      registerStrategicViewportApi,
      getStrategicViewport,
      setStrategicViewportTopLeft,
      getStrategicMapSize,
      subscribeStrategicViewport,
      notifyStrategicViewportChanged,
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
