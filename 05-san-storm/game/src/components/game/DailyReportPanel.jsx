/**
 * 真三日报面板（32-6）
 */

import { useCallback, useEffect, useState } from 'react';
import PersonalCatalogModal from '@/components/game/PersonalCatalogModal';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { playerAPI } from '@/services/playerApi';
import { loadSharedData } from '@/services/dataService';
import { formatHistoryMonthDayLabel, pickHistoryEntriesForToday } from '@/utils/historyOnThisDay';
import { notifyDailyReportNotifyRefresh } from '@/utils/dailyReportNotifyRefresh';
import DailyReportCheckinCalendar from '@/components/game/DailyReportCheckinCalendar';

function fmtOfficialLine(entry) {
  if (!entry?.characterName) return null;
  const name = entry.characterName;
  const pos = entry.positionName ? `[${entry.positionName}]` : '';
  return `${pos}${name}`;
}

function filterOfficialsWithPlayers(officials) {
  if (!Array.isArray(officials)) return [];
  return officials
    .map((f) => {
      const lv1Lines = (f.lv1 || []).map(fmtOfficialLine).filter(Boolean);
      const lv2Lines = (f.lv2 || []).map(fmtOfficialLine).filter(Boolean);
      if (!lv1Lines.length && !lv2Lines.length) return null;
      return { ...f, lv1Lines, lv2Lines };
    })
    .filter(Boolean);
}

/**
 * @param {{ open: boolean, onClose: () => void, playerId?: string|null }} props
 */
export default function DailyReportPanel({ open, onClose, playerId }) {
  const { refresh: refreshPlayer } = usePlayerContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [report, setReport] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyError, setHistoryError] = useState(null);

  const loadReport = useCallback(async () => {
    if (!playerId) {
      setReport(null);
      return;
    }
    setLoading(true);
    try {
      const res = await playerAPI.getDailyReport(playerId);
      if (res.success) {
        setReport(res.data);
      } else {
        setToast(res.error || '加载失败');
      }
    } catch (e) {
      setToast(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    setToast(null);
    void loadReport();
  }, [open, loadReport]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHistoryError(null);
    void loadSharedData('historyOnThisDay')
      .then((data) => {
        if (!cancelled) setHistoryEntries(pickHistoryEntriesForToday(data));
      })
      .catch((e) => {
        if (!cancelled) {
          setHistoryEntries([]);
          setHistoryError(e?.message || '史实加载失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onCheckIn = useCallback(async () => {
    if (!playerId || submitting) return;
    setToast(null);
    setSubmitting(true);
    try {
      const res = await playerAPI.postDailyReportCheckIn(playerId);
      if (res.success) {
        const g = res.data?.granted;
        setToast(
          g?.silver > 0 ? `签到成功，获得 ${g.silver} 银两` : '签到成功',
        );
        if (res.data?.checkIn) {
          setReport((prev) => (prev ? { ...prev, checkIn: res.data.checkIn } : prev));
        }
        notifyDailyReportNotifyRefresh();
        await refreshPlayer();
      } else {
        setToast(res.error || '签到失败');
      }
    } catch (e) {
      setToast(e?.message || '签到失败');
    } finally {
      setSubmitting(false);
    }
  }, [playerId, submitting, refreshPlayer]);

  const checkIn = report?.checkIn;
  const digestSections = report?.digest?.sections;
  const hasDigest = Array.isArray(digestSections) && digestSections.length > 0;
  const warHotspots = report?.digest?.warHotspots;
  const hasWars = Array.isArray(warHotspots) && warHotspots.length > 0;
  const officialsWithPlayers = filterOfficialsWithPlayers(report?.officials?.factions);

  return (
    <PersonalCatalogModal open={open} title="真三日报" icon="📰" onClose={onClose}>
      <div className="px-4 py-3 text-stone-800 bg-stone-50 min-h-full">
        {toast ? (
          <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {toast}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <DailyReportCheckinCalendar
              checkIn={checkIn}
              loading={loading}
              submitting={submitting}
              onClaim={onCheckIn}
            />

            <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">昨日风云</h3>
              {hasDigest ? (
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {digestSections.map((sec, i) => (
                    <li key={sec.type || i}>
                      {sec.title ? <div className="font-semibold text-stone-800">{sec.title}</div> : null}
                      {(sec.lines || []).map((line, j) => (
                        <p key={j} className="leading-snug">
                          {line}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">昨日摘要筹备中，将于每日 0:00 自动生成。</p>
              )}
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">昨日激战战事</h3>
              {hasWars ? (
                <ul className="space-y-1 text-xs text-stone-700">
                  {warHotspots.map((w) => (
                    <li key={w.warKey || w.label}>
                      <span className="font-semibold text-stone-800">{w.label}</span>
                      {' '}
                      昨日共 {w.battleCount} 场厮杀，烽烟四起。
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">昨日无战事级激战记录。</p>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">
                历史上的今天
                <span className="ml-1.5 font-normal text-stone-500">{formatHistoryMonthDayLabel()}</span>
              </h3>
              {historyError ? (
                <p className="text-xs text-stone-500">{historyError}</p>
              ) : historyEntries.length ? (
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {historyEntries.map((entry, i) => (
                    <li key={`${entry.yearLabel}-${i}`} className="leading-snug">
                      {entry.yearLabel ? (
                        <span className="font-semibold text-stone-800">{entry.yearLabel} </span>
                      ) : null}
                      {entry.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">今日史实条目加载中或尚未配置。</p>
              )}
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">势力高官</h3>
              {officialsWithPlayers.length ? (
                <ul className="space-y-2 text-xs text-stone-700">
                  {officialsWithPlayers.map((f) => (
                    <li key={f.factionId}>
                      <div className="font-semibold text-stone-800">{f.factionName || f.factionId}</div>
                      <p className="leading-snug text-stone-600">
                        一品：
                        {f.lv1Lines.length ? f.lv1Lines.join('、') : '虚位以待'}
                      </p>
                      <p className="leading-snug text-stone-600">
                        二品：
                        {f.lv2Lines.length ? f.lv2Lines.join('、') : '虚位以待'}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-500">{loading ? '加载中…' : '暂无高官任职信息。'}</p>
              )}
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2">游戏介绍</h3>
              {report?.introVideoUrl ? (
                <video controls className="w-full rounded border border-stone-200" src={report.introVideoUrl}>
                  <track kind="captions" />
                </video>
              ) : (
                <p className="text-xs text-stone-500">介绍视频筹备中。</p>
              )}
            </section>
          </div>
        </div>
      </div>    </PersonalCatalogModal>
  );
}
