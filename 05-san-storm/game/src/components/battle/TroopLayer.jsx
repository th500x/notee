/**
 * TroopLayer - 部队渲染层
 * 兵力方格（top最多6个+right溢出）、阵营光韵、部队图标、字号标签
 */
import { memo, useMemo, useState, useEffect } from 'react';
import { getTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';

const PORTRAIT_BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null ? import.meta.env.BASE_URL : '';

function TroopLayer({ troop }) {
  const urls = useMemo(
    () =>
      troop.imgPortraitAttempts?.length > 0
        ? troop.imgPortraitAttempts
        : getTroopPortraitUrlAttempts(troop, PORTRAIT_BASE),
    [troop]
  );
  /** 当前尝试的立绘下标；等于 urls.length 表示已全部失败 */
  const [uIdx, setUIdx] = useState(0);
  useEffect(() => {
    setUIdx(0);
  }, [troop.id, urls]);
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
      {uIdx < urls.length ? (
        <img
          key={`${troop.id}-${uIdx}`}
          className="troop-img"
          src={urls[uIdx] || ''}
          alt={troop.name}
          onError={() => setUIdx((i) => Math.min(i + 1, urls.length))}
        />
      ) : (
        <div className="troop-img flex items-center justify-center text-2xl opacity-60" aria-hidden>
          {troop.troopType === 'cavalry' ? '🐎' : troop.troopType === 'archer' ? '🏹' : '🛡️'}
        </div>
      )}
      <div className="troop-name">
        <span className="cn">{troop.displayName || troop.name}</span>
        <span className="mr" style={{ color: troop.morale >= 80 ? '#FFD700' : troop.morale >= 50 ? '#4CAF50' : troop.morale >= 20 ? '#FFC107' : '#F44336' }}>{troop.morale}/100</span>
      </div>
    </div>
  );
}

export default memo(TroopLayer);
