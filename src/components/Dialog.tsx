import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { trapTab } from "../lib/keyboard";

interface Props {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Diálogo modal nativo: atrapa el foco, se cierra con Esc y devuelve el foco al cerrar. */
export default function Dialog({ title, description, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    // El contenido no es enfocable hasta abrir el diálogo: se enfoca aquí el campo indicado.
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      dialog?.close();
      opener?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? " dialog--wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => trapTab(e, ref.current)}
    >
      <div className="dialog__panel">
        <header className="dialog__head">
          <div>
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            {description && <p className="dialog__desc">{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </dialog>
  );
}
