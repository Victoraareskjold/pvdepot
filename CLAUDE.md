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
- Batteriene står foran kontoret, godt synlig.
- (Kalkylen fra denne runden er erstattet 24.11.2026, se under.)
- Forsiden: rolig topp (ingress, én knapp «Få hjelp med Enova-søknaden»), slidere og tre nøkkeltall i et panel ved siden av 3D-scenen, seksjon om hvordan vi hjelper med søknaden, svevende knapp.
- Logoen vises ikke på siden (fjernet 25.11.2026); den står i menyen på pvwebsites. `public/brand/smartelektrolading.png` og `theme.logo` i `lib/sites.ts` ligger igjen.

## Runde 20.11.2026 (Asbjørn: «Endringer til Smart Elektro underside lading»)

- Støttesjekken (`lib/calc/qualify.ts`): seks spørsmål med oppfølginger, grønn/gul/rød, ingen forhåndsvalg, «X av 6 spørsmål besvart». Rødt slår gult. Bytter man hovedsvar, nullstilles oppfølgingen (`setAnswer`). Knappen er «Få hjelp med søknaden» (grønn/gul) eller «Få en vurdering av prosjektet» (rød). Skjemaet kan sendes uansett resultat. Tekstene er ordrett fra Asbjørn, ikke skriv dem om.
- Henvendelsen tar med kundens kalkyleoppsett (`lib/calc/setup.ts`): «Kunden har endret kalkylen: Ja/Nei», endrede felt som standard → kundens valg, hele oppsettet og det kalkylen regnet ut. Sammenligner med `DEFAULT_INPUT` i det skjemaet sendes, så en verdi som er satt tilbake teller ikke som endring. Nye felt i kalkylen må legges til i `SETUP_FIELDS`.
- Ikke skriv «gratis» om samtalen eller vurderingen.

## Runde 24.11.2026 (Asbjørn: «Merknader til Victor, runde 2»)

- Overskrift og ingress sier «elektriske tunge kjøretøy».
- Ny kalkyle (`lib/calc/model.ts`) etter regnearket «Lonnsomhet-bedriftslading-7-batterier.xlsx» og «Victor-ladekalkulator.md». Den sammenligner byggets strømregning før og etter: ladesalg, strøm til laderne, solverdi, batteritap, endring i effektledd og drift. Diesel og CO₂ er ute. Ett resultat forsyner depotet, resultatkortene, «Se hele regnestykket» og skjemaet.
- Standardeksemplet: 6 × 120 kW DC, 189 kWp (162 933 kWh), 7 × 261 kWh/130 kW batteri, 7 495 620 kr, støtte 2 680 000 kr, 240 000 kWh bygg, 380 000 kWh levert til 4,50 kr. Gir 1 238 964 kr netto og 3,89 år. Kontrolltallene fra beskrivelsen ligger som tester i `model.test.ts`. Endrer du modellen, skal de fortsatt stemme.
- (Utstyrspris og støtte er endret 25.11.2026, se under.)
- Søknadsfristene hentes fra Enova på serveren (`lib/deadlines-server.ts`, mellomlagret et døgn). Leseren (`parseEnovaDeadlines`) er testet mot eksempel-HTML, men ikke mot den ekte siden, fordi enova.no var sperret fra utviklingsmiljøet. Sjekk `/api/deadlines` etter utrulling: `status` skal være `ok`. Er den `fallback`, brukes listen fra 24.11.2026. Manuell korrigering med `ENOVA_DEADLINES`, varsling med `DEADLINES_ALERT_WEBHOOK`.
- Ladeplasspanelet i scenen er merket «Illustrasjon».

## Runde 25.11.2026 (Victor)

- Hovedvisningen har bare fire slidere: samlet DC-ladeeffekt (kW, steg på én lader), solceller (kWp), batterikapasitet (kWh, steg på én enhet à 261 kWh) og salgspris for lading (standard 4,50 kr/kWh). Alt annet ligger under «Se hele regnestykket» (`MainSliders` og `VolumeHelper` i `sections.tsx`).
- Resultatkortene: anslått Enova-støtte, tilbakebetaling ved fullt ladesalg og netto over 10 år etter investering (10 × årlig netto − egen investering).
- Støtten er standard det laveste av valgt DC-ladeeffekt × 4 000 kr/kW, 3 mill. kr og 60 % av totalsummen (`supportMode: "score"`). Standard: 720 kW → 2 880 000 kr, 3,73 år, 7 774 019 kr over 10 år. Utregningen vises i «Investering og støtte». Regnearkets kontrolltall (2 680 000 kr, 3,89 år) testes fortsatt med søkebeløp i `model.test.ts`.
- Totalsummen følger utstyret: standardpakken 7 495 620 kr pluss avviket priset med `ASSUMPTIONS.componentPrices` (2 400 kr/kW lader, 6 500 kr/kWp, 2 300 kr/kWh). Satsene er Claudes anslag og må bekreftes av Smart Elektro.
- Nettoppen med styring er 300 kW bare når batteriet har effekt nok: aldri lavere enn ustyrt topp minus batteriets kW. Ustyrt topp (650 kW) skaleres med ladeeffekten. Uten batteri blir toppen 650 kW.
- Frister: leseren normaliserer alle frister til kl. 12.00 og godtar datoverdier med annet klokkeslett når datoen står i teksten. Fristene som ble kontrollert 24.11 (`BASELINE_DEADLINES`) beholdes til de er passert, også om Enova-siden ikke viser dem (`withCheckedDeadlines`). Siden viste 3. juni hos Victor; nå er neste frist 3. februar 2027.
- ScrollWorld: antall steg endres når sol settes til 0, så indeksen holdes innenfor (`at`).
