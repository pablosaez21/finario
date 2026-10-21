import { ArrowRight, NotebookPen, Pencil, Trash2 } from "lucide-react";
import type { Movement, Summary } from "../lib/api";
import { formatBalance, formatDayHeading, formatEuros, formatSigned, monthLabel } from "../lib/format";
import { CategoryIcon } from "../lib/icons";

interface Props {
  movements: Movement[];
  total: number;
  /** Resumen del mes en curso (null mientras carga o si falla). */
  month: Summary | null;
  loading: boolean;
  error: string | null;
  editingId: string | null;
  highlightId: string | null;
  onEdit: (m: Movement) => void;
  onDelete: (m: Movement) => void;
  onMore: () => void;
  onRetry: () => void;
  onOpenAnalysis: () => void;
}

interface Day {
  date: string;
  items: Movement[];
  spent: number;
  expenses: number;
}

/** Agrupa por fecha conservando el orden (la lista ya llega ordenada por fecha descendente). */
function byDay(movements: Movement[]): Day[] {
  const days: Day[] = [];
  for (const m of movements) {
    let day = days[days.length - 1];
    if (!day || day.date !== m.date) {
      day = { date: m.date, items: [], spent: 0, expenses: 0 };
      days.push(day);
    }
    day.items.push(m);
    if (m.kind === "expense") {
      day.spent += m.amountCents;
      day.expenses += 1;
    }
  }
  return days;
}

export default function MovementList({
  movements, total, month, loading, error, editingId, highlightId, onEdit, onDelete, onMore, onRetry, onOpenAnalysis,
}: Props) {
  const days = byDay(movements);
  const partial = movements.length < total;
  const figures = month && {
    spent: formatEuros(month.expense.total),
    earned: formatEuros(month.income.total),
    balance: formatBalance(month.balance),
  };
  // Tres columnas caben hasta «−99.999,99 €»; con cifras más largas pasan a filas para no pisarse.
  const longFigures = !!figures && Object.values(figures).some((f) => f.length > 12);

  return (
    <section className="recents" aria-labelledby="recientes-titulo">
      {month && (
        <div className="month">
          <div className="month__head">
            <h2 className="month__title">{monthLabel(month.month)}</h2>
            <button type="button" className="link-btn month__link" onClick={onOpenAnalysis}>
              Ver análisis
              <ArrowRight size={14} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
          <dl className={`month__figures${longFigures ? " is-long" : ""}`}>
            <div>
              <dt>Gastos</dt>
              <dd className="tabular month__spent">{figures!.spent}</dd>
            </div>
            <div>
              <dt>Ingresos</dt>
              <dd className="tabular">{figures!.earned}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd className="tabular">{figures!.balance}</dd>
            </div>
          </dl>
        </div>
      )}

      <header className="recents__head">
        <h2 id="recientes-titulo">Últimos movimientos</h2>
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
          <NotebookPen className="empty__icon" size={20} strokeWidth={1.5} aria-hidden="true" />
          <p>Todavía no hay movimientos.</p>
          <p className="empty__sub">Escribe un importe, elige la categoría y guarda: aparecerá aquí.</p>
        </div>
      ) : (
        <ol className="days">
          {days.map((day, i) => {
            // La suma solo aporta con dos gastos o más. El último día puede venir cortado por la
            // paginación: entonces su suma no sería la del día y no se muestra.
            const showSpent = day.expenses > 1 && !(partial && i === days.length - 1);
            return (
              <li key={day.date} className="day">
                <h3 className="day__head">
                  <span>{formatDayHeading(day.date)}</span>
                  {showSpent && (
                    <span className="day__spent tabular" title="Total gastado ese día">
                      −{formatEuros(day.spent)}
                    </span>
                  )}
                </h3>
                <ul className="rows">
                  {day.items.map((m) => {
                    const title = m.note || m.categoryName;
                    return (
                      <li
                        key={m.id}
                        className="row"
                        data-editing={editingId === m.id || undefined}
                        data-fresh={highlightId === m.id || undefined}
                      >
                        <CategoryIcon className="row__icon" name={m.categoryIcon} size={16} />
                        <div className="row__text">
                          <p className="row__title" title={title}>
                            {title}
                          </p>
                          {m.note && (
                            <small className="row__meta" title={m.categoryName}>
                              {m.categoryName}
                            </small>
                          )}
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
              </li>
            );
          })}
        </ol>
      )}

      {partial && (
        <button type="button" className="more" onClick={onMore} disabled={loading}>
          {loading ? "Cargando…" : `Mostrar más (${total - movements.length})`}
        </button>
      )}
    </section>
  );
}
