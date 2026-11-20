"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { calculate, DEFAULT_INPUT, type PlannerInput } from "@/lib/calc/model";
import { qualify, setAnswer, DEFAULT_ANSWERS, type QualifyAnswers } from "@/lib/calc/qualify";
import { nextDeadline, formatDeadline } from "@/lib/calc/deadlines";
import { VEHICLE_TYPES } from "@/lib/calc/assumptions";
import { int } from "@/lib/format";
import type { SiteTheme } from "@/lib/sites";
import LeadForm from "./LeadForm";
import KeyFigures from "./KeyFigures";
import ScrollWorld from "./ScrollWorld";
import Carousel from "./Carousel";
import { Choice, Slider } from "./controls";
import { Check, CheckStep, Investment, Operation } from "./sections";

/**
 * Siden, ovenfra og ned (Smart Elektro, 19.11.2026):
 * rolig topp med én handling (hjelp med Enova-søknaden), 3D-depotet med
 * slidere og tre nøkkeltall ved siden av, hvordan vi hjelper med søknaden,
 * bildekarusell, støttesjekk og skjema. En svevende knapp holder
 * «Få hjelp med Enova-søknaden» synlig hele veien.
 */
export default function Experience({ theme }: { theme: SiteTheme }) {
  const [input, setInput] = useState<PlannerInput>(DEFAULT_INPUT);
  const [answers, setAnswers] = useState<QualifyAnswers>(DEFAULT_ANSWERS);
  const [deadline, setDeadline] = useState<ReturnType<typeof nextDeadline>>(null);
  const [details, setDetails] = useState(false);

  const result = useMemo(() => calculate(input), [input]);
  const check = useMemo(() => qualify(answers), [answers]);

  const set = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  // Bytter man hovedsvar, nullstilles oppfølgingen som ikke lenger gjelder.
  const answer = (id: string, value: string) => setAnswers((prev) => setAnswer(prev, id, value));

  useEffect(() => setDeadline(nextDeadline()), []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const panel = (
    <>
      <h2 className="tuner-title">Tilpass til depotet deres</h2>
      <Choice
        label="Type kjøretøy"
        value={input.vehicleType}
        onChange={(v) => set("vehicleType", v)}
        columns={2}
        options={VEHICLE_TYPES.map((v) => ({ value: v.id, label: v.label }))}
      />
      <Slider
        label="Lastebiler som skal lade"
        value={input.vehicles}
        min={1}
        max={30}
        step={1}
        onChange={(v) => set("vehicles", v)}
      />
      <Slider
        label="Kjørelengde per bil"
        value={input.kmPerDay}
        min={50}
        max={600}
        step={10}
        unit="km per dag"
        onChange={(v) => set("kmPerDay", v)}
      />
      <Slider
        label="Takflate"
        value={input.roofM2}
        min={0}
        max={12000}
        step={100}
        unit="m²"
        format={int}
        onChange={(v) => set("roofM2", v)}
      />
      <Slider
        label="Batteri"
        value={input.batteryKwh}
        min={0}
        max={3000}
        step={50}
        unit="kWh"
        format={int}
        onChange={(v) => set("batteryKwh", v)}
      />
      <details className="more">
        <summary>Flere valg</summary>
        <div className="more-body">
          <Slider
            label="Tid ved rampen"
            value={input.dwellHours}
            min={2}
            max={14}
            step={1}
            unit="timer per døgn"
            onChange={(v) => set("dwellHours", v)}
          />
          <Slider
            label="Driftsdøgn"
            value={input.operatingDays}
            min={200}
            max={365}
            step={5}
            unit="per år"
            onChange={(v) => set("operatingDays", v)}
          />
          <Slider
            label="Andel av taket med solceller"
            value={Math.round(input.solarCoverage * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => set("solarCoverage", v / 100)}
          />
          <Slider
            label="Ledig effekt i nettilknytningen"
            value={input.gridSpareKw ?? 0}
            min={0}
            max={2000}
            step={25}
            unit="kW"
            format={int}
            disabled={input.gridSpareKw === null}
            onChange={(v) => set("gridSpareKw", v)}
            hint={
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={input.gridSpareKw === null}
                  onChange={(e) => set("gridSpareKw", e.target.checked ? null : 200)}
                />
                Vet ikke, vi sjekker med nettselskapet
              </label>
            }
          />
        </div>
      </details>
      <KeyFigures result={result} />
      <button
        type="button"
        className="link-btn"
        aria-expanded={details}
        aria-controls="regnestykket"
        onClick={() => {
          setDetails(true);
          setTimeout(() => go("regnestykket"), 50);
        }}
      >
        Se hele regnestykket
      </button>
    </>
  );

  return (
    <div
      className="page"
      style={{ ["--accent" as string]: theme.accent, ["--energy" as string]: theme.energy }}
    >
      <header className="hook wrap">
        <p className="hook-brand">
          <Image
            className="brand-logo"
            src={theme.logo.src}
            alt={`${theme.name} Lading`}
            width={theme.logo.width}
            height={theme.logo.height}
            priority
          />
        </p>
        <h1>
          <span>Lading for elektriske lastebiler.</span>
          <span>Enova betaler inntil 60 %.</span>
        </h1>
        <p className="hook-lede">
          Har dere elektriske lastebiler innom, eller planer om det? Vi hjelper dere med ladeløsninger og søknad om
          Enova-støtte. Smart Elektro leverer komplette løsninger. Fra første analyse til ferdig anlegg og videre
          service. Solceller og batterilagring kan også inngå i både løsningen og søknaden.
        </p>
        <div className="hook-actions" id="hook-cta">
          <button type="button" className="btn btn-energy" onClick={() => go("vurdering")}>
            Få hjelp med Enova-søknaden
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="link-btn" onClick={() => go("depot")}>
            Regn på depotet deres
          </button>
        </div>
        {deadline && (
          <p className="hook-deadline">
            Neste søknadsfrist er <strong>{formatDeadline(deadline.date)}</strong>, om {deadline.daysLeft} dager.
          </p>
        )}
      </header>

      <ScrollWorld input={input} result={result} theme={theme} panel={panel} />

      {details && (
        <section className="wrap calc-details" id="regnestykket" aria-label="Hele regnestykket">
          <div className="calc-details-head">
            <h2>Hele regnestykket</h2>
            <button type="button" className="link-btn" onClick={() => setDetails(false)}>
              Skjul
            </button>
          </div>
          <div className="figures-details">
            <Investment result={result} input={input} set={set} />
            <Operation result={result} />
          </div>
        </section>
      )}

      <section className="wrap help" aria-labelledby="help-title">
        <h2 id="help-title">Vi hjelper dere med Enova-søknaden</h2>
        <p className="sec-lede">
          Søknadene konkurrerer om støtte per kW ladeeffekt. Riktig dimensjonering og et godt kostnadsgrunnlag avgjør
          om dere får tilsagn. Vi tar jobben sammen med dere.
        </p>
        <ol className="help-steps">
          <li>
            <h3>Vi regner på behovet</h3>
            <p>Kjøremønster, ladeeffekt og laststyring, så dere søker på riktig antall kW.</p>
          </li>
          <li>
            <h3>Vi avklarer nettet</h3>
            <p>Kapasitet med nettselskapet, og om batteri eller ny trafo lønner seg.</p>
          </li>
          <li>
            <h3>Vi setter opp søknaden</h3>
            <p>Kostnadsgrunnlag og støttegrad som holder søknaden konkurransedyktig.</p>
          </li>
          <li>
            <h3>Vi bygger og følger opp</h3>
            <p>Installasjon på rampene, idriftsettelse og service gjennom de fem årene Enova krever drift.</p>
          </li>
        </ol>
        <div className="help-cta" id="help-cta">
          <button type="button" className="btn btn-energy" onClick={() => go("vurdering")}>
            Få hjelp med Enova-søknaden
            <span aria-hidden="true">→</span>
          </button>
          {deadline && (
            <p>
              {deadline.daysLeft} dager til fristen {formatDeadline(deadline.date)}.
            </p>
          )}
        </div>
      </section>

      <section className="carousel-sec" aria-labelledby="carousel-title">
        <div className="wrap">
          <h2 id="carousel-title">Anlegg vi har bygget</h2>
          <p className="sec-lede">Fra grøft og nettilknytning til ferdig ladeplass. Smart Elektro gjør hele jobben.</p>
        </div>
        <Carousel />
      </section>

      <section className="wrap apply" id="vurdering" aria-labelledby="apply-title">
        <h2 id="apply-title">Få hjelp med Enova-søknaden</h2>
        <p className="sec-lede">
          Svar på seks spørsmål mot utvalgte krav fra Enova, og send inn kontaktinformasjonen. Det kan dere gjøre
          uansett resultat.
        </p>
        <div className="apply-grid">
          <div className="card step-body">
            <CheckStep answers={answers} onAnswer={answer} />
          </div>
          <Check check={check} onCta={() => go("kontakt")} />
        </div>
        <LeadForm theme={theme} result={result} check={check} input={input} answers={answers} />
        <p className="disclaimer">
          Tallene er et første anslag basert på typiske priser og forbruk, og sammenligner med diesel. Merpris for
          elektriske biler er ikke med. Nettilknytning kommer i tillegg hvis kapasiteten ikke er avklart. Endelig pris og
          søknadsgrunnlag avklares etter befaring og svar fra nettselskapet.
          {result.chargePoints > 8 && ` Illustrasjonen viser 8 av ${result.chargePoints} lasteramper.`}
        </p>
      </section>

      <FloatingCta onClick={() => go("vurdering")} />
    </div>
  );
}

/** Svevende knapp når toppknappen er ute av syne og skjemaet ikke er på skjermen. */
function FloatingCta({ onClick }: { onClick: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Skjul når en annen «Få hjelp»-knapp eller skjemaet er på skjermen.
    const targets = ["hook-cta", "help-cta", "vurdering"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const visible = new Set<Element>([targets[0]]);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setShow(visible.size === 0);
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return (
    <button
      type="button"
      className={`float-cta${show ? " is-shown" : ""}`}
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      Få hjelp med Enova-søknaden
    </button>
  );
}
