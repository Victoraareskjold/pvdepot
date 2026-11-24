import { describe, expect, test } from "bun:test";
import {
  calculate,
  chargingShare,
  DEFAULT_INPUT,
  estimateDeliveredKwh,
  withChargingShare,
  type PlannerInput,
} from "./model";

/** Kontrolltallene fra regnearket og kalkulatorbeskrivelsen (Asbjørn, 24.11.2026). */
const line = (r: ReturnType<typeof calculate>, id: string) => r.lines.find((l) => l.id === id)!.value;
const calc = (patch: Partial<PlannerInput> = {}) => calculate({ ...DEFAULT_INPUT, ...patch });

describe("standardeksemplet", () => {
  const r = calc();

  test("utstyr: 6 × 120 kW, 189 kWp, 7 batterienheter", () => {
    expect(r.standardPackage).toBe(true);
    expect(r.nameplateKw).toBe(720);
    expect(r.batteryKwh).toBe(1_827);
    expect(r.batteryKw).toBe(910);
    expect(r.availableKw).toBe(720);
    expect(r.batteryAssistKw).toBeCloseTo(607.89, 1);
    expect(r.energy.solarKwh).toBeCloseTo(162_933, 6);
  });

  test("investering og støtte", () => {
    expect(r.investment).toBe(7_495_620);
    expect(r.support).toBe(2_680_000);
    expect(r.netInvestment).toBe(4_815_620);
    expect(Math.round(r.krPerKw)).toBe(3_722);
  });

  test("årsregnestykket rad for rad", () => {
    expect(line(r, "revenue")).toBeCloseTo(1_710_000, 4);
    expect(line(r, "charging")).toBeCloseTo(-400_520, 4);
    expect(line(r, "solarBuilding")).toBeCloseTo(81_572.40645, 4);
    expect(line(r, "solarCharging")).toBeCloseTo(69_336.5454825, 4);
    expect(line(r, "solarExport")).toBeCloseTo(4_887.99, 4);
    expect(line(r, "batteryLoss")).toBeCloseTo(-10_013, 4);
    expect(line(r, "power")).toBeCloseTo(-141_300, 4);
    expect(line(r, "opex")).toBe(-75_000);
    expect(r.annualNet).toBeCloseTo(1_238_963.9419325, 4);
    expect(r.paybackYears!).toBeCloseTo(3.8868120669345188, 9);
  });

  test("energibalanse og effektledd", () => {
    expect(r.energy.chargerAcKwh).toBeCloseTo(400_000, 6);
    expect(r.energy.gridPurchaseKwh).toBeCloseTo(499_286.975, 3);
    expect(r.energy.solarExportKwh).toBeCloseTo(8_146.65, 3);
    const losses = r.energy.solarBatteryLossKwh + r.energy.gridBatteryLossKwh;
    expect(losses).toBeCloseTo(14_073.325, 3);
    expect(r.energy.gridPurchaseKwh + r.energy.solarKwh).toBeCloseTo(
      240_000 + r.energy.chargerAcKwh + r.energy.solarExportKwh + losses,
      6,
    );
    expect(r.power.beforeCost).toBe(141_300);
    expect(r.power.unmanagedCost).toBe(612_300);
    expect(r.power.managedCost).toBe(282_600);
    expect(r.power.controlSaving).toBe(329_700);
  });

  test("gradvis oppstart og tiårstall", () => {
    expect(r.rampUp.years[0]).toBeCloseTo(589_230.4419325, 4);
    expect(r.rampUp.years[1]).toBeCloseTo(914_097.1919325, 4);
    expect(r.rampUp.years[2]).toBeCloseTo(1_238_963.9419325, 4);
    expect(r.rampUp.paybackYears!).toBeCloseTo(4.673437259980772, 9);
    expect(Math.round(r.netAfterPeriod!)).toBe(7_574_019);
  });
});

