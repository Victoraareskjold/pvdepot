"use client";

import { VEHICLE_TYPES, ASSUMPTIONS } from "@/lib/calc/assumptions";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import type { QualifyAnswers, QualifyResult } from "@/lib/calc/qualify";
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
  answer,
}: {
  answers: QualifyAnswers;
  answer: <K extends keyof QualifyAnswers>(key: K, value: QualifyAnswers[K]) => void;
}) {
  return (
    <>
      <Choice
        label="Er bedriften registrert i Foretaksregisteret?"
        value={answers.registered}
        options={[...ANSWER_OPTIONS]}
        columns={3}
        onChange={(v) => answer("registered", v)}
      />
      <Choice
        label="Skal laderne stå på eget depot eller anlegg?"
        value={answers.ownDepot}
        options={[...ANSWER_OPTIONS]}
        columns={3}
        onChange={(v) => answer("ownDepot", v)}
      />
      <Choice
        label="Hvor langt har dere kommet med elektriske kjøretøy?"
        value={answers.vehiclePlan}
        columns={2}
        options={[
          { value: "bestilt", label: "Bestilt" },
          { value: "planlagt", label: "Planlagt kjøp" },
          { value: "vurderer", label: "Vurderer" },
          { value: "nei", label: "Ingen planer" },
        ]}
        onChange={(v) => answer("vehiclePlan", v)}
      />
      <Choice
        label="Har dere allerede bestilt ladere eller startet arbeidet?"
        value={answers.started}
        options={[...ANSWER_OPTIONS]}
        columns={3}
        onChange={(v) => answer("started", v)}
      />
      <Choice
        label="Skal dere bruke lokasjonen i minst fem år?"
        value={answers.fiveYears}
        options={[...ANSWER_OPTIONS]}
        columns={3}
        onChange={(v) => answer("fiveYears", v)}
      />
      <Choice
        label="Har dere snakket med nettselskapet om kapasitet?"
        value={answers.gridTalked}
        options={[...ANSWER_OPTIONS]}
        columns={3}
        onChange={(v) => answer("gridTalked", v)}
      />
    </>
  );
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
                {c.eligible === 0 && <span className="tag">ikke støtte</span>}
                {c.eligible > 0 && c.eligible < c.cost && <span className="tag">delvis støtte</span>}
              </th>
              <td>{kr(c.cost)}</td>
            </tr>
          ))}
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
          value={Math.round(input.supportRate * 100)}
          min={10}
          max={60}
          step={5}
          unit="%"
          onChange={(v) => set("supportRate", v / 100)}
        />
        <p className="rank-figure">
          <span className="big">{int(result.krPerKw)}</span> kr støtte per kW ladeeffekt
        </p>
        <p className="field-hint">
          Enova rangerer søknadene på støtte per kW. Jo lavere tall, jo bedre plass i køen. Bare de best rangerte får
          støtte.
          {cutoff !== null && ` Grensen i forrige runde var ${int(cutoff)} kr per kW.`}
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

const VERDICT_TEXT: Record<QualifyResult["verdict"], { title: string; body: string }> = {
  kvalifiserer: { title: "Ser ut til å kvalifisere", body: "Svarene passer programmet. Nå handler det om å søke sterkt nok." },
  avklar: { title: "Kan kvalifisere", body: "Noen punkter må avklares før dere søker." },
  "kvalifiserer-ikke": { title: "Kvalifiserer trolig ikke nå", body: "Minst ett krav er ikke oppfylt." },
};

export function Check({ check }: { check: QualifyResult }) {
  const v = VERDICT_TEXT[check.verdict];
  return (
    <article className={`card verdict verdict-${check.verdict}`}>
      <h3>Støttesjekk</h3>
      <p className="verdict-title">{v.title}</p>
      <p>{v.body}</p>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={check.readiness} aria-label="Hvor klar søknaden er">
        <span style={{ width: `${check.readiness}%` }} />
      </div>
      <p className="field-hint">Klar for søknad: {check.readiness} av 100</p>
      <ul className="findings">
        {check.findings.map((f, i) => (
          <li key={i} className={`finding-${f.kind}`}>
            {f.text}
          </li>
        ))}
      </ul>
      {check.redirect && (
        <p>
          Se heller{" "}
          <a href={check.redirect.href} target="_blank" rel="noreferrer">
            {check.redirect.label}
          </a>
          .
        </p>
      )}
    </article>
  );
}
