import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

type ToastKind = "success" | "info" | "warn" | "error";
type Toast = { id: number; kind: ToastKind; message: string; action?: { label: string; onClick: () => void } };
type Ctx = { show: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c.show;
}

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = ++_id;
    setItems(prev => [...prev, { ...t, id }]);
    window.setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 3600);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-[var(--z-mobile-toast)] flex flex-col items-center gap-2 px-4 w-full max-w-sm pointer-events-none"
        style={{ bottom: "calc(var(--bottomnav-h) + var(--safe-bottom) + 12px)" }}
      >
        {items.map(t => <ToastCard key={t.id} t={t} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ t }: { t: Toast }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setEnter(true)); }, []);

  const palette: Record<ToastKind, { Icon: typeof CheckCircle2; cls: string }> = {
    success: { Icon: CheckCircle2, cls: "text-[var(--success-500)]" },
    info:    { Icon: Info,         cls: "text-[var(--info-500)]" },
    warn:    { Icon: AlertTriangle, cls: "text-[var(--warning-500)]" },
    error:   { Icon: XCircle,      cls: "text-[var(--danger-500)]" },
  };
  const { Icon, cls } = palette[t.kind];

  return (
    <div
      style={{ transform: enter ? "translateY(0)" : "translateY(20px)", opacity: enter ? 1 : 0 }}
      className="pointer-events-auto w-full bg-[var(--neutral-950)] text-[var(--neutral-50)] dark:bg-[var(--neutral-100)] dark:text-[var(--neutral-950)]
                 rounded-full px-4 py-2.5 shadow-[var(--shadow-xl)] flex items-center gap-2.5
                 transition-all duration-200 ease-[var(--ease-ios)]"
    >
      <Icon className={`size-4 ${cls}`} />
      <span className="flex-1 text-[13px] truncate">{t.message}</span>
      {t.action && (
        <button onClick={t.action.onClick}
          className="text-[12.5px] font-semibold text-[var(--brand-300)] dark:text-[var(--brand-600)] px-2 py-1 -my-1 rounded-md">
          {t.action.label}
        </button>
      )}
    </div>
  );
}
