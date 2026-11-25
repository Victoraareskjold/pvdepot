"use client";

import { useEffect, useRef, useState } from "react";
import type { PlannerResult } from "@/lib/calc/model";
import { krExact } from "@/lib/format";
import { DIESEL_NOTE, NOT_PAID_BACK, PAYBACK_NOTE, paybackLabel, signedKr } from "./sections";

/**
 * Tre resultatkort: anslått Enova-støtte, tilbakebetaling ved fullt
 * ladesalg og netto over 10 år etter investering (Victor, 25.11.2026). Tallene
 * ruller mykt til ny verdi når en slider endres.
 */
export default function KeyFigures({ result: r }: { result: PlannerResult }) {
  const payback = r.investment !== null && r.paybackYears !== null ? r.paybackYears : null;
  return (
    <div className="figures-box">
      <dl className="kpi-grid">
        <div className="kpi kpi-charge">
          <dt>Anslått Enova-støtte</dt>
          <dd>
            <Tween value={r.support} format={krExact} />
          </dd>
        </div>
        <div className="kpi">
          <dt>Tilbakebetaling ved fullt ladesalg</dt>
          <dd className={payback === null ? "kpi-text" : undefined}>
            {payback === null ? paybackLabel(r) : <Tween value={payback} format={(v) => `${v.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} år`} />}
          </dd>
        </div>
        <div className="kpi kpi-dark">
          <dt>Netto over {r.periodYears} år</dt>
          <dd className={r.netAfterPeriod === null ? "kpi-text" : undefined}>
            {r.netAfterPeriod === null ? "Pris må avklares" : <Tween value={r.netAfterPeriod} format={signedKr} />}
          </dd>
        </div>
      </dl>
      <p className="kpi-note">
        {r.investment !== null && r.paybackYears === null ? NOT_PAID_BACK : PAYBACK_NOTE} Netto over {r.periodYears} år er
        årlig netto ganger {r.periodYears} minus egen investering, før renter og skatt.
      </p>
      <p className="kpi-note">{DIESEL_NOTE}</p>
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
