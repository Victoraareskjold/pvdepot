"use client";

import { useRef, useState, type FormEvent } from "react";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import type { QualifyAnswers, QualifyResult } from "@/lib/calc/qualify";
import { int, kr, pct } from "@/lib/format";
import { readTrackingParams, reportLead } from "@/lib/embed";
import type { SiteTheme } from "@/lib/sites";

/** Kort oppsummering som havner i leadets notat i dashboardet. */
function summarize(input: PlannerInput, r: PlannerResult, answers: QualifyAnswers, q: QualifyResult): string {
  return [
    "— Bedriftslading (kalkulator) —",
    `Kjøretøy: ${input.vehicles} × ${r.vehicle.label}, ${input.kmPerDay} km/dag, ${input.dwellHours} t på depot, ${input.operatingDays} dager/år`,
    `Ladere: ${r.chargePoints} × ${r.chargerKw} kW (${int(r.availableKw)} kW tilgjengelig, ${int(r.managedPeakKw)} kW med laststyring)`,
    `Tak: ${int(input.roofM2)} m², ${pct(input.solarCoverage)} sol = ${int(r.solarKwp)} kWp`,
    `Nett: ${input.gridSpareKw === null ? "ukjent ledig effekt" : `${int(input.gridSpareKw)} kW ledig`}${r.gridDeficitKw > 0 ? `, mangler ${int(r.gridDeficitKw)} kW` : ""}`,
    `Batteri: ${int(input.batteryKwh)} kWh`,
    `Investering: ${kr(r.totalCost)}, støttegrunnlag ${kr(r.eligibleCost)}`,
    `Enova: søker ${pct(r.supportRate)} = ${kr(r.support)} (${int(r.krPerKw)} kr/kW)`,
    `Spart per år: ${kr(r.annual.totalSaving)}, ${int(r.annual.co2Tonnes)} t CO₂`,
    `Støttesjekk: ${q.verdict}, klar ${q.readiness}/100`,
    `Svar: foretaksreg. ${answers.registered}, eget depot ${answers.ownDepot}, kjøretøy ${answers.vehiclePlan}, startet ${answers.started}, 5 år ${answers.fiveYears}, nettselskap ${answers.gridTalked}`,
  ].join("\n");
}

export default function LeadForm({
  theme,
  input,
  result,
  answers,
  check,
}: {
  theme: SiteTheme;
  input: PlannerInput;
  result: PlannerResult;
  answers: QualifyAnswers;
  check: QualifyResult;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const data = new FormData(form.current!);
    const tracking = readTrackingParams();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: tracking.site,
          company: data.get("company"),
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email"),
          address: data.get("address"),
          comment: data.get("comment"),
          website: data.get("website"),
          summary: summarize(input, result, answers, check),
          gclid: tracking.gclid,
          fbclid: tracking.fbclid,
          utmCampaign: tracking.utmCampaign,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Henvendelsen ble ikke sendt. Prøv igjen.");
      setState("sent");
      reportLead(crypto.randomUUID?.() ?? String(Date.now()), Math.round(result.totalCost));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Henvendelsen ble ikke sendt. Prøv igjen.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <section className="lead is-sent" aria-live="polite">
        <h2>Takk, vi har fått tallene deres</h2>
        <p>{theme.name} tar kontakt for å gå gjennom anlegget og søknaden.</p>
      </section>
    );
  }

  return (
    <section className="lead" aria-labelledby="lead-title">
      <div className="lead-copy">
        <h2 id="lead-title">Send inn, så tar vi kontakt</h2>
        <p>
          {theme.name} går gjennom tallene med dere, sjekker nettkapasiteten og setter opp et kostnadsgrunnlag dere kan
          søke Enova med. Det er gratis og uforpliktende.
        </p>
        <p className="lead-sends">
          Vi sender med beregningen: {result.chargePoints} ladere, {kr(result.totalCost)} i investering og{" "}
          {kr(result.support)} i mulig støtte.
        </p>
      </div>
      <form ref={form} onSubmit={submit} className="lead-form" noValidate={false}>
        <label>
          Firma
          <input name="company" required autoComplete="organization" />
        </label>
        <label>
          Navn
          <input name="name" required autoComplete="name" />
        </label>
        <label>
          Telefon
          <input name="phone" required type="tel" autoComplete="tel" />
        </label>
        <label>
          E-post
          <input name="email" required type="email" autoComplete="email" />
        </label>
        <label className="wide">
          Adresse til depotet
          <input name="address" required autoComplete="street-address" />
        </label>
        <label className="wide">
          <span className="label-line">
            Noe vi bør vite? <span className="optional">(valgfritt)</span>
          </span>
          <textarea name="comment" rows={3} />
        </label>
        <label className="hp" aria-hidden>
          Nettside
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        {error && (
          <p className="form-error wide" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary wide" disabled={state === "sending"}>
          {state === "sending" ? "Sender …" : "Få hjelp med søknaden"}
        </button>
        <p className="field-hint wide">
          Vi bruker opplysningene bare til å følge opp henvendelsen.
        </p>
      </form>
    </section>
  );
}
