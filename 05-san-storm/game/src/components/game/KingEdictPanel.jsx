/**
 * 大地图左下角「口谕」—— AI 君主闲聊 / 主动决策动向入口（M2）
 *
 * 收起态按钮叠放顺序（自下而上）：💬 通信 → 🏆 排行 → 📜 口谕（本组件）
 *
 * 文案优先级：
 *   1. 「最近主动决策动向」（`warAPI.getKingRecentDecision`）：若君主近 60 分钟内抽到
 *      战事意图（无论是否真发动），且本账号尚未展示过该次决策 → 用 `buildKingActiveDecisionLine`
 *      生成文言一句覆盖；展示后写 localStorage 标记同 decisionKey 不再重复。
 *   2. 闲聊池：`game/src/data/texts/kingSpeechCasualChat.zh.json` · `casualChat[speechStyle]`，
 *      按 hash 槽 + speechStyle + playerId 选句。
 *
 * `speechStyle`：`public/data/shared/ai-kings.json` 按玩家 `factionId` 匹配；无则 benevolent。
 *
 * 节律：每个自然小时内按 0–19 / 20–39 / 40–59 分三段（每段约 20 分钟）换槽；
 * 槽变化时刷新一句并重置 👍👎；首次进入该槽或本账号首次见到口谕时自动展开。
 *
 * 口谕互动：`POST /api/players/:playerId/king-edict-feedback` — body 含 `reaction` 与可选 `scope`（`casual`|`active_war`）；
 * 👍 随机银两 20～60，👎 随机声望 0～2；闲聊与主动战事口谕分轨幂等。成功后在正文下展示文言一行，2 秒后自动关窗；
 * 本槽已领状态写入 localStorage，关窗后再开仍保持按钮锁定。
 *
 * @see docs/01-jun-exploration/30-frontend/32-5-PLAYER_CORNER.md §4 · docs/01-jun-exploration/40-ai/41-1-AI_KING_SYSTEM.md
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadSharedData } from '@/services/dataService';
import { kingSpeechCasualChatZh } from '@/data/texts';
import { buildKingActiveDecisionLine } from '@/data/texts/kingActiveDecisionLines';
import { warAPI } from '@/services/warApi';
import { playerAPI } from '@/services/playerApi';
import { usePlayerRefresh } from '@/contexts/PlayerContext';
import { useRegisterMapCornerEntryHandler } from '@/contexts/MapCornerPlayerEntryActionsContext';
import { useMapCornerCompactViewport } from '@/hooks/useMapCornerCompactViewport';
import {
  MAP_CORNER_ENTRY_ROW_CLASS,
  mapCornerEntryRowBoxStyle,
} from '@/components/game/mapCornerEntryUi';

/** 每自然小时三槽：0–19 / 20–39 / 40–59 分 */
function getSlotBoundaryKey(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = d.getHours();
  const slot = Math.floor(d.getMinutes() / 20);
  return `${y}-${mo}-${da}_${h}_${slot}`;
}

/** 与 `kingEdictFeedbackService` 的 `scope` 一致，用于本机恢复 👍👎 锁定态 */
function feedbackStorageKey(playerId, slotKey, scope) {
  const s = scope === 'active_war' ? 'active_war' : 'casual';
  return `king_edict_feedback_${playerId}_${slotKey}_${s}`;
}

