/**
 * AttackPreview - 手动回合：普攻预估浮层 + 主动技预览锚点（治疗 / 形状 / 随机）
 *
 * 伤害类主动技（形状锚点、随机索敌）与普通攻击共用 `ManualAttackPreviewPanel`，且与普攻相同
 * 挂在 `map-wrapper` 内锚点格上方（`translateY(-100%)`），避免 body portal 被 `useTileTooltipClamp` 居中后遮挡单位。
 * 治疗预览仍走 body portal + `TileTooltipContent`（`attackPreviewPortal` 类型不参与整屏居中）。
 */
import { memo, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { buildManualActiveSkillPreviewTooltipContent, buildSkillDamagePreviewMetaLines } from './battleConstants';
import { useTileTooltipClamp } from './useTileTooltipClamp';
import TileTooltipContent from './TileTooltipContent';
import { ManualAttackPreviewPanel } from './ManualAttackPreviewPanel';

function anchorPositionForCell(target, largeMapGridOverlay) {
  if (!target) return null;
  return largeMapGridOverlay
    ? {
        top: `calc(${target.y} * (var(--lm-tile, var(--tile)) + 1px))`,
        left: `calc(${target.x} * (var(--lm-tile, var(--tile)) + 1px))`,
      }
    : {
        top: `calc(${target.y} * (var(--tile) + 1px))`,
        left: `calc(var(--label-w) + 4px + ${target.x} * (var(--tile) + 1px))`,
      };
}

function AttackPreview({
  attackPreview = null,
  healPreview = null,
  phase4ShapeOverlay = null,
  largeMapGridOverlay = false,
}) {
  const healAnchorRef = useRef(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  const healPortalContent = useMemo(() => {
    if (attackPreview && !attackPreview.phase4Random) {
      return null;
    }
    if (!healPreview) return null;
    return buildManualActiveSkillPreviewTooltipContent({
      kind: 'heal',
      slot: healPreview.slot,
      selfGain: healPreview.selfGain,
      allyGain: healPreview.allyGain,
      casterTroop: healPreview.casterTroop,
      phase5HealDamage: healPreview.phase5HealDamage,
    });
  }, [healPreview, attackPreview]);

  const damageInlinePayload = useMemo(() => {
    if (attackPreview && !attackPreview.phase4Random) return null;
    if (phase4ShapeOverlay?.anchorEstimate && phase4ShapeOverlay.slot) {
      const dk = String(phase4ShapeOverlay.slot.damageType || 'physical').toLowerCase() === 'strategy'
        ? 'strategy'
        : 'physical';
      return {
        tone: dk,
        estimate: phase4ShapeOverlay.anchorEstimate.estimate,
        counterEstimate: phase4ShapeOverlay.anchorEstimate.counterEstimate,
        metaLines: phase4ShapeOverlay.skillMetaLines || [],
        footer: '再次点击锚点格确认施放',
      };
    }
    if (attackPreview?.phase4Random) {
      const slot = attackPreview.phase4Random.slot;
      const dk = String(slot?.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
      return {
        tone: dk,
        estimate: attackPreview.estimate,
        counterEstimate: attackPreview.counterEstimate ?? null,
        metaLines: buildSkillDamagePreviewMetaLines(slot),
        footer: '再次点击确认（目标随机抽取）',
      };
    }
    return null;
  }, [phase4ShapeOverlay, attackPreview]);

  const damageAnchorTarget =
    phase4ShapeOverlay?.anchor || (attackPreview?.phase4Random ? attackPreview.target : null);

  const healClampMarker = healPortalContent ? { type: 'attackPreviewPortal' } : null;

  useLayoutEffect(() => {
    if (!healClampMarker || !healAnchorRef.current) return;
    const r = healAnchorRef.current.getBoundingClientRect();
    setTipPos({ x: r.left + r.width / 2, y: r.top });
  }, [healClampMarker, healPreview, largeMapGridOverlay]);

  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(healClampMarker, tipPos);

  const healAnchorTarget = healPreview?.target;
  const healAnchorStyle =
    healPortalContent && healAnchorTarget
      ? {
          position: 'absolute',
          ...anchorPositionForCell(healAnchorTarget, largeMapGridOverlay),
          width: largeMapGridOverlay ? 'var(--lm-tile, var(--tile))' : 'var(--tile)',
          height: largeMapGridOverlay ? 'var(--lm-tile, var(--tile))' : 'var(--tile)',
          zIndex: 55,
          pointerEvents: 'none',
        }
      : null;

  const healPortalEl =
    healPortalContent && healAnchorStyle && typeof document !== 'undefined'
      ? createPortal(
          <div className="tile-tooltip tile-tooltip--portal" ref={tooltipRef} style={tooltipStyle}>
            <TileTooltipContent content={healPortalContent} />
          </div>,
          document.body,
        )
      : null;

  const damagePos =
    damageInlinePayload && damageAnchorTarget
      ? {
          position: 'absolute',
          ...anchorPositionForCell(damageAnchorTarget, largeMapGridOverlay),
          width: largeMapGridOverlay ? 'var(--lm-tile, var(--tile))' : 'var(--tile)',
          zIndex: 56,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }
      : null;

  const damageInlineEl =
    damageInlinePayload && damagePos ? (
      <div className="atk-preview-overlay" style={damagePos}>
        <div style={{ transform: 'translateY(-100%)' }}>
          <ManualAttackPreviewPanel
            tone={damageInlinePayload.tone === 'strategy' ? 'strategy' : 'physical'}
            estimate={damageInlinePayload.estimate}
            counterEstimate={damageInlinePayload.counterEstimate}
            metaLines={damageInlinePayload.metaLines}
            footer={damageInlinePayload.footer}
          />
        </div>
      </div>
    ) : null;

  if (healPortalContent && healAnchorStyle) {
    return (
      <>
        <div ref={healAnchorRef} className="atk-preview-overlay" style={healAnchorStyle} />
        {healPortalEl}
        {damageInlineEl}
      </>
    );
  }

  if (damageInlineEl) {
    return <>{damageInlineEl}</>;
  }

  if (!attackPreview || attackPreview.phase4Random) return null;
  const { target } = attackPreview;

  const pos = largeMapGridOverlay
    ? {
        top: `calc(${target.y} * (var(--lm-tile, var(--tile)) + 1px))`,
        left: `calc(${target.x} * (var(--lm-tile, var(--tile)) + 1px))`,
      }
    : {
        top: `calc(${target.y} * (var(--tile) + 1px))`,
        left: `calc(var(--label-w) + 4px + ${target.x} * (var(--tile) + 1px))`,
      };

  const { estimate, counterEstimate } = attackPreview;

  return (
    <div
      className="atk-preview-overlay"
      style={{
        position: 'absolute',
        ...pos,
        width: largeMapGridOverlay ? 'var(--lm-tile, var(--tile))' : 'var(--tile)',
        zIndex: 55,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ transform: 'translateY(-100%)' }}>
        <ManualAttackPreviewPanel
          tone="physical"
          estimate={estimate}
          counterEstimate={counterEstimate}
          footer="再次点击确认攻击"
        />
      </div>
    </div>
  );
}

export default memo(AttackPreview);
