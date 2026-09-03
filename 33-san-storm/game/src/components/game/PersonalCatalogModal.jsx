/**
 * 个人中心 · 称号/成就等大表展示弹窗
 * 竖屏/窄屏：全屏；sm 及以上：居中卡片（max-w-3xl）
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** 须高于 GamePage 根层 z-[100]，与 AncientModal 同级 */
const CATALOG_MODAL_Z = 'z-[10080]';

export default function PersonalCatalogModal({ open, title, icon = '📋', onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${CATALOG_MODAL_Z} flex flex-col sm:items-center sm:justify-center sm:p-4`}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 cursor-default"
        aria-label="关闭"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-catalog-modal-title"
        className="relative flex flex-col w-full h-full max-h-[100dvh] bg-white shadow-2xl overflow-hidden
          sm:h-auto sm:max-h-[min(85vh,720px)] sm:max-w-3xl sm:w-full sm:rounded-xl sm:border sm:border-amber-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-amber-800 text-white sm:rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0" aria-hidden>
              {icon}
            </span>
            <h2 id="personal-catalog-modal-title" className="text-lg font-bold truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xl leading-none px-2 py-1 rounded hover:bg-amber-700/80 transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