function readPersistedFeedback(playerId, slotKey, scope) {
  try {
    const v = localStorage.getItem(feedbackStorageKey(playerId, slotKey, scope));
    return v === 'up' || v === 'down' ? v : null;
  } catch {
    return null;
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function KingEdictPanel({ visible, playerId, factionId }) {
  const refresh = usePlayerRefresh();
  const [open, setOpen] = useState(false);
  const [speechStyle, setSpeechStyle] = useState('benevolent');
  /** 展示前缀，如灵帝、天公、玄德（与 `ai-kings.courtesyName` 一致） */
  const [courtesyName, setCourtesyName] = useState('君主');
  const [line, setLine] = useState('');
  /** 当前句是否来自「主动决策」战事口谕（与闲聊池区分样式） */
  const [lineIsActiveDecision, setLineIsActiveDecision] = useState(false);
  /** 已选 👍 / 👎 且请求已结束（成功则锁定至关窗；失败可重试） */
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  /** 嘉奖结果文言（红框区叠加一行） */
  const [rewardLine, setRewardLine] = useState('');
  const [submitError, setSubmitError] = useState('');
  /** 防 `applySlot` 重入引用（fetch 异步期间避免被 interval 再次调起） */
  const inFlightRef = useRef(false);
  const autoCloseTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current != null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!factionId) {
      setSpeechStyle('benevolent');
      setCourtesyName('君主');
      return;
    }
    let cancelled = false;
    loadSharedData('ai-kings')
      .then((data) => {
        if (cancelled) return;
        const kings = data?.kings;
        const row = Array.isArray(kings) ? kings.find((k) => k.factionId === factionId) : null;
        const style = row?.speechStyle;
        if (typeof style === 'string' && style) setSpeechStyle(style);
        else setSpeechStyle('benevolent');
        const courtesy =
          typeof row?.courtesyName === 'string' && row.courtesyName.trim()
            ? row.courtesyName.trim()
            : typeof row?.characterName === 'string' && row.characterName.trim()
              ? row.characterName.trim()
              : '君主';
        setCourtesyName(courtesy);
      })
      .catch(() => {
        if (!cancelled) {
          setSpeechStyle('benevolent');
          setCourtesyName('君主');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [factionId]);

  const pool = useMemo(() => {
    const buckets = kingSpeechCasualChatZh?.casualChat || {};
    const arr = buckets[speechStyle] || buckets.benevolent || [];
    return Array.isArray(arr) && arr.length ? arr : ['……'];
  }, [speechStyle]);

  const applySlot = useCallback(async () => {
    if (!playerId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const slotKey = getSlotBoundaryKey();
      const seenSlotKey = `king_edict_seen_slot_${playerId}`;
      const prevSeenSlot = localStorage.getItem(seenSlotKey);

      // 闲聊兜底（无论后端动向是否命中，都先算好兜底文案，避免空白）
      const fallbackIdx = hashString(`${slotKey}|${speechStyle}|${playerId}`) % pool.length;
      const fallbackLine = pool[fallbackIdx] || '……';

      // 先尝试后端「最近主动决策动向」；命中战事意图且未展示过则覆盖
      let decisionLine = null;
      let decisionKey = null;
      if (factionId) {
        try {
          const resp = await warAPI.getKingRecentDecision(factionId);
          const decision = resp?.success ? resp.data : null;
          if (decision) {
            decisionKey = `${decision.factionId}|${decision.decidedAt}`;
            const seenDecisionsKey = `king_edict_seen_decisions_${playerId}`;
            let seen = [];
            try {
              seen = JSON.parse(localStorage.getItem(seenDecisionsKey) || '[]');
            } catch {
              seen = [];
            }
            if (!Array.isArray(seen)) seen = [];
            if (!seen.includes(decisionKey)) {
              const text = buildKingActiveDecisionLine(decision);
              if (text) {
                decisionLine = text;
                const updated = [...seen, decisionKey].slice(-20);
                localStorage.setItem(seenDecisionsKey, JSON.stringify(updated));
              }
            }
          }
        } catch {
          // 网络/接口异常 → 静默回退到闲聊文案；不阻塞 UI
        }
      }

      const finalLine = decisionLine || fallbackLine;
      setLine(finalLine);
      setLineIsActiveDecision(!!decisionLine);

      const feedbackScope = decisionLine ? 'active_war' : 'casual';
      setFeedback(readPersistedFeedback(playerId, slotKey, feedbackScope));

      // 展开规则：本槽首次见到 / 命中新主动决策 都自动展开；👍👎 由本槽+scope 的 localStorage 恢复，不在这里清空
      if (prevSeenSlot !== slotKey || decisionLine) {
        setOpen(true);
        localStorage.setItem(seenSlotKey, slotKey);
        setRewardLine('');
        setSubmitError('');
        setSubmitting(false);
        if (autoCloseTimerRef.current != null) {
          clearTimeout(autoCloseTimerRef.current);
          autoCloseTimerRef.current = null;
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [playerId, speechStyle, pool, factionId]);

  useEffect(() => {
    if (!visible || !playerId) return undefined;
    applySlot();
    const id = setInterval(applySlot, 15000);
    return () => clearInterval(id);
  }, [visible, playerId, applySlot]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const scheduleAutoClose = useCallback(() => {
    if (autoCloseTimerRef.current != null) {
      clearTimeout(autoCloseTimerRef.current);
    }
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setOpen(false);
      setRewardLine('');
      setSubmitError('');
      setSubmitting(false);
    }, 2000);
  }, []);

  const onFeedbackClick = useCallback(
    async (reaction) => {
      if (!playerId || feedback != null || submitting) return;
      setSubmitting(true);
      setSubmitError('');
      setRewardLine('');
      try {
        const slotKey = getSlotBoundaryKey();
        const scope = lineIsActiveDecision ? 'active_war' : 'casual';
        const resp = await playerAPI.submitKingEdictFeedback(playerId, { reaction, scope });
        if (!resp?.success) {
          setSubmitError(resp?.error || '口谕嘉奖失败');
          setSubmitting(false);
          return;
        }
        const msg = resp.data?.message;
        if (typeof msg === 'string' && msg.trim()) {
          setRewardLine(msg.trim());
        } else {
          setSubmitError('服务端未返回嘉奖文言');
          setSubmitting(false);
          return;
        }
        setFeedback(reaction);
        try {
          localStorage.setItem(feedbackStorageKey(playerId, slotKey, scope), reaction);
        } catch {
          /* ignore quota / 隐私模式 */
        }
        setSubmitting(false);
        refresh({ silent: true });
        scheduleAutoClose();
      } catch (e) {
        setSubmitError(e?.message || String(e));
        setSubmitting(false);
      }
    },
    [playerId, feedback, submitting, lineIsActiveDecision, refresh, scheduleAutoClose],
  );

  const compactViewport = useMapCornerCompactViewport();
  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);
  useRegisterMapCornerEntryHandler('edict', visible && playerId ? openPanel : null);

  if (!visible || !playerId) return null;

  const backdropClosable = !rewardLine;

  return (
    <>
      {!compactViewport ? (
        <button
          type="button"
          onClick={openPanel}
          style={mapCornerEntryRowBoxStyle}
          className={`fixed bottom-44 left-2 z-40 justify-start text-amber-300 ${MAP_CORNER_ENTRY_ROW_CLASS}`}
        >
          <span className="block w-full min-w-0 truncate text-left">📜 口谕</span>
        </button>
      ) : null}

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-3 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="king-edict-title"
          onClick={() => {
            if (backdropClosable) setOpen(false);
          }}
        >
          <div
            className="w-[min(100%,24rem)] sm:w-[400px] flex flex-col rounded-lg shadow-lg overflow-hidden border border-amber-700/40 bg-gray-900/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 px-2 py-2 bg-amber-800/80 shrink-0 border-b border-amber-700/30">
              <span id="king-edict-title" className="text-sm font-bold text-amber-100 shrink-0">
                口谕
              </span>
              <button
                type="button"
                onClick={() => {
                  if (autoCloseTimerRef.current != null) {
                    clearTimeout(autoCloseTimerRef.current);
                    autoCloseTimerRef.current = null;
                  }
                  setOpen(false);
                  setRewardLine('');
                  setSubmitError('');
                  setSubmitting(false);
                }}
                className="px-2 py-1 text-amber-200/70 hover:text-amber-100 text-sm shrink-0"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="px-3 py-3 text-sm leading-relaxed min-h-[4.5rem] flex flex-col gap-2">
              <div>
                <span
                  className={`font-medium ${lineIsActiveDecision ? 'text-red-300' : 'text-amber-200'}`}
                >
                  {courtesyName}
                </span>
                <span className={lineIsActiveDecision ? 'text-red-400' : 'text-amber-100/90'}>
                  ：{line || '……'}
                </span>
              </div>
              {(rewardLine || submitError) && (
                <p
                  className={`text-sm font-medium ${submitError ? 'text-red-400' : 'text-emerald-300'}`}
                >
                  {submitError || rewardLine}
                </p>
              )}
            </div>
            <div className="px-3 pb-3 pt-0 flex items-center justify-center gap-4 border-t border-amber-700/20">
              <button
                type="button"
                disabled={submitting}
                className={`rounded-lg px-4 py-2 text-lg transition-colors ${
                  feedback === 'up'
                    ? 'bg-amber-700/50 text-amber-100'
                    : 'bg-black/40 text-amber-200/80 hover:bg-black/60'
                } ${
                  feedback != null && feedback !== 'up'
                    ? 'opacity-40 cursor-not-allowed pointer-events-none'
                    : ''
                } ${feedback === 'up' ? 'pointer-events-none' : ''} ${submitting ? 'opacity-50 cursor-wait' : ''}`}
                aria-label="赞同"
                aria-pressed={feedback === 'up'}
                title="领银两嘉奖"
                onClick={() => onFeedbackClick('up')}
              >
                👍
              </button>
              <button
                type="button"
                disabled={submitting}
                className={`rounded-lg px-4 py-2 text-lg transition-colors ${
                  feedback === 'down'
                    ? 'bg-amber-700/50 text-amber-100'
                    : 'bg-black/40 text-amber-200/80 hover:bg-black/60'
                } ${
                  feedback != null && feedback !== 'down'
                    ? 'opacity-40 cursor-not-allowed pointer-events-none'
                    : ''
                } ${feedback === 'down' ? 'pointer-events-none' : ''} ${submitting ? 'opacity-50 cursor-wait' : ''}`}
                aria-label="不赞同"
                aria-pressed={feedback === 'down'}
                title="领声望嘉奖"
                onClick={() => onFeedbackClick('down')}
              >
                👎
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
