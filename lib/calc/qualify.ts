/**
 * Støttesjekk mot Enovas «Bedriftslading for tunge kjøretøy».
 *
 * Krav (stopper søknaden) og styrker (gjør søknaden bedre) er skilt.
 * Kildene står ved hvert punkt. Kravet om at prosjektet ikke er startet
 * er det generelle kravet om insentiveffekt i statsstøtteregelverket, og
 * må bekreftes i vilkårs-PDF-en for runden.
 */

export type Answer = "ja" | "nei" | "usikker";

export interface QualifyAnswers {
  /** Registrert i Foretaksregisteret */
  registered: Answer;
  /** Ladingen skal stå på eget depot/anlegg (ikke offentlig hurtiglading) */
  ownDepot: Answer;
  /** Status for elektriske tunge kjøretøy */
  vehiclePlan: "bestilt" | "planlagt" | "vurderer" | "nei";
  /** Bestilt ladere eller startet arbeidet allerede */
  started: Answer;
  /** Skal bruke lokasjonen i minst fem år */
  fiveYears: Answer;
  /** Snakket med nettselskapet om kapasitet */
  gridTalked: Answer;
}

export const DEFAULT_ANSWERS: QualifyAnswers = {
  registered: "ja",
  ownDepot: "ja",
  vehiclePlan: "planlagt",
  started: "nei",
  fiveYears: "ja",
  gridTalked: "usikker",
};

export type Verdict = "kvalifiserer" | "avklar" | "kvalifiserer-ikke";

export interface Finding {
  kind: "stopp" | "avklar" | "styrke" | "svakhet";
  text: string;
}

export interface QualifyResult {
  verdict: Verdict;
  /** 0–100, hvor klar søknaden er til innlevering */
  readiness: number;
  findings: Finding[];
  /** Annet Enova-program som passer bedre, hvis noe */
  redirect?: { label: string; href: string };
}

const ENOVA = "https://enova.no/nb/bedrift/landtransport/stottetilbud-innen-landtransport";

export function qualify(a: QualifyAnswers): QualifyResult {
  const findings: Finding[] = [];
  let redirect: QualifyResult["redirect"];

  if (a.registered === "nei") {
    findings.push({ kind: "stopp", text: "Søkeren må være registrert i Foretaksregisteret." });
  } else if (a.registered === "usikker") {
    findings.push({ kind: "avklar", text: "Sjekk at selskapet som skal eie laderne, står i Foretaksregisteret." });
  }

  if (a.ownDepot === "nei") {
    findings.push({
      kind: "stopp",
      text: "Programmet gjelder lading på eget depot eller anlegg. Offentlig lading langs veien har et eget program.",
    });
    redirect = { label: "Underveislading for tunge kjøretøy", href: `${ENOVA}/underveislading-for-tunge-kjoretoy` };
  } else if (a.ownDepot === "usikker") {
    findings.push({
      kind: "avklar",
      text: "Dere trenger ikke eie tomten, men selskapet som søker, må eie laderne og føre dem i balansen.",
    });
  }

  if (a.started === "ja") {
    findings.push({
      kind: "stopp",
      text: "Prosjektet kan normalt ikke være startet eller laderne bestilt før søknaden er sendt.",
    });
  } else if (a.started === "usikker") {
    findings.push({
      kind: "avklar",
      text: "Vent med å bestille ladere eller signere kontrakt til søknaden er sendt.",
    });
  }

  if (a.vehiclePlan === "nei") {
    findings.push({
      kind: "stopp",
      text: "Enova forventer at hovedbrukeren planlegger å kjøpe elektriske tunge kjøretøy som tas i bruk kort tid etter at laderen åpner.",
    });
  } else if (a.vehiclePlan === "vurderer") {
    findings.push({ kind: "svakhet", text: "En konkret plan for innkjøp av kjøretøy gjør søknaden sterkere." });
  } else if (a.vehiclePlan === "bestilt") {
    findings.push({ kind: "styrke", text: "Bestilte kjøretøy viser at laderne blir tatt i bruk." });
  } else {
    findings.push({ kind: "styrke", text: "Planlagt innkjøp av elektriske kjøretøy passer programmet." });
  }

  if (a.fiveYears === "nei") {
    findings.push({
      kind: "stopp",
      text: "Laderne må driftes på samme sted i fem år etter støtten.",
    });
  } else if (a.fiveYears === "usikker") {
    findings.push({ kind: "avklar", text: "Laderne må driftes på samme sted i fem år. Sjekk leieavtalen." });
  }

  if (a.gridTalked === "ja") {
    findings.push({ kind: "styrke", text: "Avklart nettkapasitet gir et sikrere kostnadsgrunnlag." });
  } else {
    findings.push({
      kind: "svakhet",
      text: "Snakk med nettselskapet tidlig. Svar om kapasitet kan ta flere uker.",
    });
  }

  const stops = findings.filter((f) => f.kind === "stopp").length;
  const clarify = findings.filter((f) => f.kind === "avklar").length;
  const verdict: Verdict = stops > 0 ? "kvalifiserer-ikke" : clarify > 0 ? "avklar" : "kvalifiserer";

  let readiness = 100;
  readiness -= stops * 40 + clarify * 15;
  readiness -= { bestilt: 0, planlagt: 5, vurderer: 20, nei: 30 }[a.vehiclePlan];
  readiness -= a.gridTalked === "ja" ? 0 : 15;
  readiness = Math.max(5, Math.min(100, readiness));

  return { verdict, readiness, findings, redirect };
}
