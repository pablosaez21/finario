import type { CategoryDetail, Insight, Kind, Metric, PeriodInfo } from "./api";
import { formatChangePct, formatEuros, formatEurosShort, formatPct, formatRange, monthName } from "./format";

export type Tone = "good" | "bad" | "flat" | "none";

/** Más gasto es «bad», más ingreso es «good». El signo y la flecha acompañan siempre al color. */
export function toneFor(kind: Kind, change: number | null): Tone {
  if (change === null) return "none";
  if (change === 0) return "flat";
  return (change > 0) === (kind === "income") ? "good" : "bad";
}

export const arrow = (change: number) => (change > 0 ? "↑" : change < 0 ? "↓" : "");

const noun = (kind: Kind) => (kind === "expense" ? "gasto" : "ingreso");
const plural = (kind: Kind) => (kind === "expense" ? "gastos" : "ingresos");

export function previousName(p: PeriodInfo): string {
  return monthName(p.previousRange.start.slice(0, 7));
}

/** Rótulo del periodo comparado: "agosto" o "1–28 feb" si hay corte. */
export function versus(p: PeriodInfo): string {
  if (p.cutDay) return `${formatRange(p.previousRange.start, p.previousRange.end, false)} (hasta el día ${p.cutDay})`;
  return previousName(p);
}

export interface DeltaText {
  strong?: string;
  rest: string;
  tone: Tone;
}

export function metricDelta(m: Metric, kind: Kind, p: PeriodInfo): DeltaText {
  if (!p.hasPrevious || m.previous === null) return { rest: "Sin registros para comparar", tone: "none" };
  if (m.previous === 0 && m.compare === 0) return { rest: `Sin ${plural(kind)} en ninguno de los dos periodos`, tone: "flat" };
  if (m.previous === 0) return { rest: `Sin ${noun(kind)} previo registrado`, tone: "none" };
  const change = m.change ?? 0;
  if (change === 0) return { rest: `Sin cambio frente a ${versus(p)}`, tone: "flat" };
  const pct = m.changePct !== null ? ` · ${formatChangePct(m.changePct)}` : "";
  return { strong: `${arrow(change)} ${formatEuros(Math.abs(change))}${pct}`, rest: ` frente a ${versus(p)}`, tone: toneFor(kind, change) };
}

export function subtitle(p: PeriodInfo): string {
  const current = `${p.isCurrentMonth ? "Mes en curso · " : ""}${formatRange(p.range.start, p.range.end)}`;
  if (!p.hasPrevious) return `${current} · Sin registros para comparar`;
  if (p.cutDay) {
    return `${current} · Comparación ${formatRange(p.compareRange.start, p.compareRange.end, false)} frente a ${formatRange(p.previousRange.start, p.previousRange.end)}`;
  }
  const previous = formatRange(p.previousRange.start, p.previousRange.end);
  return `${current} · Comparado con ${previous}${p.differentLength ? " · meses de distinta duración" : ""}`;
}

export function footnote(p: PeriodInfo): string {
  if (!p.hasPrevious) return "Sin periodo anterior registrado · Sin estimaciones";
  if (p.isCurrentMonth) return `Comparación hasta el día ${p.compareRange.days} · Sin estimaciones`;
  return `Meses completos${p.differentLength ? " de distinta duración" : ""} · Sin estimaciones`;
}

// ---------- Observaciones ----------

export interface InsightText {
  title: string;
  lines: string[];
  categoryId: string;
}

const eur = formatEurosShort;
const abs = Math.abs;

export function insightText(i: Insight): InsightText {
  const c = i.category;
  const up = i.totalChange > 0;
  const totalLine =
    abs(i.totalChange) < 100
      ? `En total, los ${plural(i.kind)} apenas cambian.`
      : `El total de ${plural(i.kind)} ha ${up ? "subido" : "bajado"} ${eur(abs(i.totalChange))}.`;
  const versusLine = `${eur(c.current)} frente a ${eur(c.previous)}`;

  switch (i.type) {
    case "explains":
      return {
        title: `${c.name} explica el ${formatPct(i.sharePct ?? 0, false).replace(",0\u00a0%", "\u00a0%")} de la ${up ? "subida" : "bajada"}`,
        lines: [`Has registrado ${eur(abs(c.change))} ${c.change > 0 ? "más" : "menos"}: ${versusLine}.`, totalLine],
        categoryId: c.id,
      };
    case "adds_offsets": {
      const verb = c.change > 0 ? "añade" : "resta";
      const title = i.other
        ? `${c.name} ${verb} ${eur(abs(c.change))}; ${i.other.name} compensa ${eur(abs(i.other.change))}`
        : `${c.name} ${verb} ${eur(abs(c.change))}`;
      const lines = [`${c.name}: ${versusLine}.`];
      if (i.other) lines.push(`${i.other.name}: ${eur(i.other.current)} frente a ${eur(i.other.previous)}.`);
      lines.push(totalLine);
      return { title, lines, categoryId: c.id };
    }
    case "offsets":
      return {
        title: `${c.name} compensa ${eur(abs(c.change))}`,
        lines: [`${versusLine}, en sentido contrario al total.`],
        categoryId: c.id,
      };
    case "new":
      return {
        title: `${c.name}: sin ${noun(i.kind)} previo registrado`,
        lines: [`Este periodo suma ${eur(c.current)}. No se calcula porcentaje.`],
        categoryId: c.id,
      };
  }
}

// ---------- Detalle de categoría ----------

export function detailHeadline(d: CategoryDetail): string {
  const count = d.countChange ?? 0;
  const avgPct = d.averageChangePct;
  const avgSimilar = avgPct === null || abs(avgPct) < 10;
  const avgUp = (d.averageChange ?? 0) > 0;
  if (count === 0 && avgSimilar) return "Sin cambios relevantes en número ni importe medio.";
  if (count === 0) return `Los mismos movimientos, con un importe medio ${avgUp ? "mayor" : "menor"}.`;
  const more = count > 0 ? "Más" : "Menos";
  if (avgSimilar) return `${more} movimientos, con un importe medio similar.`;
  if ((count > 0) === avgUp) return `${more} movimientos y un importe medio ${avgUp ? "mayor" : "menor"}.`;
  return `${more} movimientos, con un importe medio ${avgUp ? "mayor" : "menor"}.`;
}

export function detailBody(d: CategoryDetail): string {
  const prev = d.previous!;
  const words = d.category.kind === "expense" ? "gastos registrados" : "ingresos registrados";
  const first = `Has pasado de ${prev.count} a ${d.compare.count} ${words}.`;
  if (prev.average === null || d.compare.average === null) return first;
  return `${first} El importe medio pasa de ${eur(prev.average)} a ${eur(d.compare.average)}.`;
}
