const TYPE_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-800',
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-80 pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg',
            TYPE_STYLES[toast.type] || TYPE_STYLES.info,
          ].join(' ')}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="leading-relaxed">{toast.message}</p>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100 shrink-0"
              aria-label="关闭"
              onClick={() => onDismiss(toast.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
