"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: "border-emerald-500/20 text-emerald-600 bg-emerald-500/10",
  error: "border-rose-500/20 text-rose-600 bg-rose-500/10",
  info: "border-cyan-500/20 text-cyan-600 bg-cyan-500/10",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={`animate-sprout pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-[var(--shell-surface)] px-4 py-3 text-sm font-medium shadow-lg ${COLORS[toast.type]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[var(--shell-text)]">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-1 shrink-0 text-[var(--shell-text-faint)] hover:text-[var(--shell-text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail soft rather than crash the app if a component using toasts ever
    // renders outside the provider (e.g. during a future refactor).
    return { showToast: () => {} };
  }
  return ctx;
}
