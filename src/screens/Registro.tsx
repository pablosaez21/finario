import { useCallback, useEffect, useRef, useState } from "react";
import { DatabaseBackup, House, Tags } from "lucide-react";
import MovementForm from "../components/MovementForm";
import MovementList from "../components/MovementList";
import Toast, { type ToastData } from "../components/Toast";
import CategoriesDialog from "../components/CategoriesDialog";
import BackupsDialog from "../components/BackupsDialog";
import { api, toAppError, type BackupFile, type Category, type Movement, type MovementInput } from "../lib/api";
import { centsToInput, formatDateTime, formatSigned } from "../lib/format";
import "../styles/registro.css";

interface Props {
  onHome: () => void;
}

const PAGE = 30;

const toInput = (m: Movement): MovementInput => ({
  kind: m.kind,
  amount: centsToInput(m.amountCents),
  categoryId: m.categoryId,
  date: m.date,
  note: m.note,
});

export default function Registro({ onHome }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [dialog, setDialog] = useState<"categorias" | "copias" | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupFile | null>(null);
  const toastSeq = useRef(0);
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const notify = useCallback((t: Omit<ToastData, "id">) => setToast({ ...t, id: ++toastSeq.current }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const loadMovements = useCallback(async (lim = limitRef.current) => {
    setLoading(true);
    try {
      const page = await api.listMovements(lim);
      setMovements(page.items);
      setTotal(page.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(toAppError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await api.listCategories(true));
    } catch (err) {
      notify({ tone: "error", message: `No se han podido cargar las categorías. ${toAppError(err).message}` });
    }
  }, [notify]);

  const loadBackupInfo = useCallback(async () => {
    try {
      setLastBackup((await api.backupInfo()).backups[0] ?? null);
    } catch {
      setLastBackup(null);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadMovements();
    loadBackupInfo();
  }, [loadCategories, loadMovements, loadBackupInfo]);

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), 2200);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const undoable = (label: string, detail: string, undo: () => Promise<void>) =>
    notify({
      message: label,
      detail,
      undo: async () => {
        try {
          await undo();
          await loadMovements();
          notify({ tone: "info", message: "Cambio deshecho." });
        } catch (err) {
          notify({ tone: "error", message: `No se pudo deshacer. ${toAppError(err).message}` });
        }
      },
    });

  const handleSaved = async (saved: Movement, previous: Movement | null) => {
    setHighlight(saved.id);
    setEditing(null);
    await loadMovements();
    const detail = `${formatSigned(saved.amountCents, saved.kind)} · ${saved.categoryName}`;
    if (previous) {
      undoable("Cambios guardados", detail, async () => {
        await api.updateMovement(previous.id, toInput(previous));
      });
    } else {
      undoable(saved.kind === "expense" ? "Gasto guardado" : "Ingreso guardado", detail, () => api.deleteMovement(saved.id));
    }
  };

  const handleDelete = async (m: Movement) => {
    try {
      await api.deleteMovement(m.id);
      if (editing?.id === m.id) setEditing(null);
      await loadMovements();
      undoable("Movimiento eliminado", `${formatSigned(m.amountCents, m.kind)} · ${m.note || m.categoryName}`, async () => {
        const restored = await api.restoreMovement(m.id);
        setHighlight(restored.id);
      });
    } catch (err) {
      notify({ tone: "error", message: `No se pudo eliminar. ${toAppError(err).message}` });
    }
  };

  const handleMore = () => {
    const next = limit + PAGE;
    setLimit(next);
    loadMovements(next);
  };

  return (
    <div className="registro">
      <header className="head">
        <div>
          <p className="head__kicker">Tu cuaderno personal</p>
          <p className="head__brand">Finario</p>
        </div>
        <button type="button" className="head__home" onClick={onHome}>
          <House size={16} strokeWidth={1.7} aria-hidden="true" />
          Inicio
        </button>
      </header>

      <nav className="tabs" aria-label="Secciones">
        <span className="tabs__item" aria-current="page">
          Apuntar
        </span>
        <div className="tabs__tools">
          <button type="button" className="tool" onClick={() => setDialog("categorias")}>
            <Tags size={16} strokeWidth={1.6} aria-hidden="true" />
            Categorías
          </button>
          <button type="button" className="tool" onClick={() => setDialog("copias")}>
            <DatabaseBackup size={16} strokeWidth={1.6} aria-hidden="true" />
            Copias de seguridad
          </button>
        </div>
      </nav>

      <div className="layout">
        <main className="main">
          <div className="main__inner">
            <div className="rule" aria-hidden="true" />
            <h1 className="title">{editing ? "Editar movimiento" : "¿Qué apuntamos?"}</h1>
            <p className="muted">
              {editing ? "Corrige lo que necesites y guarda los cambios." : "Una cantidad, una categoría. Y listo."}
            </p>
            <MovementForm
              categories={categories}
              editing={editing}
              onSaved={handleSaved}
              onCancelEdit={() => setEditing(null)}
            />
          </div>
        </main>

        <aside className="aside">
          <MovementList
            movements={movements}
            total={total}
            loading={loading}
            error={loadError}
            editingId={editing?.id ?? null}
            highlightId={highlight}
            onEdit={(m) => setEditing(m)}
            onDelete={handleDelete}
            onMore={handleMore}
            onRetry={() => loadMovements()}
          />
        </aside>
      </div>

      <footer className="foot">
        <span>Datos guardados solo en este equipo</span>
        <button type="button" className="foot__link" onClick={() => setDialog("copias")}>
          {lastBackup ? `Última copia: ${formatDateTime(lastBackup.created)}` : "Sin copias todavía"}
        </button>
      </footer>

      <Toast toast={toast} onClose={closeToast} />

      {dialog === "categorias" && (
        <CategoriesDialog categories={categories} onChanged={setCategories} onClose={() => { setDialog(null); loadMovements(); }} />
      )}
      {dialog === "copias" && (
        <BackupsDialog
          onClose={() => setDialog(null)}
          onBackupCreated={loadBackupInfo}
          onRestored={async (safety) => {
            setDialog(null);
            setEditing(null);
            await Promise.all([loadCategories(), loadMovements(), loadBackupInfo()]);
            notify({ tone: "info", message: "Datos restaurados.", detail: `Copia previa: ${safety.fileName}` });
          }}
        />
      )}
    </div>
  );
}
