import { describe, expect, test } from "bun:test";
import { calculate, DEFAULT_INPUT, pickChargerKw } from "./model";
import { qualify, DEFAULT_ANSWERS } from "./qualify";
import { nextDeadline } from "./deadlines";
import { ASSUMPTIONS } from "./assumptions";

describe("ladere", () => {
  test("velger minste lader over behovet, alltid over 50 kW", () => {
    expect(pickChargerKw(10)).toBe(60);
    expect(pickChargerKw(61)).toBe(90);
    expect(pickChargerKw(150)).toBe(150);
    expect(pickChargerKw(9999)).toBe(360);
    for (const s of ASSUMPTIONS.chargerSizesKw) expect(s).toBeGreaterThan(ASSUMPTIONS.enovaMinChargerKw);
  });

  test("standardcase: 6 distribusjonsbiler, 220 km, 10 t", () => {
    const r = calculate(DEFAULT_INPUT);
    // 220 km * 1.0 / 0.92 = 239 kWh per døgn, 23.9 kW over 10 t
    expect(r.dailyKwhPerVehicle).toBeCloseTo(239.13, 1);
    expect(r.chargerKw).toBe(60);
    expect(r.chargePoints).toBe(6);
    expect(r.nameplateKw).toBe(360);
    expect(r.availableKw).toBe(360);
    // 6 * (120 000 + 60 * 2 800) = 1 728 000
    expect(r.costs[0].cost).toBe(1_728_000);
    expect(r.support).toBeCloseTo(1_728_000 * 0.6, 0);
    expect(r.krPerKw).toBeCloseTo((1_728_000 * 0.6) / 360, 0);
    expect(r.warnings.some((w) => w.id === "grid-unknown")).toBe(true);
  });

  test("for kort ståtid gir varsel", () => {
    const r = calculate({ ...DEFAULT_INPUT, vehicleType: "langtransport", kmPerDay: 700, dwellHours: 2 });
    expect(r.chargerKw).toBe(360);
    expect(r.warnings.some((w) => w.id === "dwell-too-short")).toBe(true);
  });
});

describe("Enova", () => {
  test("støtten stopper på 3 mill. kr", () => {
    const r = calculate({ ...DEFAULT_INPUT, vehicles: 30, vehicleType: "langtransport", dwellHours: 4 });
    expect(r.support).toBe(3_000_000);
    expect(r.supportCapped).toBe(true);
  });

  test("lavere støttegrad gir lavere kr per kW", () => {
    const full = calculate(DEFAULT_INPUT);
    const lower = calculate({ ...DEFAULT_INPUT, supportRate: 0.4 });
    expect(lower.krPerKw).toBeLessThan(full.krPerKw);
  });

  test("støttegrad over 60 % kuttes", () => {
    const r = calculate({ ...DEFAULT_INPUT, supportRate: 0.9 });
    expect(r.support).toBeCloseTo(r.eligibleCost * 0.6, 0);
  });

  test("sol er ikke med i grunnlaget", () => {
    const r = calculate({ ...DEFAULT_INPUT, roofM2: 5000 });
    const solar = r.costs.find((c) => c.id === "solar")!;
    expect(solar.cost).toBeGreaterThan(0);
    expect(solar.eligible).toBe(0);
  });
});

describe("nett og batteri", () => {
  test("for lite nett gir forsterkning, batteri reduserer den", () => {
    const base = { ...DEFAULT_INPUT, vehicles: 10, gridSpareKw: 100 };
    const noBattery = calculate(base);
    expect(noBattery.gridDeficitKw).toBeGreaterThan(0);
    expect(noBattery.costs.find((c) => c.id === "grid")!.cost).toBeGreaterThan(0);

    const withBattery = calculate({ ...base, batteryKwh: 400 });
    expect(withBattery.batteryKw).toBe(200);
    expect(withBattery.gridDeficitKw).toBeLessThan(noBattery.gridDeficitKw);
    // Batteri som dekker manglende kapasitet, er med i grunnlaget
    expect(withBattery.costs.find((c) => c.id === "battery")!.eligible).toBeGreaterThan(0);
  });

  test("batteri som ikke trengs, er ikke med i grunnlaget", () => {
    const r = calculate({ ...DEFAULT_INPUT, gridSpareKw: 2000, batteryKwh: 200 });
    expect(r.costs.find((c) => c.id === "battery")!.eligible).toBe(0);
  });
});

describe("drift", () => {
  test("el er billigere enn diesel med standardpriser", () => {
    const r = calculate(DEFAULT_INPUT);
    expect(r.annual.fuelSaving).toBeGreaterThan(0);
    expect(r.annual.co2Tonnes).toBeGreaterThan(0);
    expect(r.paybackYears).not.toBeNull();
  });

  test("ingen kjøretøy gir ingen ladere", () => {
    const r = calculate({ ...DEFAULT_INPUT, vehicles: 0 });
    expect(r.chargePoints).toBe(0);
    expect(r.krPerKw).toBe(0);
  });
});

describe("støttesjekk", () => {
  test("standardsvar: må avklare nett, men ingen stopp", () => {
    const q = qualify(DEFAULT_ANSWERS);
    expect(q.verdict).toBe("kvalifiserer");
    expect(q.findings.some((f) => f.kind === "stopp")).toBe(false);
  });

  test("offentlig lading sendes til Underveislading", () => {
    const q = qualify({ ...DEFAULT_ANSWERS, ownDepot: "nei" });
    expect(q.verdict).toBe("kvalifiserer-ikke");
    expect(q.redirect?.label).toContain("Underveislading");
  });

  test("startet prosjekt stopper", () => {
    expect(qualify({ ...DEFAULT_ANSWERS, started: "ja" }).verdict).toBe("kvalifiserer-ikke");
  });

  test("usikkerhet gir avklar", () => {
    expect(qualify({ ...DEFAULT_ANSWERS, fiveYears: "usikker" }).verdict).toBe("avklar");
  });
});

describe("frister", () => {
  test("neste frist etter 12.11.2026 er 3. februar 2027", () => {
    const d = nextDeadline(new Date("2026-11-12T12:00:00+01:00"))!;
    expect(d.date.toISOString()).toBe("2027-02-03T11:00:00.000Z");
    expect(d.daysLeft).toBe(83);
  });
  test("etter februar-fristen kommer juni", () => {
    const d = nextDeadline(new Date("2027-02-03T12:30:00+01:00"))!;
    expect(d.date.getUTCMonth()).toBe(5);
  });
});
