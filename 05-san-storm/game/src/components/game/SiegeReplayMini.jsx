/**
 * 攻城战报 · 简化回放（正式系统内嵌，与 public/demo-siege-replay.html 同逻辑）
 * 按战报行驱动：出击 → 受击抖动 → 飘字（不还原格子走位）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const STEP_MS = 750;

/** 从战报文本解析回合行（攻城 skirmish 格式） */
export function parseSiegeReplaySteps(battleLog, leftLabel, rightLabel) {
  const raw =
    typeof battleLog === 'string'
      ? battleLog.split('\n')
      : Array.isArray(battleLog)
        ? battleLog
        : [];
  const lines = raw.map((l) => (typeof l === 'object' && l?.text ? l.text : String(l))).filter(Boolean);
  const steps = [];
  const L = leftLabel || '左阵';
  const R = rightLabel || '右阵';

  for (const line of lines) {
    if (!line.includes('回合') || (!line.includes('造成') && !line.includes('损失'))) continue;
    const dmgMatch = line.match(/造成\s*(\d+)\s*损失/) || line.match(/造成\s*(\d+)/);
    const lossOnly = !dmgMatch && /损失\s*(\d+)/.test(line);
    const lossMatch = lossOnly ? line.match(/损失\s*(\d+)/) : null;
    if (!dmgMatch && !lossMatch) continue;
    const damage = parseInt((dmgMatch || lossMatch)[1], 10);
    if (!Number.isFinite(damage) || damage <= 0) continue;
    const crit = line.includes('暴击');
    const m = line.match(/第\d+回合[：:]\s*(.+?)\s+对\s+(.+?)\s+/);
    let side = 'atk';
    if (lossOnly && /守军[^。]*遭[^。]*攻城/.test(line)) {
      side = 'def';
    } else if (m) {
      const striker = m[1].trim();
      const lHit = L.length > 0 && (striker.includes(L) || L.split(/[·\s]/).some((p) => p && striker.includes(p)));
      const rHit = R.length > 0 && (striker.includes(R) || R.split(/[·\s]/).some((p) => p && striker.includes(p)));
      if (rHit && !lHit) side = 'def';
      else if (lHit) side = 'atk';
      else {
        const iL = line.indexOf(L.slice(0, Math.min(3, L.length)));
        const iR = line.indexOf(R.slice(0, Math.min(3, R.length)));
        if (iR !== -1 && (iL === -1 || iR < iL)) side = 'def';
      }
    } else if (/守军[^。]*反击[^。]*攻城/.test(line)) {
      side = 'atk';
    }
    steps.push({ side, damage, crit, text: line });
  }
  return steps;
}

export default function SiegeReplayMini({
  open,
  onClose,
  battleLog,
  leftLabel = '攻城方',
  rightLabel = '守军',
  leftPortraitUrl,
  rightPortraitUrl,
}) {
  const steps = useMemo(
    () => parseSiegeReplaySteps(battleLog, leftLabel, rightLabel),
    [battleLog, leftLabel, rightLabel],
  );
  const [playing, setPlaying] = useState(false);
  const [hi, setHi] = useState(-1);
  const [atkHp, setAtkHp] = useState(3000);
  const [defHp, setDefHp] = useState(3000);
  const mounted = useRef(true);
  const playingRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resetHp = useCallback(() => {
    setAtkHp(3000);
    setDefHp(3000);
  }, []);

  const playAll = useCallback(async () => {
    if (!steps.length || playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    resetHp();
    setHi(-1);
    for (let i = 0; i < steps.length; i++) {
      if (!mounted.current) break;
      setHi(i);
      const s = steps[i];
      if (s.side === 'atk') setDefHp((h) => Math.max(0, h - s.damage));
      else setAtkHp((h) => Math.max(0, h - s.damage));
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
    playingRef.current = false;
    if (mounted.current) setPlaying(false);
  }, [steps, resetHp]);

  useEffect(() => {
    if (!open || !steps.length) return undefined;
    const t = window.setTimeout(() => playAll(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 open / 行数变化时自动播
  }, [open, steps.length]);

  if (!open) return null;

  const cur = hi >= 0 ? steps[hi] : null;
  const leftLunge = cur?.side === 'atk';
  const leftHit = cur?.side === 'def';
  const rightHit = cur?.side === 'atk';
  const rightLunge = cur?.side === 'def';

  return (
    <div className="rounded-lg border border-amber-700/35 bg-[#12121e] p-3 text-[#e0d5c0]">
      <p className="text-center text-[11px] text-stone-500 mb-2">
        按战报顺序：出击 → 受击抖动 → 飘字（不还原格子走位）
      </p>
      <div className="text-[10px] text-center text-stone-500 mb-2">对阵</div>
      <div className="flex justify-between gap-2 items-end mb-2">
        <div
          className={`flex-1 min-h-[100px] rounded-lg p-2 flex flex-col items-center justify-center border transition-all ${
            leftLunge
              ? 'border-blue-500/80 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
              : leftHit
                ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.35)] animate-pulse'
                : 'border-blue-500/35 bg-gradient-to-b from-[#1a2a4a] to-[#121a2e]'
          }`}
        >
          {leftPortraitUrl ? (
            <img src={leftPortraitUrl} alt="" className="w-14 h-14 object-contain mb-1" />
          ) : (
            <span className="text-3xl mb-1">⚔️</span>
          )}
          <div className="text-[11px] font-bold text-amber-500/95 text-center leading-tight">{leftLabel}</div>
          <div className="text-[9px] text-stone-500 mt-1">约 {atkHp}</div>
        </div>
        <div
          className={`flex-1 min-h-[100px] rounded-lg p-2 flex flex-col items-center justify-center border transition-all ${
            rightLunge
              ? 'border-blue-500/80 shadow-[0_0_16px_rgba(59,130,246,0.45)]'
              : rightHit
                ? 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.35)] animate-pulse'
                : 'border-red-500/35 bg-gradient-to-b from-[#4a1a1a] to-[#2e1212]'
          }`}
        >
          {rightPortraitUrl ? (
            <img src={rightPortraitUrl} alt="" className="w-14 h-14 object-contain mb-1" />
          ) : (
            <span className="text-3xl mb-1">🛡️</span>
          )}
          <div className="text-[11px] font-bold text-amber-500/95 text-center leading-tight">{rightLabel}</div>
          <div className="text-[9px] text-stone-500 mt-1">约 {defHp}</div>
        </div>
      </div>
      <div className="text-[10px] text-stone-400 border-t border-stone-700/50 pt-2 max-h-28 overflow-y-auto space-y-0.5 leading-snug">
        {steps.length === 0 && <div className="text-stone-500 text-center py-2">未解析到回合战报行</div>}
        {steps.map((s, i) => (
          <div key={i} className={i === hi ? 'text-amber-100/95' : 'text-stone-500/55'}>
            {s.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-stone-700/40">
        <button
          type="button"
          disabled={playing || !steps.length}
          onClick={() => playAll()}
          className="px-5 py-1.5 rounded-md border border-amber-600/50 bg-stone-900 text-amber-400 text-xs min-w-[5rem] disabled:opacity-40"
        >
          重播
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-1.5 rounded-md border border-stone-600/50 bg-stone-900 text-stone-400 text-xs min-w-[5rem] hover:border-stone-500"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
