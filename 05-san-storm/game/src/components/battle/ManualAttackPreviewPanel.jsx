import { memo } from 'react';

/**
 * 手动回合：普攻 / 主动伤害技 二次确认前的预估块（与 AttackPreview 内联样式一致，供 portal 与格上叠加复用）。
 *
 * @param {{ damage: number, hitRate: number, critRate: number, critDamage: number }} props.estimate
 * @param {typeof props.estimate | null|undefined} props.counterEstimate
 */
function ManualAttackPreviewPanel({
  tone = 'physical',
  title = '⚔️ 预估伤害',
  estimate,
  counterEstimate,
  footer,
  metaLines = [],
}) {
  const isStrategy = tone === 'strategy';
  const border = isStrategy
    ? '1px solid rgba(120,160,255,0.65)'
    : '1px solid rgba(255,100,80,0.6)';
  const headerColor = isStrategy ? '#a8c8ff' : '#ff9080';
  const shadow = isStrategy ? '0 2px 12px rgba(80,120,255,0.25)' : '0 2px 12px rgba(255,60,40,0.3)';

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.88)',
        border,
        borderRadius: 6,
        padding: '5px 8px',
        color: '#fff',
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        textAlign: 'center',
        boxShadow: shadow,
      }}
    >
      <div style={{ color: headerColor, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {metaLines.length > 0 && (
        <div
          style={{
            fontSize: 10,
            color: '#9ca3af',
            marginBottom: 4,
            whiteSpace: 'normal',
            textAlign: 'left',
            maxWidth: 220,
          }}
        >
          {metaLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#ffd700' }}>~{estimate.damage}</div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
        命中 {(estimate.hitRate * 100).toFixed(1)}% &nbsp; 暴击 {(estimate.critRate * 100).toFixed(1)}%
      </div>
      <div style={{ fontSize: 10, color: '#ffb347' }}>暴击伤害 ~{estimate.critDamage}</div>
      {counterEstimate != null && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ color: '#8ec5ff', fontWeight: 600, marginBottom: 2 }}>🛡️ 预估反击</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#9ecbff' }}>~{counterEstimate.damage}</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>
            命中 {(counterEstimate.hitRate * 100).toFixed(1)}% &nbsp; 暴击{' '}
            {(counterEstimate.critRate * 100).toFixed(1)}%
          </div>
        </div>
      )}
      {footer ? (
        <div style={{ marginTop: 3, fontSize: 10, color: headerColor, animation: 'pulse 1.5s infinite' }}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default memo(ManualAttackPreviewPanel);
export { ManualAttackPreviewPanel };
