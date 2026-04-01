/**
 * ChestRewardOverlay - 宝箱奖励浮层
 *
 * 玩家部队行动结束后站在宝箱瓦片上时弹出，
 * 展示随机获得的装备件奖励。
 */
import { memo, useState, useEffect } from 'react';

/** 稀有度配色 */
const RARITY_STYLE = {
  core:      { color: '#facc15', border: '#eab308', label: '核心', glow: 'rgba(234,179,8,0.4)' },
  legendary: { color: '#fb923c', border: '#f97316', label: '传奇', glow: 'rgba(249,115,22,0.4)' },
  epic:      { color: '#c084fc', border: '#a855f7', label: '史诗', glow: 'rgba(168,85,247,0.4)' },
  rare:      { color: '#60a5fa', border: '#3b82f6', label: '稀有', glow: 'rgba(59,130,246,0.4)' },
  common:    { color: '#9ca3af', border: '#6b7280', label: '普通', glow: 'rgba(107,114,128,0.3)' },
};

/** 装备类型图标 */
const TYPE_ICON = { weapon: '⚔️', armor: '🛡️', accessory: '📖' };
const TYPE_NAME = { weapon: '武器', armor: '防具', accessory: '辅助' };

/** bonus key → 中文 */
const BONUS_LABEL = {
  luck: '运', courage: '勇', combat: '武', command: '统',
  intelligence: '智', politics: '政', charm: '魅',
};

/** equipment.json / config_equipment 为 ×10 存储，展示与后端写入 player_cards.config、EquipmentCard 一致：÷10 */
function formatEquipmentBonusDisplay(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return String(raw);
  const display = n / 10;
  return display > 0 ? `+${display.toFixed(1)}` : display.toFixed(1);
}

function ChestRewardOverlay({ reward, onConfirm }) {
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (reward) {
      // 短暂延迟后显示奖励内容（开箱动画感）
      const t = setTimeout(() => setShowReward(true), 600);
      return () => clearTimeout(t);
    }
    setShowReward(false);
  }, [reward]);

  if (!reward) return null;

  const rs = RARITY_STYLE[reward.rarity] || RARITY_STYLE.common;
  const typeIcon = TYPE_ICON[reward.equipmentType] || '📦';
  const typeName = TYPE_NAME[reward.equipmentType] || '装备';

  // 解析 bonus
  const bonusEntries = reward.bonus && typeof reward.bonus === 'object'
    ? Object.entries(reward.bonus).filter(([, v]) => v && v !== 0)
    : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: `2px solid ${rs.border}`,
        borderRadius: 12,
        padding: '20px 28px',
        minWidth: 240,
        maxWidth: 320,
        textAlign: 'center',
        boxShadow: `0 0 30px ${rs.glow}`,
        animation: 'fadeInScale 0.3s ease-out',
      }}>
        {/* 标题 */}
        <div style={{ fontSize: 18, color: '#ffd700', marginBottom: 12 }}>
          📦 发现宝箱！
        </div>

        {!showReward ? (
          <div style={{ fontSize: 32, animation: 'chestOpen 0.6s ease-in-out' }}>📦</div>
        ) : (
          <>
            {/* 装备件展示 */}
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${rs.border}`,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
                {typeIcon} {typeName}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: rs.color }}>
                {reward.name}
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

              {bonusEntries.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#ccc' }}>
                  {bonusEntries.map(([key, val]) => (
                    <span key={key} style={{ marginRight: 8 }}>
                      {BONUS_LABEL[key] || key}{formatEquipmentBonusDisplay(val)}
                    </span>
                  ))}
                </div>
              )}

              {reward.specialEffect && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#a78bfa', fontStyle: 'italic' }}>
                  {reward.specialEffect}
                </div>
              )}
            </div>

            {/* 确认按钮 */}
            <button
              onClick={onConfirm}
              style={{
                background: `linear-gradient(135deg, ${rs.border}, ${rs.color})`,
                border: 'none',
                borderRadius: 6,
                padding: '8px 24px',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              确认收下
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(ChestRewardOverlay);
