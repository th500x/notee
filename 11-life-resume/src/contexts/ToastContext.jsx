import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ToastContainer from '@/components/common/ToastContainer';

const ToastContext = createContext(null);

let toastCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message, options = {}) => {
      const text = String(message || '').trim();
      if (!text) return null;

      const id = ++toastCounter;
      const type = options.type || 'info';
      const duration = Number.isFinite(options.duration) ? options.duration : 4000;

      setToasts((prev) => [...prev, { id, message: text, type }]);

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx.showToast;
}
