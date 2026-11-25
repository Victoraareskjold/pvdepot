import { ASSUMPTIONS as A, BATTERY_UNIT, SOLAR, STANDARD_PACKAGE as STD, VEHICLE_TYPES, type VehicleTypeId } from "./assumptions";

/**
 * Lønnsomhet ved bedriftslading (Asbjørn, 24.11.2026).
 *
 * Sammenligner det samme byggets strømregning før og etter prosjektet:
 * inntekt fra ladesalg, strøm til laderne, verdien av solproduksjonen,
 * batteritap, endring i effektledd og drift. Følger regnearket
 * «Lonnsomhet-bedriftslading-7-batterier.xlsx» rad for rad. Ett resultat
 * forsyner alle visninger: 3D-depotet, resultatkortene, «Se hele
 * regnestykket» og sammendraget i skjemaet. Alle beløp eks. mva.
 */

export type SupportMode = "amount" | "score" | "none";

export interface PlannerInput {
  /* Økonomi */
  /** Byggets årsforbruk i dag, uten nye ladere (kWh) */
  buildingKwh: number;
  /** Energi levert til kjøretøyene per år (kWh DC) */
  deliveredKwh: number;
  /** Andel av ladingen som faktureres andre (0–1). Resten er egne kjøretøy. */
  billedShare: number;
  /** Salgspris til andre, kr per kWh DC */
  salePrice: number;

  /* Utstyr */
  chargers: number;
  chargerKw: number;
  solarKwp: number;
  batteryUnits: number;

  /* Enova */
  supportMode: SupportMode;
  /**
   * score (standard): valgt DC-ladeeffekt × sats (4 000 kr/kW).
   * amount: eget søkebeløp. none: ingen støtte. Alltid høyst 3 mill. kr og
   * 60 % av totalsummen.
   */
  supportAmount: number;
  /** kr per kW valgt DC-ladeeffekt når supportMode = "score" */
  supportScore: number;

  /* Strøm og nettleie */
  spotPrice: number;
  energyFee: number;
  elTax: number;
  exportPrice: number;
  powerFeeSummer: number;
  powerFeeWinter: number;
  peakBeforeKw: number;
  peakUnmanagedKw: number;
  peakManagedKw: number;
  opex: number;

  /* Frivillig hjelp til å anslå ladevolumet */
  vehicleType: VehicleTypeId;
  vehicles: number;
  kmPerDay: number;
  operatingDays: number;
}

export const DEFAULT_INPUT: PlannerInput = {
  buildingKwh: 240_000,
  deliveredKwh: 380_000,
  billedShare: 1,
  salePrice: 4.5,

  chargers: STD.chargers,
  chargerKw: STD.chargerKw,
  solarKwp: STD.solarKwp,
  batteryUnits: STD.batteryUnits,

  supportMode: "score",
  supportAmount: STD.support,
  supportScore: A.defaultScoreKrPerKw,

  spotPrice: 0.88,
  energyFee: 0.05,
  elTax: 0.0713,
  exportPrice: 0.6,
  powerFeeSummer: 46,
  powerFeeWinter: 111,
  peakBeforeKw: 150,
  peakUnmanagedKw: 650,
  peakManagedKw: 300,
  opex: 75_000,

  vehicleType: "distribusjon",
  vehicles: 6,
  kmPerDay: 220,
  operatingDays: 250,
};

export interface AnnualLine {
  id: "revenue" | "charging" | "solarBuilding" | "solarCharging" | "solarExport" | "batteryLoss" | "power" | "opex";
  label: string;
  /** Hvordan posten er regnet, med kundens tall */
  how: string;
  value: number;
}

export interface PlannerResult {
  /** Utstyret er standardpakken med bekreftet totalpris */
  standardPackage: boolean;
  vehicle: (typeof VEHICLE_TYPES)[number];

  nameplateKw: number;
  batteryKwh: number;
  batteryKw: number;
  /** Tilgjengelig samtidig DC-effekt i én time (det Enova rangerer på) */
  availableKw: number;
  /** Batteriets bidrag når alle laderne går for fullt (kW AC) */
  batteryAssistKw: number;

