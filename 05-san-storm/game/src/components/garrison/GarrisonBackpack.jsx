/**
 * 军营区域 — 驻守编组的卡牌仓库
 *
 * 按类型折叠展示：将领、部队、装备件+合成、封装+装备卡、称号、成就、宝物、道具
 * 装备件/卡支持封装（调起 EncapsulateEquipmentModal）
 * 道具无专用卡面：暂用 emoji 列表（数据来自 GET /players/:id/items → config_items）
 */

import { useState, useEffect } from 'react';
import CharacterCard from '@shared/components/card/CharacterCard';
import TroopCard from '@shared/components/card/TroopCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import EncapsulateEquipmentModal from '@/components/game/EncapsulateEquipmentModal';
import { toCharCardData, toTroopCardData, toEquipCardData, toTitleCardData, toTreasureCardData } from '@/utils/cardDataTransforms';
import {
  formatRarityCountWithLimit,
  isRecruitCrossSeasonLimitPool,
} from '@shared/utils/cardPoolRarityLimits';
import { cardPoolAPI } from '@/services/cardPoolApi';
import { playerAPI } from '@/services/playerApi';
import { groupTroopCardsByRarity, RARITY_LABEL } from '@/utils/garrisonBarracksTroopPool';
import { isTroopEquippableForLineup, getTroopRarity } from '@/utils/troopLineupEligibility';
import {
  TROOP_BADGE_ITEM_ID,
  troopBadgeRepairCostForRarity,
  isUsableInventoryItem,
} from '@/utils/troopBadgeDurabilityRepairDisplay.js';
import {
  troopCardDisplayName,
  isWornLegendaryOrCoreTroop,
} from '@/utils/troopBadgeRepairCandidates';
import './garrisonUsableItem.css';

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

const RARITY_DOTS = [
  { key: 'common',    color: 'bg-gray-400' },
  { key: 'rare',      color: 'bg-blue-400' },
  { key: 'epic',      color: 'bg-purple-400' },
  { key: 'legendary', color: 'bg-orange-400' },
  { key: 'core',      color: 'bg-yellow-400' },
];

const SINGLE_ROW_TYPES = [
  { type: 'character',   label: '将领', icon: '👤' },
  { type: 'troop',       label: '部队', icon: '⚔️' },
  { type: 'title',       label: '称号', icon: '🎖️' },
  { type: 'achievement', label: '成就', icon: '🏆' },
  { type: 'treasure',    label: '宝物', icon: '💎' },
];

const ITEM_TYPE_EMOJI = {
  event_key: '🔑',
  season_badge: '🏅',
  chapter_tactical: '🎖️',
};

const ITEM_TYPE_LABEL = {
  event_key: '事件信物',
  season_badge: '赛季徽章',
  chapter_tactical: '篇章信物',
};

function itemEmoji(itemType) {
  return ITEM_TYPE_EMOJI[itemType] || '📦';
}

function countByRarity(typeCards) {
  const counts = {};
  (typeCards || []).forEach(c => {
    const r = c.config?.rarity || c.rarity || 'common';
    counts[r] = (counts[r] || 0) + 1;
  });
  return counts;
}

function groupByRarity(typeCards) {
  const grouped = {};
  (typeCards || []).forEach(card => {
    const r = card.config?.rarity || card.rarity || 'common';
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(card);
  });
  return Object.keys(grouped)
    .sort((a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99))
    .map(r => ({ rarity: r, cards: grouped[r] }));
}

