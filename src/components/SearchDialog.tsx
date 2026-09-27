import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChartNoAxesColumn, CornerDownLeft, NotebookPen, Search, X } from "lucide-react";
import Segmented from "./Segmented";
import { api, toAppError, type Category, type Movement, type SearchResults } from "../lib/api";
import { formatShortDate, formatSigned } from "../lib/format";
import { CategoryIcon } from "../lib/icons";
import { trapTab } from "../lib/keyboard";
import type { Tab } from "../screens/Interior";

type Scope = "period" | "all";

interface Props {
  defaultScope: Scope;
  period: { start: string; end: string; label: string };
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  onOpenCategory: (c: Category) => void;
  onOpenMovement: (m: Movement) => void;
}

type Option =
  | { type: "nav"; tab: Tab; label: string; hint: string }
  | { type: "category"; category: Category }
  | { type: "movement"; movement: Movement }
  | { type: "more-movements"; remaining: number }
  | { type: "more-categories"; remaining: number };

const DEBOUNCE = 150;
const CATEGORY_PAGE = 5;
const MOVEMENT_PAGE = 10;

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "period", label: "Este periodo" },
  { value: "all", label: "Todo el historial" },
];

/**
 * Buscador local inspirado en Apple Spotlight de ObsidianUI, adaptado al tema claro de Finario:
 * apertura con opacidad y escala 0,98→1, sin desenfoque obligatorio. Consulta SQLite mediante
 * Rust (sin servicios externos) y descarta respuestas de peticiones obsoletas.
 */
