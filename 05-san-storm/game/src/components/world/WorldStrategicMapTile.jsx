import { memo, useEffect, useMemo, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  campaignObjectUrl,
  buildCampaignVisualVariants,
  strategicMapObjectIs2x2,
} from '@/utils/campaignMapVisualAssets';
import { tacticalFireFrameUrl } from '@/components/battle/battleConstants';
import { getFactionRepresentativeColor, hexToRgba, getStrategicFactionLogoUrl } from '@/utils/strategicMapFactionColors';
import { getStrategicMapCityLabelLines } from '@/utils/strategicMapCityLabels';

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
 * @param {object|null} [cityRow] - 锚点格 `cityId` 对应 `cities` 行（ fort 用 `build_status` 选空置/建成图）
 * @param {{ anchorR: number, anchorC: number, anchorCell: object }|null} [strategicCover] - 本格是否属于某 2×2 战略城点的锚点或延伸格
 */
function WorldStrategicMapTile({
  cell,
  seed,
  gridY,
  gridX,
  onHover,
  onLeave,
  cityRow = null,
  strategicCover = null,
}) {
  const c = cell || {};
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = c.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(c.base || 'plain_grassland', bgV);

  const anchor = strategicCover?.anchorCell;
  const effectiveObject = anchor?.object ?? c.object;
  const isFootprint2x2 =
    strategicCover && strategicMapObjectIs2x2(strategicCover.anchorCell?.object);
  const isAnchorTile =
    strategicCover &&
    strategicCover.anchorR === gridY &&
    strategicCover.anchorC === gridX;

  const terrainSrc = campaignTerrainUrl(c.terrain, variants);
  const fallbackCls = wsTerrainFallbackClass(c.terrain);

  const objSrc = useMemo(() => {
    if (isFootprint2x2 && !isAnchorTile) return null;
    if (!effectiveObject) return null;
    if (effectiveObject === 'fort' && cityRow) {
      return campaignObjectUrl('fort', {
        buildStatus: cityRow.buildStatus ?? cityRow.build_status,
      });
    }
    return campaignObjectUrl(effectiveObject);
  }, [isFootprint2x2, isAnchorTile, effectiveObject, cityRow]);

  const object2x2 = isFootprint2x2 && isAnchorTile && !!objSrc;

  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  const factionHex = fid ? getFactionRepresentativeColor(fid) : null;
  const factionTintRgba = factionHex ? hexToRgba(factionHex, 0.42) : null;

  const labelLines = useMemo(() => {
    if (!isFootprint2x2 || !isAnchorTile || !effectiveObject) return null;
    return getStrategicMapCityLabelLines(cityRow, anchor, effectiveObject);
  }, [isFootprint2x2, isAnchorTile, effectiveObject, cityRow, anchor]);

  const factionLogoUrl = useMemo(() => getStrategicFactionLogoUrl(fid), [fid]);

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);
  const [factionLogoOk, setFactionLogoOk] = useState(true);

  useEffect(() => {
    setFactionLogoOk(true);
  }, [factionLogoUrl]);

  return (
    <div
      className={`ws-map-tile${object2x2 ? ' ws-tile-object-2x2' : ''}`}
      data-strategic-y={gridY}
      data-strategic-x={gridX}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {bgOk ? (
        <img className="ws-layer" src={bgSrc} alt="" draggable={false} onError={() => setBgOk(false)} />
      ) : (
        <div
          className="ws-layer"
          style={{
            background: c.base === 'plain_wasteland' ? '#d4c4a8' : '#7cb87c',
          }}
        />
      )}
      {isFootprint2x2 && factionTintRgba ? (
        <div
          className="ws-layer ws-faction-bg-tint"
          style={{ background: factionTintRgba, zIndex: 1 }}
          aria-hidden
        />
      ) : null}
      {fallbackCls && <div className={fallbackCls} />}
      {terrainSrc &&
        (tOk ? (
          <img className="ws-layer" src={terrainSrc} alt="" draggable={false} onError={() => setTOk(false)} />
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
          <img
            className={`ws-layer${object2x2 ? ' ws-object-span-2' : ''}`}
            src={objSrc}
            alt=""
            draggable={false}
            onError={() => setOOk(false)}
            style={{ zIndex: 2 }}
          />
        ) : (
          <div className={`ws-obj-fallback${object2x2 ? ' ws-obj-fallback-2x2' : ''}`}>
            {effectiveObject === 'military_camp'
              ? '营'
              : effectiveObject === 'military_tower'
                ? '塔'
                : effectiveObject === 'city_medium' || effectiveObject === 'city_small'
                  ? '城'
                  : effectiveObject === 'fort'
                    ? '据'
                    : '·'}
          </div>
        ))}
      {labelLines && (
        <div className="ws-strategic-label ws-object-span-2" aria-hidden>
          <div className="ws-strategic-label-type">{labelLines.line1}</div>
          <div className="ws-strategic-label-name">{labelLines.line2}</div>
        </div>
      )}
      {isFootprint2x2 && isAnchorTile && factionLogoUrl && factionLogoOk ? (
        <div className="ws-strategic-faction-logo-wrap ws-object-span-2" aria-hidden>
          <img
            className="ws-strategic-faction-logo"
            src={factionLogoUrl}
            alt=""
            draggable={false}
            onError={() => setFactionLogoOk(false)}
          />
        </div>
      ) : null}
      {c.effect === 'fire' && (
        <div className="tile-fire-fx" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <img
              key={i}
              className="tile-fire-frame"
              src={tacticalFireFrameUrl(i + 1)}
              alt=""
              draggable={false}
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
