/**
 * Luz de la portada según la hora real en Madrid. Se calcula la altura del sol (fórmula
 * aproximada de efemérides, error menor de un grado, suficiente para pintar un cielo) y de ella
 * salen las intensidades de cada capa, entre 0 y 1.
 */

const MADRID = { lat: 40.4168, lon: -3.7038 };
const RAD = Math.PI / 180;

/** Altura del sol sobre el horizonte, en grados. */
export function sunAltitude(date: Date, { lat, lon } = MADRID): number {
  const d = date.getTime() / 86_400_000 - 10_957.5; // días desde J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst + lon / 15) * 15) * RAD - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 en `a`, 1 en `b`, suave entre ambos (funciona también con a > b). */
const ramp = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface Light {
  /** Hora dorada: el sol bajo tiñe el cielo y las fachadas de naranja. */
  golden: number;
  /** Crepúsculo: rosas y violetas en el horizonte. */
  dusk: number;
  /** Noche: cielo azul oscuro, ciudad apagada, estrellas. */
  night: number;
  /** Luces de la ciudad (farola, ventanas, Mahou). */
  lights: number;
  /** Fracción de ventanas encendidas: de madrugada la mayoría se apagan. */
  windows: number;
  /** Destellos del sol en los cristales de las torres. */
  glint: number;
}

export function lightAt(date: Date): Light {
  const alt = sunAltitude(date);
  const hour = date.getHours() + date.getMinutes() / 60;
  const lights = ramp(alt, 3, -5);
  // Gente en casa: todas a primera hora de la noche, una de cada cinco de madrugada.
  const awake = hour >= 18 ? 1 : hour < 1 ? 0.85 : hour < 2.5 ? 0.45 : hour < 6 ? 0.2 : hour < 8 ? 0.55 : 1;
  return {
    golden: alt >= 3 ? ramp(alt, 14, 3) : ramp(alt, -5, 3),
    dusk: alt >= -4 ? ramp(alt, 2, -4) : ramp(alt, -12, -4),
    night: ramp(alt, -3, -13),
    lights,
    windows: lights * awake,
    glint: ramp(alt, 2, 12),
  };
}
