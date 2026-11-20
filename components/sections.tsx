"use client";

import { VEHICLE_TYPES, ASSUMPTIONS } from "@/lib/calc/assumptions";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import {
  CHECK_DISCLAIMER,
  ctaFor,
  followUpVisible,
  QUESTIONS,
  VERDICT_TEXT,
  type QualifyAnswers,
  type QualifyResult,
} from "@/lib/calc/qualify";
import { int, kr, pct, dec } from "@/lib/format";
import { Slider, Choice } from "./controls";

const ANSWER_OPTIONS = [
  { value: "ja", label: "Ja" },
  { value: "nei", label: "Nei" },
  { value: "usikker", label: "Usikker" },
] as const;

/* ---------------- Steg ---------------- */

export type Setter = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) => void;

export function VehicleStep({ input, result, set }: { input: PlannerInput; result: PlannerResult; set: Setter }) {
  const dwellWarning = result.warnings.find((w) => w.id === "dwell-too-short");
  return (
    <>
      <Choice
        label="Type kjøretøy"
        value={input.vehicleType}
        columns={2}
        options={VEHICLE_TYPES.map((v) => ({ value: v.id, label: v.label, hint: v.hint }))}
        onChange={(v) => set("vehicleType", v)}
      />
      <Slider
        label="Elektriske kjøretøy på depotet"
        value={input.vehicles}
        min={1}
        max={40}
        step={1}
        onChange={(v) => set("vehicles", v)}
      />
      <Slider
        label="Kjørelengde per kjøretøy"
        value={input.kmPerDay}
        min={30}
        max={700}
        step={10}
        unit="km per dag"
        onChange={(v) => set("kmPerDay", v)}
      />
      <Slider
        label="Tid på depotet"
        value={input.dwellHours}
        min={2}
        max={16}
        step={1}
        unit="timer per døgn"
        onChange={(v) => set("dwellHours", v)}
      />
      <Slider
        label="Driftsdøgn"
        value={input.operatingDays}
        min={150}
        max={365}
        step={5}
        unit="per år"
        onChange={(v) => set("operatingDays", v)}
      />
      <p className={`derived${dwellWarning ? " is-warning" : ""}`}>
        {dwellWarning ? (
          <>
            Hver bil trenger {int(result.dailyKwhPerVehicle)} kWh per døgn, som krever {dwellWarning.neededKw} kW på{" "}
            {input.dwellHours} timer. Det er mer enn største lader ({result.chargerKw} kW). Øk tiden på depotet, eller
            kombiner med lading underveis.
          </>
        ) : (
          <>
            Hver bil trenger omtrent {int(result.dailyKwhPerVehicle)} kWh per døgn. Det holder med{" "}
            {result.chargePoints} ladere på {result.chargerKw} kW.
          </>
        )}
      </p>
    </>
  );
}

export function RoofStep({ input, result, set }: { input: PlannerInput; result: PlannerResult; set: Setter }) {
  return (
    <>
      <Slider
        label="Takflate på bygget"
        value={input.roofM2}
        min={0}
        max={20000}
        step={100}
        unit="m²"
        format={int}
        onChange={(v) => set("roofM2", v)}
      />
      <Slider
        label="Del av taket med solceller"
        value={Math.round(input.solarCoverage * 100)}
        min={0}
        max={100}
        step={5}
        unit="%"
        onChange={(v) => set("solarCoverage", v / 100)}
        hint={
          input.solarCoverage > 0 && input.roofM2 > 0
            ? `Gir omtrent ${int(result.annual.solarKwh / 1000)} MWh i året, tilsvarende ${pct(result.annual.solarShareOfCharging)} av ladebehovet.`
            : undefined
        }
      />
    </>
  );
}

