# pvdepot – CLAUDE.md

Se README.md for oppsett og struktur. Det viktigste å vite:

## Enova-reglene (lest 12.11.2026)

Kilde: enova.no, Bedriftslading for tunge kjøretøy, søknadsinformasjon og spørsmål og svar.

- Inntil 60 % av godkjente kostnader, maks 3 mill. kr per prosjekt. Competitive bidding.
- Rangering: søkt støtte delt på samlet tilgjengelig ladeeffekt (kr per kW). Lavere er bedre.
- Hvert ladepunkt i grunnlaget må være over 50 kW.
- Batteri teller når det er nødvendig for laderen og i samme styringssystem.
- Sol teller bare for den kvalifiserende delen (grensen er ikke publisert, så vi holder sol utenfor).
- Driftsplikt fem år på samme sted. Søker må eie laderne, ikke nødvendigvis tomten.
- Kjøretøy over 4,25 tonn. Elektriske traktorer er ikke med.
- Frister 2027: 3. feb, 3. juni, 3. sep, 3. nov, alle kl. 12.

Ikke bekreftet ennå (må leses i vilkårs-PDF-en, oppdatert 12.11.2026):
- Om nettforsterkning/anleggsbidrag er godkjent kostnad (`gridUpgradeEligible: false`).
- At prosjektet ikke kan være startet før søknad (generell statsstøtteregel, brukt i støttesjekken).
- Grensen for kr per kW i forrige runde (`enovaHistoricalCutoffKrPerKw`, fra Enovas Power BI).

## Regler for koden

- Alle tall og priser ligger i `lib/calc/assumptions.ts`. Ikke hardkod tall i komponenter.
- Regn i `lib/calc/model.ts` og test i `model.test.ts`.
- Sideoppsett (skisse 16.11.2026): hook og seks nøkkeltall, slidere, 3D-depotet som scroll-seksjon (`ScrollWorld.tsx`: seksjonen er flere skjermer høy, scenen står sticky, fremdriften styrer kamera og tekst; scenen pauser utenfor skjermen), bildekarusell (`Carousel.tsx`, bilder i `public/carousel/1-12.png`), støttesjekk og skjema.
- Appen vises i en iframe med fast høyde (skjermen under menyen) og scroller selv, så `position: sticky` virker.
- 3D: `components/world/` (layout, bygg, flåte med ladesyklus, sol med kran, energi, merkelapper). Simuleringen deler status med panelene via `world/live.ts`.
- Trafikken på depotet ligger i `components/world/sim.ts` (uten 3D) og testes i `sim.test.ts`: ingen overlapp mellom biler eller med laderne, ingen vranglås. Endrer du kjøreruter eller fart i `layout.ts`/`sim.ts`, kjør `bun test`.
- Ytelse: tegn mange like ting med `Instanced` (parts.tsx), ikke lag objekter i `useFrame`, og hold tunge komponenter i `memo`. `?debug=1` gir `window.__gl.info`.
- Appen skal ikke laste sporingspixler. Sporing og samtykke ligger på nettsiden (Consentify).
- 3D-scenen er pynt. Kalkylen og skjemaet må virke uten WebGL.

## Runde 19.11.2026 (Smart Elektro: Ole Morten, Audun)

- Lastebilene lader ved lasterampene på fasaden, som vender mot sørvest (nord er rett opp på skjermen, kompass i scenen). Bilene kjører langs veien, stopper forbi rampen og rygger inn; DC-laderen henger på veggen ved porten. Bare én bil i bevegelse på gården om gangen (`sim.ts`, testet i `sim.test.ts`).
- Batteriene står foran kontoret, godt synlig. Standard batteri er 600 kWh.
- Enova-støtten regnes per kW samtidig ladeeffekt med laststyring (ikke summen av laderne). Grensen fra de siste rundene er 4 200 kr/kW. Støttegraden velges automatisk som den høyeste som holder søknaden under grensen (5 % margin, maks 60 %); kunden kan overstyre. Sol og nettforsterkning er med i grunnlaget. «Nettilknytning kommer i tillegg» vises når nettkapasiteten er ukjent.
- Forsiden: rolig topp (logo «Smart Elektro Lading», ingress, én knapp «Få hjelp med Enova-søknaden»), slidere og tre nøkkeltall i et panel ved siden av 3D-scenen, seksjon om hvordan vi hjelper med søknaden, svevende knapp. «Merpris for elektriske biler er ikke med» står rett under nøkkeltallene.
- Logoen `public/brand/smartelektrolading.png` er laget fra Sol-logoen (solen byttet med et lyn, «SOL» med «LADING» i Oswald). Midlertidig til Smart Elektro har en offisiell.

## Runde 20.11.2026 (Asbjørn: «Endringer til Smart Elektro underside lading»)

- Støttesjekken (`lib/calc/qualify.ts`): seks spørsmål med oppfølginger, grønn/gul/rød, ingen forhåndsvalg, «X av 6 spørsmål besvart». Rødt slår gult. Bytter man hovedsvar, nullstilles oppfølgingen (`setAnswer`). Knappen er «Få hjelp med søknaden» (grønn/gul) eller «Få en vurdering av prosjektet» (rød). Skjemaet kan sendes uansett resultat. Tekstene er ordrett fra Asbjørn, ikke skriv dem om.
- Henvendelsen tar med kundens kalkyleoppsett (`lib/calc/setup.ts`): «Kunden har endret kalkylen: Ja/Nei», endrede felt som standard → kundens valg, hele oppsettet og det kalkylen regnet ut. Sammenligner med `DEFAULT_INPUT` i det skjemaet sendes, så en verdi som er satt tilbake teller ikke som endring. Nye felt i kalkylen må legges til i `SETUP_FIELDS`.
- Ikke skriv «gratis» om samtalen eller vurderingen.
