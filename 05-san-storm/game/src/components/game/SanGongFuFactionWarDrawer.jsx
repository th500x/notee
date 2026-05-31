/**
 * 三公府 · 朝政 · 势力战事：全屏抽屉壳与 `CardPoolDrawer` 同源（遮罩 z、顶栏资源条 + ✕）。
 * 战事列表 + 战略缩略图（与底栏「地图」Tab 同源组件）+ 郡邻接可谏言城选城与「谏言决算」弹窗。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { warAPI } from '@/services/warApi';
import PlayerTopResourceBadges from '@/components/game/PlayerTopResourceBadges';
import FactionWarStrategicMiniMapSection from '@/components/game/FactionWarStrategicMiniMapSection';
import WarRemonstranceSettlementModal from '@/components/game/WarRemonstranceSettlementModal';

/**
 * @param {{
 *   playerId: string,
 *   factionId: string|null,
 *   player: object|null,
 *   open: boolean,
 *   onClose: () => void,
 *   onWarEnded?: () => void,
 * }} props
 */
export default function SanGongFuFactionWarDrawer({ playerId, factionId, player, open, onClose, onWarEnded }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pvpWars, setPvpWars] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [busyPveWarId, setBusyPveWarId] = useState(null);

  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(null);
  const [remonstrancePanel, setRemonstrancePanel] = useState(null);
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [capTip, setCapTip] = useState('');
  const [remonstranceModalOpen, setRemonstranceModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!playerId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const res = await playerAPI.getSanGongFuPvpAttackingWars(playerId);
      if (res.success && res.data?.wars) {
        setPvpWars(res.data.wars);
      } else {
        setPvpWars([]);
        setError(res.error || '加载失败');
      }
    } catch (e) {
      setPvpWars([]);
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [playerId, open]);

  const loadRemonstrancePanel = useCallback(async () => {
    if (!open || !factionId) {
      setRemonstrancePanel(null);
      setPanelError(null);
      return;
    }
    setPanelLoading(true);
    setPanelError(null);
    try {
      const res = await warAPI.getRemonstrancePanel(factionId);
      if (res.success && res.data) {
        setRemonstrancePanel(res.data);
      } else {
        setRemonstrancePanel(null);
        setPanelError(res.error || '谏言数据加载失败');
      }
    } catch (e) {
      setRemonstrancePanel(null);
      setPanelError(e?.message || '谏言数据加载失败');
    } finally {
      setPanelLoading(false);
    }
  }, [open, factionId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (open) loadRemonstrancePanel();
    else {
      setSelectedCityId(null);
      setCapTip('');
      setRemonstranceModalOpen(false);
    }
  }, [open, loadRemonstrancePanel]);

  const pveActiveWars = useMemo(() => {
    const raw = remonstrancePanel?.warLimits?.pveActiveWars;
    return Array.isArray(raw) ? raw : [];
  }, [remonstrancePanel?.warLimits?.pveActiveWars]);

  const selectionMeta = useMemo(() => {
    if (!selectedCityId || !remonstrancePanel) return null;
    const sid = String(selectedCityId).trim();
    const pvp = (remonstrancePanel.pvpTargets || []).find((t) => String(t.cityId) === sid);
    if (pvp) {
      return {
        kind: 'pvp',
        row: pvp,
        atCap: !!remonstrancePanel.warLimits?.atPvpCap,
        mapRangeBlocked: pvp.inMapWarRemonstranceRange === false,
      };
    }
    const excluded = (remonstrancePanel.pvpExcludedActiveWar || []).find(
      (t) => String(t.cityId) === sid,
    );
    if (excluded) {
      return {
        kind: 'pvp',
        row: excluded,
        blockedReason: 'active_pvp_war',
        atCap: !!remonstrancePanel.warLimits?.atPvpCap,
        mapRangeBlocked: excluded.inMapWarRemonstranceRange === false,
      };
    }
    const pve = (remonstrancePanel.pveTargets || []).find((t) => String(t.cityId) === sid);
    if (pve) {
      return {
        kind: 'pve',
        row: pve,
        atCap: !!remonstrancePanel.warLimits?.atPveCap,
        mapRangeBlocked: pve.inMapWarRemonstranceRange === false,
      };
    }
    return { kind: null, invalid: true };
  }, [selectedCityId, remonstrancePanel]);

  const remonstranceProximityHighlight = useMemo(() => {
    if (!remonstrancePanel) return null;
    return {
      hostileCityIds: (remonstrancePanel.pvpTargets || [])
        .filter((t) => t.inMapWarRemonstranceRange !== false)
        .map((t) => String(t.cityId)),
      neutralCityIds: (remonstrancePanel.pveTargets || [])
        .filter((t) => t.inMapWarRemonstranceRange !== false)
        .map((t) => String(t.cityId)),
    };
  }, [remonstrancePanel]);

  const onCancelWar = useCallback(
    async (pvpWarId) => {
      if (!playerId || !pvpWarId || busyId || busyPveWarId) return;
      setBusyId(pvpWarId);
      setError(null);
      try {
        const res = await playerAPI.cancelSanGongFuPvpAttackingWar(playerId, pvpWarId, {});
        if (res.success) {
          await load();
          await loadRemonstrancePanel();
          onWarEnded?.();
        } else {
          setError(res.error || '结束失败');
        }
      } catch (e) {
        setError(e?.message || '结束失败');
      } finally {
        setBusyId(null);
      }
    },
    [playerId, busyId, busyPveWarId, load, loadRemonstrancePanel, onWarEnded],
  );

  const onCancelPveWar = useCallback(
    async (warId) => {
      if (!playerId || !warId || busyId || busyPveWarId) return;
      setBusyPveWarId(warId);
      setError(null);
      try {
        const res = await playerAPI.cancelSanGongFuPveAttackingWar(playerId, warId, {});
        if (res.success) {
          await load();
          await loadRemonstrancePanel();
          onWarEnded?.();
        } else {
          setError(res.error || '结束失败');
        }
      } catch (e) {
        setError(e?.message || '结束失败');
      } finally {
        setBusyPveWarId(null);
      }
    },
    [playerId, busyId, busyPveWarId, load, loadRemonstrancePanel, onWarEnded],
  );

  const handleMiniCitySelect = useCallback((cityId, e) => {
    const id = String(cityId || '').trim();
    if (!id) return;
    setCapTip('');
    setSelectedCityId((prev) => (prev === id ? null : id));
    e?.stopPropagation?.();
  }, []);

  const clearMiniMapSelection = useCallback(() => {
    setSelectedCityId(null);
    setCapTip('');
  }, []);

  const showRemonstranceButton =
    selectionMeta && !selectionMeta.invalid && selectionMeta.kind;
  const remonstranceDisabled =
    showRemonstranceButton &&
    (selectionMeta.atCap ||
      selectionMeta.mapRangeBlocked ||
      selectionMeta.blockedReason === 'active_pvp_war');

  const openRemonstranceModal = useCallback(() => {
    if (!showRemonstranceButton || remonstranceDisabled) return;
    setRemonstranceModalOpen(true);
  }, [showRemonstranceButton, remonstranceDisabled]);

  const onRemonstrancePointer = useCallback(() => {
    if (!showRemonstranceButton) return;
    if (!remonstranceDisabled) return;
    if (selectionMeta?.blockedReason === 'active_pvp_war') {
      setCapTip('该城已有进行中 PVP 战事');
      return;
    }
    if (selectionMeta?.mapRangeBlocked) {
      setCapTip('地图距离过远');
      return;
    }
    if (selectionMeta?.kind === 'pve') {
      const aw = remonstrancePanel?.warLimits?.pveActiveWars;
      if (Array.isArray(aw) && aw.length) {
        const label = aw
          .map((w) => String(w.targetCityName || w.targetCityId || w.warId || '').trim())
          .filter(Boolean)
          .slice(0, 2)
          .join('、');
        setCapTip(label ? `PVE 已达并行上限（进行中：${label}）` : 'PVE 已达并行上限');
        return;
      }
    }
    setCapTip('战事已达上限');
  }, [
    showRemonstranceButton,
    remonstranceDisabled,
    selectionMeta?.kind,
    selectionMeta?.mapRangeBlocked,
    selectionMeta?.blockedReason,
    remonstrancePanel?.warLimits?.pveActiveWars,
  ]);

  const handleRemonstranceSubmit = useCallback(
    async (transientPolicies) => {
      if (!playerId || !factionId || !selectedCityId || selectionMeta?.kind !== 'pvp') {
        return { ok: false, message: '仅势力 PVP 目标可提交战事谏言' };
      }
      const row = selectionMeta?.row;
      const targetCityId = String(row?.cityId || selectedCityId).trim();
      const season = String(player?.season || 'san_1').trim() || 'san_1';
      const res = await warAPI.submitProposal({
        attackerFactionId: factionId,
        targetCityId,
        season,
        proposerPlayerId: playerId,
        proposalId: `remonstrance-${Date.now()}`,
        transientPolicies,
      });
      if (res?.success && res?.draftCreated) {
        await load();
        await loadRemonstrancePanel();
        onWarEnded?.();
        setSelectedCityId(null);
        return { ok: true };
      }
      const msg =
        res?.approval?.rejectedReason ||
        res?.error ||
        (res?.approval && !res?.draftCreated ? '君主未准此谏' : '提交失败');
      return { ok: false, message: typeof msg === 'string' ? msg : '提交失败' };
    },
    [
      playerId,
      factionId,
      selectedCityId,
      selectionMeta,
      player?.season,
      load,
      loadRemonstrancePanel,
      onWarEnded,
    ],
  );

  if (!open) return null;

  const playerFactionId = factionId || player?.factionId || player?.factionId || null;
  const selectedCityName =
    selectionMeta && !selectionMeta.invalid && selectionMeta.row
      ? selectionMeta.row.cityName || selectionMeta.row.cityId
      : '';

  return (
    <>
      <div
        className="fixed inset-0 z-[135] bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
        aria-hidden
      />

      <div
        className="fixed left-0 right-0 bottom-0 z-[136] flex min-h-0 flex-col overflow-hidden rounded-t-2xl border-t-2 border-amber-700/50 bg-stone-900 isolate top-[4.5rem] sm:top-14"
      >
        <div className="flex min-w-0 flex-shrink-0 items-center justify-between gap-2 border-b border-stone-700 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-bold text-amber-400">⚔️ 势力战事（攻方攻城）</span>
            <span className="shrink-0 text-xs text-stone-500">进行中</span>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PlayerTopResourceBadges variant="panel" />
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 px-2 py-1 text-xl text-stone-400 hover:text-white"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-stone-900 p-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-stone-500">加载中…</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-400/90">{error}</p>
          ) : pvpWars.length === 0 && pveActiveWars.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-500">
              暂无进行中的攻城战事（上方为势力 PVP；若有中立城 PVE，亦会列于此）
            </p>
          ) : (
            <div className="space-y-4">
              {pvpWars.length > 0 ? (
                <div>
                  <div className="mb-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    势力 PVP 攻城
                  </div>
                  <ul className="space-y-2">
                    {pvpWars.map((w) => {
                      const id = w.pvpWarId || w.pvp_war_id;
                      const name = w.warName || w.war_name || id;
                      const city = w.targetCityId || w.target_city_id || '—';
                      const st = w.status || '—';
                      return (
                        <li
                          key={id}
                          className="flex flex-col gap-2 rounded-lg border border-stone-700/60 bg-stone-800/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 text-left text-[11px] leading-snug text-stone-300">
                            <div className="font-semibold text-amber-200/95">{name}</div>
                            <div className="mt-0.5 text-stone-500">
                              <span className="text-stone-400">战事</span> {id}{' '}
                              <span className="text-stone-600">·</span>{' '}
                              <span className="text-stone-400">目标城</span> {city}{' '}
                              <span className="text-stone-600">·</span>{' '}
                              <span className="text-stone-400">状态</span> {st}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!!busyId || !!busyPveWarId}
                            onClick={() => onCancelWar(id)}
                            className="shrink-0 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-[11px] font-semibold text-red-200/95 hover:bg-red-900/50 disabled:opacity-50"
                          >
                            {busyId === id ? '处理中…' : '结束战事'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {pveActiveWars.length > 0 ? (
                <div>
                  <div className="mb-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    中立城 PVE 攻城
                  </div>
                  <ul className="space-y-2">
                    {pveActiveWars.map((w) => {
                      const wid = String(w.warId || '').trim();
                      const cname = w.targetCityName || w.targetCityId || '—';
                      return (
                        <li
                          key={wid || cname}
                          className="flex flex-col gap-2 rounded-lg border border-sky-900/50 bg-sky-950/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 text-left text-[11px] leading-snug text-stone-300">
                            <div className="font-semibold text-sky-200/95">{cname}</div>
                            <div className="mt-0.5 text-stone-500">
                              <span className="text-stone-400">战事</span> {wid || '—'}
                              <span className="text-stone-600"> · </span>
                              <span className="text-stone-400">进行中</span>（告捷或朝政结束后本势力方可再开新城 PVE / 谏言）
                            </div>
                            <div className="mt-1 text-[10px] text-stone-600">
                              披挂攻城与进度请在大地图目标城「攻城」入口操作；此处与 PVP 相同，提供朝政「结束战事」。
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!wid || !!busyId || !!busyPveWarId}
                            onClick={() => onCancelPveWar(wid)}
                            className="shrink-0 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-[11px] font-semibold text-red-200/95 hover:bg-red-900/50 disabled:opacity-50"
                          >
                            {busyPveWarId === wid ? '处理中…' : '结束战事'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {playerFactionId ? (
            <div className="mt-5 border-t border-stone-700/60 pt-4" data-san-gong-faction-war-minimap-block>
              <div className="mb-2 text-left text-[11px] font-semibold text-amber-500/95">战略略图</div>
              <p className="mb-2 text-left text-[10px] leading-snug text-stone-500">
                与大地图底栏「地图」Tab
                同源；点选城格后，须为郡邻接且落在战略缩略图「最近 3 敌对 / 最近 3
                中立」范围内（与淡青环高亮、AI
                君主主动战事同源），方可打开谏言决算；否则「战事谏言」灰色，悬停/点按提示「地图距离过远」（样式同并行上限）。
              </p>
              {panelLoading ? (
                <p className="py-4 text-center text-[11px] text-stone-500">同步谏言目标…</p>
              ) : panelError ? (
                <p className="py-2 text-center text-[11px] text-amber-600/95">{panelError}</p>
              ) : null}
              <FactionWarStrategicMiniMapSection
                playerFactionId={playerFactionId}
                player={player}
                selectedCityId={selectedCityId}
                onCitySelect={handleMiniCitySelect}
                onMiniMapTooltipDismiss={clearMiniMapSelection}
                deferParentClearWithinSelector="[data-san-gong-faction-war-minimap-block]"
                proximityHighlightOverride={remonstranceProximityHighlight}
              />
              {selectedCityId ? (
                <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-[11px] text-stone-400">
                    {selectionMeta?.invalid ? (
                      <span>所选城格不在当前谏言邻接候选内。</span>
                    ) : selectionMeta?.blockedReason === 'active_pvp_war' ? (
                      <span>
                        已选：<span className="text-amber-200/90">{selectedCityName}</span>（势力
                        PVP · <span className="text-stone-500">该城已有进行中战事</span>）
                      </span>
                    ) : selectionMeta?.kind ? (
                      <span>
                        已选：<span className="text-amber-200/90">{selectedCityName}</span>（
                        {selectionMeta.kind === 'pvp' ? '势力 PVP' : '中立 PVE'}）
                      </span>
                    ) : null}
                  </div>
                  {showRemonstranceButton ? (
                    <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
                      <button
                        type="button"
                        disabled={remonstranceDisabled}
                        title={remonstranceDisabled ? undefined : '打开谏言决算'}
                        onClick={openRemonstranceModal}
                        onPointerEnter={onRemonstrancePointer}
                        onPointerDown={onRemonstrancePointer}
                        className={`rounded-lg border px-3 py-2 text-center text-[11px] font-semibold ${
                          remonstranceDisabled
                            ? 'cursor-not-allowed border-stone-600 bg-stone-800/50 text-stone-500'
                            : 'border-amber-700/60 bg-amber-950/35 text-amber-100 hover:bg-amber-900/40'
                        }`}
                      >
                        战事谏言
                      </button>
                      {capTip ? (
                        <span className="text-center text-[10px] text-amber-500/95 sm:text-right">{capTip}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <WarRemonstranceSettlementModal
        open={remonstranceModalOpen}
        onClose={() => setRemonstranceModalOpen(false)}
        targetCityName={selectedCityName}
        targetCityId={selectedCityId}
        targetCityType={
          selectionMeta && !selectionMeta.invalid && selectionMeta.row
            ? selectionMeta.row.cityType || selectionMeta.row.city_type || null
            : null
        }
        proposalKind={selectionMeta?.kind === 'pve' ? 'pve' : 'pvp'}
        approvalPreview={remonstrancePanel?.approvalPreview || null}
        proposalCost={remonstrancePanel?.proposalCost || null}
        transientPolicyFees={remonstrancePanel?.transientPolicyFees || null}
        canSubmit={
          !!(
            selectionMeta &&
            !selectionMeta.invalid &&
            selectionMeta.kind === 'pvp' &&
            !selectionMeta.atCap &&
            !selectionMeta.mapRangeBlocked &&
            selectionMeta.blockedReason !== 'active_pvp_war' &&
            selectedCityId
          )
        }
        submitDisabledReason={
          selectionMeta?.kind === 'pve'
            ? '中立城 PVE 请走城池面板发起，本窗暂不支持临时政策。'
            : selectionMeta?.blockedReason === 'active_pvp_war'
              ? '该城已有进行中 PVP 战事，无法重复谏言。'
              : selectionMeta?.atCap
              ? '势力 PVP 战事已达并行上限。'
              : selectionMeta?.mapRangeBlocked
                ? '目标超出战略地图谏言距离。'
                : ''
        }
        onSubmit={selectionMeta?.kind === 'pvp' ? handleRemonstranceSubmit : undefined}
      />
    </>
  );
}
