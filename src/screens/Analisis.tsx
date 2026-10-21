import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import SummaryView, { type SortState } from "../components/analytics/SummaryView";
import DetailView from "../components/analytics/DetailView";
import { api, toAppError, type CategoryDetail, type Kind, type Movement, type Summary } from "../lib/api";
import { addMonths, currentMonth, monthLabel } from "../lib/format";
import { footnote, subtitle } from "../lib/analytics";

export interface AnalysisNav {
  month: string;
  kind: Kind;
  sort: SortState;
  detailId: string | null;
  showAll: boolean;
}

interface Props {
  active: boolean;
  version: number;
  nav: AnalysisNav;
  setNav: Dispatch<SetStateAction<AnalysisNav>>;
  onEditMovement: (m: Movement) => void;
  onGoApuntar: () => void;
  onFootnote: (text: string) => void;
}

interface Loaded<T> {
  key: string;
  data: T;
}

/**
 * Carga con descarte de respuestas obsoletas: solo se aplica la respuesta de la última petición.
 * Mientras la clave pedida no coincide con la cargada, la vista muestra un estado de carga en
 * lugar de cifras antiguas bajo una fecha nueva.
 */
function useLatest<T>(key: string | null, enabled: boolean, load: () => Promise<T>) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    if (!key) return;
    const id = ++seq.current;
    loadRef
      .current()
      .then((data) => {
        if (id !== seq.current) return;
        setLoaded({ key, data });
        setError(null);
      })
      .catch((err) => {
        if (id !== seq.current) return;
        setError({ key, message: toAppError(err).message });
      });
  }, [key]);

  useEffect(() => {
    if (enabled) run();
  }, [enabled, run]);

  return { loaded, error: error && error.key === key ? error.message : null, retry: run };
}

