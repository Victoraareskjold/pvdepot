import { describe, expect, test } from "bun:test";
import {
  calculate,
  chargingShare,
  DEFAULT_INPUT,
  estimateDeliveredKwh,
  withChargingShare,
  type PlannerInput,
} from "./model";

/**
 * Kontrolltallene fra regnearket og kalkulatorbeskrivelsen (Asbjørn, 24.11.2026)
 * bruker søkebeløpet 2 680 000 kr. Siden 25.11.2026 er standarden i stedet
 * støtte fra 4 000 kr/kW (se «ny standard» nederst), så kontrollene kjøres med
 * søkebeløpet for å teste regnearket rad for rad.
 */
const line = (r: ReturnType<typeof calculate>, id: string) => r.lines.find((l) => l.id === id)!.value;
const SHEET: Partial<PlannerInput> = { supportMode: "amount", supportAmount: 2_680_000 };
const calc = (patch: Partial<PlannerInput> = {}) => calculate({ ...DEFAULT_INPUT, ...SHEET, ...patch });

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
  test("totalsummen følger utstyret, og standardpakken er nøyaktig 7 495 620 kr", () => {
    expect(calc().investment).toBe(7_495_620);
    // 2 ladere til (240 kW) à 2 400 kr/kW
    expect(calc({ chargers: 8 }).investment).toBe(7_495_620 + 240 * 2_400);
    // 11 kWp mer sol à 6 500 kr
    expect(calc({ solarKwp: 200 }).investment).toBe(7_495_620 + 11 * 6_500);
    // 3 batterienheter færre: 783 kWh à 2 300 kr
    expect(calc({ batteryUnits: 4 }).investment).toBe(7_495_620 - 783 * 2_300);
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

describe("ny standard (Victor, 25.11.2026)", () => {
  const r = calculate(DEFAULT_INPUT);

  test("støtte = laveste av 720 kW × 4 000 kr, 3 mill. kr og 60 % av totalsummen", () => {
    expect(r.supportBasis.requested).toBe(2_880_000);
    expect(r.supportBasis.cap).toBe(3_000_000);
    expect(r.supportBasis.rateCap).toBeCloseTo(4_497_372, 6);
    expect(r.support).toBe(2_880_000);
    expect(r.netInvestment).toBe(4_615_620);
  });

  test("tilbakebetaling 3,73 år og 7 774 019 kr over 10 år", () => {
    expect(r.paybackYears!.toFixed(2)).toBe("3.73");
    expect(Math.round(r.netAfterPeriod!)).toBe(7_774_019);
    expect(Math.round(r.annualNet)).toBe(1_238_964);
  });

  test("mer ladeeffekt: støtten stopper på 3 mill. kr", () => {
    const big = calculate({ ...DEFAULT_INPUT, chargers: 7 }); // 840 kW × 4 000 = 3 360 000
    expect(big.support).toBe(3_000_000);
    expect(big.supportLimitedBy).toBe("cap");
  });

  test("lite anlegg: støtten stopper på 60 % av totalsummen", () => {
    const small = calculate({ ...DEFAULT_INPUT, chargers: 4, solarKwp: 0, batteryUnits: 0 });
    // 7 495 620 − 240 kW × 2 400 − 189 × 6 500 − 1 827 × 2 300
    expect(small.investment).toBe(7_495_620 - 576_000 - 1_228_500 - 4_202_100);
    expect(small.support).toBeCloseTo(small.investment! * 0.6, 6);
    expect(small.supportLimitedBy).toBe("rate");
  });
});

describe("nettoppen avhenger av batteriet (25.11.2026)", () => {
  test("standard og fire enheter: 300 kW", () => {
    expect(calculate(DEFAULT_INPUT).power.peakAfterKw).toBe(300);
    expect(calculate({ ...DEFAULT_INPUT, batteryUnits: 4 }).power.peakAfterKw).toBe(300);
  });

  test("to enheter (260 kW) holder toppen på 390 kW, uten batteri blir den 650 kW", () => {
    expect(calculate({ ...DEFAULT_INPUT, batteryUnits: 2 }).power.peakAfterKw).toBe(390);
    const none = calculate({ ...DEFAULT_INPUT, batteryUnits: 0 });
    expect(none.power.peakAfterKw).toBe(650);
    expect(none.lines.find((l) => l.id === "power")!.value).toBe((150 - 650) * 942);
  });

  test("toppen uten styring følger ladeeffekten", () => {
    const r = calculate({ ...DEFAULT_INPUT, chargers: 3, batteryUnits: 0 });
    expect(r.power.unmanagedPeakKw).toBeCloseTo(150 + 500 * (360 / 720), 9);
    expect(r.power.peakAfterKw).toBeCloseTo(400, 9);
  });

  test("uten batteri lønner anlegget seg ikke bedre enn med", () => {
    const withB = calculate(DEFAULT_INPUT);
    const without = calculate({ ...DEFAULT_INPUT, batteryUnits: 0 });
    expect(without.annualNet).toBeLessThan(withB.annualNet);
  });
});
