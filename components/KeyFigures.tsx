"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannerResult } from "@/lib/calc/model";
import { dec, int, kr } from "@/lib/format";

/**
 * Seks nøkkeltall, som i skissen. Tallene ruller mykt til ny verdi når
 * en slider endres, så man ser at de henger sammen med valgene.
 */
export default function KeyFigures({ result: r }: { result: PlannerResult }) {
  const figures: { label: string; value: number | null; format: (v: number) => string; tone?: "dark" | "charge" }[] = [
    { label: "Enova-støtte", value: r.support, format: kr, tone: "charge" },
    { label: "Egen investering", value: r.netInvestment, format: kr },
    { label: `Spart over ${r.periodYears} år`, value: r.netSavingPeriod, format: (v) => kr(v), tone: "dark" },
    { label: "Mindre CO₂ per år", value: r.annual.co2Tonnes, format: (v) => `${int(v)} tonn` },
    { label: "Nedbetalt på", value: r.paybackYears, format: (v) => `${dec(v)} år` },
    { label: "Årlig avkastning", value: r.annualReturn === null ? null : r.annualReturn * 100, format: (v) => `${int(v)} %` },
  ];
  return (
    <dl className="kpi-grid">
      {figures.map((f) => (
        <div key={f.label} className={`kpi${f.tone ? ` kpi-${f.tone}` : ""}`}>
          <dt>{f.label}</dt>
          <dd>{f.value === null ? "–" : <Tween value={f.value} format={f.format} />}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tween({ value, format }: { value: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const current = useRef(value);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      current.current = value;
      setShown(value);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    const dur = 450;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      current.current = from.current + (value - from.current) * e;
      setShown(current.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format(shown)}</>;
}
