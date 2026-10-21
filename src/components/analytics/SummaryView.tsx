import { useMemo } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight } from "lucide-react";
import Segmented from "../Segmented";
import CumulativeChart from "./CumulativeChart";
import type { CategoryRow, Kind, Summary } from "../../lib/api";
import { formatBalance, formatChange, formatChangePct, formatEuros, formatMultiple, formatPct, monthName } from "../../lib/format";
import { arrow, insightText, metricDelta, previousName, toneFor, type DeltaText } from "../../lib/analytics";

export type SortKey = "total" | "change" | "pct";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface Props {
  data: Summary;
  kind: Kind;
  sort: SortState;
  onKind: (k: Kind) => void;
  onSort: (s: SortState) => void;
  onOpenCategory: (id: string) => void;
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
];

export function Delta({ d }: { d: DeltaText }) {
  return (
    <p className="kpi__delta">
      {d.strong && <span className={`tone tone--${d.tone}`}>{d.strong}</span>}
      <span className={d.strong ? "" : `tone tone--${d.tone}`}>{d.rest}</span>
    </p>
  );
}

function sortValue(r: CategoryRow, key: SortKey): number | null {
  if (key === "total") return r.total;
  if (key === "change") return r.change;
  return r.changePct;
}

export default function SummaryView({ data, kind, sort, onKind, onSort, onOpenCategory }: Props) {
  const prevName = previousName(data);
  const rows = useMemo(() => {
    const list = data.categories.filter((c) => c.kind === kind);
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va === null && vb === null) return a.name.localeCompare(b.name, "es");
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * dir || b.total - a.total || a.name.localeCompare(b.name, "es");
    });
  }, [data.categories, kind, sort]);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const insights = data.insights.filter((i) => i.kind === kind).map(insightText);
  const series = kind === "expense" ? data.cumulative.expense : data.cumulative.income;
  const currentLabel = monthName(data.month)[0].toUpperCase() + monthName(data.month).slice(1);
  const previousLabel = `${prevName[0].toUpperCase()}${prevName.slice(1)}${data.isCurrentMonth ? " · mismos días" : ""}`;

  // El balance se compara como los ingresos: subir es bueno. Debajo, qué parte de lo ingresado queda.
  const balanceDelta = (): DeltaText => {
    if (!data.hasPrevious || data.balanceChange === null) return { rest: "Sin registros para comparar", tone: "none" };
    const c = data.balanceChange;
    if (c === 0) return { rest: `Igual que en ${prevName}`, tone: "flat" };
    return { strong: `${arrow(c)} ${formatEuros(Math.abs(c))}`, rest: ` frente a ${prevName}`, tone: toneFor("income", c) };
  };

  const retainedLine = () => {
    const r = data.retainedPct;
    if (r === null) return "Sin ingresos registrados";
    if (r >= 0) return `Conservas el ${formatPct(r, false)} de lo ingresado`;
    // Con gastos de más del doble de lo ingresado, «veces» se lee mejor que «350.867 % más».
    return r >= -100 ? `${formatPct(-r, false)} más gasto que ingreso` : `Gastos ${formatMultiple(1 - r / 100).slice(1)} veces los ingresos`;
  };

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const Icon = active && sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th scope="col" className="num" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className={`sort${active ? " is-active" : ""}`}
          onClick={() => onSort({ key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
          aria-label={`Ordenar por ${label.toLowerCase()}`}
        >
          {label}
          <Icon size={12} strokeWidth={2} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const orderLabel =
    sort.key === "total"
      ? sort.dir === "desc" ? `mayor ${kind === "expense" ? "gasto" : "ingreso"}` : `menor ${kind === "expense" ? "gasto" : "ingreso"}`
      : sort.key === "change"
        ? sort.dir === "desc" ? "mayor cambio en euros" : "menor cambio en euros"
        : sort.dir === "desc" ? "mayor cambio porcentual" : "menor cambio porcentual";

  return (
    <>
      <section className="kpis" aria-label="Resumen del periodo">
        <div className="kpi">
          <h2 className="kpi__label">Gastos registrados</h2>
          <p className="kpi__value tabular">{formatEuros(data.expense.total)}</p>
          <Delta d={metricDelta(data.expense, "expense", data)} />
        </div>
        <div className="kpi">
          <h2 className="kpi__label">Ingresos registrados</h2>
          <p className="kpi__value tabular">{formatEuros(data.income.total)}</p>
          <Delta d={metricDelta(data.income, "income", data)} />
        </div>
        <div className="kpi">
          <h2 className="kpi__label">Balance del periodo</h2>
          <p className="kpi__value tabular">{formatBalance(data.balance)}</p>
          <Delta d={balanceDelta()} />
          <p className="kpi__delta">{retainedLine()}</p>
        </div>
      </section>
      {data.futureExcluded > 0 && (
        <p className="analysis__note">
          {data.futureExcluded === 1 ? "1 movimiento con fecha futura no se incluye" : `${data.futureExcluded} movimientos con fecha futura no se incluyen`} hasta que llegue su día.
        </p>
      )}

      <div key={kind} className="analysis__grid fade-in">
        <section className="breakdown" aria-labelledby="breakdown-title">
          <header className="section-head">
            <h2 id="breakdown-title" className="section-title">
              {kind === "expense" ? "En qué se va tu dinero" : "De dónde llega tu dinero"}
            </h2>
            <Segmented size="sm" label="Tipo de movimiento" options={KIND_OPTIONS} value={kind} onChange={onKind} />
          </header>

          {rows.length === 0 ? (
            <p className="analysis__empty">Sin {kind === "expense" ? "gastos" : "ingresos"} registrados en este periodo.</p>
          ) : (
            <table className="ctable">
              <caption className="sr-only">
                {kind === "expense" ? "Gastos" : "Ingresos"} por categoría. Orden: {orderLabel}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  {header("total", "Este periodo")}
                  {header("change", "Cambio €")}
                  {header("pct", "Cambio %")}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Un cambio desde cero no es una señal: se escribe en gris (la columna % ya dice «Sin … previo»).
                  const tone = r.previous === 0 ? "none" : toneFor(kind, r.change);
                  return (
                    // La fila entera abre el detalle con el ratón; el botón (Tab + Intro) es el control real
                    // y su clic llega a la fila por propagación.
                    <tr key={r.id} className="ctable__row" data-row-id={r.id} onClick={() => onOpenCategory(r.id)}>
                      <th scope="row" className="ctable__name">
                        <button type="button" className="ctable__open">
                          <span className="ctable__label">
                            {r.name}
                            <ArrowUpRight className="ctable__go" size={14} strokeWidth={1.8} aria-hidden="true" />
                          </span>
                          {r.archived && <span className="tag">archivada</span>}
                          <span className="sr-only">, ver movimientos</span>
                        </button>
                        <span className="ctable__bar" style={{ width: `${(r.total / maxTotal) * 100}%` }} aria-hidden="true" />
                      </th>
                      <td className="num tabular">{formatEuros(r.total)}</td>
                      <td className={`num tabular tone tone--${tone}`}>
                        {r.change === null ? "—" : r.change === 0 ? <span className="muted-cell">Sin cambio</span> : formatChange(r.change)}
                      </td>
                      <td className={`num tabular tone tone--${tone}`}>
                        {r.changePct !== null ? (
                          formatChangePct(r.changePct)
                        ) : r.previous === 0 && r.change !== null ? (
                          <span className="muted-cell">Sin {kind === "expense" ? "gasto" : "ingreso"} previo</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="analysis__hint">
            Orden: {orderLabel} · Pulsa una categoría para ver sus movimientos.
          </p>
        </section>

        <section className="trend" aria-labelledby="trend-title">
          <header className="section-head">
            <h2 id="trend-title" className="section-title">
              Cómo avanza el {kind === "expense" ? "gasto" : "ingreso"}
            </h2>
            <span className="section-aside">Acumulado</span>
          </header>
          <CumulativeChart series={series} currentLabel={currentLabel} previousLabel={previousLabel} />

          {insights.length > 0 ? (
            <div className="insight">
              {insights.map((t, i) => (
                <div key={`${t.categoryId}-${i}`} className={i === 0 ? "insight__main" : "insight__more"}>
                  <h3 className="insight__title">{t.title}</h3>
                  {t.lines.map((l) => (
                    <p key={l} className="insight__line">
                      {l}
                    </p>
                  ))}
                  {i === 0 && (
                    <button type="button" className="link-btn" onClick={() => onOpenCategory(t.categoryId)}>
                      Ver qué ha cambiado
                      <ArrowRight size={14} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="insight insight--quiet">
              <p className="insight__line">
                {!data.hasPrevious
                  ? "Sin registros para comparar: las observaciones aparecerán cuando haya un periodo anterior registrado."
                  : "Sin cambios relevantes que destacar frente al periodo anterior."}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
