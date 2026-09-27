import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import type { Movement } from "../lib/api";
import { formatShortDate, formatSigned, relativeDay } from "../lib/format";

interface Props {
  movements: Movement[];
  total: number;
  loading: boolean;
  error: string | null;
  editingId: string | null;
  highlightId: string | null;
  onEdit: (m: Movement) => void;
  onDelete: (m: Movement) => void;
  onMore: () => void;
  onRetry: () => void;
}

export default function MovementList({
  movements, total, loading, error, editingId, highlightId, onEdit, onDelete, onMore, onRetry,
}: Props) {
  return (
    <section className="recents" aria-labelledby="recientes-titulo">
      <header className="recents__head">
        <h3 id="recientes-titulo">Últimos movimientos</h3>
        {total > 0 && (
          <span className="recents__count tabular">
            {total} {total === 1 ? "movimiento" : "movimientos"}
          </span>
        )}
      </header>

      {error ? (
        <div className="empty" role="alert">
          <p>No se han podido cargar los movimientos.</p>
          <p className="empty__sub">{error}</p>
          <button type="button" className="btn-ghost btn-ghost--small" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : !loading && movements.length === 0 ? (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <NotebookPen size={20} strokeWidth={1.5} />
          </span>
          <p>Todavía no hay movimientos.</p>
          <p className="empty__sub">Registra el primero: importe, categoría y guardar.</p>
        </div>
      ) : (
        <ul className="rows">
          {movements.map((m) => {
            const title = m.note || m.categoryName;
            const when = relativeDay(m.date) ?? formatShortDate(m.date);
            return (
              <li
                key={m.id}
                className="row"
                data-editing={editingId === m.id || undefined}
                data-fresh={highlightId === m.id || undefined}
              >
                <div className="row__text">
                  <p className="row__title">{title}</p>
                  <small className="row__meta">
                    {m.categoryName} · {when}
                  </small>
                </div>
                <div className="row__actions">
                  <button type="button" className="icon-btn icon-btn--small" onClick={() => onEdit(m)} aria-label={`Editar ${title}`} title="Editar">
                    <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--small icon-btn--danger"
                    onClick={() => onDelete(m)}
                    aria-label={`Eliminar ${title}`}
                    title="Eliminar"
                  >
                    <Trash2 size={15} strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </div>
                <span className={`row__amount tabular${m.kind === "income" ? " is-income" : ""}`}>
                  {formatSigned(m.amountCents, m.kind)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {movements.length < total && (
        <button type="button" className="more" onClick={onMore} disabled={loading}>
          {loading ? "Cargando…" : `Mostrar más (${total - movements.length})`}
        </button>
      )}
    </section>
  );
}
