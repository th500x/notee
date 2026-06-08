/**
 * 装备槽位组件 — 与 LineupTab 的 EquipSlot 视觉风格一致
 *
 * 根据槽位类型和是否已装备渲染不同内容：
 * - 已装备部队卡：紧凑数据摘要
 * - 已装备称号卡：名称+加成
 * - 已装备装备卡（封装集）：属性展示
 * - 空槽位 / 锁定槽位：图标占位
 */

const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
const RARITY_COLOR = { common: 'text-gray-300', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-orange-400', core: 'text-yellow-400' };

export default function GarrisonEquipSlot({ slot, content, isSelected, onClick, baseUrl, skillsMap, mini = false }) {
  const isEmpty  = !content;
  const isLocked = !slot.implemented;
  const slotW = mini ? 96 : 64;
  const slotH = mini ? 96 : 64;
  const fs1  = mini ? '9px' : '6px';
  const fs2  = mini ? '9px' : '6px';
  const fsR  = mini ? '8px' : '5.5px';

  const selectedBorder  = 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]';
  const defaultBorder   = 'border-stone-500 hover:border-amber-500';
  const borderClass     = isSelected ? selectedBorder : defaultBorder;

  /* ── 已装备部队卡 ── */
  const isTroopSlot = slot.id === 'troop1' || slot.id === 'troop2';
  if (!isLocked && !isEmpty && isTroopSlot) {
    const cfg         = content.config || {};
    const name        = cfg.name || content.cardId;
    const rarity      = cfg.rarity || content.rarity || 'common';
    const maxBattle   = content.maxBattleCount ?? 10;
    const used        = Math.max(0, Math.min(content.battleCount ?? 0, maxBattle));
    const remaining   = Math.max(0, maxBattle - used);
    const troops      = `${content.currentTroops ?? cfg.maxTroops ?? '?'}`;
    const maxTroops   = (cfg.maxTroops || 0) + (content.bonusMaxTroops || 0);
    const atk         = ((cfg.attack || 0) + (content.bonus_attack || 0) / 10).toFixed(0);
    const def         = ((cfg.defense || 0) + (content.bonus_defense || 0) / 10).toFixed(0);
    const spd         = (cfg.speed ?? 0) + (content.bonus_speed || 0);
    const mov         = (cfg.movement ?? 0) + (content.bonus_movement || 0);
    const range       = cfg.range ?? 1;
    const isLastUse   = remaining === 1;
    const rangeBlocks = Array.from({ length: range }, (_, i) => (
      <span key={i} className="inline-block rounded-[1px]"
        style={{ width: mini ? '3px' : '2px', height: mini ? '3px' : '2px', background: '#f87171' }} />
    ));
    return (
      <button onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} ${isLastUse ? 'bg-red-900/30' : 'bg-stone-800/90'}
          overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}>
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold ${RARITY_COLOR[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className={isLastUse ? 'text-red-400' : 'text-stone-400'} style={{ fontSize: fs2 }}>🚩{remaining}/{maxBattle}</span>
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

  /* ── 已装备称号 / 成就卡 ── */
  if (!isLocked && !isEmpty && (slot.id === 'title' || slot.id === 'achievement')) {
    const cfg          = content.config || {};
    const name         = cfg.name || content.cardId;
    const rarity       = cfg.rarity || content.rarity || 'common';
    const bonus        = cfg.attributeBonus || {};
    const bonusLabels  = { luck: '运', courage: '勇', combat: '武', command: '统', intelligence: '智', politics: '政', charm: '魅' };
    const bonusEntries = Object.entries(bonus).filter(([, v]) => v > 0);
    return (
      <button onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
          overflow-hidden transition-all duration-200 text-left cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}>
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
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

  /* ── 已装备装备卡（封装集） ── */
  if (!isLocked && !isEmpty && slot.id === 'equipmentSet') {
    const cfg   = content.config || {};
    const name  = cfg.displayName || content.cardId || '装备卡';
    const rarity = cfg.rarity || content.rarity || 'common';
    const bonus = cfg.attributeBonus || {};
    const order = [
      ['courage', '勇'], ['intelligence', '智'], ['combat', '武'],
      ['politics', '政'], ['command', '统'], ['charm', '魅'],
    ];
    const rows = order.map(([k, label]) => ({ label, val: Number(bonus[k] || 0) / 10 }));
    return (
      <button onClick={onClick}
        className={`rounded-lg border-2 ${borderClass} bg-stone-800/90
          overflow-hidden transition-all duration-200 text-left cursor-pointer active:scale-95 flex flex-col justify-between`}
        style={{ width: `${slotW}px`, height: `${slotH}px`, padding: mini ? '4px' : '2px 3px' }}>
        <div className="flex items-center justify-between w-full leading-none">
          <span className="text-white font-medium truncate" style={{ fontSize: fs1 }}>{name}</span>
          <span className={`font-bold flex-shrink-0 ${RARITY_COLOR[rarity]}`} style={{ fontSize: fsR }}>{RARITY_LABEL[rarity]}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-red-400"  style={{ fontSize: fs2 }}>{rows[0].label}{rows[0].val >= 0 ? '+' : ''}{rows[0].val.toFixed(1)}</span>
          <span className="text-blue-400" style={{ fontSize: fs2 }}>{rows[1].label}{rows[1].val >= 0 ? '+' : ''}{rows[1].val.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-cyan-400"  style={{ fontSize: fs2 }}>{rows[2].label}{rows[2].val >= 0 ? '+' : ''}{rows[2].val.toFixed(1)}</span>
          <span className="text-amber-400" style={{ fontSize: fs2 }}>{rows[3].label}{rows[3].val >= 0 ? '+' : ''}{rows[3].val.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="text-green-400"  style={{ fontSize: fs2 }}>{rows[4].label}{rows[4].val >= 0 ? '+' : ''}{rows[4].val.toFixed(1)}</span>
          <span className="text-purple-400" style={{ fontSize: fs2 }}>{rows[5].label}{rows[5].val >= 0 ? '+' : ''}{rows[5].val.toFixed(1)}</span>
        </div>
      </button>
    );
  }

  /* ── 锁定槽位 ── */
  if (isLocked) {
    return (
      <div className="rounded-lg border-2 border-stone-700/50 bg-stone-800/30
        flex items-center justify-center opacity-40"
        style={{ width: `${slotW}px`, height: `${slotH}px` }}>
        <div className="text-center">
          <span className="text-stone-600 text-xs">🔒</span>
          <div className="text-stone-600 text-[8px] mt-0.5">{slot.label}</div>
        </div>
      </div>
    );
  }

  /* ── 空槽位 ── */
  return (
    <button onClick={onClick}
      className={`rounded-lg border-2 border-dashed
        ${isSelected ? 'border-amber-400 bg-amber-900/20' : 'border-stone-600 bg-stone-800/50 hover:border-amber-500/50'}
        flex items-center justify-center transition-all cursor-pointer active:scale-95`}
      style={{ width: `${slotW}px`, height: `${slotH}px` }}>
      <div className="text-center">
        <span className="text-stone-500 text-sm">{slot.icon}</span>
        <div className="text-stone-600 text-[8px] mt-0.5">{slot.label}</div>
      </div>
    </button>
  );
}
