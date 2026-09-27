import { useEffect, useRef } from "react";
import { ArrowRight, ChartNoAxesColumn, Wallet } from "lucide-react";
import paisaje from "../assets/portada-madrid.jpg";
import type { Tab } from "./Interior";
import "../styles/portada.css";

interface Props {
  onOpen: (tab: Tab) => void;
  /** Al volver desde el interior, el foco vuelve al botón por el que se entró. */
  focusTab?: Tab | null;
}

export default function Portada({ onOpen, focusTab = null }: Props) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const analysisRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusTab === "analisis" ? analysisRef : focusTab === "apuntar" ? primaryRef : null;
    target?.current?.focus({ preventScroll: true });
  }, [focusTab]);

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
          <button ref={primaryRef} type="button" className="portada__boton portada__boton--principal" onClick={() => onOpen("apuntar")}>
            <Wallet className="portada__icono" strokeWidth={1.7} aria-hidden="true" />
            <span className="portada__texto">Gastos e ingresos</span>
            <ArrowRight className="portada__flecha" strokeWidth={1.8} aria-hidden="true" />
          </button>

          <button ref={analysisRef} type="button" className="portada__boton portada__boton--analisis" onClick={() => onOpen("analisis")}>
            <ChartNoAxesColumn className="portada__icono" strokeWidth={1.8} aria-hidden="true" />
            <span className="portada__texto">Análisis</span>
            <ArrowRight className="portada__flecha" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </nav>
      </div>
    </main>
  );
}
