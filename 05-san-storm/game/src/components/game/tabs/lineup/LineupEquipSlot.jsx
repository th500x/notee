/**
 * 上阵编组的装备槽（EquipSlot）
 *
 * 4 种特化 + 1 种通用兜底：
 *   1. troop / troop1 / troop2  → 部队卡摘要（5 行：名+稀有度 / 耐久+兵力 / 攻击距离 / 攻防 / 速移）
 *   2. title                    → 称号卡摘要（3 行：名+稀有度 / 特效 / 属性加成）
 *   3. position                 → 官职卡摘要（4 行：名+稀有度 / 声/贡/资 / 兵种加成 / 特权）
 *   4. equipmentSet             → 装备卡摘要（4 行：名+稀有度 / 6 项属性两列展示）
 *   5. 其它                      → 通用图标（icon + 槽位名）
 *
 * 其余特殊状态：未实装（implemented=false）显示 🔒；空槽显示 icon + 空。
 *
 * mini 参数：横屏 4 象限内槽位放大到 96×96（更多文字空间）；竖屏标准 64×64。
 */

import { RARITY_LABEL, RARITY_COLOR_MINI } from './lineupSlots';
import {
  formatStipendContributionCompact,
  formatStipendReputationCompact,
  formatStipendResourceCompact,
} from '@shared/utils/formatPositionStipendBonuses.js';

