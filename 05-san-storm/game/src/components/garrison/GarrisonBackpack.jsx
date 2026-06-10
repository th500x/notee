/**
 * 军营区域 — 驻守编组的卡牌仓库
 *
 * 按类型折叠展示：将领、部队、装备件+合成、封装+装备卡、称号、成就、宝物
 * 装备件/卡支持封装（调起 EncapsulateEquipmentModal）
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

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };
const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };

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
function TypeCell({ type, label, icon, typeCards, isExpanded, onToggle }) {
  const counts = countByRarity(typeCards);
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
  footerNote = '驻地编组与上阵编组互斥，请合理分配',
}) {
  const [expandedType, setExpandedType]       = useState(null);
  const [previewCard, setPreviewCard]         = useState(null);
  const [encapsulateOpen, setEncapsulateOpen] = useState(false);
  const [encapsulateMode, setEncapsulateMode] = useState('draft');
  const [encapsulateEditId, setEncapsulateEditId] = useState(null);
  const [recruitCrossSeasonActive, setRecruitCrossSeasonActive] = useState(false);
  const baseUrl = import.meta.env.BASE_URL;

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

  const limitDisplayOpts = { recruitCrossSeasonActive };

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
      <h4 className="text-stone-400 text-xs font-medium mb-2">🏕️ 军营（{cards.length}）</h4>

      <div className="grid grid-cols-3 gap-2">
        {/* 将领 + 部队 */}
        {SINGLE_ROW_TYPES.slice(0, 2).map(({ type, label, icon }) => (
          <TypeCell key={type} type={type} label={label} icon={icon}
            typeCards={byType[type] || []} isExpanded={expandedType === type}
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
      </div>

      {/* ── 展开卡牌列表 ── */}
      {expandedType && (
        ((expandedType === 'equipmentSet' && equipmentSetCards.length > 0) ||
          (expandedType !== 'equipmentSet' && (byType[expandedType]?.length > 0))) && (
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
            groupByRarity(byType['troop']).map(({ rarity, cards: rCards }) => (
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
            ))
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
