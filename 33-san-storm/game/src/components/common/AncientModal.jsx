/**
 * 古风弹框/对话框组件
 * 
 * @description 三国古风样式的模态框，支持多种类型
 * 类型：info（信息）、confirm（确认）、warning（警告）、reward（奖励）
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** 挂到独立 DOM 节点并在 effect cleanup 里移除，避免 StrictMode/重挂时 body 上残留第二层 portal */

// ========== 古风装饰 SVG ==========

// 角落装饰（铜钉风格）
const CornerDeco = ({ className = '' }) => (
  <div className={`absolute w-6 h-6 ${className}`}>
    <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 shadow-inner border border-yellow-800/50">
      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 opacity-60" />
    </div>
  </div>
);

// 分隔线装饰
const Divider = () => (
  <div className="flex items-center gap-2 my-3">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
    <div className="w-1.5 h-1.5 rotate-45 bg-amber-600/60" />
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
  </div>
);

// ========== 类型配置 ==========

const TYPE_CONFIG = {
  info: {
    headerBg: 'from-amber-800 via-amber-700 to-amber-800',
    headerText: 'text-amber-100',
    borderColor: 'border-amber-700/60',
    icon: '📜',
  },
  confirm: {
    headerBg: 'from-amber-800 via-amber-700 to-amber-800',
    headerText: 'text-amber-100',
    borderColor: 'border-amber-700/60',
    icon: '⚔️',
  },
  warning: {
    headerBg: 'from-red-900 via-red-800 to-red-900',
    headerText: 'text-red-100',
    borderColor: 'border-red-700/60',
    icon: '⚠️',
  },
  reward: {
    headerBg: 'from-yellow-700 via-amber-600 to-yellow-700',
    headerText: 'text-yellow-100',
    borderColor: 'border-yellow-600/60',
    icon: '🎁',
  },
};

// ========== 主组件 ==========

const AncientModal = ({
  isOpen = false,
  onClose,
  type = 'info',        // info | confirm | warning | reward
  title = '提示',
  children,
  // 按钮配置
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  showCancel = false,
  hideButtons = false,
  preventClose = false,  // 禁止关闭按钮和遮罩点击关闭
  /** 为 false 时：点「确定」只调 onConfirm，不调 handleClose → 不触发 onClose（道路遇袭点确定进场观战等异步确认用） */
  invokeOnCloseAfterConfirm = true,
  // 样式
  width = 'max-w-md',
  /** 同 key 同时只保留一个 overlay（道路退让提示防叠窗） */
  portalDedupeKey = '',
}) => {
  const [visible, setVisible] = useState(false);
  const [portalEl, setPortalEl] = useState(null);
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      setVisible(false);
      setPortalEl(null);
      return undefined;
    }
    const dedupe = String(portalDedupeKey || '').trim();
    if (dedupe) {
      document.querySelectorAll(`[data-ancient-modal-key="${dedupe}"]`).forEach((n) => n.remove());
    }
    const el = document.createElement('div');
    if (dedupe) el.setAttribute('data-ancient-modal-key', dedupe);
    el.setAttribute('data-ancient-modal-root', '');
    document.body.appendChild(el);
    setPortalEl(el);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(raf);
      el.remove();
      setPortalEl(null);
      setVisible(false);
    };
  }, [isOpen, portalDedupeKey]);

  if (!isOpen || !portalEl) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 200);
  };

  const handleConfirm = async () => {
    try {
      await Promise.resolve(onConfirm?.());
    } catch {
      /* 由业务 onConfirm / 外层处理 */
    }
    if (invokeOnCloseAfterConfirm) {
      handleClose();
    } else {
      setVisible(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    handleClose();
  };

  /** 高于战略大地图 `tile-tooltip--portal`（z-index:10050），避免提示/浮层压住弹窗 */
  const overlay = (
    <div
      className={`fixed inset-0 z-[10080] flex items-center justify-center p-4 transition-all duration-200 ${
        visible ? 'bg-black/60' : 'bg-black/0'
      }`}
      onClick={preventClose ? undefined : handleClose}
    >
      <div
        className={`relative ${width} w-full transition-all duration-300 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== 外层边框（木纹质感） ===== */}
        <div className={`rounded-lg border-2 ${config.borderColor} shadow-2xl overflow-hidden`}
          style={{
            background: 'linear-gradient(135deg, #3a2a1a 0%, #4a3828 50%, #3a2a1a 100%)',
          }}
        >
          {/* 内层（纸张质感） */}
          <div className="m-1.5 rounded overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #f5edd6 0%, #efe4c8 30%, #f0e6cc 100%)',
            }}
          >
            {/* ===== 标题栏 ===== */}
            <div className={`relative px-6 py-3 bg-gradient-to-r ${config.headerBg}`}>
              {/* 标题文字 */}
              <div className={`text-center ${config.headerText}`}>
                <span className="text-lg mr-2">{config.icon}</span>
                <span className="text-lg font-bold tracking-wider">{title}</span>
              </div>
              {/* 关闭按钮 */}
              {!preventClose && (
                <button
                  onClick={handleClose}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-amber-300/70 hover:text-amber-100 hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 标题下装饰线 */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-700/30 to-transparent" />

            {/* ===== 内容区 ===== */}
            <div className="px-6 py-5 text-gray-800 text-sm leading-relaxed">
              {children}
            </div>

            {/* ===== 按钮区 ===== */}
            {!hideButtons && (
            <div className="px-6 pb-5">
              <Divider />
              <div className={`flex gap-3 ${showCancel ? 'justify-center' : 'justify-center'}`}>
                {showCancel && (
                  <button
                    onClick={handleCancel}
                    className="px-6 py-2 rounded border border-gray-400/60 text-gray-600 text-sm font-medium
                      hover:bg-gray-100 active:bg-gray-200 transition-colors"
                    style={{ background: 'linear-gradient(180deg, #f0ead8 0%, #e0d8c0 100%)' }}
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 rounded text-amber-50 text-sm font-bold tracking-wide
                    shadow-md hover:shadow-lg active:shadow-sm transition-all
                    border border-amber-800/40"
                  style={{
                    background: type === 'warning'
                      ? 'linear-gradient(180deg, #b91c1c 0%, #991b1b 100%)'
                      : 'linear-gradient(180deg, #b45309 0%, #92400e 100%)',
                  }}
                >
                  {confirmText}
                </button>
              </div>
            </div>
            )}
          </div>

          {/* ===== 四角铜钉装饰 ===== */}
          <CornerDeco className="-top-1.5 -left-1.5" />
          <CornerDeco className="-top-1.5 -right-1.5" />
          <CornerDeco className="-bottom-1.5 -left-1.5" />
          <CornerDeco className="-bottom-1.5 -right-1.5" />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, portalEl);
};

export default AncientModal;
export { Divider, CornerDeco };
