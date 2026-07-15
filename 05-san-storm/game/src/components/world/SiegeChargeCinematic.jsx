/**
 * 攻城冲锋动画：左右对冲 → 伪互砍 → 终帧对齐真实胜负残兵。
 * 部队 UI 与棋盘战斗一致（TroopLayer）。
 * 过程不跟战序；终局以 attackerWon + *TroopsEnd 为准。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TroopLayer from '@/components/battle/TroopLayer';
import '@/components/battle/BattleMap.css';

const PHASE_MS = {
  face: 700,
  charge: 1100,
  clash: 1800,
  resolve: 900,
};

const TOTAL_MS =
  PHASE_MS.face + PHASE_MS.charge + PHASE_MS.clash + PHASE_MS.resolve;

function troopLabel(u) {
  if (!u) return '部队';
  return String(u.displayName || u.name || '部队');
}

function troopHp(u) {
  const raw = u?.currentTroops;
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.round(Number(raw)));
  }
  // 旧快照 / NPC 缺 currentTroops：alive!==false 时按满编展示
  if (u?.alive === false) return 0;
  return Math.max(0, Math.round(Number(u?.maxTroops) || 0));
}

function troopMax(u) {
  return Math.max(troopHp(u), Math.round(Number(u?.maxTroops) || 0), 1);
}

/**
 * 兼容旧权威快照：整侧 currentTroops 全为 0 但有 maxTroops（NPC 未写 currentTroops 被当成 0）。
 * 仅用于冲锋过程展示；终帧仍用 *TroopsEnd。
 */
function hydrateAllZeroAsFull(units) {
  const list = Array.isArray(units) ? units : [];
  if (!list.length) return list;
  const allZeroWithMax = list.every(
    (u) =>
      Math.round(Number(u?.currentTroops) || 0) <= 0 &&
      Math.round(Number(u?.maxTroops) || 0) > 0,
  );
  if (!allZeroWithMax) return list;
  return list.map((u) => ({
    ...u,
    currentTroops: Math.round(Number(u.maxTroops) || 0),
  }));
}

/** 冲锋列：与棋盘 TroopLayer 同形的轻量 troop */
function toLayerTroop(u, side, i) {
  const faction = side === 'atk' ? 'player' : 'enemy';
  const maxTroops = troopMax(u);
  const currentTroops = troopHp(u);
  const id = u?.id || u?.troopId || `${side}_${i}`;
  return {
    id: String(id),
    troopId: u?.troopId || u?.id || null,
    name: u?.name || troopLabel(u),
    displayName: troopLabel(u),
    faction,
    rarity: u?.rarity || 'common',
    troopType: u?.troopType || null,
    weaponType: u?.weaponType || null,
    maxTroops,
    currentTroops,
    morale: Number.isFinite(Number(u?.morale)) ? Math.round(Number(u.morale)) : 100,
    imgPortraitAttempts: u?.imgPortraitAttempts,
  };
}

