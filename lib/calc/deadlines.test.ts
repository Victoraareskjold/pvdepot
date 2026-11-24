import { describe, expect, test } from "bun:test";
import {
  BASELINE_DEADLINES,
  deadlineView,
  formatDaysLeft,
  formatDeadline,
  osloNoon,
  parseEnovaDeadlines,
  parseManualDeadlines,
} from "./deadlines";

const info = (dates = BASELINE_DEADLINES, status: "ok" | "manual" | "fallback" = "ok") => ({ dates, status });
const at = (iso: string) => new Date(iso);

describe("fristene fra 24.11.2026", () => {
  test("kl. 12.00 norsk tid, med sommertid i juni og september", () => {
    expect(BASELINE_DEADLINES).toEqual([
      "2027-02-03T11:00:00.000Z",
      "2027-06-03T10:00:00.000Z",
      "2027-09-03T10:00:00.000Z",
      "2027-11-03T11:00:00.000Z",
    ]);
    expect(["2027-02-03", "2027-06-03", "2027-09-03", "2027-11-03"].map((d) => osloNoon(d)!.toISOString())).toEqual(
      BASELINE_DEADLINES,
    );
    expect(formatDeadline(new Date(BASELINE_DEADLINES[1]))).toBe("3. juni 2027 kl. 12.00");
    expect(formatDeadline(new Date(BASELINE_DEADLINES[2]))).toBe("3. september 2027 kl. 12.00");
  });

  test("rett før fristen vises den, ved fristen skifter visningen til 3. juni", () => {
    const before = deadlineView(info(), at("2027-02-03T10:59:59Z"));
    expect(before.kind === "next" && formatDeadline(before.date)).toBe("3. februar 2027 kl. 12.00");
    expect(before.kind === "next" && formatDaysLeft(before.daysLeft)).toBe("i dag");
    const atDeadline = deadlineView(info(), at("2027-02-03T11:00:00Z"));
    expect(atDeadline.kind === "next" && formatDeadline(atDeadline.date)).toBe("3. juni 2027 kl. 12.00");
  });

  test("antall dager regnes i norske kalenderdager", () => {
    const v = deadlineView(info(), at("2026-11-24T18:00:00+01:00"));
    expect(v.kind === "next" && v.daysLeft).toBe(71);
    const late = deadlineView(info(), at("2027-02-02T23:30:00+01:00"));
    expect(late.kind === "next" && formatDaysLeft(late.daysLeft)).toBe("i morgen");
  });

  test("etter siste kjente frist: ikke publisert ennå, eller sjekk hos Enova ved hentefeil", () => {
    expect(deadlineView(info(), at("2027-11-04T12:00:00Z")).kind).toBe("none");
    expect(deadlineView(info(BASELINE_DEADLINES, "fallback"), at("2027-11-04T12:00:00Z")).kind).toBe("unknown");
    // Hentefeil, men gyldige framtidige frister i listen: vis dem.
    expect(deadlineView(info(BASELINE_DEADLINES, "fallback"), at("2026-12-01T12:00:00Z")).kind).toBe("next");
  });
});

describe("lese fristene fra Enovas side", () => {
  const now = at("2026-11-24T12:00:00Z");

  test("datoverdier med tidssone, kontrollert mot datoene i teksten", () => {
    const html = `
      <h2>Søknadsfrister</h2>
      <ul>
        <li><time datetime="2027-02-03T12:00:00+01:00">3. februar 2027 kl. 12:00</time></li>
        <li><time datetime="2027-06-03T12:00:00+02:00">3. juni 2027 kl. 12:00</time></li>
      </ul>
      <script>{"publishedAt":"2026-11-12T12:00:00+01:00","deadlines":["2027-09-03T10:00:00.000Z","2027-11-03T11:00:00.000Z"]}</script>
      <p>3.&nbsp;september 2027 og 3. november 2027</p>
      <p>Sist oppdatert 12.11.2026</p>`;
    const dates = parseEnovaDeadlines(html, now).map((d) => d.toISOString());
    expect(dates).toEqual(BASELINE_DEADLINES);
  });

  test("datoer som ikke er kl. 12, eller ikke står i teksten, tas ikke med", () => {
    const html = `<p>3. februar 2027</p><time datetime="2027-02-03T11:00:00Z"></time><time datetime="2026-11-12T09:14:00Z"></time>
      <script>"2027-03-01T11:00:00.000Z"</script>`;
    expect(parseEnovaDeadlines(html, now).map((d) => d.toISOString())).toEqual(["2027-02-03T11:00:00.000Z"]);
  });

  test("bare tekst: datoer foran «kl. 12», også i en tabell", () => {
    const html = `<table><tr><td>3. februar 2027</td><td>12.00</td></tr><tr><td>3. juni 2027</td><td>12.00</td></tr></table>
      <p>Søknader må være sendt innen 3. september 2027 kl. 12. Neste frist er 3. november 2027, klokken 12.</p>
      <p>Publisert 1. oktober 2026</p>`;
    expect(parseEnovaDeadlines(html, now).map((d) => d.toISOString())).toEqual(BASELINE_DEADLINES);
  });

  test("endrede datoer hos Enova slår igjennom", () => {
    const html = `<time datetime="2027-02-10T11:00:00Z">10. februar 2027</time><time datetime="2027-06-03T10:00:00Z">3. juni 2027</time>`;
    expect(parseEnovaDeadlines(html, now).map((d) => d.toISOString())).toEqual([
      "2027-02-10T11:00:00.000Z",
      "2027-06-03T10:00:00.000Z",
    ]);
  });

  test("en side uten frister gir tom liste (serveren beholder da siste gyldige liste)", () => {
    expect(parseEnovaDeadlines("<html><body>Vedlikehold</body></html>", now)).toEqual([]);
  });
});

describe("manuell korrigering", () => {
  test("datoer blir kl. 12.00 norsk tid", () => {
    expect(parseManualDeadlines("2027-06-03, 2027-02-03").map((d) => d.toISOString())).toEqual([
      "2027-02-03T11:00:00.000Z",
      "2027-06-03T10:00:00.000Z",
    ]);
    expect(parseManualDeadlines(undefined)).toEqual([]);
    expect(osloNoon("2027-13-40")).toBeNull();
  });
});
