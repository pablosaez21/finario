import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DatabaseBackup, House, Search, Tags } from "lucide-react";
import Toast, { type ToastData } from "../components/Toast";
import CategoriesDialog from "../components/CategoriesDialog";
import BackupsDialog from "../components/BackupsDialog";
import SearchDialog from "../components/SearchDialog";
import EditMovementDialog from "../components/EditMovementDialog";
import Apuntar from "./Apuntar";
import Analisis, { type AnalysisNav } from "./Analisis";
import { api, movementToInput, toAppError, type BackupFile, type Category, type Movement } from "../lib/api";
import { currentMonth, formatDateTime, formatRange, formatSigned, isMac, monthRange } from "../lib/format";
import { useSlidingIndicator } from "../lib/useSlidingIndicator";
import "../styles/registro.css";
import "../styles/analisis.css";

export type Tab = "apuntar" | "analisis";
export type Notify = (t: Omit<ToastData, "id">) => void;
export type Undoable = (label: string, detail: string, undo: () => Promise<unknown>) => void;

interface Props {
  initialTab: Tab;
  onHome: () => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "apuntar", label: "Apuntar" },
  { key: "analisis", label: "Análisis" },
];

export default function Interior({ initialTab, onHome }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [categories, setCategories] = useState<Category[]>([]);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [dialog, setDialog] = useState<"categorias" | "copias" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editMovement, setEditMovement] = useState<Movement | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupFile | null>(null);
  const [restoreKey, setRestoreKey] = useState(0);
  const [footnote, setFootnote] = useState("Sin estimaciones");
  const [nav, setNav] = useState<AnalysisNav>(() => ({
    month: currentMonth(),
    kind: "expense",
    sort: { key: "total", dir: "desc" },
    detailId: null,
    showAll: false,
  }));
  const toastSeq = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { style: indicatorStyle, ready: indicatorReady } = useSlidingIndicator(tabsRef, tab);

  const notify: Notify = useCallback((t) => setToast({ ...t, id: ++toastSeq.current }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const undoable: Undoable = useCallback(
    (label, detail, undo) =>
      notify({
        message: label,
        detail,
        undo: async () => {
          try {
            await undo();
            bump();
            notify({ tone: "info", message: "Cambio deshecho." });
          } catch (err) {
            notify({ tone: "error", message: `No se pudo deshacer. ${toAppError(err).message}` });
          }
        },
      }),
    [notify, bump],
  );

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await api.listCategories(true));
    } catch (err) {
      notify({ tone: "error", message: `No se han podido cargar las categorías. ${toAppError(err).message}` });
    }
  }, [notify]);

  const loadBackupInfo = useCallback(async () => {
    try {
      setLastBackup((await api.backupInfo()).backups[0] ?? null);
    } catch {
      setLastBackup(null);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadBackupInfo();
  }, [loadCategories, loadBackupInfo]);

  const anyModal = dialog !== null || editMovement !== null || searchOpen;

  // Cmd+K (macOS) / Ctrl+K abre el buscador, salvo con otro diálogo abierto.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!anyModal) setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModal]);

  const selectTab = (next: Tab, focusTab = false) => {
    setTab(next);
    if (focusTab) requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const index = TABS.findIndex((t) => t.key === tab);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[next].key, true);
  };

  const period = monthRange(nav.month);

  return (
    <div className="registro">
      <header className="head">
        <p className="head__brand">Finario</p>
        <div className="head__actions">
          <button type="button" className="head__search" onClick={() => setSearchOpen(true)} aria-keyshortcuts={isMac() ? "Meta+K" : "Control+K"}>
            <Search size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Buscar…</span>
            <kbd aria-hidden="true">{isMac() ? "⌘K" : "Ctrl K"}</kbd>
          </button>
          <button type="button" className="head__home" onClick={onHome}>
            <House size={16} strokeWidth={1.7} aria-hidden="true" />
            Inicio
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones">
        <div ref={tabsRef} className={`tabs__list${indicatorReady ? " is-ready" : ""}`} role="tablist" aria-label="Secciones" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              data-key={t.key}
              type="button"
              role="tab"
              className="tabs__item"
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => selectTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <span className="tabs__indicator" style={indicatorStyle} aria-hidden="true" />
        </div>
        <div className="tabs__tools">
          <button type="button" className="tool" onClick={() => setDialog("categorias")}>
            <Tags size={16} strokeWidth={1.6} aria-hidden="true" />
            Categorías
          </button>
          <button type="button" className="tool" onClick={() => setDialog("copias")}>
            <DatabaseBackup size={16} strokeWidth={1.6} aria-hidden="true" />
            Copias de seguridad
          </button>
        </div>
      </nav>

      <div className="panels">
        {/* Ambas vistas permanecen montadas: cambiar de pestaña no pierde un formulario a medias
            ni el periodo, orden o scroll del análisis. */}
        <section id="panel-apuntar" role="tabpanel" aria-labelledby="tab-apuntar" className="panel" hidden={tab !== "apuntar"}>
          <Apuntar key={restoreKey} categories={categories} version={version} onChanged={bump} notify={notify} undoable={undoable} />
        </section>
        <section id="panel-analisis" role="tabpanel" aria-labelledby="tab-analisis" className="panel" hidden={tab !== "analisis"}>
          <Analisis
            active={tab === "analisis"}
            version={version}
            nav={nav}
            setNav={setNav}
            onEditMovement={setEditMovement}
            onGoApuntar={() => selectTab("apuntar", true)}
            onFootnote={setFootnote}
          />
        </section>
      </div>

      <footer className="foot">
        {tab === "apuntar" ? (
          <>
            <span>Datos guardados solo en este equipo</span>
            <button type="button" className="foot__link" onClick={() => setDialog("copias")}>
              {lastBackup ? `Última copia: ${formatDateTime(lastBackup.created)}` : "Sin copias todavía"}
            </button>
          </>
        ) : (
          <>
            <span>Solo movimientos registrados · Balance ≠ saldo bancario</span>
            <span>{footnote}</span>
          </>
        )}
      </footer>

      <Toast toast={toast} onClose={closeToast} />

      {searchOpen && (
        <SearchDialog
          defaultScope={tab === "analisis" ? "period" : "all"}
          period={{ ...period, label: formatRange(period.start, period.end) }}
          onClose={() => setSearchOpen(false)}
          onNavigate={(next) => {
            setSearchOpen(false);
            if (next === "analisis") setNav((n) => ({ ...n, detailId: null }));
            selectTab(next, true);
          }}
          onOpenCategory={(c) => {
            setSearchOpen(false);
            setNav((n) => ({ ...n, kind: c.kind, detailId: c.id, showAll: false }));
            setTab("analisis");
          }}
          onOpenMovement={(m) => {
            setSearchOpen(false);
            setEditMovement(m);
          }}
        />
      )}

      {editMovement && (
        <EditMovementDialog
          movement={editMovement}
          categories={categories}
          onClose={() => setEditMovement(null)}
          onSaved={(saved, previous) => {
            setEditMovement(null);
            bump();
            undoable("Cambios guardados", `${formatSigned(saved.amountCents, saved.kind)} · ${saved.categoryName}`, () =>
              api.updateMovement(previous.id, movementToInput(previous)),
            );
          }}
        />
      )}

      {dialog === "categorias" && (
        <CategoriesDialog
          categories={categories}
          onChanged={setCategories}
          onClose={() => {
            setDialog(null);
            bump();
          }}
        />
      )}
      {dialog === "copias" && (
        <BackupsDialog
          onClose={() => setDialog(null)}
          onBackupCreated={loadBackupInfo}
          onRestored={async (safety) => {
            setDialog(null);
            setRestoreKey((k) => k + 1);
            setNav((n) => ({ ...n, detailId: null }));
            await Promise.all([loadCategories(), loadBackupInfo()]);
            bump();
            notify({ tone: "info", message: "Datos restaurados.", detail: `Copia previa: ${safety.fileName}` });
          }}
        />
      )}
    </div>
  );
}
