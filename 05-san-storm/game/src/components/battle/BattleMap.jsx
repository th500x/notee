/**
 * BattleMap - 8×10 地图网格 + 行标签 + 区域色条
 */
import { memo, useCallback, useRef, useState, useMemo } from 'react';
import { MAP_W, MAP_H, ZONE, TILE_INFO, TYPE_LABEL, RARITY_LABEL, FACTION_COLOR } from './battleConstants';
import { MANUAL_PHASE } from '@/hooks/useManualBattle';
import BattleTile from './BattleTile';
import AttackPreview from './AttackPreview';
import ChestRewardOverlay from './ChestRewardOverlay';

function BattleMap({ mapResult, mapLabel, battleTroops, showTroops, isBattle, mapCardRef, onTileClick, manualProps, autoBattle, onTakeover }) {
  const tooltipRef = useRef(null);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { terrain, variants, objects, meta } = mapResult;
  const objMap = {};
  for (const o of objects) objMap[`${o.y},${o.x}`] = o;
  const troopMap = {};
  if (showTroops) for (const t of battleTroops) if (t.currentTroops > 0) troopMap[`${t.y},${t.x}`] = t;

  const handleHover = useCallback((e, y, x) => {
    const tile = e.currentTarget;
    const troopId = tile.dataset.troop;
    const infoKey = tile.dataset.info;

    if (troopId) {
      const troop = battleTroops.find(t => t.id === troopId);
      if (!troop) return;
      const fc = FACTION_COLOR[troop.faction] || '#ccc';
      const hpPct = Math.round(troop.currentTroops / troop.maxTroops * 100);
      const rarityName = RARITY_LABEL[troop.rarity] || troop.rarity;
      const typeName = TYPE_LABEL[troop.troopType] || troop.troopType;
      const charLine = troop.character ? `将领: ${troop.character.courtesyName || troop.character.name}` : null;
      const critDodge = troop.character ? {
        crit: ((troop.character.courage + troop.character.luck) / 80 * 100).toFixed(1),
        dodge: troop.character.luck.toFixed(1),
      } : null;
      setTooltipContent({ type: 'troop', troop, fc, hpPct, rarityName, typeName, charLine, critDodge, isEnemy: troop.faction === 'enemy' });
    } else if (infoKey) {
      const info = TILE_INFO[infoKey];
      if (!info) return;
      setTooltipContent({ type: 'tile', info, infoKey });
    } else {
      return;
    }
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [battleTroops]);

  const handleMove = useCallback((e) => {
    if (tooltipContent) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  }, [tooltipContent]);

  const handleLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  // ── 浮动操作按钮定位 ──
  const floatingAction = useMemo(() => {
    if (!manualProps) return null;
    const { phase, activeTroop, formationTroops, reachableTiles, onStandby, onFormationStandby } = manualProps;
    const isFormationMove = phase === MANUAL_PHASE.FORMATION_MOVE;
    const isFormationAction = phase === MANUAL_PHASE.FORMATION_ACTION;
    const isSingleMove = phase === MANUAL_PHASE.SELECT_MOVE;
    const isSingleAction = phase === MANUAL_PHASE.SELECT_ACTION;
    const isMove = isSingleMove || isFormationMove;
    const isAction = isSingleAction || isFormationAction;
    const isFormation = isFormationMove || isFormationAction;
    if (!isMove && !isAction) return null;

    let ty, tx;
    if (isFormation && formationTroops?.length) {
      const alive = formationTroops.filter(t => t.currentTroops > 0);
      if (!alive.length) return null;
      ty = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
      tx = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
    } else if (activeTroop) {
      ty = activeTroop.y;
      tx = activeTroop.x;
    } else {
      return null;
    }

    // 按钮位置：避开部队、可移动瓦片和特殊对象瓦片（宝箱/障碍/陷阱）
    // 优先级：空且无对象且不可移动(0) > 空但可移动(1) > 有对象瓦片(1.5) > 己(2) > 友(3) > 敌(4) > 越界(5)
    const troopAt = (r, c) => {
      if (r < 0 || r >= MAP_H || c < 0 || c >= MAP_W) return 'oob';
      const t = battleTroops.find(u => u.currentTroops > 0 && u.y === r && u.x === c);
      if (!t) return 'empty';
      if (isFormation && formationTroops?.some(f => f.id === t.id)) return 'self';
      if (!isFormation && activeTroop && t.id === activeTroop.id) return 'self';
      if (t.faction === 'player') return 'ally';
      return 'enemy';
    };
    const hasObject = (r, c) => !!objMap[`${r},${c}`];
    const isReachable = (r, c) => reachableTiles && reachableTiles.has(`${r},${c}`);
    const priority = { empty: 0, self: 2, ally: 3, enemy: 4, oob: 5 };
    const candidates = [
      { row: ty + 1, col: tx },  // 下
      { row: ty - 1, col: tx },  // 上
      { row: ty, col: tx - 1 },  // 左
      { row: ty, col: tx + 1 },  // 右
      { row: ty + 1, col: tx + 1 }, // 右下
      { row: ty + 1, col: tx - 1 }, // 左下
      { row: ty - 1, col: tx + 1 }, // 右上
      { row: ty - 1, col: tx - 1 }, // 左上
    ].map(p => {
      let score = priority[troopAt(p.row, p.col)];
      // 空格但有特殊对象瓦片（宝箱/障碍/陷阱）→ 惩罚，避免遮挡
      if (score === 0 && hasObject(p.row, p.col)) score = 1.5;
      // 空格但是可移动瓦片 → 惩罚，排在"空且不可移动"之后
      if (score === 0 && isReachable(p.row, p.col)) score = 1;
      return { ...p, score };
    }).sort((a, b) => a.score - b.score);
    const pos = candidates[0];
    const handleStandby = isFormation ? onFormationStandby : onStandby;
    return { row: pos.row, col: pos.col, handleStandby };
  }, [manualProps, battleTroops]);

  // 行标签
  const rowLabels = [];
  for (let y = 0; y < MAP_H; y++) {
    const isA = ZONE.deployA.includes(y), isB = ZONE.deployB.includes(y);
    let cls, text;
    if (isBattle) { cls = 'zone-battle'; text = '⚔'; }
    else if (isA) { cls = 'zone-a'; text = '敌'; }
    else if (isB) { cls = 'zone-b'; text = '我'; }
    else { cls = 'zone-c'; text = '⚔'; }
    rowLabels.push(<div key={y} className={`row-label ${cls}`}>{text}</div>);
  }

  // 区域色条
  const bA = isBattle ? 'seg-battle' : 'seg-a';
  const bB = isBattle ? 'seg-battle' : 'seg-b';

  return (
    <div className="maps-row">
      <div className="map-card" ref={mapCardRef}>
        <div className="map-title" style={{ position: 'relative' }}>
          {mapLabel}
          {/* 自动战斗中：右上角接管按钮 */}
          {autoBattle && isBattle && (
            <button
              onClick={onTakeover}
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#fbbf24',
                background: 'rgba(120, 53, 15, 0.7)',
                border: '1px solid rgba(251, 191, 36, 0.5)',
                borderRadius: '8px',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(120, 53, 15, 0.9)'; e.target.style.borderColor = 'rgba(251, 191, 36, 0.8)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(120, 53, 15, 0.7)'; e.target.style.borderColor = 'rgba(251, 191, 36, 0.5)'; }}
            >
              🖐 接管
            </button>
          )}
        </div>
        <div className="map-meta">
          主题: <span>{meta.bgTheme === 'grassland' ? '🌿 绿地' : '🏜️ 荒地'}</span> &nbsp;
          底色: <span>{variants.bgVariant}</span> &nbsp;
          树林: <span>forest_{variants.forest}</span> &nbsp;
          丘陵: <span>hill_{variants.hill}</span><br />
          种子: <span>{meta.seed}</span> &nbsp;
          非平原: <span>{(meta.combatNonPlainRatio * 100).toFixed(0)}%</span> &nbsp;
          障碍: <span>{meta.obstacleCount}</span> &nbsp;
          宝箱: <span>{meta.hasChest ? '✅' : '❌'}</span>
        </div>
        <div className="map-wrapper" onMouseMove={handleMove} style={{ position: 'relative' }}>
          <div className="map-row-labels">{rowLabels}</div>
          <div className="map-grid">
            {Array.from({ length: MAP_H }, (_, y) =>
              Array.from({ length: MAP_W }, (_, x) => {
                const key = `${y},${x}`;
                return (
                  <BattleTile
                    key={key}
                    terrain={terrain[y][x]}
                    variants={variants}
                    obj={objMap[key]}
                    troop={troopMap[key]}
                    showTroops={showTroops}
                    onHover={e => handleHover(e, y, x)}
                    onLeave={handleLeave}
                    onClick={e => {
                      if (onTileClick) onTileClick(y, x);
                      else handleHover(e, y, x);
                    }}
                  />
                );
              })
            )}
          </div>
          {/* 浮动操作按钮 */}
          {floatingAction && (
            <div
              className="floating-action-btns"
              style={{
                position: 'absolute',
                top: `calc(${floatingAction.row} * (var(--tile) + 1px))`,
                left: `calc(var(--label-w) + 4px + ${floatingAction.col} * (var(--tile) + 1px))`,
                width: 'var(--tile)',
                height: 'var(--tile)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                zIndex: 50,
                pointerEvents: 'auto',
              }}
            >
              <button className="floating-act" disabled title="技能系统尚未实装">
                🔮 技能
              </button>
              <button className="floating-act" onClick={floatingAction.handleStandby}>
                💤 待机
              </button>
            </div>
          )}
          {/* 攻击预览浮层 */}
          {manualProps?.attackPreview && (
            <AttackPreview preview={manualProps.attackPreview} />
          )}
          <div className="map-zone-bar">
            <div className={`zone-bar-seg ${bA}`} />
            <div className="zone-bar-seg seg-c" />
            <div className={`zone-bar-seg ${bB}`} />
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="tile-tooltip"
          ref={tooltipRef}
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            display: 'block',
            transform: tooltipContent.isEnemy ? 'translate(-50%, 10px)' : 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          {tooltipContent.type === 'troop' ? (
            <>
              <div className="tt-name" style={{ color: tooltipContent.fc }}>
                {tooltipContent.troop.faction === 'player' ? '🔵' : '🔴'} {tooltipContent.troop.name}
              </div>
              <div className="tt-attrs">
                {tooltipContent.charLine && <>{tooltipContent.charLine}<br /></>}
                {tooltipContent.critDodge && (
                  <>💥 暴击: {tooltipContent.critDodge.crit}%<br />🎲 闪避: {tooltipContent.critDodge.dodge}%<br /></>
                )}
                {tooltipContent.typeName} · {tooltipContent.rarityName}<br />
                攻击: {tooltipContent.troop.attack} &nbsp; 防御: {tooltipContent.troop.defense}<br />
                速度: {tooltipContent.troop.speed} &nbsp; 移动: {tooltipContent.troop.movement} &nbsp; 射程: {tooltipContent.troop.range}<br />
                兵力: {tooltipContent.troop.currentTroops} / {tooltipContent.troop.maxTroops} ({tooltipContent.hpPct}%)
              </div>
            </>
          ) : (
            <>
              <div className="tt-name">{tooltipContent.info.badge} {tooltipContent.info.name}</div>
              <div className="tt-attrs" style={{ whiteSpace: 'pre-line' }}>{tooltipContent.info.attrs}</div>
            </>
          )}
        </div>
      )}

      {/* 宝箱奖励浮层 */}
      {manualProps?.chestReward && (
        <ChestRewardOverlay
          reward={manualProps.chestReward}
          onConfirm={manualProps.confirmChestReward}
        />
      )}
    </div>
  );
}

export default memo(BattleMap);