export default function Analisis({ active, version, nav, setNav, onEditMovement, onGoApuntar, onFootnote }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const summaryScroll = useRef(0);
  const returnTo = useRef<string | null>(null);
  const pendingFocus = useRef<"row" | "detail" | null>(null);
  const thisMonth = currentMonth();

  const summaryKey = `${nav.month}|${version}`;
  const summary = useLatest<Summary>(summaryKey, active, () => api.analyticsSummary(nav.month));
  const detailKey = nav.detailId ? `${nav.detailId}|${nav.month}|${nav.showAll}|${version}` : null;
  const detail = useLatest<CategoryDetail>(detailKey, active && !!nav.detailId, () =>
    api.categoryDetail(nav.detailId!, nav.month, nav.showAll ? 1000 : 5),
  );

  // Cifras visibles solo si corresponden al periodo pedido (ediciones posteriores no invalidan).
  const summaryData = summary.loaded && summary.loaded.data.month === nav.month ? summary.loaded.data : null;
  const detailData =
    detail.loaded && nav.detailId && detail.loaded.data.category.id === nav.detailId && detail.loaded.data.month === nav.month
      ? detail.loaded.data
      : null;

  useEffect(() => {
    if (summaryData) onFootnote(footnote(summaryData));
  }, [summaryData, onFootnote]);

  const openCategory = (id: string) => {
    summaryScroll.current = scrollRef.current?.scrollTop ?? 0;
    returnTo.current = id;
    pendingFocus.current = "detail";
    setNav((n) => ({ ...n, detailId: id, showAll: false }));
  };

  const back = () => {
    pendingFocus.current = "row";
    setNav((n) => ({ ...n, detailId: null, showAll: false }));
  };

  // Al entrar en el detalle: arriba y foco en el título. Al volver: scroll y foco en la fila de origen.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nav.detailId && detailData && pendingFocus.current === "detail") {
      pendingFocus.current = null;
      el.scrollTop = 0;
      document.getElementById("detail-title")?.focus({ preventScroll: true });
    } else if (!nav.detailId && summaryData && pendingFocus.current === "row") {
      pendingFocus.current = null;
      el.scrollTop = summaryScroll.current;
      const row = returnTo.current && el.querySelector<HTMLElement>(`[data-row-id="${returnTo.current}"] .ctable__open`);
      (row || document.getElementById("analysis-title"))?.focus({ preventScroll: true });
    }
  }, [nav.detailId, detailData, summaryData]);

  // Entrar desde el buscador: foco en el detalle cuando cargue y, al volver, en su fila.
  useEffect(() => {
    if (nav.detailId && pendingFocus.current === null) {
      pendingFocus.current = "detail";
      returnTo.current = nav.detailId;
    }
  }, [nav.detailId]);

  const setMonth = (month: string) => setNav((n) => ({ ...n, month }));
  const minMonth = summary.loaded?.data.firstMonth && summary.loaded.data.firstMonth < thisMonth ? summary.loaded.data.firstMonth : thisMonth;
  const canPrev = nav.month > minMonth;
  const canNext = nav.month < thisMonth;
  const noData = summary.loaded?.data.firstMonth === null && summary.loaded.data.month === nav.month;

  const monthNav = (
    <div className="period" role="group" aria-label="Cambiar de mes">
      <button type="button" className="icon-btn period__btn" onClick={() => setMonth(addMonths(nav.month, -1))} disabled={!canPrev} aria-label="Mes anterior" title="Mes anterior">
        <ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn period__btn" onClick={() => setMonth(addMonths(nav.month, 1))} disabled={!canNext} aria-label="Mes siguiente" title="Mes siguiente">
        <ChevronRight size={18} strokeWidth={1.9} aria-hidden="true" />
      </button>
    </div>
  );

  const errorBox = (message: string, retry: () => void) => (
    <div className="analysis__error" role="alert">
      <p>No se han podido calcular las analíticas.</p>
      <p className="analysis__subtitle">{message}</p>
      <button type="button" className="btn-ghost btn-ghost--small" onClick={retry}>
        Reintentar
      </button>
    </div>
  );

  let body;
  if (nav.detailId) {
    body = detail.error ? (
      errorBox(detail.error, detail.retry)
    ) : detailData ? (
      <div key={`${detailData.category.id}|${detailData.month}`} className="view-enter">
        <DetailView
          data={detailData}
          showAll={nav.showAll}
          onBack={back}
          onToggleAll={() => setNav((n) => ({ ...n, showAll: !n.showAll }))}
          onEdit={onEditMovement}
        />
      </div>
    ) : (
      <Skeleton />
    );
  } else if (summary.error) {
    body = errorBox(summary.error, summary.retry);
  } else if (noData) {
    body = (
      <div className="analysis__blank">
        <span className="empty__icon" aria-hidden="true">
          <NotebookPen size={20} strokeWidth={1.5} />
        </span>
        <h1 className="analysis__title" id="analysis-title" tabIndex={-1}>
          Todavía no hay movimientos que analizar
        </h1>
        <p className="analysis__subtitle">Cuando registres gastos e ingresos, aquí verás en qué se va tu dinero y qué ha cambiado.</p>
        <button type="button" className="btn-primary" onClick={onGoApuntar}>
          Apuntar el primero
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <header className="analysis__head">
          <div>
            <div className="analysis__titlerow">
              <h1 className="analysis__title" id="analysis-title" tabIndex={-1} aria-live="polite">
                {monthLabel(nav.month)}
              </h1>
              {monthNav}
            </div>
            <p className="analysis__subtitle">{summaryData ? subtitle(summaryData) : "Calculando…"}</p>
          </div>
          {nav.month !== thisMonth && (
            <button type="button" className="btn-secondary" onClick={() => setMonth(thisMonth)}>
              Ir al mes en curso
            </button>
          )}
        </header>
        {summaryData ? (
          <div key={summaryData.month} className="fade-in">
            <SummaryView
              data={summaryData}
              kind={nav.kind}
              sort={nav.sort}
              onKind={(kind) => setNav((n) => ({ ...n, kind }))}
              onSort={(sort) => setNav((n) => ({ ...n, sort }))}
              onOpenCategory={openCategory}
            />
          </div>
        ) : (
          <Skeleton />
        )}
      </>
    );
  }

  return (
    <div ref={scrollRef} className="analysis" aria-busy={nav.detailId ? !detailData : !summaryData}>
      <div className="analysis__inner">{body}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" role="status">
      <span className="sr-only">Cargando…</span>
      <div className="skeleton__row">
        <span />
        <span />
        <span />
      </div>
      <div className="skeleton__block" />
    </div>
  );
}
