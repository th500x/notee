/**
 * 编组「卡牌详情」浮层内层石青面板（与 LineupTab CardDetailOverlay 内框一致），
 * 可嵌入三公府列表等非全屏场景，仅复用样式与结构，避免另一套外框。
 */

import PropTypes from 'prop-types';

export default function LineupCardDetailPanel({
  title,
  headerRight,
  subtitle,
  children,
  footer,
  panelClassName = 'w-full max-w-sm mx-4',
  onClick,
}) {
  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-stone-900 p-4 ${panelClassName}`}
      onClick={onClick}
    >
      <div className={`mb-3 flex items-center ${headerRight ? 'justify-between' : ''}`}>
        <span className="text-sm font-bold text-amber-400/95">{title}</span>
        {headerRight}
      </div>
      {subtitle ? <div className="mb-3 space-y-1 text-[11px] text-stone-400">{subtitle}</div> : null}
      <div className="mb-3 flex flex-col items-center gap-1">{children}</div>
      {footer}
    </div>
  );
}

LineupCardDetailPanel.propTypes = {
  title: PropTypes.node.isRequired,
  headerRight: PropTypes.node,
  subtitle: PropTypes.node,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  panelClassName: PropTypes.string,
  onClick: PropTypes.func,
};
