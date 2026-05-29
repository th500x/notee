/**
 * CommPanel · 传书 Tab（原 CommPanel.jsx）
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { textsAPI } from '@/services/textsApi';
import { loadMultipleSharedData } from '@/services/dataService';
import { describeMailAttachments, buildCardItemMaps, linesFromClaimDetails } from '@/utils/mailRewardUi';
import {
  COMM_TAB_BODY_CLASS,
  COMM_TAB_SCROLL_CLASS,
  COMM_TAB_TOP_SLOT_CLASS,
  formatRelativeTime,
} from '@/components/comm/commPanelLayout';

/** 传书 Tab */
function TextMailTab({ playerId, onUnreadChange, onClaimed, onShowClaimResult, onShowClaimError }) {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [claimBusy, setClaimBusy] = useState(null);
  const [sharedBundle, setSharedBundle] = useState(null);

  const maps = useMemo(
    () => (sharedBundle ? buildCardItemMaps(sharedBundle) : {}),
    [sharedBundle]
  );
  const itemNameMap = useMemo(() => {
    const m = {};
    (sharedBundle?.items?.items || []).forEach((it) => {
      if (it.id) m[it.id] = it.name || it.id;
    });
    return m;
  }, [sharedBundle]);

  useEffect(() => {
    loadMultipleSharedData(['troops', 'characters', 'equipment', 'items'])
      .then(setSharedBundle)
      .catch(() => setSharedBundle({}));
  }, []);

  const loadTexts = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const r = await textsAPI.list(playerId);
      if (r.success) setTexts(r.texts);
    } catch (e) {
      console.error('[TextMailTab]', e);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadTexts();
  }, [loadTexts]);

  const toggleExpand = async (t) => {
    if (expandedId === t.textId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(t.textId);
    if (!t.isRead && playerId) {
      await textsAPI.markRead(playerId, t.textId);
      setTexts((prev) => prev.map((x) => (x.textId === t.textId ? { ...x, isRead: true } : x)));
      onUnreadChange?.();
    }
  };

  const handleClaim = async (t) => {
    if (!playerId || claimBusy) return;
    setClaimBusy(t.textId);
    try {
      const r = await textsAPI.claim(playerId, t.textId);
      if (r.success) {
        const details = r.details || r.data?.details || [];
        let lines = linesFromClaimDetails(details, { itemNameMap, ...maps });
        if (
          lines.length === 1 &&
          lines[0] === '（无额外物品）' &&
          t.attachments &&
          typeof t.attachments === 'object' &&
          Object.keys(t.attachments).length > 0
        ) {
          const fallback = describeMailAttachments(t.attachments, maps);
          if (fallback.length) {
            lines = [
              '（未收到服务端明细，以下为附件预览，若已达上限以实际到账为准）',
              ...fallback,
            ];
          }
        }
        onShowClaimResult?.(lines);
        setTexts((prev) => prev.map((x) => (x.textId === t.textId ? { ...x, isClaimed: true } : x)));
        window.setTimeout(() => {
          onClaimed?.();
          onUnreadChange?.();
        }, 0);
      } else {
        onShowClaimError?.(r.error || '领取失败');
      }
    } finally {
      setClaimBusy(null);
    }
  };

  if (!playerId) {
    return (
      <div className={COMM_TAB_BODY_CLASS}>
        <div className="flex-1 flex items-center justify-center text-amber-200/40 text-xs">加载角色中…</div>
      </div>
    );
  }

  return (
    <div className={COMM_TAB_BODY_CLASS}>
      <div className={COMM_TAB_TOP_SLOT_CLASS}>
        {/* 与 ChatTab 第一行（天下/势力/军团）同高同宽占位，使下一行「刷新」与聊天 Tab 对齐 */}
        <div className="invisible pointer-events-none flex px-1 py-0 gap-0.5 select-none" aria-hidden>
          <span className="flex-1 py-1 text-[10px] rounded text-center">天下</span>
          <span className="flex-1 py-1 text-[10px] rounded text-center">势力</span>
          <span className="flex-1 py-1 text-[10px] rounded text-center">军团</span>
        </div>
        <div className="flex justify-end px-1.5">
          <button
            type="button"
            onClick={() => loadTexts()}
            className="text-[10px] text-amber-400/70 hover:text-amber-300"
          >
            刷新
          </button>
        </div>
      </div>
      <div className={`${COMM_TAB_SCROLL_CLASS} p-1.5 space-y-1`}>
      {loading && <div className="text-center text-amber-200/40 text-xs py-2">加载中...</div>}
      {!loading && texts.length === 0 && (
        <div className="text-center text-amber-200/40 text-xs py-2">暂无传书</div>
      )}
      {!loading &&
        texts.map((t) => (
          <div key={t.textId} className="bg-black/30 rounded border border-amber-700/20 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-start gap-2 px-2 py-1.5 text-left hover:bg-amber-700/10"
              onClick={() => toggleExpand(t)}
            >
              <span className="text-[10px] shrink-0 mt-0.5">{t.isRead ? '　' : '🔴'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-100 truncate">{t.subject || '（无标题）'}</div>
                <div className="text-[10px] text-amber-200/50">
                  {t.senderName || '未知'} · {formatRelativeTime(t.createdAt)}
                  {t.type === 'reward' && (
                    <span className="ml-1">{t.isClaimed ? '· 已领' : '· 可领'}</span>
                  )}
                </div>
              </div>
              <span className="text-amber-200/40 text-[10px] shrink-0">{expandedId === t.textId ? '▲' : '▼'}</span>
            </button>
            {expandedId === t.textId && (
              <div className="px-2 py-1.5 border-t border-amber-700/20 space-y-2">
                <div className="text-[10px] text-amber-100/90 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {t.content || '（无正文）'}
                </div>
                {t.type === 'reward' && t.attachments && Object.keys(t.attachments).length > 0 && (() => {
                  const al = describeMailAttachments(t.attachments, maps);
                  if (!al.length) {
                    return (
                      <div className="text-[10px] text-amber-200/50 italic bg-black/20 rounded p-1.5">
                        （附件暂无法解析为可读项）
                      </div>
                    );
                  }
                  return (
                    <div className="text-[10px] text-amber-200/85 space-y-0.5 bg-black/20 rounded p-1.5">
                      {al.map((line, i) => (
                        <div key={i} className="leading-snug">
                          {line}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {t.type === 'reward' && !t.isClaimed && (
                  <button
                    type="button"
                    disabled={!!claimBusy}
                    onClick={() => handleClaim(t)}
                    className="w-full py-1.5 rounded bg-amber-700/50 text-amber-100 text-xs hover:bg-amber-600/50 disabled:opacity-50"
                  >
                    {claimBusy === t.textId ? '领取中…' : '领取附件'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TextMailTab;
