import { VEHICLE_TYPES } from "./assumptions";
import { DEFAULT_INPUT, type PlannerInput, type PlannerResult } from "./model";
import { int, krExact } from "../format";

/**
 * Kundens oppsett i kalkylen, til henvendelsen (Asbjørn, 19.11 og 24.11.2026):
 * om kunden har endret noe, hva som er endret (standard → valgt), hele
 * oppsettet ved innsending og det kalkylen regnet ut. Et felt regnes som
 * endret bare når det vises annerledes enn standarden, så en verdi som er
 * endret og satt tilbake (også via sliderne) ikke telles. Teksten lages i det
 * skjemaet sendes og endres ikke senere.
 */

interface Field {
  key: keyof PlannerInput;
  label: string;
  group: string;
  show: (input: PlannerInput) => string;
}

const nb = (n: number, max = 2) => n.toLocaleString("nb-NO", { maximumFractionDigits: max });
const kwh = (n: number) => `${int(n)} kWh`;
const vehicleLabel = (id: PlannerInput["vehicleType"]) => VEHICLE_TYPES.find((v) => v.id === id)?.label ?? id;
const supportLabel = (i: PlannerInput) =>
  i.supportMode === "none"
    ? "Ingen støtte"
    : i.supportMode === "score"
      ? `DC-ladeeffekt × ${int(i.supportScore)} kr/kW`
      : `Søkebeløp ${krExact(i.supportAmount)}`;

export const SETUP_FIELDS: Field[] = [
  { group: "Økonomi", key: "buildingKwh", label: "Byggets årsforbruk i dag", show: (i) => `${kwh(i.buildingKwh)} per år` },
  { group: "Økonomi", key: "deliveredKwh", label: "Lading levert til kjøretøy", show: (i) => `${kwh(i.deliveredKwh)} DC per år` },
  {
    group: "Økonomi",
    key: "billedShare",
    label: "Salg til andre",
    show: (i) => `${nb(i.billedShare * 100, 1)} % (egne kjøretøy ${nb((1 - i.billedShare) * 100, 1)} %)`,
  },
  { group: "Økonomi", key: "salePrice", label: "Salgspris til andre", show: (i) => `${nb(i.salePrice)} kr/kWh` },

  { group: "Utstyr", key: "chargers", label: "DC-ladere", show: (i) => `${i.chargers}` },
  { group: "Utstyr", key: "chargerKw", label: "Effekt per lader", show: (i) => `${int(i.chargerKw)} kW` },
  { group: "Utstyr", key: "solarKwp", label: "Solceller", show: (i) => `${nb(i.solarKwp, 1)} kWp` },
  { group: "Utstyr", key: "batteryUnits", label: "Batterienheter", show: (i) => `${i.batteryUnits}` },

  { group: "Enova", key: "supportMode", label: "Støtte", show: supportLabel },

  { group: "Strøm og nettleie", key: "spotPrice", label: "Innkjøpspris strøm", show: (i) => `${nb(i.spotPrice, 4)} kr/kWh` },
  { group: "Strøm og nettleie", key: "energyFee", label: "Energiledd", show: (i) => `${nb(i.energyFee, 4)} kr/kWh` },
  { group: "Strøm og nettleie", key: "elTax", label: "Elavgift", show: (i) => `${nb(i.elTax, 4)} kr/kWh` },
  { group: "Strøm og nettleie", key: "exportPrice", label: "Pris på soloverskudd", show: (i) => `${nb(i.exportPrice, 4)} kr/kWh` },
  { group: "Strøm og nettleie", key: "powerFeeSummer", label: "Effektledd sommer", show: (i) => `${nb(i.powerFeeSummer)} kr/kW per måned` },
  { group: "Strøm og nettleie", key: "powerFeeWinter", label: "Effektledd vinter", show: (i) => `${nb(i.powerFeeWinter)} kr/kW per måned` },
  { group: "Strøm og nettleie", key: "peakBeforeKw", label: "Nettopp før prosjektet", show: (i) => `${int(i.peakBeforeKw)} kW` },
  { group: "Strøm og nettleie", key: "peakUnmanagedKw", label: "Nettopp med ladere uten styring", show: (i) => `${int(i.peakUnmanagedKw)} kW` },
  { group: "Strøm og nettleie", key: "peakManagedKw", label: "Nettopp med styring", show: (i) => `${int(i.peakManagedKw)} kW` },
  { group: "Strøm og nettleie", key: "opex", label: "Drift og service", show: (i) => `${krExact(i.opex)} per år` },

  { group: "Hjelp til ladevolum", key: "vehicleType", label: "Type kjøretøy", show: (i) => vehicleLabel(i.vehicleType) },
  { group: "Hjelp til ladevolum", key: "vehicles", label: "Kjøretøy", show: (i) => `${i.vehicles}` },
  { group: "Hjelp til ladevolum", key: "kmPerDay", label: "Kjørelengde", show: (i) => `${int(i.kmPerDay)} km per dag` },
  { group: "Hjelp til ladevolum", key: "operatingDays", label: "Driftsdøgn", show: (i) => `${i.operatingDays} per år` },
];

