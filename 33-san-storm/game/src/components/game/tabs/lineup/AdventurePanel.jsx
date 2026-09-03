/**
 * Extra 编组挂机探险：最多 4 路并行（A–D）；每次派遣消耗兵符×1。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adventureAPI } from '@/services/adventureApi';
import AncientModal from '@/components/common/AncientModal';

const SLOT_LABELS = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

function formatRemaining(ms) {
  const t = Math.max(0, Math.floor(Number(ms) || 0));
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function adventureRemainingMs(adv, tick) {
  void tick;
  if (!adv || adv.status !== 'dispatched') return 0;
  const ends = new Date(adv.endsAt).getTime();
  return Math.max(0, ends - Date.now());
}

/**
 * @param {{
 *   playerId: string,
 *   open: boolean,
 *   onClose: () => void,
 *   defaultExtraSlot?: number,
 *   onChanged?: () => void,
 * }} props
 */
export default function AdventurePanel({
  playerId,
  open,
  onClose,
  defaultExtraSlot = 1,
  onChanged,
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [themes, setThemes] = useState([]);
  const [adventures, setAdventures] = useState([]);
  const [lockedSlots, setLockedSlots] = useState([]);
  const [maxConcurrent, setMaxConcurrent] = useState(4);
  const [costPerDispatch, setCostPerDispatch] = useState(1);
  const [tacticTokenRemaining, setTacticTokenRemaining] = useState(null);
  const [themeId, setThemeId] = useState('');
  const [extraSlot, setExtraSlot] = useState(defaultExtraSlot);
  const [tick, setTick] = useState(0);
  const [claimResult, setClaimResult] = useState(null);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adventureAPI.getStatus(playerId);
      if (!res.success) {
        setError(res.error || '加载失败');
        return;
      }
      const nextThemes = res.themes || [];
      setThemes(nextThemes);
      const list = Array.isArray(res.adventures)
        ? res.adventures
        : res.adventure
          ? [res.adventure]
          : [];
      setAdventures(list);
      setLockedSlots(res.lockedExtraSlots || []);
      setMaxConcurrent(Number(res.maxConcurrent) > 0 ? Number(res.maxConcurrent) : 4);
      setCostPerDispatch(
        Number(res.costPerDispatch) > 0 ? Number(res.costPerDispatch) : 1,
      );
      setTacticTokenRemaining(
        res.tacticTokenRemaining != null ? Number(res.tacticTokenRemaining) : null,
      );
      setThemeId((prev) => prev || nextThemes[0]?.id || '');
    } catch (e) {
      console.error('[AdventurePanel]', e);
      setError(e?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    setClaimResult(null);
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const unlocked = [1, 2, 3, 4].find((n) => !lockedSlots.includes(n));
    const prefer =
      unlocked != null
        ? unlocked
        : Math.min(4, Math.max(1, Math.floor(Number(defaultExtraSlot)) || 1));
    setExtraSlot((prev) => (lockedSlots.includes(prev) ? prefer : prev));
  }, [open, lockedSlots, defaultExtraSlot]);

  const hasDispatched = adventures.some((a) => a.status === 'dispatched');

  useEffect(() => {
    if (!open || !hasDispatched) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open, hasDispatched]);

  useEffect(() => {
    if (!open || !hasDispatched) return;
    const due = adventures.some(
      (a) =>
        a.status === 'dispatched' &&
        (adventureRemainingMs(a, tick) <= 0 || a.canSettle),
    );
    if (due) void load();
  }, [tick, open, hasDispatched, adventures, load]);

  const canDispatchMore = lockedSlots.length < maxConcurrent;
  const tokenOk =
    tacticTokenRemaining == null || tacticTokenRemaining >= costPerDispatch;

  const handleDispatch = async () => {
    if (!playerId || !themeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adventureAPI.dispatch(playerId, { extraSlot, themeId });
      if (!res.success) {
        setError(res.error || '派遣失败');
        return;
      }
      onChanged?.();
      await load();
    } catch (e) {
      setError(e?.message || '派遣失败');
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (adventureId) => {
    if (!playerId || !adventureId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adventureAPI.claim(playerId, adventureId);
      if (!res.success) {
        setError(res.error || '领取失败');
        return;
      }
      setClaimResult(res);
      onChanged?.();
      await load();
    } catch (e) {
      setError(e?.message || '领取失败');
    } finally {
      setBusy(false);
    }
  };

  const themeNameById = useMemo(() => {
    const m = {};
    for (const t of themes) m[t.id] = t.name;
    return m;
  }, [themes]);

  if (!open) return null;

  const battle = claimResult?.resolve?.battle;
  const story =
    claimResult?.storyText || claimResult?.adventure?.storyText || null;
  const rewards = claimResult?.resolve?.rewards;

  return (
    <AncientModal
      isOpen={open}
      onClose={onClose}
      title="编组探险"
      hideButtons
      width="max-w-lg"
    >
      <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm text-stone-800">
        {loading && <p className="text-stone-500">加载中…</p>}
        {error && (
          <p className="rounded border border-red-700/40 bg-red-50 px-2 py-1 text-xs text-red-800">
            {error}
          </p>
        )}

        <p className="text-[11px] text-stone-600">
          最多同时 {maxConcurrent} 套 Extra（A–D）外出；每次派遣消耗兵符×
          {costPerDispatch}
          {tacticTokenRemaining != null ? `（当前 ${tacticTokenRemaining}）` : ''}
          。出征中 / 待领期间该槽锁定。
        </p>

        {claimResult?.success && (
          <div className="space-y-2 rounded border border-amber-700/30 bg-amber-50/50 p-3">
            <p className="font-medium text-amber-900">
              报告已领取
              {claimResult.adventure?.extraSlotLabel
                ? ` · 编组 ${claimResult.adventure.extraSlotLabel}`
                : ''}
            </p>
            {story && (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-700">
                {story}
              </p>
            )}
            {rewards && (
              <p className="text-xs text-amber-900/80">
                收获：银两 {rewards.silver || 0}
                {rewards.food ? ` · 粮草 ${rewards.food}` : ''}
              </p>
            )}
            {battle && (
              <div className="text-xs text-stone-600">
                <p>
                  战况：{battle.attackerWon ? '胜' : '负'}
                  {battle.enemyLabel ? ` · 敌 ${battle.enemyLabel}` : ''}
                  {battle.rounds != null ? ` · ${battle.rounds} 合` : ''}
                </p>
                {Array.isArray(battle.logTail) && battle.logTail.length > 0 && (
                  <ul className="mt-1 max-h-28 list-disc overflow-y-auto pl-4 text-[11px] text-stone-500">
                    {battle.logTail.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              type="button"
              className="rounded border border-amber-800/40 bg-amber-100/80 px-3 py-1 text-xs text-amber-950"
              onClick={() => setClaimResult(null)}
            >
              关闭本报告
            </button>
          </div>
        )}

        {adventures.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-700">
              进行中 {adventures.length}/{maxConcurrent}
            </p>
            {adventures.map((adv) => {
              const rem = adventureRemainingMs(adv, tick);
              const label =
                adv.extraSlotLabel || SLOT_LABELS[adv.extraSlot] || adv.extraSlot;
              const tName = themeNameById[adv.themeId] || adv.themeId || '—';
              if (adv.status === 'ready') {
                return (
                  <div
                    key={adv.adventureId}
                    className="space-y-1.5 rounded border border-emerald-700/30 bg-emerald-50/50 p-2.5"
                  >
                    <p className="text-xs font-medium text-emerald-900">
                      编组 {label} 已归来 · {tName}
                    </p>
                    {adv.resolve?.rewards && (
                      <p className="text-[11px] text-amber-900/80">
                        待入账：银两 {adv.resolve.rewards.silver || 0}
                        {adv.resolve.rewards.food
                          ? ` · 粮草 ${adv.resolve.rewards.food}`
                          : ''}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded bg-emerald-800 px-3 py-1 text-xs text-emerald-50 disabled:opacity-50"
                      onClick={() => handleClaim(adv.adventureId)}
                    >
                      {busy ? '领取中…' : '领取报告与奖励'}
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={adv.adventureId}
                  className="rounded border border-amber-700/30 bg-amber-50/40 p-2.5 text-xs"
                >
                  <p>
                    编组 {label} 出征中 · {tName}
                  </p>
                  <p className="text-amber-900">
                    {rem > 0
                      ? `预计归来：${formatRemaining(rem)}`
                      : '已到期，正在整理报告…'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {canDispatchMore && (
          <div className="space-y-3 border-t border-amber-800/20 pt-3">
            <p className="text-xs text-stone-600">
              派出一套空闲 Extra 编组（不占用 Main）。派遣立即扣兵符×
              {costPerDispatch}。
            </p>
            <label className="block text-xs text-stone-700">
              出征编组
              <select
                className="mt-1 w-full rounded border border-amber-800/30 bg-white/70 px-2 py-1.5 text-stone-800"
                value={extraSlot}
                onChange={(e) => setExtraSlot(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n} disabled={lockedSlots.includes(n)}>
                    上阵 {SLOT_LABELS[n]}
                    {lockedSlots.includes(n) ? '（出征/待领）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-stone-700">
              主题
              <select
                className="mt-1 w-full rounded border border-amber-800/30 bg-white/70 px-2 py-1.5 text-stone-800"
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
              >
                {(themes || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.durationHours}时 · 遇敌
                    {Math.round((t.encounterRate || 0) * 100)}%
                  </option>
                ))}
              </select>
            </label>
            {themeId && (
              <p className="text-[11px] leading-relaxed text-stone-500">
                {(themes.find((t) => t.id === themeId) || {}).description}
              </p>
            )}
            {!tokenOk && (
              <p className="text-[11px] text-red-700">兵符不足，无法派遣</p>
            )}
            <button
              type="button"
              disabled={
                busy ||
                !themeId ||
                loading ||
                lockedSlots.includes(extraSlot) ||
                !tokenOk
              }
              className="rounded bg-amber-800 px-3 py-1.5 text-xs text-amber-50 disabled:opacity-50"
              onClick={handleDispatch}
            >
              {busy
                ? '派遣中…'
                : `确认出征（兵符×${costPerDispatch}）`}
            </button>
          </div>
        )}

        {!canDispatchMore && adventures.length > 0 && (
          <p className="text-[11px] text-stone-500">
            四套 Extra 均在外或待领；领取报告后可再派。
          </p>
        )}
      </div>
    </AncientModal>
  );
}
