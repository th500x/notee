/**
 * 驻地编组 — 单将领槽位面板
 *
 * 根据 isLandscape 自动切换竖屏（左3槽+角色卡+右3槽）
 * 与横屏（角色卡+2×3槽位网格+编组数据）两种布局。
 *
 * 与主组件 GarrisonLineup 解耦：不访问外部 context，
 * 所有数据与回调均通过 props 传入。
 */

import CharacterCard from '@shared/components/card/CharacterCard';
import { toCharCardData } from '@/utils/cardDataTransforms';
import EquipSlot from './GarrisonEquipSlot';
import GarrisonStatsPanel from './GarrisonStatsPanel';
import GeneralNotRecruited from './GarrisonGeneralNotRecruited';

/** 角色卡 CSS 缩放比例（卡牌设计尺寸 256×384） */
const CARD_SCALE_PORTRAIT  = 0.72;
const CARD_SCALE_LANDSCAPE = 0.82;

/** 槽位定义 — 与 LineupTab 的 GENERAL_SLOTS 一致 */
const GENERAL_SLOTS = [
  { id: 'troop1',       label: '部队1',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'troop2',       label: '部队2',  icon: '⚔️', side: 'left',  implemented: true },
  { id: 'equipmentSet', label: '装备卡', icon: '🛡️', side: 'left',  implemented: true },
  { id: 'title',        label: '称号',   icon: '🎖️', side: 'right', implemented: true },
  { id: 'achievement',  label: '成就',   icon: '🏆', side: 'right', implemented: true },
  { id: 'treasure',     label: '宝物',   icon: '💎', side: 'right', implemented: true },
];

const LEFT_SLOTS  = GENERAL_SLOTS.filter(s => s.side === 'left');
const RIGHT_SLOTS = GENERAL_SLOTS.filter(s => s.side === 'right');

/**
 * @param {object} props
 * @param {'char1'|'char2'} props.charKey
 * @param {boolean}  props.isLandscape
 * @param {object|null} props.charCard          - 驻守将领卡实例（null 表示未配置）
 * @param {object}   props.attributeBonus       - 从后端 attributeBonusBySlot 读取的加成
 * @param {object[]} props.availableCharacters  - 可选装的将领卡列表（未上阵、未被占用）
 * @param {Function} props.onEquipCharacter     - (card) => void
 * @param {object}   props.skillsMap
 * @param {Function} props.getSlotContent       - (slot, charKey) => card | null
 * @param {object|null} props.selectedSlot      - 当前选中槽位（{ id, charKey }）
 * @param {Function} props.onSlotClick          - (slot, content, charKey) => void
 * @param {Function} props.onCharCardClick      - (card, charKey) => void
 * @param {object|null} props.garrison          - 当前卡池驻守行（供 GarrisonStatsPanel）
 * @param {object[]} props.cards                - 玩家全量卡牌（供 GarrisonStatsPanel）
 * @param {Function} props.getCardFromGarrison  - (fieldName) => card | null
 * @param {string|null} props.playerId
 */
export default function GarrisonGeneralPanel({
  charKey,
  isLandscape,
  charCard,
  attributeBonus,
  availableCharacters,
  onEquipCharacter,
  skillsMap,
  getSlotContent,
  selectedSlot,
  onSlotClick,
  onCharCardClick,
  garrison,
  cards,
  getCardFromGarrison,
  playerId,
}) {
  const charLabel = charKey === 'char1' ? '将领1' : '将领2';
  const baseUrl = import.meta.env.BASE_URL;

  if (!charCard) {
    return (
      <GeneralNotRecruited
        label={charLabel}
        unequippedCharacters={availableCharacters}
        onEquipCharacter={onEquipCharacter}
        skillsMap={skillsMap}
      />
    );
  }

  const charData = toCharCardData(charCard, attributeBonus, skillsMap);

  if (isLandscape) {
    const cardScale = CARD_SCALE_LANDSCAPE;
    const cardHeight = Math.round(384 * cardScale);
    return (
      <div className="flex items-stretch h-full p-1">
        {/* 左侧：角色卡 */}
        <div
          className="flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={() => onCharCardClick(charCard, charKey)}
        >
          <div style={{ transform: `scale(${cardScale})`, transformOrigin: 'top left', height: `${cardHeight}px` }}>
            <CharacterCard character={charData} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
          </div>
        </div>

        {/* 右侧：2×3 槽位网格 + 编组数据 */}
        <div className="ml-1">
          <div className="grid grid-cols-3 gap-3">
            {GENERAL_SLOTS.map(slot => {
              const content = getSlotContent(slot, charKey);
              return (
                <EquipSlot
                  key={slot.id}
                  slot={slot}
                  content={content}
                  isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                  onClick={() => onSlotClick(slot, content, charKey)}
                  baseUrl={baseUrl}
                  skillsMap={skillsMap}
                  mini
                />
              );
            })}
          </div>
          <GarrisonStatsPanel
            garrison={garrison}
            charKey={charKey}
            cards={cards}
            getCardFromGarrison={getCardFromGarrison}
            attributeBonus={attributeBonus}
            compact
            playerId={playerId}
          />
        </div>
      </div>
    );
  }

  /* ── 竖屏：左3槽 + 角色卡 + 右3槽 ── */
  return (
    <div className="px-1 py-4">
      <div className="flex items-start justify-center">
        {/* 左侧槽位 */}
        <div className="flex flex-col justify-between w-[64px] -mr-4" style={{ height: '276px' }}>
          {LEFT_SLOTS.map(slot => {
            const content = getSlotContent(slot, charKey);
            return (
              <EquipSlot
                key={slot.id}
                slot={slot}
                content={content}
                isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                onClick={() => onSlotClick(slot, content, charKey)}
                baseUrl={baseUrl}
                skillsMap={skillsMap}
              />
            );
          })}
        </div>

        {/* 中央角色卡 */}
        <div
          className="flex-shrink-0 cursor-pointer"
          style={{ height: '276px', overflow: 'hidden' }}
          onClick={() => onCharCardClick(charCard, charKey)}
        >
          <div className="origin-top" style={{ transform: `scale(${CARD_SCALE_PORTRAIT})` }}>
            <CharacterCard character={charData} skillsMap={skillsMap} showDetails={true} baseUrl={baseUrl} />
          </div>
        </div>

        {/* 右侧槽位 */}
        <div className="flex flex-col justify-between w-[64px] -ml-4" style={{ height: '276px' }}>
          {RIGHT_SLOTS.map(slot => {
            const content = getSlotContent(slot, charKey);
            return (
              <EquipSlot
                key={slot.id}
                slot={slot}
                content={content}
                isSelected={selectedSlot?.id === slot.id && selectedSlot?.charKey === charKey}
                onClick={() => onSlotClick(slot, content, charKey)}
                baseUrl={baseUrl}
                skillsMap={skillsMap}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
