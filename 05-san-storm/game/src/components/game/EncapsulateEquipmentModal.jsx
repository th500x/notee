/**
 * 装备件封装：256×384 标准卡牌比例外框 + 四装备槽（十字：上武器 / 下防具 / 左右辅助）
 * 槽位视觉与编组页 EquipSlot 空槽一致（64×64、虚线框、底标）
 */
import { useState, useCallback, useEffect } from 'react';

const ENCAPSULATE_SLOTS = [
  { id: 'weapon', label: '武器', icon: '⚔️', position: 'top' },
  { id: 'armor', label: '防具', icon: '🛡️', position: 'bottom' },
  { id: 'aux_left', label: '辅助', icon: '✨', position: 'left' },
  { id: 'aux_right', label: '辅助', icon: '✨', position: 'right' },
];

/** 与 LineupTab/GarrisonLineup 中 EquipSlot 空槽相同的 class 体系 */
function EncapsulateSlotButton({ slot, isSelected, onClick }) {
  const borderClass = isSelected
    ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    : 'border-dashed border-stone-600 hover:border-amber-500/50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 ${borderClass}
        bg-stone-800 flex flex-col items-center justify-center
        transition-all duration-200 relative cursor-pointer active:scale-95`}
      style={{ width: 64, height: 64 }}
    >
      <span className="text-lg opacity-40">{slot.icon}</span>
      <span className="text-[8px] text-stone-500 mt-0.5">空</span>
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0
          bg-stone-900 rounded text-[7px] text-stone-500 whitespace-nowrap"
      >
        {slot.label}
      </div>
    </button>
  );
}

/**
 * @param {boolean} open
 * @param {function} onClose
 */
export default function EncapsulateEquipmentModal({ open, onClose }) {
  const [selectedId, setSelectedId] = useState(null);

  const handleSlotClick = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/65 px-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-3 max-h-[90vh] rounded-xl border border-stone-600/50
          bg-[#1a1824]/90 p-3 shadow-xl backdrop-blur-[2px]"
        onClick={(e) => e.stopPropagation()}
      >
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

        {/* 标准卡牌外框 256×384 — 低透底（高不透明度），略见背后但不发白 */}
        <div
          className="relative shrink-0 rounded-xl border-[3px] border-stone-500/70
            bg-gradient-to-b from-stone-700/90 via-stone-800/90 to-stone-950/95
            shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]"
          style={{ width: 256, height: 384 }}
        >
          <div
            className="pointer-events-none absolute inset-1 rounded-lg border border-stone-500/35"
            aria-hidden
          />

          {ENCAPSULATE_SLOTS.map((slot) => {
            const pos =
              slot.position === 'top'
                ? 'left-1/2 top-[28px] -translate-x-1/2'
                : slot.position === 'bottom'
                  ? 'left-1/2 bottom-[28px] -translate-x-1/2'
                  : slot.position === 'left'
                    ? 'left-[10px] top-1/2 -translate-y-1/2'
                    : 'right-[10px] top-1/2 -translate-y-1/2';

            return (
              <div key={slot.id} className={`absolute ${pos}`}>
                <EncapsulateSlotButton
                  slot={slot}
                  isSelected={selectedId === slot.id}
                  onClick={() => handleSlotClick(slot.id)}
                />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="w-[256px] py-2 rounded-lg bg-stone-800 border border-stone-600 text-stone-300 text-xs hover:bg-stone-700/80"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
