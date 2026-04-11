import { memo, useMemo, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  campaignObjectUrl,
  buildCampaignVisualVariants,
} from '@/utils/campaignMapVisualAssets';
import { tacticalFireFrameUrl } from '@/components/battle/battleConstants';

function wsTerrainFallbackClass(terrain) {
  if (terrain === 'lake') return 'ws-terrain-fallback ws-terrain-lake';
  if (terrain === 'ford') return 'ws-terrain-fallback ws-terrain-ford';
  if (terrain === 'road') return 'ws-terrain-fallback ws-terrain-road';
  return null;
}

/**
 * 战略层郡大地图单格：仅地形 / 对象 / 特效展示。
 * 与 `CampaignMapTile` 职责分离（无战役部署、无战斗引擎宿主）。
 * 瓦片素材路径复用 `campaignMapVisualAssets`（与 BattleTile 同源 PNG）。
 */
function WorldStrategicMapTile({ cell, seed, gridY, gridX, onHover, onLeave }) {
  const c = cell || {};
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = c.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(c.base || 'plain_grassland', bgV);

  const terrainSrc = campaignTerrainUrl(c.terrain, variants);
  const fallbackCls = wsTerrainFallbackClass(c.terrain);
  const objSrc = campaignObjectUrl(c.object);

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);

  return (
    <div
      className="ws-map-tile"
      data-strategic-y={gridY}
      data-strategic-x={gridX}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {bgOk ? (
        <img className="ws-layer" src={bgSrc} alt="" onError={() => setBgOk(false)} />
      ) : (
        <div
          className="ws-layer"
          style={{
            background: c.base === 'plain_wasteland' ? '#d4c4a8' : '#7cb87c',
          }}
        />
      )}
      {fallbackCls && <div className={fallbackCls} />}
      {terrainSrc &&
        (tOk ? (
          <img className="ws-layer" src={terrainSrc} alt="" onError={() => setTOk(false)} />
        ) : (
          <div
            className="ws-layer"
            style={{
              background:
                c.terrain === 'river'
                  ? 'rgba(30,100,200,0.45)'
                  : c.terrain === 'siege'
                    ? 'rgba(101,67,33,0.5)'
                    : 'rgba(40,80,40,0.35)',
            }}
          />
        ))}
      {objSrc &&
        (oOk ? (
          <img className="ws-layer" src={objSrc} alt="" onError={() => setOOk(false)} style={{ zIndex: 2 }} />
        ) : (
          <div className="ws-obj-fallback">
            {c.object === 'military_camp'
              ? '营'
              : c.object === 'military_tower'
                ? '塔'
                : c.object === 'city_medium' || c.object === 'city_small'
                  ? '城'
                  : c.object === 'fort'
                    ? '据'
                    : '·'}
          </div>
        ))}
      {c.effect === 'fire' && (
        <div className="tile-fire-fx" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <img
              key={i}
              className="tile-fire-frame"
              src={tacticalFireFrameUrl(i + 1)}
              alt=""
              style={{ animationDelay: `${-(i * 1.2) / 12}s` }}
            />
          ))}
        </div>
      )}
      <span className="ws-quad-marker">{c.quad}</span>
    </div>
  );
}

export default memo(WorldStrategicMapTile);
