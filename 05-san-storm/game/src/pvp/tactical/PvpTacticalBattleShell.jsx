/**
 * PvpTacticalBattleShell — PvP 战术对决 · 客户端事件回放壳
 *
 * 职责（17-5-2 步骤 7）：
 *   1. 拉房间元数据 + 视角（`GET /:id`），按 `view.selfSide` 决定是否纵向翻转地图（己方落南半场）。
 *   2. `buildDuelMapFromPreset(room.duelMapId)` 还原 canonical 地图，经 `makeCanonicalView` 变换后渲染棋盘。
 *   3. 轮询 `GET /:id/events?afterSeq=N`，用 `pvpEventPlayer` 逐事件驱动 `useBattleAnimations` 动画（**只回放、不推演**）。
 *   4. 播完 / resolved 后拉 `GET /:id/result`，回调 `onComplete({ outcome, winnerSide, battleId })`。
 *
 * 复用既有棋盘渲染：`BattleMap` + `createTacticalMapCardSurface` + `useBattleAnimations`（与 SmallMapBattle 同源），
 * 不引入 `useBattleEngine`（服务端已推演）。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.4 §12.6
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import BattleMap from '@/components/battle/BattleMap';
import BattleLog from '@/components/battle/BattleLog';
import '@/components/battle/BattleMap.css';
import { createTacticalMapCardSurface } from '@/battle/tacticalMapCardSurface';
import { useBattleAnimations } from '@/battle/useBattleAnimations';
import { buildDuelMapFromPreset } from '@shared/utils/pvpDuelMapCatalog';
import { makeCanonicalView } from '@shared/battle/tacticalSim/pvpCanonicalView';
import { buildInitialTroops } from '@shared/battle/tacticalSim/pvpReplayState';
import { createPvpEventPlayer } from '@/pvp/tactical/pvpEventPlayer';
import { pvpTacticalAPI } from '@/services/pvpTacticalApi';
import { useBgmScene } from '@/hooks/useBgmScene';

const POLL_INTERVAL_MS = 350;
const SPEED_OPTIONS = [1, 2, 4];

function outcomeFor(winnerSide, selfSide) {
  if (winnerSide == null) return 'draw';
  if (selfSide == null) return winnerSide === 'a' ? 'win' : 'lose';
  return winnerSide === selfSide ? 'win' : 'lose';
}

export default function PvpTacticalBattleShell({ roomId, onComplete, onClose, title = '阵前切磋' }) {
  useBgmScene('battle_small');

  const mapCardRef = useRef(null);
  const battleSurfaceRef = useRef(null);
  if (!battleSurfaceRef.current) battleSurfaceRef.current = createTacticalMapCardSurface(mapCardRef);
  const speedRef = useRef(1);

  const [mapResult, setMapResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [roundNum, setRoundNum] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading | playing | done | error | cancelled
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null); // { outcome, winnerSide, battleId }
  const [speed, setSpeed] = useState(1);
  /** 与 `SmallMapBattle` 一致：战报/控件宽度对齐 `.map-card` 外缘 */
  const [layoutWidth, setLayoutWidth] = useState('auto');

  const syncLayoutWidth = useCallback(() => {
    const el = mapCardRef.current;
    if (el?.offsetWidth) setLayoutWidth(`${el.offsetWidth}px`);
  }, []);

  useLayoutEffect(() => {
    syncLayoutWidth();
  }, [mapResult, syncLayoutWidth]);

  useEffect(() => {
    const el = mapCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncLayoutWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapResult, syncLayoutWidth]);

  // 跨 effect 共享的可变态（坐标/兵力原地变更，避免每帧重渲染）
  const troopsRef = useRef([]);
  const byIdRef = useRef(new Map());
  const viewRef = useRef(null);
  const selfSideRef = useRef(null);
  const snapshotsRef = useRef({ a: [], b: [] });

  const addLog = useCallback((text, cls) => {
    setLogs((prev) => [...prev, { text, cls, id: `${prev.length}_${text}` }]);
  }, []);

  const anim = useBattleAnimations({
    battleSurfaceRef,
    mapCardRef,
    mapResult,
    addLog,
    speedRef,
    battleTroops: troopsRef.current,
  });
  const animRef = useRef(anim);
  animRef.current = anim;

  const setSpeedSafe = useCallback((s) => {
    speedRef.current = s;
    setSpeed(s);
  }, []);

  // ── Effect A：加载房间 + 视角 + 地图 ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resp = await pvpTacticalAPI.getRoom(roomId);
      if (cancelled) return;
      if (!resp.success || !resp.room) {
        setErrorMsg(resp.error || '房间不存在');
        setPhase('error');
        return;
      }
      const room = resp.room;
      if (!room.duelMapId) {
        setErrorMsg('对决地图尚未确定（房间未就绪）');
        setPhase('error');
        return;
      }
      const selfSide = resp.view?.selfSide ?? null;
      let canonicalMap;
      try {
        canonicalMap = buildDuelMapFromPreset(room.duelMapId);
      } catch (e) {
        setErrorMsg(`对决地图加载失败：${e?.message || room.duelMapId}`);
        setPhase('error');
        return;
      }
      const view = makeCanonicalView(selfSide, canonicalMap);
      viewRef.current = view;
      selfSideRef.current = selfSide;
      // 优先用 room.lineupSnapshots（canonical {a,b}）；回退到 view 的 self/opponent 拆分
      const snaps = room.lineupSnapshots;
      if (snaps && (snaps.a || snaps.b)) {
        snapshotsRef.current = { a: snaps.a || [], b: snaps.b || [] };
      } else {
        const oppSide = selfSide === 'a' ? 'b' : 'a';
        snapshotsRef.current = {
          [selfSide || 'a']: resp.view?.selfLineup || [],
          [oppSide]: resp.view?.opponentLineup || [],
        };
      }
      setMapResult(view.mapResult);
    })().catch((e) => {
      if (!cancelled) {
        setErrorMsg(e?.message || '加载失败');
        setPhase('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ── Effect B：渲染初始棋盘 + 轮询事件 + 回放 ──────────────────────────────
  useEffect(() => {
    if (!mapResult) return undefined;
    let cancelled = false;
    let timer = null;
    let player = null;
    // -1 起始：getEvents 语义为独占 seq > afterSeq，须从 -1 才能取到 seq=0 的 BATTLE_START（renderInitial 依赖其放兵坐标）
    let lastSeq = -1;
    let started = false;
    let finished = false;

    const view = viewRef.current;
    const selfSide = selfSideRef.current;

    const finish = async () => {
      if (finished || cancelled) return;
      finished = true;
      const r = await pvpTacticalAPI.getResult(roomId);
      if (cancelled) return;
      const winnerSide = r.success ? r.winnerSide : null;
      const battleId = r.success ? r.battleId : null;
      const outcome = outcomeFor(winnerSide, selfSide);
      const payload = { outcome, winnerSide, battleId, roomId };
      setResult(payload);
      setPhase('done');
      onComplete?.(payload);
    };

    const renderInitial = (battleStartPayload) => {
      const { troops, byId } = buildInitialTroops(battleStartPayload, view, snapshotsRef.current);
      troopsRef.current.length = 0;
      troops.forEach((t) => troopsRef.current.push(t));
      byIdRef.current = byId;
      const a = animRef.current;
      troops.forEach((t) => a.renderTroopOnTile(t));
      player = createPvpEventPlayer({
        animRef,
        byId: byIdRef.current,
        view,
        addLog,
        setRoundNum,
      });
    };

    const pump = async () => {
      if (cancelled) return;
      const resp = await pvpTacticalAPI.getEvents(roomId, lastSeq);
      if (cancelled) return;
      if (!resp.success) {
        // 软失败：稍后重试（推演可能尚未起跑）
        timer = setTimeout(pump, POLL_INTERVAL_MS * 2);
        return;
      }

      if (resp.status === 'cancelled') {
        setPhase('cancelled');
        setErrorMsg('对决已取消');
        onComplete?.({ outcome: 'cancelled', winnerSide: null, battleId: null, roomId });
        return;
      }

      const events = Array.isArray(resp.events) ? resp.events : [];
      let toPlay = events;

      if (!started) {
        const startEv = events.find((e) => e.type === 'BATTLE_START');
        if (!startEv) {
          // 推演尚未产出首事件，继续等待
          timer = setTimeout(pump, POLL_INTERVAL_MS);
          return;
        }
        renderInitial(startEv.payload);
        started = true;
        setPhase('playing');
        toPlay = events.filter((e) => e.seq > startEv.seq);
      }

      if (events.length > 0) lastSeq = events[events.length - 1].seq;

      if (player && toPlay.length > 0) {
        await player.playEvents(toPlay);
        if (cancelled) return;
      }

      const caughtUp = resp.eventSeq == null || lastSeq >= resp.eventSeq;
      const ended = events.some((e) => e.type === 'BATTLE_END');
      if (ended || (resp.status === 'resolved' && caughtUp)) {
        await finish();
        return;
      }
      timer = setTimeout(pump, POLL_INTERVAL_MS);
    };

    pump().catch((e) => {
      if (!cancelled) {
        setErrorMsg(e?.message || '回放失败');
        setPhase('error');
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapResult, roomId]);

  const selfSide = selfSideRef.current;
  const banner =
    phase === 'done' && result
      ? result.outcome === 'win'
        ? '胜利'
        : result.outcome === 'lose'
          ? '战败'
          : '平局'
      : null;

  return (
    <div className="fixed inset-0 z-[225] flex flex-col items-center overflow-auto bg-[#1a1a2e]">
      <div className="flex w-full items-center justify-between px-4 py-2 text-sm text-amber-100">
        <span className="font-semibold">{title} · 战术对决</span>
        <span className="text-amber-200/70">
          回合 {roundNum}
          {selfSide ? `　·　己方 ${selfSide === 'a' ? '甲' : '乙'}方` : ''}
        </span>
      </div>

      {phase === 'error' && (
        <div className="mt-8 rounded bg-red-900/60 px-4 py-3 text-red-100">{errorMsg || '加载失败'}</div>
      )}
      {phase === 'cancelled' && (
        <div className="mt-8 rounded bg-slate-800/80 px-4 py-3 text-slate-200">{errorMsg || '对决已取消'}</div>
      )}

      {mapResult && phase !== 'error' && phase !== 'cancelled' && (
        <div className="flex flex-col items-center px-2 pb-4">
          <div
            className="relative w-fit max-w-[100vw]"
            style={layoutWidth !== 'auto' ? { width: layoutWidth } : undefined}
          >
            <div className="pointer-events-auto absolute right-3 top-3 z-20 flex items-center gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeedSafe(s)}
                  className={`rounded px-2 py-0.5 text-xs font-semibold shadow-md ${
                    speed === s ? 'bg-amber-500 text-black' : 'bg-black/55 text-amber-200 hover:bg-black/70'
                  }`}
                >
                  {s}x
                </button>
              ))}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-black shadow-md"
                >
                  关闭
                </button>
              )}
            </div>
            {banner && (
              <div className="pointer-events-none absolute inset-x-0 top-14 z-10 text-center">
                <span
                  className={`inline-block rounded-lg px-6 py-2 text-2xl font-bold ${
                    result?.outcome === 'win'
                      ? 'bg-amber-500/90 text-black'
                      : result?.outcome === 'lose'
                        ? 'bg-slate-700/90 text-slate-100'
                        : 'bg-slate-600/90 text-slate-100'
                  }`}
                >
                  {banner}
                </span>
              </div>
            )}
            <BattleMap
              mapResult={mapResult}
              mapLabel={title}
              battleTroops={troopsRef.current}
              showTroops={false}
              isBattle
              roundNum={roundNum}
              mapCardRef={mapCardRef}
            />
          </div>
          <BattleLog logs={logs} visible maxWidth={layoutWidth} />
        </div>
      )}

      {phase === 'loading' && (
        <div className="mt-10 text-amber-200/80">正在加载对决…</div>
      )}
    </div>
  );
}
