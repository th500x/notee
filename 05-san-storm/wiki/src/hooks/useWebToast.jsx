/**
 * Wiki 站点层 Toast（右上），与主站留言板风格一致
 */
import { useState, useCallback, useEffect } from 'react';

export function useWebToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    if (message == null || message === '') return;
    setToast({ message: String(message), type, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  function Toast() {
    if (!toast) return null;
    const bg =
      toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-gray-800' : 'bg-green-600';
    return (
      <div
        role="status"
        className={`fixed top-4 right-4 z-[10000] flex max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${bg}`}
      >
        <span className="flex-1 whitespace-pre-wrap">{toast.message}</span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 text-lg leading-none opacity-90 hover:opacity-100"
          onClick={() => setToast(null)}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
    );
  }

  return { showToast, Toast };
}
