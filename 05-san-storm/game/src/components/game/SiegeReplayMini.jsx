/**
 * 攻城战报 · 简化回放
 * 左=攻方、右=守军；仅解析带 [攻方]/[守军] 的推演原文（与 siegePvpSkirmish 一致）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const STEP_MS = 750;
const ROUND_HDR = /^═══\s*第\s*(\d+)\s*回合\s*═══$/;
const STRIKE_LINE = /^第\s*(\d+)\s*次攻击[：:]\s*(.+)$/;

function pushStrike(timeline, roundNum, k, side, damage, crit, dodge, displayText, rawLine) {
  timeline.push({
    kind: 'STRIKE',
    roundNum,
    strikeInRound: k,
    side,
    damage,
    crit: !!crit,
    dodge: !!dodge,
    displayText,
    detailText: displayText,
    rawLine,
  });
}

function hitOrCrit(rawLine) {
  if (rawLine.includes('暴击')) return '（暴击）';
  return '（命中）';
}

function tryTaggedStrikeBody(roundNum, k, restLine, rawLine, timeline) {
  const rest = restLine.trim();
  const tailTag = hitOrCrit(rawLine);

  const tagged = rest.match(/^\[攻方\](.+?) 对 \[守军\](.+?) 造成 (\d+) 损失/);
  if (tagged) {
    const damage = parseInt(tagged[3], 10);
    if (!Number.isFinite(damage) || damage <= 0) return;
    const displayText = `[攻方]${tagged[1].trim()} 对 [守军]${tagged[2].trim()} 造成 ${damage} 损失${tailTag}`;
    pushStrike(timeline, roundNum, k, 'atk', damage, rawLine.includes('暴击'), false, displayText, rawLine);
    return;
  }
  const taggedRev = rest.match(/^\[守军\](.+?) 对 \[攻方\](.+?) 造成 (\d+) 损失/);
  if (taggedRev) {
    const damage = parseInt(taggedRev[3], 10);
    if (!Number.isFinite(damage) || damage <= 0) return;
    const displayText = `[守军]${taggedRev[1].trim()} 对 [攻方]${taggedRev[2].trim()} 造成 ${damage} 损失${tailTag}`;
    pushStrike(timeline, roundNum, k, 'def', damage, rawLine.includes('暴击'), false, displayText, rawLine);
    return;
  }

  const dodgeTag = rest.match(/^\[(攻方|守军)\](.+?) 攻击被闪避。$/);
  if (dodgeTag) {
    const sideLab = dodgeTag[1];
    const name = dodgeTag[2].trim();
    const side = sideLab === '攻方' ? 'atk' : 'def';
    const displayText = `[${sideLab}]${name} 攻击被闪避`;
    pushStrike(timeline, roundNum, k, side, 0, false, true, displayText, rawLine);
  }
}

/**
 * @returns {{ timeline: Array<object>, animSteps: Array<object> }}
 */
export function parseSiegeReplayTimeline(battleLog) {
  const raw =
    typeof battleLog === 'string'
      ? battleLog.split('\n')
      : Array.isArray(battleLog)
        ? battleLog
        : [];
  const lines = raw.map((l) => (typeof l === 'object' && l?.text ? l.text : String(l))).filter(Boolean);
  const timeline = [];
  let tacticalRound = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('【') || trimmed.startsWith('守方') || trimmed.startsWith('来犯') || trimmed === '────────') {
      continue;
    }
    if (trimmed.startsWith('（与同场') || trimmed.startsWith('（以下为')) {
      continue;
    }
    if (trimmed.startsWith('（守城）')) {
      continue;
    }
    if (/交战前|战斗结束|战术回合上限|全军覆没|已无兵/.test(trimmed)) {
      continue;
    }

    const hdr = trimmed.match(ROUND_HDR);
    if (hdr) {
      tacticalRound = parseInt(hdr[1], 10);
      timeline.push({ kind: 'ROUND', roundNum: tacticalRound });
      continue;
    }

    const sk = trimmed.match(STRIKE_LINE);
    if (sk && tacticalRound != null) {
      const k = parseInt(sk[1], 10);
      const rest = sk[2].trim();
      tryTaggedStrikeBody(tacticalRound, k, rest, trimmed, timeline);
    }
  }

  const animSteps = timeline.filter((x) => x.kind === 'STRIKE');
  animSteps.forEach((s, i) => {
    s.animIndex = i;
  });
  return { timeline, animSteps };
}