  /** null = investeringspris må avklares (utstyr uten pris) */
  investment: number | null;
  eligibleCost: number | null;
  support: number;
  /** Støtte delt på godkjent kostnad */
  supportRate: number | null;
  krPerKw: number;
  supportLimitedBy: "cap" | "rate" | null;
  /** Grunnlaget for støtten: det laveste av de tre blir støtten */
  supportBasis: {
    /** Valgt DC-ladeeffekt × sats, eller eget søkebeløp (0 ved ingen støtte) */
    requested: number;
    /** 3 mill. kr */
    cap: number;
    /** 60 % av totalsummen (null når prisen ikke er kjent) */
    rateCap: number | null;
  };
  netInvestment: number | null;

  energy: {
    marginalPrice: number;
    chargerAcKwh: number;
    billedKwh: number;
    ownKwh: number;
    solarKwh: number;
    solarBuildingKwh: number;
    solarDirectChargingKwh: number;
    solarToBatteryKwh: number;
    /** Sol til lading, direkte og via batteriet etter tap */
    solarChargingKwh: number;
    solarExportKwh: number;
    solarBatteryLossKwh: number;
    gridBatteryKwh: number;
    gridBatteryLossKwh: number;
    gridPurchaseKwh: number;
  };

  power: {
    feePerKwYear: number;
    /** Nettopp med ladere uten styring, skalert med ladeeffekten */
    unmanagedPeakKw: number;
    /** Nettopp med styring: målet, men aldri lavere enn batteriet klarer */
    peakAfterKw: number;
    beforeCost: number;
    unmanagedCost: number;
    managedCost: number;
    /** Det styringen sparer mot ustyrt lading */
    controlSaving: number;
  };

  lines: AnnualLine[];
  annualNet: number;
  /** Enkel tilbakebetaling ved fullt ladesalg fra år 1. null = ikke tjent inn eller pris ukjent */
  paybackYears: number | null;

  rampUp: { years: number[]; paybackYears: number | null };
  periodYears: number;
  /** Akkumulert netto etter investering over perioden, fullt volum fra år 1 */
  netAfterPeriod: number | null;
}

/** Minus uten «−0» i visningen. */
const neg = (v: number) => (v === 0 ? 0 : -v);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Tall fra skjema kan være tomme eller rare. Ingen NaN eller negative mengder videre. */
const num = (v: number, min = 0, max = Number.MAX_SAFE_INTEGER) => (Number.isFinite(v) ? clamp(v, min, max) : min);

export function isStandardPackage(i: Pick<PlannerInput, "chargers" | "chargerKw" | "solarKwp" | "batteryUnits">) {
  return (
    i.chargers === STD.chargers &&
    i.chargerKw === STD.chargerKw &&
    i.solarKwp === STD.solarKwp &&
    i.batteryUnits === STD.batteryUnits
  );
}

/** Pris for valgt utstyr: standardpakken, eller standardpakken pluss prisforskjell. */
export function packagePrice(i: Pick<PlannerInput, "chargers" | "chargerKw" | "solarKwp" | "batteryUnits">): number | null {
  if (isStandardPackage(i)) return STD.price;
  const p = A.componentPrices;
  if (!p) return null;
  const price =
    STD.price +
    (i.chargers * i.chargerKw - STD.chargers * STD.chargerKw) * p.perChargerKw +
    (i.solarKwp - STD.solarKwp) * p.perSolarKwp +
    (i.batteryUnits - STD.batteryUnits) * BATTERY_UNIT.kwh * p.perBatteryKwh;
  return Math.max(0, price);
}

/** Ladevolum anslått fra kjøretøyene (energi levert til bilene, kWh DC per år). */
export function estimateDeliveredKwh(i: Pick<PlannerInput, "vehicleType" | "vehicles" | "kmPerDay" | "operatingDays">) {
  const v = VEHICLE_TYPES.find((t) => t.id === i.vehicleType) ?? VEHICLE_TYPES[0];
  return num(i.vehicles) * num(i.kmPerDay) * num(i.operatingDays, 0, 366) * v.kWhPerKm;
}

