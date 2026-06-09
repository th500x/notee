/**
 * 行军模式：沿路移动前粮草与步数确认（与 `POST …/road/move` + 31-6 §6 一致）。
 */

import { MARCH_FOOD_PER_STEP } from '@/utils/strategicRoadMarchPath';

export default function StrategicMarchMoveConfirm({
  open,
  onClose,
  onConfirm,
  loading,
  errorMessage,
  /** 路径顶点数（含起点）；用于「已在目标邻接道路」等判定 */
  pathLength,
  /** 与粮草预览一致：沿路边数（路上出发时为 path 边数 = pathLength−1） */
  billableRoadSteps,
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
            <>已在目标邻接道路，确认后直接进入，本段不消耗步数与粮草。</>
          ) : (
            <>
              <strong className="text-amber-200">{billableRoadSteps}</strong> 步，
              <strong className="text-amber-200">{p.paidSteps ?? 0}</strong> × {MARCH_FOOD_PER_STEP} ={' '}
              <strong className="text-amber-200">{p.totalFoodCost ?? 0}</strong> 粮草
            </>
          )}
        </p>
        {p.freeQuotaPerDay != null && p.freeQuotaRemainingAfterMarch != null ? (
          <p className="mt-1.5 text-sm text-stone-400">
            免费额度：
            <strong className="text-stone-200">{p.freeQuotaRemainingAfterMarch}</strong>
            <span className="text-stone-500"> / </span>
            <strong className="text-stone-200">{p.freeQuotaPerDay}</strong>
          </p>
        ) : null}
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
            {loading ? '提交中…' : (p.totalFoodCost ?? 0) > 0 ? '确认移动（扣粮）' : '确认移动'}
          </button>
        </div>
      </div>
    </div>
  );
}
