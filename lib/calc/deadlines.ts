/**
 * Søknadsfrister for «Bedriftslading for tunge kjøretøy» (Asbjørn, 24.11.2026).
 *
 * Serveren henter fristene fra Enovas søknadsside én gang i døgnet
 * (`lib/deadlines-server.ts`). Her ligger det som ikke trenger nettet: å lese
 * fristene ut av HTML-en, velge neste frist og lage teksten. Alle frister er
 * kl. 12.00 norsk tid; Europe/Oslo gir riktig sommer- og vintertid.
 */

export const ENOVA_DEADLINES_URL =
  "https://enova.no/nb/bedrift/landtransport/stottetilbud-innen-landtransport/bedriftslading-for-tunge-kjoretoy/soknadsinformasjon";

/**
 * Fristene slik de sto hos Enova da siden ble kontrollert 24.11.2026, kl. 12.00 norsk tid
 * (11.00 UTC om vinteren, 10.00 UTC med sommertid). Brukes til første vellykkede henting.
 * Skrevet ut som faste tidspunkter: å regne dem ut her, før TZ og MONTHS lenger ned er
 * definert, krasjer modulen i Next dev («Cannot access 'TZ' before initialization»).
 */
export const BASELINE_DEADLINES = [
  "2027-02-03T11:00:00.000Z",
  "2027-06-03T10:00:00.000Z",
  "2027-09-03T10:00:00.000Z",
  "2027-11-03T11:00:00.000Z",
];
export const BASELINE_SOURCE = "Kontrollert hos Enova 24.11.2026";

export type DeadlineStatus = "ok" | "manual" | "fallback";

/** Fristlisten som deles av alle fristtekster på siden. */
export interface DeadlineInfo {
  /** ISO-tidspunkter, sortert */
  dates: string[];
  /** ok = hentet fra Enova, manual = manuelt korrigert, fallback = henting feilet, siste kjente liste brukes */
  status: DeadlineStatus;
  source: string;
  /** Når listen sist ble hentet fra Enova (null for manuell eller reserveliste) */
  fetchedAt: string | null;
}

const TZ = "Europe/Oslo";

const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function osloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

/** «2027-06-03» → 3. juni 2027 kl. 12.00 norsk tid (10.00 UTC om sommeren, 11.00 om vinteren). */
export function osloNoon(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  for (const utcHour of [11, 10]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], utcHour));
    const p = osloParts(d);
    if (p.h === 12 && p.d === +m[3]) return d;
  }
  return null;
}

const ymdOf = (d: Date) => {
  const p = osloParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};

/**
 * Leser fristene ut av HTML-en fra Enovas søknadsside. Alle fristene i
 * programmet er kl. 12.00, så en frist er en dato, og tidspunktet settes til
 * kl. 12.00 norsk tid. Datoene finnes på tre måter, og alle tre tas med:
 *
 * 1. Datoverdier med tidssone som er kl. 12.00 norsk tid (f.eks.
 *    «2027-02-03T11:00:00.000Z» i sidens data eller `<time datetime>`).
 * 2. Andre datoverdier (annet klokkeslett, f.eks. midnatt, eller bare dato)
 *    når den samme datoen også står i teksten.
 * 3. Tekstdatoer rett foran «kl. 12» («3. februar 2027 kl. 12.00», eller en
 *    tabell med «12.00» i neste celle).
 *
 * Har siden datoer i teksten, må datoverdier fra punkt 1 også stå der. Slik
 * velger vi fristene og ikke publiserings- eller endringsdatoer. Bare
 * framtidige frister tas med.
 */
