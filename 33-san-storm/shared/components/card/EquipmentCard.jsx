import React from 'react';
import PropTypes from 'prop-types';

/**
 * 装备件卡牌组件（共享版本）
 *
 * 尺寸: 256 × 192 px（部队卡牌的一半高度）
 * 背景: 复用 bg_r1~bg_r5.png，backgroundPosition: center 截取中间段
 *
 * 布局（仿 TroopCard）:
 *   顶部名称区   40px  — 类型图标 + 名称 + 稀有度标签
 *   属性加成区   72px  — bonus 列表（中文标签 + 数值）
 *   特效/描述区  80px  — 特殊效果（中文）或描述
 */
const EquipmentCard = ({
  equipment,
  baseUrl = '',
  onSelect,
  disableHoverScale = false,
}) => {
  // ── 稀有度配色（与 TroopCard 完全一致）────────────────────────────
  const rarityColors = {
    core:      { border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/50', name: '核心' },
    legendary: { border: 'border-orange-500', text: 'text-orange-400', glow: 'shadow-orange-500/50', name: '传奇' },
    epic:      { border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/50', name: '史诗' },
    rare:      { border: 'border-blue-500',   text: 'text-blue-400',   glow: 'shadow-blue-500/50',   name: '稀有' },
    common:    { border: 'border-gray-500',   text: 'text-gray-400',   glow: 'shadow-gray-500/50',   name: '普通' },
  };

  // ── 装备类型 ─────────────────────────────────────────────────────
  const typeMap = {
    weapon:    { icon: '⚔️', name: '武器' },
    armor:     { icon: '🛡️', name: '防具' },
    accessory: { icon: '📖', name: '辅助' },
    treasure:  { icon: '💎', name: '宝物' },
  };

  // ── bonus key → 中文标签 ─────────────────────────────────────────
  const bonusLabelMap = {
    luck:         { label: '运', icon: '🍀' },
    courage:      { label: '勇', icon: '🔥' },
    combat:       { label: '武', icon: '⚔️' },
    command:      { label: '统', icon: '🏳️' },
    intelligence: { label: '智', icon: '📜' },
    politics:     { label: '政', icon: '🏛️' },
    charm:        { label: '魅', icon: '✨' },
  };

  const rarity   = rarityColors[equipment.rarity]      || rarityColors.common;
  const typeInfo = typeMap[equipment.equipmentType]     || { icon: '📦', name: '装备' };

  // ── 背景图路径 ───────────────────────────────────────────────────
  const rarityToFilename = {
    common: 'bg_r1', rare: 'bg_r2', epic: 'bg_r3', legendary: 'bg_r4', core: 'bg_r5',
  };
  const bgUrl = `${baseUrl}assets/san_1_ui_card/bg/${rarityToFilename[equipment.rarity] || 'bg_r1'}.png`;

  return (
    <div
      className={`relative w-[256px] ${onSelect ? 'cursor-pointer' : ''} group`}
      onClick={() => onSelect && onSelect(equipment)}
    >
      <div
        className={`
          relative w-full h-[192px]
          rounded-xl overflow-hidden
          border-2 ${rarity.border}
          shadow-xl ${rarity.glow}
          transition-all duration-300
          ${disableHoverScale ? '' : 'hover:scale-105 hover:shadow-2xl'}
        `}
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#1f2937',
        }}
      >

        {/* ── 顶部名称区 40px ── */}
        <div className="relative h-[40px] px-3 py-2 bg-black/10 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeInfo.icon}</span>
            <h3 className="text-gray-900 font-bold text-base truncate max-w-[140px]">
              {equipment.name}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {equipment.equipmentType === 'treasure' && equipment.usesRemaining != null && (
              <div className={`px-1.5 py-0.5 rounded bg-black/25 backdrop-blur-sm text-[10px] font-medium ${
                equipment.usesRemaining <= 1 ? 'text-red-300' : 'text-cyan-200'
              }`}>
                剩余{equipment.usesRemaining}{equipment.maxUses != null ? `/${equipment.maxUses}` : ''}
              </div>
            )}
            {equipment.equipmentType === 'treasure' && equipment.usesRemaining == null && (
              <div className="px-1.5 py-0.5 rounded bg-black/25 backdrop-blur-sm text-[10px] font-medium text-yellow-200">
                永久
              </div>
            )}
            <div className="px-1.5 py-0.5 rounded bg-black/20 backdrop-blur-sm text-[10px] font-medium text-gray-800">
              {typeInfo.name}
            </div>
            <div className="px-1.5 py-0.5 rounded bg-black/20 backdrop-blur-sm text-[10px] font-medium text-gray-900">
              {rarity.name}
            </div>
          </div>
        </div>

        {/* ── 属性加成区 72px ── */}
        <div className="relative h-[72px] pl-4 pr-3 py-2 border-t border-gray-400/30">
          {equipment.bonus && equipment.bonus.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {equipment.bonus.slice(0, 6).map((b, i) => {
                const meta = bonusLabelMap[b.key] || { label: b.key, icon: '➕' };
                const val  = typeof b.value === 'number' ? b.value : parseFloat(b.value);
                return (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <span className="text-[11px]">{meta.icon}</span>
                    <span className="text-gray-700">{meta.label}</span>
                    <span className="text-gray-900 font-bold">
                      {val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-gray-500">无属性加成</span>
          )}
        </div>

        {/* ── 特效/描述区 80px ── */}
        <div className="relative h-[80px] pl-4 pr-3 py-2 border-t border-gray-400/30">
          {equipment.specialEffectDesc ? (
            <>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-purple-400 text-[10px]">✨</span>
                <span className="text-gray-700 text-[10px] font-medium">特效</span>
              </div>
              <p className="text-purple-900 text-[10px] leading-relaxed line-clamp-2">
                {equipment.specialEffectDesc}
              </p>
              {equipment.description && (
                <p className="text-gray-600 text-[9px] leading-relaxed mt-1 line-clamp-1 italic">
                  {equipment.description}
                </p>
              )}
            </>
          ) : equipment.description ? (
            <>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-amber-400 text-[10px]">📜</span>
                <span className="text-gray-700 text-[10px] font-medium">描述</span>
              </div>
              <p className="text-gray-800 text-[10px] leading-relaxed line-clamp-3">
                {equipment.description}
              </p>
            </>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>

      </div>
    </div>
  );
};

EquipmentCard.propTypes = {
  equipment: PropTypes.shape({
    id:                PropTypes.string.isRequired,
    name:              PropTypes.string.isRequired,
    rarity:            PropTypes.oneOf(['core', 'legendary', 'epic', 'rare', 'common']).isRequired,
    equipmentType:     PropTypes.oneOf(['weapon', 'armor', 'accessory', 'treasure']).isRequired,
    series:            PropTypes.string,
    usesRemaining:     PropTypes.number,
    maxUses:           PropTypes.number,
    bonus:             PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, value: PropTypes.number })),
    specialEffect:     PropTypes.string,
    specialEffectDesc: PropTypes.string,
    description:       PropTypes.string,
  }).isRequired,
  baseUrl:             PropTypes.string,
  onSelect:            PropTypes.func,
  disableHoverScale:   PropTypes.bool,
};

export default EquipmentCard;