export interface SetupChange {
  label: string;
  from: string;
  to: string;
}

export function setupChanges(input: PlannerInput, defaults: PlannerInput = DEFAULT_INPUT): SetupChange[] {
  return SETUP_FIELDS.map((f) => ({ label: f.label, from: f.show(defaults), to: f.show(input) })).filter(
    (c) => c.from !== c.to,
  );
}

const years = (n: number | null) => (n === null ? null : n.toLocaleString("nb-NO", { maximumFractionDigits: 2 }));

/** Tekstblokken som følger henvendelsen. */
export function describeSetup(input: PlannerInput, r: PlannerResult, defaults: PlannerInput = DEFAULT_INPUT): string[] {
  const changes = setupChanges(input, defaults);
  const lines: string[] = [];
  lines.push(`Kunden har endret kalkylen: ${changes.length ? "Ja" : "Nei"}`);
  if (changes.length) {
    lines.push("Endret (standard → kundens valg):");
    for (const c of changes) lines.push(`  ${c.label}: ${c.from} → ${c.to}`);
  } else {
    lines.push("Ingen endringer – standardverdiene i kalkylen er brukt.");
  }

  lines.push("");
  lines.push(changes.length ? "Oppsett ved innsending:" : "Oppsett ved innsending (standardverdier):");
  let group = "";
  for (const f of SETUP_FIELDS) {
    if (f.group !== group) {
      group = f.group;
      lines.push(`  ${group}:`);
    }
    const shown = f.show(input);
    const isDefault = shown === f.show(defaults);
    lines.push(`    ${f.label}: ${shown}${changes.length && isDefault ? " (standard)" : ""}`);
  }

  const e = r.energy;
  lines.push("");
  lines.push("Beregnet av kalkylen:");
  lines.push(
    `  Utstyr: ${input.chargers} × ${int(input.chargerKw)} kW DC (${int(r.nameplateKw)} kW), ${nb(input.solarKwp, 1)} kWp sol, ` +
      `${input.batteryUnits} batterienheter (${int(r.batteryKwh)} kWh, ${int(r.batteryKw)} kW)`,
  );
  lines.push(`  Samtidig ladeeffekt i én time: ${nb(r.availableKw, 1)} kW DC`);
  lines.push(
    `  Energi: ${kwh(input.buildingKwh)} til bygg, ${kwh(e.chargerAcKwh)} inn på laderne, ${kwh(input.deliveredKwh)} levert ` +
      `(${kwh(e.billedKwh)} fakturert, ${kwh(e.ownKwh)} egne kjøretøy)`,
  );
  lines.push(`  Investering: ${r.investment === null ? "må avklares (utstyr uten pris)" : krExact(r.investment)}`);
  lines.push(
    `  Enova-støtte: ${krExact(r.support)} (laveste av ${krExact(r.supportBasis.requested)}, ${krExact(r.supportBasis.cap)}` +
      `${r.supportBasis.rateCap !== null ? ` og 60 % av totalsummen ${krExact(r.supportBasis.rateCap)}` : ""}` +
      `${r.supportRate !== null ? `; ${nb(r.supportRate * 100, 1)} % støttegrad` : ""})`,
  );
  if (r.netInvestment !== null) lines.push(`  Egen investering: ${krExact(r.netInvestment)}`);
  lines.push(`  Årlig netto før renter og skatt: ${krExact(r.annualNet)}`);
  if (r.netAfterPeriod !== null) lines.push(`  Netto over ${r.periodYears} år etter investering: ${krExact(r.netAfterPeriod)}`);
  lines.push(
    `  Tilbakebetaling ved fullt ladesalg: ${
      r.investment === null ? "pris må avklares" : r.paybackYears === null ? "tjenes ikke inn" : `${years(r.paybackYears)} år`
    }${r.rampUp.paybackYears !== null ? ` (${years(r.rampUp.paybackYears)} år med gradvis oppstart)` : ""}`,
  );
  return lines;
}
