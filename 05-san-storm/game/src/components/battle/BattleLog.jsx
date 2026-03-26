/**
 * BattleLog - 战斗日志面板
 */
import { memo, useEffect, useRef } from 'react';

function BattleLog({ logs, visible, maxWidth }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  if (!visible) return null;

  return (
    <div className="battle-log" ref={logRef} style={{ width: maxWidth || 'auto', maxWidth: '100%' }}>
      {logs.map(log => (
        <div key={log.id} className={`le ${log.cls}`}>{log.text}</div>
      ))}
    </div>
  );
}

export default memo(BattleLog);
