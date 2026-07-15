import { useRef, useEffect, useCallback } from 'react';

/** 与公式格 / 日期格相同的可视高度与边框，保证各行「框体」一致 */
const baseCls =
  'w-full min-w-0 min-h-[2.25rem] box-border px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none overflow-hidden break-words leading-snug';

function syncTextareaHeight(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * 窄列文本格：随内容自动增高，文字换行而非横向截断。
 * 支持 rentNavSlot + onGridArrowKeyDown，与租金表方向键导航一致。
 */
export function AccountingAutoTextareaCell({
  value,
  onChange,
  className = '',
  title,
  rentNavSlot,
  onGridArrowKeyDown,
  disabled = false
}) {
  const ref = useRef(null);

  const adjustHeight = useCallback(() => {
    syncTextareaHeight(ref.current);
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`${baseCls} ${className}`.trim()}
      value={value}
      disabled={disabled}
      title={title}
      data-rent-nav={rentNavSlot}
      onChange={(e) => {
        onChange(e);
        syncTextareaHeight(e.target);
      }}
      onKeyDown={(e) => {
        if (
          onGridArrowKeyDown &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
        ) {
          onGridArrowKeyDown(e);
        }
      }}
    />
  );
}
