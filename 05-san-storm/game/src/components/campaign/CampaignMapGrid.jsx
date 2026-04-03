import CampaignMapTile from './CampaignMapTile';
import CampaignMapUnitsOverlay from './CampaignMapUnitsOverlay';
import './CampaignMapGrid.css';

const QUAD_CLASS = {
  A: 'campaign-quad-frame campaign-quad-a',
  B: 'campaign-quad-frame campaign-quad-b',
  C: 'campaign-quad-frame campaign-quad-c',
  D: 'campaign-quad-frame campaign-quad-d',
};

/**
 * 象限框必须叠在格子上方用 absolute，不可作为 grid 子项（否则与 320 格争位，地图会挤到网格外）。
 *
 * @param {{ cells: object[][], seed: number, title?: string, meta?: React.ReactNode }} props
 */
export default function CampaignMapGrid({ cells, seed, title = '战役地图（与 BattleTile 同源素材）', meta }) {
  return (
    <div className="campaign-map-card">
      {title && <div className="campaign-map-title">{title}</div>}
      {meta && <div className="campaign-map-meta">{meta}</div>}
      <div className="campaign-map-wrap">
        <div className="campaign-map-shell">
          <div className="campaign-map-grid">
            {cells.map((row, ri) =>
              row.map((cell, ci) => <CampaignMapTile key={`${ri}-${ci}`} cell={cell} seed={seed} />)
            )}
          </div>
          <div className="campaign-quad-overlay" aria-hidden>
            {(['A', 'B', 'C', 'D']).map((q) => (
              <div key={q} className={QUAD_CLASS[q]} title={`象限 ${q}`} />
            ))}
          </div>
          <CampaignMapUnitsOverlay cells={cells} />
        </div>
      </div>
    </div>
  );
}
