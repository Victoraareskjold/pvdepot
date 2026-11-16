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
- **Fast høyde:** iframen fyller skjermen under menyen, og appen scroller
  selv. 3D-depotet er en egen scroll-seksjon der scenen står fast mens man
  scroller, og kameraet går gjennom stoppene.
- **Melding til nettsiden** (`lib/embed.ts`): `lead` etter innsending.
  Nettsiden går til `/takk`, der Consentify/GTM teller konverteringen.
  Appen laster ingen pixler selv.
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
components/Experience.tsx Siden: hook, nøkkeltall, slidere, 3D, karusell, skjema.
components/KeyFigures.tsx De seks nøkkeltallene (ruller til ny verdi).
components/ScrollWorld.tsx 3D-depotet som scroll-seksjon med tekst per stopp.
components/Carousel.tsx   Bildekarusell. Bilder: sett `src` i SLIDES, filer i public/carousel/.
components/sections.tsx   Støttesjekk og resultatkort (regnestykket).
components/LivePanel.tsx  Ladeplassene i sanntid, lest fra simuleringen.
components/LeadForm.tsx   Skjemaet og oppsummeringen som sendes med.
components/world/         3D-verdenen (React Three Fiber), lastes etter tallene:
  layout.ts               Hvor alt står, kjøreruter.
  Building.tsx Ground.tsx Bygg, gård, vei, trær, gaffeltrucker.
  Fleet.tsx               Lastebiler og ladere: inn, koble til, lad, ut.
  sim.ts                  Trafikkstyringen (testes i sim.test.ts).
  Solar.tsx               Paneler som heises på plass av kranen.
  Energy.tsx              Nettstasjon, ny trafo, batteri, energiflyt.
  Pins.tsx                Merkelapper som følger tingene i verdenen.
app/api/lead/route.ts     Videresending av leads.
```

## Miljøvariabler

Se `.env.example`. I Vercel: `LEADS_API_URL=https://smartelektrosol.no/api/leads/create`.
I pvwebsites: `NEXT_PUBLIC_PVDEPOT_URL` hvis appen ikke ligger på
`https://pvdepot.vercel.app`.
