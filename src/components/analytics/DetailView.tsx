import { ArrowLeft, ArrowRight, Pencil } from "lucide-react";
import type { CategoryDetail, Movement } from "../../lib/api";
import { formatChangePct, formatEuros, formatEurosShort, formatPct, formatRange, formatShortDate, formatSigned, monthShort } from "../../lib/format";
import { arrow, detailBody, detailHeadline, previousName, subtitle, toneFor, versus } from "../../lib/analytics";
import { CategoryIcon } from "../../lib/icons";
import { Delta } from "./SummaryView";

interface Props {
  data: CategoryDetail;
  showAll: boolean;
  onBack: () => void;
  onToggleAll: () => void;
  onEdit: (m: Movement) => void;
}

const VISIBLE = 5;

export default function DetailView({ data, showAll, onBack, onToggleAll, onEdit }: Props) {
  const c = data.category;
  const kind = c.kind;
  const noun = kind === "expense" ? "gasto" : "ingreso";
  const prevName = previousName(data);
  const prev = data.previous;
  const comparable = data.hasPrevious && prev !== null;

  const totalDelta = () => {
    if (!comparable) return { rest: "Sin registros para comparar", tone: "none" as const };
    if (prev.total === 0 && data.compare.total === 0) return { rest: `Sin ${noun}s en ninguno de los dos periodos`, tone: "flat" as const };
    if (prev.total === 0) return { rest: `Sin ${noun} previo registrado`, tone: "none" as const };
    const ch = data.totalChange ?? 0;
    if (ch === 0) return { rest: `Sin cambio frente a ${versus(data)}`, tone: "flat" as const };
    const pct = data.totalChangePct !== null ? ` · ${formatChangePct(data.totalChangePct)}` : "";
    return { strong: `${arrow(ch)} ${formatEuros(Math.abs(ch))}${pct}`, rest: ` frente a ${versus(data)}`, tone: toneFor(kind, ch) };
  };

  const countDelta = () => {
    if (!comparable) return "Sin registros para comparar";
    const ch = data.countChange ?? 0;
    const before = `antes, ${prev.count}`;
    if (ch === 0) return `Los mismos que en ${prevName} · ${before}`;
    return `${Math.abs(ch)} ${ch > 0 ? "más" : "menos"} que en ${prevName} · ${before}`;
  };

  const averageDelta = () => {
    if (!comparable || prev.average === null) return comparable ? "Sin movimientos previos" : "Sin registros para comparar";
    if (data.averageChange === null) return `Antes, ${formatEuros(prev.average)}`;
    const ch = data.averageChange;
    if (ch === 0) return `Igual que antes · ${formatEuros(prev.average)}`;
    return `${formatEuros(Math.abs(ch))} ${ch > 0 ? "más" : "menos"} por movimiento · antes, ${formatEuros(prev.average)}`;
  };

  const visible = showAll ? data.movements : data.movements.slice(0, VISIBLE);
  const visibleSum = visible.reduce((s, m) => s + m.amountCents, 0);
  const isSubset = visible.length < data.movementCount;
  const maxEvolution = Math.max(1, ...data.evolution.map((e) => e.total));

  return (
    <div className="detail">
      <nav className="crumbs" aria-label="Ruta">
        <button type="button" className="crumbs__back" onClick={onBack}>
          <ArrowLeft size={15} strokeWidth={1.9} aria-hidden="true" />
          Volver al resumen
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{c.name}</span>
      </nav>

      <header className="analysis__head">
        <div>
          <h1 className="analysis__title detail__title" tabIndex={-1} id="detail-title">
            <CategoryIcon className="detail__icon" name={c.icon} size={22} />
            {c.name}
            {c.archived && <span className="tag">archivada</span>}
          </h1>
          <p className="analysis__subtitle">{subtitle(data)}</p>
        </div>
        {data.sharePct !== null && (
          <span className="detail__share tabular">
            {formatPct(data.sharePct, false)} de tus {kind === "expense" ? "gastos" : "ingresos"}
          </span>
        )}
      </header>

      <section className="kpis" aria-label={`Resumen de ${c.name}`}>
        <div className="kpi">
          <h2 className="kpi__label">
            {kind === "expense" ? "Gasto" : "Ingreso"} en {c.name.toLowerCase()}
          </h2>
          <p className="kpi__value tabular">{formatEuros(data.current.total)}</p>
          <Delta d={totalDelta()} />
        </div>
        <div className="kpi">
          <h2 className="kpi__label">Movimientos</h2>
          <p className="kpi__value tabular">{data.current.count}</p>
          <p className="kpi__delta">{countDelta()}</p>
        </div>
        <div className="kpi">
          <h2 className="kpi__label">Importe medio</h2>
          <p className="kpi__value tabular">{data.current.average !== null ? formatEuros(data.current.average) : "—"}</p>
          <p className="kpi__delta">{averageDelta()}</p>
        </div>
      </section>

      <div className="analysis__grid">
        <div className="detail__left">
          <section className="insight" aria-labelledby="changed-title">
            <h2 className="section-title insight__heading" id="changed-title">
              Qué ha cambiado
            </h2>
            {!data.hasPrevious ? (
              <>
                <h3 className="insight__title">Sin registros para comparar</h3>
                <p className="insight__line">
                  No hay movimientos registrados en {formatRange(data.previousRange.start, data.previousRange.end)}.
                </p>
              </>
            ) : prev && prev.count === 0 ? (
              <>
                <h3 className="insight__title">Sin {noun} previo registrado</h3>
                <p className="insight__line">
                  En {formatRange(data.previousRange.start, data.previousRange.end)} no hay movimientos de esta categoría, así que no se calcula porcentaje.
                </p>
              </>
            ) : data.compare.count === 0 ? (
              <>
                <h3 className="insight__title">Sin movimientos en este periodo</h3>
                <p className="insight__line">
                  En {prevName} se registraron {prev?.count} por {formatEurosShort(prev?.total ?? 0)}.
                </p>
              </>
            ) : (
              <>
                <h3 className="insight__title">{detailHeadline(data)}</h3>
                <p className="insight__line">{detailBody(data)}</p>
                <div className="insight__stats">
                  <p>
                    <strong className="tabular">{data.countChangePct !== null ? formatChangePct(data.countChangePct) : "—"}</strong>
                    <span>en número de movimientos</span>
                  </p>
                  <p>
                    <strong className="tabular">{data.averageChangePct !== null ? formatChangePct(data.averageChangePct) : "—"}</strong>
                    <span>en importe medio</span>
                  </p>
                </div>
              </>
            )}
            <p className="insight__foot">Comparación de registros; no identifica visitas ni precios.</p>
          </section>

          <section className="evolution" aria-labelledby="evolution-title">
            <h2 id="evolution-title" className="section-title">
              Evolución de la categoría
            </h2>
            <ol className="bars">
              {data.evolution.map((e, i) => {
                const current = i === data.evolution.length - 1;
                return (
                  <li key={e.month} className={`bars__item${current ? " is-current" : ""}`}>
                    {/* La cifra va justo encima de su barra; un cero no dibuja barra. */}
                    <span className="bars__track" aria-hidden="true">
                      <span className="bars__value tabular">{formatEurosShort(Math.round(e.total / 100) * 100)}</span>
                      {e.total > 0 && <span className="bars__fill" style={{ height: `${(e.total / maxEvolution) * 80}px` }} />}
                    </span>
                    <span className="bars__month">
                      {monthShort(e.month)}
                      <span className="sr-only">: {formatEuros(e.total)}, {e.count} movimientos</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="analysis__hint">
              {data.evolutionDay ? `Del día 1 al ${data.evolutionDay} de cada mes` : "Meses completos"}
            </p>
          </section>
        </div>

        <section className="movs" aria-labelledby="movs-title">
          <header className="section-head">
            <h2 id="movs-title" className="section-title">
              Los movimientos detrás de la cifra
            </h2>
            <span className="section-aside tabular">{data.movementCount} en total</span>
          </header>
          {data.movementCount === 0 ? (
            <p className="analysis__empty">Sin movimientos en este periodo.</p>
          ) : (
            <table className="mtable">
              <thead>
                <tr>
                  <th scope="col">Concepto</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className="num">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id} className="mtable__row" onClick={() => onEdit(m)}>
                    <th scope="row">
                      <button type="button" className="mtable__open" title="Editar movimiento">
                        <span className="mtable__concept">{m.note || m.categoryName}</span>
                        <Pencil className="mtable__edit" size={13} strokeWidth={1.8} aria-hidden="true" />
                        <span className="sr-only">, editar</span>
                      </button>
                    </th>
                    <td className="tabular mtable__date">{formatShortDate(m.date)}</td>
                    <td className="num tabular">{formatSigned(m.amountCents, m.kind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.movementCount > 0 && (
            <p className="analysis__hint tabular">
              {isSubset
                ? `Mostrando los ${visible.length} últimos · Total visible: ${formatEuros(visibleSum)}`
                : `Todos los movimientos · Total: ${formatEuros(visibleSum)}`}
            </p>
          )}
          {data.movementCount > VISIBLE && (
            <button type="button" className="link-btn" onClick={onToggleAll}>
              {showAll ? `Mostrar solo los ${VISIBLE} últimos` : `Ver los ${data.movementCount} movimientos`}
              {!showAll && <ArrowRight size={14} strokeWidth={1.9} aria-hidden="true" />}
            </button>
          )}
          <p className="analysis__hint">Pulsa un movimiento para corregirlo; las cifras se recalculan al guardar.</p>
        </section>
      </div>
    </div>
  );
}
