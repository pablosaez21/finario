import { useMemo, useRef, useState, type MouseEvent } from "react";
import type { Series } from "../../lib/api";
import { formatEuros, formatEurosShort, formatNumber } from "../../lib/format";

interface Props {
  series: Series;
  currentLabel: string;
  previousLabel: string;
}

const W = 520;
const H = 220;
const PAD = { l: 58, r: 66, t: 14, b: 30 };
const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Escala «redonda» con tres tramos: 1.664 € → 0, 600, 1.200, 1.800 €. */
function niceScale(maxCents: number): number[] {
  const max = Math.max(maxCents / 100, 1);
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = (STEPS.find((s) => s * pow >= rough) ?? 10) * pow;
  return [0, 1, 2, 3].map((i) => Math.round(i * step * 100));
}

/**
 * Etiquetas del eje y de los extremos: euros enteros hasta 9.999 € ("1.664 €") y abreviadas a
 * partir de ahí para que quepan ("12 mil €", "1,2 M€", "1.000 M€").
 */
const euros = (cents: number) => {
  const v = Math.round(cents / 100);
  const short = (n: number) => formatNumber(n, Number.isInteger(n) || n >= 100 ? 0 : 1);
  if (Math.abs(v) >= 1_000_000) return `${short(Math.round((v / 1_000_000) * 10) / 10)}\u00a0M€`;
  if (Math.abs(v) >= 10_000) return `${short(Math.round(v / 1000))}\u00a0mil\u00a0€`;
  return formatEurosShort(v * 100);
};

export default function CumulativeChart({ series, currentLabel, previousLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cur = series.current;
  const prev = series.previous ?? [];
  const days = Math.max(cur.length, prev.length, 2);

  const { ticks, top } = useMemo(() => {
    const t = niceScale(Math.max(0, ...cur, ...prev));
    return { ticks: t, top: t[t.length - 1] };
  }, [cur, prev]);

  const x = (i: number) => PAD.l + (i / (days - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  const xTicks = [1, 7, 14, 21, 28].filter((d) => d <= days);
  const lastTick = xTicks[xTicks.length - 1];
  if (lastTick !== days) {
    if (days - lastTick < 3 && xTicks.length > 1) xTicks.pop();
    xTicks.push(days);
  }

  const curEnd = cur.length ? cur[cur.length - 1] : 0;
  const prevEnd = prev.length ? prev[prev.length - 1] : null;
  let curLabelY = y(curEnd);
  let prevLabelY = prevEnd !== null ? y(prevEnd) : 0;
  if (prevEnd !== null && Math.abs(curLabelY - prevLabelY) < 14) {
    if (curEnd >= prevEnd) {
      curLabelY -= 7;
      prevLabelY += 7;
    } else {
      curLabelY += 7;
      prevLabelY -= 7;
    }
  }

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (days - 1));
    setHover(i >= 0 && i < days ? i : null);
  };

  const summaryText =
    `Acumulado a día ${cur.length}: ${currentLabel}, ${formatEuros(curEnd)}.` +
    (prevEnd !== null ? ` ${previousLabel}, ${formatEuros(prevEnd)} a día ${prev.length}.` : " Sin periodo anterior registrado.");

  return (
    <figure className="chart">
      <div className="chart__legend" aria-hidden="true">
        <span className="chart__key chart__key--current">{currentLabel}</span>
        {series.previous && <span className="chart__key chart__key--previous">{previousLabel}</span>}
      </div>
      <div className="chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart__svg"
          role="img"
          aria-label={summaryText}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "chart__base" : "chart__grid"} />
              <text x={PAD.l - 8} y={y(t)} className="chart__ytick" dominantBaseline="middle" textAnchor="end">
                {euros(t)}
              </text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={d} x={x(d - 1)} y={H - 10} className="chart__xtick" textAnchor="middle">
              {d}
            </text>
          ))}
          <text x={W - PAD.r + 14} y={H - 10} className="chart__xtick">
            día
          </text>

          {prev.length > 0 && <path d={path(prev)} className="chart__line chart__line--previous" />}
          {cur.length > 0 && <path d={path(cur)} className="chart__line chart__line--current" />}

          {cur.length > 0 && (
            <>
              <circle cx={x(cur.length - 1)} cy={y(curEnd)} r={3.5} className="chart__dot" />
              <text x={x(cur.length - 1) + 8} y={curLabelY} dominantBaseline="middle" className="chart__end chart__end--current">
                {euros(curEnd)}
              </text>
            </>
          )}
          {prevEnd !== null && (
            <text x={x(prev.length - 1) + 8} y={prevLabelY} dominantBaseline="middle" className="chart__end chart__end--previous">
              {euros(prevEnd)}
            </text>
          )}

          {hover !== null && (
            <g className="chart__hover" aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="chart__guide" />
              {hover < cur.length && <circle cx={x(hover)} cy={y(cur[hover])} r={3} className="chart__dot" />}
              {hover < prev.length && <circle cx={x(hover)} cy={y(prev[hover])} r={2.5} className="chart__dot chart__dot--previous" />}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className={`chart__tip${hover > days * 0.6 ? " is-left" : ""}`}
            style={{ left: `${(x(hover) / W) * 100}%` }}
            aria-hidden="true"
          >
            <strong>Día {hover + 1}</strong>
            {hover < cur.length && (
              <span>
                <i className="chart__swatch chart__swatch--current" /> {formatEuros(cur[hover])}
              </span>
            )}
            {hover < prev.length && (
              <span>
                <i className="chart__swatch chart__swatch--previous" /> {formatEuros(prev[hover])}
              </span>
            )}
          </div>
        )}
      </div>
      <figcaption className="sr-only">{summaryText}</figcaption>
    </figure>
  );
}
