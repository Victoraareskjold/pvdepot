"use client";

import { ASSUMPTIONS, BATTERY_UNIT, SOLAR, STANDARD_PACKAGE } from "@/lib/calc/assumptions";
import {
  chargingShare,
  DEFAULT_INPUT,
  withChargingShare,
  type PlannerInput,
  type PlannerResult,
  type SupportMode,
} from "@/lib/calc/model";
import {
  CHECK_DISCLAIMER,
  ctaFor,
  followUpVisible,
  QUESTIONS,
  VERDICT_TEXT,
  type QualifyAnswers,
  type QualifyResult,
} from "@/lib/calc/qualify";
import { int, krExact } from "@/lib/format";
import { Slider, Choice, NumberField } from "./controls";

export type Setter = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) => void;

/* ---------------- Tekster ---------------- */

/** Rett under resultatkortene, også i regnestykket (punkt 3). */
export const DIESEL_NOTE =
  "Spart diesel er ikke med i regnestykket. Hvis dere senere erstatter egne dieselbiler med elektriske lastebiler, kan dere også spare drivstoffkostnader. Hvor mye dere sparer, avhenger av kjørelengde, dieselforbruk og hva det koster å lade egne biler.";

/** Ved tilbakebetalingstiden. */
export const PAYBACK_NOTE =
  "Anslaget forutsetter fullt ladesalg fra første driftsår. Bruker dere tid på å bygge opp trafikken, tar det lengre tid å tjene inn investeringen.";

export const NOT_PAID_BACK = "Investeringen tjenes ikke inn med disse forutsetningene.";
export const PRICE_UNKNOWN = "Investeringspris må avklares";

const WORDS = ["null", "én", "to", "tre", "fire", "fem", "seks", "sju", "åtte", "ni", "ti", "elleve", "tolv"];
/** 6 → «seks», 14 → «14» */
export const word = (n: number) => WORDS[n] ?? String(n);
const nb = (n: number, max = 2, min = 0) =>
  n.toLocaleString("nb-NO", { maximumFractionDigits: max, minimumFractionDigits: min });
const kwh = (n: number) => `${int(n)} kWh`;
const pcText = (v: number) => `${nb(v, 1)} %`;

/** Utstyret i én setning, for investeringsteksten og depotet. */
export function equipmentText(input: PlannerInput, r: PlannerResult): string {
  const chargers = `${word(input.chargers)} DC-${input.chargers === 1 ? "lader" : "ladere"} på ${int(input.chargerKw)} kW`;
  const solar = input.solarKwp > 0 ? `${nb(input.solarKwp, 1)} kWp solceller` : "ingen solceller";
  const battery =
    input.batteryUnits > 0
      ? `${word(input.batteryUnits)} ${input.batteryUnits === 1 ? "batterienhet" : "batterienheter"} med til sammen ${kwh(r.batteryKwh)} brukbar kapasitet og ${int(r.batteryKw)} kW kontinuerlig utladningseffekt`
      : "uten batteri";
  return `${chargers}, ${solar}, ${battery} og smart styring`;
}

/** «3,9 år», «Pris må avklares» eller «Tjenes ikke inn» */
export function paybackLabel(r: PlannerResult, decimals = 1): string {
  if (r.investment === null) return "Pris må avklares";
  if (r.paybackYears === null) return "Tjenes ikke inn";
  return `${nb(r.paybackYears, decimals, decimals)} år`;
}

/* ---------------- Støttesjekk ---------------- */

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

/* ---------------- Se hele regnestykket ---------------- */

