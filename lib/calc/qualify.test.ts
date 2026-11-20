import { describe, expect, test } from "bun:test";
import { describeAnswers, qualify, QUESTIONS, setAnswer, type QualifyAnswers } from "./qualify";
import { describeSetup, setupChanges } from "./setup";
import { calculate, DEFAULT_INPUT } from "./model";

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
  });

  test("endringer vises med standard og kundens verdi, med enheter", () => {
    const input = { ...DEFAULT_INPUT, vehicles: 10, batteryKwh: 1200 };
    const text = describeSetup(input, calculate(input)).join("\n");
    expect(text).toContain("Kunden har endret kalkylen: Ja");
    expect(text).toContain("Lastebiler som skal lade: 6 → 10");
    expect(text).toMatch(/Batteri: 600 kWh → 1\s200 kWh/);
    expect(text).toContain("(standard)");
    expect(text).toContain("Ladere: 10 ×");
  });

  test("endret og satt tilbake regnes ikke som endring", () => {
    const changed = { ...DEFAULT_INPUT, vehicles: 12 };
    const back = { ...changed, vehicles: DEFAULT_INPUT.vehicles };
    expect(setupChanges(back)).toHaveLength(0);
  });

  test("ukjent nett og automatisk støttegrad skrives i klartekst", () => {
    const input = { ...DEFAULT_INPUT, gridSpareKw: 300, supportRate: 0.3 };
    const ch = setupChanges(input);
    expect(ch.find((c) => c.label.startsWith("Ledig effekt"))).toEqual({
      label: "Ledig effekt i nettilknytningen",
      from: "Vet ikke",
      to: "300 kW",
    });
    expect(ch.find((c) => c.label === "Støttegrad")?.from).toBe("Automatisk");
  });
});
