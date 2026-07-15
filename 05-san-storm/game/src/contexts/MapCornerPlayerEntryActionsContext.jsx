import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MapCornerPlayerEntryActionsContext = createContext(null);

/**
 * 矮视口第三列按钮与 `KingEdictPanel` / `StandingRankingsPanel` / `CommPanel` 共用打开逻辑。
 */
export function MapCornerPlayerEntryActionsProvider({ children }) {
  const handlersRef = useRef({
    edict: null,
    rank: null,
    comm: null,
  });
  const [commEntryCaption, setCommEntryCaptionState] = useState('💬 聊天');
  const [commEntryGoldGlow, setCommEntryGoldGlowState] = useState(false);

  const registerMapCornerEntryHandler = useCallback((slot, handler) => {
    handlersRef.current[slot] = typeof handler === 'function' ? handler : null;
  }, []);

  const invokeMapCornerEntryHandler = useCallback((slot) => {
    handlersRef.current[slot]?.();
  }, []);

  const setCommEntryCaption = useCallback((caption) => {
    setCommEntryCaptionState(String(caption || '💬 聊天'));
  }, []);

  const setCommEntryGoldGlow = useCallback((active) => {
    setCommEntryGoldGlowState(!!active);
  }, []);

  const value = useMemo(
    () => ({
      registerMapCornerEntryHandler,
      invokeMapCornerEntryHandler,
      commEntryCaption,
      setCommEntryCaption,
      commEntryGoldGlow,
      setCommEntryGoldGlow,
    }),
    [
      registerMapCornerEntryHandler,
      invokeMapCornerEntryHandler,
      commEntryCaption,
      setCommEntryCaption,
      commEntryGoldGlow,
      setCommEntryGoldGlow,
    ],
  );

  return (
    <MapCornerPlayerEntryActionsContext.Provider value={value}>
      {children}
    </MapCornerPlayerEntryActionsContext.Provider>
  );
}

export function useMapCornerPlayerEntryActions() {
  return useContext(MapCornerPlayerEntryActionsContext);
}

/** @param {'edict'|'rank'|'comm'} slot */
export function useRegisterMapCornerEntryHandler(slot, handler) {
  const ctx = useMapCornerPlayerEntryActions();
  const register = ctx?.registerMapCornerEntryHandler;

  useEffect(() => {
    if (!register) return undefined;
    register(slot, handler);
    return () => register(slot, null);
  }, [register, slot, handler]);
}