describe("kontroller før publisering", () => {
  test("fire batterienheter: 1 044 kWh, 520 kW og 636,5 kW DC", () => {
    const r = calc({ batteryUnits: 4 });
    expect(r.batteryKwh).toBe(1_044);
    expect(r.batteryKw).toBe(520);
    expect(r.availableKw).toBeCloseTo(636.5, 6);
    expect(r.standardPackage).toBe(false);
  });

  test("50 % fakturert: 855 000 kr i salg, ca. 383 964 kr netto og 12,54 år", () => {
    const r = calc({ billedShare: 0.5 });
    expect(r.energy.billedKwh).toBe(190_000);
    expect(r.energy.ownKwh).toBe(190_000);
    expect(line(r, "revenue")).toBeCloseTo(855_000, 4);
    expect(Math.round(r.annualNet)).toBe(383_964);
    expect(r.paybackYears!.toFixed(2)).toBe("12.54");
  });

  test("0 % fakturert: ca. −471 036 kr og ingen tilbakebetaling", () => {
    const r = calc({ billedShare: 0 });
    expect(line(r, "revenue")).toBe(0);
    expect(Math.round(r.annualNet)).toBe(-471_036);
    expect(r.paybackYears).toBeNull();
  });

  test("bygg/lading 50/50: 320 000 + 320 000 kWh, 304 000 levert, 1 368 000 kr", () => {
    expect(chargingShare(DEFAULT_INPUT)).toBeCloseTo(0.625, 12);
    const input = withChargingShare(DEFAULT_INPUT, 0.5);
    expect(input.buildingKwh).toBeCloseTo(320_000, 6);
    expect(input.deliveredKwh / 0.95).toBeCloseTo(320_000, 6);
    expect(input.deliveredKwh).toBeCloseTo(304_000, 6);
    expect(line(calculate(input), "revenue")).toBeCloseTo(1_368_000, 4);
  });

  test("endepunktene på bygg/lading gir ingen negative mengder", () => {
    for (const s of [0, 1]) {
      const r = calculate(withChargingShare(DEFAULT_INPUT, s));
      expect(Number.isFinite(r.annualNet)).toBe(true);
      for (const v of Object.values(r.energy)) expect(v).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  test("ladepris 3,50 kr: 1 330 000 kr i salg, ca. 858 964 kr og 5,61 år", () => {
    const r = calc({ salePrice: 3.5 });
    expect(line(r, "revenue")).toBeCloseTo(1_330_000, 4);
    expect(Math.round(r.annualNet)).toBe(858_964);
    expect(r.paybackYears!.toFixed(2)).toBe("5.61");
  });

  test("ingen støtte: egen investering 7 495 620 kr og ca. 6,05 år", () => {
    const r = calc({ supportMode: "none" });
    expect(r.netInvestment).toBe(7_495_620);
    expect(r.paybackYears!.toFixed(2)).toBe("6.05");
  });

  test("ønsket score 4 000 kr/kW gir 2 880 000 kr", () => {
    const r = calc({ supportMode: "score" });
    expect(r.support).toBe(2_880_000);
    expect(r.netInvestment).toBe(4_615_620);
  });

  test("støtten stopper på 3 mill. kr", () => {
    const r = calc({ supportMode: "amount", supportAmount: 5_000_000 });
    expect(r.support).toBe(3_000_000);
    expect(r.supportLimitedBy).toBe("cap");
  });

  test("tomme og null-verdier gir ingen NaN eller uendelig", () => {
    const r = calc({
      buildingKwh: NaN,
      deliveredKwh: 0,
      salePrice: 0,
      solarKwp: 0,
      batteryUnits: 0,
      chargers: 0,
      spotPrice: Number.NaN,
    });
    expect(Number.isFinite(r.annualNet)).toBe(true);
    expect(r.paybackYears).toBeNull();
    expect(r.krPerKw).toBe(0);
    expect(r.energy.solarKwh).toBe(0);
    // Ingen lading: ingen ny effekttopp
    expect(line(r, "power")).toBe(0);
  });
});

describe("utstyr", () => {
  test("endret utstyr uten komponentpriser: investeringspris må avklares", () => {
    const r = calc({ chargers: 8 });
    expect(r.investment).toBeNull();
    expect(r.netInvestment).toBeNull();
    expect(r.paybackYears).toBeNull();
    expect(Number.isFinite(r.annualNet)).toBe(true);
  });

  test("sol skaleres med kWp, og null kWp gir null sol", () => {
    expect(calc({ solarKwp: 94.5 }).energy.solarKwh).toBeCloseTo(162_933 / 2, 6);
    const none = calc({ solarKwp: 0 });
    expect(line(none, "solarBuilding") + line(none, "solarCharging") + line(none, "solarExport")).toBe(0);
  });

  test("uten batteri er alle batteristrømmer null", () => {
    const r = calc({ batteryUnits: 0 });
    expect(r.energy.solarToBatteryKwh).toBe(0);
    expect(r.energy.gridBatteryKwh).toBe(0);
    expect(line(r, "batteryLoss")).toBe(0);
  });

  test("ladevolum fra kjøretøy: 6 biler × 220 km × 250 døgn × 1,0 kWh", () => {
    expect(estimateDeliveredKwh(DEFAULT_INPUT)).toBe(330_000);
  });
});
