import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';
import { useMapCornerPlayerEntryActions } from '@/contexts/MapCornerPlayerEntryActionsContext';

function MapCornerEntryButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={mapCornerEntryRowBoxStyle}
      className={`flex shrink-0 justify-start text-amber-300 ${MAP_CORNER_ENTRY_ROW_CLASS}`}
    >
      <span className="block w-full min-w-0 truncate text-left">{label}</span>
    </button>
  );
}

/**
 * 州郡进度条右侧第三列：口谕 / 排行 / 聊天（矮视口专用，与「我在哪」列并排）。
 */
export default function MapCornerPlayerEntryColumn() {
  const ctx = useMapCornerPlayerEntryActions();
  const invoke = ctx?.invokeMapCornerEntryHandler;
  const commLabel = ctx?.commEntryCaption || '💬 聊天';

  return (
    <div className="flex shrink-0 flex-col gap-1.5 self-start">
      <MapCornerEntryButton label="📜 口谕" onClick={() => invoke?.('edict')} />
      <div className="flex flex-col gap-1">
        <MapCornerEntryButton label="🏆 排行" onClick={() => invoke?.('rank')} />
        <MapCornerEntryButton label={commLabel} onClick={() => invoke?.('comm')} />
      </div>
    </div>
  );
}
