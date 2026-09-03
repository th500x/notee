/**
 * 大地图 HUD 入口显隐（顶栏「隐藏按钮 / 显示按钮」统一控制 32-4 + 32-5）
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { readMapHudButtonsVisible, writeMapHudButtonsVisible } from '@/utils/mapHudVisibility';

const MapHudVisibilityContext = createContext(null);

export function MapHudVisibilityProvider({ children }) {
  const [mapHudButtonsVisible, setMapHudButtonsVisibleState] = useState(() =>
    readMapHudButtonsVisible(),
  );

  const setMapHudButtonsVisible = useCallback((next) => {
    setMapHudButtonsVisibleState((prev) => {
      const value = typeof next === 'function' ? next(prev) : !!next;
      writeMapHudButtonsVisible(value);
      return value;
    });
  }, []);

  const toggleMapHudButtons = useCallback(() => {
    setMapHudButtonsVisible((v) => !v);
  }, [setMapHudButtonsVisible]);

  const value = useMemo(
    () => ({
      mapHudButtonsVisible,
      setMapHudButtonsVisible,
      toggleMapHudButtons,
    }),
    [mapHudButtonsVisible, setMapHudButtonsVisible, toggleMapHudButtons],
  );

  return (
    <MapHudVisibilityContext.Provider value={value}>{children}</MapHudVisibilityContext.Provider>
  );
}

export function useMapHudVisibility() {
  const ctx = useContext(MapHudVisibilityContext);
  if (!ctx) {
    throw new Error('useMapHudVisibility must be used within MapHudVisibilityProvider');
  }
  return ctx;
}
