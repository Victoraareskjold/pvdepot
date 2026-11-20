/**
 * Støttesjekk mot Enovas «Bedriftslading for tunge kjøretøy».
 *
 * Spørsmål, svar og tekster er bestemt av Asbjørn (19.11.2026). Hvert svar
 * gir grønn, gul eller rød status. Noen svar viser et oppfølgingsspørsmål;
 * da er det oppfølgingen som avgjør statusen. Ingen svar er forhåndsvalgt.
 * Grønt betyr at prosjektet kan være aktuelt for støtte, ikke at kunden er
 * garantert støtte.
 */

export type Status = "green" | "yellow" | "red";

export interface Option {
  value: string;
  label: string;
  /** Status når svaret er valgt. Utelatt når svaret viser et oppfølgingsspørsmål. */
  status?: Status;
  /** Forklaring i resultatboksen (gule og røde svar) */
  note?: string;
  /** Svaret viser oppfølgingsspørsmålet */
  followUp?: boolean;
}

export interface Question {
  id: string;
  text: string;
  help?: string;
  options: Option[];
  followUp?: Omit<Question, "followUp">;
}

export const QUESTIONS: Question[] = [
  {
    id: "registered",
    text: "Er bedriften registrert i Enhetsregisteret?",
    options: [
      { value: "ja", label: "Ja", status: "green" },
      { value: "nei", label: "Nei", status: "red", note: "Bedriften må være registrert i Enhetsregisteret for å kunne søke." },
      { value: "usikker", label: "Usikker", status: "yellow", note: "Vi må sjekke om bedriften er registrert i Enhetsregisteret." },
    ],
  },
  {
    id: "users",
    text: "Hvem skal hovedsakelig bruke laderne?",
    options: [
      { value: "egne", label: "Egne kjøretøy", status: "green" },
      { value: "andre", label: "Andre bedrifters kjøretøy", followUp: true },
      { value: "begge", label: "Både egne og andre bedrifters kjøretøy", followUp: true },
      { value: "uavklart", label: "Ikke avklart", status: "yellow", note: "Vi må avklare hvem ladeanlegget skal etableres for." },
    ],
    followUp: {
      id: "intent",
      text: "Har dere en intensjonsavtale med de andre bedriftene som anlegget primært skal etableres for?",
      options: [
        { value: "ja", label: "Ja", status: "green" },
        { value: "ikke-enna", label: "Ikke ennå", status: "yellow", note: "Intensjonsavtale må være på plass før søknaden sendes." },
        {
          value: "hjelp",
          label: "Ønsker hjelp med dette",
          status: "yellow",
          note: "Vi hjelper dere med å avklare brukerne og nødvendig intensjonsavtale.",
        },
      ],
    },
  },
  {
    id: "vehicles",
    text: "Har dere eller bedriftene som skal lade, elektriske lastebiler eller busser over 4,25 tonn?",
    options: [
      { value: "i-bruk", label: "Ja, allerede i bruk", status: "green" },
      { value: "bestilt", label: "Bestilt", followUp: true },
      { value: "planlegger", label: "Planlegger kjøp", followUp: true },
      {
        value: "ingen",
        label: "Ingen konkrete planer",
        status: "red",
        note: "Det må være et kjent ladebehov og konkrete planer om elektriske tunge kjøretøy hos bedriftene som skal bruke anlegget.",
      },
    ],
    followUp: {
      id: "timing",
      text: "Skal kjøretøyene tas i bruk kort tid etter at ladeanlegget åpner, eller tidligere?",
      options: [
        { value: "ja", label: "Ja", status: "green" },
        { value: "nei", label: "Nei", status: "red", note: "Planen for kjøretøyene må samsvare med når ladeanlegget tas i bruk." },
        { value: "usikker", label: "Usikker", status: "yellow", note: "Vi må avklare når kjøretøyene skal tas i bruk." },
      ],
    },
  },
  {
    id: "started",
    text: "Har dere allerede besluttet å gjennomføre investeringen, inngått bindende bestilling eller startet arbeidet?",
    help: "Det er greit å ha innhentet tilbud og undersøkt mulighetene.",
    options: [
      { value: "nei", label: "Nei", status: "green" },
      { value: "ja", label: "Ja", followUp: true },
      {
        value: "usikker",
        label: "Usikker",
        status: "yellow",
        note: "Vi må avklare om prosjektet allerede er besluttet eller satt i gang.",
      },
    ],
    followUp: {
      id: "appliedBefore",
      text: "Var søknaden om Enova-støtte sendt inn før dette skjedde?",
      options: [
        {
          value: "ja",
          label: "Ja",
          status: "yellow",
          note: "Dere har allerede søkt. Vi må se på eksisterende søknad og prosjektstatus.",
        },
        {
          value: "nei",
          label: "Nei",
          status: "red",
          note: "Søknaden må sendes før prosjektet er besluttet gjennomført, satt i gang eller dere har forpliktet dere til å gjennomføre det.",
        },
        {
          value: "usikker",
          label: "Usikker",
          status: "yellow",
          note: "Vi må avklare tidspunktet for søknad, beslutning og bestilling.",
        },
      ],
    },
  },
  {
    id: "fiveYears",
    text: "Kan ladeanlegget stå og driftes på samme sted i minst fem år etter oppstart?",
    help: "Området kan være eid eller leid. Bruk av området må være avklart.",
    options: [
      { value: "ja", label: "Ja, og bruk av området er avklart", status: "green" },
      {
        value: "avklares",
        label: "Må avklares",
        status: "yellow",
        note: "Vi må avklare tilgang til området og drift i minst fem år.",
      },
      { value: "nei", label: "Nei", status: "red", note: "Ladeanlegget må driftes på omsøkt lokasjon i minst fem år." },
    ],
  },
  {
    id: "eighteenMonths",
    text: "Kan anlegget være ferdig og i drift innen 18 måneder etter innvilget støtte?",
    options: [
      { value: "ja", label: "Ja", status: "green" },
      { value: "avklares", label: "Må avklares", status: "yellow", note: "Vi må avklare fremdriften og forventet oppstart." },
      {
        value: "nei",
        label: "Nei",
        status: "red",
        note: "Anlegget må være ferdig og satt i drift innen 18 måneder etter vedtak fra Enova.",
      },
    ],
  },
];

