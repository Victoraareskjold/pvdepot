import { VEHICLE_TYPES } from "./assumptions";
import { DEFAULT_INPUT, type PlannerInput, type PlannerResult } from "./model";
import { int, kr, pct } from "../format";

/**
 * Kundens oppsett i kalkylen, til henvendelsen (Asbjørn, 19.11.2026):
 * om kunden har endret noe, hva som er endret (standard → valgt), og hele
 * oppsettet ved innsending med enheter. Sammenligner med standardverdiene
 * når skjemaet sendes, så en verdi som er endret og satt tilbake ikke
 * regnes som endret. Teksten lagres i henvendelsen og endres ikke senere.
 */

interface Field {
  key: keyof PlannerInput;
  label: string;
  show: (input: PlannerInput, r?: PlannerResult) => string;
}

const vehicleLabel = (id: PlannerInput["vehicleType"]) => VEHICLE_TYPES.find((v) => v.id === id)?.label ?? id;

export const SETUP_FIELDS: Field[] = [
  { key: "vehicleType", label: "Type kjøretøy", show: (i) => vehicleLabel(i.vehicleType) },
  { key: "vehicles", label: "Lastebiler som skal lade", show: (i) => `${i.vehicles}` },
  { key: "kmPerDay", label: "Kjørelengde per bil", show: (i) => `${int(i.kmPerDay)} km per dag` },
  { key: "roofM2", label: "Takflate", show: (i) => `${int(i.roofM2)} m²` },
  { key: "solarCoverage", label: "Andel av taket med solceller", show: (i) => pct(i.solarCoverage) },
  { key: "batteryKwh", label: "Batteri", show: (i) => `${int(i.batteryKwh)} kWh` },
  { key: "dwellHours", label: "Tid ved rampen", show: (i) => `${i.dwellHours} timer per døgn` },
  { key: "operatingDays", label: "Driftsdøgn", show: (i) => `${i.operatingDays} per år` },
  {
    key: "gridSpareKw",
    label: "Ledig effekt i nettilknytningen",
    show: (i) => (i.gridSpareKw === null ? "Vet ikke" : `${int(i.gridSpareKw)} kW`),
  },
  {
    key: "supportRate",
    label: "Støttegrad",
    show: (i, r) =>
      i.supportRate === null ? `Automatisk${r ? ` (${pct(r.supportRate)})` : ""}` : pct(i.supportRate),
  },
];

export interface SetupChange {
  label: string;
  from: string;
  to: string;
}

export function setupChanges(input: PlannerInput, defaults: PlannerInput = DEFAULT_INPUT): SetupChange[] {
  return SETUP_FIELDS.filter((f) => input[f.key] !== defaults[f.key]).map((f) => ({
    label: f.label,
    from: f.show(defaults),
    to: f.show(input),
  }));
}

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
  for (const f of SETUP_FIELDS) {
    const isDefault = input[f.key] === defaults[f.key];
    lines.push(`  ${f.label}: ${f.show(input, r)}${changes.length && isDefault ? " (standard)" : ""}`);
  }

  lines.push("");
  lines.push("Beregnet av kalkylen:");
  lines.push(`  Ladere: ${r.chargePoints} × ${r.chargerKw} kW DC (${int(r.nameplateKw)} kW totalt)`);
  lines.push(`  Samtidig ladeeffekt med laststyring: ${int(r.availableKw)} kW`);
  lines.push(`  Ladebehov per bil: ${int(r.dailyKwhPerVehicle)} kWh per døgn`);
  if (r.solarKwp > 0) lines.push(`  Solcelleanlegg: ${int(r.solarKwp)} kWp`);
  if (input.batteryKwh > 0) lines.push(`  Batteri: ${int(input.batteryKwh)} kWh, ${int(r.batteryKw)} kW`);
  if (r.gridDeficitKw > 0) lines.push(`  Nettforsterkning: ${int(r.gridDeficitKw)} kW mangler`);
  if (input.gridSpareKw === null) lines.push("  Nettilknytning: ikke avklart, kommer i tillegg");
  lines.push(`  Investering: ${kr(r.totalCost)} (støttegrunnlag ${kr(r.eligibleCost)})`);
  lines.push(`  Enova-støtte: ${kr(r.support)} (${pct(r.supportRate)}, ${int(r.krPerKw)} kr per kW)`);
  lines.push(`  Spart per år: ${kr(r.annual.totalSaving)}, nedbetalt på ${r.paybackYears ? r.paybackYears.toFixed(1).replace(".", ",") : "–"} år`);
  return lines;
}
