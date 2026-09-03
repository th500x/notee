/** 裁定中遮罩最短展示时长（与其它短动画一致，约 3 秒） */
export const PVP_ADJUDICATION_UI_MS = 3000;

export function scheduleAfterMinAdjudicationUi(startedAt, fn) {
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, PVP_ADJUDICATION_UI_MS - elapsed);
  if (wait <= 0) {
    fn();
    return;
  }
  setTimeout(fn, wait);
}
