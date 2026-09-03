/**
 * 战略格「PVP 势力战事」独立浮层：与 PVE 战况浮层并列；
 * 仅当该城在 `wars_pvp` 中存在 active 战事时显示。
 *
 * 与 PVE 浮层（StrategicSiegeWarFloatingPanel）UI 同源（卡片样式 / 锚点定位），
 * 但数据走 warAPI（`pvp-wars/by-city/:id/active`），字段集合按 17-2 攻守语义渲染：
 *   - 攻方阵营 → 守方阵营、剩余时间（服务端 end_time，禁前端独算 24h）
 *   - 攻方对城 NPC 战果（side_stats.attacker.npcKills）
 *   - 守方对大本营 NPC 战果（side_stats.defender.baseCampNpcKills）
 *   - 大本营 NPC 存活 / 满编
 *
 * 设计依据：17-2 §1.4 一城一时刻仅 PVE 或 PVP 之一，故本浮层与 PVE 浮层互斥；
 *           17-2 §1.6 大本营 NPC 归零 ⇒ 攻方失败；§6 胜负条件优先级。
 */
import { useEffect, useLayoutEffect, useMemo, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { warAPI } from '@/services/warApi';
import { WORLD_MAP_DEFAULT_FACTION_LABELS } from '@/utils/worldMapCityPanelCopy';

const GAP_PX = 8;
const Z_FLOAT = 10052;

const FACTION_COLORS = {
  san_1_faction_1001: '#FF6B6B',
  san_1_faction_2001: '#FFD93D',
  san_1_faction_3001: '#FCB900',
};

function readTouchLikePointerMedia() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  );
}

function formatRemainingMs(endTimeIso) {
  if (!endTimeIso) return '—';
  const end = new Date(endTimeIso).getTime();
  if (!Number.isFinite(end)) return '—';
  const ms = end - Date.now();
  if (ms <= 0) return '已到时';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function StrategicPvpWarFloatingPanel({
  anchorRef,
  tooltipPos,
  cityId,
  factionDisplayMap = {},
  enabled,
  tooltipClickMode,
  clearLeaveTooltipTimer,
  scheduleLeaveFromTile,
}) {
  const [pvpWar, setPvpWar] = useState(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [touchLikePointer, setTouchLikePointer] = useState(readTouchLikePointerMedia);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const apply = () => setTouchLikePointer(readTouchLikePointerMedia());
    apply();
    if (typeof window === 'undefined') return undefined;
    const mqHover = window.matchMedia('(hover: none)');
    const mqPointer = window.matchMedia('(pointer: coarse)');
    if (typeof mqHover.addEventListener === 'function') {
      mqHover.addEventListener('change', apply);
      mqPointer.addEventListener('change', apply);
      return () => {
        mqHover.removeEventListener('change', apply);
        mqPointer.removeEventListener('change', apply);
      };
    }
    mqHover.addListener(apply);
    mqPointer.addListener(apply);
    return () => {
      mqHover.removeListener(apply);
      mqPointer.removeListener(apply);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !cityId) {
      setPvpWar(null);
      return undefined;
    }
    let cancelled = false;
    warAPI
      .getActiveByCity(cityId)
      .then((res) => {
        if (cancelled || !res?.success) return;
        setPvpWar(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setPvpWar(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, cityId]);

  // 倒计时每分钟刷新一次（轻量；细化到秒级会导致频繁重渲染）
  useEffect(() => {
    if (!pvpWar?.endTime) return undefined;
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [pvpWar?.endTime]);

  const summary = useMemo(() => {
    if (!pvpWar) return null;
    const attLabel =
      factionDisplayMap[pvpWar.attackerFactionId] ||
      pvpWar.attackerFactionName ||
      WORLD_MAP_DEFAULT_FACTION_LABELS[pvpWar.attackerFactionId] ||
      '攻方';
    const defLabel =
      factionDisplayMap[pvpWar.defenderFactionId] ||
      pvpWar.defenderFactionName ||
      WORLD_MAP_DEFAULT_FACTION_LABELS[pvpWar.defenderFactionId] ||
      '守方';
    const camp = pvpWar.baseCamp || null;
    const stats = pvpWar.sideStats || {};
    return {
      warName: pvpWar.warName || '势力战事',
      attLabel,
      defLabel,
      attColor: FACTION_COLORS[pvpWar.attackerFactionId] || '#fca5a5',
      defColor: FACTION_COLORS[pvpWar.defenderFactionId] || '#93c5fd',
      attMorale: pvpWar.attackerWarMorale ?? '—',
      defMorale: pvpWar.defenderWarMorale ?? '—',
      attCityKills: stats?.attacker?.npcKills ?? 0,
      defCampKills: stats?.defender?.baseCampNpcKills ?? 0,
      campAlive: camp?.npcAlive ?? null,
      campTotal: camp?.npcTotal ?? null,
      remaining: formatRemainingMs(pvpWar.endTime),
      status: pvpWar.status,
    };
  }, [pvpWar, factionDisplayMap]);

  useLayoutEffect(() => {
    if (!enabled || !cityId || !summary) return undefined;
    const update = () => {
      const el = anchorRef?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ left: r.right + GAP_PX, top: r.top });
    };
    update();
    const raf = requestAnimationFrame(update);
    const el = anchorRef?.current;
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, cityId, summary, anchorRef, tooltipPos?.x, tooltipPos?.y]);

  if (!enabled || !cityId || !summary) return null;

  const passThroughPointerEvents = tooltipClickMode || touchLikePointer;
  const node = (
    <div
      className="strategic-pvp-war-float rounded-lg border border-amber-500/80 px-3 py-2 text-stone-200 text-sm"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: Z_FLOAT,
        width: 'max-content',
        minWidth: '11rem',
        maxWidth: 'min(15rem, 92vw)',
        background: 'rgba(15, 15, 25, 0.96)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.55)',
        pointerEvents: passThroughPointerEvents ? 'none' : 'auto',
      }}
      onMouseEnter={passThroughPointerEvents ? undefined : clearLeaveTooltipTimer}
      onMouseLeave={passThroughPointerEvents ? undefined : scheduleLeaveFromTile}
    >
      <div className="text-amber-200 text-xs font-bold mb-1">⚔️ 势力战事 · {summary.warName}</div>
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span style={{ color: summary.attColor }}>攻 · {summary.attLabel}</span>
        <span className="text-stone-400">士气 {summary.attMorale}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span style={{ color: summary.defColor }}>守 · {summary.defLabel}</span>
        <span className="text-stone-400">士气 {summary.defMorale}</span>
      </div>
      <div className="border-t border-stone-600/60 my-1" />
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span className="text-stone-300">攻方对城战果</span>
        <span className="text-amber-300 font-bold">{summary.attCityKills}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span className="text-stone-300">守方对营战果</span>
        <span className="text-amber-300 font-bold">{summary.defCampKills}</span>
      </div>
      {summary.campAlive != null && (
        <div className="flex items-center justify-between gap-2 text-xs py-0.5">
          <span className="text-stone-300">大本营 NPC</span>
          <span className="text-stone-100 font-bold">
            {summary.campAlive} / {summary.campTotal}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span className="text-stone-300">剩余时间</span>
        <span className="text-stone-100">{summary.remaining}</span>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}

export default memo(StrategicPvpWarFloatingPanel);