function normalizeTroopProp(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export default function SiegeReplayMini({
  open,
  onClose,
  battleLog,
  leftLabel = '攻方',
  rightLabel = '守军',
  leftPortraitUrl,
  rightPortraitUrl,
  initialAttackerTroops,
  initialDefenderTroops,
  /** 自动播完一轮后回调（用于裁定后先演示再进结算）；点「关闭」也会触发一次 */
  onPlaybackComplete,
}) {
  const atkStart = normalizeTroopProp(initialAttackerTroops);
  const defStart = normalizeTroopProp(initialDefenderTroops);
  const hasTroopBar = atkStart != null && defStart != null;

  const { timeline, animSteps } = useMemo(
    () => parseSiegeReplayTimeline(battleLog),
    [battleLog],
  );
  const [playing, setPlaying] = useState(false);
  const [hi, setHi] = useState(-1);
  const [atkHp, setAtkHp] = useState(() => (hasTroopBar ? atkStart : null));
  const [defHp, setDefHp] = useState(() => (hasTroopBar ? defStart : null));
  const mounted = useRef(true);
  const playingRef = useRef(false);
  const playbackCompleteFiredRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) playbackCompleteFiredRef.current = false;
  }, [open]);

  useEffect(() => {
    if (hasTroopBar) {
      setAtkHp(atkStart);
      setDefHp(defStart);
    } else {
      setAtkHp(null);
      setDefHp(null);
    }
  }, [hasTroopBar, atkStart, defStart]);

  const resetHp = useCallback(() => {
    if (hasTroopBar) {
      setAtkHp(atkStart);
      setDefHp(defStart);
    }
  }, [hasTroopBar, atkStart, defStart]);

  const firePlaybackCompleteOnce = useCallback(() => {
    if (playbackCompleteFiredRef.current) return;
    playbackCompleteFiredRef.current = true;
    try {
      onPlaybackComplete?.();
    } catch (_) {
      /* 回调异常不阻断关闭 */
    }
  }, [onPlaybackComplete]);

  const playAll = useCallback(async () => {
    if (!animSteps.length || playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    resetHp();
    setHi(-1);
    for (let i = 0; i < animSteps.length; i++) {
      if (!mounted.current) break;
      setHi(i);
      const s = animSteps[i];
      if (hasTroopBar && s.damage > 0) {
        if (s.side === 'atk') setDefHp((h) => Math.max(0, (h ?? 0) - s.damage));
        else setAtkHp((h) => Math.max(0, (h ?? 0) - s.damage));
      }
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
    playingRef.current = false;
    if (mounted.current) setPlaying(false);
    if (mounted.current) firePlaybackCompleteOnce();
  }, [animSteps, resetHp, hasTroopBar, firePlaybackCompleteOnce]);

  useEffect(() => {
    if (!open) return undefined;
    if (!animSteps.length) {
      const t = window.setTimeout(() => firePlaybackCompleteOnce(), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => playAll(), 0);
    return () => {
      window.clearTimeout(t);
      playingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次打开/条数变化时自动播一遍
  }, [open, animSteps.length, playAll, firePlaybackCompleteOnce]);

  const cur = hi >= 0 ? animSteps[hi] : null;
  const leftLunge = cur?.side === 'atk';
  const leftHit = cur?.side === 'def';
  const rightHit = cur?.side === 'atk';
  const rightLunge = cur?.side === 'def';

  const strikeMatchesHighlight = (s) =>
    cur && s.roundNum === cur.roundNum && s.strikeInRound === cur.strikeInRound && s.rawLine === cur.rawLine;

  if (!open) return null;

  return (
    <div className="rounded-lg border border-amber-700/35 bg-[#12121e] p-3 text-[#e0d5c0]">
      <p className="text-center text-[11px] text-stone-500 mb-2 leading-snug">
        与战报同源：「═══ 第 T 回合 ═══」为战术回合；每条记录均有 [攻方]/[守军] 将领前缀。左为攻方、右为守军。
      </p>
      <div className="text-[10px] text-center text-stone-500 mb-2">对阵</div>
      <div className="flex justify-between gap-2 items-end mb-2">
        <div
          className={`flex-1 min-h-[100px] rounded-lg p-2 flex flex-col items-center justify-center border transition-all ${
            leftLunge
              ? 'border-blue-500/80 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
              : leftHit
                ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.35) animate-pulse'
                : 'border-blue-500/35 bg-gradient-to-b from-[#1a2a4a] to-[#121a2e]'
          }`}
        >
          {leftPortraitUrl ? (
            <img src={leftPortraitUrl} alt="" className="w-14 h-14 object-contain mb-1" />
          ) : (
            <span className="text-3xl mb-1">⚔️</span>
          )}
          <div className="text-[11px] font-bold text-amber-500/95 text-center leading-tight">{leftLabel}</div>
          <div className="text-[9px] text-stone-500 mt-1">
            {hasTroopBar ? `约 ${atkHp ?? atkStart}` : '—'}
          </div>
        </div>
        <div
          className={`flex-1 min-h-[100px] rounded-lg p-2 flex flex-col items-center justify-center border transition-all ${
            rightLunge
              ? 'border-blue-500/80 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
              : rightHit
                ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.35) animate-pulse'
                : 'border-red-500/35 bg-gradient-to-b from-[#4a1a1a] to-[#2e1212]'
          }`}
        >
          {rightPortraitUrl ? (
            <img src={rightPortraitUrl} alt="" className="w-14 h-14 object-contain mb-1" />
          ) : (
            <span className="text-3xl mb-1">🛡️</span>
          )}
          <div className="text-[11px] font-bold text-amber-500/95 text-center leading-tight">{rightLabel}</div>
          <div className="text-[9px] text-stone-500 mt-1">
            {hasTroopBar ? `约 ${defHp ?? defStart}` : '—'}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-stone-400 border-t border-stone-700/50 pt-2 max-h-48 overflow-y-auto space-y-2 leading-snug">
        {timeline.length === 0 && (
          <div className="text-stone-500 text-center py-2">未解析到战报行</div>
        )}
        {timeline.map((item, i) => {
          if (item.kind === 'ROUND') {
            return (
              <div key={`r-${i}-${item.roundNum}`} className="text-[11px] text-amber-200/90 font-bold text-center tracking-wide border-b border-stone-700/40 pb-1">
                ═══ 第 {item.roundNum} 回合 ═══
              </div>
            );
          }
          const hl = strikeMatchesHighlight(item);
          const showText = item.displayText || item.detailText;
          return (
            <div
              key={`s-${i}-${item.roundNum}-${item.strikeInRound}-${item.rawLine?.slice(0, 12)}`}
              className={`rounded px-1 py-0.5 ${hl ? 'bg-amber-950/35 border border-amber-600/35 text-amber-100/95' : ''}`}
            >
              <div className="text-[10px] text-stone-400 pl-1">
                第 {item.strikeInRound} 次攻击
                {item.dodge ? ' · 闪避' : ''}
                {item.crit ? ' · 暴击' : ''}
              </div>
              <div className="text-[10px] pl-2 text-stone-300/90">{showText}</div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-stone-700/40">
        <button
          type="button"
          disabled={playing || !animSteps.length}
          onClick={() => playAll()}
          className="px-5 py-1.5 rounded-md border border-amber-600/50 bg-stone-900 text-amber-400 text-xs min-w-[5rem] disabled:opacity-40"
        >
          重播
        </button>
        <button
          type="button"
          onClick={() => {
            playingRef.current = false;
            firePlaybackCompleteOnce();
            onClose?.();
          }}
          className="px-5 py-1.5 rounded-md border border-stone-600/50 bg-stone-900 text-stone-400 text-xs min-w-[5rem] hover:border-stone-500"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
