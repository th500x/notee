/**
 * MapLegend - 地形图例
 */
import { memo } from 'react';

function MapLegend({ maxWidth }) {
  return (
    <div className="battle-aux" style={{ marginTop: 8, maxWidth: maxWidth || 'auto' }}>
      <div className="legend-item">
        <div className="legend-dot" style={{ background: '#bf3a3a', borderColor: '#bf3a3a' }} />
        <span style={{ color: '#ff7060' }}>敌方部署区</span>
      </div>
      <div className="legend-item">
        <div className="legend-dot" style={{ background: '#3a7abf', borderColor: '#3a7abf' }} />
        <span style={{ color: '#5ab0ff' }}>我方部署区</span>
      </div>
      <div className="legend-item">
        <div className="legend-dot" style={{ background: '#1a1a1a', borderColor: '#444' }} />
        <span>交战区</span>
      </div>
      <div className="legend-item"><span>◼</span>巨石</div>
      <div className="legend-item"><span>🚧</span>栅栏 HP500</div>
      <div className="legend-item"><span>⚠️</span>陷阱 -50兵力</div>
      <div className="legend-item"><span>📦</span>宝箱 20%</div>
    </div>
  );
}

export default memo(MapLegend);
