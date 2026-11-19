"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import { int, kr } from "@/lib/format";
import type { SiteTheme } from "@/lib/sites";
import WorldStage from "./WorldStage";
import LivePanel from "./LivePanel";
import type { Shot } from "./world/World";

const MAX_BAYS = 8;

interface Stop {
  shot: Shot;
  title: string;
  text: string;
}

/**
 * 3D-depotet som egen scroll-seksjon. Seksjonen er flere skjermer høy, og
 * scenen står fast (sticky) mens man scroller gjennom den. Hvor langt man
 * har kommet, styrer kameraet og teksten. Utenfor seksjonen står scenen
 * stille, så den ikke bruker maskinkraft.
 */
export default function ScrollWorld({
  input,
  result,
  theme,
  panel,
}: {
  input: PlannerInput;
  result: PlannerResult;
  theme: SiteTheme;
  /** Sliderne og nøkkeltallene, ved siden av scenen (under på mobil) */
  panel?: React.ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inset, setInset] = useState({ left: 0, top: 24, bottom: 150 });

  // Panelet dekker venstre side på desktop; på mobil ligger det under scenen.
  useEffect(() => {
    const update = () =>
      setInset(
        window.innerWidth >= 900
          ? { left: 440, top: 24, bottom: 140 }
          : { left: 0, top: 16, bottom: 120 },
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stops = useMemo<Stop[]>(() => {
    const out: Stop[] = [
      {
        shot: "hero",
        title: "Depotet deres",
        text: `${result.chargePoints} elektriske lastebiler som lader på eget depot, med strøm fra nett, tak og batteri.`,
      },
      {
        shot: "fleet",
        title: "DC-lading på lasterampene",
        text: `${result.chargePoints} × ${result.chargerKw} kW på veggen ved hver port. Bilene rygger inn og lader mens de står ved rampen. Hver bil trenger omtrent ${int(result.dailyKwhPerVehicle)} kWh i døgnet.`,
      },
    ];
    if (result.solarKwp > 0) {
      out.push({
        shot: "roof",
        title: "Solceller på taket",
        text: `${int(result.solarKwp)} kWp gir rundt ${int(result.annual.solarKwh / 1000)} MWh i året, tilsvarende ${int(result.annual.solarShareOfCharging * 100)} % av ladebehovet.`,
      });
    }
    out.push({
      shot: "energy",
      title: input.batteryKwh > 0 ? "Batteri og styring" : "Nett og styring",
      text:
        input.batteryKwh > 0
          ? `${int(input.batteryKwh)} kWh batteri tar effekttoppene. Styringssystemet fordeler strømmen og kan by batteriet inn i frekvensmarkedet.`
          : result.gridDeficitKw > 0
            ? `Nettet mangler ${int(result.gridDeficitKw)} kW. Et batteri kan dekke toppene i stedet for ny trafo.`
            : "Laststyring fordeler strømmen mellom laderne, så dere ikke betaler for unødvendige effekttopper.",
    });
    out.push({
      shot: "results",
      title: `Enova dekker ${kr(result.support)}`,
      text: `Egen investering ${kr(result.netInvestment)}. Med dagens strøm- og dieselpriser er det tjent inn på ${result.paybackYears ? `${result.paybackYears.toFixed(1).replace(".", ",")} år` : "–"}.`,
    });
    return out;
  }, [result, input.batteryKwh]);

  // Fremdrift gjennom seksjonen styrer hvilket stopp som vises.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      setProgress(p);
      setIndex(
        Math.min(stops.length - 1, Math.floor(p * stops.length * 0.999)),
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stops.length]);

  const stop = stops[index];

  // Hopp til det som kommer etter seksjonen.
  const skip = () => {
    const el = section.current;
    if (!el) return;
    window.scrollTo({
      top: el.offsetTop + el.offsetHeight,
      behavior: "smooth",
    });
  };
  const labels = useMemo(
    () => ({
      chargers: `${result.chargePoints} × ${result.chargerKw} kW`,
      solar: result.solarKwp > 0 ? `${int(result.solarKwp)} kWp` : undefined,
      battery:
        input.batteryKwh > 0 ? `${int(input.batteryKwh)} kWh` : undefined,
      control:
        input.batteryKwh > 0
          ? "Laststyring og frekvensmarked"
          : result.solarKwp > 0
            ? "Sol og laststyring"
            : undefined,
      grid:
        result.gridDeficitKw > 0
          ? `+${int(result.gridDeficitKw)} kW`
          : input.gridSpareKw !== null
            ? `${int(input.gridSpareKw)} kW ledig`
            : undefined,
    }),
    [
      result.chargePoints,
      result.chargerKw,
      result.solarKwp,
      result.gridDeficitKw,
      input.batteryKwh,
      input.gridSpareKw,
    ],
  );

  return (
    <section
      ref={section}
      className="scrolly"
      id="depot"
      style={{ ["--stops" as string]: stops.length }}
      aria-label="Depotet deres"
    >
      <div className="scrolly-sticky">
        <div className="scrolly-frame">
          <WorldStage
            active={visible}
            bays={Math.min(result.chargePoints, MAX_BAYS)}
            vehicleModel={result.vehicle.model}
            roofM2={input.roofM2}
            solarCoverage={input.solarCoverage}
            batteryKwh={input.batteryKwh}
            gridUpgrade={result.gridDeficitKw > 0}
            chargerKw={result.chargerKw}
            shot={stop.shot}
            accent={theme.accent}
            energy={theme.energy}
            sign="DITT DEPOT"
            labels={labels}
            inset={inset}
          />
          <div className="scrolly-caption" aria-live="polite">
            <div className="scrolly-head">
              <ol className="scrolly-steps" aria-hidden>
                {stops.map((s, i) => (
                  <li
                    key={s.shot}
                    className={
                      i === index ? "is-current" : i < index ? "is-done" : ""
                    }
                  />
                ))}
              </ol>
              <span className="scrolly-count">
                {index + 1} av {stops.length}
              </span>
              <button type="button" className="scrolly-skip" onClick={skip}>
                Hopp videre
              </button>
            </div>
            <h2 key={stop.title}>{stop.title}</h2>
            <p key={stop.text}>{stop.text}</p>
          </div>
          <LivePanel chargerKw={result.chargerKw} total={result.chargePoints} />
          <div
            className="scrolly-progress"
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden
          />
        </div>
      </div>
      {panel && <div className="tuner">{panel}</div>}
    </section>
  );
}
