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

/** Céntimos a texto editable con coma decimal: 1250 → "12,50". */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${(cents % 100).toString().padStart(2, "0")}`;
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

export function relativeDay(iso: string): string | null {
  const today = todayISO();
  if (iso === today) return "Hoy";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  return iso === yesterday ? "Ayer" : null;
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

export function newId(): string {
  return crypto.randomUUID();
}