export default function LineupEquipSlot({ slot, content, isSelected, onClick, baseUrl, skillsMap, mini = false }) {
  const isEmpty = !content;
  const isLocked = !slot.implemented;
  const isTroopSlot = slot.id === 'troop' || slot.id === 'troop1' || slot.id === 'troop2';

  const slotW = mini ? 96 : 64;
  const slotH = mini ? 96 : 64;

  const fs1 = mini ? '9px' : '6px';
  const fs2 = mini ? '9px' : '6px';
  const fsR = mini ? '8px' : '5.5px';

  const baseBorderClass = isSelected
    ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    : 'border-stone-500 hover:border-amber-500';

  /* ── 已装备部队卡摘要 ── */
  if (!isLocked && !isEmpty && isTroopSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.cardId;
    const rarity = cfg.rarity || content.rarity || 'common';
    const maxBattle = content.maxBattleCount ?? 10;
    const used = Math.max(0, Math.min(content.battleCount ?? 0, maxBattle));
    const remaining = Math.max(0, maxBattle - used);
    const durability = `${remaining}/${maxBattle}`;
    const troops = `${content.currentTroops ?? cfg.maxTroops ?? '?'}`;
    const maxTroops = (cfg.maxTroops || 0) + (content.bonusMaxTroops || 0);
    const bonusAttack = Number(content.bonusAttack ?? content.bonus_attack) || 0;
    const bonusDefense = Number(content.bonusDefense ?? content.bonus_defense) || 0;
    const bonusSpeed = Number(content.bonusSpeed ?? content.bonus_speed) || 0;
    const bonusMovement = Number(content.bonusMovement ?? content.bonus_movement) || 0;
    const atk = ((cfg.attack || 0) + bonusAttack / 10).toFixed(0);
    const def = ((cfg.defense || 0) + bonusDefense / 10).toFixed(0);
    const spd = (cfg.speed ?? 0) + bonusSpeed;
    const mov = (cfg.movement ?? 0) + bonusMovement;
    const range = cfg.range ?? 1;

    const rangeBlocks = Array.from({ length: range }, (_, i) => (
      <span
        key={i}
        className="inline-block rounded-[1px]"
        style={{ width: mini ? '3px' : '2px', height: mini ? '3px' : '2px', background: '#f87171' }}
      />
    ));

    const isLastUse = remaining === 1;
    const bgClass = isLastUse ? 'bg-red-900/30' : 'bg-stone-800/90';

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${baseBorderClass} ${bgClass}
                    overflow-hidden transition-all duration-200 relative
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold ${RARITY_COLOR_MINI[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className={isLastUse ? 'text-red-400' : 'text-stone-400'} style={{ fontSize: fs2 }}>🚩{durability}</span>
          <span className={parseInt(troops) >= maxTroops ? 'text-green-400' : 'text-yellow-400'} style={{ fontSize: fs2 }}>👥{troops}</span>
        </div>
        <div className="flex items-center gap-0.5 w-full">
          <span className="text-stone-500" style={{ fontSize: fs2 }}>距</span>
          <div className="flex gap-[1px]">{rangeBlocks}</div>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-red-400" style={{ fontSize: fs2 }}>攻{atk}</span>
          <span className="text-blue-400" style={{ fontSize: fs2 }}>防{def}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-cyan-400" style={{ fontSize: fs2 }}>速{spd}</span>
          <span className="text-amber-400" style={{ fontSize: fs2 }}>移{mov}</span>
        </div>
      </button>
    );
  }

  /* ── 已装备称号 / 成就卡摘要（结构一致） ── */
  const isTitleSlot = slot.id === 'title';
  const isAchievementSlot = slot.id === 'achievement';
  if (!isLocked && !isEmpty && (isTitleSlot || isAchievementSlot)) {
    const cfg = content.config || {};
    const name = cfg.name || content.cardId;
    const rarity = cfg.rarity || content.rarity || 'common';
    const bonus = cfg.attributeBonus || {};
    const bonusLabels = { luck: '运', courage: '勇', combat: '武', command: '统', intelligence: '智', politics: '政', charm: '魅' };
    const bonusEntries = Object.entries(bonus).filter(([, v]) => v > 0);

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${baseBorderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR_MINI[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        {cfg.specialEffectDesc && (
          <div className="w-full">
            <span className="text-green-400 truncate block text-left" style={{ fontSize: fs2 }}>✨{cfg.specialEffectDesc}</span>
          </div>
        )}
        {bonusEntries.length > 0 ? (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonusEntries.slice(0, 3).map(([key, val]) => (
              <span key={key} className="text-amber-400" style={{ fontSize: fs2 }}>
                {bonusLabels[key] || key}+{(val / 10).toFixed(1)}
              </span>
            ))}
          </div>
        ) : (
          <div className="w-full text-left">
            <span className="text-stone-500" style={{ fontSize: fs2 }}>无属性加成</span>
          </div>
        )}
      </button>
    );
  }

  /* ── 已装备宝物卡摘要（复用装备卡布局 + 次数） ── */
  const isTreasureSlot = slot.id === 'treasure';
  if (!isLocked && !isEmpty && isTreasureSlot) {
    const cfg = content.config || {};
    const name = cfg.name || content.cardId;
    const rarity = cfg.rarity || content.rarity || 'common';
    const bonus = (cfg.bonus && cfg.bonus.length)
      ? Object.fromEntries(cfg.bonus.map((b) => [b.key, Number(b.value) * 10]))
      : {};
    const bonusLabels = { luck: '运', courage: '勇', combat: '武', command: '统', intelligence: '智', politics: '政', charm: '魅' };
    const bonusEntries = Object.entries(bonus).filter(([, v]) => v > 0);
    const usesRemaining = content.usesRemaining ?? content.uses_remaining;
    const usesLabel = usesRemaining == null ? '永久' : `🚩${usesRemaining}`;

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${baseBorderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR_MINI[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        <div className="w-full">
          <span className={usesRemaining === 1 ? 'text-red-400' : 'text-cyan-400'} style={{ fontSize: fs2 }}>{usesLabel}</span>
        </div>
        {cfg.specialEffectDesc && (
          <div className="w-full">
            <span className="text-green-400 truncate block text-left" style={{ fontSize: fs2 }}>✨{cfg.specialEffectDesc}</span>
          </div>
        )}
        {bonusEntries.length > 0 ? (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonusEntries.slice(0, 2).map(([key, val]) => (
              <span key={key} className="text-amber-400" style={{ fontSize: fs2 }}>
                {bonusLabels[key] || key}+{(val / 10).toFixed(1)}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    );
  }

  /* ── 已装备官职摘要 ── */
  const isPositionSlot = slot.id === 'position';
  if (!isLocked && !isEmpty && isPositionSlot) {
    const rarity = content.rarity || 'common';
    const bonuses = content.positionBonuses || {};

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${baseBorderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{content.name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR_MINI[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        {(formatStipendReputationCompact(bonuses.reputationBonus) ||
          formatStipendContributionCompact(bonuses.contributionBonus) ||
          formatStipendResourceCompact(bonuses.resourceBonus)) && (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {formatStipendReputationCompact(bonuses.reputationBonus) && (
              <span className="text-purple-400" style={{ fontSize: fs2 }}>
                {formatStipendReputationCompact(bonuses.reputationBonus)}
              </span>
            )}
            {formatStipendContributionCompact(bonuses.contributionBonus) && (
              <span className="text-cyan-400" style={{ fontSize: fs2 }}>
                {formatStipendContributionCompact(bonuses.contributionBonus)}
              </span>
            )}
            {formatStipendResourceCompact(bonuses.resourceBonus) && (
              <span className="text-yellow-400" style={{ fontSize: fs2 }}>
                {formatStipendResourceCompact(bonuses.resourceBonus)}
              </span>
            )}
          </div>
        )}
        {(bonuses.infantryBonus > 0 || bonuses.cavalryBonus > 0 || bonuses.archerBonus > 0) && (
          <div className="flex items-center gap-1 w-full flex-wrap">
            {bonuses.infantryBonus > 0 && <span className="text-red-400" style={{ fontSize: fs2 }}>步+{(bonuses.infantryBonus * 100).toFixed(0)}%</span>}
            {bonuses.cavalryBonus > 0 && <span className="text-green-400" style={{ fontSize: fs2 }}>骑+{(bonuses.cavalryBonus * 100).toFixed(0)}%</span>}
            {bonuses.archerBonus > 0 && <span className="text-blue-400" style={{ fontSize: fs2 }}>弓+{(bonuses.archerBonus * 100).toFixed(0)}%</span>}
          </div>
        )}
        {content.permissions && content.permissions.length > 0 && (
          <div className="w-full">
            <span className="text-stone-400 truncate block" style={{ fontSize: fs2 }}>特权：{content.permissions.join('、')}</span>
          </div>
        )}
      </button>
    );
  }

  /* ── 已装备装备卡摘要（6 项属性两列展示） ── */
  const isEquipmentSetSlot = slot.id === 'equipmentSet';
  if (!isLocked && !isEmpty && isEquipmentSetSlot) {
    const cfg = content.config || {};
    const name = cfg.displayName || content.cardId || '装备卡';
    const rarity = cfg.rarity || content.rarity || 'common';
    const bonus = cfg.attributeBonus || {};
    const ordered = [
      { label: '勇', val: Number(bonus.courage || 0) / 10 },
      { label: '智', val: Number(bonus.intelligence || 0) / 10 },
      { label: '武', val: Number(bonus.combat || 0) / 10 },
      { label: '政', val: Number(bonus.politics || 0) / 10 },
      { label: '统', val: Number(bonus.command || 0) / 10 },
      { label: '魅', val: Number(bonus.charm || 0) / 10 },
    ];

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border-2 ${baseBorderClass} bg-stone-800/90
                    overflow-hidden transition-all duration-200 relative text-left
                    cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}
      >
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR_MINI[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        {ordered.length > 0 ? (
          <>
            <div className="flex items-center justify-between w-full">
              <span className="text-red-400" style={{ fontSize: fs2 }}>{ordered[0].label}{ordered[0].val >= 0 ? '+' : ''}{ordered[0].val.toFixed(1)}</span>
              <span className="text-blue-400" style={{ fontSize: fs2 }}>{ordered[1].label}{ordered[1].val >= 0 ? '+' : ''}{ordered[1].val.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-cyan-400" style={{ fontSize: fs2 }}>{ordered[2].label}{ordered[2].val >= 0 ? '+' : ''}{ordered[2].val.toFixed(1)}</span>
              <span className="text-amber-400" style={{ fontSize: fs2 }}>{ordered[3].label}{ordered[3].val >= 0 ? '+' : ''}{ordered[3].val.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-green-400" style={{ fontSize: fs2 }}>{ordered[4].label}{ordered[4].val >= 0 ? '+' : ''}{ordered[4].val.toFixed(1)}</span>
              <span className="text-purple-400" style={{ fontSize: fs2 }}>{ordered[5].label}{ordered[5].val >= 0 ? '+' : ''}{ordered[5].val.toFixed(1)}</span>
            </div>
          </>
        ) : (
          <div className="w-full text-left">
            <span className="text-stone-500" style={{ fontSize: fs2 }}>无属性加成</span>
          </div>
        )}
      </button>
    );
  }

  /* ── 通用兜底：未实装 / 空 / 官职图标 ── */
  const renderPositionContent = (data) => (
    <>
      <span className="text-lg">👑</span>
      <span className="text-[9px] text-amber-400 mt-0.5 truncate w-full text-center">{data.name}</span>
    </>
  );

  const renderContent = () => {
    if (isLocked) {
      return (
        <>
          <span className="text-lg opacity-30">🔒</span>
          <span className="text-[8px] text-stone-600 mt-0.5">尚未实装</span>
        </>
      );
    }
    if (isEmpty) {
      return (
        <>
          <span className="text-lg opacity-40">{slot.icon}</span>
          <span className="text-[8px] text-stone-500 mt-0.5">空</span>
        </>
      );
    }
    if (slot.id === 'position') return renderPositionContent(content);
    return <span className="text-lg">{slot.icon}</span>;
  };

  const fallbackBorderClass = isSelected
    ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    : isLocked
      ? 'border-stone-700'
      : isEmpty
        ? 'border-dashed border-stone-600 hover:border-stone-400'
        : 'border-stone-500 hover:border-amber-500';

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`rounded-lg border-2 ${fallbackBorderClass}
                  bg-stone-800/80 flex flex-col items-center justify-center
                  transition-all duration-200 relative
                  ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
      style={{ width: `${slotW}px`, height: `${slotH}px` }}
    >
      {renderContent()}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0
                      bg-stone-900 rounded text-[7px] text-stone-500 whitespace-nowrap">
        {slot.label}
      </div>
    </button>
  );
}
