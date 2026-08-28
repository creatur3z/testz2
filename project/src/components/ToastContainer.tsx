import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToast, type ToastType } from "@/context/ToastContext";

const styles: Record<ToastType, { icon: typeof Info; bg: string; text: string; border: string }> = {
  success: { icon: CheckCircle2, bg: "bg-success-500/10", text: "text-success-600", border: "border-success-500/30" },
  error: { icon: XCircle, bg: "bg-error-500/10", text: "text-error-600", border: "border-error-500/30" },
  info: { icon: Info, bg: "bg-brand-500/10", text: "text-brand-600 dark:text-brand-300", border: "border-brand-500/30" },
  warning: { icon: AlertTriangle, bg: "bg-warning-500/10", text: "text-warning-600", border: "border-warning-500/30" },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const s = styles[t.type];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 pr-10 rounded-xl bg-white dark:bg-slate-900 border ${s.border} shadow-lg animate-slide-in-right relative`}
          >
            <div className={`shrink-0 w-8 h-8 rounded-lg ${s.bg} ${s.text} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug pt-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