/** Forbruk, ladevolum, fordeling og pris. Øverst i regnestykket. */
export function CalcControls({
  input,
  result: r,
  set,
  replace,
}: {
  input: PlannerInput;
  result: PlannerResult;
  set: Setter;
  replace: (next: PlannerInput) => void;
}) {
  const share = chargingShare(input);
  const total = input.buildingKwh + r.energy.chargerAcKwh;
  return (
    <article className="card calc-controls">
      <h3>Regn med egne tall</h3>
      <div className="calc-grid">
        <NumberField
          label="Byggets årsforbruk i dag, uten nye ladere"
          value={input.buildingKwh}
          unit="kWh"
          onChange={(v) => set("buildingKwh", v)}
        />
        <NumberField
          label="Hvor mye skal kjøretøyene lade i året?"
          value={input.deliveredKwh}
          unit="kWh levert"
          onChange={(v) => set("deliveredKwh", v)}
        />
      </div>
      <Slider
        label="Fordeling av strømforbruket – bygg og lading"
        value={share * 100}
        min={0}
        max={100}
        step={0.5}
        format={(v) => `${pcText(100 - v)} bygg / ${pcText(v)} lading`}
        onChange={(v) => replace(withChargingShare(input, v / 100))}
        hint={
          total > 0 ? (
            <>
              {kwh(input.buildingKwh)} til bygg og {kwh(r.energy.chargerAcKwh)} til ladere av totalt {kwh(total)}. Med
              ladetap gir {kwh(r.energy.chargerAcKwh)} til laderne {kwh(input.deliveredKwh)} levert til kjøretøyene.
            </>
          ) : (
            "0 kWh til bygg og 0 kWh til ladere."
          )
        }
      />
      <Slider
        label="Hvem bruker ladingen?"
        value={input.billedShare * 100}
        min={0}
        max={100}
        step={5}
        format={(v) => `${pcText(v)} salg til andre / ${pcText(100 - v)} egne kjøretøy`}
        onChange={(v) => set("billedShare", v / 100)}
        hint={
          <>
            {kwh(r.energy.billedKwh)} fakturert og {kwh(r.energy.ownKwh)} til egne kjøretøy. Bare fakturert energi gir
            salgsinntekt. For egne kjøretøy er strømkostnaden med, mens spart diesel må regnes separat.
          </>
        }
      />
      <div className="calc-grid">
        <NumberField
          label="Salgspris til andre"
          value={input.salePrice}
          decimals={2}
          max={50}
          unit="kr/kWh eks. mva."
          onChange={(v) => set("salePrice", v)}
        />
        <Slider
          label="Juster prisen"
          value={input.salePrice}
          min={0}
          max={8}
          step={0.05}
          unit="kr/kWh"
          format={(v) => nb(v, 2, 2)}
          onChange={(v) => set("salePrice", v)}
        />
      </div>
      <button type="button" className="link-btn calc-reset" onClick={() => replace(DEFAULT_INPUT)}>
        Tilbakestill til eksemplet
      </button>
    </article>
  );
}

/** Ladere, sol og batteri. Avvik fra standardpakken har ingen bekreftet pris. */
export function Equipment({ input, result: r, set, replace }: { input: PlannerInput; result: PlannerResult; set: Setter; replace: (next: PlannerInput) => void }) {
  const full = r.availableKw >= r.nameplateKw - 0.5 && r.nameplateKw > 0;
  const m2 = input.solarKwp / (SOLAR.kwpPerM2 * SOLAR.refCoverage);
  return (
    <article className="card">
      <h3>Utstyr</h3>
      <Slider label="DC-ladere" value={input.chargers} min={1} max={12} step={1} onChange={(v) => set("chargers", v)} />
      <Choice
        label="Effekt per lader"
        value={String(input.chargerKw)}
        columns={ASSUMPTIONS.chargerSizesKw.length}
        options={ASSUMPTIONS.chargerSizesKw.map((k) => ({ value: String(k), label: `${k} kW` }))}
        onChange={(v) => set("chargerKw", Number(v))}
      />
      <Slider
        label="Solceller"
        value={input.solarKwp}
        min={0}
        max={600}
        step={1}
        unit="kWp"
        onChange={(v) => set("solarKwp", v)}
        hint={
          input.solarKwp > 0
            ? `Ca. ${kwh(r.energy.solarKwh)} i året. Tilsvarer ${int(m2)} m² tak ved ${int(SOLAR.refCoverage * 100)} % dekning.`
            : "Uten solceller blir solproduksjon og solinntekt null."
        }
      />
      <Slider
        label="Batterienheter"
        value={input.batteryUnits}
        min={0}
        max={14}
        step={1}
        onChange={(v) => set("batteryUnits", v)}
        hint={`${input.batteryUnits} × ${BATTERY_UNIT.kwh} kWh = ${kwh(r.batteryKwh)} brukbar kapasitet, ${int(r.batteryKw)} kW kontinuerlig utladning.`}
      />
      <p className="derived">
        {full
          ? `Alle ${word(input.chargers)} ladeplassene kan levere ${int(input.chargerKw)} kW samtidig i minst én time, til sammen ${int(r.nameplateKw)} kW.`
          : `Ladeplassene kan levere ${nb(r.availableKw, 1)} kW DC samtidig i én time, av ${int(r.nameplateKw)} kW merkeeffekt.`}{" "}
        Forutsetter {int(input.peakManagedKw)} kW nettuttak, {int(input.peakBeforeKw)} kW samtidig bygglast, ingen sol og
        tilstrekkelig ladetilstand i batteriet.
      </p>
      {!r.standardPackage && (
        <p className="derived is-warning">
          {r.investment === null
            ? `${PRICE_UNKNOWN} for dette utstyret. Standardpakken koster ${krExact(STANDARD_PACKAGE.price)} eks. mva.`
            : "Prisen er standardpakken justert for utstyret dere har valgt."}{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              replace({
                ...input,
                chargers: STANDARD_PACKAGE.chargers,
                chargerKw: STANDARD_PACKAGE.chargerKw,
                solarKwp: STANDARD_PACKAGE.solarKwp,
                batteryUnits: STANDARD_PACKAGE.batteryUnits,
              })
            }
          >
            Tilbake til standardpakken
          </button>
        </p>
      )}
    </article>
  );
}

