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
- Sideoppsett (skisse 16.11.2026): hook og seks nøkkeltall, slidere, 3D-depotet som scroll-seksjon (`ScrollWorld.tsx`: seksjonen er flere skjermer høy, scenen står sticky, fremdriften styrer kamera og tekst; scenen pauser utenfor skjermen), bildekarusell (`Carousel.tsx`, plassholdere til Smart Elektro sender bilder), støttesjekk og skjema.
- Appen vises i en iframe med fast høyde (skjermen under menyen) og scroller selv, så `position: sticky` virker.
- 3D: `components/world/` (layout, bygg, flåte med ladesyklus, sol med kran, energi, merkelapper). Simuleringen deler status med panelene via `world/live.ts`.
- Trafikken på depotet ligger i `components/world/sim.ts` (uten 3D) og testes i `sim.test.ts`: ingen overlapp mellom biler eller med laderne, ingen vranglås. Endrer du kjøreruter eller fart i `layout.ts`/`sim.ts`, kjør `bun test`.
- Ytelse: tegn mange like ting med `Instanced` (parts.tsx), ikke lag objekter i `useFrame`, og hold tunge komponenter i `memo`. `?debug=1` gir `window.__gl.info`.
- Appen skal ikke laste sporingspixler. Sporing og samtykke ligger på nettsiden (Consentify).
- 3D-scenen er pynt. Kalkylen og skjemaet må virke uten WebGL.
