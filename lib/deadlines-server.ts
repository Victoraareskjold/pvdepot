import { unstable_cache } from "next/cache";
import {
  BASELINE_DEADLINES,
  BASELINE_SOURCE,
  ENOVA_DEADLINES_URL,
  parseEnovaDeadlines,
  parseManualDeadlines,
  withCheckedDeadlines,
  type DeadlineInfo,
} from "./calc/deadlines";

/**
 * Henter søknadsfristene fra Enovas søknadsside én gang i døgnet.
 *
 * - Vellykket henting lagres i Nexts datamellomlager med kilde og tidspunkt.
 *   Den daglige hentingen fanger opp nye, endrede og fjernede datoer.
 * - Feiler hentingen, eller finner vi ingen frister i siden, kastes en feil.
 *   Da beholder mellomlageret siste gyldige liste (en mislykket henting
 *   tømmer den ikke), og vi varsler administrator.
 * - Er mellomlageret tomt og hentingen feiler, brukes listen som ble
 *   kontrollert 24.11.2026 (status «fallback»).
 * - Fristene i den kontrollerte listen beholdes til de er passert, også om
 *   hentingen ikke finner dem (`withCheckedDeadlines`). Neste frist er da
 *   alltid 3. februar 2027 fram til kl. 12.00 den dagen.
 * - Manuell korrigering: miljøvariabelen ENOVA_DEADLINES («2027-02-03,
 *   2027-06-03, …», kl. 12.00 norsk tid) overstyrer alt.
 * - Varsling: DEADLINES_ALERT_WEBHOOK (f.eks. en Slack-webhook) får en
 *   melding ved hentefeil, høyst hver sjette time per serverinstans.
 */

const DAY = 60 * 60 * 24;

const fetchFromEnova = unstable_cache(
  async (): Promise<{ dates: string[]; fetchedAt: string }> => {
    const res = await fetch(ENOVA_DEADLINES_URL, {
      headers: { "user-agent": "pvdepot (Smart Elektro Lading; fristvisning)", accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Enova svarte ${res.status}`);
    const dates = parseEnovaDeadlines(await res.text());
    if (!dates.length) throw new Error("Fant ingen framtidige søknadsfrister i siden til Enova");
    return { dates: dates.map((d) => d.toISOString()), fetchedAt: new Date().toISOString() };
  },
  ["enova-deadlines-v2"],
  { revalidate: DAY, tags: ["enova-deadlines"] },
);

let lastAlert = 0;
async function alertAdmin(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[frister] Henting fra Enova feilet: ${message}`);
  const hook = process.env.DEADLINES_ALERT_WEBHOOK;
  if (!hook || Date.now() - lastAlert < 6 * 60 * 60 * 1000) return;
  lastAlert = Date.now();
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `pvdepot: klarte ikke å hente søknadsfristene fra Enova (${message}). Siden viser siste kjente liste. Kontroller ${ENOVA_DEADLINES_URL}`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Varslingen skal aldri stoppe siden.
  }
}

export async function getDeadlines(): Promise<DeadlineInfo> {
  const manual = parseManualDeadlines(process.env.ENOVA_DEADLINES);
  if (manual.length) {
    return { dates: manual.map((d) => d.toISOString()), status: "manual", source: "Manuelt korrigert", fetchedAt: null };
  }
  try {
    const { dates: fetched, fetchedAt } = await fetchFromEnova();
    const { dates, missing } = withCheckedDeadlines(fetched.map((d) => new Date(d)));
    if (missing.length) {
      console.warn(
        `[frister] Enova-siden mangler kontrollerte frister: ${missing.map((d) => d.toISOString()).join(", ")}. Beholdt til de er passert.`,
      );
    }
    return { dates: dates.map((d) => d.toISOString()), status: "ok", source: ENOVA_DEADLINES_URL, fetchedAt };
  } catch (error) {
    await alertAdmin(error);
    return { dates: BASELINE_DEADLINES, status: "fallback", source: BASELINE_SOURCE, fetchedAt: null };
  }
}
