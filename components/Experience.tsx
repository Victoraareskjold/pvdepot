"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { calculate, DEFAULT_INPUT, type PlannerInput } from "@/lib/calc/model";
import {
  qualify,
  DEFAULT_ANSWERS,
  type QualifyAnswers,
} from "@/lib/calc/qualify";
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
 * Siden, ovenfra og ned som i skissen:
 * hook og nøkkeltall, slidere, 3D-depotet som scroll-seksjon,
 * bildekarusell, støttesjekk og skjema.
 */
export default function Experience({ theme }: { theme: SiteTheme }) {
  const [input, setInput] = useState<PlannerInput>(DEFAULT_INPUT);
  const [answers, setAnswers] = useState<QualifyAnswers>(DEFAULT_ANSWERS);
  const [deadline, setDeadline] =
    useState<ReturnType<typeof nextDeadline>>(null);
  const [details, setDetails] = useState(false);

  const result = useMemo(() => calculate(input), [input]);
  const check = useMemo(() => qualify(answers), [answers]);

  const set = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  const answer = <K extends keyof QualifyAnswers>(
    key: K,
    value: QualifyAnswers[K],
  ) => setAnswers((prev) => ({ ...prev, [key]: value }));

  useEffect(() => setDeadline(nextDeadline()), []);

  const go = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      className="page"
      style={{
        ["--accent" as string]: theme.accent,
        ["--energy" as string]: theme.energy,
      }}
    >
      <header className="hook wrap">
        <p className="hook-brand">
          <Image
            className="brand-logo"
            src={theme.logo.src}
            alt={`${theme.name} Sol`}
            width={theme.logo.width}
            height={theme.logo.height}
            priority
          />{" "}
          <span>Depotlading</span>
        </p>
        <h1>Elektriske lastebiler. Enova betaler inntil 60 %.</h1>
        <p className="hook-lede">
          Se hva lading på depotet koster, hva dere sparer, og om dere
          kvalifiserer til Enovas støtte.
          {deadline && (
            <>
              {" "}
              Neste søknadsfrist er{" "}
              <strong>{formatDeadline(deadline.date)}</strong>, om{" "}
              {deadline.daysLeft} dager.
            </>
          )}
        </p>
      </header>

      <section className="wrap figures" aria-label="Nøkkeltall">
        <KeyFigures result={result} />
        <div className="figures-foot">
          <button
            type="button"
            className="link-btn"
            aria-expanded={details}
            onClick={() => setDetails((d) => !d)}
          >
            {details ? "Skjul regnestykket" : "Se hele regnestykket"}
          </button>
          <button
            type="button"
            className="btn btn-energy"
            onClick={() => go("vurdering")}
          >
            Få en vurdering
          </button>
        </div>
        {details && (
          <div className="figures-details">
            <Investment result={result} input={input} set={set} />
            <Operation result={result} />
          </div>
        )}
      </section>

      <section className="wrap tune" aria-labelledby="tune-title">
        <h2 id="tune-title">Tilpass til depotet deres</h2>
        <Choice
          label="Type kjøretøy"
          value={input.vehicleType}
          onChange={(v) => set("vehicleType", v)}
          columns={4}
          options={VEHICLE_TYPES.map((v) => ({ value: v.id, label: v.label }))}
        />
        <div className="tune-grid">
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
        </div>
        <details className="more">
          <summary>Flere valg</summary>
          <div className="tune-grid">
            <Slider
              label="Tid på depotet"
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
                    onChange={(e) =>
                      set("gridSpareKw", e.target.checked ? null : 200)
                    }
                  />
                  Vet ikke, vi sjekker med nettselskapet
                </label>
              }
            />
          </div>
        </details>
      </section>

      <ScrollWorld input={input} result={result} theme={theme} />

      <section className="carousel-sec" aria-labelledby="carousel-title">
        <div className="wrap">
          <h2 id="carousel-title">Anlegg vi har bygget</h2>
          <p className="sec-lede">
            Fra grøft og nettilknytning til ferdig ladeplass. Smart Elektro gjør
            hele jobben.
          </p>
        </div>
        <Carousel />
      </section>

      <section
        className="wrap apply"
        id="vurdering"
        aria-labelledby="apply-title"
      >
        <h2 id="apply-title">Kvalifiserer dere?</h2>
        <p className="sec-lede">
          Seks spørsmål mot Enovas krav. Send inn, så går vi gjennom tallene og
          søknaden med dere.
        </p>
        <div className="apply-grid">
          <div className="card step-body">
            <CheckStep answers={answers} answer={answer} />
          </div>
          <Check check={check} />
        </div>
        <LeadForm
          theme={theme}
          result={result}
          check={check}
          input={input}
          answers={answers}
        />
        <p className="disclaimer">
          Tallene er et første anslag basert på typiske priser og forbruk, og
          sammenligner med diesel. Kjøretøyene er ikke med i investeringen.
          Endelig pris og søknadsgrunnlag avklares etter befaring og svar fra
          nettselskapet.
          {result.chargePoints > 8 &&
            ` Illustrasjonen viser 8 av ${result.chargePoints} ladeplasser.`}
        </p>
      </section>
    </div>
  );
}
