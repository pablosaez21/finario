import { useCallback, useEffect, useRef, useState } from "react";
import MovementForm from "../components/MovementForm";
import MovementList from "../components/MovementList";
import { api, movementToInput, toAppError, type Category, type Movement } from "../lib/api";
import { formatSigned } from "../lib/format";
import type { Notify, Undoable } from "./Interior";

interface Props {
  categories: Category[];
  version: number;
  onChanged: () => void;
  notify: Notify;
  undoable: Undoable;
}

const PAGE = 30;

/** Pestaña Apuntar: formulario rápido y últimos movimientos. */
export default function Apuntar({ categories, version, onChanged, notify, undoable }: Props) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const limitRef = useRef(limit);
  limitRef.current = limit;

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

  useEffect(() => {
    loadMovements();
  }, [loadMovements, version]);

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
          <div className="rule" aria-hidden="true" />
          <h1 className="title">{editing ? "Editar movimiento" : "¿Qué apuntamos?"}</h1>
          <MovementForm categories={categories} editing={editing} onSaved={handleSaved} onCancelEdit={() => setEditing(null)} />
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
  );
}
