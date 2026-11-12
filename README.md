# pvdepot

Kalkulator og støttesjekk for lading av tunge kjøretøy på depot, med solceller
og batteri. Bedriften ser ladebehov, investering, Enova-støtte og driftstall,
og en 3D-scene av depotet som endrer seg med sliderne.

Laget for Smart Elektro Sol (eksklusivt blant partnerne ut 2027), mot Enovas
«Bedriftslading for tunge kjøretøy». Neste frist: 3. februar 2027 kl. 12.

## Kom i gang

```bash
bun install
bun dev          # http://localhost:3002/?site=smartelektrosol
bun test         # kalkylemodellen
bun run typecheck
```

## Slik henger det sammen

- **Egen app i iframe**, som Solkartet (pvmap). pvwebsites viser den på
  `/lading` (`src/app/[site]/lading/`), bare for `smartelektrosol`.
- **Parametre i URL-en:** `site`, `gclid`, `fbclid`, `utm_campaign`.
- **Meldinger til nettsiden** (`lib/embed.ts`):
  `resize` (høyde) og `lead` (etter innsending). Nettsiden setter høyden og
  går til `/takk`, der Consentify/GTM teller konverteringen. Appen laster
  ingen pixler selv.
- **Leads:** `POST /api/lead` sender videre til pvwebsites
  `/api/leads/create`, så leadet havner i dashboardet med beregningen i
  notatet. Uten `LEADS_API_URL` kjører den i tørrmodus.
- **Iframe-tilgang** styres av `frame-ancestors` i `next.config.ts`
  (overstyr med `FRAME_ANCESTORS`).

## Filer

```
lib/calc/assumptions.ts   Alle forutsetninger og priser. Endre her.
lib/calc/model.ts         Ladebehov, ladere, nett, batteri, sol, Enova, drift.
lib/calc/qualify.ts       Støttesjekken (krav og styrker).
lib/calc/deadlines.ts     Enova-frister 2027.
lib/sites.ts              Farger og navn per nettsted.
components/Planner.tsx    Siden: steg, resultater.
components/LeadForm.tsx   Skjemaet og oppsummeringen som sendes med.
components/scene/         3D-scenen (React Three Fiber), lastes etter tallene.
app/api/lead/route.ts     Videresending av leads.
```

## Miljøvariabler

Se `.env.example`. I Vercel: `LEADS_API_URL=https://smartelektrosol.no/api/leads/create`.
I pvwebsites: `NEXT_PUBLIC_PVDEPOT_URL` hvis appen ikke ligger på
`https://pvdepot.vercel.app`.
# pvdepot
