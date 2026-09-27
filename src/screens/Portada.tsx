import { useEffect, useRef } from "react";
import { ArrowRight, ChartNoAxesColumn, Wallet } from "lucide-react";
import paisaje from "../assets/portada-madrid.jpg";
import "../styles/portada.css";

interface Props {
  onOpenRegistro: () => void;
  /** Al volver desde el registro, el foco vuelve a la acción principal. */
  focusPrimary?: boolean;
}

export default function Portada({ onOpenRegistro, focusPrimary = false }: Props) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusPrimary) primaryRef.current?.focus({ preventScroll: true });
  }, [focusPrimary]);

  return (
    <main className="portada">
      <img className="portada__paisaje" src={paisaje} alt="" draggable={false} />
      <div className="portada__grano" aria-hidden="true" />

      <div className="portada__contenido">
        <h1 className="portada__titulo">Finario</h1>
        <p className="portada__lema">
          <span>Pecunia, si uti scis, ancilla est;</span> <span>si nescis, domina</span>
        </p>

        <nav className="portada__acciones" aria-label="Secciones">
          <button ref={primaryRef} type="button" className="portada__boton portada__boton--principal" onClick={onOpenRegistro}>
            <Wallet className="portada__icono" strokeWidth={1.7} aria-hidden="true" />
            <span className="portada__texto">Gastos e ingresos</span>
            <ArrowRight className="portada__flecha" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <div className="portada__proximo">
            <button
              type="button"
              className="portada__boton portada__boton--analisis"
              aria-disabled="true"
              aria-describedby="analisis-aviso"
              onClick={(e) => e.preventDefault()}
            >
              <ChartNoAxesColumn className="portada__icono" strokeWidth={1.8} aria-hidden="true" />
              <span className="portada__texto">Análisis</span>
              <span className="portada__etiqueta">Próximamente</span>
            </button>
            <span id="analisis-aviso" role="tooltip" className="portada__aviso">
              Disponible en una próxima fase
            </span>
          </div>
        </nav>
      </div>
    </main>
  );
}
