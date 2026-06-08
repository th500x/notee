/**
 * 大地图左下角「口谕」「排行」「聊天」收起态入口与左上州郡条共用：
 * 固定像素外框，避免原生 select / 长文案把条「撑变宽」。
 * 视觉仍与 `px-3 py-2 text-xs rounded-lg border border-amber-700/40 bg-black/80` 一致量级。
 */
export const MAP_CORNER_ENTRY_W_PX = 66;
export const MAP_CORNER_ENTRY_H_PX = 36;

/** 单行入口按钮（排行 / 聊天 / 郡名按钮） */
export const mapCornerEntryRowBoxStyle = {
  width: MAP_CORNER_ENTRY_W_PX,
  minWidth: MAP_CORNER_ENTRY_W_PX,
  maxWidth: MAP_CORNER_ENTRY_W_PX,
  height: MAP_CORNER_ENTRY_H_PX,
  minHeight: MAP_CORNER_ENTRY_H_PX,
  maxHeight: MAP_CORNER_ENTRY_H_PX,
  boxSizing: 'border-box',
};

/** 州郡条外层：仅锁宽度，高度随多行堆叠 */
export const mapCornerEntryStackOuterStyle = {
  width: MAP_CORNER_ENTRY_W_PX,
  minWidth: MAP_CORNER_ENTRY_W_PX,
  maxWidth: MAP_CORNER_ENTRY_W_PX,
  boxSizing: 'border-box',
};

/** 不含文字色与主轴对齐，便于郡按钮用 stone、排行用 amber */
export const MAP_CORNER_ENTRY_ROW_CLASS =
  'box-border flex items-center overflow-hidden rounded-lg border border-amber-700/40 bg-black/80 px-2 text-xs font-medium hover:bg-black/70 transition-colors';

/**
 * 左上 **`ZhouJunMapJumpPanel`** 专用：左右 **`px-1`**（排行 / 聊天仍 **`px-2`**），便于 66px 格内「匪寨」「攻城」等完整显示。
 */
export const MAP_CORNER_ENTRY_ROW_CLASS_ZHOU_JUN =
  'box-border flex items-center overflow-hidden rounded-lg border border-amber-700/40 bg-black/80 px-1 text-xs font-medium hover:bg-black/70 transition-colors';

/** 州郡条底部一行提示：与入口同宽、单行省略，不占可变高度 */
export const mapCornerEntryHintRowStyle = {
  width: MAP_CORNER_ENTRY_W_PX,
  minWidth: MAP_CORNER_ENTRY_W_PX,
  maxWidth: MAP_CORNER_ENTRY_W_PX,
  height: 18,
  minHeight: 18,
  maxHeight: 18,
  boxSizing: 'border-box',
};

/** 郡名与右侧匪寨钮水平间距（与 `gap-1` 一致） */
export const MAP_CORNER_JUN_PAIR_GAP_PX = 4;

/** 郡名 66 + 间距 + 匪寨 66（`ZhouJunMapJumpPanel` 有匪寨时州下拉与郡行同总宽） */
export const MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX =
  MAP_CORNER_ENTRY_W_PX + MAP_CORNER_JUN_PAIR_GAP_PX + MAP_CORNER_ENTRY_W_PX;

export const mapCornerZhouJunStackWideOuterStyle = {
  width: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
  minWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
  maxWidth: MAP_CORNER_ZHOU_JUN_PAIR_ROW_W_PX,
  boxSizing: 'border-box',
};

/** 左下玩家角钮：矮视口时见 `styles/mapCornerPlayerEntries.css` 改到「我在哪」右侧 */
export const MAP_CORNER_PLAYER_ENTRY_COMPACT_CLASS = 'map-corner-player-entry map-corner-player-entry--compact-relocate';

export const MAP_CORNER_PLAYER_ENTRY_EDICT_CLASS = `${MAP_CORNER_PLAYER_ENTRY_COMPACT_CLASS} map-corner-player-entry--edict`;

export const MAP_CORNER_PLAYER_ENTRY_RANK_CLASS = `${MAP_CORNER_PLAYER_ENTRY_COMPACT_CLASS} map-corner-player-entry--rank`;

export const MAP_CORNER_PLAYER_ENTRY_COMM_CLASS = `${MAP_CORNER_PLAYER_ENTRY_COMPACT_CLASS} map-corner-player-entry--comm`;
