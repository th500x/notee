import { memo, useMemo, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  terrainFallbackClass,
  campaignObjectUrl,
  campaignFireFrameUrl,
  buildCampaignVisualVariants,
} from '@/utils/campaignMapVisualAssets';
function CampaignMapTile({ cell, seed }) {
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = cell.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(cell.base || 'plain_grassland', bgV);

  const terrainSrc = campaignTerrainUrl(cell.terrain, variants);
  const fallbackCls = terrainFallbackClass(cell.terrain);
  const objSrc = campaignObjectUrl(cell.object);

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);
  const [fireOk, setFireOk] = useState(true);

  const fireFrame = useMemo(() => {
    if (cell.effect !== 'fire') return null;
    let h = seed ^ (cell.col * 31 + cell.row * 17);
    h = Math.imul(h ^ (h >>> 8), 0x7feb352d);
    return (Math.abs(h) % 12) + 1;
  }, [cell.col, cell.row, cell.effect, seed]);

  return (
    <div
      className="campaign-tile"
      title={`(${cell.col},${cell.row}) ${cell.quad} · ${cell.base || ''} · ${cell.terrain || '-'} · ${cell.object || '-'} · ${cell.effect || '-'}`}
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
            {cell.object === 'military_camp' ? '营' : cell.object === 'military_tower' ? '塔' : '·'}
          </div>
        ))}
      {cell.effect === 'fire' && fireFrame && fireOk && (
        <img
          className="camp-layer"
          src={campaignFireFrameUrl(fireFrame)}
          alt=""
          style={{ zIndex: 3 }}
          onError={() => setFireOk(false)}
        />
      )}
      {cell.effect === 'fire' && fireFrame && !fireOk && (
        <span className="camp-fire-emoji" aria-hidden>
          🔥
        </span>
      )}
      <span className="camp-quad-marker">{cell.quad}</span>
    </div>
  );
}

export default memo(CampaignMapTile);
