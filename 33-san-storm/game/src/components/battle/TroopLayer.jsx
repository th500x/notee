/**
 * TroopLayer - 部队渲染层
 * 兵力血槽（顶栏，最多约 4 格占满瓦片宽）、阵营光韵、部队图标、字号标签
 * 有 battleUnitKey 时播侧视序列帧；否则回退势力静态立绘（与 DOM 战斗层同源）。
 */
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { getBattleFieldTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import {
  attachBattleUnitSprite,
  resolveBattleUnitKey,
} from '@/utils/battleUnitSpriteDom';
import { buildTroopHpBlockStates } from '@/utils/troopHpBlocks';
import { resolveTroopRarityStars } from '@/utils/troopRarityStars';

const PORTRAIT_BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null ? import.meta.env.BASE_URL : '';

function TroopLayer({ troop }) {
  const unitKey = resolveBattleUnitKey(troop);
  const imgRef = useRef(null);
  const urls = useMemo(
    () =>
      troop.imgPortraitAttempts?.length > 0
        ? troop.imgPortraitAttempts
        : getBattleFieldTroopPortraitUrlAttempts(troop, PORTRAIT_BASE),
    [troop]
  );
  /** 当前尝试的立绘下标；等于 urls.length 表示已全部失败（仅无序列帧时用） */
  const [uIdx, setUIdx] = useState(0);
  useEffect(() => {
    setUIdx(0);
  }, [troop.id, urls]);

  // 仅在单位身份变化时重绑；兵力刷新不重建序列帧控制器
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !unitKey) return undefined;
    let alive = true;
    let ctrl = null;
    attachBattleUnitSprite(img, { battleUnitKey: unitKey, displayName: troop.displayName, name: troop.name }, PORTRAIT_BASE).then((c) => {
      if (!alive) {
        c?.destroy();
        return;
      }
      ctrl = c;
    });
    return () => {
      alive = false;
      ctrl?.destroy();
      if (img._battleSpriteCtrl) {
        img._battleSpriteCtrl.destroy();
        img._battleSpriteCtrl = null;
      }
    };
  }, [troop.id, troop.displayName, troop.name, unitKey]);

  // ally 阵营用 npcForce（'ally1'/'ally2'）精确对齐部署时的颜色；无则回退 ally1
  const fc = troop.faction === 'player' ? 'player'
    : troop.faction === 'enemy' ? 'enemy'
    : (troop.npcForce ?? 'ally1');
  const hpStates = buildTroopHpBlockStates(troop.currentTroops, troop.maxTroops);
  const topBlks = hpStates.map((st, b) => {
    const cls =
      st === 'full' ? `troop-hp-block full-${fc}` : st === 'low' ? 'troop-hp-block low' : 'troop-hp-block empty';
    return <div key={b} className={cls} />;
  });

  const isCommanderBoss = troop.commanderRole === 'boss';
  const isCommanderHero = troop.commanderRole === 'hero';
  /** 仅主公槽（lineupSlot === 'player'）与关卡 boss/hero 同套 18K 金名；稀有度星用部队 rarity 色 */
  const isPlayerLordBar = troop.faction === 'player' && troop.lineupSlot === 'player';
  const nameBarClass = [
    'troop-name',
    isCommanderBoss ? 'is-commander-boss' : '',
    isCommanderHero ? 'is-commander-hero' : '',
    isPlayerLordBar ? 'is-player-lord' : '',
  ].filter(Boolean).join(' ');
  const rarityStars = resolveTroopRarityStars(troop.rarity);

  return (
    <div className="troop-layer">
      <div className="troop-hp-top">{topBlks}</div>
      <div className={`troop-glow ${fc}`} />
      {unitKey ? (
        <img ref={imgRef} className="troop-img" alt={troop.displayName || troop.name || unitKey} />
      ) : uIdx < urls.length ? (
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
        <span className={`troop-rarity-stars layout-${rarityStars.layout}`} style={{ color: rarityStars.color }}>
          {Array.from({ length: rarityStars.count }, (_, i) => (
            <i key={i} aria-hidden>
              ★
            </i>
          ))}
        </span>
      </div>
    </div>
  );
}

export default memo(TroopLayer);
