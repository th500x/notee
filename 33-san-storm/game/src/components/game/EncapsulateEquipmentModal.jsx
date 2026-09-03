/**
 * 装备件封装：草稿套装四槽 + API 持久化；槽内缩略复用称号槽（名/稀有度/特效/四属性 2×2）
 * 交互：空槽 → 选槽后列表装配；已装备槽 → 详情浮层更换（草稿可卸下，已命名仅更换）
 */

import { useState, useCallback, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import {
  rollRandomEquipmentSetName,
  setRarityTierFromScore,
  scoreFromEquipmentRarity,
  validateEquipmentSetDisplayName,
} from '@/utils/equipmentSetName';

const SLOT_PX = 96;

const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3, core: 4 };

const SLOT_INSTANCE_KEYS = {
  weapon: 'weapon_instance_id',
  armor: 'armor_instance_id',
  aux_left: 'accessory_1_instance_id',
  aux_right: 'accessory_2_instance_id',
};

const SET_SCORE_KEYS = [
  'weapon_instance_id',
  'armor_instance_id',
  'accessory_1_instance_id',
  'accessory_2_instance_id',
];

const ENCAPSULATE_SLOTS = [
  { id: 'weapon', label: '武器', statTag: '攻', icon: '⚔️', position: 'top' },
  { id: 'armor', label: '防具', statTag: '守', icon: '🛡️', position: 'bottom' },
  { id: 'aux_left', label: '辅助', statTag: '速', icon: '✨', position: 'left' },
  { id: 'aux_right', label: '辅助', statTag: '介', icon: '✨', position: 'right' },
];

/** 列表标题：武器 / 防具 / 辅助（不含 攻· 等前缀） */
function listTitleForSlotId(slotId) {
  if (slotId === 'weapon') return '武器';
  if (slotId === 'armor') return '防具';
  if (slotId === 'aux_left' || slotId === 'aux_right') return '辅助';
  return '';
}

function slotToEquipmentType(slotId) {
  if (slotId === 'weapon') return 'weapon';
  if (slotId === 'armor') return 'armor';
  if (slotId === 'aux_left' || slotId === 'aux_right') return 'accessory';
  return null;
}

function isDraftSetData(data) {
  const n = data?.display_name;
  return n == null || String(n).trim() === '';
}

function allSlotsFilled(data) {
  if (!data) return false;
  return !!(
    data.weapon_instance_id &&
    data.armor_instance_id &&
    data.accessory_1_instance_id &&
    data.accessory_2_instance_id
  );
}

const rarityLabel = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
const rarityColor = {
  common: 'text-gray-300',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
  core: 'text-yellow-400',
};

/** 装备件摘要：固定展示 6 项（勇智/武政/统魅），不显示运气 */
function getEquipmentSlotMini(card) {
  const cfg = card?.config || {};
  const name = cfg.equipmentName || card?.cardId || '—';
  const rarity = cfg.rarity || card?.rarity || 'common';
  const effect = cfg.specialEffectDesc || '';
  const defs = [
    ['courageBonus', '勇'],
    ['intelligenceBonus', '智'],
    ['combatBonus', '武'],
    ['politicsBonus', '政'],
    ['commandBonus', '统'],
    ['charmBonus', '魅'],
  ];
  const cells = defs.map(([k, short]) => ({
    short,
    val: cfg[k] || 0,
  }));
  return { name, rarity, effect, cells };
}

/** 将装备件映射为 TitleAchievementCard 所需 item（attributeBonus 为×10 存儲，与称号卡一致） */
function equipmentCardToTitleListItem(card) {
  const cfg = card.config || {};
  const attributeBonus = {};
  const pairs = [
    ['luckBonus', 'luck'],
    ['courageBonus', 'courage'],
    ['combatBonus', 'combat'],
    ['commandBonus', 'command'],
    ['intelligenceBonus', 'intelligence'],
    ['politicsBonus', 'politics'],
    ['charmBonus', 'charm'],
  ];
  for (const [bonusKey, abKey] of pairs) {
    const v = cfg[bonusKey];
    if (v != null && Number(v) !== 0) {
      attributeBonus[abKey] = Math.round(Number(v) * 10);
    }
  }
  return {
    id: cfg.equipmentId || card.cardId,
    name: cfg.equipmentName || card.cardId,
    rarity: cfg.rarity || card.rarity || 'common',
    attributeBonus,
    specialEffectDesc: cfg.specialEffectDesc || undefined,
    description: cfg.description || undefined,
  };
}

