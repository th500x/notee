/**
 * BattleMap - 战术格网网格 + 行标签 + 区域色条（尺寸见 tacticalBattleGrid）
 */
import { memo, useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MAP_W, MAP_H, ZONE, buildTroopTooltipContent, buildTacticalTileTooltipInfo,
} from './battleConstants';
import { useTileTooltipClamp } from './useTileTooltipClamp';
import { MANUAL_PHASE } from '@/hooks/useManualBattle';
import { manualHighlightForTacticalCell } from '@/battle/manualHighlightModel';
import BattleTile from './BattleTile';
import AttackPreview from './AttackPreview';
import ChestRewardOverlay from './ChestRewardOverlay';
import TileTooltipContent from './TileTooltipContent';

function BattleMap({
  mapResult,
  mapLabel,
  battleTroops,
  showTroops,
  isBattle,
  /** 战役战前：底部我方部署行格内浅蓝提示（与左侧部署区行标同色带） */
  highlightPlayerDeployZone = false,
  /** 事件战战前：当前选中的我军 `battleTroops[].id`（瓦片描边） */
  preBattleDeployTroopId = null,
  mapCardRef,
  onTileClick,
  manualProps,
  autoBattle,
  onTakeover,
  roundNum = 0,
}) {
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(tooltipContent, tooltipPos);

  const { terrain, variants, objects, meta, cellFire } = mapResult;
  const objMap = {};
  for (const o of objects) objMap[`${o.y},${o.x}`] = o;
  const troopMap = {};
  if (showTroops) for (const t of battleTroops) if (t.currentTroops > 0) troopMap[`${t.y},${t.x}`] = t;

  const handleHover = useCallback((e, y, x) => {
    const tile = e.currentTarget;
    const troopId = tile.dataset.troop;

    if (troopId) {
      const troop = battleTroops.find(t => t.id === troopId);
      if (!troop) return;
      const manualPreviewBlocksEnemyTroopTip =
        !!manualProps &&
        !!(manualProps.attackPreview || manualProps.healPreview || manualProps.phase4ShapeOverlay);
      if (manualPreviewBlocksEnemyTroopTip && troop.faction === 'enemy') {
        setTooltipContent(null);
        return;
      }
      setTooltipContent(buildTroopTooltipContent(troop));
    } else {
      const ter = terrain[y]?.[x];
      const obj = objMap[`${y},${x}`];
      const onFire = !!cellFire?.[y]?.[x];
      const info = buildTacticalTileTooltipInfo({ terrain: ter, obj, cellOnFire: onFire });
      if (!info) return;
      setTooltipContent({ type: 'tile', info });
    }
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [battleTroops, terrain, objMap, cellFire, manualProps]);

  const handleMove = useCallback((e) => {
    if (tooltipContent) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  }, [tooltipContent]);

  const handleLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const skillArmSlotTouchTimerRef = useRef(null);
  const clearSkillArmSlotTouchTimer = useCallback(() => {
    if (skillArmSlotTouchTimerRef.current != null) {
      clearTimeout(skillArmSlotTouchTimerRef.current);
      skillArmSlotTouchTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearSkillArmSlotTouchTimer(), [clearSkillArmSlotTouchTimer]);

  const openArmedSkillTooltipAt = useCallback((clientX, clientY) => {
    const ui = manualProps?.phase3HealUi;
    if (!ui?.armedSkillSidebarVisible) return;
    const title = String(ui.armedSkillName || '').trim() || '主动技';
    const rawDesc = String(ui.armedSkillDescription || '').trim();
    const chDisp = String(ui.armedSkillChargesDisplay || '').trim();
    const attrs = [chDisp && `本场可用：${chDisp}`, rawDesc].filter(Boolean).join('\n\n') || '暂无说明';
    setTooltipContent({
      type: 'manualSkill',
      title,
      titleColor: '#fef3c7',
      attrs,
    });
    setTooltipPos({ x: clientX, y: clientY });
  }, [manualProps]);

  const handleSkillArmNameSlotMouseEnter = useCallback((e) => {
    openArmedSkillTooltipAt(e.clientX, e.clientY);
  }, [openArmedSkillTooltipAt]);

  const handleSkillArmNameSlotTouchStart = useCallback((e) => {
    clearSkillArmSlotTouchTimer();
    const touch = e.touches?.[0];
    if (!touch) return;
    skillArmSlotTouchTimerRef.current = window.setTimeout(() => {
      skillArmSlotTouchTimerRef.current = null;
      openArmedSkillTooltipAt(touch.clientX, touch.clientY);
    }, 400);
  }, [openArmedSkillTooltipAt, clearSkillArmSlotTouchTimer]);

  const handleSkillArmNameSlotTouchEnd = useCallback(() => {
    clearSkillArmSlotTouchTimer();
    handleLeave();
  }, [clearSkillArmSlotTouchTimer, handleLeave]);

  // ── 手动回合：左侧栏中部合并格内「技能 / 待机」（与中间战场区两行对齐） ──
  const manualSidebarActions = useMemo(() => {
    if (!manualProps) return null;
    const {
      phase, activeTroop, formationTroops, onStandby, onFormationStandby,
      toggleSkillTargeting, cyclePhase3HealSlot, phase3HealUi,
      skillPickerOpen, skillPickerItems, dismissSkillPicker, selectSkillArm,
      skillTargetingActive,
    } = manualProps;
    const isFormationMove = phase === MANUAL_PHASE.FORMATION_MOVE;
    const isFormationAction = phase === MANUAL_PHASE.FORMATION_ACTION;
    const isSingleMove = phase === MANUAL_PHASE.SELECT_MOVE;
    const isSingleAction = phase === MANUAL_PHASE.SELECT_ACTION;
    const isMove = isSingleMove || isFormationMove;
    const isAction = isSingleAction || isFormationAction;
    const isFormation = isFormationMove || isFormationAction;
    if (!isMove && !isAction) return null;

    if (isFormation && formationTroops?.length) {
      const alive = formationTroops.filter((t) => t.currentTroops > 0);
      if (!alive.length) return null;
    } else if (!activeTroop) {
      return null;
    }

    const handleStandby = isFormation ? onFormationStandby : onStandby;
    const hasSkillSlots =
      (isSingleMove || isSingleAction) &&
      (((activeTroop?.character?._skillPhase3Heal?.slots?.length ?? 0) > 0) ||
        ((activeTroop?.character?._skillPhase4Damage?.slots?.length ?? 0) > 0) ||
        ((activeTroop?.character?._skillPhase5Composite?.slots?.length ?? 0) > 0));
    const skillChargesReady =
      hasSkillSlots &&
      (((activeTroop?.character?._skillPhase3Heal?.slots || []).some(
        (s) => (activeTroop._phase3HealRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
      )) ||
        ((activeTroop?.character?._skillPhase4Damage?.slots || []).some(
          (s) => (activeTroop._phase4DamageRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
        )) ||
        ((activeTroop?.character?._skillPhase5Composite?.slots || []).some(
          (s) => (activeTroop._phase5CompositeRuntime?.chargesBySkillId?.[s.skillId] ?? 0) > 0,
        )));
    const skillBtnDisabled = !skillChargesReady;
    return {
      handleStandby,
      cyclePhase3HealSlot,
      phase3HealUi,
      healCharges: skillChargesReady,
      skillBtnDisabled,
      skillPickerOpen,
      skillPickerItems,
      dismissSkillPicker,
      selectSkillArm,
      skillTargetingActive,
      toggleSkillTargeting,
    };
  }, [manualProps]);

  /** 与 ZONE.deployC 中部两行对齐：y=4、5（0-based） */
  const MANUAL_ACTION_ROW_START = 4;

  // 行标签（战前下方部署带仍为 .zone-b +「我」，与格内浅蓝部署提示一致）
  const rowLabels = [];
  for (let y = 0; y < MAP_H; y++) {
    if (y === MANUAL_ACTION_ROW_START + 1 && manualSidebarActions) continue;
    if (
      y === MANUAL_ACTION_ROW_START - 1 &&
      manualSidebarActions &&
      manualSidebarActions.phase3HealUi?.armedSkillSidebarVisible
    ) {
      const ui = manualSidebarActions.phase3HealUi;
      const displayName = String(ui?.armedSkillName || '').trim() || '—';
      const chargesDisp = String(ui?.armedSkillChargesDisplay || '').trim();
      rowLabels.push(
        <div
          key="manual-skill-arm-caption"
          className="row-label row-label-zone-battle row-label-skill-arm-caption"
          onMouseEnter={handleSkillArmNameSlotMouseEnter}
          onMouseLeave={handleLeave}
          onTouchStart={handleSkillArmNameSlotTouchStart}
          onTouchEnd={handleSkillArmNameSlotTouchEnd}
          onTouchCancel={handleSkillArmNameSlotTouchEnd}
        >
          <div className="skill-arm-name">{displayName}</div>
          {chargesDisp ? <div className="skill-arm-charges">{chargesDisp}</div> : null}
        </div>,
      );
      continue;
    }
    if (y === MANUAL_ACTION_ROW_START && manualSidebarActions) {
      rowLabels.push(
        <div key="manual-actions" className="row-label row-label-zone-c row-label--manual-actions">
          <button
            type="button"
            className={`row-label-action-btn${manualSidebarActions.skillTargetingActive ? ' row-label-action-btn--skill-armed' : ''}`}
            disabled={manualSidebarActions.skillBtnDisabled}
            title={
              manualSidebarActions.skillBtnDisabled
                ? '本部队无可用主动技或次数已尽'
                : manualSidebarActions.skillTargetingActive
                  ? '当前为技能施放模式，再点一次切回普攻'
                  : manualProps?.phase === MANUAL_PHASE.SELECT_MOVE
                    ? '进入技能施放预览（再点一次关闭；未走光移动力前仍可走蓝格）'
                    : '点击进入技能施放模式（再点一次关闭）'
            }
            onClick={(e) => {
              e.stopPropagation();
              manualSidebarActions.toggleSkillTargeting?.();
            }}
          >
            技能
          </button>
          <button type="button" className="row-label-action-btn" onClick={manualSidebarActions.handleStandby}>
            待机
          </button>
        </div>,
      );
      continue;
    }
    const isA = ZONE.deployA.includes(y);
    const isB = ZONE.deployB.includes(y);
    let cls;
    let text;
    if (isBattle) {
      cls = 'zone-battle';
      text = '⚔';
    } else if (isA) {
      cls = 'zone-a';
      text = '敌';
    } else if (isB) {
      cls = 'zone-b';
      text = '我';
    } else {
      cls = 'zone-c';
      text = '⚔';
    }
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
          {roundNum > 0 && <span className="round-badge">第{roundNum}回合</span>}
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
                const cellOnFire = !!cellFire?.[y]?.[x];
                const mh = manualProps?.manualHighlightModel
                  ? manualHighlightForTacticalCell(y, x, manualProps.manualHighlightModel)
                  : { kind: null };
                let manualHl = null;
                let manualMoveCost = null;
                if (mh.kind === 'active') manualHl = 'active';
                else if (mh.kind === 'move') {
                  manualHl = 'move';
                  manualMoveCost = mh.cost ?? null;
                } else if (mh.kind === 'heal') manualHl = 'heal';
                else if (mh.kind === 'atk') manualHl = 'atk';
                const tileTroop =
                  showTroops
                    ? troopMap[key]
                    : battleTroops.find((t) => t.currentTroops > 0 && t.y === y && t.x === x);
                const preBattleSel =
                  !!preBattleDeployTroopId &&
                  tileTroop?.faction === 'player' &&
                  tileTroop?.id === preBattleDeployTroopId;
                return (
                  <BattleTile
                    key={key}
                    terrain={terrain[y][x]}
                    variants={variants}
                    obj={objMap[key]}
                    cellOnFire={cellOnFire}
                    troop={troopMap[key]}
                    showTroops={showTroops}
                    deployHighlight={highlightPlayerDeployZone && ZONE.deployB.includes(y)}
                    preBattleDeploySelected={preBattleSel}
                    manualHl={manualHl}
                    manualMoveCost={manualMoveCost}
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
          {/* 攻击 / 治疗预览浮层 */}
          {(manualProps?.attackPreview || manualProps?.healPreview || manualProps?.phase4ShapeOverlay) && (
            <AttackPreview
              attackPreview={manualProps.attackPreview}
              healPreview={manualProps.healPreview}
              phase4ShapeOverlay={manualProps.phase4ShapeOverlay}
            />
          )}
          <div className="map-zone-bar">
            <div className={`zone-bar-seg ${bA}`} />
            <div className="zone-bar-seg seg-c" />
            <div className={`zone-bar-seg ${bB}`} />
          </div>
        </div>
      </div>

      {manualProps?.skillPickerOpen && manualProps?.skillPickerItems?.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          role="presentation"
          className="manual-skill-picker-backdrop"
          onClick={manualProps.dismissSkillPicker}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15, 23, 42, 0.35)',
          }}
        >
          <div
            role="dialog"
            aria-label="选择主动技"
            className="manual-skill-picker-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: 12,
              top: '18%',
              minWidth: 220,
              maxWidth: 'min(92vw, 320px)',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(148, 163, 184, 0.45)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
              color: '#e2e8f0',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>主动技</span>
              <button
                type="button"
                onClick={manualProps.dismissSkillPicker}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            {manualProps.phase3HealUi?.canCycle && (
              <button
                type="button"
                onClick={() => manualProps.cyclePhase3HealSlot?.()}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid rgba(251, 191, 36, 0.35)',
                  background: 'rgba(30, 41, 59, 0.9)',
                  color: '#fbbf24',
                  cursor: 'pointer',
                }}
              >
                快速轮换当前武装
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {manualProps.skillPickerItems.map((it) => (
                <button
                  key={it.armIndex}
                  type="button"
                  disabled={it.disabled}
                  onClick={() => manualProps.selectSkillArm?.(it.armIndex)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(71, 85, 105, 0.6)',
                    background: it.disabled ? 'rgba(30, 41, 59, 0.5)' : 'rgba(51, 65, 85, 0.55)',
                    color: it.disabled ? '#64748b' : '#f1f5f9',
                    cursor: it.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                  }}
                >
                  {it.label}
                  <span style={{ float: 'right', opacity: 0.85 }}>×{it.charges}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Tooltip：挂到 body，避免战斗壳层 overflow/transform 裁切 */}
      {tooltipContent && typeof document !== 'undefined' && createPortal(
        <div
          className="tile-tooltip tile-tooltip--portal"
          ref={tooltipRef}
          style={tooltipStyle}
        >
          <TileTooltipContent content={tooltipContent} />
        </div>,
        document.body,
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
