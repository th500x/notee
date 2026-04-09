/**
 * TroopLayer - 部队渲染层
 * 兵力方格（top最多6个+right溢出）、阵营光韵、部队图标、字号标签
 */
import { memo, useMemo, useState, useEffect } from 'react';
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { moraleInlineColorForTroopBar } from '@/components/battle/battleConstants';

const PORTRAIT_BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null ? import.meta.env.BASE_URL : '';

function TroopLayer({ troop }) {
  const urls = useMemo(
    () =>
      troop.imgPortraitAttempts?.length > 0
        ? troop.imgPortraitAttempts
        : getBattleFieldTroopPortraitUrlAttempts(troop, PORTRAIT_BASE),
    [troop]
  );
  /** 当前尝试的立绘下标；等于 urls.length 表示已全部失败 */
  const [uIdx, setUIdx] = useState(0);
  useEffect(() => {
    setUIdx(0);
  }, [troop.id, urls]);
  // ally 阵营用 campaignNpcForce（'ally1'/'ally2'）精确对齐部署时的颜色；无则回退 ally1
  const fc = troop.faction === 'player' ? 'player'
    : troop.faction === 'enemy' ? 'enemy'
    : (troop.campaignNpcForce ?? 'ally1');
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

  const isCommanderBoss = troop.commanderRole === 'boss';
  const isCommanderHero = troop.commanderRole === 'hero';
  /** 仅主公槽（lineupSlot === 'player'）与战役 boss/hero 同套 18K 金条；二三将用白字 + 士气阈值色 */
  const isPlayerLordBar = troop.faction === 'player' && troop.lineupSlot === 'player';
  const nameBarClass = [
    'troop-name',
    isCommanderBoss ? 'is-commander-boss' : '',
    isCommanderHero ? 'is-commander-hero' : '',
    isPlayerLordBar ? 'is-player-lord' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="troop-layer">
      <div className="troop-hp-top">{topBlks}</div>
      {rightBlks.length > 0 && <div className="troop-hp-right">{rightBlks}</div>}
      <div className={`troop-glow ${fc}`} />
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
      <div className={nameBarClass}>
        <span className="cn">{troop.displayName || troop.name}</span>
        <span
          className="mr"
          style={
            isCommanderBoss || isCommanderHero || isPlayerLordBar
              ? undefined
              : { color: moraleInlineColorForTroopBar(troop.morale) }
          }
        >
          {troop.morale}
        </span>
      </div>
    </div>
  );
}

export default memo(TroopLayer);
