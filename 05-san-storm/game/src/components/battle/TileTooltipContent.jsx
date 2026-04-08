/**
 * TileTooltipContent - tile-tooltip 浮层内容渲染
 *
 * 供 BattleMap（小型地图）与 CampaignMapGrid（大型地图）共用。
 * 父组件负责定位（fixed + x/y）和显示隐藏；本组件只渲染内层 DOM。
 *
 * @param {{ type: 'troop'|'tile', troop?, fc?, hpPct?, rarityName?, typeName?,
 *            charLine?, critDodge?, info?, infoKey? }} content - buildTroopTooltipContent() 返回值或地形 tile 内容
 */
import { memo } from 'react';

const FACTION_ICON = { player: '🔵', ally: '🟢', enemy: '🔴' };

/** 展示用：无有效配置时显示 —，不用假数字 */
function displayTroopRange(troop) {
  const r = Number(troop?.range);
  if (Number.isFinite(r) && r > 0) return String(r);
  return '—';
}

function TileTooltipContent({ content }) {
  if (!content) return null;

  if (content.type === 'troop') {
    const { troop, fc, hpPct, rarityName, typeName, charLine, critDodge } = content;
    const icon = FACTION_ICON[troop.faction] ?? '🔴';
    const displayName = troop.displayName || troop.name;
    return (
      <>
        <div className="tt-name" style={{ color: fc }}>
          {icon} {displayName}
        </div>
        <div className="tt-attrs">
          {charLine && <>{charLine}<br /></>}
          {critDodge && (
            <>💥 暴击: {critDodge.crit}%<br />🎲 闪避: {critDodge.dodge}%<br /></>
          )}
          {typeName} · {rarityName}<br />
          攻击: {troop.attack} &nbsp; 防御: {troop.defense}<br />
          速度: {troop.speed} &nbsp; 移动: {troop.movement} &nbsp; 射程: {displayTroopRange(troop)}<br />
          兵力: {troop.currentTroops} / {troop.maxTroops} ({hpPct}%)
        </div>
      </>
    );
  }

  if (content.type === 'tile') {
    const { info } = content;
    return (
      <>
        <div className="tt-name">{info.badge} {info.name}</div>
        <div className="tt-attrs" style={{ whiteSpace: 'pre-line' }}>{info.attrs}</div>
      </>
    );
  }

  return null;
}

export default memo(TileTooltipContent);
