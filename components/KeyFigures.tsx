"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannerResult } from "@/lib/calc/model";
import { dec, kr } from "@/lib/format";

/**
 * Tre nøkkeltall (Smart Elektro, 19.11.2026): Enova-støtte, nedbetalingstid
 * og spart over 10 år. Resten ligger i regnestykket. Tallene ruller mykt
 * til ny verdi når en slider endres.
 */
export default function KeyFigures({ result: r }: { result: PlannerResult }) {
  const figures: { label: string; value: number | null; format: (v: number) => string; tone?: "dark" | "charge" }[] = [
    { label: "Enova-støtte", value: r.support, format: kr, tone: "charge" },
    { label: "Nedbetalt på", value: r.paybackYears, format: (v) => `${dec(v)} år` },
    { label: `Spart over ${r.periodYears} år`, value: r.netSavingPeriod, format: (v) => kr(v), tone: "dark" },
  ];
  return (
    <div className="figures-box">
      <dl className="kpi-grid">
        {figures.map((f) => (
          <div key={f.label} className={`kpi${f.tone ? ` kpi-${f.tone}` : ""}`}>
            <dt>{f.label}</dt>
            <dd>{f.value === null ? "–" : <Tween value={f.value} format={f.format} />}</dd>
          </div>
        ))}
      </dl>
      <p className="kpi-note">
        Besparelsen er spart diesel. Merpris for elektriske biler er ikke med.
        {r.competitive === false && " Støtten er over grensen Enova har godtatt i de siste rundene."}
      </p>
    </div>
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