function SideColumn({ units, side, phase, flashIdx }) {
  const isAtk = side === 'atk';
  return (
    <div className={`flex flex-col gap-2 w-[42%] ${isAtk ? 'items-start' : 'items-end'}`}>
      {(units || []).map((u, i) => {
        const hp = troopHp(u);
        const gone = hp <= 0;
        const flash = flashIdx === i && phase === 'clash';
        const offset =
          phase === 'face'
            ? 0
            : phase === 'charge'
              ? isAtk
                ? 28
                : -28
              : phase === 'clash'
                ? isAtk
                  ? 48
                  : -48
                : isAtk
                  ? 36
                  : -36;
        const layerTroop = toLayerTroop(u, side, i);
        return (
          <div
            key={`${side}-${i}-${troopLabel(u)}`}
            className={`relative transition-all duration-500 ${
              gone ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100'
            } ${flash ? 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)] rounded-sm' : ''}`}
            style={{
              transform: `translateX(${offset}px) ${flash ? 'scale(1.04)' : ''}`,
            }}
          >
            {/* 与棋盘格比例接近的部队容器，供 TroopLayer 绝对定位铺满 */}
            <div
              className="relative overflow-hidden rounded-sm border border-white/10 bg-black/35"
              style={{ width: 88, height: 88 }}
            >
              <TroopLayer troop={layerTroop} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   leftLabel?: string,
 *   rightLabel?: string,
 *   attackerWon: boolean,
 *   initialAttackerTroops?: object[],
 *   initialDefenderTroops?: object[],
 *   attackerTroopsEnd?: object[],
 *   defenderTroopsEnd?: object[],
 *   onComplete?: () => void,
 * }} props
 */
export default function SiegeChargeCinematic({
  open,
  title = '攻城战',
  leftLabel = '攻方',
  rightLabel = '守军',
  attackerWon,
  initialAttackerTroops = [],
  initialDefenderTroops = [],
  attackerTroopsEnd = [],
  defenderTroopsEnd = [],
  onComplete,
}) {
  const [phase, setPhase] = useState('face');
  const [flashIdx, setFlashIdx] = useState(-1);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const atkLen = initialAttackerTroops?.length || 1;

  const displayAtk = useMemo(() => {
    if (phase === 'resolve' || done) {
      return attackerTroopsEnd?.length ? attackerTroopsEnd : initialAttackerTroops;
    }
    return hydrateAllZeroAsFull(initialAttackerTroops);
  }, [phase, done, attackerTroopsEnd, initialAttackerTroops]);

  const displayDef = useMemo(() => {
    if (phase === 'resolve' || done) {
      return defenderTroopsEnd?.length ? defenderTroopsEnd : initialDefenderTroops;
    }
    return hydrateAllZeroAsFull(initialDefenderTroops);
  }, [phase, done, defenderTroopsEnd, initialDefenderTroops]);

  useEffect(() => {
    if (!open) return undefined;
    setPhase('face');
    setFlashIdx(-1);
    setDone(false);

    const t1 = setTimeout(() => setPhase('charge'), PHASE_MS.face);
    const t2 = setTimeout(() => setPhase('clash'), PHASE_MS.face + PHASE_MS.charge);
    const t3 = setTimeout(
      () => setPhase('resolve'),
      PHASE_MS.face + PHASE_MS.charge + PHASE_MS.clash,
    );
    const t4 = setTimeout(() => {
      setDone(true);
      onCompleteRef.current?.();
    }, TOTAL_MS);

    const clashStart = PHASE_MS.face + PHASE_MS.charge;
    const flashTimers = [0, 350, 700, 1050, 1400].map((d, i) =>
      setTimeout(() => setFlashIdx(i % Math.max(1, atkLen)), clashStart + d),
    );

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      flashTimers.forEach(clearTimeout);
    };
  }, [open, atkLen]);

  if (!open || typeof document === 'undefined') return null;

  const phaseText =
    phase === 'face'
      ? '两军对峙'
      : phase === 'charge'
        ? '全军冲锋'
        : phase === 'clash'
          ? '阵前厮杀'
          : attackerWon
            ? '攻方获胜'
            : '守军获胜';

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[240] flex items-center justify-center bg-black/90 px-3">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-amber-700/40 bg-gradient-to-b from-[#1a120c] via-[#12121a] to-[#0a0a10] shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at 50% 60%, rgba(180,60,30,0.35), transparent 55%), repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,200,120,0.04) 18px, rgba(255,200,120,0.04) 19px)',
          }}
        />
        <div className="relative px-4 pt-4 pb-2 text-center">
          <div className="text-amber-200/95 text-base font-bold tracking-wide">{title}</div>
          <div className="mt-1 text-xs text-amber-100/70">{phaseText}</div>
        </div>

        <div className="relative flex items-center justify-between gap-2 px-4 py-6 min-h-[280px]">
          <div className="absolute left-4 top-2 text-[10px] uppercase tracking-widest text-red-300/80">
            {leftLabel}
          </div>
          <div className="absolute right-4 top-2 text-[10px] uppercase tracking-widest text-sky-300/80">
            {rightLabel}
          </div>

          <SideColumn units={displayAtk} side="atk" phase={phase} flashIdx={flashIdx} />

          <div className="flex flex-col items-center justify-center w-[16%] shrink-0">
            <div
              className={`h-16 w-16 rounded-full border-2 flex items-center justify-center text-xl transition-all duration-500 ${
                phase === 'clash'
                  ? 'border-amber-400 bg-amber-500/30 scale-110 animate-pulse'
                  : phase === 'resolve'
                    ? attackerWon
                      ? 'border-red-400 bg-red-900/50'
                      : 'border-sky-400 bg-sky-900/50'
                    : 'border-stone-600 bg-stone-900/40'
              }`}
            >
              {phase === 'resolve' ? (attackerWon ? '勝' : '守') : '⚔'}
            </div>
            {phase === 'clash' && (
              <div className="mt-2 text-[10px] text-amber-200/80 animate-pulse">刀剑交鸣</div>
            )}
          </div>

          <SideColumn units={displayDef} side="def" phase={phase} flashIdx={flashIdx} />
        </div>

        <div className="relative px-4 pb-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full bg-gradient-to-r from-red-700 via-amber-500 to-sky-600 transition-all ease-linear"
              style={{
                width:
                  phase === 'face' ? '15%' : phase === 'charge' ? '40%' : phase === 'clash' ? '75%' : '100%',
                transitionDuration: `${
                  phase === 'face'
                    ? PHASE_MS.face
                    : phase === 'charge'
                      ? PHASE_MS.charge
                      : phase === 'clash'
                        ? PHASE_MS.clash
                        : PHASE_MS.resolve
                }ms`,
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