export function PowerStep({ input, result, set }: { input: PlannerInput; result: PlannerResult; set: Setter }) {
  const gridKnown = input.gridSpareKw !== null;
  return (
    <>
      <div className="field">
        <div className="field-head">
          <span className="label">Ledig effekt i nettilknytningen</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!gridKnown}
              onChange={(e) => set("gridSpareKw", e.target.checked ? null : 200)}
            />
            Vet ikke
          </label>
        </div>
        {gridKnown ? (
          <Slider
            label="Ledig effekt"
            value={input.gridSpareKw ?? 0}
            min={0}
            max={3000}
            step={25}
            unit="kW"
            format={int}
            onChange={(v) => set("gridSpareKw", v)}
          />
        ) : (
          <p className="field-hint">
            Vi regner som om nettet holder. Vi kan sjekke kapasiteten med nettselskapet for dere.
          </p>
        )}
      </div>
      <Slider
        label="Batteri"
        value={input.batteryKwh}
        min={0}
        max={3000}
        step={50}
        unit="kWh"
        format={int}
        onChange={(v) => set("batteryKwh", v)}
        hint={
          input.batteryKwh > 0
            ? `Gir ${int(result.batteryKw)} kW ekstra ladeeffekt når nettet ikke strekker til.`
            : "Et batteri kan erstatte dyr nettforsterkning og telles med i støttegrunnlaget når det trengs for laderne."
        }
      />
      {result.gridDeficitKw > 0 && (
        <p className="derived is-warning">
          Laderne trenger {int(result.managedPeakKw)} kW med laststyring. Det mangler {int(result.gridDeficitKw)} kW, som
          gir en anslått nettforsterkning på {kr(result.costs.find((c) => c.id === "grid")!.cost)}.
        </p>
      )}
    </>
  );
}

