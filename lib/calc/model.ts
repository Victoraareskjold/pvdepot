import { ASSUMPTIONS as A, VEHICLE_TYPES, solarCostPerKwp, type VehicleTypeId } from "./assumptions";

export interface PlannerInput {
  vehicleType: VehicleTypeId;
  /** Antall elektriske tunge kjøretøy som skal lade på depotet */
  vehicles: number;
  /** Kjørelengde per kjøretøy per driftsdøgn */
  kmPerDay: number;
  /** Timer kjøretøyet står på depotet og kan lade */
  dwellHours: number;
  /** Driftsdøgn per år */
  operatingDays: number;
  /** Takflaten på bygget */
  roofM2: number;
  /** Andel av taket med solceller (0–1) */
  solarCoverage: number;
  /** Ledig effekt i dagens nettilknytning. null = vet ikke */
  gridSpareKw: number | null;
  /** Stasjonært batteri */
  batteryKwh: number;
  /** Støttegraden bedriften søker om (0–0,6). Lavere gir bedre rangering. */
  supportRate: number;
}

export const DEFAULT_INPUT: PlannerInput = {
  vehicleType: "distribusjon",
  vehicles: 6,
  kmPerDay: 220,
  dwellHours: 10,
  operatingDays: 250,
  roofM2: 3_000,
  solarCoverage: 0.6,
  gridSpareKw: null,
  batteryKwh: 0,
  supportRate: 0.6,
};

export interface CostLine {
  id: "chargers" | "grid" | "battery" | "solar";
  label: string;
  cost: number;
  eligible: number;
}

export interface PlannerResult {
  vehicle: (typeof VEHICLE_TYPES)[number];
  dailyKwhPerVehicle: number;
  requiredKwPerVehicle: number;
  chargerKw: number;
  chargePoints: number;
  /** Sum merkeeffekt for laderne */
  nameplateKw: number;
  /** Effekten som trengs når lading fordeles jevnt over ståtiden */
  managedPeakKw: number;
  /** Samlet tilgjengelig ladeeffekt, grunnlaget for Enovas rangering */
  availableKw: number;
  batteryKw: number;
  gridDeficitKw: number;
  solarKwp: number;

  costs: CostLine[];
  totalCost: number;
  eligibleCost: number;
  maxSupport: number;
  support: number;
  supportCapped: boolean;
  krPerKw: number;
  netInvestment: number;

  annual: {
    chargingKwh: number;
    electricityCost: number;
    dieselLiters: number;
    dieselCost: number;
    fuelSaving: number;
    solarKwh: number;
    solarValue: number;
    /** Solproduksjon målt mot ladebehovet (ikke samtidighet) */
    solarShareOfCharging: number;
    peakSaving: number;
    totalSaving: number;
    co2Tonnes: number;
  };
  paybackYears: number | null;
  warnings: Warning[];
}

