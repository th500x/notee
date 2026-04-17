/**
 * 编组「卡牌详情」浮层（LineupTab CardDetailOverlay）内层统一缩放。
 * 与官职 / 部队等详情卡展示一致，供三公府等处复用同一比例。
 */

import PropTypes from 'prop-types';

export const LINEUP_DETAIL_CARD_SCALE = 0.72;

export default function LineupDetailCardScale({ children }) {
  return (
    <div
      style={{
        transform: `scale(${LINEUP_DETAIL_CARD_SCALE})`,
        transformOrigin: 'top center',
      }}
    >
      {children}
    </div>
  );
}

LineupDetailCardScale.propTypes = {
  children: PropTypes.node.isRequired,
};
