/**
 * 真三日报 · 28 日签到日历（4 周 × 7 天）
 */

import {
  buildCheckinCalendarDays,
  formatCheckinRewardShort,
} from '@/utils/dailyReportCheckinCalendar';

const WEEK_LABELS = ['一', '二', '三', '四'];

/** 7 列等分撑满左列宽度 */
const CELL_BASE =
  'relative flex h-[40px] w-full min-w-0 flex-col items-center justify-center rounded border px-0.5 py-0.5 text-center transition-colors';

function cellSurfaceClass(cell, canClaim) {
  if (cell.isTodayClaimable) {
    return canClaim
      ? 'border-amber-500 bg-amber-50 hover:bg-amber-100 active:bg-amber-200'
      : 'cursor-not-allowed border-amber-300/60 bg-stone-50 opacity-60';
  }
  if (cell.isChecked) {
    return 'border-stone-300/70 bg-stone-200/55';
  }
  return 'border-stone-200/80 bg-stone-50/50';
}

/**
 * @param {{
 *   checkIn: object|null|undefined,
 *   loading?: boolean,
 *   submitting?: boolean,
 *   onClaim: () => void,
 * }} props
 */
export default function DailyReportCheckinCalendar({
  checkIn,
  loading = false,
  submitting = false,
  onClaim,
}) {
  const days = buildCheckinCalendarDays(checkIn);
  const canClaim = !!checkIn?.canCheckIn && !submitting;

  return (
    <section className="rounded-lg border border-amber-200/80 bg-white p-2.5 shadow-sm">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-amber-900">28 日签到</h3>
        {checkIn?.checkedInToday ? (
          <span className="text-[9px] text-stone-500">今日已签</span>
        ) : checkIn?.canCheckIn ? (
          <span className="text-[9px] text-amber-800">点击高亮格领取</span>
        ) : null}
      </div>

      {loading && !checkIn ? (
        <p className="text-xs text-stone-500">加载中…</p>
      ) : (
        <>
          <div className="w-full space-y-1">
            {WEEK_LABELS.map((w, weekIdx) => (
              <div key={w}>
                <div className="mb-px text-[9px] font-medium text-stone-500">
                  第{w}周
                </div>
                <div className="grid w-full grid-cols-7 gap-0.5">
                  {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell) => {
                    if (cell.isTodayClaimable) {
                      return (
                        <button
                          key={cell.day}
                          type="button"
                          disabled={!canClaim}
                          onClick={onClaim}
                          title={`领取第 ${cell.day} 天：${formatCheckinRewardShort(cell.reward)}`}
                          className={[CELL_BASE, cellSurfaceClass(cell, canClaim)].join(' ')}
                          aria-label={
                            cell.isChecked
                              ? `第 ${cell.day} 天已领取`
                              : `领取第 ${cell.day} 天`
                          }
                        >
                          <DayCellContent cell={cell} submitting={submitting} />
                        </button>
                      );
                    }

                    return (
                      <div
                        key={cell.day}
                        className={[CELL_BASE, cellSurfaceClass(cell, canClaim)].join(' ')}
                        aria-label={cell.isChecked ? `第 ${cell.day} 天已领取` : undefined}
                      >
                        <DayCellContent cell={cell} submitting={false} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!checkIn?.canCheckIn && checkIn?.blockReason ? (
            <p className="mt-2 text-center text-[10px] text-stone-500">{checkIn.blockReason}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

function DayCellContent({ cell, submitting }) {
  const muted = cell.isChecked;

  return (
    <>
      <span
        className={[
          'text-[9px] font-semibold leading-none',
          muted ? 'text-stone-400' : 'text-stone-600',
        ].join(' ')}
      >
        {cell.day}
      </span>
      <span
        className={[
          'mt-px text-[8px] leading-none',
          muted ? 'text-stone-400/90' : 'text-amber-900/90',
        ].join(' ')}
      >
        {formatCheckinRewardShort(cell.reward)}
      </span>
      {cell.isTodayClaimable && submitting ? (
        <span className="mt-px text-[8px] text-amber-800">…</span>
      ) : null}
    </>
  );
}
