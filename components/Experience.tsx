"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { calculate, DEFAULT_INPUT, type PlannerInput } from "@/lib/calc/model";
import { qualify, setAnswer, DEFAULT_ANSWERS, type QualifyAnswers } from "@/lib/calc/qualify";
import type { DeadlineInfo } from "@/lib/calc/deadlines";
import type { SiteTheme } from "@/lib/sites";
import LeadForm from "./LeadForm";
import KeyFigures from "./KeyFigures";
import ScrollWorld from "./ScrollWorld";
import Carousel from "./Carousel";
import { Assumptions, CalcControls, MainSliders, Check, CheckStep, Equipment, Investment, Operation, PowerAndEnergy } from "./sections";
import { DeadlineText, useDeadline } from "./Deadline";

/**
 * Siden, ovenfra og ned (Smart Elektro, 19.11.2026):
 * rolig topp med én handling (hjelp med Enova-søknaden), 3D-depotet med
 * slidere og tre nøkkeltall ved siden av, hvordan vi hjelper med søknaden,
 * bildekarusell, støttesjekk og skjema. En svevende knapp holder
 * «Få hjelp med Enova-søknaden» synlig hele veien.
 */
export default function Experience({ theme, deadlines }: { theme: SiteTheme; deadlines: DeadlineInfo }) {
  const [input, setInput] = useState<PlannerInput>(DEFAULT_INPUT);
  const [answers, setAnswers] = useState<QualifyAnswers>(DEFAULT_ANSWERS);
  const [details, setDetails] = useState(false);

  const result = useMemo(() => calculate(input), [input]);
  const check = useMemo(() => qualify(answers), [answers]);

  const set = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  // Bytter man hovedsvar, nullstilles oppfølgingen som ikke lenger gjelder.
  const answer = (id: string, value: string) => setAnswers((prev) => setAnswer(prev, id, value));

  const deadline = useDeadline(deadlines);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const panel = (
    <>
      <h2 className="tuner-title">Tilpass til depotet deres</h2>
      <MainSliders input={input} result={result} set={set} />
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
          <span>Lading for elektriske tunge kjøretøy.</span>
          <span>Enova betaler inntil 60 %.</span>
        </h1>
        <p className="hook-lede">
          Har dere elektriske tunge kjøretøy innom, eller planer om det? Vi hjelper dere med ladeløsninger og søknad om
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
            <DeadlineText view={deadline} />
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
          <CalcControls input={input} result={result} set={set} replace={setInput} />
          <div className="figures-details">
            <Investment result={result} input={input} set={set} />
            <Operation result={result} input={input} />
            <Equipment input={input} result={result} set={set} replace={setInput} />
            <PowerAndEnergy result={result} input={input} />
          </div>
          <Assumptions input={input} result={result} set={set} />
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
              <DeadlineText view={deadline} />
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
        <div className="disclaimer">
          <p>
            Tallene er et foreløpig anslag basert på forutsetningene i kalkulatoren. Regnestykket inkluderer inntekter fra
            ladesalg, verdien av solproduksjonen og kostnader til strøm, nettleie og drift. Eventuelt anleggsbidrag
            avklares med nettselskapet. Endelig pris og søknadsgrunnlag avklares etter befaring og vurdering av
            nettkapasiteten.
          </p>
          <p>
            Spart diesel er ikke med i regnestykket. Planlegger dere å erstatte egne dieselbiler med elektriske
            lastebiler, kan lading på eget depot gi ytterligere besparelser på drivstoff. Hvor mye avhenger av
            kjørelengde, dieselforbruk og egen ladekostnad. Dette kan vi regne på sammen med dere, inkludert hvordan
            egne biler påvirker kapasiteten til ladesalg. Merprisen for elektriske kjøretøy må også inngå i den samlede
            vurderingen.
          </p>
          {input.chargers > 8 && <p>Illustrasjonen viser 8 av {input.chargers} ladeplasser.</p>}
        </div>
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
