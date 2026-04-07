import { tacticalTileIndex } from '@shared/utils/tacticalBattleGrid';

/**
 * 战术 BattleMap：`.map-card` 内 `.map-grid .tile` 顺序与 tacticalTileIndex 一致。
 * @param {React.MutableRefObject<HTMLElement | null>} mapCardRef
 */
export function createTacticalMapCardSurface(mapCardRef) {
  return {
    getTileEl(y, x) {
      const card = mapCardRef?.current;
      if (!card) return null;
      const tiles = card.querySelectorAll('.map-grid .tile');
      return tiles[tacticalTileIndex(y, x)] ?? null;
    },
    getSurfaceRoot() {
      return mapCardRef?.current ?? null;
    },
  };
}
