/**
 * 三公府 · 互动 · 朝贡：每日最多上缴 5 张军营池部队卡；选卡经 `SanGongTributeSelectModal` 弹窗完成。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { garrisonAPI } from '@/services/garrisonApi';
import { playerAPI } from '@/services/playerApi';
import { collectGarrisonOccupiedInstanceIds } from '@/utils/garrisonScopeUtils';
import {
  getBarracksTroopCardsSorted,
  groupTroopCardsByRarity,
  RARITY_LABEL,
} from '@/utils/garrisonBarracksTroopPool';
import { tributeCompensationPerTroopCard } from '@/utils/siegeKillEconomyTributeDisplay';
import TroopCard from '@shared/components/card/TroopCard';
import { toTroopCardData } from '@/utils/cardDataTransforms';
import { loadSharedData } from '@/services/dataService';
import SanGongTributeSelectModal from '@/components/game/SanGongTributeSelectModal';

const MAX_SELECT = 5;

/** 与后端朝贡结算、`朝贡完成`提示口径一致（每张卡按稀有度）；算法见 `@/utils/siegeKillEconomyTributeDisplay` */
const TRIBUTE_REWARD_DISPLAY_ORDER = ['common', 'rare', 'epic', 'legendary', 'core'];
const TRIBUTE_REWARD_SUMMARY_LINE = TRIBUTE_REWARD_DISPLAY_ORDER.map((rarityKey) => {
  const { silver, contribution } = tributeCompensationPerTroopCard(rarityKey);
  return `${RARITY_LABEL[rarityKey]}：银两 +${silver}，贡献 +${contribution}`;
}).join(' / ');

function toggleInSet(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function SanGongTributePanel() {
  const { player, cards, refresh } = usePlayerContext();
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());
  const [skillsMap, setSkillsMap] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [tributeStatus, setTributeStatus] = useState({ usedToday: 0, remainingToday: 5, maxPerDay: 5 });

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

  const loadStatus = useCallback(async () => {
    if (!player?.playerId) return;
    try {
      const res = await playerAPI.getSanGongFuTributeStatus(player.playerId);
      if (res.success && res.data) setTributeStatus(res.data);
    } catch {
      /* ignore */
    }
  }, [player?.playerId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!player?.playerId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await garrisonAPI.getAll(player.playerId);
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
  }, [player?.playerId]);

  const poolTroops = useMemo(
    () => getBarracksTroopCardsSorted(cards, occupiedIds),
    [cards, occupiedIds],
  );
  const poolByRarity = useMemo(() => groupTroopCardsByRarity(poolTroops), [poolTroops]);

  const selectionCap = Math.min(MAX_SELECT, Math.max(0, tributeStatus.remainingToday ?? 0));

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (poolTroops.some((c) => c.instanceId === id)) next.add(id);
      });
      return next;
    });
  }, [poolTroops]);

  const baseUrl = import.meta.env.BASE_URL;

  const onToggleSelect = useCallback(
    (id) => {
      setSelected((s) => {
        if (s.has(id)) return toggleInSet(s, id);
        if (selectionCap <= 0) {
          setToast('今日朝贡额度已用尽');
          return s;
        }
        if (s.size >= selectionCap) {
          setToast(`本日还可朝贡 ${selectionCap} 张，已达可选上限`);
          return s;
        }
        return toggleInSet(s, id);
      });
    },
    [selectionCap],
  );

  const openSelectModal = useCallback(() => {
    if (selectionCap <= 0) {
      setToast('今日朝贡额度已用尽');
      return;
    }
    setSelected(new Set());
    setSelectModalOpen(true);
  }, [selectionCap]);

  const handleTribute = useCallback(async () => {
    if (!player?.playerId || busy || selected.size === 0) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await playerAPI.submitSanGongFuTribute(player.playerId, [...selected]);
      if (res.success) {
        const d = res.data || {};
        setSelected(new Set());
        setSelectModalOpen(false);
        setToast(
          `朝贡完成：银两 +${d.silver ?? 0}，贡献 +${d.contribution ?? 0}；势力储备银两 +${d.factionSilver ?? 0}、粮草 +${d.factionFood ?? 0}`,
        );
        await refresh({ silent: true });
        await loadStatus();
      } else {
        setToast(res.error || '朝贡失败');
      }
    } catch (e) {
      setToast(e?.message || '朝贡失败');
    } finally {
      setBusy(false);
    }
  }, [player?.playerId, busy, selected, refresh, loadStatus]);

  const canOpenSelect = selectionCap > 0 && !busy;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col text-left">
      <div className="rounded-lg border border-amber-900/25 bg-stone-900/40 px-2 py-2">
        <div className="text-xs font-semibold text-amber-500/95">朝贡</div>
        <p className="mt-1 break-words text-[10px] leading-snug text-stone-400">{TRIBUTE_REWARD_SUMMARY_LINE}</p>
        <p className="mt-1 text-[10px] text-stone-500">
          今日已朝贡 {tributeStatus.usedToday ?? 0} / {tributeStatus.maxPerDay ?? 5}，还可选{' '}
          {tributeStatus.remainingToday ?? 5} 张额度
        </p>
        <button
          type="button"
          disabled={!canOpenSelect}
          onClick={openSelectModal}
          className="mt-2 w-full rounded-md border border-amber-700/50 bg-amber-950/50 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
        >
          选择朝贡
        </button>
      </div>

      {toast ? (
        <div className="mt-2 rounded border border-stone-600/50 bg-stone-800/80 px-2 py-1.5 text-[11px] text-stone-200">
          {toast}
        </div>
      ) : null}

      <SanGongTributeSelectModal
        open={selectModalOpen}
        onClose={() => {
          if (busy) return;
          setSelectModalOpen(false);
          setSelected(new Set());
        }}
        poolTroops={poolTroops}
        poolByRarity={poolByRarity}
        skillsMap={skillsMap}
        selected={selected}
        onToggleSelect={onToggleSelect}
        selectionCap={selectionCap}
        busy={busy}
        onConfirm={handleTribute}
        onPreviewCard={setPreviewCard}
      />

      {previewCard && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TroopCard troop={toTroopCardData(previewCard)} skillsMap={skillsMap} showDetails baseUrl={baseUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
