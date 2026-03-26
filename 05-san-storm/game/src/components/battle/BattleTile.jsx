/**
 * BattleTile - 单个地图格子
 * 渲染：底色 → 地形叠加 → 对象层 → 角标 → 部队层
 */
import { memo, useRef, useCallback } from 'react';
import { getBg, getTerrain, getObj, TILE_INFO } from './battleConstants';
import TroopLayer from './TroopLayer';

function BattleTile({ terrain, variants, obj, troop, showTroops, onHover, onLeave, onClick }) {
  const isChest = obj && obj.type === 'chest';
  const terrainSrc = getTerrain(terrain, variants);
  const infoKey = obj ? obj.type : (terrain !== 'plain' && terrain !== 'waste' ? terrain : null);
  const info = infoKey ? TILE_INFO[infoKey] : null;

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
      className="tile"
      data-troop={troop ? troop.id : undefined}
      data-info={!troop && infoKey ? infoKey : undefined}
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
      {info && <span className="tile-badge">{info.badge}</span>}
      {showTroops && troop && troop.currentTroops > 0 && <TroopLayer troop={troop} />}
    </div>
  );
}

export default memo(BattleTile);
