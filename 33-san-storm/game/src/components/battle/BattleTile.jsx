/**
 * BattleTile - 单个地图格子
 * 渲染：Wang 底色 → 桥/山丘/对象（部队之下）→ 角标 → 部队
 * 树林跨格由 BattleMap 格网叠层绘制，避免单格 overflow 裁切水平 2×1。
 */
import { memo, useRef, useCallback } from 'react';
import {
  getBg, getTerrain, getObj, buildTacticalTileTooltipInfo, tacticalFireFrameUrl, terrainOverlayUrl,
} from './battleConstants';
import TroopLayer from './TroopLayer';

function BattleTile({
  terrain, variants, obj, cellOnFire = false, troop, showTroops, deployHighlight,
  /** v2：本格 Wang 底瓦相对路径 */
  baseTileRel = null,
  /** v2：本格山丘叠章（可多枚 32×32） */
  hillOverlay = null,
  /** v2：本格桥梁（河宽每一格一张） */
  bridgeOverlay = null,
  /** 事件战战前：与大型图一致，当前选中的我军部署单位 */
  preBattleDeploySelected = false,
  /** @type {'active'|'move'|'skillPreview'|'atk'|'heal'|null} */
  manualHl = null,
  manualMoveCost = null,
  onHover, onLeave, onClick,
}) {
  const isChest = obj && obj.type === 'chest' && !obj.isOpen;
  const hideConsumedObj =
    obj &&
    (obj.type === 'chest' || obj.type === 'random' || obj.type === 'farm') &&
    !!obj.isOpen;
  const terrainSrc = getTerrain(terrain, variants);
  const tileTip = buildTacticalTileTooltipInfo({
    terrain,
    obj: hideConsumedObj ? null : obj,
    cellOnFire,
  });
  const info = tileTip;

  const touchTimer = useRef(null);
  const tileRef = useRef(null);
  const handleTouchStart = useCallback((e) => {
    touchTimer.current = setTimeout(() => {
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
      <img className="tile-bg" src={getBg(terrain, variants, isChest, baseTileRel)} alt="" />
      {terrainSrc && <img className="tile-bg" src={terrainSrc} alt="" />}
      {bridgeOverlay?.tileRel && (
        <img
          className="tile-bridge-stamp"
          src={terrainOverlayUrl(bridgeOverlay.tileRel)}
          alt=""
        />
      )}
      {hillOverlay?.stamps?.map((s, i) => (
        <img
          key={`hill-${i}`}
          className="tile-hill-stamp"
          src={terrainOverlayUrl(s.tileRel)}
          alt=""
          style={{ left: `${(s.ox ?? 0) * 100}%`, top: `${(s.oy ?? 0) * 100}%` }}
        />
      ))}
      {obj && !hideConsumedObj && (
        <img className="tile-bg tile-obj-stamp" src={getObj(obj.type, obj.isOpen, obj.tileRel)} alt="" />
      )}
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
