"use client";

import { useEffect, useState } from "react";
import {
  deadlineView,
  ENOVA_DEADLINES_URL,
  formatDaysLeft,
  formatDeadline,
  type DeadlineInfo,
  type DeadlineView,
} from "@/lib/calc/deadlines";

/**
 * Neste søknadsfrist, felles for alle fristtekster på siden. Oppdateres
 * hvert minutt og akkurat når fristen passeres, så visningen skifter også
 * for kunder som har siden åpen. Da hentes listen på nytt fra serveren.
 */
export function useDeadline(initial: DeadlineInfo): DeadlineView | null {
  const [info, setInfo] = useState(initial);
  // null til siden er i nettleseren, så server og klient ikke viser ulike tider.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const view = now ? deadlineView(info, now) : null;
  const nextAt = view?.kind === "next" ? view.date.getTime() : null;

  useEffect(() => {
    if (nextAt === null) return;
    const ms = nextAt - Date.now();
    // setTimeout tåler ikke mer enn ca. 24 dager; minuttsintervallet tar resten.
    if (ms > 2 ** 31 - 1) return;
    const id = setTimeout(
      () => {
        setNow(new Date());
        fetch("/api/deadlines")
          .then((r) => (r.ok ? r.json() : null))
          .then((fresh: DeadlineInfo | null) => fresh && Array.isArray(fresh.dates) && setInfo(fresh))
          .catch(() => {});
      },
      Math.max(0, ms + 50),
    );
    return () => clearTimeout(id);
  }, [nextAt]);

  return view;
}

/** «Neste søknadsfrist er 3. februar 2027 kl. 12.00, om 71 dager.» */
export function DeadlineText({ view, short }: { view: DeadlineView | null; short?: boolean }) {
  if (!view) return null;
  if (view.kind === "next") {
    return short ? (
      <>
        Søknadsfrist <strong>{formatDeadline(view.date)}</strong>, {formatDaysLeft(view.daysLeft)}.
      </>
    ) : (
      <>
        Neste søknadsfrist er <strong>{formatDeadline(view.date)}</strong>, {formatDaysLeft(view.daysLeft)}.
      </>
    );
  }
  if (view.kind === "none") {
    return (
      <>
        Neste søknadsfrist er ikke publisert ennå.{" "}
        <a href={ENOVA_DEADLINES_URL} target="_blank" rel="noopener noreferrer">
          Se Enova
        </a>
      </>
    );
  }
  return (
    <a href={ENOVA_DEADLINES_URL} target="_blank" rel="noopener noreferrer">
      Sjekk neste søknadsfrist hos Enova
    </a>
  );
}
