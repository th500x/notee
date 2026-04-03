import CampaignUnitMarker from './CampaignUnitMarker';

/** 叠在象限虚线之上，避免与格内 z-index 与 shell 兄弟层冲突 */
export default function CampaignMapUnitsOverlay({ cells }) {
  return (
    <div className="campaign-unit-layer" aria-hidden>
      {cells.map((row, ri) =>
        row.map((cell, ci) => (
          <div key={`u-${ri}-${ci}`} className="campaign-unit-cell">
            {cell.campaignUnit ? <CampaignUnitMarker unit={cell.campaignUnit} /> : null}
          </div>
        ))
      )}
    </div>
  );
}
