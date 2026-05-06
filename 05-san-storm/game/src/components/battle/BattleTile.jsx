/**
 * BattleTile - 单个地图格子
 * 渲染：底色 → 地形叠加 → 对象层 → 角标 → 部队层
 */
import { memo, useRef, useCallback } from 'react';
import { getBg, getTerrain, getObj, buildTacticalTileTooltipInfo, tacticalFireFrameUrl } from './battleConstants';
import TroopLayer from './TroopLayer';

function BattleTile({
  terrain, variants, obj, cellOnFire = false, troop, showTroops, deployHighlight,
  /** 事件战战前：与战役一致，当前选中的我军部署单位 */
  preBattleDeploySelected = false,
  /** @type {'active'|'move'|'skillPreview'|'atk'|'heal'|null} */
  manualHl = null,
  manualMoveCost = null,
  onHover, onLeave, onClick,
}) {
  const isChest = obj && obj.type === 'chest';
  const terrainSrc = getTerrain(terrain, variants);
  const tileTip = buildTacticalTileTooltipInfo({ terrain, obj, cellOnFire });
  const info = tileTip;

  // 长按触摸显示详情
  const touchTimer = useRef(null);
  const tileRef = useRef(null);
  const handleTouchStart = useCallback((e) => {
    touchTimer.current = setTimeout(() => {
      // 构造一个类似 mouse event 的对象，带 currentTarget 和坐标
      const touch = e.touches[0];
      const fakeEvent = { currentTarget: tileRef.current, clientX: touch.clientX, clientY: touch.clientY };
      onHover?.(fakeEvent);
    }, 400);
  }, [onHover]);
  const handleTouchEnd = useCallback(() => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    onLeave?.();
  }, [onLeave]);

  return (
    <div
      ref={tileRef}
      className={'tile' + (preBattleDeploySelected ? ' tile-prebattle-deploy-selected' : '')}
      data-troop={troop ? troop.id : undefined}
      onMouseEnter={e => onHover?.(e)}
      onMouseLeave={onLeave}
      onClick={e => onClick?.(e)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <img className="tile-bg" src={getBg(terrain, variants, isChest)} alt="" />
      {terrainSrc && <img className="tile-bg" src={terrainSrc} alt="" />}
      {obj && <img className="tile-bg" src={getObj(obj.type, obj.isOpen)} alt="" />}
      {cellOnFire && (
        <div className="tile-fire-fx" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <img
              key={i}
              className="tile-fire-frame"
              src={tacticalFireFrameUrl(i + 1)}
              alt=""
              style={{ animationDelay: `${-(i * 1.2) / 12}s` }}
            />
          ))}
        </div>
      )}
      {info && <span className="tile-badge">{info.badge}</span>}
      {deployHighlight && <div className="tile-deploy-zone-hl" aria-hidden />}
      {preBattleDeploySelected && <div className="tile-prebattle-deploy-ring" aria-hidden />}
      {manualHl === 'active' && <div className="manual-hl active-troop" aria-hidden />}
      {manualHl === 'move' && (
        <div className="manual-hl move-range" aria-hidden>
          {manualMoveCost != null && manualMoveCost > 1 && (
            <span className="move-cost-label">{manualMoveCost}</span>
          )}
        </div>
      )}
      {manualHl === 'atk' && <div className="manual-hl atk-target" aria-hidden />}
      {manualHl === 'heal' && <div className="manual-hl heal-target" aria-hidden />}
      {manualHl === 'skillPreview' && <div className="manual-hl skill-preview" aria-hidden />}
      {showTroops && troop && troop.currentTroops > 0 && <TroopLayer troop={troop} />}
    </div>
  );
}

export default memo(BattleTile);