/** Andel av strømmen på AC-siden som går til laderne (første slider). */
export function chargingShare(i: Pick<PlannerInput, "buildingKwh" | "deliveredKwh">): number {
  const ac = num(i.buildingKwh) + num(i.deliveredKwh) / A.chargerEfficiency;
  return ac > 0 ? num(i.deliveredKwh) / A.chargerEfficiency / ac : 0;
}

/**
 * Flytter fordelingen mellom bygg og lading og holder summen på AC-siden
 * fast: ACsum = bygg + levertDC / 0,95.
 */
export function withChargingShare(i: PlannerInput, share: number): PlannerInput {
  const s = clamp(share, 0, 1);
  const ac = num(i.buildingKwh) + num(i.deliveredKwh) / A.chargerEfficiency;
  return { ...i, buildingKwh: ac * (1 - s), deliveredKwh: ac * s * A.chargerEfficiency };
}

export function calculate(raw: PlannerInput): PlannerResult {
  const i = {
    ...raw,
    buildingKwh: num(raw.buildingKwh),
    deliveredKwh: num(raw.deliveredKwh),
    billedShare: num(raw.billedShare, 0, 1),
    salePrice: num(raw.salePrice),
    chargers: Math.round(num(raw.chargers, 0, 100)),
    chargerKw: num(raw.chargerKw),
    solarKwp: num(raw.solarKwp),
    batteryUnits: Math.round(num(raw.batteryUnits, 0, 100)),
    supportAmount: num(raw.supportAmount),
    supportScore: num(raw.supportScore),
    spotPrice: num(raw.spotPrice),
    energyFee: num(raw.energyFee),
    elTax: num(raw.elTax),
    exportPrice: num(raw.exportPrice),
    powerFeeSummer: num(raw.powerFeeSummer),
    powerFeeWinter: num(raw.powerFeeWinter),
    peakBeforeKw: num(raw.peakBeforeKw),
    peakUnmanagedKw: num(raw.peakUnmanagedKw),
    peakManagedKw: num(raw.peakManagedKw),
    opex: num(raw.opex),
  };
  const vehicle = VEHICLE_TYPES.find((v) => v.id === i.vehicleType) ?? VEHICLE_TYPES[0];
  const effC = A.chargerEfficiency;
  const effB = A.batteryRoundTrip;

  // Effekt: alle laderne på full last i én time, dekket av nett og batteri.
  const nameplateKw = i.chargers * i.chargerKw;
  const batteryKwh = i.batteryUnits * BATTERY_UNIT.kwh;
  const batteryKw = i.batteryUnits * BATTERY_UNIT.kw;
  const batteryHourKw = Math.min(batteryKw, batteryKwh / 1);
  const availableKw = Math.min(nameplateKw, Math.max(0, (i.peakManagedKw - i.peakBeforeKw + batteryHourKw) * effC));
  const batteryAssistKw = Math.max(0, nameplateKw / effC + i.peakBeforeKw - i.peakManagedKw);

  // Investering og støtte
  const investment = packagePrice(i);
  const eligibleCost = investment === null ? null : investment * A.eligibleShare;
  const caps = [A.enovaMaxSupport, eligibleCost === null ? Infinity : eligibleCost * A.enovaMaxRate];
  const wanted = i.supportMode === "none" ? 0 : i.supportMode === "score" ? i.supportScore * nameplateKw : i.supportAmount;
  const support = Math.max(0, Math.min(wanted, ...caps));
  const supportLimitedBy = wanted > support ? (caps[0] <= caps[1] ? "cap" : "rate") : null;
  const supportRate = eligibleCost && eligibleCost > 0 ? support / eligibleCost : null;
  const krPerKw = availableKw > 0 ? support / availableKw : 0;
  const netInvestment = investment === null ? null : investment - support;

  // Energi
  const marginalPrice = i.spotPrice + i.energyFee + i.elTax;
  const chargerAcKwh = i.deliveredKwh / effC;
  const billedKwh = i.deliveredKwh * i.billedShare;
  const ownKwh = i.deliveredKwh - billedKwh;

  const solarKwh = (i.solarKwp * SOLAR.refKwh) / SOLAR.refKwp;
  const hasBattery = i.batteryUnits > 0;
  // Fordelingen begrenses av behovet: byggsol til bygget, ladesol til laderne,
  // og sol inn på batteriet bare så langt utladingen dekker resten av ladebehovet.
  const solarBuildingKwh = Math.min(solarKwh * SOLAR.toBuilding, i.buildingKwh);
  const solarDirectChargingKwh = Math.min(solarKwh * SOLAR.toChargers, chargerAcKwh);
  const solarToBatteryKwh = hasBattery
    ? Math.min(solarKwh * SOLAR.toBattery, (chargerAcKwh - solarDirectChargingKwh) / effB)
    : 0;
  const solarChargingKwh = solarDirectChargingKwh + solarToBatteryKwh * effB;
  const solarExportKwh = solarKwh - solarBuildingKwh - solarDirectChargingKwh - solarToBatteryKwh;
  const solarBatteryLossKwh = solarToBatteryKwh * (1 - effB);

  // Kjøpt strøm via batteriet skaleres med ladevolumet og batteripakken,
  // og begrenses av ladebehovet som gjenstår etter sol.
  const gridBatteryKwh = hasBattery
    ? Math.min(
        A.gridBatteryRefKwh * (i.deliveredKwh / A.gridBatteryRefDeliveredKwh) * (i.batteryUnits / STD.batteryUnits),
        Math.max(0, chargerAcKwh - solarChargingKwh) / effB,
      )
    : 0;
  const gridBatteryLossKwh = gridBatteryKwh * (1 - effB);
  const gridPurchaseKwh = i.buildingKwh + chargerAcKwh - solarBuildingKwh - solarChargingKwh + gridBatteryLossKwh;

  // Effektledd: samme topp hver måned, seks sommer- og seks vintermåneder.
  const feePerKwYear = 6 * (i.powerFeeSummer + i.powerFeeWinter);
  // Nettopp uten styring følger ladeeffekten (650 kW ved 720 kW i eksemplet).
  // Styringen holder toppen på målet (300 kW) bare så langt batteriet har
  // effekt til å kappe den: toppen blir aldri lavere enn ustyrt topp minus
  // batteriets kontinuerlige utladningseffekt (Asbjørn 24.11: 300 kW gjelder
  // bare når batteriet tillater det).
  const charging = i.deliveredKwh > 0 && i.chargers > 0;
  const refKw = STD.chargers * STD.chargerKw;
  const unmanagedPeakKw = charging
    ? i.peakBeforeKw + Math.max(0, i.peakUnmanagedKw - i.peakBeforeKw) * (nameplateKw / refKw)
    : i.peakBeforeKw;
  const peakAfterKw = charging
    ? Math.min(unmanagedPeakKw, Math.max(i.peakManagedKw, unmanagedPeakKw - batteryKw))
    : i.peakBeforeKw;
  const power = {
    feePerKwYear,
    unmanagedPeakKw,
    peakAfterKw,
    beforeCost: i.peakBeforeKw * feePerKwYear,
    unmanagedCost: unmanagedPeakKw * feePerKwYear,
    managedCost: peakAfterKw * feePerKwYear,
    controlSaving: (unmanagedPeakKw - peakAfterKw) * feePerKwYear,
  };

  const k = (n: number) => Math.round(n).toLocaleString("nb-NO");
  const p = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 4 });
  const pc = (n: number) => `${(n * 100).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;
  const lines: AnnualLine[] = [
    {
      id: "revenue",
      label: "Fakturert lading",
      how: `${k(billedKwh)} kWh × ${p(i.salePrice)} kr`,
      value: billedKwh * i.salePrice,
    },
    {
      id: "charging",
      label: "Strøm til laderne før bidrag fra sol",
      how: `${k(i.deliveredKwh)} kWh / ${p(effC)} × ${p(marginalPrice)} kr`,
      value: neg(chargerAcKwh * marginalPrice),
    },
    {
      id: "solarBuilding",
      label: "Solstrøm direkte brukt i bygget",
      how: `${k(solarBuildingKwh)} kWh × ${p(marginalPrice)} kr`,
      value: solarBuildingKwh * marginalPrice,
    },
    {
      id: "solarCharging",
      label: "Solstrøm brukt til lading",
      how: `${k(solarChargingKwh)} kWh direkte og via batteriet × ${p(marginalPrice)} kr`,
      value: solarChargingKwh * marginalPrice,
    },
    {
      id: "solarExport",
      label: "Soloverskudd solgt til nettet",
      how: `${k(solarExportKwh)} kWh × ${p(i.exportPrice)} kr`,
      value: solarExportKwh * i.exportPrice,
    },
    {
      id: "batteryLoss",
      label: "Tap på kjøpt strøm gjennom batteriet",
      how: `${k(gridBatteryKwh)} kWh × ${pc(1 - effB)} × ${p(marginalPrice)} kr`,
      value: neg(gridBatteryLossKwh * marginalPrice),
    },
    {
      id: "power",
      label: "Endring i effektledd fra dagens bygg",
      how: `(${k(i.peakBeforeKw)} − ${k(peakAfterKw)} kW) × ${k(feePerKwYear)} kr per kW og år`,
      value: (i.peakBeforeKw - peakAfterKw) * feePerKwYear,
    },
    { id: "opex", label: "Drift og service", how: "Service, programvare, forsikring og løpende drift", value: neg(i.opex) },
  ];

  const annualNet = lines.reduce((s, l) => s + l.value, 0);
  const paybackYears = netInvestment !== null && annualNet > 0 ? Math.max(0, netInvestment) / annualNet : null;

  // Gradvis oppstart: salg og volumavhengige energikostnader følger opptrappingen.
  const volumeDependent = lines
    .filter((l) => l.id === "revenue" || l.id === "charging" || l.id === "batteryLoss")
    .reduce((s, l) => s + l.value, 0);
  const years = [...A.rampUp.map((f) => annualNet - volumeDependent * (1 - f)), annualNet];
  const rampUp = { years, paybackYears: netInvestment === null ? null : rampPayback(Math.max(0, netInvestment), years) };

  const periodYears = A.analysisYears;
  const netAfterPeriod = netInvestment === null ? null : annualNet * periodYears - netInvestment;

  return {
    standardPackage: isStandardPackage(i),
    vehicle,
    nameplateKw,
    batteryKwh,
    batteryKw,
    availableKw,
    batteryAssistKw,
    investment,
    eligibleCost,
    support,
    supportRate,
    krPerKw,
    supportLimitedBy,
    supportBasis: { requested: wanted, cap: A.enovaMaxSupport, rateCap: eligibleCost === null ? null : eligibleCost * A.enovaMaxRate },
    netInvestment,
    energy: {
      marginalPrice,
      chargerAcKwh,
      billedKwh,
      ownKwh,
      solarKwh,
      solarBuildingKwh,
      solarDirectChargingKwh,
      solarToBatteryKwh,
      solarChargingKwh,
      solarExportKwh,
      solarBatteryLossKwh,
      gridBatteryKwh,
      gridBatteryLossKwh,
      gridPurchaseKwh,
    },
    power,
    lines,
    annualNet,
    paybackYears,
    rampUp,
    periodYears,
    netAfterPeriod,
  };
}

/** År til investeringen er tjent inn med opptrapping de første årene (jevn opptjening innen året). */
function rampPayback(inv: number, years: number[]): number | null {
  let acc = 0;
  for (let y = 0; y < years.length - 1; y++) {
    if (years[y] > 0 && acc + years[y] >= inv) return y + (inv - acc) / years[y];
    acc += years[y];
  }
  const last = years[years.length - 1];
  if (last <= 0) return null;
  return years.length - 1 + Math.max(0, inv - acc) / last;
}
