/**
 * BattleActionBar - 手动战斗操作按钮
 *
 * 精简版：只显示 停止移动(移动阶段) / 技能(灰) / 待机
 */
import { memo } from 'react';
import { MANUAL_PHASE } from '@/hooks/useManualBattle';

function BattleActionBar({
  phase, onStandby,
  onFormationStandby,
}) {
  const isFormationMove = phase === MANUAL_PHASE.FORMATION_MOVE;
  const isFormationAction = phase === MANUAL_PHASE.FORMATION_ACTION;
  const isSingleMove = phase === MANUAL_PHASE.SELECT_MOVE;
  const isSingleAction = phase === MANUAL_PHASE.SELECT_ACTION;

  const isMove = isSingleMove || isFormationMove;
  const isAction = isSingleAction || isFormationAction;
  const isFormation = isFormationMove || isFormationAction;

  if (!isMove && !isAction) return null;

  const handleStandby = isFormation ? onFormationStandby : onStandby;

  return (
    <div className="battle-action-bar">
      <button className="action-btn skill-btn" disabled title="技能系统尚未实装">
        🔮 技能
      </button>
      <button className="action-btn standby-btn" onClick={handleStandby}>
        💤 待机
      </button>
    </div>
  );
}

export default memo(BattleActionBar);
