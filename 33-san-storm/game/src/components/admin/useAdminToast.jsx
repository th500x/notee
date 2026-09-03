/**
 * 管理端 / 网站层轻量 Toast（右上绿/红条，与站内留言板等风格一致，非 AncientModal）
 */
import { useState, useCallback, useEffect } from 'react';

/**
 * @returns {{ showToast: (message: string, type?: 'success'|'error'|'info') => void, Toast: () => JSX.Element|null }}
 */
export function useAdminToast() {
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
