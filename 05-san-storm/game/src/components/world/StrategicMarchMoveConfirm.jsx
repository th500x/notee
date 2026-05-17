/**
 * 行军模式：沿路移动前粮草与步数确认（与 `POST …/road/move` + 31-6 §9.1 一致）。
 */

import { MARCH_FOOD_PER_STEP } from '@/utils/strategicRoadMarchPath';

export default function StrategicMarchMoveConfirm({
  open,
  onClose,
  onConfirm,
  loading,
  errorMessage,
  pathLength,
  preview,
  /** 落点有其他玩家时提示（遭遇以服务端为准） */
  encounterHint,
  /** 城心/匪寨行军时展示地名 */
  poiTargetName = null,
}) {
  if (!open) return null;

  const p = preview || {};
  const adjRoadEnterPoi = !!poiTargetName && pathLength === 1 && Number(p.steps) === 0;
  const reserveWarn = p.reserveExceeded
    ? `势力池垫粮将超出当日上限（还差 ${Math.max(0, (p.reserveFromFaction || 0) - (p.reserveRemaining || 0))}），请缩短路程或改日再试。`
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategic-march-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg border border-amber-700/50 bg-stone-900 p-4 text-stone-100 shadow-xl">
        <h2 id="strategic-march-confirm-title" className="text-base font-bold text-amber-100">
          确认沿路移动
        </h2>
        {poiTargetName ? (
          <p className="mt-2 text-sm text-amber-100/90">
            目标：<strong>{poiTargetName}</strong>（沿路接近后进入城寨占格中心；粮草仍按道路步数计）。
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          {adjRoadEnterPoi ? (
            <>
              您已在目标邻接道路上，确认后将<strong className="text-amber-200">直接进入城寨锚格</strong>
              ，本段<strong className="text-amber-200">不消耗沿路步数与粮草</strong>。
            </>
          ) : (
            <>
              本段共 <strong className="text-amber-200">{pathLength}</strong> 步（道路邻接）。
              {p.freeSteps != null ? (
                <>
                  {' '}
                  其中免费格 <strong>{p.freeSteps}</strong>，需扣粮 <strong>{p.paidSteps || 0}</strong> 格 ×
                  {MARCH_FOOD_PER_STEP} =
                  <strong className="text-amber-200"> {p.totalFoodCost ?? 0}</strong> 粮草（先个人粮草{' '}
                  <strong>{p.foodFromPlayer ?? 0}</strong>，不足部分势力池 <strong>{p.reserveFromFaction ?? 0}</strong>）。
                </>
              ) : null}
            </>
          )}
        </p>
        {encounterHint ? (
          <p className="mt-2 rounded border border-amber-900/60 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-100/95">{encounterHint}</p>
        ) : null}
        {reserveWarn ? <p className="mt-2 text-sm text-red-300">{reserveWarn}</p> : null}
        {errorMessage ? <p className="mt-2 text-sm text-red-300">{errorMessage}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-stone-500 bg-stone-700 px-3 py-1.5 text-sm font-semibold text-stone-100 touch-manipulation"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded border border-amber-600 bg-amber-800 px-3 py-1.5 text-sm font-semibold text-amber-50 touch-manipulation disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading || p.reserveExceeded}
          >
            {loading ? '提交中…' : '确认移动（扣粮）'}
          </button>
        </div>
      </div>
    </div>
  );
}
