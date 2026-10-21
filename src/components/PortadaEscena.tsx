import { useEffect, useState, type CSSProperties } from "react";
import paisaje from "../assets/portada-madrid.jpg";
import mahouMask from "../assets/portada-mahou.png";
import farolaMask from "../assets/portada-farola.png";
import ventanas from "../assets/portada-ventanas.json";
import { lightAt, type Light } from "../lib/sol";

/**
 * Paisaje de la portada con la luz de la hora real en Madrid: el cielo pasa por la hora dorada,
 * el crepúsculo y la noche; la farola, las ventanas y el cartel de Mahou se encienden; las torres
 * destellan de día. Las máscaras salen de scripts/prepare-portada-capas.py y las cajas (en
 * píxeles de la imagen de 1654 × 923) deben coincidir con las de ese script.
 */

const IMG = { w: 1654, h: 923 };
const MAHOU_BOX = { x: 1500, y: 720, w: 140, h: 100 };
const LAMP_BOX = { x: 305, y: 254, w: 106, h: 36 };

/** Pseudoaleatorio estable por índice: cada ventana y estrella se comporta siempre igual. */
const seeded = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const WINDOWS = (ventanas as number[][]).map(([x, y, w, h], i) => ({ x, y, w, h, threshold: seeded(i + 1) }));

// Estrellas en la parte alta del cielo, fuera del hueco del título y los botones.
const STARS = Array.from({ length: 140 }, (_, i) => ({
  left: seeded(i * 3 + 1) * 100,
  top: seeded(i * 3 + 2) * 52,
  size: 1 + seeded(i * 3 + 3) * 1.6,
  twinkle: i % 4 === 0,
  delay: seeded(i + 500) * 6,
}))
  .filter((s) => !(s.left > 28 && s.left < 72 && s.top < 46))
  .slice(0, 80);

/** Hora forzada solo en desarrollo: `?hora=21:30` en el navegador o `VITE_HORA=21:30 pnpm app:dev`. */
function forcedDate(): Date | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(location.search).get("hora") ?? (import.meta.env.VITE_HORA as string | undefined) ?? "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
}

function useLight(): Light {
  const [light, setLight] = useState(() => lightAt(forcedDate() ?? new Date()));
  useEffect(() => {
    if (forcedDate()) return;
    const update = () => setLight(lightAt(new Date()));
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return light;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Recorte del paisaje en su sitio, enmascarado: una luz que brilla sobre la escena oscurecida. */
function Lit({ box, mask, className, style }: { box: typeof LAMP_BOX; mask: string; className: string; style?: CSSProperties }) {
  return (
    <div
      className={`luz ${className}`}
      style={{ left: pct(box.x, IMG.w), top: pct(box.y, IMG.h), width: pct(box.w, IMG.w), height: pct(box.h, IMG.h), ...style }}
    >
      <div
        className="luz__recorte"
        style={{
          backgroundImage: `url(${paisaje})`,
          backgroundSize: `${(IMG.w / box.w) * 100}% ${(IMG.h / box.h) * 100}%`,
          backgroundPosition: `${(box.x / (IMG.w - box.w)) * 100}% ${(box.y / (IMG.h - box.h)) * 100}%`,
          WebkitMaskImage: `url(${mask})`,
          maskImage: `url(${mask})`,
        }}
      />
    </div>
  );
}

export default function PortadaEscena() {
  const l = useLight();
  const [ready, setReady] = useState(false);
  // Sin transición al abrir: la luz aparece ya en su punto; los cambios posteriores son lentos.
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const darkness = Math.min(0.78, l.night * 0.78 + l.dusk * 0.42);
  const lampOn = l.lights > 0.35;

  return (
    <div className={`escena${ready ? " is-ready" : ""}`} aria-hidden="true">
      <img className="escena__paisaje" src={paisaje} alt="" draggable={false} />
      <div className="escena__calido" style={{ opacity: l.golden * 0.55 }} />
      <div className="escena__noche" style={{ opacity: darkness }} />

      <div className="escena__cielo">
        <div className="cielo cielo--dorado" style={{ opacity: l.golden * 0.85 }} />
        <div className="cielo cielo--crepusculo" style={{ opacity: l.dusk * 0.9 }} />
        <div className="cielo cielo--noche" style={{ opacity: l.night }} />
        <div className="estrellas" style={{ opacity: l.night }}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className={`estrella${s.twinkle ? " estrella--titila" : ""}`}
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
            />
          ))}
        </div>
      </div>

      <div className="escena__lienzo">
        <div className="torres">
          <div className="torres__destello" style={{ opacity: l.glint }}>
            <span />
          </div>
          <div className="torres__plantas" style={{ opacity: l.night * 0.6 }} />
        </div>

        <svg className="ventanas" viewBox={`0 0 ${IMG.w} ${IMG.h}`} preserveAspectRatio="none" style={{ opacity: Math.min(1, l.lights * 1.2) }}>
          {WINDOWS.map((w, i) => (
            <rect
              key={i}
              x={w.x + 1}
              y={w.y + 1}
              width={Math.max(2, w.w - 2)}
              height={Math.max(2, w.h - 2)}
              rx={1}
              className="ventana"
              style={{ opacity: w.threshold < l.windows ? 0.55 + w.threshold * 0.4 : 0, transitionDelay: `${w.threshold * 12}s` }}
            />
          ))}
        </svg>

        <div className={`farola${lampOn ? " is-on" : ""}`}>
          <div
            className="farola__cono"
            style={{ left: pct(LAMP_BOX.x - 40, IMG.w), top: pct(LAMP_BOX.y + 22, IMG.h), width: pct(LAMP_BOX.w + 80, IMG.w), height: pct(330, IMG.h) }}
          />
          <div
            className="farola__halo"
            style={{ left: pct(LAMP_BOX.x - 70, IMG.w), top: pct(LAMP_BOX.y - 60, IMG.h), width: pct(LAMP_BOX.w + 140, IMG.w), height: pct(LAMP_BOX.h + 120, IMG.h) }}
          />
          <Lit box={LAMP_BOX} mask={farolaMask} className="farola__pantalla" />
          <Lit box={LAMP_BOX} mask={farolaMask} className="farola__apagada" style={{ opacity: lampOn ? 0 : 1 }} />
        </div>

        <div className="mahou" style={{ "--mahou": 0.35 + l.lights * 0.65 } as CSSProperties}>
          <Lit box={MAHOU_BOX} mask={mahouMask} className="mahou__letras" />
        </div>
      </div>

      <div className="escena__grano" />
    </div>
  );
}