const SUPPORT_OPTIONS: { value: SupportMode; label: string }[] = [
  { value: "amount", label: "Søkebeløp" },
  { value: "score", label: "Ønsket score" },
  { value: "none", label: "Ingen støtte" },
];

export function Investment({ result: r, input, set }: { result: PlannerResult; input: PlannerInput; set: Setter }) {
  return (
    <article className="card">
      <h3>Investering og støtte</h3>
      <p className="card-lede">
        {r.standardPackage ? "Eksemplet gjelder et komplett installert anlegg med " : "Dere har valgt "}
        {equipmentText(input, r)}.{" "}
        {r.investment !== null ? (
          <>
            Samlet investering er {krExact(r.investment)} eks. mva.
            {r.support > 0 && (
              <>
                {" "}
                Med anslått Enova-støtte på {krExact(r.support)} blir egen investering {krExact(r.netInvestment!)}.
              </>
            )}
          </>
        ) : (
          <>{PRICE_UNKNOWN} for dette utstyret.</>
        )}{" "}
        Eventuelt anleggsbidrag avklares med nettselskapet.
      </p>
      <table className="ledger">
        <tbody>
          <tr>
            <th scope="row">Komplett installasjon</th>
            <td>{r.investment === null ? "avklares" : krExact(r.investment)}</td>
          </tr>
          <tr className="support">
            <th scope="row">Anslått Enova-støtte</th>
            <td>− {krExact(r.support)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Egen investering</th>
            <td>{r.netInvestment === null ? "avklares" : krExact(r.netInvestment)}</td>
          </tr>
          <tr className="extra">
            <th scope="row">Anleggsbidrag</th>
            <td>avklares med nettselskapet</td>
          </tr>
        </tbody>
      </table>

      <div className="rank">
        <Choice
          label="Støtte i regnestykket"
          value={input.supportMode}
          columns={3}
          options={SUPPORT_OPTIONS}
          onChange={(v) => set("supportMode", v)}
        />
        {input.supportMode === "amount" && (
          <NumberField
            label="Søkebeløp"
            value={input.supportAmount}
            unit="kr"
            onChange={(v) => set("supportAmount", v)}
          />
        )}
        {input.supportMode === "score" && (
          <NumberField
            label="Ønsket rangeringsscore"
            value={input.supportScore}
            unit="kr per kW"
            onChange={(v) => set("supportScore", v)}
            hint={`${int(input.supportScore)} kr × ${nb(r.availableKw, 1)} kW = ${krExact(input.supportScore * r.availableKw)}, høyst 3 mill. kr og 60 % av godkjente kostnader.`}
          />
        )}
        {input.supportMode !== "none" && (
          <p className="rank-figure">
            <span className="big">{int(r.krPerKw)}</span> kr støtte per kW ladeeffekt
          </p>
        )}
        <p className="field-hint">
          Enova rangerer søknadene på støtte delt på dokumentert samtidig ladeeffekt i minst én time (her{" "}
          {nb(r.availableKw, 1)} kW), forutsatt ingen annen offentlig støtte. Lavere tall gir bedre plass.
          {r.supportRate !== null && r.support > 0 && ` Støtten tilsvarer ${pcText(r.supportRate * 100)} av kostnadene.`}
          {r.supportLimitedBy === "cap" && " Støtten er begrenset av taket på 3 mill. kr."}
          {r.supportLimitedBy === "rate" && " Støtten er begrenset til 60 % av godkjente kostnader."} Batteriets
          støtteberettigelse må vurderes mot behov og vilkår. Ingen støtte er garantert.
        </p>
      </div>
    </article>
  );
}

export function Operation({ result: r, input }: { result: PlannerResult; input: PlannerInput }) {
  const ramp = r.rampUp;
  return (
    <article className="card">
      <h3>Drift per år</h3>
      <p className="card-lede">
        Ved fullt ladesalg: {kwh(input.deliveredKwh)} levert til kjøretøy og {kwh(r.energy.chargerAcKwh)} inn på laderne.
      </p>
      <table className="ledger ledger-how">
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.id}>
              <th scope="row">
                {l.label}
                <span className="how">{l.how}</span>
              </th>
              <td>{l.value < 0 ? `− ${krExact(-l.value)}` : krExact(l.value)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">Årlig netto før renter og skatt</th>
            <td>{r.annualNet < 0 ? `− ${krExact(-r.annualNet)}` : krExact(r.annualNet)}</td>
          </tr>
        </tbody>
      </table>
      <div className="facts">
        <p>
          <span className="big">{paybackLabel(r, 2)}</span>
          {r.investment !== null && r.paybackYears !== null && " enkel tilbakebetaling ved fullt ladesalg"}
        </p>
      </div>
      <p className="field-hint">
        {r.investment !== null && r.paybackYears === null ? NOT_PAID_BACK : PAYBACK_NOTE}
      </p>

      <h4>Med gradvis oppstart</h4>
      <table className="ledger">
        <tbody>
          {ramp.years.map((v, y) => (
            <tr key={y}>
              <th scope="row">
                {y < ramp.years.length - 1
                  ? `År ${y + 1}, ${int(ASSUMPTIONS.rampUp[y] * 100)} % av ladevolumet`
                  : `Fra år ${y + 1}, fullt volum`}
              </th>
              <td>{v < 0 ? `− ${krExact(-v)}` : krExact(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="field-hint">
        {ramp.paybackYears !== null
          ? `Tilbakebetaling fra oppstart: ${nb(ramp.paybackYears, 2, 2)} år. `
          : r.investment === null
            ? ""
            : `${NOT_PAID_BACK} `}
        Samme effekttopper, driftskostnader og solfordeling som ved full drift.
      </p>
      {r.netAfterPeriod !== null && (
        <p className="field-hint">
          Akkumulert netto etter investering over {r.periodYears} år: <strong>{krExact(r.netAfterPeriod)}</strong> ved
          fullt volum fra år 1. Faste priser, før renter, skatt og større reinvesteringer.
        </p>
      )}
      <p className="field-hint">{DIESEL_NOTE}</p>
    </article>
  );
}

export function PowerAndEnergy({ result: r, input }: { result: PlannerResult; input: PlannerInput }) {
  const e = r.energy;
  const p = r.power;
  return (
    <article className="card">
      <h3>Effekttopper og energi</h3>
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Forutsatt nettopp hver måned</th>
            <th scope="col" className="num">
              kW
            </th>
            <th scope="col" className="num">
              Effektledd per år
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Dagens bygg, uten ladere</th>
            <td>{int(input.peakBeforeKw)}</td>
            <td>{krExact(p.beforeCost)}</td>
          </tr>
          <tr>
            <th scope="row">Med ladere uten styring</th>
            <td>{int(input.peakUnmanagedKw)}</td>
            <td>{krExact(p.unmanagedCost)}</td>
          </tr>
          <tr>
            <th scope="row">Med ladere og styring</th>
            <td>{int(input.peakManagedKw)}</td>
            <td>{krExact(p.managedCost)}</td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint">
        Styringen reduserer effektkostnaden med {krExact(p.controlSaving)} per år sammenlignet med ustyrt lading.
        Regnestykket fører økningen fra dagens bygg til styrt drift én gang. Effektledd {nb(input.powerFeeSummer)} kr/kW
        per måned april–september og {nb(input.powerFeeWinter)} kr/kW oktober–mars.
      </p>

      <h4>Energi per år</h4>
      <table className="ledger">
        <tbody>
          <tr>
            <th scope="row">Kjøpt fra nettet</th>
            <td>{kwh(e.gridPurchaseKwh)}</td>
          </tr>
          <tr>
            <th scope="row">Solproduksjon</th>
            <td>{kwh(e.solarKwh)}</td>
          </tr>
          <tr>
            <th scope="row">Til bygget</th>
            <td>{kwh(input.buildingKwh)}</td>
          </tr>
          <tr>
            <th scope="row">Inn på laderne (inkl. ladetap)</th>
            <td>{kwh(e.chargerAcKwh)}</td>
          </tr>
          <tr>
            <th scope="row">Sol solgt til nettet</th>
            <td>{kwh(e.solarExportKwh)}</td>
          </tr>
          <tr>
            <th scope="row">Batteritap</th>
            <td>{kwh(e.solarBatteryLossKwh + e.gridBatteryLossKwh)}</td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint">
        Årsanslag med forutsatt nettopp. Faktisk fordeling, tap og månedsmaks krever last- og produksjonsprofiler time
        for time. Solfordelingen er et arbeidsanslag: {int(SOLAR.toBuilding * 100)} % direkte til bygget,{" "}
        {int(SOLAR.toChargers * 100)} % direkte til lading, {int(SOLAR.toBattery * 100)} % inn på batteriet og resten
        til nettet. En gevinst fra prishandel eller frekvensmarked er ikke med.
      </p>
    </article>
  );
}

/** Strømpriser, nettleie, effekttopper og drift. */
export function Assumptions({ input, result: r, set }: { input: PlannerInput; result: PlannerResult; set: Setter }) {
  const f = (key: keyof PlannerInput, label: string, unit: string, decimals = 0) => (
    <NumberField
      compact
      label={label}
      value={input[key] as number}
      unit={unit}
      decimals={decimals}
      onChange={(v) => set(key, v as never)}
    />
  );
  return (
    <details className="card more-assumptions">
      <summary>
        <h3>Flere forutsetninger</h3>
        <span>
          {ASSUMPTIONS.priceArea}, Elvia og standardverdiene
        </span>
      </summary>
      <p className="field-hint">
        {ASSUMPTIONS.tariffLabel} Ved ukjent nettselskap brukes Oslo-eksemplet. Marginal innkjøpskostnad er{" "}
        {nb(r.energy.marginalPrice, 4)} kr/kWh.
      </p>
      <div className="assumption-grid">
        {f("spotPrice", "Smart innkjøpspris", "kr/kWh", 4)}
        {f("energyFee", "Energiledd", "kr/kWh", 4)}
        {f("elTax", "Elavgift", "kr/kWh", 4)}
        {f("exportPrice", "Pris på soloverskudd", "kr/kWh", 4)}
        {f("powerFeeSummer", "Effektledd sommer", "kr/kW/mnd", 2)}
        {f("powerFeeWinter", "Effektledd vinter", "kr/kW/mnd", 2)}
        {f("peakBeforeKw", "Nettopp før prosjektet", "kW")}
        {f("peakUnmanagedKw", "Nettopp uten styring", "kW")}
        {f("peakManagedKw", "Nettopp med styring", "kW")}
        {f("opex", "Drift og service", "kr/år")}
      </div>
    </details>
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
