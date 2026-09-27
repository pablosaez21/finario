import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Undo2, X } from "lucide-react";

export interface ToastData {
  id: number;
  message: string;
  detail?: string;
  tone?: "success" | "error" | "info";
  undo?: () => Promise<void>;
}

interface Props {
  toast: ToastData | null;
  onClose: () => void;
}

const DURATION = 7000;

export default function Toast({ toast, onClose }: Props) {
  const [paused, setPaused] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setUndoing(false);
  }, [toast?.id]);

  useEffect(() => {
    if (!toast || paused) return;
    timer.current = window.setTimeout(onClose, toast.tone === "error" ? DURATION * 1.5 : DURATION);
    return () => window.clearTimeout(timer.current);
  }, [toast, paused, onClose]);

  if (!toast) return <div className="toast-region" role="status" aria-live="polite" />;

  const Icon = toast.tone === "error" ? CircleAlert : Check;

  return (
    <div className="toast-region" role={toast.tone === "error" ? "alert" : "status"} aria-live="polite">
      <div
        key={toast.id}
        className={`toast toast--${toast.tone ?? "success"}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <Icon className="toast__icon" size={17} strokeWidth={2} aria-hidden="true" />
        <p className="toast__text">
          <span>{toast.message}</span>
          {toast.detail && <span className="toast__detail tabular">{toast.detail}</span>}
        </p>
        {toast.undo && (
          <button
            type="button"
            className="toast__undo"
            disabled={undoing}
            onClick={async () => {
              setUndoing(true);
              try {
                await toast.undo?.();
              } finally {
                setUndoing(false);
              }
            }}
          >
            <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
            {undoing ? "Deshaciendo…" : "Deshacer"}
          </button>
        )}
        <button type="button" className="toast__close" onClick={onClose} aria-label="Cerrar aviso">
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
