/**

 * 真三日报 · 28 日签到日历（4 周 × 7 天）

 */



import { useCallback, useEffect, useState } from 'react';

import {

  buildCheckinCalendarDays,

  formatCheckinRewardShort,

} from '@/utils/dailyReportCheckinCalendar';

import {

  extractCheckinCardReward,

  fetchCheckinCardPreview,

} from '@/utils/checkinRewardPreview';

import { loadSharedData } from '@/services/dataService';

import DailyReportCheckinCardPreview from '@/components/game/DailyReportCheckinCardPreview';



const WEEK_LABELS = ['一', '二', '三', '四'];



/** 7 列等分撑满左列宽度 */

const CELL_BASE =

  'relative flex h-[40px] w-full min-w-0 flex-col items-center justify-center rounded border px-0.5 py-0.5 text-center transition-colors';



function cellSurfaceClass(cell, canClaim, previewable) {

  if (cell.isTodayClaimable) {

    return canClaim

      ? 'border-amber-500 bg-amber-50 hover:bg-amber-100 active:bg-amber-200'

      : 'cursor-not-allowed border-amber-300/60 bg-stone-50 opacity-60';

  }

  if (previewable) {

    return 'cursor-pointer border-stone-200/80 bg-stone-50/80 hover:border-amber-300 hover:bg-amber-50/80 active:bg-amber-100/70';

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

  const [preview, setPreview] = useState(null);

  const [previewLoading, setPreviewLoading] = useState(false);

  const [skillsMap, setSkillsMap] = useState({});



  useEffect(() => {

    let cancelled = false;

    void loadSharedData('skills')

      .then((data) => {

        if (cancelled || !data?.skills) return;

        const map = {};

        for (const s of data.skills) {

          if (s?.id) map[s.id] = s;

        }

        setSkillsMap(map);

      })

      .catch(() => {});

    return () => {

      cancelled = true;

    };

  }, []);



  const openCardPreview = useCallback(async (rewardsStr) => {

    const target = extractCheckinCardReward(rewardsStr);

    if (!target || previewLoading) return;

    setPreviewLoading(true);

    try {

      const card = await fetchCheckinCardPreview(target.cardId, target.cardType);

      if (card) setPreview(card);

    } catch (e) {

      console.error('[DailyReportCheckin] card preview failed', e);

    } finally {

      setPreviewLoading(false);

    }

  }, [previewLoading]);



  const handleCellActivate = useCallback(

    (cell) => {

      if (cell.isTodayClaimable) {

        if (canClaim) onClaim();

        return;

      }

      const cardTarget = extractCheckinCardReward(cell.reward?.rewards);

      if (cardTarget) void openCardPreview(cell.reward.rewards);

    },

    [canClaim, onClaim, openCardPreview],

  );



  return (

    <section className="rounded-lg border border-amber-200/80 bg-white p-2.5 shadow-sm">

      <div className="mb-1.5 flex items-baseline justify-between gap-2">

        <h3 className="text-sm font-bold text-amber-900">28 日签到</h3>

        {checkIn?.checkedInToday ? (

          <span className="text-[9px] text-stone-500">今日已签</span>

        ) : checkIn?.canCheckIn ? (

          <span className="text-[9px] text-amber-800">高亮格领取 · 卡牌格可预览</span>

        ) : (

          <span className="text-[9px] text-stone-500">卡牌奖励格可点击预览</span>

        )}

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

                    const cardTarget = extractCheckinCardReward(cell.reward?.rewards);

                    const previewable = !!cardTarget && !cell.isTodayClaimable;

                    const surface = cellSurfaceClass(cell, canClaim, previewable);

                    const rewardLabel = formatCheckinRewardShort(cell.reward);

                    const title = cell.isTodayClaimable

                      ? `领取第 ${cell.day} 天：${rewardLabel}`

                      : previewable

                        ? `预览第 ${cell.day} 天：${rewardLabel}`

                        : undefined;



                    return (

                      <button

                        key={cell.day}

                        type="button"

                        disabled={cell.isTodayClaimable ? !canClaim : previewLoading && previewable}

                        onClick={() => handleCellActivate(cell)}

                        title={title}

                        className={[CELL_BASE, surface].join(' ')}

                        aria-label={

                          cell.isTodayClaimable

                            ? cell.isChecked

                              ? `第 ${cell.day} 天已领取`

                              : `领取第 ${cell.day} 天`

                            : previewable

                              ? `预览第 ${cell.day} 天奖励卡牌`

                              : cell.isChecked

                                ? `第 ${cell.day} 天已领取`

                                : `第 ${cell.day} 天`

                        }

                      >

                        <DayCellContent cell={cell} submitting={submitting && cell.isTodayClaimable} />

                      </button>

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



      <DailyReportCheckinCardPreview

        preview={preview}

        skillsMap={skillsMap}

        onClose={() => setPreview(null)}

      />

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