export type Warning =
  | { id: "dwell-too-short"; neededKw: number }
  | { id: "support-capped" }
  | { id: "grid-unknown" }
  | { id: "grid-upgrade"; deficitKw: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function pickChargerKw(requiredKw: number): number {
  const sizes = A.chargerSizesKw;
  return sizes.find((s) => s >= requiredKw) ?? sizes[sizes.length - 1];
}

export function calculate(input: PlannerInput): PlannerResult {
  const vehicle = VEHICLE_TYPES.find((v) => v.id === input.vehicleType) ?? VEHICLE_TYPES[0];
  const vehicles = Math.max(0, Math.round(input.vehicles));
  const dwell = clamp(input.dwellHours, 1, 24);
  const warnings: Warning[] = [];

  // Ladebehov
  const dailyKwhPerVehicle = (input.kmPerDay * vehicle.kWhPerKm) / A.chargingEfficiency;
  const requiredKwPerVehicle = dailyKwhPerVehicle / dwell;
  const chargerKw = pickChargerKw(requiredKwPerVehicle);
  if (requiredKwPerVehicle > chargerKw) {
    warnings.push({ id: "dwell-too-short", neededKw: Math.ceil(requiredKwPerVehicle) });
  }

  const chargePoints = vehicles;
  const nameplateKw = chargePoints * chargerKw;
  // Med laststyring trenger ikke alle laderne full effekt samtidig.
  const managedPeakKw = Math.min(nameplateKw, chargePoints * requiredKwPerVehicle);

  // Batteri og nett
  const batteryKw = input.batteryKwh * A.batteryCRate;
  const gridKnown = input.gridSpareKw !== null;
  const gridSpare = input.gridSpareKw ?? 0;

  let gridDeficitKw = 0;
  let availableKw = nameplateKw;
  let batteryNeededKw = 0;

  if (gridKnown) {
    batteryNeededKw = Math.max(0, managedPeakKw - gridSpare);
    gridDeficitKw = Math.max(0, managedPeakKw - batteryKw - gridSpare);
    const gridAfter = gridSpare + gridDeficitKw;
    availableKw = Math.min(nameplateKw, gridAfter + batteryKw);
    if (gridDeficitKw > 0) warnings.push({ id: "grid-upgrade", deficitKw: Math.ceil(gridDeficitKw) });
  } else if (vehicles > 0) {
    warnings.push({ id: "grid-unknown" });
  }

  // Sol
  const solarKwp = input.roofM2 * clamp(input.solarCoverage, 0, 1) * A.solarKwpPerCoveredM2;

  // Kostnader
  const chargersCost = chargePoints * (A.chargePointFixedCost + chargerKw * A.chargerCostPerKw);
  const gridCost = gridDeficitKw > 0 ? A.gridUpgradeFixedCost + gridDeficitKw * A.gridUpgradeCostPerKw : 0;
  const batteryCost = input.batteryKwh > 0 ? A.batteryFixedCost + input.batteryKwh * A.batteryCostPerKwh : 0;
  const solarCost = solarKwp > 0 ? solarKwp * solarCostPerKwp(solarKwp) : 0;

  const batteryEligibleShare =
    A.batteryEligibleWhenNeeded && batteryKw > 0 ? Math.min(batteryKw, batteryNeededKw) / batteryKw : 0;

  const costs: CostLine[] = [
    { id: "chargers", label: "Ladere og montering", cost: chargersCost, eligible: chargersCost },
    {
      id: "grid",
      label: "Nettforsterkning",
      cost: gridCost,
      eligible: A.gridUpgradeEligible ? gridCost : 0,
    },
    { id: "battery", label: "Batteri", cost: batteryCost, eligible: batteryCost * batteryEligibleShare },
    { id: "solar", label: "Solceller", cost: solarCost, eligible: A.solarEligible ? solarCost : 0 },
  ];

  const totalCost = sum(costs.map((c) => c.cost));
  const eligibleCost = sum(costs.map((c) => c.eligible));
  const rate = clamp(input.supportRate, 0, A.enovaMaxRate);
  const uncappedMax = eligibleCost * A.enovaMaxRate;
  const maxSupport = Math.min(uncappedMax, A.enovaMaxSupport);
  const support = Math.min(eligibleCost * rate, A.enovaMaxSupport);
  const supportCapped = uncappedMax > A.enovaMaxSupport;
  if (supportCapped) warnings.push({ id: "support-capped" });
  const krPerKw = availableKw > 0 ? support / availableKw : 0;

  // Drift per år
  const km = vehicles * input.kmPerDay * input.operatingDays;
  const chargingKwh = (km * vehicle.kWhPerKm) / A.chargingEfficiency;
  const electricityCost = chargingKwh * A.electricityPrice;
  const dieselLiters = km * vehicle.dieselLPerKm;
  const dieselCost = dieselLiters * A.dieselPrice;
  const fuelSaving = dieselCost - electricityCost;

  const solarKwh = solarKwp * A.solarYieldKwhPerKwp;
  const solarValue = solarKwh * (A.solarSelfUse * A.electricityPrice + (1 - A.solarSelfUse) * A.exportPrice);
  const solarShareOfCharging = chargingKwh > 0 ? Math.min(1, solarKwh / chargingKwh) : 0;

  const peakSaving = Math.min(batteryKw, managedPeakKw) * A.demandChargePerKwMonth * 12;
  const totalSaving = fuelSaving + solarValue + peakSaving;
  const co2Tonnes = (dieselLiters * A.co2KgPerLiterDiesel) / 1000;

  const netInvestment = totalCost - support;
  const paybackYears = totalSaving > 0 && netInvestment > 0 ? netInvestment / totalSaving : null;

  return {
    vehicle,
    dailyKwhPerVehicle,
    requiredKwPerVehicle,
    chargerKw,
    chargePoints,
    nameplateKw,
    managedPeakKw,
    availableKw,
    batteryKw,
    gridDeficitKw,
    solarKwp,
    costs,
    totalCost,
    eligibleCost,
    maxSupport,
    support,
    supportCapped,
    krPerKw,
    netInvestment,
    annual: {
      chargingKwh,
      electricityCost,
      dieselLiters,
      dieselCost,
      fuelSaving,
      solarKwh,
      solarValue,
      solarShareOfCharging,
      peakSaving,
      totalSaving,
      co2Tonnes,
    },
    paybackYears,
    warnings,
  };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
