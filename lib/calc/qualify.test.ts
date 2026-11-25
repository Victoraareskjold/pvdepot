import { describe, expect, test } from "bun:test";
import { describeAnswers, qualify, QUESTIONS, setAnswer, type QualifyAnswers } from "./qualify";
import { describeSetup, setupChanges } from "./setup";
import { calculate, DEFAULT_INPUT, withChargingShare } from "./model";

const allGreen: QualifyAnswers = {
  registered: "ja",
  users: "egne",
  vehicles: "i-bruk",
  started: "nei",
  fiveYears: "ja",
  eighteenMonths: "ja",
};

describe("støttesjekken (Asbjørn 19.11.2026)", () => {
  test("ingen forhåndsvalgte svar: ufullstendig", () => {
    const q = qualify({});
    expect(q.verdict).toBe("incomplete");
    expect(q.answered).toBe(0);
    expect(q.total).toBe(6);
  });

  test("seks spørsmål, ingen om nettselskapet", () => {
    expect(QUESTIONS).toHaveLength(6);
    expect(QUESTIONS.some((q) => /nettselskap/i.test(q.text))).toBe(false);
    expect(QUESTIONS[0].text).toContain("Enhetsregisteret");
  });

  test("alle grønne gir grønt", () => {
    const q = qualify(allGreen);
    expect(q.verdict).toBe("green");
    expect(q.findings).toHaveLength(0);
  });

  test("rødt slår gult, og røde punkter vises først", () => {
    const q = qualify({ ...allGreen, registered: "usikker", fiveYears: "nei" });
    expect(q.verdict).toBe("red");
    expect(q.findings[0].status).toBe("red");
    expect(q.findings[1].status).toBe("yellow");
  });

  test("oppfølging må besvares før spørsmålet teller", () => {
    let a = setAnswer(allGreen, "users", "andre");
    let q = qualify(a);
    expect(q.verdict).toBe("incomplete");
    expect(q.answered).toBe(5);
    a = setAnswer(a, "intent", "ikke-enna");
    q = qualify(a);
    expect(q.verdict).toBe("yellow");
    expect(q.findings[0].text).toContain("Intensjonsavtale");
  });

  test("manglende egne kjøretøy gir ikke rødt", () => {
    const a = setAnswer(setAnswer(allGreen, "users", "andre"), "intent", "ja");
    expect(qualify(a).verdict).toBe("green");
  });

  test("bytte hovedsvar nullstiller oppfølgingen", () => {
    let a = setAnswer(allGreen, "started", "ja");
    a = setAnswer(a, "appliedBefore", "nei");
    expect(qualify(a).verdict).toBe("red");
    a = setAnswer(a, "started", "nei");
    expect(a.appliedBefore).toBeUndefined();
    expect(qualify(a).verdict).toBe("green");
  });

  test("allerede søkt gir gult, ikke søkt før start gir rødt", () => {
    const base = setAnswer(allGreen, "started", "ja");
    expect(qualify(setAnswer(base, "appliedBefore", "ja")).verdict).toBe("yellow");
    expect(qualify(setAnswer(base, "appliedBefore", "nei")).verdict).toBe("red");
  });

  test("kjøretøy: ingen planer er rødt, bestilt med feil tidspunkt er rødt", () => {
    expect(qualify({ ...allGreen, vehicles: "ingen" }).verdict).toBe("red");
    const a = setAnswer(setAnswer(allGreen, "vehicles", "bestilt"), "timing", "nei");
    expect(qualify(a).verdict).toBe("red");
  });

  test("svarene som tekst tar bare med synlige oppfølginger", () => {
    const lines = describeAnswers({ ...allGreen, intent: "ja" });
    expect(lines.some((l) => l.includes("intensjonsavtale"))).toBe(false);
    expect(lines[0]).toContain("Ja");
  });
});

describe("kundens oppsett i henvendelsen", () => {
  test("ingen endringer: sier det, og kaller ikke standard for kundens valg", () => {
    const text = describeSetup(DEFAULT_INPUT, calculate(DEFAULT_INPUT)).join("\n");
    expect(text).toContain("Kunden har endret kalkylen: Nei");
    expect(text).toContain("Ingen endringer – standardverdiene i kalkylen er brukt.");
    expect(text).toContain("(standardverdier)");
    expect(text).toMatch(/Investering: 7\s495\s620 kr/);
    expect(text).toMatch(/Årlig netto før renter og skatt: 1\s238\s964 kr/);
    expect(text).toContain("3,73 år");
    expect(text).toMatch(/Enova-støtte: 2\s880\s000 kr/);
    expect(text).toMatch(/Netto over 10 år etter investering: 7\s774\s019 kr/);
  });

  test("endringer vises med standard og kundens verdi, med enheter", () => {
    const input = { ...DEFAULT_INPUT, salePrice: 3.5, batteryUnits: 4 };
    const text = describeSetup(input, calculate(input)).join("\n");
    expect(text).toContain("Kunden har endret kalkylen: Ja");
    expect(text).toContain("Salgspris til andre: 4,5 kr/kWh → 3,5 kr/kWh");
    expect(text).toContain("Batterienheter: 7 → 4");
    expect(text).toContain("(standard)");
    expect(text).toMatch(/Investering: 5\s694\s720 kr/);
  });

  test("endret og satt tilbake regnes ikke som endring, også via fordelingsslideren", () => {
    const changed = { ...DEFAULT_INPUT, chargers: 8 };
    const back = { ...changed, chargers: DEFAULT_INPUT.chargers };
    expect(setupChanges(back)).toHaveLength(0);
    const moved = withChargingShare(withChargingShare(DEFAULT_INPUT, 0.4), 0.625);
    expect(setupChanges(moved)).toHaveLength(0);
  });

  test("støttevalget skrives i klartekst", () => {
    const ch = setupChanges({ ...DEFAULT_INPUT, supportMode: "amount" }).map((c) => ({
      label: c.label,
      from: c.from.replace(/\s/g, " "),
      to: c.to.replace(/\s/g, " "),
    }));
    expect(ch).toEqual([
      { label: "Støtte", from: "DC-ladeeffekt × 4 000 kr/kW", to: "Søkebeløp 2 680 000 kr" },
    ]);
  });
});
