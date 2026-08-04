import { memo, useMemo, useState, useEffect } from 'react';
import {
  getMapTroopPortraitUrlAttempts,
  normalizeGamePublicBase,
} from '@shared/utils/troopIconUrls';
import { getBattleFactionRingRgba } from '@shared/utils/battleFactionRingColors';

const BASE = normalizeGamePublicBase(
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null ? import.meta.env.BASE_URL : ''
);

/**
 * 大型图：NPC 部队缩略图 — `san_1_battle/{faction}/`（与 preset forces 五档一致），规则见 `troopIconUrls.js`。
 */
function LargeMapUnitMarker({ unit }) {
  const urls = useMemo(
    () => getMapTroopPortraitUrlAttempts(unit.troopId, BASE, unit.faction),
    [unit.troopId, unit.faction]
  );
  const [uIdx, setUIdx] = useState(0);
  useEffect(() => {
    setUIdx(0);
  }, [unit.charId, unit.troopId]);

  const ring = getBattleFactionRingRgba(unit.faction);

  return (
    <div className="largemap-unit-marker" title={`${unit.faction} · ${unit.charId} · ${unit.troopId} · 士气 ${unit.morale}`}>
      <div className="largemap-unit-ring" style={{ boxShadow: `inset 0 0 0 2px ${ring}` }} />
      {uIdx < urls.length ? (
        <img
          className="largemap-unit-img"
          src={urls[uIdx] || ''}
          alt=""
          onError={() => setUIdx((i) => Math.min(i + 1, urls.length))}
        />
      ) : (
        <div className="largemap-unit-fallback" aria-hidden>
          ⚔
        </div>
      )}
    </div>
  );
}

export default memo(LargeMapUnitMarker);
