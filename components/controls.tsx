"use client";

import { useId, type ReactNode } from "react";

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
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  columns?: number;
}) {
  const name = useId();
  return (
    <fieldset className="field choice" style={columns ? { ["--cols" as string]: columns } : undefined}>
      <legend>{label}</legend>
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
