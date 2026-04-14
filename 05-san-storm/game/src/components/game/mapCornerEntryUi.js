/**
 * 大地图左下角「排行」「聊天」收起态入口与左上州郡条共用：
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
