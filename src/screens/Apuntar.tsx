import { useCallback, useEffect, useRef, useState } from "react";
import MovementForm from "../components/MovementForm";
import MovementList from "../components/MovementList";
import { api, movementToInput, toAppError, type Category, type Movement, type Summary } from "../lib/api";
import { currentMonth, formatSigned } from "../lib/format";
import type { Notify, Undoable } from "./Interior";

interface Props {
  categories: Category[];
  version: number;
  onChanged: () => void;
  notify: Notify;
  undoable: Undoable;
  onOpenAnalysis: () => void;
}

const PAGE = 30;

/** Pestaña Apuntar: formulario rápido y últimos movimientos. */
export default function Apuntar({ categories, version, onChanged, notify, undoable, onOpenAnalysis }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [month, setMonth] = useState<Summary | null>(null);
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const deleting = useRef(new Set<string>());

  const loadMovements = useCallback(async (lim = limitRef.current) => {
    setLoading(true);
    try {
      const page = await api.listMovements(lim);
      setMovements(page.items);
      setTotal(page.total);
      setLoadError(null);
      // Si el movimiento en edición cambió en otro sitio (diálogo de Análisis, Deshacer), el
      // formulario no puede seguir con los datos viejos: guardarlos pisaría el cambio.
      const current = editingRef.current;
      if (current) {
        const fresh = page.items.find((m) => m.id === current.id);
        if (!fresh) {
          setEditing(null);
          notify({ tone: "info", message: "El movimiento que editabas ya no existe." });
        } else if (fresh.updatedAt !== current.updatedAt) {
          // Sin aviso propio: no debe tapar el «Deshacer» del cambio que lo provocó.
          setEditing(fresh);
        }
      }
    } catch (err) {
      setLoadError(toAppError(err).message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements, version]);

  // Cifras del mes en curso sobre la lista: si fallan, la lista sigue funcionando sin ellas.
  useEffect(() => {
    let live = true;
    api
      .analyticsSummary(currentMonth())
      .then((s) => live && setMonth(s))
      .catch(() => live && setMonth(null));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), 2200);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const handleSaved = (saved: Movement, previous: Movement | null) => {
    setHighlight(saved.id);
    setEditing(null);
    onChanged();
    const detail = `${formatSigned(saved.amountCents, saved.kind)} · ${saved.categoryName}`;
    if (previous) {
      undoable("Cambios guardados", detail, async () => {
        await api.updateMovement(previous.id, movementToInput(previous));
      });
    } else {
      undoable(saved.kind === "expense" ? "Gasto guardado" : "Ingreso guardado", detail, () => api.deleteMovement(saved.id));
    }
  };

  const handleDelete = async (m: Movement) => {
    // Un doble clic en la papelera no debe convertir el aviso con Deshacer en un error.
    if (deleting.current.has(m.id)) return;
    deleting.current.add(m.id);
    try {
      await api.deleteMovement(m.id);
      if (editing?.id === m.id) setEditing(null);
      onChanged();
      undoable("Movimiento eliminado", `${formatSigned(m.amountCents, m.kind)} · ${m.note || m.categoryName}`, async () => {
        const restored = await api.restoreMovement(m.id);
        setHighlight(restored.id);
      });
    } catch (err) {
      notify({ tone: "error", message: `No se pudo eliminar. ${toAppError(err).message}` });
    } finally {
      deleting.current.delete(m.id);
    }
  };

  const handleMore = () => {
    const next = limit + PAGE;
    setLimit(next);
    loadMovements(next);
  };

  return (
    <div className="layout">
      <main className="main">
        <div className="main__inner">
          <h1 className="title">{editing ? "Editar movimiento" : "Nuevo movimiento"}</h1>
          <MovementForm categories={categories} editing={editing} onSaved={handleSaved} onCancelEdit={() => setEditing(null)} />
        </div>
      </main>

      <aside className="aside">
        <MovementList
          movements={movements}
          total={total}
          month={month}
          onOpenAnalysis={onOpenAnalysis}
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
  );
}
