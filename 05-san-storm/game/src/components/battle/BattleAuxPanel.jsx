/**
 * BattleAuxPanel - 辅助面板（银两、自动战斗、自动阵型）
 */
import { memo } from 'react';

function BattleAuxPanel({
  silverAmount, autoBattle, toggleAutoBattle, autoFormation, toggleAutoFormation, maxWidth,
  onStartBattle, battlePlaying,
}) {
  return (
    <div className="battle-aux" style={{ maxWidth: maxWidth || 'auto' }}>
      <div className="aux-silver">
        <span className="silver-icon">🪙</span>
        <span>{silverAmount}</span> 银两
      </div>
      <div className="aux-divider" />
      <label className="aux-check">
        <input
          type="checkbox"
          checked={autoBattle}
          onChange={e => toggleAutoBattle(e.target.checked)}
          disabled={battlePlaying}
        />
        ⚔ 自动战斗 <span className="aux-cost">(2银两/部队)</span>
      </label>
      <div className="aux-divider" />
      <label className="aux-check">
        <input
          type="checkbox"
          checked={autoFormation}
          onChange={e => toggleAutoFormation(e.target.checked)}
          disabled={battlePlaying}
        />
        🎖 自动阵型
      </label>
      <span className="aux-formation-hint">
        {!autoFormation ? '（手动阵型尚未实装，当前不组阵型）' : ''}
      </span>
      {onStartBattle && (
        <>
          <div className="aux-divider" />
          <button
            className="aux-start-btn"
            onClick={onStartBattle}
            disabled={battlePlaying}
          >
            ▶ 开始战斗
          </button>
        </>
      )}
    </div>
  );
}

export default memo(BattleAuxPanel);
