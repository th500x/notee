import { memo, useMemo, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  terrainFallbackClass,
  campaignObjectUrl,
  buildCampaignVisualVariants,
} from '@/utils/campaignMapVisualAssets';
import { tacticalFireFrameUrl } from '@/components/battle/battleConstants';

/**
 * 战役地图单格。
 *
 * 与小型地图 BattleTile 统一：格子根节点同时承担
 *   1. 地形/特效渲染
 *   2. 战斗引擎 DOM 宿主（data-battle-y/x、data-troop 由引擎写入）
 *   3. 鼠标悬停事件源（onMouseEnter → 父层读 dataset.troop 决定 tooltip）
 */
function CampaignMapTile({
  cell,
  seed,
  tacticalY,
  tacticalX,
  deployHighlight = false,
  interactive = false,
  onTileClick,
  /** 战斗中为 true：根节点兼任引擎瓦片宿主（data-battle-y/x = tacticalY/X） */
  engineActive = false,
  manualHl = null,
  manualMoveCost = null,
  onHover,
  onLeave,
}) {
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = cell.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(cell.base || 'plain_grassland', bgV);

  const terrainSrc = campaignTerrainUrl(cell.terrain, variants);
  const fallbackCls = terrainFallbackClass(cell.terrain);
  const objSrc = campaignObjectUrl(cell.object);

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);
  return (
    <div
      role={interactive && onTileClick ? 'button' : undefined}
      className={
        'campaign-tile' +
        (deployHighlight ? ' campaign-tile-deploy-hl' : '') +
        (interactive ? ' campaign-tile-interactive' : '')
      }
      data-tactical-y={tacticalY}
      data-tactical-x={tacticalX}
      data-battle-y={engineActive ? tacticalY : undefined}
      data-battle-x={engineActive ? tacticalX : undefined}
      onClick={onTileClick}
      onKeyDown={(interactive && onTileClick) ? (e) => e.key === 'Enter' && onTileClick() : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {bgOk ? (
        <img className="camp-layer" src={bgSrc} alt="" onError={() => setBgOk(false)} />
      ) : (
        <div
          className="camp-layer"
          style={{
            background: cell.base === 'plain_wasteland' ? '#d4c4a8' : '#7cb87c',
          }}
        />
      )}
      {fallbackCls && <div className={fallbackCls} />}
      {terrainSrc &&
        (tOk ? (
          <img className="camp-layer" src={terrainSrc} alt="" onError={() => setTOk(false)} />
        ) : (
          <div
            className="camp-layer"
            style={{
              background:
                cell.terrain === 'river'
                  ? 'rgba(30,100,200,0.45)'
                  : cell.terrain === 'siege'
                    ? 'rgba(101,67,33,0.5)'
                    : 'rgba(40,80,40,0.35)',
            }}
          />
        ))}
      {objSrc &&
        (oOk ? (
          <img className="camp-layer" src={objSrc} alt="" onError={() => setOOk(false)} style={{ zIndex: 2 }} />
        ) : (
          <div className="camp-obj-fallback">
            {cell.object === 'military_camp'
              ? '营'
              : cell.object === 'military_tower'
                ? '塔'
                : cell.object === 'city_medium' || cell.object === 'city_small'
                  ? '城'
                  : cell.object === 'fort'
                    ? '据'
                    : '·'}
          </div>
        ))}
      {cell.effect === 'fire' && (
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
      {deployHighlight && <div className="campaign-deploy-zone-overlay" aria-hidden />}
      {manualHl === 'active' && <div className="manual-hl active-troop campaign-manual-hl" aria-hidden />}
      {manualHl === 'move' && (
        <div className="manual-hl move-range campaign-manual-hl" aria-hidden>
          {manualMoveCost != null && manualMoveCost > 1 && (
            <span className="move-cost-label">{manualMoveCost}</span>
          )}
        </div>
      )}
      {manualHl === 'atk' && <div className="manual-hl atk-target campaign-manual-hl" aria-hidden />}
      <span className="camp-quad-marker">{cell.quad}</span>
    </div>
  );
}

export default memo(CampaignMapTile);
