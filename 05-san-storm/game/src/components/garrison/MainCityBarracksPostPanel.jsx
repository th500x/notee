/**
 * 主城「驻军所」— 复用编组/军营部队卡缩略展示；多选；转入仓库 / 转出军营（军营部队栏上限见 `barracksLimits.js`）
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { garrisonAPI } from '@/services/garrisonApi';
import { playerAPI } from '@/services/playerApi';
import { collectGarrisonOccupiedInstanceIds } from '@/utils/garrisonScopeUtils';
import {
  getBarracksTroopCardsSorted,
  getWarehouseTroopCardsSorted,
  groupTroopCardsByRarity,
  RARITY_LABEL,
} from '@/utils/garrisonBarracksTroopPool';
import TroopCard from '@shared/components/card/TroopCard';
import { toTroopCardData } from '@/utils/cardDataTransforms';
import { loadSharedData } from '@/services/dataService';
import { TabPageCloseButton } from '@/components/game/TabPageCloseAffordance';
import { MAX_LINEUP_BARRACKS_TROOP_CARDS } from '@/constants/barracksLimits';

function toggleInSet(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function MainCityBarracksPostPanel({ cityId: _cityId, cityName = '主城', onClose, onAfterSave }) {
  const { player, cards, refresh } = usePlayerContext();
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());
  const [skillsMap, setSkillsMap] = useState({});
  const [selectedPool, setSelectedPool] = useState(() => new Set());
  const [selectedWarehouse, setSelectedWarehouse] = useState(() => new Set());
  const [previewCard, setPreviewCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSharedData('skills')
      .then((d) => {
        if (d?.skills) {
          const map = {};
          d.skills.forEach((s) => {
            map[s.id] = s;
          });
          setSkillsMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!player?.player_id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await garrisonAPI.getAll(player.player_id);
        if (cancelled) return;
        if (res.success) {
          setOccupiedIds(collectGarrisonOccupiedInstanceIds(res.garrisons || []));
        }
      } catch {
        if (!cancelled) setOccupiedIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player?.player_id]);

  const poolTroops = useMemo(
    () => getBarracksTroopCardsSorted(cards, occupiedIds),
    [cards, occupiedIds],
  );
  const warehouseTroops = useMemo(
    () => getWarehouseTroopCardsSorted(cards, occupiedIds),
    [cards, occupiedIds],
  );

  const poolByRarity = useMemo(() => groupTroopCardsByRarity(poolTroops), [poolTroops]);
  const warehouseByRarity = useMemo(() => groupTroopCardsByRarity(warehouseTroops), [warehouseTroops]);

  useEffect(() => {
    setSelectedPool((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (poolTroops.some((c) => c.instance_id === id)) next.add(id);
      });
      return next;
    });
    setSelectedWarehouse((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (warehouseTroops.some((c) => c.instance_id === id)) next.add(id);
      });
      return next;
    });
  }, [poolTroops, warehouseTroops]);

  const baseUrl = import.meta.env.BASE_URL;

  const handleTransferIn = useCallback(async () => {
    if (!player?.player_id || busy || selectedPool.size === 0) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await playerAPI.transferMainCityBarracksIn(player.player_id, [...selectedPool]);
      if (res.success) {
        setSelectedPool(new Set());
        await refresh({ silent: true });
        onAfterSave?.();
      } else {
        setToast(res.error || '转入失败');
      }
    } catch (e) {
      setToast(e?.message || '转入失败');
    } finally {
      setBusy(false);
    }
  }, [player?.player_id, busy, selectedPool, refresh, onAfterSave]);

  const handleTransferOut = useCallback(async () => {
    if (!player?.player_id || busy || selectedWarehouse.size === 0) return;
    const n = selectedWarehouse.size;
    const poolCount = poolTroops.length;
    const slotsLeft = MAX_LINEUP_BARRACKS_TROOP_CARDS - poolCount;
    if (slotsLeft < n) {
      setToast(
        slotsLeft <= 0
          ? `军营部队栏已满（${MAX_LINEUP_BARRACKS_TROOP_CARDS} 张），无法转出。`
          : `军营部队栏仅剩 ${slotsLeft} 个空位，当前选中了 ${n} 张，请减少选中张数后重试。`,
      );
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await playerAPI.transferMainCityBarracksOut(player.player_id, [...selectedWarehouse]);
      if (res.success) {
        setSelectedWarehouse(new Set());
        await refresh({ silent: true });
        onAfterSave?.();
      } else {
        setToast(res.error || '转出失败');
      }
    } catch (e) {
      setToast(e?.message || '转出失败');
    } finally {
      setBusy(false);
    }
  }, [player?.player_id, busy, selectedWarehouse, poolTroops.length, refresh, onAfterSave]);

  const renderTroopThumb = (card, selectedSet, setSelected, otherSet) => {
    const id = card.instance_id;
    const selected = selectedSet.has(id);
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelected((s) => toggleInSet(s, id));
            otherSet((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
          }
        }}
        style={{ width: 128, height: 192 }}
        className={`cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
          selected ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]' : 'border-stone-700/60 hover:border-amber-700/50'
        }`}
        onClick={() => {
          setSelected((s) => toggleInSet(s, id));
          otherSet((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setPreviewCard(card);
        }}
      >
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
          <TroopCard
            troop={toTroopCardData(card)}
            skillsMap={skillsMap}
            showDetails
            baseUrl={baseUrl}
            disableHoverScale
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      <div className="flex shrink-0 items-stretch border-b border-amber-900/50 bg-stone-900/90">
        <div className="min-w-0 flex-1 px-3 py-2 text-left">
          <div className="text-sm font-bold text-amber-400/95">驻军所 · 军营与仓库</div>
          <div className="truncate text-[10px] text-stone-500">🏯 {cityName}（与全图驻地军营池同步）</div>
        </div>
        <div className="flex items-center gap-2 pr-1">
          <button
            type="button"
            disabled={busy || selectedPool.size === 0}
            onClick={handleTransferIn}
            className="shrink-0 rounded-md border border-red-600 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-950/40 disabled:opacity-35"
          >
            转入
          </button>
          <button
            type="button"
            disabled={busy || selectedWarehouse.size === 0}
            onClick={handleTransferOut}
            className="shrink-0 rounded-md border border-red-600 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-950/40 disabled:opacity-35"
          >
            转出
          </button>
        </div>
        <TabPageCloseButton onClose={onClose} variant="bar" />
      </div>

      {toast ? (
        <div className="shrink-0 border-b border-red-900/40 bg-red-950/50 px-3 py-2 text-center text-xs text-red-200">
          {toast}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-3">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-stone-400">驻军所仓库</h3>
          <span className="text-[10px] text-stone-500">双击卡面可全尺寸预览</span>
        </div>
        {warehouseTroops.length === 0 ? (
          <p className="mb-6 text-center text-xs text-stone-500">仓库为空；在下方军营池选中部队后点「转入」</p>
        ) : (
          <div className="mb-6 space-y-2">
            {warehouseByRarity.map(({ rarity, cards: rCards }) => (
              <div key={`w-${rarity}`}>
                <div className="mb-1 px-1 text-[10px] text-stone-500">
                  {RARITY_LABEL[rarity] || rarity}（{rCards.length}）
                </div>
                <div className="flex flex-wrap gap-2">
                  {rCards.map((card) =>
                    renderTroopThumb(card, selectedWarehouse, setSelectedWarehouse, setSelectedPool),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-1 flex items-baseline justify-between gap-2 border-t border-stone-700/40 pt-4">
          <h3 className="text-xs font-semibold text-stone-400">军营（可转入驻军所）</h3>
          <span className="text-[10px] text-amber-500/90">
            当前 {poolTroops.length}/{MAX_LINEUP_BARRACKS_TROOP_CARDS} 张
          </span>
        </div>
        {poolTroops.length === 0 ? (
          <p className="text-center text-xs text-stone-500">军营池内暂无可展示的部队卡</p>
        ) : (
          <div className="space-y-2">
            {poolByRarity.map(({ rarity, cards: rCards }) => (
              <div key={`p-${rarity}`}>
                <div className="mb-1 px-1 text-[10px] text-stone-500">
                  {RARITY_LABEL[rarity] || rarity}（{rCards.length}）
                </div>
                <div className="flex flex-wrap gap-2">
                  {rCards.map((card) =>
                    renderTroopThumb(card, selectedPool, setSelectedPool, setSelectedWarehouse),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewCard && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TroopCard
              troop={toTroopCardData(previewCard)}
              skillsMap={skillsMap}
              showDetails={true}
              baseUrl={baseUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
}