/** Svar per spørsmåls-id (også oppfølgingene). Mangler = ikke besvart. */
export type QualifyAnswers = Partial<Record<string, string>>;

export const DEFAULT_ANSWERS: QualifyAnswers = {};

/**
 * Sett et svar. Bytter man hovedsvar til et som ikke viser oppfølgingen,
 * nullstilles oppfølgingssvaret, så det ikke påvirker resultatet.
 */
export function setAnswer(answers: QualifyAnswers, id: string, value: string): QualifyAnswers {
  const next = { ...answers, [id]: value };
  const q = QUESTIONS.find((x) => x.id === id);
  if (q?.followUp) {
    const opt = q.options.find((o) => o.value === value);
    if (!opt?.followUp) delete next[q.followUp.id];
  }
  return next;
}

/** Er oppfølgingen synlig for dette spørsmålet med disse svarene? */
export function followUpVisible(q: Question, answers: QualifyAnswers): boolean {
  if (!q.followUp) return false;
  return !!q.options.find((o) => o.value === answers[q.id])?.followUp;
}

export type Verdict = "incomplete" | Status;

export interface Finding {
  status: "yellow" | "red";
  text: string;
}

export interface QualifyResult {
  verdict: Verdict;
  answered: number;
  total: number;
  findings: Finding[];
}

export function qualify(answers: QualifyAnswers): QualifyResult {
  let answered = 0;
  let red = false;
  let yellow = false;
  const reds: Finding[] = [];
  const yellows: Finding[] = [];

  for (const q of QUESTIONS) {
    const main = q.options.find((o) => o.value === answers[q.id]);
    if (!main) continue;
    let decisive: Option | undefined = main;
    if (main.followUp && q.followUp) {
      decisive = q.followUp.options.find((o) => o.value === answers[q.followUp!.id]);
      if (!decisive) continue; // Oppfølgingen mangler svar: spørsmålet er ikke besvart.
    }
    answered++;
    if (decisive.status === "red") {
      red = true;
      if (decisive.note) reds.push({ status: "red", text: decisive.note });
    } else if (decisive.status === "yellow") {
      yellow = true;
      if (decisive.note) yellows.push({ status: "yellow", text: decisive.note });
    }
  }

  const total = QUESTIONS.length;
  const verdict: Verdict = answered < total ? "incomplete" : red ? "red" : yellow ? "yellow" : "green";
  // Røde punkter først.
  return { verdict, answered, total, findings: [...reds, ...yellows] };
}

export const VERDICT_TEXT: Record<Verdict, { title: string; body: string }> = {
  incomplete: {
    title: "Svar på spørsmålene for å få en foreløpig vurdering",
    body: "",
  },
  green: {
    title: "Prosjektet kan være aktuelt for støtte",
    body: "Svarene deres passer med kravene i denne første sjekken. Vi hjelper dere med å vurdere prosjektet og forberede søknaden.",
  },
  yellow: {
    title: "Vi må avklare noen punkter",
    body: "Prosjektet kan være aktuelt, men vi trenger noen avklaringer først.",
  },
  red: {
    title: "Prosjektet oppfyller ikke alle kravene nå",
    body: "Ut fra svarene deres er det noen krav som ikke er oppfylt slik prosjektet er planlagt.",
  },
};

export const CHECK_DISCLAIMER =
  "Dette er en foreløpig sjekk av utvalgte krav. Vi må også vurdere teknisk løsning, ladebehov og øvrige vilkår. Enova avgjør søknaden, og støtten tildeles gjennom konkurranse.";

/** Knappeteksten etter resultatet. */
export const ctaFor = (v: Verdict) => (v === "red" ? "Få en vurdering av prosjektet" : "Få hjelp med søknaden");

/** Svarene som tekst, til henvendelsen. Bare synlige oppfølginger tas med. */
export function describeAnswers(answers: QualifyAnswers): string[] {
  const lines: string[] = [];
  for (const q of QUESTIONS) {
    const main = q.options.find((o) => o.value === answers[q.id]);
    lines.push(`${q.text} ${main ? main.label : "(ikke besvart)"}`);
    if (q.followUp && main?.followUp) {
      const f = q.followUp.options.find((o) => o.value === answers[q.followUp!.id]);
      lines.push(`  ${q.followUp.text} ${f ? f.label : "(ikke besvart)"}`);
    }
  }
  return lines;
}
