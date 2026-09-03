import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import { useMapCornerPlayerEntryActions } from '@/contexts/MapCornerPlayerEntryActionsContext';
import MapCornerEntryGoldGlow from '@/components/game/MapCornerEntryGoldGlow';

function MapCornerEntryButton({ label, onClick, goldGlow = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={mapCornerEntryRowBoxStyle}
      className={`flex shrink-0 justify-start text-amber-300 ${MAP_CORNER_ENTRY_ROW_CLASS}${
        goldGlow ? ' map-corner-entry-gold-glow map-corner-entry-gold-glow--in-flow' : ''
      }`}
    >
      {goldGlow ? <MapCornerEntryGoldGlow /> : null}
      <span
        className={
          goldGlow
            ? 'map-corner-entry-gold-glow__content block min-w-0 truncate text-left'
            : 'block w-full min-w-0 truncate text-left'
        }
      >
        {label}
      </span>
    </button>
  );
}

/**
 * 州郡进度条右侧第三列：排行 / 聊天（矮视口专用，与「我在哪」列并排）。
 */
export default function MapCornerPlayerEntryColumn() {
  const ctx = useMapCornerPlayerEntryActions();
  const invoke = ctx?.invokeMapCornerEntryHandler;
  const commLabel = ctx?.commEntryCaption || '💬 聊天';
  const commGoldGlow = !!ctx?.commEntryGoldGlow;

  return (
    <div className="flex shrink-0 flex-col gap-1.5 self-start">
      <MapCornerEntryButton label="🏆 排行" onClick={() => invoke?.('rank')} />
      <MapCornerEntryButton label={commLabel} goldGlow={commGoldGlow} onClick={() => invoke?.('comm')} />
    </div>
  );
}
