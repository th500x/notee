/**
 * TroopLayer - 部队渲染层
 * 兵力方格（top最多6个+right溢出）、阵营光韵、部队图标、字号标签
 */
import { memo } from 'react';

function TroopLayer({ troop }) {
  const fc = troop.faction === 'player' ? 'player' : 'enemy';
  const totalBlocks = Math.ceil(troop.maxTroops / 100);
  const fullBlocks = Math.floor(troop.currentTroops / 100);
  const remainder = troop.currentTroops % 100;
  const hasHalf = remainder >= 50;

  const allBlks = [];
  for (let b = 0; b < totalBlocks; b++) {
    if (b < fullBlocks) allBlks.push(<div key={b} className={`troop-hp-block full-${fc}`} />);
    else if (b === fullBlocks && hasHalf) allBlks.push(<div key={b} className={`troop-hp-block half-${fc}`} />);
  }

  const topBlks = allBlks.slice(0, 6);
  const rightBlks = allBlks.slice(6);

  return (
    <div className="troop-layer">
      <div className="troop-hp-top">{topBlks}</div>
      {rightBlks.length > 0 && <div className="troop-hp-right">{rightBlks}</div>}
      <div className={`troop-glow ${troop.faction}`} />
      <img
        className="troop-img"
        src={troop.imgSrc}
        alt={troop.name}
        onError={e => { e.target.style.display = 'none'; }}
      />
      <div className="troop-name">
        <span className="cn">{troop.displayName || troop.name}</span>
        <span className="mr" style={{ color: troop.morale >= 80 ? '#FFD700' : troop.morale >= 50 ? '#4CAF50' : troop.morale >= 20 ? '#FFC107' : '#F44336' }}>{troop.morale}/100</span>
      </div>
    </div>
  );
}

export default memo(TroopLayer);
