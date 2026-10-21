import type { Kind } from "./api";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Formatea céntimos enteros como "1.234,56 €" sin pasar por coma flotante. */
export function formatEuros(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rest = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${euros},${rest}\u00a0€`;
}

export function formatSigned(cents: number, kind: Kind): string {
  return `${kind === "expense" ? "−" : "+"}${formatEuros(cents)}`;
}

/** Céntimos a texto editable con coma decimal y miles con punto: 24999999 → "249.999,99". */
export function centsToInput(cents: number): string {
  const euros = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${euros},${(cents % 100).toString().padStart(2, "0")}`;
}

/** Fecha local de hoy como YYYY-MM-DD (sin convertir a UTC). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "26 sep" (o "26 sep 2025" si no es el año en curso). */
export function formatShortDate(iso: string): string {
  const { y, m, d } = parts(iso);
  const sameYear = y === new Date().getFullYear();
  return `${d} ${MONTHS[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

export function formatLongDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
}

export function yesterdayISO(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
}

export function relativeDay(iso: string): string | null {
  if (iso === todayISO()) return "Hoy";
  return iso === yesterdayISO() ? "Ayer" : null;
}

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Encabezado de un día en la lista: "Hoy", "Ayer" o "Domingo, 19 oct". */
export function formatDayHeading(iso: string): string {
  const relative = relativeDay(iso);
  if (relative) return relative;
  const { y, m, d } = parts(iso);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${formatShortDate(iso)}`;
}

/** "2026-09-26T10:15:00" (hora local) → "26 sep 2026, 10:15". */
export function formatDateTime(local: string): string {
  const [date, time = ""] = local.split("T");
  const { y, m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}, ${time.slice(0, 5)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Importe sin céntimos cuando son cero: 7200 → "72 €", 7250 → "72,50 €". */
export function formatEurosShort(cents: number): string {
  return Math.abs(cents) % 100 === 0 ? formatEuros(cents).replace(",00", "") : formatEuros(cents);
}

/** Cambio con signo explícito: "+18,00 €", "−6,00 €". */
export function formatChange(cents: number): string {
  return cents > 0 ? `+${formatEuros(cents)}` : formatEuros(cents);
}

/** Número con separador de miles y coma decimal: 14552.04 → "14.552,0". */
export function formatNumber(value: number, decimals: number): string {
  const [int, dec] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec ? `${grouped},${dec}` : grouped;
}

export function formatPct(value: number, signed = true): string {
  const sign = signed && value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(value, 1)}\u00a0%`;
}

/** Cuántas veces: "×3,5", "×37" o "×14.552" (sin decimales a partir de 100). */
export function formatMultiple(times: number): string {
  return `×${formatNumber(times, times < 100 ? 1 : 0)}`;
}

/**
 * Cambio porcentual legible. Desde una base muy pequeña (+3.608 %) el porcentaje no se lee:
 * a partir de +1.000 % se expresa como múltiplo ("×37,1").
 */
export function formatChangePct(value: number): string {
  if (value >= 1000) return formatMultiple(1 + value / 100);
  return formatPct(value);
}

export function formatBalance(cents: number): string {
  return cents > 0 ? `+${formatEuros(cents)}` : formatEuros(cents);
}

// ---------- Meses ----------

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Rango del periodo mensual: hasta hoy en el mes en curso, completo en meses cerrados. */
export function monthRange(month: string): { start: string; end: string } {
  const today = todayISO();
  const end = month === today.slice(0, 7) ? today : `${month}-${String(lastDayOf(month)).padStart(2, "0")}`;
  return { start: `${month}-01`, end };
}

export function monthName(month: string): string {
  return MONTHS_LONG[Number(month.slice(5, 7)) - 1];
}

export function monthLabel(month: string): string {
  const name = monthName(month);
  return `${name[0].toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

export function monthShort(month: string): string {
  const s = MONTHS[Number(month.slice(5, 7)) - 1];
  return s[0].toUpperCase() + s.slice(1);
}

/** "1–27 sep 2026" (o "28 feb – 3 mar 2026" si cruza meses). */
export function formatRange(start: string, end: string, withYear = true): string {
  const a = parts(start);
  const b = parts(end);
  const year = withYear ? ` ${b.y}` : "";
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m - 1]}${year}`;
  return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}${year}`;
}

export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function newId(): string {
  return crypto.randomUUID();
}
