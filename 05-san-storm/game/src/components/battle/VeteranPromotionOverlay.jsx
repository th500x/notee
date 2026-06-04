/**
 * VeteranPromotionOverlay - 老兵晋升浮层
 *
 * 战斗结算后若有部队卡达到老兵里程碑，弹出此浮层：
 * 骰子动画 → 揭示随机加成% → 玩家确认。支持多张卡依次展示。
 *
 * 使用 createPortal 挂到 document.body：避免嵌套在 SmallMapBattle（z-[60]）内时被
 * StandingRankingsPanel（z-[110]）、大地图其它壳层压住。
 */
import { memo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const RARITY_STYLE = {
  core:      { color: '#facc15', border: '#eab308', label: '核心', glow: 'rgba(234,179,8,0.4)' },
  legendary: { color: '#fb923c', border: '#f97316', label: '传奇', glow: 'rgba(249,115,22,0.4)' },
};

const TIER_LABEL = { 1: 'I', 2: 'II', 3: 'III' };

function VeteranPromotionOverlay({ promotions, onDismiss }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rolling, setRolling] = useState(false);

  const item = promotions?.[currentIdx];
  if (!item) return null;

  const rs = RARITY_STYLE[item.rarity] || RARITY_STYLE.legendary;

  const handleRoll = useCallback(() => {
    if (revealed || rolling) return;
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      setRevealed(true);
    }, 900);
  }, [revealed, rolling]);

  const handleNext = useCallback(() => {
    if (currentIdx + 1 < promotions.length) {
      setCurrentIdx((i) => i + 1);
      setRevealed(false);
      setRolling(false);
    } else {
      onDismiss?.();
    }
  }, [currentIdx, promotions.length, onDismiss]);

  const layer = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: `2px solid ${rs.border}`,
        borderRadius: 14,
        padding: '24px 32px',
        minWidth: 280,
        maxWidth: 360,
        textAlign: 'center',
        boxShadow: `0 0 40px ${rs.glow}`,
        animation: 'fadeInScale 0.3s ease-out',
      }}>
        {/* 标题 */}
        <div style={{ fontSize: 20, fontWeight: 700, color: '#ffd700', marginBottom: 6 }}>
          老兵晋升
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
          {promotions.length > 1
            ? `（${currentIdx + 1} / ${promotions.length}）`
            : null}
        </div>

        {/* 部队名称与稀有度 */}
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${rs.border}`,
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: rs.color }}>
            {item.cardName}
          </div>
          <div style={{
            display: 'inline-block',
            fontSize: 11,
            padding: '1px 8px',
            borderRadius: 4,
            background: rs.border,
            color: '#fff',
            marginTop: 4,
          }}>
            {rs.label}
          </div>

          <div style={{ marginTop: 14, fontSize: 14, color: '#ddd' }}>
            老兵等级：
            <span style={{ color: '#ffd700', fontWeight: 700, fontSize: 18 }}>
              {TIER_LABEL[item.newTier] || item.newTier}
            </span>
          </div>

          {/* 骰子 / 揭示 */}
          <div style={{ marginTop: 16, minHeight: 60 }}>
            {!revealed ? (
              <button
                onClick={handleRoll}
                disabled={rolling}
                style={{
                  background: rolling
                    ? 'linear-gradient(135deg, #555, #666)'
                    : 'linear-gradient(135deg, #b45309, #f59e0b)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 28px',
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                  cursor: rolling ? 'default' : 'pointer',
                  animation: rolling ? 'diceRoll 0.15s infinite alternate' : undefined,
                  transition: 'background 0.2s',
                }}
              >
                {rolling ? '🎲' : '🎲 掷骰'}
              </button>
            ) : (
              <div style={{ animation: 'fadeInScale 0.35s ease-out' }}>
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
                  本次加成
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80' }}>
                  +{item.rollPct}%
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  全属性（攻/防/速/移动）
                </div>
                <div style={{ fontSize: 13, color: '#fbbf24', marginTop: 8 }}>
                  累计加成：+{item.totalPct}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 确认按钮：须先掷骰揭示，再点确认；点击幕布不关闭 */}
        {revealed && (
          <button
            onClick={handleNext}
            style={{
              background: `linear-gradient(135deg, ${rs.border}, ${rs.color})`,
              border: 'none',
              borderRadius: 6,
              padding: '9px 28px',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              animation: 'fadeInScale 0.2s ease-out',
            }}
          >
            {currentIdx + 1 < promotions.length ? '下一个' : '确认'}
          </button>
        )}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes diceRoll {
          from { transform: rotate(-15deg) scale(1.1); }
          to   { transform: rotate(15deg) scale(1.2); }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(layer, document.body);
}

export default memo(VeteranPromotionOverlay);
