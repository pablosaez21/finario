import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { api, toAppError, type AppError, type Category, type Kind, type Movement, type MovementInput } from "../lib/api";
import { centsToInput, newId, todayISO, yesterdayISO } from "../lib/format";
import { CategoryIcon } from "../lib/icons";
import Segmented from "./Segmented";

type Field = "amount" | "category" | "date" | "note";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
];

interface Props {
  categories: Category[];
  editing: Movement | null;
  onSaved: (saved: Movement, previous: Movement | null) => void;
  onCancelEdit: () => void;
}

const NOTE_MAX = 120;

export default function MovementForm({ categories, editing, onSaved, onCancelEdit }: Props) {
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO);
  // Fecha «de hoy» sin tocar: sigue siendo hoy aunque la app pase la medianoche abierta.
  const [dateIsToday, setDateIsToday] = useState(true);
  const [note, setNote] = useState("");
  // Tipo y categoría del registro nuevo, guardados al entrar a editar para recuperarlos al salir.
  const draft = useRef<{ kind: Kind; categoryId: string | null } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingId = useRef(newId());
  const amountRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  useEffect(() => {
    setErrors({});
    setFormError(null);
    if (editing) {
      if (!draft.current) draft.current = { kind, categoryId };
      setKind(editing.kind);
      setAmount(centsToInput(editing.amountCents));
      setCategoryId(editing.categoryId);
      setDate(editing.date);
      setDateIsToday(false);
      setNote(editing.note ?? "");
    } else {
      if (draft.current) {
        setKind(draft.current.kind);
        setCategoryId(draft.current.categoryId);
        draft.current = null;
      }
      setAmount("");
      setNote("");
      setDate(todayISO());
      setDateIsToday(true);
    }
    amountRef.current?.focus();
    if (editing) amountRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!dateIsToday) return;
    const refresh = () => setDate(todayISO());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [dateIsToday]);

  const pickDate = (value: string) => {
    setDate(value);
    setDateIsToday(value === todayISO());
    clearError("date");
  };

  const visible = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.archived || (editing && c.id === editing.categoryId))),
    [categories, kind, editing],
  );

  useEffect(() => {
    if (categoryId && !visible.some((c) => c.id === categoryId)) setCategoryId(null);
  }, [visible, categoryId]);

  const clearError = (field: Field) => {
    if (errors[field]) setErrors(({ [field]: _, ...rest }) => rest);
    setFormError(null);
  };

  const applyError = (err: AppError) => {
    if (err.field && ["amount", "category", "date", "note"].includes(err.field)) {
      setErrors({ [err.field]: err.message });
      if (err.field === "amount") amountRef.current?.focus();
    } else {
      setFormError(err.message);
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (savingRef.current) return;

    const local: Partial<Record<Field, string>> = {};
    if (!amount.trim()) local.amount = "Escribe un importe.";
    if (!categoryId) local.category = "Elige una categoría.";
    if (Object.keys(local).length) {
      setErrors(local);
      if (local.amount) amountRef.current?.focus();
      return;
    }

    const day = dateIsToday ? todayISO() : date;
    const input: MovementInput = { kind, amount, categoryId: categoryId!, date: day, note: note.trim() || null };
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const saved = editing
        ? await api.updateMovement(editing.id, input)
        : await api.createMovement({ ...input, id: pendingId.current });
      pendingId.current = newId();
      setErrors({});
      setAmount("");
      setNote("");
      if (dateIsToday) setDate(day);
      onSaved(saved, editing);
      amountRef.current?.focus();
    } catch (err) {
      applyError(toAppError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveLabel = editing ? "Guardar cambios" : kind === "expense" ? "Guardar gasto" : "Guardar ingreso";

  return (
    <form
      className="form"
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && editing) {
          e.preventDefault();
          onCancelEdit();
        }
      }}
      aria-busy={saving}
    >
      <Segmented
        className="form__kind"
        label="Tipo de movimiento"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          clearError("category");
        }}
      />

      <label className="amount__label" htmlFor={`${uid}-importe`}>
        Importe
      </label>
      <div className={`amount${errors.amount ? " is-invalid" : ""}`}>
        <input
          id={`${uid}-importe`}
          data-autofocus
          ref={amountRef}
          className="amount__input tabular"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0,00"
          value={amount}
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? `${uid}-importe-error` : undefined}
          onChange={(e) => {
            setAmount(e.target.value);
            clearError("amount");
          }}
        />
        <span className="amount__euro" aria-hidden="true">
          €
        </span>
      </div>
      <FieldError id={`${uid}-importe-error`} message={errors.amount} />

      <span className="label" id={`${uid}-categoria`}>
        Categoría
      </span>
      <div
        className={`categories${errors.category ? " is-invalid" : ""}`}
        role="group"
        aria-labelledby={`${uid}-categoria`}
        aria-describedby={errors.category ? `${uid}-categoria-error` : undefined}
      >
        {visible.map((c) => (
          <button
            key={c.id}
            type="button"
            className="category"
            title={c.name}
            aria-pressed={categoryId === c.id}
            onClick={() => {
              setCategoryId(c.id);
              clearError("category");
            }}
          >
            <CategoryIcon name={c.icon} size={16} />
            <span className="category__name">{c.name}</span>
            {c.archived && <span className="category__tag">archivada</span>}
          </button>
        ))}
      </div>
      <FieldError id={`${uid}-categoria-error`} message={errors.category} />

      <div className="fields">
        <label className="field">
          <span className="field__head">
            <span className="label">
              Concepto <span className="label__opt">· opcional</span>
            </span>
          </span>
          <input
            className={`input${errors.note ? " is-invalid" : ""}`}
            maxLength={NOTE_MAX}
            placeholder="Por ejemplo, compra semanal"
            value={note}
            aria-invalid={!!errors.note}
            onChange={(e) => {
              setNote(e.target.value);
              clearError("note");
            }}
          />
          <FieldError message={errors.note} />
        </label>
        <div className="field">
          <div className="field__head">
            <label className="label" htmlFor={`${uid}-fecha`}>
              Fecha
            </label>
            <div className="quick-dates" role="group" aria-label="Fecha rápida">
              {[
                { label: "Hoy", value: todayISO() },
                { label: "Ayer", value: yesterdayISO() },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="quick-date"
                  aria-pressed={date === q.value}
                  onClick={() => pickDate(q.value)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <input
            id={`${uid}-fecha`}
            className={`input${errors.date ? " is-invalid" : ""}`}
            type="date"
            required
            min="1900-01-01"
            max="2200-12-31"
            value={date}
            aria-invalid={!!errors.date}
            onChange={(e) => pickDate(e.target.value)}
          />
          <FieldError message={errors.date} />
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {editing ? <Check size={17} strokeWidth={2} aria-hidden="true" /> : <Plus size={17} strokeWidth={2} aria-hidden="true" />}
          <span>{saving ? "Guardando…" : saveLabel}</span>
        </button>
        {editing && (
          <button type="button" className="btn-ghost" onClick={onCancelEdit} disabled={saving}>
            Cancelar
          </button>
        )}
        <span className="hint">
          <kbd>Intro</kbd> para guardar{editing && <> · <kbd>Esc</kbd> para cancelar</>}
        </span>
      </div>
      {formError && (
        <p className="form-error" role="alert">
          {formError} Tus datos siguen en el formulario.
        </p>
      )}
    </form>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}