/**
 * 与编组「选择称号」CardDrawer 同构：顶栏 + 稀有度分组 + 256×192 卡半宽展示
 */
function EncapsulatePickDrawer({ open, headerTitle, categoryLabel, cards, busy, onClose, onPick }) {
  const baseUrl = import.meta.env.BASE_URL;
  if (!open) return null;

  const grouped = {};
  cards.forEach((card) => {
    const rarity = card.config?.rarity || card.rarity || 'common';
    if (!grouped[rarity]) grouped[rarity] = [];
    grouped[rarity].push(card);
  });
  const sortedRarities = Object.keys(grouped).sort(
    (a, b) => (RARITY_ORDER[a] ?? 99) - (RARITY_ORDER[b] ?? 99)
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[222]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="fixed left-0 right-0 bottom-0 top-[4.5rem] sm:top-14 z-[223] bg-stone-900 border-t-2 border-amber-700/50 rounded-t-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h3 className="text-amber-400 text-sm font-bold">{headerTitle}</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-white text-lg">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">
              {categoryLabel ? `暂无可装备的${categoryLabel}` : '暂无可选装备件'}
            </div>
          ) : (
            sortedRarities.map((rarity) => (
              <div key={rarity} className="mb-3">
                <div className="text-stone-500 text-xs mb-1.5 px-1">
                  {rarityLabel[rarity] || rarity}（{grouped[rarity].length}）
                </div>
                <div className="flex flex-wrap gap-2">
                  {grouped[rarity].map((card) => (
                    <div
                      key={card.instanceId}
                      role="button"
                      tabIndex={0}
                      onClick={() => !busy && onPick(card)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
                          e.preventDefault();
                          onPick(card);
                        }
                      }}
                      className={`cursor-pointer hover:brightness-110 active:scale-95 transition-all ${
                        busy ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      style={{ width: 128, height: 96 }}
                    >
                      <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 256 }}>
                        <TitleAchievementCard
                          item={equipmentCardToTitleListItem(card)}
                          type="equipment"
                          baseUrl={baseUrl}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function EncapsulateSlotFace({ slot, filledCard, isSelected, onClick }) {
  const borderClass = isSelected
    ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    : 'border-dashed border-stone-600 hover:border-amber-500/50';

  if (!filledCard) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-lg border-2 ${borderClass}
          bg-stone-800 flex flex-col items-center justify-center
          transition-all duration-200 relative cursor-pointer active:scale-95`}
        style={{ width: SLOT_PX, height: SLOT_PX }}
      >
        <span className="text-2xl opacity-40 leading-none mt-1">{slot.icon}</span>
        <span className="text-[10px] text-stone-500 mt-0.5">空</span>
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0
            bg-stone-900 rounded text-[8px] text-stone-500 whitespace-nowrap"
        >
          {slot.label}
        </div>
      </button>
    );
  }

  const mini = getEquipmentSlotMini(filledCard);
  const fs1 = '9px';
  const fs2 = '8px';
  const fsR = '8px';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 ${isSelected ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'border-stone-500 hover:border-amber-500'}
        bg-stone-800/90 overflow-hidden transition-all duration-200 relative text-left
        cursor-pointer active:scale-95 flex flex-col justify-between`}
      style={{ width: SLOT_PX, height: SLOT_PX, padding: '4px' }}
    >
      <div className="flex items-center justify-between w-full leading-none gap-0.5">
        <span className="text-white font-medium truncate" style={{ fontSize: fs1 }} title={mini.name}>
          {mini.name}
        </span>
        <span className={`font-bold flex-shrink-0 ${rarityColor[mini.rarity] || 'text-gray-300'}`} style={{ fontSize: fsR }}>
          {rarityLabel[mini.rarity] ?? mini.rarity}
        </span>
      </div>
      <div className="w-full min-h-[12px]">
        {mini.effect ? (
          <span className="text-green-400 truncate block text-left leading-tight" style={{ fontSize: fs2 }}>
            ✨{mini.effect}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 w-full">
        {mini.cells.map((c) => (
          <div key={c.short} className="flex flex-col leading-none">
            <span className="text-stone-500" style={{ fontSize: '7px' }}>
              {c.short}
            </span>
            <span className="text-amber-400" style={{ fontSize: fs2 }}>
              {c.val !== 0 ? `+${Number(c.val).toFixed(1)}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

function toEquipmentCardData(card) {
  const cfg = card.config || {};
  const bonusKeys = ['luck', 'courage', 'combat', 'command', 'intelligence', 'politics', 'charm'];
  const bonus = bonusKeys
    .filter((k) => cfg[`${k}Bonus`])
    .map((k) => ({ key: k, value: cfg[`${k}Bonus`] }));
  return {
    id: cfg.equipmentId || card.cardId,
    name: cfg.equipmentName || card.cardId,
    rarity: cfg.rarity || card.rarity || 'common',
    equipmentType: cfg.equipmentType || 'weapon',
    bonus,
    specialEffect: cfg.specialEffect,
    specialEffectDesc: cfg.specialEffectDesc,
    description: cfg.description,
  };
}

/** 已装备槽：详情浮层（草稿可卸下；编辑态仅更换） */
function EncapsulateEquippedDetailOverlay({ card, onClose, onUnequip, onReplace, canUnequip = true }) {
  const baseUrl = import.meta.env.BASE_URL;
  return (
    <div
      className="fixed inset-0 z-[220] bg-black/70 flex items-center justify-center px-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-stone-900 rounded-xl p-4 border border-amber-500/30 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-amber-400 text-sm font-bold">卡牌详情</span>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex justify-center mb-3">
          <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center' }}>
            <EquipmentCard equipment={toEquipmentCardData(card)} baseUrl={baseUrl} />
          </div>
        </div>
        <div className="flex gap-2">
          {canUnequip && (
            <button
              type="button"
              onClick={onUnequip}
              className="flex-1 py-2 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 text-sm hover:bg-red-800/50 transition-colors"
            >
              卸下
            </button>
          )}
          <button
            type="button"
            onClick={onReplace}
            className={`${canUnequip ? 'flex-1' : 'w-full'} py-2 rounded-lg bg-amber-900/50 border border-amber-700/50 text-amber-300 text-sm hover:bg-amber-800/50 transition-colors`}
          >
            更换
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} [playerId]
 * @param {function} [onAfterChange] 保存槽位/命名后刷新档案
 * @param {'draft'|'edit'} [mode] draft=草稿封装；edit=已命名套装编辑（需 editInstanceId）
 * @param {string} [editInstanceId] mode=edit 时套装实例 ID
 * @param {Array} equipmentCards 可选列表用（未上阵、占驻排除由父级过滤）；内含 bound 字段供与草稿 instance 比对
 * @param {boolean} isLandscape
 */
export default function EncapsulateEquipmentModal({
  open,
  onClose,
  playerId,
  onAfterChange,
  equipmentCards = [],
  isLandscape = false,
  mode = 'draft',
  editInstanceId = null,
}) {
  const [draftId, setDraftId] = useState(null);
  const [setData, setSetData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [apiErr, setApiErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  /** 已装备槽：卸下/更换 */
  const [slotDetail, setSlotDetail] = useState(null);
  const [finalizeName, setFinalizeName] = useState('');
  /** 编辑模式：重命名输入 */
  const [editName, setEditName] = useState('');

  const loadSet = useCallback(async () => {
    if (!playerId) return;
    setLoadErr(null);
    try {
      if (mode === 'edit') {
        if (!editInstanceId) {
          setLoadErr('缺少套装实例');
          return;
        }
        const r = await playerAPI.getEquipmentSetById(playerId, editInstanceId);
        if (!r.success) {
          setLoadErr(r.error || '加载失败');
          return;
        }
        setDraftId(r.data.instance_id);
        setSetData(r.data.equipment_set_data || {});
        const dn = r.data.equipment_set_data?.display_name;
        setEditName(dn != null && String(dn).trim() ? String(dn) : '');
        setFinalizeName('');
        return;
      }
      const r = await playerAPI.getEquipmentSetDraft(playerId);
      if (!r.success) {
        setLoadErr(r.error || '加载失败');
        return;
      }
      setDraftId(r.data.instance_id);
      setSetData(r.data.equipment_set_data || {});
      setEditName('');
    } catch (e) {
      setLoadErr(e.message || '网络错误');
    }
  }, [playerId, mode, editInstanceId]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setSlotDetail(null);
      setApiErr(null);
      setLoadErr(null);
      setFinalizeName('');
      setEditName('');
      return;
    }
    if (playerId) void loadSet();
  }, [open, playerId, loadSet]);

  const resolveCard = useCallback(
    (instanceId) => {
      if (!instanceId) return null;
      return equipmentCards.find((c) => c.instanceId === instanceId) || null;
    },
    [equipmentCards]
  );

  const handleSlotClick = useCallback(
    (slotId) => {
      if (!draftId || !setData || busy) return;
      const key = SLOT_INSTANCE_KEYS[slotId];
      const filledId = setData[key];

      if (filledId) {
        const card = resolveCard(filledId);
        if (card) {
          setSlotDetail({ slotId, card });
        } else {
          setApiErr('找不到该装备件数据，请刷新档案后重试');
        }
        setSelectedId(null);
        return;
      }

      if (selectedId === slotId) {
        setSelectedId(null);
        return;
      }
      setSelectedId(slotId);
      setSlotDetail(null);
    },
    [draftId, setData, busy, playerId, selectedId, resolveCard]
  );

  const handleDetailUnequip = useCallback(async () => {
    if (!slotDetail || !draftId || !playerId || busy) return;
    const { slotId } = slotDetail;
    setBusy(true);
    setApiErr(null);
    try {
      const r = await playerAPI.assignEquipmentSetSlot(playerId, draftId, slotId, null);
      if (!r.success) {
        setApiErr(r.error || '卸下失败');
        return;
      }
      setSetData(r.data.equipment_set_data);
      setSlotDetail(null);
      if (onAfterChange) await onAfterChange({ silent: true });
    } catch (e) {
      setApiErr(e.message || '请求失败');
    } finally {
      setBusy(false);
    }
  }, [slotDetail, draftId, playerId, busy, onAfterChange]);

  const handleDetailReplace = useCallback(() => {
    if (!slotDetail) return;
    const { slotId } = slotDetail;
    setSlotDetail(null);
    setSelectedId(slotId);
  }, [slotDetail]);

  const handlePickEquipment = useCallback(
    async (card) => {
      if (!draftId || !selectedId || busy || !playerId) return;
      setBusy(true);
      setApiErr(null);
      try {
        const r = await playerAPI.assignEquipmentSetSlot(playerId, draftId, selectedId, card.instanceId);
        if (!r.success) {
          setApiErr(r.error || '装配失败');
          return;
        }
        setSetData(r.data.equipment_set_data);
        setSelectedId(null);
        if (onAfterChange) await onAfterChange({ silent: true });
      } catch (e) {
        setApiErr(e.message || '请求失败');
      } finally {
        setBusy(false);
      }
    },
    [draftId, selectedId, busy, playerId, onAfterChange]
  );

  const handleRandomSetName = useCallback(() => {
    if (!setData) return;
    const total = SET_SCORE_KEYS.reduce((sum, key) => {
      const c = resolveCard(setData[key]);
      return sum + scoreFromEquipmentRarity(c?.config?.rarity ?? c?.rarity);
    }, 0);
    const tier = setRarityTierFromScore(total);
    const rolled = rollRandomEquipmentSetName(tier);
    if (mode === 'edit') setEditName(rolled);
    else setFinalizeName(rolled);
  }, [setData, resolveCard, mode]);

  const handleFinalize = useCallback(async () => {
    if (!draftId || !playerId || busy) return;
    const validated = validateEquipmentSetDisplayName(finalizeName);
    if (!validated.ok) {
      setApiErr(validated.error);
      return;
    }
    setBusy(true);
    setApiErr(null);
    try {
      const r = await playerAPI.finalizeEquipmentSet(playerId, draftId, validated.value);
      if (!r.success) {
        setApiErr(r.error || '命名失败');
        return;
      }
      setFinalizeName('');
      setSelectedId(null);
      if (onAfterChange) await onAfterChange({ silent: true });
      await loadSet();
    } catch (e) {
      setApiErr(e.message || '请求失败');
    } finally {
      setBusy(false);
    }
  }, [draftId, playerId, busy, finalizeName, onAfterChange, loadSet]);

  const handleRenameSave = useCallback(async () => {
    if (!draftId || !playerId || busy || mode !== 'edit') return;
    const validated = validateEquipmentSetDisplayName(editName);
    if (!validated.ok) {
      setApiErr(validated.error);
      return;
    }
    setBusy(true);
    setApiErr(null);
    try {
      const r = await playerAPI.renameEquipmentSet(playerId, draftId, validated.value);
      if (!r.success) {
        setApiErr(r.error || '保存名称失败');
        return;
      }
      setSetData(r.data.equipment_set_data);
      if (onAfterChange) await onAfterChange({ silent: true });
      await loadSet();
    } catch (e) {
      setApiErr(e.message || '请求失败');
    } finally {
      setBusy(false);
    }
  }, [draftId, playerId, busy, mode, editName, onAfterChange, loadSet]);

  const filteredForSlot = (() => {
    if (!selectedId || !draftId || !setData) return [];
    const t = slotToEquipmentType(selectedId);
    if (!t) return [];
    const placed = new Set(
      [
        setData.weapon_instance_id,
        setData.armor_instance_id,
        setData.accessory_1_instance_id,
        setData.accessory_2_instance_id,
      ].filter(Boolean)
    );
    return equipmentCards.filter((c) => {
      if ((c.config?.equipmentType || 'weapon') !== t) return false;
      if (placed.has(c.instanceId)) return false;
      const b = c.boundEquipmentSetInstanceId;
      if (b && b !== draftId) return false;
      return true;
    });
  })();

  const draftMode = setData && isDraftSetData(setData);
  const showFinalize = mode === 'draft' && draftMode && allSlotsFilled(setData);
  const showRename = mode === 'edit' && setData && !isDraftSetData(setData);
  const listTitle = selectedId ? listTitleForSlotId(selectedId) : '';

  if (!open) return null;

  const cardFrame = (
    <div
      className="relative shrink-0 rounded-xl border-[3px] border-stone-500/70
        bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ width: 256, height: 384 }}
    >
      <div className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35" aria-hidden />

      {ENCAPSULATE_SLOTS.map((slot) => {
        const pos =
          slot.position === 'top'
            ? 'left-1/2 top-[14px] -translate-x-1/2'
            : slot.position === 'bottom'
              ? 'left-1/2 bottom-[14px] -translate-x-1/2'
              : slot.position === 'left'
                ? 'left-[8px] top-1/2 -translate-y-1/2'
                : 'right-[8px] top-1/2 -translate-y-1/2';

        const instKey = SLOT_INSTANCE_KEYS[slot.id];
        const iid = setData?.[instKey];
        const filledCard = iid ? resolveCard(iid) : null;

        return (
          <div key={slot.id} className={`absolute ${pos}`}>
            <EncapsulateSlotFace
              slot={slot}
              filledCard={filledCard}
              isSelected={selectedId === slot.id}
              onClick={() => handleSlotClick(slot.id)}
            />
          </div>
        );
      })}
    </div>
  );

  const headerRow = (
    <div className="flex items-center justify-between w-[256px] shrink-0">
      <h3 className="text-amber-400 text-sm font-bold">📦 装备件封装</h3>
      <button
        type="button"
        className="text-stone-400 hover:text-stone-200 text-lg leading-none px-1"
        onClick={onClose}
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  );

  const closeFooter = (
    <button
      type="button"
      className="w-[256px] py-2 rounded-lg bg-stone-800 border border-stone-600 text-stone-300 text-xs hover:bg-stone-700/80 shrink-0"
      onClick={onClose}
    >
      关闭
    </button>
  );

  const finalizeBlock =
    showFinalize ? (
      <div
        className="w-[256px] shrink-0 rounded-lg border border-amber-800/50 bg-stone-900/80 p-2 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-amber-200/90 text-[10px] font-medium">四槽已满，请为装备卡命名（1～12 字）</div>
        <div className="flex gap-2 items-stretch">
          <input
            type="text"
            value={finalizeName}
            onChange={(e) => {
              const v = e.target.value;
              const cp = [...v];
              setFinalizeName(cp.length > 12 ? cp.slice(0, 12).join('') : v);
            }}
            placeholder="自定义名称"
            className="flex-1 min-w-0 rounded bg-stone-800 border border-stone-600 text-stone-200 text-xs px-2 py-1.5"
            aria-label="装备卡名称"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleRandomSetName}
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-amber-600/70 bg-amber-900/45 text-amber-200 text-xs font-medium
              whitespace-nowrap hover:bg-amber-800/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            随机命名
          </button>
        </div>
        <button
          type="button"
          disabled={busy || !finalizeName.trim()}
          onClick={() => void handleFinalize()}
          className="w-full py-2 rounded-lg bg-amber-800/80 border border-amber-600 text-amber-100 text-xs font-bold
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-700/80"
        >
          {busy ? '提交中…' : '完成封装'}
        </button>
      </div>
    ) : null;

  const renameBlock =
    showRename ? (
      <div
        className="w-[256px] shrink-0 rounded-lg border border-amber-800/50 bg-stone-900/80 p-2 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-amber-200/90 text-[10px] font-medium">装备卡名称（1～12 字）</div>
        <div className="flex gap-2 items-stretch">
          <input
            type="text"
            value={editName}
            onChange={(e) => {
              const v = e.target.value;
              const cp = [...v];
              setEditName(cp.length > 12 ? cp.slice(0, 12).join('') : v);
            }}
            placeholder="名称"
            className="flex-1 min-w-0 rounded bg-stone-800 border border-stone-600 text-stone-200 text-xs px-2 py-1.5"
            aria-label="装备卡名称"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleRandomSetName}
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-amber-600/70 bg-amber-900/45 text-amber-200 text-xs font-medium
              whitespace-nowrap hover:bg-amber-800/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            随机命名
          </button>
        </div>
        <button
          type="button"
          disabled={busy || !editName.trim()}
          onClick={() => void handleRenameSave()}
          className="w-full py-2 rounded-lg bg-amber-800/80 border border-amber-600 text-amber-100 text-xs font-bold
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-700/80"
        >
          {busy ? '保存中…' : '保存名称'}
        </button>
      </div>
    ) : null;

  const leftColumn = (
    <div
      className={`flex flex-col items-center gap-3 shrink-0 ${isLandscape ? '' : 'w-full max-w-[92vw]'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {headerRow}
      {!playerId && <p className="text-red-400 text-xs w-[256px]">未登录，无法封装</p>}
      {loadErr && <p className="text-red-400 text-xs w-[256px] text-center">{loadErr}</p>}
      {apiErr && <p className="text-amber-300 text-xs w-[256px] text-center">{apiErr}</p>}
      {busy && <p className="text-stone-500 text-[10px] w-[256px] text-center">处理中…</p>}
      {cardFrame}
      {finalizeBlock}
      {renameBlock}
      {closeFooter}
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[210] flex bg-black/65 px-3 py-4 ${
        isLandscape ? 'items-center justify-start pl-4 md:pl-6' : 'items-center justify-center'
      }`}
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {leftColumn}
      </div>

      {slotDetail?.card && (
      <EncapsulateEquippedDetailOverlay
          card={slotDetail.card}
          onClose={() => setSlotDetail(null)}
          onUnequip={() => void handleDetailUnequip()}
          onReplace={handleDetailReplace}
        canUnequip={mode === 'draft'}
        />
      )}

      <EncapsulatePickDrawer
        open={!!selectedId}
        headerTitle={`${listTitle}（${filteredForSlot.length}）· 点击装配`}
        categoryLabel={listTitle}
        cards={filteredForSlot}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onPick={(card) => void handlePickEquipment(card)}
      />
    </div>
  );
}
