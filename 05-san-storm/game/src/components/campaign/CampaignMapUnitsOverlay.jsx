import CampaignUnitMarker from './CampaignUnitMarker';

function battleTroopToCampaignUnit(t) {
  const rawId = String(t.id || '');
  const troopId =
    rawId.replace(/_p\d+$/, '').replace(/_e\d+$/, '') || t.troopId || rawId;
  const isEnemy = t.faction === 'enemy';
  return {
    faction: isEnemy ? 'enemy' : 'player',
    charId: t.character?.id || (isEnemy ? 'enemy' : 'player'),
    troopId,
    morale: t.morale ?? 70,
  };
}

/**
 * 叠在象限虚线之上，避免与格内 z-index 与 shell 兄弟层冲突。
 * @param {boolean} showStaticNpcUnits 是否渲染 cell.campaignUnit 静态标记；战斗进行中应传 false，
 *   避免与战斗引擎渲染的 .troop-layer 重叠（出现"幽灵部队"）。
 */
export default function CampaignMapUnitsOverlay({
  cells,
  playerByCell,
  deployTroopSelectMode = false,
  selectedDeployTroopId = null,
  onPlayerUnitMarkerClick,
  showStaticNpcUnits = true,
}) {
  return (
    <div className="campaign-unit-layer" aria-hidden>
      {cells.map((row, ri) =>
        row.map((cell, ci) => {
          const key = `${ci},${ri}`;
          const pt = playerByCell?.get?.(key);
          const isSelectable = !!(deployTroopSelectMode && pt);
          const isSelected = !!(pt && selectedDeployTroopId && pt.id === selectedDeployTroopId);
          return (
            <div
              key={`u-${ri}-${ci}`}
              className="campaign-unit-cell"
              data-tactical-y={ri}
              data-tactical-x={ci}
            >
              {pt ? (
                isSelectable ? (
                  <button
                    type="button"
                    className={
                      'campaign-unit-hit campaign-unit-hit--selectable p-0 m-0 border-0 bg-transparent' +
                      (isSelected ? ' campaign-unit-hit--selected' : '')
                    }
                    title="点击选择/取消该部队，再在蓝色可部署格上点击落位"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerUnitMarkerClick?.(pt);
                    }}
                  >
                    <CampaignUnitMarker unit={battleTroopToCampaignUnit(pt)} />
                  </button>
                ) : (
                  <CampaignUnitMarker unit={battleTroopToCampaignUnit(pt)} />
                )
              ) : null}
              {!pt && showStaticNpcUnits && cell.campaignUnit ? (
                <CampaignUnitMarker unit={cell.campaignUnit} />
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
