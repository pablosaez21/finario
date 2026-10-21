import { useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import Dialog from "./Dialog";
import Segmented from "./Segmented";
import { api, toAppError, type Category, type Kind } from "../lib/api";
import { CATEGORY_ICONS, CategoryIcon } from "../lib/icons";

interface Props {
  categories: Category[];
  onChanged: (next: Category[]) => void;
  onClose: () => void;
}

const ICON_KEYS = Object.keys(CATEGORY_ICONS);

export default function CategoriesDialog({ categories, onChanged, onClose }: Props) {
  const [kind, setKind] = useState<Kind>("expense");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ofKind = categories.filter((c) => c.kind === kind);
  const active = ofKind.filter((c) => !c.archived);
  const archived = ofKind.filter((c) => c.archived);

  /** Devuelve si la operación terminó bien (el editor solo se vacía entonces). */
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(toAppError(err).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => onChanged(await api.listCategories(true));

  const move = (index: number, delta: number) =>
    run(async () => {
      const ids = active.map((c) => c.id);
      const [item] = ids.splice(index, 1);
      ids.splice(index + delta, 0, item);
      onChanged(await api.reorderCategories(kind, ids));
    });

  return (
    <Dialog
      title="Categorías"
      description="Catálogo provisional. Renombrar o archivar no altera los movimientos ya registrados."
      onClose={onClose}
    >
      <Segmented
        label="Tipo de categoría"
        options={[
          { value: "expense" as Kind, label: "Gastos" },
          { value: "income" as Kind, label: "Ingresos" },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setEditingId(null);
          setError(null);
        }}
      />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <ul className="cat-list">
        {active.map((c, i) =>
          editingId === c.id ? (
            <li key={c.id} className="cat-item is-editing">
              <CategoryEditor
                initialName={c.name}
                initialIcon={c.icon}
                submitLabel="Guardar"
                busy={busy}
                onCancel={() => setEditingId(null)}
                onSubmit={(name, icon) =>
                  run(async () => {
                    await api.updateCategory(c.id, name, icon);
                    await refresh();
                    setEditingId(null);
                  })
                }
              />
            </li>
          ) : (
            <li key={c.id} className="cat-item">
              <span className="cat-item__icon">
                <CategoryIcon name={c.icon} size={16} />
              </span>
              <span className="cat-item__name" title={c.name}>{c.name}</span>
              <span className="cat-item__count tabular">
                {c.movementCount > 0 ? `${c.movementCount} ${c.movementCount === 1 ? "movimiento" : "movimientos"}` : "Sin uso"}
              </span>
              <span className="cat-item__actions">
                <button type="button" className="icon-btn icon-btn--small" onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={`Subir ${c.name}`} title="Subir">
                  <ChevronUp size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn icon-btn--small" onClick={() => move(i, 1)} disabled={i === active.length - 1 || busy} aria-label={`Bajar ${c.name}`} title="Bajar">
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn icon-btn--small" onClick={() => setEditingId(c.id)} aria-label={`Editar ${c.name}`} title="Renombrar o cambiar icono">
                  <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--small"
                  onClick={() =>
                    run(async () => {
                      await api.setCategoryArchived(c.id, true);
                      await refresh();
                    })
                  }
                  disabled={busy}
                  aria-label={`Archivar ${c.name}`}
                  title="Archivar (conserva su historial)"
                >
                  <Archive size={15} strokeWidth={1.7} aria-hidden="true" />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      <div className="cat-new">
        <h3 className="cat-section">Nueva categoría</h3>
        <CategoryEditor
          key={kind}
          initialName=""
          initialIcon="circle-ellipsis"
          submitLabel="Añadir"
          busy={busy}
          resetOnSubmit
          onSubmit={(name, icon) =>
            run(async () => {
              await api.createCategory(kind, name, icon);
              await refresh();
            })
          }
        />
      </div>

      {archived.length > 0 && (
        <details className="cat-archived">
          <summary>Archivadas ({archived.length})</summary>
          <ul className="cat-list">
            {archived.map((c) => (
              <li key={c.id} className="cat-item is-archived">
                <span className="cat-item__icon">
                  <CategoryIcon name={c.icon} size={16} />
                </span>
                <span className="cat-item__name" title={c.name}>{c.name}</span>
                <span className="cat-item__count tabular">
                  {c.movementCount} {c.movementCount === 1 ? "movimiento" : "movimientos"}
                </span>
                <span className="cat-item__actions">
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--small"
                    onClick={() =>
                      run(async () => {
                        await api.setCategoryArchived(c.id, false);
                        await refresh();
                      })
                    }
                    disabled={busy}
                  >
                    <ArchiveRestore size={15} strokeWidth={1.7} aria-hidden="true" />
                    Recuperar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Dialog>
  );
}

interface EditorProps {
  initialName: string;
  initialIcon: string;
  submitLabel: string;
  busy: boolean;
  resetOnSubmit?: boolean;
  onSubmit: (name: string, icon: string) => Promise<boolean | void> | void;
  onCancel?: () => void;
}

function CategoryEditor({ initialName, initialIcon, submitLabel, busy, resetOnSubmit, onSubmit, onCancel }: EditorProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [pickerOpen, setPickerOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await onSubmit(name, icon);
    if (resetOnSubmit && ok !== false) {
      setName("");
      setIcon(initialIcon);
      setPickerOpen(false);
    }
  };

  return (
    <form
      className="cat-editor"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="cat-editor__row">
        <button
          type="button"
          className="cat-editor__icon"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          aria-label="Elegir icono"
          title="Elegir icono"
        >
          <CategoryIcon name={icon} size={17} />
        </button>
        <input
          className="input"
          value={name}
          maxLength={40}
          placeholder="Nombre de la categoría"
          aria-label="Nombre de la categoría"
          autoFocus={!!onCancel}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={busy || !name.trim()}>
          {submitLabel === "Añadir" && <Plus size={15} strokeWidth={2} aria-hidden="true" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {pickerOpen && (
        <div className="icon-grid" role="group" aria-label="Iconos">
          {ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="icon-grid__item"
              aria-pressed={icon === key}
              aria-label={key}
              onClick={() => {
                setIcon(key);
                setPickerOpen(false);
              }}
            >
              <CategoryIcon name={key} size={17} />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
