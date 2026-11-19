/**
 * Alle forutsetninger for kalkylen ligger her.
 *
 * Tallene er anslag for et første estimat og skal kvalitetssikres av
 * Smart Elektro før lansering. Endre her, ikke i modellen.
 *
 * Enova-reglene er hentet fra programsiden og spørsmål og svar for
 * «Bedriftslading for tunge kjøretøy» (lest 12.11.2026). Vilkårs-PDF-en for
 * runden 3. februar 2027 ble oppdatert 12.11.2026 og må leses før lansering.
 */

export type VehicleTypeId = "distribusjon" | "regional" | "langtransport" | "buss";

export interface VehicleType {
  id: VehicleTypeId;
  label: string;
  hint: string;
  /** Strømforbruk ved hjul, kWh per km */
  kWhPerKm: number;
  /** Dieselforbruk for tilsvarende bil, liter per km */
  dieselLPerKm: number;
  /** Lengde på 3D-modellen (trailer eller ikke) */
  model: "rigid" | "semi" | "bus";
}

export const VEHICLE_TYPES: VehicleType[] = [
  {
    id: "distribusjon",
    label: "Distribusjon",
    hint: "Lastebil i by og nærområde, 16–26 tonn",
    kWhPerKm: 1.0,
    dieselLPerKm: 0.28,
    model: "rigid",
  },
  {
    id: "regional",
    label: "Regional",
    hint: "Lastebil med henger mellom byer",
    kWhPerKm: 1.25,
    dieselLPerKm: 0.34,
    model: "rigid",
  },
  {
    id: "langtransport",
    label: "Trekkvogn",
    hint: "Semitrailer og langtransport",
    kWhPerKm: 1.45,
    dieselLPerKm: 0.38,
    model: "semi",
  },
  {
    id: "buss",
    label: "Buss",
    hint: "Rute- eller turbuss",
    kWhPerKm: 1.1,
    dieselLPerKm: 0.33,
    model: "bus",
  },
];

export const ASSUMPTIONS = {
  /** Tap fra nett til batteri i bilen */
  chargingEfficiency: 0.92,
  /** Enova krever at hvert ladepunkt i kostnadsgrunnlaget er over 50 kW */
  enovaMinChargerKw: 50,
  /** Standard laderstørrelser vi velger blant (alle over 50 kW) */
  chargerSizesKw: [60, 90, 120, 150, 180, 240, 360],

  /** Ladepunkt: fast del (montering, grunnarbeid, kabling) + per kW (lader) */
  chargePointFixedCost: 120_000,
  chargerCostPerKw: 2_800,

  /** Nettforsterkning når ledig kapasitet ikke holder: fast + per manglende kW */
  gridUpgradeFixedCost: 400_000,
  gridUpgradeCostPerKw: 1_200,
  /**
   * Nettforsterkning kan tas med i Enova-grunnlaget (Smart Elektro, 19.11.2026:
   * vilkårene sier at både nett og sol kan være med i søknaden).
   */
  gridUpgradeEligible: true,

  /** Stasjonært batteri */
  batteryFixedCost: 150_000,
  batteryCostPerKwh: 4_500,
  /** Effekt batteriet kan levere, som andel av kWh (0,5C) */
  batteryCRate: 0.5,
  /**
   * Batteri godkjennes når det er nødvendig for ladeanlegget og styres i
   * samme system. Vi tar med den delen av batterieffekten som dekker
   * manglende nettkapasitet.
   */
  batteryEligibleWhenNeeded: true,

  /** Solceller: kWp per m² tak dekket av paneler (inkl. avstand og gangsoner) */
  solarKwpPerCoveredM2: 0.18,
  solarYieldKwhPerKwp: 850,
  /** Andel av solstrømmen bygget bruker selv (resten selges) */
  solarSelfUse: 0.7,
  /** Solceller kan tas med i Enova-grunnlaget (se nettforsterkning over). */
  solarEligible: true,

  /** Strøm og diesel, kr eks. mva. */
  electricityPrice: 1.0,
  exportPrice: 0.5,
  dieselPrice: 17,
  /** Effektledd i nettleien, kr per kW per måned */
  demandChargePerKwMonth: 80,
  /** CO₂ fra fossil diesel, kg per liter */
  co2KgPerLiterDiesel: 2.68,

  /** Enova */
  enovaMaxRate: 0.6,
  enovaMaxSupport: 3_000_000,
  /** Driftsplikt på samme lokasjon */
  enovaOperatingYears: 5,
  /** Periode for «spart over N år» (ladere og batteri varer typisk 10–15 år) */
  analysisYears: 10,
  /**
   * Grensen for å få støtte i de siste rundene: bare søknader under ca.
   * 4 200 kr per kW ladeeffekt har fått tilsagn (Smart Elektro, 19.11.2026).
   * Ladeeffekten er effekten med laststyring, ikke summen av alle laderne.
   */
  enovaHistoricalCutoffKrPerKw: 4_200 as number | null,
} as const;

export function solarCostPerKwp(kwp: number): number {
  if (kwp <= 100) return 10_000;
  if (kwp >= 500) return 7_000;
  // Lineært fra 10 000 kr ved 100 kWp til 7 000 kr ved 500 kWp
  return 10_000 - ((kwp - 100) / 400) * 3_000;
}
