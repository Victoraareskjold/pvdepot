/**
 * Alle forutsetninger for kalkylen ligger her. Endre her, ikke i modellen.
 *
 * Grunnlag (Asbjørn, 24.11.2026): regnearket «Lonnsomhet-bedriftslading-
 * 7-batterier.xlsx» og kalkulatorbeskrivelsen «Victor-ladekalkulator.md».
 * Standardeksemplet er en bedrift som bruker strøm i eget bygg og selger
 * lading til andre transportører, med et komplett installert anlegg fra
 * Smart Elektro. Alle beløp er eks. mva.
 *
 * Enova-reglene er hentet fra programsiden og vilkårene for «Bedriftslading
 * for tunge kjøretøy».
 */

export type VehicleTypeId = "distribusjon" | "regional" | "langtransport" | "buss";

export interface VehicleType {
  id: VehicleTypeId;
  label: string;
  hint: string;
  /** Energi levert til bilen per km (DC), kWh per km */
  kWhPerKm: number;
  /** 3D-modellen (trailer eller ikke) */
  model: "rigid" | "semi" | "bus";
}

/** Brukes bare som hjelp til å anslå ladevolum, og til bilene i 3D-scenen. */
export const VEHICLE_TYPES: VehicleType[] = [
  { id: "distribusjon", label: "Distribusjon", hint: "Lastebil i by og nærområde, 16–26 tonn", kWhPerKm: 1.0, model: "rigid" },
  { id: "regional", label: "Regional", hint: "Lastebil med henger mellom byer", kWhPerKm: 1.25, model: "rigid" },
  { id: "langtransport", label: "Trekkvogn", hint: "Semitrailer og langtransport", kWhPerKm: 1.45, model: "semi" },
  { id: "buss", label: "Buss", hint: "Rute- eller turbuss", kWhPerKm: 1.1, model: "bus" },
];

/** Det komplette anlegget i standardeksemplet, med bekreftet totalpris. */
export const STANDARD_PACKAGE = {
  chargers: 6,
  chargerKw: 120,
  solarKwp: 189,
  batteryUnits: 7,
  /** Komplett installasjon før støtte, eks. mva. */
  price: 7_495_620,
  /** Anslått Enova-støtte i eksemplet */
  support: 2_680_000,
} as const;

export const SOLAR = {
  /** Solsimulering Bredmyra 12: 189 kWp gir 162 933 kWh per år etter PV-systemtap */
  refKwp: 189,
  refKwh: 162_933,
  /** kWp per m² tak dekket av paneler, og dekningsgraden i eksemplet (1 750 m² × 60 % × 0,18 = 189 kWp) */
  kwpPerM2: 0.18,
  refCoverage: 0.6,
  /** Fordeling av solproduksjonen før batteritap (arbeidsanslag). Resten selges til nettet. */
  toBuilding: 0.5,
  toChargers: 0.2,
  toBattery: 0.25,
} as const;

export const BATTERY_UNIT = {
  /** Brukbar kapasitet per enhet */
  kwh: 261,
  /** Kontinuerlig utladningseffekt per enhet */
  kw: 130,
} as const;

export const ASSUMPTIONS = {
  /** Fra AC-inngang til levert DC-energi */
  chargerEfficiency: 0.95,
  /** Batteri tur-retur på AC-siden */
  batteryRoundTrip: 0.9,
  /**
   * Kjøpt strøm ladet inn på batteriet: 100 000 kWh per år ved 380 000 kWh
   * levert lading. Skaleres med ladevolumet og antall batterienheter.
   */
  gridBatteryRefKwh: 100_000,
  gridBatteryRefDeliveredKwh: 380_000,

  /** Laderstørrelser kunden kan velge (Enova krever over 50 kW per ladepunkt) */
  chargerSizesKw: [60, 90, 120, 150, 180],
  enovaMinChargerKw: 50,

  /**
   * Komponentpriser for å prise utstyr som avviker fra standardpakken.
   * null = ingen kvalitetssikrede priser ennå: siden viser «Investeringspris
   * må avklares» når kunden endrer utstyret. Fylles inn med leverandørpriser
   * (prisforskjell mot standardpakken), så standardpakken alltid blir
   * nøyaktig 7 495 620 kr.
   */
  componentPrices: null as null | {
    perCharger: number;
    perChargerKw: number;
    perSolarKwp: number;
    perBatteryUnit: number;
  },

  /**
   * Andel av investeringen som regnes som godkjent kostnad hos Enova.
   * 1 = hele pakken. Batteriets støtteberettigelse må vurderes mot behov og vilkår.
   */
  eligibleShare: 1,

  /** Enova */
  enovaMaxRate: 0.6,
  enovaMaxSupport: 3_000_000,
  enovaOperatingYears: 5,
  /** Ønsket rangeringsscore i det alternative budet (kr per kW) */
  defaultScoreKrPerKw: 4_000,

  /** Gradvis oppstart: andel av ladevolumet år 1 og år 2, fullt fra år 3 */
  rampUp: [0.5, 0.75],
  /** Perioden for akkumulert netto */
  analysisYears: 10,

  /** Hvor strømprisene kommer fra (vises i detaljene) */
  priceArea: "Oslo (NO1)",
  tariffLabel: "Elvia, lavspent næring over 100 000 kWh, tariff fra 1. juli 2026. Ordinær elavgift 2026.",
} as const;
