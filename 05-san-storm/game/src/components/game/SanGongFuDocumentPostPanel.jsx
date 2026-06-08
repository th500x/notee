/**
 * 三公府 · 朝政 · 文书发布（一品 position_level = 1，每日最多 3 条）
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { notifyFactionBulletinUnread } from '@/utils/factionBulletinReadState';

/** 与 backend sanGongDocumentService.MAX_BODY_LEN、32-6 日报节选一致 */
const MAX_LEN = 60;

/**
 * @param {{ playerId?: string|null, onPosted?: () => void }} props
 */
export default function SanGongFuDocumentPostPanel({ playerId, onPosted }) {
  const [status, setStatus] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!playerId) {
      setStatus(null);
      return;
    }
    try {
      const res = await playerAPI.getSanGongFuDocumentStatus(playerId);
      if (res.success) setStatus(res.data);
    } catch {
      /* ignore */
    }
  }, [playerId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onSubmit = useCallback(async () => {
    setToast(null);
    if (!playerId) return;
    const body = text.trim();
    if (!body) {
      setToast('请输入文书内容');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await playerAPI.postSanGongFuDocument(playerId, body);
      if (res.success) {
        setText('');
        setToast('文书已发布');
        await loadStatus();
        notifyFactionBulletinUnread();
        onPosted?.();
      } else {
        setToast(res.error || '发布失败');
      }
    } catch (e) {
      setToast(e?.message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  }, [playerId, text, submitting, loadStatus, onPosted]);

  if (!playerId) return null;

  const subLabel =
    status?.maxPerDay != null
      ? `${status.remainingToday ?? 0}/${status.maxPerDay}`
      : '—';

  return (
    <div className="shrink-0 rounded-lg border border-amber-800/35 bg-stone-900/40 px-2 py-2 text-left">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold text-amber-400/95">文书</div>
        <div className="text-[9px] tabular-nums text-amber-400/70">今日剩余 {subLabel}</div>
      </div>
      <p className="mb-2 text-[10px] leading-snug text-stone-500">
        一品官职（position_level = 1）可向本势力发布公告，显示于大地图「势力」Tab ·「公告 · 文书」。
      </p>
      {toast ? (
        <div className="mb-2 rounded border border-amber-800/40 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-100">
          {toast}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        disabled={!status?.canPost || submitting}
        rows={3}
        placeholder={status?.canPost ? '输入公告正文…' : status?.blockReason || '当前不可发布'}
        className="mb-2 w-full resize-none rounded border border-stone-700/60 bg-stone-950/80 px-2 py-1.5 text-[10px] text-stone-200 placeholder:text-stone-600 disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-stone-600">{text.length}/{MAX_LEN}</span>
        <button
          type="button"
          disabled={!status?.canPost || submitting || !text.trim()}
          onClick={onSubmit}
          className="rounded border border-amber-700/50 bg-amber-900/40 px-3 py-1 text-[10px] font-semibold text-amber-200 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? '发布中…' : '发布文书'}
        </button>
      </div>
    </div>
  );
}