export default function SearchDialog({ defaultScope, period, onClose, onNavigate, onOpenCategory, onOpenMovement }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const navigated = useRef(false);
  const seq = useRef(0);
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [categoryLimit, setCategoryLimit] = useState(CATEGORY_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    opener.current = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => {
      dialog?.close();
      if (!navigated.current) opener.current?.focus?.();
    };
  }, []);

  const trimmed = query.trim();

  const run = useCallback(
    async (opts: { append?: boolean; categoryLimit?: number } = {}) => {
      if (!trimmed) {
        seq.current++;
        setResults(null);
        setLoading(false);
        setError(null);
        return;
      }
      const id = ++seq.current;
      setLoading(true);
      try {
        const res = await api.search({
          query: trimmed,
          start: scope === "period" ? period.start : null,
          end: scope === "period" ? period.end : null,
          categoryLimit: opts.categoryLimit ?? categoryLimit,
          movementLimit: MOVEMENT_PAGE,
          movementOffset: opts.append ? (results?.movements.length ?? 0) : 0,
        });
        if (id !== seq.current) return;
        setResults((prev) =>
          opts.append && prev ? { ...res, movements: [...prev.movements, ...res.movements] } : res,
        );
        setError(null);
        if (!opts.append) setActive(0);
      } catch (err) {
        if (id !== seq.current) return;
        setError(toAppError(err).message);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [trimmed, scope, period.start, period.end, categoryLimit, results?.movements.length],
  );

  // Nueva consulta o alcance: espera breve para no consultar en cada pulsación.
  useEffect(() => {
    setCategoryLimit(CATEGORY_PAGE);
    const t = window.setTimeout(() => run({ categoryLimit: CATEGORY_PAGE }), trimmed ? DEBOUNCE : 0);
    return () => window.clearTimeout(t);
  }, [trimmed, scope]); // run cambia en cada render; solo relanzamos al cambiar consulta o alcance.

  const options: Option[] = useMemo(() => {
    if (!trimmed) {
      return [
        { type: "nav", tab: "analisis", label: "Ir a Análisis", hint: "Resumen, comparaciones y categorías" },
        { type: "nav", tab: "apuntar", label: "Ir a Apuntar", hint: "Registrar un gasto o ingreso" },
      ];
    }
    if (!results) return [];
    const list: Option[] = results.categories.map((category) => ({ type: "category", category }));
    if (results.categoryTotal > results.categories.length)
      list.push({ type: "more-categories", remaining: results.categoryTotal - results.categories.length });
    list.push(...results.movements.map((movement) => ({ type: "movement" as const, movement })));
    if (results.movementTotal > results.movements.length)
      list.push({ type: "more-movements", remaining: results.movementTotal - results.movements.length });
    return list;
  }, [trimmed, results]);

  useEffect(() => {
    if (active >= options.length) setActive(Math.max(0, options.length - 1));
  }, [options.length, active]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (o: Option | undefined) => {
    if (!o) return;
    if (o.type === "more-movements") return void run({ append: true });
    if (o.type === "more-categories") {
      const next = categoryLimit + 20;
      setCategoryLimit(next);
      return void run({ categoryLimit: next });
    }
    navigated.current = true;
    if (o.type === "nav") onNavigate(o.tab);
    else if (o.type === "category") onOpenCategory(o.category);
    else onOpenMovement(o.movement);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active]);
    }
  };

  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const hasQueryResults = !!results && results.categories.length + results.movements.length > 0;
  const noMatches = !!trimmed && !!results && !loading && !error && !hasQueryResults;

  const status = !trimmed
    ? ""
    : error
      ? `Error: ${error}`
      : loading && !results
        ? "Buscando…"
        : noMatches
          ? scope === "period"
            ? "No hay coincidencias en este periodo"
            : "No hay coincidencias"
          : results
            ? `${results.categoryTotal} ${results.categoryTotal === 1 ? "categoría" : "categorías"} y ${results.movementTotal} ${results.movementTotal === 1 ? "movimiento" : "movimientos"}`
            : "";

  const renderOption = (o: Option, i: number) => {
    const common = {
      id: optionId(i),
      role: "option" as const,
      "aria-selected": i === active,
      "data-index": i,
      className: `sp-option${i === active ? " is-active" : ""}`,
      onMouseMove: () => i !== active && setActive(i),
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
      onClick: () => choose(o),
    };
    switch (o.type) {
      case "nav":
        return (
          <li key={o.tab} {...common}>
            <span className="sp-option__icon">
              {o.tab === "analisis" ? <ChartNoAxesColumn size={17} strokeWidth={1.7} /> : <NotebookPen size={17} strokeWidth={1.6} />}
            </span>
            <span className="sp-option__text">
              <span className="sp-option__title">{o.label}</span>
              <span className="sp-option__meta">{o.hint}</span>
            </span>
            <CornerDownLeft className="sp-option__enter" size={14} strokeWidth={1.8} aria-hidden="true" />
          </li>
        );
      case "category":
        return (
          <li key={`c-${o.category.id}`} {...common}>
            <span className="sp-option__icon">
              <CategoryIcon name={o.category.icon} size={17} />
            </span>
            <span className="sp-option__text">
              <span className="sp-option__title">
                {o.category.name}
                {o.category.archived && <span className="tag">archivada</span>}
              </span>
              <span className="sp-option__meta">
                Categoría de {o.category.kind === "expense" ? "gasto" : "ingreso"} · {o.category.movementCount}{" "}
                {o.category.movementCount === 1 ? "movimiento" : "movimientos"}
              </span>
            </span>
            <CornerDownLeft className="sp-option__enter" size={14} strokeWidth={1.8} aria-hidden="true" />
          </li>
        );
      case "movement": {
        const m = o.movement;
        return (
          <li key={`m-${m.id}`} {...common}>
            <span className="sp-option__icon">
              <CategoryIcon name={m.categoryIcon} size={17} />
            </span>
            <span className="sp-option__text">
              <span className="sp-option__title">{m.note || m.categoryName}</span>
              <span className="sp-option__meta">
                {formatShortDate(m.date)} · {m.categoryName}
              </span>
            </span>
            <span className={`sp-option__amount tabular${m.kind === "income" ? " is-income" : ""}`}>
              {formatSigned(m.amountCents, m.kind)}
            </span>
          </li>
        );
      }
      default:
        return (
          <li key={o.type} {...common} className={`${common.className} sp-option--more`}>
            <span className="sp-option__text">
              <span className="sp-option__title">
                {o.type === "more-movements" ? `Cargar más movimientos (${o.remaining})` : `Ver más categorías (${o.remaining})`}
              </span>
            </span>
          </li>
        );
    }
  };

  const firstMovement = options.findIndex((o) => o.type === "movement");
  const groups: { label: string; items: [Option, number][] }[] = [];
  if (!trimmed) groups.push({ label: "Accesos", items: options.map((o, i) => [o, i]) });
  else if (results) {
    const cats = options.map((o, i) => [o, i] as [Option, number]).filter(([o]) => o.type === "category" || o.type === "more-categories");
    const movs = options.map((o, i) => [o, i] as [Option, number]).filter(([o]) => o.type === "movement" || o.type === "more-movements");
    if (cats.length) groups.push({ label: "Categorías", items: cats });
    if (movs.length) groups.push({ label: "Movimientos", items: movs });
  }

  return (
    <dialog
      ref={dialogRef}
      className="spotlight"
      aria-label="Buscar"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      onKeyDown={(e) => trapTab(e, dialogRef.current)}
    >
      <div className="spotlight__panel">
        <div className="spotlight__field">
          <Search className="spotlight__icon" size={19} strokeWidth={1.8} aria-hidden="true" />
          <input
            ref={inputRef}
            className="spotlight__input"
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={`${baseId}-list`}
            aria-activedescendant={options.length ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-label="Buscar categorías o movimientos"
            placeholder="Buscar categorías o movimientos…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {loading && <span className="spotlight__spinner" aria-hidden="true" />}
          <button type="button" className="icon-btn icon-btn--small" onClick={onClose} aria-label="Cerrar buscador">
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <div className="spotlight__scope">
          <Segmented size="sm" label="Alcance de la búsqueda" options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
          <span className="spotlight__range tabular">{scope === "period" ? period.label : "Todos los movimientos registrados"}</span>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>

        <div className="spotlight__results">
          {error ? (
            <div className="spotlight__state" role="alert">
              <p>{error}</p>
              <button type="button" className="btn-ghost btn-ghost--small" onClick={() => run()}>
                Reintentar
              </button>
            </div>
          ) : noMatches ? (
            <div className="spotlight__state">
              <p>{scope === "period" ? "No hay coincidencias en este periodo" : "No hay coincidencias"}</p>
              {scope === "period" && (
                <button type="button" className="btn-ghost btn-ghost--small" onClick={() => setScope("all")}>
                  Buscar en todo el historial
                </button>
              )}
            </div>
          ) : (
            <ul ref={listRef} id={`${baseId}-list`} role="listbox" aria-label="Resultados" className="spotlight__list">
              {groups.map((g) => (
                <li key={g.label} role="presentation" className="spotlight__group">
                  <p className="spotlight__group-label" id={`${baseId}-${g.label}`} aria-hidden="true">
                    {g.label}
                    {g.label === "Movimientos" && results && firstMovement >= 0 && (
                      <span className="tabular"> · {results.movementTotal}</span>
                    )}
                  </p>
                  <ul role="group" aria-labelledby={`${baseId}-${g.label}`}>
                    {g.items.map(([o, i]) => renderOption(o, i))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="spotlight__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> recorrer
          </span>
          <span>
            <kbd>Intro</kbd> abrir
          </span>
          <span>
            <kbd>Esc</kbd> cerrar
          </span>
        </footer>
      </div>
    </dialog>
  );
}
