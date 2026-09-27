import Dialog from "./Dialog";
import MovementForm from "./MovementForm";
import type { Category, Movement } from "../lib/api";
import { formatLongDate } from "../lib/format";

interface Props {
  movement: Movement;
  categories: Category[];
  onClose: () => void;
  onSaved: (saved: Movement, previous: Movement) => void;
}

/** Reutiliza el formulario de registro para editar desde Análisis o el buscador. */
export default function EditMovementDialog({ movement, categories, onClose, onSaved }: Props) {
  return (
    <Dialog
      title="Editar movimiento"
      description={`${movement.note || movement.categoryName} · ${formatLongDate(movement.date)}. Las cifras se recalculan al guardar.`}
      onClose={onClose}
      wide
    >
      <div className="edit-dialog">
        <MovementForm
          categories={categories}
          editing={movement}
          onSaved={(saved) => onSaved(saved, movement)}
          onCancelEdit={onClose}
        />
      </div>
    </Dialog>
  );
}
