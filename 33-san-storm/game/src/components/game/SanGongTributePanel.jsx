/**
 * 三公府 · 互动 · 朝贡：部队每日最多 5 张、将领每日最多 1 张；选卡经 `SanGongTributeSelectModal` 弹窗完成。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { garrisonAPI } from '@/services/garrisonApi';
import { playerAPI } from '@/services/playerApi';
import { collectGarrisonOccupiedInstanceIds } from '@/utils/garrisonScopeUtils';
import {
  getBarracksTroopCardsSorted,
  getBarracksCharacterCardsSorted,
  groupTroopCardsByRarity,
  RARITY_LABEL,
} from '@/utils/garrisonBarracksTroopPool';
import { tributeCompensationPerTroopCard } from '@/utils/siegeKillEconomyTributeDisplay';
import TroopCard from '@shared/components/card/TroopCard';
import CharacterCard from '@shared/components/card/CharacterCard';
import { toCharCardData, toTroopCardData } from '@/utils/cardDataTransforms';
import { loadSharedData } from '@/services/dataService';
import SanGongTributeSelectModal from '@/components/game/SanGongTributeSelectModal';
import PoolResultModalFrame from '@/components/game/PoolResultModalFrame';

const MAX_TROOP_SELECT = 5;
const MAX_CHARACTER_SELECT = 1;

const EMPTY_TRIBUTE_STATUS = {
  troop: { usedToday: 0, remainingToday: 5, maxPerDay: 5 },
  character: { usedToday: 0, remainingToday: 1, maxPerDay: 1 },
};

/** 与后端朝贡结算一致（每张卡按稀有度） */
const TRIBUTE_REWARD_DISPLAY_ORDER = ['common', 'rare', 'epic', 'legendary', 'core'];
const TRIBUTE_REWARD_SUMMARY_LINE = TRIBUTE_REWARD_DISPLAY_ORDER.map((rarityKey) => {
  const { contribution } = tributeCompensationPerTroopCard(rarityKey);
  return `${RARITY_LABEL[rarityKey]}：贡献 +${contribution}`;
}).join(' / ');