export function CheckStep({
  answers,
  onAnswer,
}: {
  answers: QualifyAnswers;
  onAnswer: (id: string, value: string) => void;
}) {
  return (
    <>
      {QUESTIONS.map((q, i) => (
        <div key={q.id} className="check-q">
          <Choice
            label={`${i + 1}. ${q.text}`}
            help={q.help}
            value={answers[q.id]}
            options={q.options.map((o) => ({ value: o.value, label: o.label }))}
            columns={choiceColumns(q.options)}
            onChange={(v) => onAnswer(q.id, v)}
          />
          {q.followUp && followUpVisible(q, answers) && (
            <div className="check-followup">
              <Choice
                label={q.followUp.text}
                help={q.followUp.help}
                value={answers[q.followUp.id]}
                options={q.followUp.options.map((o) => ({ value: o.value, label: o.label }))}
                columns={choiceColumns(q.followUp.options)}
                onChange={(v) => onAnswer(q.followUp!.id, v)}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/** Korte svar side om side, lange svar under hverandre. */
function choiceColumns(options: { label: string }[]) {
  const longest = Math.max(...options.map((o) => o.label.length));
  if (longest > 26) return 1;
  if (longest > 12 || options.length > 3) return 2;
  return options.length;
}

/* ---------------- Resultater ---------------- */

export function Investment({ result, input, set }: { result: PlannerResult; input: PlannerInput; set: Setter }) {
  const lines = result.costs.filter((c) => c.cost > 0);
  const cutoff = ASSUMPTIONS.enovaHistoricalCutoffKrPerKw;
  return (
    <article className="card">
      <h3>Investering og støtte</h3>
      <table className="ledger">
        <tbody>
          {lines.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                {c.label}
                {c.id === "battery" && c.eligible === 0 && <span className="tag">ikke støtte</span>}
                {c.eligible > 0 && c.eligible < c.cost && <span className="tag">delvis støtte</span>}
              </th>
              <td>{kr(c.cost)}</td>
            </tr>
          ))}
          {input.gridSpareKw === null && (
            <tr className="extra">
              <th scope="row">Nettilknytning</th>
              <td>kommer i tillegg</td>
            </tr>
          )}
          <tr className="sum">
            <th scope="row">Samlet investering</th>
            <td>{kr(result.totalCost)}</td>
          </tr>
          <tr className="support">
            <th scope="row">Enova-støtte</th>
            <td>− {kr(result.support)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Egen investering</th>
            <td>{kr(result.netInvestment)}</td>
          </tr>
        </tbody>
      </table>

      <div className="rank">
        <Slider
          label="Støttegrad dere søker om"
          value={Math.round(result.supportRate * 100)}
          min={5}
          max={60}
          step={1}
          unit="%"
          onChange={(v) => set("supportRate", v / 100)}
          hint={
            <label className="inline-check">
              <input
                type="checkbox"
                checked={input.supportRate === null}
                onChange={(e) => set("supportRate", e.target.checked ? null : Math.round(result.supportRate * 100) / 100)}
              />
              Velg automatisk, så søknaden holder seg under grensen
            </label>
          }
        />
        <p className={`rank-figure${result.competitive === false ? " is-warning" : ""}`}>
          <span className="big">{int(result.krPerKw)}</span> kr støtte per kW ladeeffekt
        </p>
        <p className="field-hint">
          Enova rangerer søknadene på støtte per kW samtidig ladeeffekt med laststyring (her {int(result.availableKw)} kW).
          Jo lavere tall, jo bedre plass i køen.
          {cutoff !== null &&
            (result.competitive
              ? ` I de siste rundene har bare søknader under ${int(cutoff)} kr per kW fått støtte, og dette er under.`
              : ` I de siste rundene har bare søknader under ${int(cutoff)} kr per kW fått støtte. Dette er over, så søknaden vil trolig få avslag.`)}
          {result.supportCapped && " Støtten er begrenset av taket på 3 mill. kr."}
        </p>
      </div>
    </article>
  );
}

export function Operation({ result }: { result: PlannerResult }) {
  const a = result.annual;
  return (
    <article className="card">
      <h3>Drift per år</h3>
      <table className="ledger">
        <tbody>
          <tr>
            <th scope="row">Diesel i dag</th>
            <td>{kr(a.dieselCost)}</td>
          </tr>
          <tr>
            <th scope="row">Strøm til lading</th>
            <td>− {kr(a.electricityCost)}</td>
          </tr>
          <tr className="sum">
            <th scope="row">Spart drivstoff</th>
            <td>{kr(a.fuelSaving)}</td>
          </tr>
          {a.solarValue > 0 && (
            <tr>
              <th scope="row">Solstrøm</th>
              <td>{kr(a.solarValue)}</td>
            </tr>
          )}
          {a.peakSaving > 0 && (
            <tr>
              <th scope="row">Lavere effektledd</th>
              <td>{kr(a.peakSaving)}</td>
            </tr>
          )}
          <tr className="total">
            <th scope="row">Spart per år</th>
            <td>{kr(a.totalSaving)}</td>
          </tr>
        </tbody>
      </table>
      <div className="facts">
        <p>
          <span className="big">{result.paybackYears ? dec(result.paybackYears) : "–"}</span> år til egen investering
          er tjent inn
        </p>
        <p>
          <span className="big">{int(a.co2Tonnes)}</span> tonn mindre CO₂ i året
        </p>
      </div>
      <p className="field-hint">
        Strøm {dec(ASSUMPTIONS.electricityPrice)} kr/kWh og diesel {ASSUMPTIONS.dieselPrice} kr/l,
        eks. mva. {int(a.chargingKwh / 1000)} MWh lading i året.
      </p>
    </article>
  );
}

export function Check({ check, onCta }: { check: QualifyResult; onCta?: () => void }) {
  const v = VERDICT_TEXT[check.verdict];
  return (
    <article className={`card verdict verdict-${check.verdict}`} aria-live="polite">
      <h3>Støttesjekk</h3>
      <p className="verdict-title">{v.title}</p>
      {v.body && <p>{v.body}</p>}
      <p className="check-count">
        {check.answered} av {check.total} spørsmål besvart
      </p>
      {check.findings.length > 0 && (
        <ul className="findings">
          {check.findings.map((f, i) => (
            <li key={i} className={`finding-${f.status}`}>
              {f.text}
            </li>
          ))}
        </ul>
      )}
      {onCta && (
        <button type="button" className="btn btn-energy verdict-cta" onClick={onCta}>
          {ctaFor(check.verdict)}
        </button>
      )}
      <p className="field-hint check-disclaimer">{CHECK_DISCLAIMER}</p>
    </article>
  );
}
