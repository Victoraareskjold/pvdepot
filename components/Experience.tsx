"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculate, DEFAULT_INPUT, type PlannerInput } from "@/lib/calc/model";
import { qualify, DEFAULT_ANSWERS, type QualifyAnswers } from "@/lib/calc/qualify";
import { nextDeadline, formatDeadline } from "@/lib/calc/deadlines";
import { int, kr } from "@/lib/format";
import type { SiteTheme } from "@/lib/sites";
import WorldStage from "./WorldStage";
import LivePanel from "./LivePanel";
import LeadForm from "./LeadForm";
import { Check, CheckStep, Investment, Operation, PowerStep, RoofStep, VehicleStep } from "./sections";
import type { Shot } from "./world/World";

const MAX_BAYS = 8;

const STEPS: { id: Shot; label: string }[] = [
  { id: "fleet", label: "Flåten" },
  { id: "roof", label: "Tak og sol" },
  { id: "energy", label: "Strøm og batteri" },
  { id: "check", label: "Støttesjekk" },
  { id: "results", label: "Tallene" },
];

export default function Experience({ theme }: { theme: SiteTheme }) {
  const [input, setInput] = useState<PlannerInput>(DEFAULT_INPUT);
  const [answers, setAnswers] = useState<QualifyAnswers>(DEFAULT_ANSWERS);
  const [shot, setShot] = useState<Shot>("hero");
  const [deadline, setDeadline] = useState<ReturnType<typeof nextDeadline>>(null);
  const [inset, setInset] = useState({ left: 0, top: 72, bottom: 0 });

  const result = useMemo(() => calculate(input), [input]);
  const check = useMemo(() => qualify(answers), [answers]);

  const labels = useMemo(
    () => ({
      chargers: `${result.chargePoints} × ${result.chargerKw} kW`,
      solar: result.solarKwp > 0 ? `${int(result.solarKwp)} kWp` : undefined,
      battery: input.batteryKwh > 0 ? `${int(input.batteryKwh)} kWh` : undefined,
      control:
        input.batteryKwh > 0 ? "Laststyring og frekvensmarked" : result.solarKwp > 0 ? "Sol og laststyring" : undefined,
      grid:
        result.gridDeficitKw > 0
          ? `+${int(result.gridDeficitKw)} kW`
          : input.gridSpareKw !== null
            ? `${int(input.gridSpareKw)} kW ledig`
            : undefined,
    }),
    [result.chargePoints, result.chargerKw, result.solarKwp, result.gridDeficitKw, input.batteryKwh, input.gridSpareKw],
  );

  const set = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  const answer = <K extends keyof QualifyAnswers>(key: K, value: QualifyAnswers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  useEffect(() => setDeadline(nextDeadline()), []);

  // Hvilken seksjon er midt på skjermen? Den styrer kameraet.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-shot]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setShot(e.target.getAttribute("data-shot") as Shot);
      },
      // På mobil ligger innholdet under verdenen, så «midten» er lenger ned.
      { rootMargin: window.innerWidth < 900 ? "-66% 0px -32% 0px" : "-48% 0px -48% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Hvor mye av skjermen panelene dekker, så scenen sentreres i resten.
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w < 900) setInset({ left: 0, top: 64, bottom: Math.round(h * 0.04) });
      else setInset({ left: Math.min(560, Math.round(w * 0.4)), top: 84, bottom: w > 1080 ? 120 : 0 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const activeIndex = STEPS.findIndex((s) => s.id === shot);

  return (
    <div className="xp" style={{ ["--accent" as string]: theme.accent, ["--energy" as string]: theme.energy }}>
      <WorldStage
        bays={Math.min(result.chargePoints, MAX_BAYS)}
        vehicleModel={result.vehicle.model}
        roofM2={input.roofM2}
        solarCoverage={input.solarCoverage}
        batteryKwh={input.batteryKwh}
        gridUpgrade={result.gridDeficitKw > 0}
        chargerKw={result.chargerKw}
        shot={shot}
        accent={theme.accent}
        energy={theme.energy}
        sign="DITT DEPOT"
        labels={labels}
        inset={inset}
      />
      <div className="veil" aria-hidden />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.5L15 2z" fill="currentColor" />
            </svg>
          </span>
          <span>
            <strong>Depotlading</strong>
            <small>{theme.name}</small>
          </span>
        </div>
        <dl className="kpis">
          <div>
            <dt>Ladeeffekt</dt>
            <dd>{int(result.availableKw)} kW</dd>
          </div>
          <div>
            <dt>Investering</dt>
            <dd>{kr(result.totalCost)}</dd>
          </div>
          <div className="kpi-support">
            <dt>Enova-støtte</dt>
            <dd>{kr(result.support)}</dd>
          </div>
          <div>
            <dt>Spart per år</dt>
            <dd>{kr(result.annual.totalSaving)}</dd>
          </div>
        </dl>
        <div className="topbar-end">
          {deadline && (
            <span className="deadline">
              Frist {formatDeadline(deadline.date).replace(/ \d{4}$/, "")}
              <strong>{deadline.daysLeft} dager</strong>
            </span>
          )}
          <button type="button" className="btn btn-energy" onClick={() => go("vurdering")}>
            Få vurdering
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="Steg">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`${i === activeIndex ? "is-current" : ""} ${i < activeIndex ? "is-done" : ""}`}
            onClick={() => go(s.id)}
          >
            <span className="rail-dot">{i + 1}</span>
            <span className="rail-label">{s.label}</span>
          </button>
        ))}
      </nav>

      <LivePanel chargerKw={result.chargerKw} total={result.chargePoints} />

      <main className="flow">
        <section className="sec sec-hero" data-shot="hero" id="start">
          <div className="hero-copy">
            <p className="hero-kicker">Enova: Bedriftslading for tunge kjøretøy</p>
            <h1>Se hva lading på depotet koster, og hvor mye Enova kan dekke</h1>
            <p className="lede">
              Enova dekker inntil 60 % av ladeanlegget, opptil 3 millioner kroner per prosjekt. Fyll inn flåten og
              bygget, så bygger vi depotet mens du ser på, og regner ut støtten.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={() => go("fleet")}>
                Start med flåten
              </button>
              {deadline && (
                <span className="hero-deadline">
                  Neste søknadsfrist: <strong>{formatDeadline(deadline.date)} kl. 12</strong>
                </span>
              )}
            </div>
          </div>
          <div className="scroll-cue" aria-hidden>
            <span />
          </div>
        </section>

        <Step id="fleet" n={1} title="Flåten som skal lade" lede="Hvor mange elektriske tunge kjøretøy, og hvor langt kjører de?" onNext={() => go("roof")} next="Videre: tak og solceller">
          <VehicleStep input={input} result={result} set={set} />
        </Step>

        <Step id="roof" n={2} title="Taket og solcellene" lede="Takflaten avgjør hvor mye strøm dere kan lage selv. Se panelene komme på plass." onNext={() => go("energy")} next="Videre: strøm og batteri">
          <RoofStep input={input} result={result} set={set} />
        </Step>

        <Step id="energy" n={3} title="Strømmen inn til laderne" lede="Holder nettilknytningen? Et batteri kan dekke toppene i stedet for en ny trafo." onNext={() => go("check")} next="Videre: støttesjekk">
          <PowerStep input={input} result={result} set={set} />
        </Step>

        <Step id="check" n={4} title="Kvalifiserer dere?" lede="Seks spørsmål mot Enovas krav for runden 3. februar 2027." onNext={() => go("results")} next="Se tallene">
          <CheckStep answers={answers} answer={answer} />
        </Step>

        <section className="sec sec-results" data-shot="results" id="results">
          <div className="results-col">
            <h2>Tallene for depotet</h2>
            <Investment result={result} input={input} set={set} />
            <Operation result={result} />
            <Check check={check} />
            <p className="disclaimer">
              Tallene er et første anslag basert på typiske priser og forbruk. Endelig pris og søknadsgrunnlag avklares
              etter befaring og svar fra nettselskapet. Kjøretøyene er ikke med i investeringen.
            </p>
          </div>
        </section>

        <section className="sec sec-lead" data-shot="lead" id="vurdering">
          <LeadForm theme={theme} result={result} check={check} input={input} answers={answers} />
        </section>
      </main>
    </div>
  );
}

function Step({
  id,
  n,
  title,
  lede,
  next,
  onNext,
  children,
}: {
  id: Shot;
  n: number;
  title: string;
  lede: string;
  next: string;
  onNext: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  return (
    <section className="sec sec-step" data-shot={id} id={id} ref={ref}>
      <div className="card step-card">
        <p className="step-count">
          Steg {n} av 4
        </p>
        <h2>{title}</h2>
        <p className="step-lede">{lede}</p>
        <div className="step-body">{children}</div>
        <button type="button" className="btn btn-primary step-next" onClick={onNext}>
          {next}
        </button>
      </div>
    </section>
  );
}