function toggleInSet(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** 按稀有度汇总朝贡卡数量与贡献（展示用，与后端按张结算一致） */
function summarizeTributeCards(cards) {
  const lines = [];
  TRIBUTE_REWARD_DISPLAY_ORDER.forEach((rarityKey) => {
    const matched = cards.filter((c) => String(c.rarity || 'common').toLowerCase() === rarityKey);
    if (matched.length === 0) return;
    const perCard = tributeCompensationPerTroopCard(rarityKey).contribution;
    lines.push({
      rarityKey,
      label: RARITY_LABEL[rarityKey],
      count: matched.length,
      perCard,
      subtotal: perCard * matched.length,
    });
  });
  return lines;
}

export default function SanGongTributePanel() {
  const { player, cards, refresh } = usePlayerContext();
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());
  const [skillsMap, setSkillsMap] = useState({});
  const [selected, setSelected] = useState(() => new Set());
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [tributeKind, setTributeKind] = useState('troop');
  const [previewCard, setPreviewCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [tributeResult, setTributeResult] = useState(null);
  const [tributeStatus, setTributeStatus] = useState(EMPTY_TRIBUTE_STATUS);

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
      if (res.success && res.data) {
        setTributeStatus({
          troop: { ...EMPTY_TRIBUTE_STATUS.troop, ...(res.data.troop || res.data) },
          character: { ...EMPTY_TRIBUTE_STATUS.character, ...(res.data.character || {}) },
        });
      }
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
  const poolCharacters = useMemo(
    () => getBarracksCharacterCardsSorted(cards, occupiedIds),
    [cards, occupiedIds],
  );
  const poolByRarityTroop = useMemo(() => groupTroopCardsByRarity(poolTroops), [poolTroops]);
  const poolByRarityCharacter = useMemo(() => groupTroopCardsByRarity(poolCharacters), [poolCharacters]);

  const troopSelectionCap = Math.min(MAX_TROOP_SELECT, Math.max(0, tributeStatus.troop?.remainingToday ?? 0));
  const characterSelectionCap = Math.min(
    MAX_CHARACTER_SELECT,
    Math.max(0, tributeStatus.character?.remainingToday ?? 0),
  );
  const selectionCap = tributeKind === 'character' ? characterSelectionCap : troopSelectionCap;
  const poolCards = tributeKind === 'character' ? poolCharacters : poolTroops;
  const poolByRarity = tributeKind === 'character' ? poolByRarityCharacter : poolByRarityTroop;

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (poolCards.some((c) => c.instanceId === id)) next.add(id);
      });
      return next;
    });
  }, [poolCards]);

  const baseUrl = import.meta.env.BASE_URL;

  const onToggleSelect = useCallback(
    (id) => {
      setSelected((s) => {
        if (s.has(id)) return toggleInSet(s, id);
        if (selectionCap <= 0) {
          setToast(tributeKind === 'character' ? '今日将领朝贡额度已用尽' : '今日部队朝贡额度已用尽');
          return s;
        }
        if (tributeKind === 'character') {
          return new Set([id]);
        }
        if (s.size >= selectionCap) {
          setToast(`本日部队还可朝贡 ${selectionCap} 张，已达可选上限`);
          return s;
        }
        return toggleInSet(s, id);
      });
    },
    [selectionCap, tributeKind],
  );

  const openSelectModal = useCallback(
    (kind) => {
      const cap = kind === 'character' ? characterSelectionCap : troopSelectionCap;
      if (cap <= 0) {
        setToast(kind === 'character' ? '今日将领朝贡额度已用尽' : '今日部队朝贡额度已用尽');
        return;
      }
      setTributeKind(kind);
      setSelected(new Set());
      setSelectModalOpen(true);
    },
    [characterSelectionCap, troopSelectionCap],
  );

  const closeTributeResult = useCallback(() => {
    setTributeResult(null);
    loadStatus();
  }, [loadStatus]);

  const handleTribute = useCallback(async () => {
    if (!player?.playerId || busy || selected.size === 0) return;
    const submittedIds = [...selected];
    const submittedCards = poolCards.filter((c) => submittedIds.includes(c.instanceId));
    setBusy(true);
    setToast(null);
    try {
      const res = await playerAPI.submitSanGongFuTribute(
        player.playerId,
        submittedIds,
        tributeKind,
      );
      if (res.success) {
        const d = res.data || {};
        setSelected(new Set());
        setSelectModalOpen(false);
        setTributeResult({
          cardType: tributeKind,
          contribution: d.contribution ?? 0,
          deleted: d.deleted ?? submittedIds.length,
          troopLegendaryGranted: d.troopLegendaryGranted ?? 0,
          characterLegendaryGranted: d.characterLegendaryGranted ?? 0,
          breakdown: summarizeTributeCards(submittedCards),
        });
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
  }, [player?.playerId, busy, selected, tributeKind, poolCards, refresh, loadStatus]);

  const troopStatus = tributeStatus.troop || EMPTY_TRIBUTE_STATUS.troop;
  const characterStatus = tributeStatus.character || EMPTY_TRIBUTE_STATUS.character;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col text-left">
      <div className="rounded-lg border border-amber-900/25 bg-stone-900/40 px-2 py-2">
        <div className="text-xs font-semibold text-amber-500/95">朝贡</div>
        <p className="mt-1 break-words text-[10px] leading-snug text-stone-400">{TRIBUTE_REWARD_SUMMARY_LINE}</p>
        <p className="mt-1 text-[10px] text-stone-500">
          今日将领 {characterStatus.usedToday ?? 0} / {characterStatus.maxPerDay ?? 1} · 部队{' '}
          {troopStatus.usedToday ?? 0} / {troopStatus.maxPerDay ?? 5}
        </p>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            disabled={characterSelectionCap <= 0 || busy}
            onClick={() => openSelectModal('character')}
            className="min-w-0 flex-1 rounded-md border border-amber-700/50 bg-amber-950/50 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
          >
            将领朝贡
          </button>
          <button
            type="button"
            disabled={troopSelectionCap <= 0 || busy}
            onClick={() => openSelectModal('troop')}
            className="min-w-0 flex-1 rounded-md border border-amber-700/50 bg-amber-950/50 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
          >
            部队朝贡
          </button>
        </div>
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
        tributeKind={tributeKind}
        poolCards={poolCards}
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
            {previewCard.cardType === 'character' ? (
              <CharacterCard
                character={toCharCardData(previewCard, {}, skillsMap)}
                skillsMap={skillsMap}
                showDetails
                baseUrl={baseUrl}
              />
            ) : (
              <TroopCard troop={toTroopCardData(previewCard)} skillsMap={skillsMap} showDetails baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}

      {tributeResult ? (
        <PoolResultModalFrame title="🤝 朝贡完成" onClose={closeTributeResult}>
          <div className="flex flex-col items-center">
            <div
              style={{ width: 128, height: 192 }}
              className="relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-amber-700/45 bg-gradient-to-b from-cyan-400/15 via-stone-800/50 to-stone-950/90 px-2 py-3 shadow-inner"
            >
              <div className="text-center">
                <div className="text-2xl leading-none">🤝</div>
                <div className="mt-1 text-base font-bold tabular-nums text-cyan-200">
                  +{tributeResult.contribution}
                </div>
              </div>
            </div>
            <div className="mt-3 w-full text-center space-y-1">
              <div className="text-xs font-bold text-amber-200/90">
                {tributeResult.cardType === 'character' ? '将领朝贡' : '部队朝贡'}
                {' · '}
                上缴 {tributeResult.deleted} 张
              </div>
              {tributeResult.breakdown.length > 1 ? (
                <div className="text-stone-400 text-[10px] leading-snug space-y-0.5">
                  {tributeResult.breakdown.map((line) => (
                    <div key={line.rarityKey}>
                      {line.label} ×{line.count}：贡献 +{line.subtotal}
                    </div>
                  ))}
                </div>
              ) : tributeResult.breakdown.length === 1 ? (
                <div className="text-stone-400 text-[10px]">
                  {tributeResult.breakdown[0].label} ×{tributeResult.breakdown[0].count}：贡献 +
                  {tributeResult.breakdown[0].subtotal}
                </div>
              ) : null}
              {tributeResult.troopLegendaryGranted > 0 ? (
                <div className="text-amber-200/85 text-[10px] tabular-nums">
                  势力部队传奇储备 +{tributeResult.troopLegendaryGranted}
                </div>
              ) : null}
              {tributeResult.characterLegendaryGranted > 0 ? (
                <div className="text-amber-200/85 text-[10px] tabular-nums">
                  势力将领传奇储备 +{tributeResult.characterLegendaryGranted}
                </div>
              ) : null}
              <div className="mt-0.5 text-stone-300 text-[10px]">获得贡献值</div>
            </div>
          </div>
        </PoolResultModalFrame>
      ) : null}
    </div>
  );
}
