import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx>({ toasts: [], notify: () => {}, dismiss: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ toasts, notify, dismiss }}>{children}</Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
