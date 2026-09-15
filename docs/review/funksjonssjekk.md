# Funksjonssjekk

Hva ende-til-ende-testene i `tests/e2e/` dekker, hva som er merget men
udekket, og hva som er ventet men ikke bygget. Anmelderens fil, oppdatert i
takt med det dirigenten merger.

Kjøres med `npx playwright test` fra rota. Testene bygger appen og kjører mot
`vite preview` på port 4173 i mock-modus, headless Chromium, 1440 × 900,
`lang="nb"`. Hver testet tilstand kontrolleres med axe mot `wcag2a` og
`wcag2aa`; et brudd feiler testen.

**58 tester, alle grønne** mot `main` `b7981f3`. To av dem er nye
(N6, under), og suiten er samtidig gjort stabil — se «Suiten løy» nedenfor.

**Én kjøring per port om gangen.** `KA_E2E_PORT=4174` flytter den, og det
trengs når suiten kjøres fra to arbeidstrær på denne maskinen samtidig.
Portfordelingen i natt: KA CC 4173, #2 4174, #3 4175, #4 4176, #5 4177.

Suiten **gjenbruker aldri** en preview-server som alt står på porten. En
server der tilhører noen andre, og å henge seg på den er hvordan en kjøring
ender med å teste et `dist` den ikke bygde selv. Kollisjon feiler nå med
portnummeret i meldinga, før første test, i stedet for å bli en spredning av
røde tester lenger inne.

De 22 testene for de tre viewene ble skrevet mot en lokal montering i
arbeidstreet mens monterings-PR-en ble laget, og **de passerte uendret mot den
ekte monteringen**. Det er i seg selv et resultat: skallet monterer viewene
slik de ble anmeldt.

## Dekket nå

| Det brukeren gjør                                         | Spec                       |
| --------------------------------------------------------- | -------------------------- |
| Åpner `/` og `/threads/:id` med landemerker og én `h1`    | `shell.spec.ts`            |
| Tabber til hopp-lenka og hopper                           | `shell.spec.ts`, to tester |
| Skjuler og viser navigasjonspanelet                       | `shell.spec.ts`            |
| Bytter fargemodus fra konsollen, uten reload              | `shell.spec.ts`            |
| Møter filtreringen som førstegangsbruker                  | `primary-sidebar.spec.ts`  |
| Velger en verdi og får en chip pluss «1 av 6 valgt»       | `primary-sidebar.spec.ts`  |
| «Velg alle» og «Tøm» uten å miste tastaturet              | `primary-sidebar.spec.ts`  |
| Veksler mellom filter og tråder                           | `primary-sidebar.spec.ts`  |
| Ser trådene gruppert på tidsrom                           | `primary-sidebar.spec.ts`  |
| Søker i tråder og får en treffteller                      | `primary-sidebar.spec.ts`  |
| Åpner en tråd og ser den merket med `aria-current`        | `primary-sidebar.spec.ts`  |
| Møter hilsenen og de tre kickstarterne                    | `chat.spec.ts`             |
| Fyller feltet fra en kickstarter uten å sende             | `chat.spec.ts`             |
| Stiller et spørsmål og får et strømmet svar med `[n]`     | `chat.spec.ts`             |
| Avbryter, og beholder teksten som kom                     | `chat.spec.ts`             |
| Kopierer svaret og får kvittering                         | `chat.spec.ts`             |
| Trykker en oppfølgingschip                                | `chat.spec.ts`             |
| Åpner kildepanelet med en markør                          | `sources.spec.ts`          |
| Klikker `[n]` og havner i riktig utdrag, to ganger på rad | `sources.spec.ts`          |
| Ser utdragene gruppert per dokument                       | `sources.spec.ts`          |
| Hopper til et dokument fra snarveislista                  | `sources.spec.ts`          |
| Søker i utdragene og stepper mellom treff                 | `sources.spec.ts`          |
| Tabber gjennom hvert view i lys og mørk                   | alle fire spec-ene         |
| Beholder filtervalget gjennom veksling filter ↔ tråder    | `primary-sidebar.spec.ts`  |
| Beholder filtervalget gjennom et ruteskifte til en tråd   | `primary-sidebar.spec.ts`  |
| Måler layouten på 1280, 1440 og 1536 i lys og mørk        | `layout.spec.ts`           |
| Åpner og kollapser sidekolonnene i hver kombinasjon       | `layout.spec.ts`           |

## Merget, men ikke dekket

| Sak                                           | Hvorfor ikke                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feiltilstanden i chatten                      | **Kan ikke nås fra det bygde appen.** `MockChatClient` har ingen måte å feile på, og forhåndsvisningsflata som har en, er dev-only og ligger ikke i `dist`. Trenger en utløser fra #5, for eksempel et spørsmål som alltid feiler i mock-modus |
| Den ekte klienten                             | Testene kjører i mock-modus med vilje. Live krever nøkkel, en kjørende backend, og koster en agentkjøring per spørsmål. Proxyen er målt for hånd i `main-2026-09-11-pr8.md`                                                                    |
| Lastetilstanden i kildepanelet                | Vises bare mens `documents` er `undefined`, og monteringen gir dem med én gang. Trenger enten en treg mock eller en egen rute                                                                                                                  |
| Opplasting, «Vis flere dokumenter», topplinje | Ikke bygget. Se `skal-dette-implementeres.md`                                                                                                                                                                                                  |

## Skjermbilder

`screenshots.spec.ts` lagrer hvert view i lys og mørk under faste navn i
`design/skjermbilder-frontend/e2e/`. Ingen av dem er en assert. Gjennomgangen
mot Figma står i [`visuell-2026-09-11.md`](visuell-2026-09-11.md).

