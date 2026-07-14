/**
 * 真三日报 · 战事目标投票区块
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';

/**
 * @param {{ playerId?: string|null, refreshKey?: number }} props
 */
export default function DailyReportWarVoteSection({ playerId, refreshKey = 0 }) {
  const [loading, setLoading] = useState(false);
  const [busyCity, setBusyCity] = useState(null);
  const [toast, setToast] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) {
      setData(null);
      return;
    }
    setLoading(true);
    setToast(null);
    try {
      const res = await playerAPI.getDailyReportWarVote(playerId);
      if (res.success) setData(res.data);
      else setToast(res.error || '投票加载失败');
    } catch (e) {
      setToast(e?.message || '投票加载失败');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const onVote = useCallback(
    async (cityId) => {
      if (!playerId || busyCity) return;
      setBusyCity(cityId);
      setToast(null);
      try {
        const res = await playerAPI.castDailyReportWarVote(playerId, cityId);
        if (res.success) {
          setData(res.data);
        } else {
          setToast(res.error || '投票失败');
        }
      } catch (e) {
        setToast(e?.message || '投票失败');
      } finally {
        setBusyCity(null);
      }
    },
    [playerId, busyCity],
  );

  if (loading && !data) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <h3 className="text-sm font-bold text-amber-900 mb-2">战事公议</h3>
        <p className="text-xs text-stone-500">加载中…</p>
      </section>
    );
  }

  if (!data?.available || !data.poll || data.poll.status === 'skipped') {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <h3 className="text-sm font-bold text-amber-900 mb-2">战事公议</h3>
        <p className="text-xs text-stone-500">
          {data?.reason === 'at_war_cap' || data?.poll?.skipReason === 'at_war_cap'
            ? '势力已有进行中的战事，今日不开公议。'
            : data?.reason === 'no_affordable_candidates' ||
                data?.poll?.skipReason === 'no_affordable_candidates'
              ? '近期无可负担的开战目标，今日不开公议。'
              : '今日暂无战事公议。'}
        </p>
      </section>
    );
  }

  const poll = data.poll;
  const candidates = poll.candidates || [];

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-bold text-amber-900 mb-1">战事公议</h3>
      <p className="mb-2 text-[10px] leading-snug text-stone-500">{poll.rulesHint}</p>
      {toast ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          {toast}
        </div>
      ) : null}
      {poll.blockReason && poll.status === 'open' ? (
        <p className="mb-2 text-[10px] text-stone-500">{poll.blockReason}</p>
      ) : null}
      {poll.status === 'resolved' ? (
        <p className="mb-2 text-[10px] text-emerald-700">
          已议决：
          {candidates.find((c) => c.cityId === poll.winnerCityId)?.cityName || poll.winnerCityId || '—'}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-stretch">
        {candidates.map((c) => {
          const selected = poll.myVoteCityId === c.cityId;
          const disabled = !poll.canVote || !!busyCity || poll.status !== 'open';
          const kindLabel = c.kind === 'pve' ? '中立' : '敌对';
          return (
            <div
              key={c.cityId}
              className={`flex h-full flex-col rounded-lg border px-2.5 py-2 ${
                selected ? 'border-amber-600/70 bg-amber-50/80' : 'border-stone-200 bg-stone-50/80'
              }`}
            >
              <div className="text-[11px] font-semibold text-stone-800">{c.cityName}</div>
              <div className="mt-0.5 text-[10px] text-stone-500">
                {kindLabel}
                {c.cityType ? ` · ${c.cityType}` : ''}
              </div>
              <div className="mt-1 text-[10px] tabular-nums text-stone-600">
                票权合计 {c.score}
                {c.voters ? ` · ${c.voters} 人` : ''}
              </div>
              <div className="mt-0.5 text-[10px] tabular-nums text-stone-500">
                开战约 {c.costSilver} 银 · {c.costFood} 粮
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onVote(c.cityId)}
                className={`mt-auto h-8 w-full shrink-0 rounded border px-2 text-[11px] font-medium leading-none ${
                  disabled
                    ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                    : selected
                      ? 'border-amber-700/50 bg-amber-800 text-amber-50 hover:bg-amber-700'
                      : 'border-amber-700/40 bg-white text-amber-900 hover:bg-amber-50'
                }`}
              >
                {busyCity === c.cityId
                  ? '提交中…'
                  : selected
                    ? `已投（权 ${poll.myWeight}）`
                    : poll.canVote
                      ? `投票（权 ${poll.voteWeight}）`
                      : '不可投'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
