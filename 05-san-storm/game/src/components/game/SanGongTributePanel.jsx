/**
 * 三公府 · 互动 · 朝贡：与驻军所「军营」相同的部队池展示与缩略卡样式；每日最多上缴 5 张。
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
import { MAX_LINEUP_BARRACKS_TROOP_CARDS } from '@/constants/barracksLimits';

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
    if (!player?.player_id) return;
    try {
      const res = await playerAPI.getSanGongFuTributeStatus(player.player_id);
      if (res.success && res.data) setTributeStatus(res.data);
    } catch {
      /* ignore */
    }
  }, [player?.player_id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
  const poolByRarity = useMemo(() => groupTroopCardsByRarity(poolTroops), [poolTroops]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (poolTroops.some((c) => c.instance_id === id)) next.add(id);
      });
      return next;
    });
  }, [poolTroops]);

  const baseUrl = import.meta.env.BASE_URL;

  const onToggleSelect = useCallback(
    (id) => {
      setSelected((s) => {
        if (s.has(id)) return toggleInSet(s, id);
        const cap = Math.min(MAX_SELECT, Math.max(0, tributeStatus.remainingToday ?? 0));
        if (cap <= 0) {
          setToast('今日朝贡额度已用尽');
          return s;
        }
        if (s.size >= cap) {
          setToast(`本日还可朝贡 ${cap} 张，已达可选上限`);
          return s;
        }
        return toggleInSet(s, id);
      });
    },
    [tributeStatus.remainingToday],
  );

  const handleTribute = useCallback(async () => {
    if (!player?.player_id || busy || selected.size === 0) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await playerAPI.submitSanGongFuTribute(player.player_id, [...selected]);
      if (res.success) {
        const d = res.data || {};
        setSelected(new Set());
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
  }, [player?.player_id, busy, selected, refresh, loadStatus]);

  const renderTroopThumb = (card) => {
    const id = card.instance_id;
    const isSel = selected.has(id);
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleSelect(id);
          }
        }}
        style={{ width: 128, height: 192 }}
        className={`cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
          isSel ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]' : 'border-stone-700/60 hover:border-amber-700/50'
        }`}
        onClick={() => onToggleSelect(id)}
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col text-left">
      <div className="mb-2 shrink-0 rounded-lg border border-amber-900/25 bg-stone-900/40 px-2 py-2">
        <div className="text-xs font-semibold text-amber-500/95">朝贡</div>
        <p className="mt-1 break-words text-[10px] leading-snug text-stone-400">{TRIBUTE_REWARD_SUMMARY_LINE}</p>
        <p className="mt-1 text-[10px] text-stone-500">
          今日已朝贡 {tributeStatus.usedToday ?? 0} / {tributeStatus.maxPerDay ?? 5}，还可选 {tributeStatus.remainingToday ?? 5} 张额度；当前已选 {selected.size} 张
        </p>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={handleTribute}
          className="mt-2 w-full rounded-md border border-amber-700/50 bg-amber-950/50 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
        >
          {busy ? '处理中…' : '确认朝贡'}
        </button>
      </div>

      {toast ? (
        <div className="mb-2 shrink-0 rounded border border-stone-600/50 bg-stone-800/80 px-2 py-1.5 text-[11px] text-stone-200">
          {toast}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-stone-700/35 bg-stone-950/40 p-1">
        <div className="mb-1 shrink-0 text-[10px] text-stone-600">军营列表可上下滚动查看完整卡牌</div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-1 touch-pan-y [-webkit-overflow-scrolling:touch]">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-stone-400">军营（与驻军所军营池一致）</h3>
          <span className="text-[10px] text-amber-500/90">
            当前 {poolTroops.length}/{MAX_LINEUP_BARRACKS_TROOP_CARDS} 张
          </span>
        </div>
        {poolTroops.length === 0 ? (
          <p className="text-center text-xs text-stone-500">军营池内暂无可展示的部队卡</p>
        ) : (
          <div className="space-y-2">
            {poolByRarity.map(({ rarity, cards: rCards }) => (
              <div key={`t-${rarity}`}>
                <div className="mb-1 px-1 text-[10px] text-stone-500">
                  {RARITY_LABEL[rarity] || rarity}（{rCards.length}）
                </div>
                <div className="flex flex-wrap gap-2">{rCards.map((card) => renderTroopThumb(card))}</div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-stone-600">双击卡面可全尺寸预览</p>
        </div>
      </div>

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