## Det som måtte måles før det kunne påstås

**Hopp-lenka lander to forskjellige steder, og begge er riktige.**
`#main-content` er en `<main>`, som ikke er fokuserbar i seg selv. På
trådruta har hovedkolonnen fokuserbart innhold, og nettleseren setter fokus
på `main`; neste Tab lander inne i hovedinnholdet. På `/` har hovedkolonnen
ingenting fokuserbart, så vandringen fortsetter forbi main. Derfor er det to
tester: den sterke påstanden på trådruta, den svake på forsida.

**Filterfeltet er ikke en combobox før noen har rørt det.** Målt på det bygde
appen, 2,5 sekunder etter last, med alle tilpassede elementer oppgradert:
`u-datalist` er en `listbox` med sju valg, veksleknappen har
`aria-expanded="false"` — og selve inputen har verken `role`, `aria-controls`
eller `aria-expanded`. De kommer først ved første klikk. En rollebasert
låsning finner derfor ingenting på en side ingen har tatt på, og testene
låser på `<label for>` i stedet. Det er en feil i Designsystemet 1.21.0, ikke
i filterpanelet, og den står i `funn-tverrgaaende.md`.

**Et bygg som ikke er ferdig, lyver.** Første måling av lastetilstanden viste
at kildepanelet sto og hentet i det uendelige på en tom forside. Det var en
gammel `dist` som ble servert av en preview-server jeg hadde startet for hånd,
og som Playwright gjenbrukte. Mot et ferskt bygg er tilstanden riktig: tom
forside gir «Ingen kilder ennå», og «Henter kilder …» kommer først når et svar
faktisk er underveis. Verdt å vite for neste måling: drep preview-serveren før
du konkluderer.

**Mål aldri tekstoppsett før fonten er lastet.** Inter hentes fra en CDN, og
fallback-fonten har andre metrikker. Testen for kollapsknappens etikett
passerte først, fordi «Vis kilder» får plass på én linje i fallbacken og
brytes i Inter. `await page.evaluate(() => document.fonts.ready)` er hekta, og
den står nå både i den testen og i `saveScreenshot`. Referansebildene var
utilsiktet trygge fordi de tas etter mye annet arbeid, men det var flaks.

**Et helt mock-svar tar rundt 7,5 sekunder.** Fire tenkesteg à 500 ms, så
svaret token for token à 18 ms. Ventingene i testene poller, så en test
koster det svaret koster. Hele suiten går på under 20 sekunder fordi testene
kjører i parallell.

## Suiten løy, og det var min feil

**Fra 13 til 49 av 58 «feil» hadde ingenting med produktet å gjøre.** Målt
2026-09-15 da N6-testene ble skrevet: kjøringer ga mellom 42 og 56 grønne, med
et nytt utvalg røde hver gang. Ingen av dem var en påstand som slo feil. To
delte ressurser, begge mine:

1. **Én fast `outputDir`.** Playwright tømmer den når en kjøring starter, og
   skriver en trace for hver test mens den går. To kjøringer i samme mappe
   betyr at den andre sletter filer den første fortsatt skriver, og den første
   faller i `browserContext.close` med `ENOENT` på en `.trace`-fil. Testen har
   da allerede passert; det er oppryddingen som kaster. Rettet:
   `RUN_ARTIFACTS` gir hver kjøring sin egen mappe, og mapper eldre enn et
   døgn ryddes bort.
2. **Én fast port.** `reuseExistingServer` lar kjøring to henge seg på
   preview-serveren til kjøring én, og når kjøring én er ferdig tar den
   serveren ned under kjøring to, som melder `ERR_CONNECTION_REFUSED` på alt
   som gjenstår. 49 av 58 i den kjøringen som startet sist. Rettet med
   `KA_E2E_PORT`, og regelen skrevet ned: én kjøring per port.

Verifisert etterpå med to samtidige kjøringer på 4173 og 4174: **58 grønne i
begge**.

Verdt å si høyt: en suite som melder rødt av grunner i sitt eget stell er
verre enn ingen suite, fordi det første den koster er tilliten til den. Alle
funnene i reviewene 14.09 ble tatt før dette, med sekvensielle kjøringer, og
er ikke berørt.

**Fonten er en egen risiko, ikke denne.** #5 påpekte at to tester måler
tekstbredde etter `document.fonts.ready`, og at Inter hentes fra
`altinncdn.no` ved hver kjøring. Målt her: 200 OK på tre forespørsler,
`fonts.ready` etter 166–187 ms, likt over kjøringer. Den er altså ikke årsaken
til det over, men står igjen som den mest sannsynlige årsaken til flakiness i
CI, der cachen er kald og nettet er noen andres.

## Det som ikke er en test

**Skjermbildene sammenlignes ikke automatisk.** De lagres under faste navn og
ses på av et menneske mot Figma-bildene. En pikselsammenligning ville feilet
på hver forskjell i fontrendering mellom to maskiner, og avvikene som betyr
noe er ikke piksler.

**Bare Chromium.** Suiten tester produktet, ikke nettleserkompatibilitet.

## Åpent

- **`tests/` typesjekkes ikke av `npm run build`.** `tsconfig.node.json`
  inkluderer bare `vite.config.ts`. Playwright typesjekker selv når testene
  kjører, så feil oppdages, men senere enn de kunne.
- **Første overskrift i DOM er fortsatt en `h2`**, fordi skallet tegner
  panelene før `<main>`. Ingen axe-regel fanger det, og ingen test heller:
  det er en avgjørelse om rekkefølge, ikke en feil i et view.
