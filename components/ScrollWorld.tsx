"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import { dec, int, krExact } from "@/lib/format";
import { SOLAR, VEHICLE_TYPES } from "@/lib/calc/assumptions";
import { word } from "./sections";
import type { SiteTheme } from "@/lib/sites";
import WorldStage from "./WorldStage";
import LivePanel from "./LivePanel";
import type { Shot } from "./world/World";

const MAX_BAYS = 8;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    const n = input.chargers;
    const full = result.nameplateKw > 0 && result.availableKw >= result.nameplateKw - 0.5;
    const out: Stop[] = [
      {
        shot: "hero",
        title: "Depotet deres",
        text: `${cap(word(n))} ${n === 1 ? "ladeplass" : "ladeplasser"} for tunge kjøretøy, med strøm fra nett, tak og batteri.`,
      },
      {
        shot: "fleet",
        title: "DC-lading på lasterampene",
        text: full
          ? `${n === 1 ? "Ladeplassen" : `Alle ${word(n)} ladeplassene`} kan levere ${int(input.chargerKw)} kW samtidig i minst én time.${input.batteryUnits > 0 ? " Batteriet bidrar med effekt når flere biler lader samtidig." : ""}`
          : `${n} × ${int(input.chargerKw)} kW DC ved portene. Sammen kan de levere ${int(result.availableKw)} kW samtidig i én time med dette nettet og batteriet.`,
      },
    ];
    if (input.solarKwp > 0) {
      out.push({
        shot: "roof",
        title: "Solceller på taket",
        text: `${int(input.solarKwp)} kWp gir rundt ${int(result.energy.solarKwh / 1000)} MWh i året. Solstrømmen går til bygget, laderne og batteriet.`,
      });
    }
    out.push({
      shot: "energy",
      title: input.batteryUnits > 0 ? "Batteri og styring" : "Nett og styring",
      text:
        input.batteryUnits > 0
          ? `${int(result.batteryKwh)} kWh brukbar batterikapasitet og ${int(result.batteryKw)} kW utladning. Styringen holder nettuttaket på ${int(input.peakManagedKw)} kW i stedet for ${int(input.peakUnmanagedKw)} kW.`
          : `Laststyring holder nettuttaket nede, så dere ikke betaler for unødvendige effekttopper.`,
    });
    out.push({
      shot: "results",
      title: `Anslått Enova-støtte ${krExact(result.support)}`,
      text:
        result.netInvestment === null
          ? `Årlig netto fra anlegget ${krExact(result.annualNet)}. Investeringspris for dette utstyret må avklares.`
          : result.paybackYears === null
            ? `Egen investering ${krExact(result.netInvestment)}. Med disse forutsetningene tjenes investeringen ikke inn.`
            : `Egen investering ${krExact(result.netInvestment)}. Årlig netto ${krExact(result.annualNet)} gir ${dec(result.paybackYears)} års tilbakebetaling ved fullt ladesalg.`,
    });
    return out;
  }, [result, input.chargers, input.chargerKw, input.solarKwp, input.batteryUnits, input.peakManagedKw, input.peakUnmanagedKw]);

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
      chargers: `${input.chargers} × ${int(input.chargerKw)} kW DC`,
      solar: input.solarKwp > 0 ? `${int(input.solarKwp)} kWp` : undefined,
      battery: result.batteryKwh > 0 ? `${int(result.batteryKwh)} kWh` : undefined,
      control: input.batteryUnits > 0 || input.solarKwp > 0 ? "Laststyring" : undefined,
      grid: `${int(input.peakManagedKw)} kW nettuttak`,
    }),
    [input.chargers, input.chargerKw, input.solarKwp, input.batteryUnits, input.peakManagedKw, result.batteryKwh],
  );
  const vehicle = VEHICLE_TYPES.find((v) => v.id === input.vehicleType) ?? VEHICLE_TYPES[0];
  // 3D-bygget dimensjoneres etter takflaten som gir valgt kWp.
  const roofM2 = Math.max(800, input.solarKwp / (SOLAR.kwpPerM2 * SOLAR.refCoverage));

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
            bays={Math.max(1, Math.min(input.chargers, MAX_BAYS))}
            vehicleModel={vehicle.model}
            roofM2={roofM2}
            solarCoverage={input.solarKwp > 0 ? SOLAR.refCoverage : 0}
            batteryKwh={result.batteryKwh}
            gridUpgrade={false}
            chargerKw={input.chargerKw}
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
          <LivePanel chargerKw={input.chargerKw} total={input.chargers} />
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