/** 通用卡格按钮（将领/部队/称号/成就/宝物） */
function TypeCell({ type, label, icon, typeCards, displayCards, isExpanded, onToggle }) {
  const shown = displayCards ?? typeCards;
  const counts = countByRarity(shown);
  const total  = typeCards.length;
  const cls = (active, hasItems) =>
    `rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
      ${active ? 'bg-amber-900/30 border border-amber-700/40'
        : hasItems ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
        : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`;
  return (
    <button type="button" onClick={() => onToggle(type, total)} className={cls(isExpanded, total > 0)}>
      <div className="text-lg">{icon}</div>
      <div className="text-stone-300 text-xs leading-tight">{label}</div>
      {total > 0 ? (
        <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
          {RARITY_DOTS.map(({ key, color }) => {
            const count = counts[key];
            if (!count) return null;
            return (
              <div key={key} className="flex items-center gap-0.5">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-stone-400 text-[10px]">{count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
      )}
    </button>
  );
}

export default function GarrisonBackpack({
  cards,
  skillsMap,
  isLandscape = false,
  playerId,
  onAfterEncapsulateChange,
  encapsulateEquipmentPool = [],
  equipmentSetCards = [],
  /** @type {{ card: any, location: string }[] | null} 为空则仅用军营 cards 中耐久未满传奇/核心 */
  badgeRepairCandidates = null,
  footerNote = '驻地编组与上阵编组互斥，请合理分配',
}) {
  const [expandedType, setExpandedType]       = useState(null);
  const [previewCard, setPreviewCard]         = useState(null);
  const [previewItem, setPreviewItem]         = useState(null);
  const [badgePickOpen, setBadgePickOpen]     = useState(false);
  const [badgeBusy, setBadgeBusy]             = useState(false);
  const [badgeMsg, setBadgeMsg]               = useState('');
  const [encapsulateOpen, setEncapsulateOpen] = useState(false);
  const [encapsulateMode, setEncapsulateMode] = useState('draft');
  const [encapsulateEditId, setEncapsulateEditId] = useState(null);
  const [recruitCrossSeasonActive, setRecruitCrossSeasonActive] = useState(false);
  const [inventoryItems, setInventoryItems]   = useState([]);
  const baseUrl = import.meta.env.BASE_URL;

  const refreshInventoryItems = () => {
    if (!playerId) {
      setInventoryItems([]);
      return;
    }
    playerAPI.getItems(playerId)
      .then((res) => {
        if (!res?.success) return;
        setInventoryItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => setInventoryItems([]));
  };

  useEffect(() => {
    if (!playerId) {
      setRecruitCrossSeasonActive(false);
      return undefined;
    }
    let cancelled = false;
    cardPoolAPI.getStatus(playerId).then((res) => {
      if (cancelled || !res?.success) return;
      setRecruitCrossSeasonActive(isRecruitCrossSeasonLimitPool(res.recruit));
    });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    if (!playerId) {
      setInventoryItems([]);
      return undefined;
    }
    let cancelled = false;
    playerAPI.getItems(playerId)
      .then((res) => {
        if (cancelled || !res?.success) return;
        setInventoryItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (!cancelled) setInventoryItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const limitDisplayOpts = { recruitCrossSeasonActive };

  const wornBadgeTargets = Array.isArray(badgeRepairCandidates)
    ? badgeRepairCandidates.filter((row) => isWornLegendaryOrCoreTroop(row?.card))
    : (cards || [])
        .filter((c) => isWornLegendaryOrCoreTroop(c))
        .map((card) => ({ card, location: '军营' }));

  const openBadgeTroopPicker = () => {
    setBadgeMsg('');
    setPreviewItem(null);
    setBadgePickOpen(true);
  };

  const handleUseBadgeOnTroop = async (troopCard) => {
    if (!playerId || !troopCard?.instanceId || badgeBusy) return;
    const cost = troopBadgeRepairCostForRarity(getTroopRarity(troopCard));
    if (cost == null) {
      setBadgeMsg('仅传奇/核心部队可用部队徽章恢复');
      return;
    }
    setBadgeBusy(true);
    setBadgeMsg('');
    try {
      const res = await playerAPI.useItem(playerId, {
        itemId: TROOP_BADGE_ITEM_ID,
        instanceId: troopCard.instanceId,
      });
      if (!res?.success) {
        setBadgeMsg(res?.error || '恢复失败');
        return;
      }
      const name =
        res.data?.repair?.troopName ||
        troopCardDisplayName(troopCard);
      setBadgeMsg(`「${name}」耐久已恢复（消耗 ${res.data?.repair?.cost ?? cost} 枚徽章）`);
      refreshInventoryItems();
      if (typeof onAfterEncapsulateChange === 'function') {
        await onAfterEncapsulateChange();
      }
      const remaining = Number(res.data?.repair?.remainingBadges) || 0;
      if (remaining <= 0) {
        setTimeout(() => setBadgePickOpen(false), 600);
      }
    } catch (e) {
      setBadgeMsg(e?.message || '恢复失败');
    } finally {
      setBadgeBusy(false);
    }
  };

  const canUsePreviewItem = previewItem && isUsableInventoryItem(previewItem);

  const encapsulateEquipmentCards =
    encapsulateEquipmentPool.length > 0
      ? encapsulateEquipmentPool
      : cards.filter(c => c.cardType === 'equipment');

  const resolveEquipPiece = (instanceId) =>
    encapsulateEquipmentCards.find(c => c.instanceId === instanceId) || null;

  const byType = {};
  cards.forEach(card => {
    const t = card.cardType || 'troop';
    if (!byType[t]) byType[t] = [];
    byType[t].push(card);
  });

  const allTroops = byType.troop || [];
  const troopEquippable = allTroops.filter((c) => isTroopEquippableForLineup(c));
  const troopExhausted = allTroops.filter((c) => !isTroopEquippableForLineup(c));

  const toggleType = (type, total) => {
    setExpandedType(prev => (prev === type ? null : (total > 0 ? type : null)));
  };

  const cellCls = (active, hasItems) =>
    `rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
      ${active ? 'bg-amber-900/30 border border-amber-700/40'
        : hasItems ? 'bg-stone-800/60 border border-stone-700/30 hover:border-stone-500 cursor-pointer'
        : 'bg-stone-800/30 border border-stone-800/20 opacity-50 cursor-default'}`;

  return (
    <div className="mx-3 mt-4 mb-4">
      <h4 className="text-stone-400 text-xs font-medium mb-2">
        🏕️ 军营（{cards.length + inventoryItems.length}）
      </h4>

      <div className="grid grid-cols-3 gap-2">
        {/* 将领 + 部队 */}
        {SINGLE_ROW_TYPES.slice(0, 2).map(({ type, label, icon }) => (
          <TypeCell key={type} type={type} label={label} icon={icon}
            typeCards={type === 'troop' ? allTroops : (byType[type] || [])}
            displayCards={type === 'troop' ? troopEquippable : undefined}
            isExpanded={expandedType === type}
            onToggle={toggleType} />
        ))}

        {/* 装备件 + 合成（占位） */}
        {(() => {
          const eqCards = byType['equipment'] || [];
          const counts  = countByRarity(eqCards);
          return (
            <div className="flex gap-2 min-w-0">
              <button type="button"
                className={`min-w-0 flex-[3] ${cellCls(expandedType === 'equipment', eqCards.length > 0)}`}
                onClick={() => toggleType('equipment', eqCards.length)}>
                <div className="text-lg">🛡️</div>
                <div className="text-stone-300 text-xs leading-tight">装备件</div>
                {eqCards.length > 0 ? (
                  <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                    {RARITY_DOTS.map(({ key, color }) => {
                      const count = counts[key];
                      if (!count) return null;
                      return (
                        <div key={key} className="flex items-center gap-0.5">
                          <div className={`w-2 h-2 rounded-full ${color}`} />
                          <span className="text-stone-400 text-[10px]">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
                )}
              </button>
              <button type="button" disabled title="敬请期待"
                className="min-w-0 flex-[2] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
                  bg-stone-800/50 border border-stone-600/40 opacity-80 cursor-not-allowed">
                <div className="text-lg">⚗️</div>
                <div className="text-stone-400 text-xs leading-tight mt-0.5">合成</div>
              </button>
            </div>
          );
        })()}

        {/* 封装 + 装备卡 */}
        <div className="flex gap-2 min-w-0">
          <button type="button"
            className="min-w-0 flex-[2] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              bg-stone-800/70 border border-amber-800/40 hover:border-amber-600/60 cursor-pointer active:scale-[0.98]"
            onClick={() => { setEncapsulateMode('draft'); setEncapsulateEditId(null); setEncapsulateOpen(true); }}>
            <div className="text-lg">📦</div>
            <div className="text-amber-200/90 text-xs leading-tight mt-0.5">封装</div>
          </button>
          <button type="button"
            className="min-w-0 flex-[3] rounded-lg p-2 text-center transition-colors min-h-[4.5rem] flex flex-col items-center justify-center
              bg-stone-800/70 border border-amber-800/40 hover:border-amber-600/60 cursor-pointer active:scale-[0.98]"
            onClick={() => setExpandedType(expandedType === 'equipmentSet' ? null : (equipmentSetCards.length > 0 ? 'equipmentSet' : null))}>
            <div className="text-lg">🎴</div>
            <div className="text-amber-200/90 text-xs leading-tight mt-0.5">装备卡</div>
            {equipmentSetCards.length > 0 ? (
              <div className="text-stone-400 text-[10px] mt-0.5">{equipmentSetCards.length}</div>
            ) : (
              <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
            )}
          </button>
        </div>

        {/* 称号 / 成就 / 宝物 */}
        {SINGLE_ROW_TYPES.slice(2).map(({ type, label, icon }) => (
          <TypeCell key={type} type={type} label={label} icon={icon}
            typeCards={byType[type] || []} isExpanded={expandedType === type}
            onToggle={toggleType} />
        ))}

        {/* 道具（无卡面 · emoji 展示） */}
        <button
          type="button"
          onClick={() => toggleType('item', inventoryItems.length)}
          className={cellCls(expandedType === 'item', inventoryItems.length > 0)}
        >
          <div className="text-lg">🎒</div>
          <div className="text-stone-300 text-xs leading-tight">道具</div>
          {inventoryItems.length > 0 ? (
            <div className="text-stone-400 text-[10px] mt-0.5">{inventoryItems.length}</div>
          ) : (
            <div className="text-amber-400 text-sm font-bold mt-0.5">0</div>
          )}
        </button>
      </div>

      {/* ── 展开卡牌 / 道具列表 ── */}
      {expandedType && (
        ((expandedType === 'equipmentSet' && equipmentSetCards.length > 0) ||
          (expandedType === 'troop' && allTroops.length > 0) ||
          (expandedType === 'item' && inventoryItems.length > 0) ||
          (expandedType !== 'equipmentSet' && expandedType !== 'troop' && expandedType !== 'item' && (byType[expandedType]?.length > 0))) && (
        <div className="mt-2 p-2 bg-stone-800/40 rounded-lg border border-stone-700/30">
          {expandedType === 'character' ? (
            groupByRarity(byType['character']).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">
                  {RARITY_LABEL[rarity]}（{formatRarityCountWithLimit(rCards.length, 'character', rarity, limitDisplayOpts)}）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instanceId} style={{ width: 128, height: 192 }}
                      className="cursor-pointer overflow-hidden"
                      onClick={() => setPreviewCard({ card, type: 'character' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <CharacterCard character={toCharCardData(card, {}, skillsMap)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : expandedType === 'troop' ? (
            <>
              {groupTroopCardsByRarity(troopEquippable).map(({ rarity, cards: rCards }) => (
                <div key={rarity} className="mb-2 last:mb-0">
                  <div className="text-stone-500 text-[10px] mb-1 px-1">
                    {RARITY_LABEL[rarity]}（{formatRarityCountWithLimit(rCards.length, 'troop', rarity)}）
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rCards.map(card => (
                      <div key={card.instanceId} style={{ width: 128, height: 192 }}
                        className="cursor-pointer overflow-hidden"
                        onClick={() => setPreviewCard({ card, type: 'troop' })}>
                        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                          <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {troopExhausted.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-700/40">
                  <div className="text-stone-600 text-[10px] mb-1 px-1">
                    耐久耗尽 · 不可再装（{troopExhausted.length}）
                  </div>
                  <div className="flex flex-wrap gap-1.5 opacity-60">
                    {troopExhausted.map(card => (
                      <div key={card.instanceId} style={{ width: 128, height: 192 }}
                        className="cursor-pointer overflow-hidden"
                        title="核心(金)部队耐久已耗尽，仅可收藏与下赛季继承"
                        onClick={() => setPreviewCard({ card, type: 'troop' })}>
                        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                          <TroopCard troop={toTroopCardData(card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} disableHoverScale />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : expandedType === 'equipment' ? (
            groupByRarity(byType['equipment']).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{RARITY_LABEL[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instanceId} style={{ width: 128, height: 96 }}
                      className="cursor-pointer"
                      onClick={() => setPreviewCard({ card, type: 'equipment' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <EquipmentCard equipment={toEquipCardData(card)} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : expandedType === 'equipmentSet' ? (
            <EquipmentSetGrid
              equipmentSetCards={equipmentSetCards}
              resolveEquipPiece={resolveEquipPiece}
              onEdit={(id) => { setEncapsulateMode('edit'); setEncapsulateEditId(id); setEncapsulateOpen(true); }}
            />
          ) : expandedType === 'title' ? (
            groupByRarity(byType['title']).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{RARITY_LABEL[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instanceId} style={{ width: 128, height: 96 }}
                      className="cursor-pointer"
                      onClick={() => setPreviewCard({ card, type: 'title' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TitleAchievementCard item={toTitleCardData(card)} type="title" baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : expandedType === 'treasure' ? (
            groupByRarity(byType['treasure']).map(({ rarity, cards: rCards }) => (
              <div key={rarity} className="mb-2 last:mb-0">
                <div className="text-stone-500 text-[10px] mb-1 px-1">{RARITY_LABEL[rarity]}（{rCards.length}）</div>
                <div className="flex flex-wrap gap-1.5">
                  {rCards.map(card => (
                    <div key={card.instanceId} style={{ width: 128, height: 96 }}
                      className="cursor-pointer"
                      onClick={() => setPreviewCard({ card, type: 'treasure' })}>
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <EquipmentCard equipment={toTreasureCardData(card)} baseUrl={baseUrl} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : expandedType === 'item' ? (
            <div className="flex flex-wrap gap-1.5">
              {inventoryItems.map((item) => {
                const usable = isUsableInventoryItem(item);
                return (
                  <button
                    key={item.itemId}
                    type="button"
                    className={`relative w-[4.5rem] min-h-[4.5rem] rounded-lg border border-stone-600/50 bg-stone-900/70
                      px-1.5 py-1.5 text-center hover:border-amber-600/50 cursor-pointer active:scale-[0.98]
                      ${usable ? 'garrison-item-usable' : ''}`}
                    onClick={() => setPreviewItem(item)}
                    title={
                      usable
                        ? `${item.name} · 可使用（点击后选择目标）`
                        : (item.description || item.name)
                    }
                  >
                    {usable ? <span className="garrison-item-usable-badge">可使用</span> : null}
                    <div className="relative z-[1] text-2xl leading-none">{itemEmoji(item.itemType)}</div>
                    <div className="relative z-[1] mt-1 text-stone-200 text-[10px] leading-tight line-clamp-2">
                      {item.name}
                    </div>
                    <div className="relative z-[1] mt-0.5 text-amber-300/90 text-[10px] font-bold">
                      ×{item.quantity}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-stone-500 text-xs text-center py-3">尚未实装</div>
          )}
        </div>
      ))}

      {footerNote && (
        <p className="text-stone-600 text-[10px] mt-1.5 text-center">{footerNote}</p>
      )}

      <EncapsulateEquipmentModal
        open={encapsulateOpen}
        onClose={() => { setEncapsulateOpen(false); setEncapsulateMode('draft'); setEncapsulateEditId(null); }}
        mode={encapsulateMode}
        editInstanceId={encapsulateEditId}
        playerId={playerId}
        onAfterChange={onAfterEncapsulateChange}
        equipmentCards={encapsulateEquipmentCards}
        isLandscape={isLandscape}
      />

      {/* 卡牌预览浮层 */}
      {previewCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewCard(null)}>
          <div onClick={e => e.stopPropagation()}>
            {previewCard.type === 'character' && (
              <CharacterCard character={toCharCardData(previewCard.card, {}, skillsMap)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'troop' && (
              <TroopCard troop={toTroopCardData(previewCard.card)} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
            )}
            {previewCard.type === 'equipment' && (
              <EquipmentCard equipment={toEquipCardData(previewCard.card)} baseUrl={baseUrl} disableHoverScale />
            )}
            {previewCard.type === 'title' && (
              <TitleAchievementCard item={toTitleCardData(previewCard.card)} type="title" baseUrl={baseUrl} />
            )}
            {previewCard.type === 'treasure' && (
              <EquipmentCard equipment={toTreasureCardData(previewCard.card)} baseUrl={baseUrl} disableHoverScale />
            )}
          </div>
        </div>
      )}

      {/* 道具预览浮层（emoji，无专用卡面） */}
      {previewItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewItem(null)}>
          <div
            className="mx-4 w-full max-w-xs rounded-xl border border-stone-600/60 bg-stone-900/95 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-5xl leading-none">{itemEmoji(previewItem.itemType)}</div>
            <div className="mt-3 text-center text-amber-100 font-bold text-base">{previewItem.name}</div>
            <div className="mt-1 text-center text-stone-400 text-xs">
              {ITEM_TYPE_LABEL[previewItem.itemType] || previewItem.itemType || '道具'}
              {' · '}×{previewItem.quantity}
            </div>
            {previewItem.description ? (
              <p className="mt-3 text-stone-300 text-sm leading-relaxed text-center">{previewItem.description}</p>
            ) : (
              <p className="mt-3 text-stone-500 text-xs text-center">暂无描述</p>
            )}
            {canUsePreviewItem ? (
              <button
                type="button"
                className="mt-4 w-full rounded-lg border border-amber-700/50 bg-amber-900/40 py-2 text-amber-100 text-sm hover:border-amber-500/60"
                onClick={openBadgeTroopPicker}
              >
                使用 · 选择部队恢复耐久
              </button>
            ) : null}
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-stone-600/50 bg-stone-800/80 py-2 text-stone-200 text-sm hover:border-amber-700/50"
              onClick={() => setPreviewItem(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 部队徽章：选择耐久未满的传奇/核心部队 */}
      {badgePickOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60"
          onClick={() => !badgeBusy && setBadgePickOpen(false)}>
          <div
            className="mx-4 w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-stone-600/60 bg-stone-900/95 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-amber-100 font-bold text-base">选择要恢复的部队</div>
            <p className="mt-1 text-center text-stone-400 text-xs">
              传奇消耗 1 枚徽章 · 核心消耗 2 枚 · 仅耐久未满的传奇/核心
            </p>
            {badgeMsg ? (
              <p className="mt-2 text-center text-amber-200/90 text-xs">{badgeMsg}</p>
            ) : null}
            {wornBadgeTargets.length === 0 ? (
              <p className="mt-4 text-center text-stone-500 text-sm">当前没有可恢复的部队</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                {wornBadgeTargets.map(({ card, location }) => {
                  const rarity = getTroopRarity(card);
                  const cost = troopBadgeRepairCostForRarity(rarity);
                  const maxB = card.maxBattleCount ?? 10;
                  const used = Math.max(0, Number(card.battleCount) || 0);
                  const title = troopCardDisplayName(card);
                  return (
                    <button
                      key={card.instanceId}
                      type="button"
                      disabled={badgeBusy}
                      className="w-[5.5rem] rounded-lg border border-stone-600/50 bg-stone-800/80 px-1 py-1.5 text-center
                        hover:border-amber-600/50 disabled:opacity-50"
                      onClick={() => handleUseBadgeOnTroop(card)}
                      title={`${title} · ${location} · 消耗 ${cost} 枚`}
                    >
                      <div className="text-stone-100 text-[10px] leading-tight line-clamp-2">{title}</div>
                      <div className="mt-0.5 text-sky-300/90 text-[10px]">{location || '军营'}</div>
                      <div className="mt-0.5 text-stone-400 text-[10px]">
                        {RARITY_LABEL[rarity] || rarity}
                      </div>
                      <div className="mt-0.5 text-amber-300/90 text-[10px]">
                        耐久 {Math.max(0, maxB - used)}/{maxB}
                      </div>
                      <div className="mt-0.5 text-emerald-300/90 text-[10px]">−{cost} 徽章</div>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              disabled={badgeBusy}
              className="mt-4 w-full rounded-lg border border-stone-600/50 bg-stone-800/80 py-2 text-stone-200 text-sm"
              onClick={() => setBadgePickOpen(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/** 装备卡（封装集）网格 */
function EquipmentSetGrid({ equipmentSetCards, resolveEquipPiece, onEdit }) {
  const EQUIP_SLOTS = [
    { key: 'weaponInstanceId',    tag: '攻', icon: '⚔️', pos: 'left-1/2 top-[14px] -translate-x-1/2' },
    { key: 'accessory1InstanceId', tag: '速', icon: '✨', pos: 'left-[8px] top-1/2 -translate-y-1/2' },
    { key: 'accessory2InstanceId', tag: '介', icon: '✨', pos: 'right-[8px] top-1/2 -translate-y-1/2' },
    { key: 'armorInstanceId',     tag: '守', icon: '🛡️', pos: 'left-1/2 bottom-[14px] -translate-x-1/2' },
  ];
  const RARITY_TEXT = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-300' };
  const RARITY_LABEL_MAP = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

  return (
    <div className="flex flex-wrap gap-1.5">
      {equipmentSetCards.map(card => {
        const cfg = card.config || {};
        const titleColorClass = RARITY_TEXT[card.config?.rarity || card.rarity || 'common'] || 'text-white';
        return (
          <button key={card.instanceId} type="button"
            className="relative cursor-pointer overflow-hidden"
            style={{ width: 128, height: 192 }}
            onClick={() => onEdit(card.instanceId)}>
            <div
              className="relative rounded-xl border-[3px] border-stone-500/70
                bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
                shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
              style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256, height: 384 }}>
              <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />
              <div className={`absolute left-[8px] top-[12px] ${titleColorClass} text-[14px] leading-tight tracking-[1px] font-bold`}
                style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                {cfg.displayName || '装备卡'}
              </div>
              {EQUIP_SLOTS.map(s => {
                const piece = resolveEquipPiece(cfg[s.key]);
                const pCfg  = piece?.config || {};
                const pName = pCfg.equipmentName || '空';
                const pRar  = pCfg.rarity || piece?.rarity || 'common';
                return (
                  <div key={s.key} className={`absolute ${s.pos}`}>
                    <div className={`rounded-lg border-2 ${piece ? 'border-stone-500 bg-stone-700/90' : 'border-dashed border-stone-600 bg-stone-800'}
                      w-[96px] h-[96px] flex flex-col items-center justify-center`}>
                      {piece ? (
                        <div className="w-full h-full p-1 flex flex-col items-center justify-between text-center">
                          <span className="text-[12px] text-stone-100 truncate w-full leading-tight">{pName}</span>
                          <span className="text-xl opacity-45 leading-none">{s.icon}</span>
                          <span className={`text-[12px] font-bold leading-tight ${RARITY_TEXT[pRar] || 'text-gray-300'}`}>
                            {RARITY_LABEL_MAP[pRar] || '普通'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] text-amber-500/90 font-bold leading-none">{s.tag}</span>
                          <span className="text-2xl opacity-40 leading-none mt-1">{s.icon}</span>
                          <span className="text-[10px] text-stone-500 mt-0.5">空</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
