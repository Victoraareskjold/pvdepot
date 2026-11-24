"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  format = (v) => String(v),
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className={`field${disabled ? " is-disabled" : ""}`}>
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="field-value">
          {format(value)}
          {unit && <span className="unit"> {unit}</span>}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${fill}%` }}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  help,
}: {
  label: string;
  /** undefined = ikke besvart */
  value: T | undefined;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  columns?: number;
  help?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset className="field choice" style={columns ? { ["--cols" as string]: columns } : undefined}>
      <legend>{label}</legend>
      {help && <p className="field-hint choice-help">{help}</p>}
      <div className="choice-options">
        {options.map((o) => (
          <label key={o.value} className={`choice-option${o.value === value ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span className="choice-label">{o.label}</span>
            {o.hint && <span className="choice-hint">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const parseNumber = (text: string) => {
  const cleaned = text.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Tallfelt som tåler desimalkomma og desimalpunkt («4,50» og «4.50») og
 * mellomrom som tusenskille. Viser kundens tekst mens feltet er i bruk, og
 * formaterer pent når feltet forlates. Tomt felt blir 0.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  decimals = 0,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  hint,
  compact,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  decimals?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
  compact?: boolean;
}) {
  const id = useId();
  const format = (v: number) =>
    v.toLocaleString("nb-NO", { minimumFractionDigits: decimals > 0 ? Math.min(2, decimals) : 0, maximumFractionDigits: decimals });
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  return (
    <div className={`field number-field${compact ? " is-compact" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="number-input">
        <input
          id={id}
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNumber(e.target.value);
            if (n !== null) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => {
            setFocused(false);
            const n = parseNumber(text);
            const v = n === null ? Math.max(min, 0) : Math.min(max, Math.max(min, n));
            onChange(v);
            setText(format(v));
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
