/**
 * AttackPreview - 攻击预览浮层
 *
 * 第一次点击敌人时显示预估伤害、暴击率、命中率。
 * 再次点击同一敌人确认攻击。
 */
import { memo } from 'react';

function AttackPreview({
  preview,
  /** 战役整图叠加层：目标坐标已为全局格，直接用 camp-tile 步进 */
  campaignGridOverlay = false,
}) {
  if (!preview) return null;
  const { target, estimate, counterEstimate } = preview;

  const pos = campaignGridOverlay
    ? {
        top: `calc(${target.y} * (var(--camp-tile, var(--tile)) + 1px))`,
        left: `calc(${target.x} * (var(--camp-tile, var(--tile)) + 1px))`,
      }
    : {
        top: `calc(${target.y} * (var(--tile) + 1px))`,
        left: `calc(var(--label-w) + 4px + ${target.x} * (var(--tile) + 1px))`,
      };

  return (
    <div
      className="atk-preview-overlay"
      style={{
        position: 'absolute',
        ...pos,
        width: campaignGridOverlay ? 'var(--camp-tile, var(--tile))' : 'var(--tile)',
        zIndex: 55,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* 浮层在瓦片上方 */}
      <div
        style={{
          transform: 'translateY(-100%)',
          background: 'rgba(0,0,0,0.88)',
          border: '1px solid rgba(255,100,80,0.6)',
          borderRadius: 6,
          padding: '5px 8px',
          color: '#fff',
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(255,60,40,0.3)',
        }}
      >
        <div style={{ color: '#ff9080', fontWeight: 600, marginBottom: 2 }}>⚔️ 预估伤害</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffd700' }}>~{estimate.damage}</div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
          命中 {(estimate.hitRate * 100).toFixed(1)}% &nbsp; 暴击 {(estimate.critRate * 100).toFixed(1)}%
        </div>
        <div style={{ fontSize: 10, color: '#ffb347' }}>
          暴击伤害 ~{estimate.critDamage}
        </div>
        {counterEstimate != null && (
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ color: '#8ec5ff', fontWeight: 600, marginBottom: 2 }}>🛡️ 预估反击</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#9ecbff' }}>~{counterEstimate.damage}</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>
              命中 {(counterEstimate.hitRate * 100).toFixed(1)}% &nbsp; 暴击 {(counterEstimate.critRate * 100).toFixed(1)}%
            </div>
          </div>
        )}
        <div style={{ marginTop: 3, fontSize: 10, color: '#ff9080', animation: 'pulse 1.5s infinite' }}>
          再次点击确认攻击
        </div>
      </div>
    </div>
  );
}

export default memo(AttackPreview);