export function parseEnovaDeadlines(html: string, now: Date = new Date()): Date[] {
  const raw = html.replace(/&nbsp;|\u00a0/g, " ");
  // Teksten uten tagger, så «3. februar 2027</td><td>12.00» leses som tekst.
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const textDates = new Map<string, number>(); // ymd → posisjon rett etter datoen
  const add = (ymd: string, end: number) => {
    if (!textDates.has(ymd)) textDates.set(ymd, end);
  };
  const textRe = new RegExp(`\\b(\\d{1,2})\\.\\s*(${MONTHS.join("|")})\\s+(20\\d{2})`, "gi");
  for (const m of text.matchAll(textRe)) {
    add(`${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, m.index! + m[0].length);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g)) {
    add(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, m.index! + m[0].length);
  }

  const days = new Set<string>();

  // 1 og 2: datoverdier i HTML-en og sidens data
  const isoRe = /\b(20\d{2}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/g;
  for (const m of raw.matchAll(isoRe)) {
    if (m[2] !== undefined && m[4] !== undefined) {
      const d = new Date(m[0]);
      if (Number.isNaN(d.getTime())) continue;
      const p = osloParts(d);
      const ymd = ymdOf(d);
      const noon = p.h === 12 && p.min === 0;
      if ((noon && (!textDates.size || textDates.has(ymd))) || textDates.has(ymd)) days.add(ymd);
      // Et tidspunkt nær midnatt kan bety datoen før i UTC; se også på datoen slik den er skrevet.
      else if (textDates.has(m[1])) days.add(m[1]);
    } else if (textDates.has(m[1])) {
      days.add(m[1]);
    }
  }

  // 3: tekstdatoer rett foran «kl. 12»
  for (const [ymd, end] of textDates) {
    if (/^[\s,|–-]*(?:(?:klokken|kl\.?)\s*12(?:[.:]00)?\b|12[.:]00\b)/i.test(text.slice(end, end + 40))) days.add(ymd);
  }

  // Bare framtidige frister (publiserings- og endringsdatoer ligger bak oss),
  // høyst fem år fram og høyst 24 frister.
  const ok = [...days]
    .map((ymd) => osloNoon(ymd))
    .filter((d): d is Date => !!d && d.getTime() > now.getTime() && d.getUTCFullYear() <= now.getUTCFullYear() + 5);
  ok.sort((a, b) => a.getTime() - b.getTime());
  return ok.length > 24 ? [] : ok;
}

/**
 * Fristene som er kontrollert manuelt (BASELINE_DEADLINES), forsvinner ikke
 * før de er passert, selv om hentingen ikke finner dem. Flytter Enova en
 * frist, ligger den nye datoen nær den gamle; da gjelder Enovas dato.
 * Gir listen og hvilke kontrollerte frister som manglet hos Enova.
 */
export function withCheckedDeadlines(
  fetched: Date[],
  checked: string[] = BASELINE_DEADLINES,
  now: Date = new Date(),
): { dates: Date[]; missing: Date[] } {
  const near = 45 * 86_400_000;
  const missing = checked
    .map((iso) => new Date(iso))
    .filter((c) => c.getTime() > now.getTime() && !fetched.some((f) => Math.abs(f.getTime() - c.getTime()) < near));
  const dates = [...fetched, ...missing].sort((a, b) => a.getTime() - b.getTime());
  return { dates, missing };
}

/** Manuell korrigering: «2027-02-03, 2027-06-03» eller fulle ISO-tidspunkter. */
export function parseManualDeadlines(value: string | undefined): Date[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? osloNoon(v) : new Date(v)))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

/** Hele dager mellom to datoer, regnet i norske kalenderdager. */
function calendarDaysBetween(from: Date, to: Date) {
  const a = osloParts(from);
  const b = osloParts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export type DeadlineView =
  | { kind: "next"; date: Date; daysLeft: number }
  /** Ingen framtidige frister publisert */
  | { kind: "none" }
  /** Hentefeil og ingen framtidige frister i mellomlageret */
  | { kind: "unknown" };

/** Første frist som ligger fram i tid. Ved fristen (kl. 12.00) går visningen over til neste. */
export function deadlineView(info: Pick<DeadlineInfo, "dates" | "status">, now: Date = new Date()): DeadlineView {
  const next = info.dates
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (next) return { kind: "next", date: next, daysLeft: calendarDaysBetween(now, next) };
  return info.status === "fallback" ? { kind: "unknown" } : { kind: "none" };
}

/** «3. februar 2027 kl. 12.00» */
export function formatDeadline(date: Date): string {
  const p = osloParts(date);
  return `${p.d}. ${MONTHS[p.m - 1]} ${p.y} kl. ${String(p.h).padStart(2, "0")}.${String(p.min).padStart(2, "0")}`;
}

/** «om 71 dager», «i morgen», «i dag» */
export function formatDaysLeft(days: number): string {
  if (days <= 0) return "i dag";
  if (days === 1) return "i morgen";
  return `om ${days} dager`;
}
