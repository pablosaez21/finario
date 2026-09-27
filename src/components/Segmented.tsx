import { useRef } from "react";
import { useSlidingIndicator } from "../lib/useSlidingIndicator";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "sm";
  className?: string;
}

/** Selector segmentado con fondo de selección deslizante (140–160 ms). */
export default function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const { style, ready } = useSlidingIndicator(ref, value);

  return (
    <div
      ref={ref}
      className={`seg seg--${size}${ready ? " is-ready" : ""}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
    >
      <span className="seg__indicator" style={style} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          data-key={o.value}
          type="button"
          className="seg__option"
          aria-pressed={value === o.value}
          onClick={() => value !== o.value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
