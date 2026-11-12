/** Søknadsfrister for Bedriftslading for tunge kjøretøy, alle kl. 12:00 norsk tid. */
export const ENOVA_DEADLINES = [
  "2027-02-03T12:00:00+01:00",
  "2027-06-03T12:00:00+02:00",
  "2027-09-03T12:00:00+02:00",
  "2027-11-03T12:00:00+01:00",
].map((d) => new Date(d));

export function nextDeadline(now: Date = new Date()): { date: Date; daysLeft: number } | null {
  const date = ENOVA_DEADLINES.find((d) => d.getTime() > now.getTime());
  if (!date) return null;
  const daysLeft = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  return { date, daysLeft };
}

export function formatDeadline(date: Date): string {
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });
}
