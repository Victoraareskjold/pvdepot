"use client";

import { useRef, useState, type FormEvent } from "react";
import type { PlannerInput, PlannerResult } from "@/lib/calc/model";
import { ctaFor, describeAnswers, VERDICT_TEXT, type QualifyAnswers, type QualifyResult } from "@/lib/calc/qualify";
import { describeSetup } from "@/lib/calc/setup";
import { readTrackingParams, reportLead } from "@/lib/embed";
import type { SiteTheme } from "@/lib/sites";

/**
 * Teksten som følger henvendelsen til dashboardet: kundens oppsett i
 * kalkylen (endret eller ikke) og støttesjekken. Lages i det skjemaet
 * sendes, så senere endringer ikke påvirker det som er sendt inn.
 */
function summarize(input: PlannerInput, r: PlannerResult, answers: QualifyAnswers, q: QualifyResult): string {
  return [
    "— Bedriftslading (kalkulator) —",
    ...describeSetup(input, r),
    "",
    `Støttesjekk: ${VERDICT_TEXT[q.verdict].title} (${q.answered} av ${q.total} besvart)`,
    ...q.findings.map((f) => `  ${f.status === "red" ? "Rødt" : "Gult"}: ${f.text}`),
    "Svar:",
    ...describeAnswers(answers).map((l) => `  ${l}`),
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
    <section className="lead" id="kontakt" aria-labelledby="lead-title">
      <div className="lead-copy">
        <h2 id="lead-title">Send inn, så tar vi kontakt</h2>
        <p>
          Vi tar en uforpliktende prat om behovene og planene deres. Sammen ser vi om løsningen kan være aktuell, og om
          det er grunnlag for å gå videre med tilbud og Enova-søknad.
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
          {state === "sending" ? "Sender …" : ctaFor(check.verdict)}
        </button>
        <p className="field-hint wide">
          Vi bruker opplysningene bare til å følge opp henvendelsen.
        </p>
      </form>
    </section>
  );
}
