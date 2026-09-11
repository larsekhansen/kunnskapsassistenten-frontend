# Funksjonssjekk

Hva ende-til-ende-testene i `tests/e2e/` dekker, hva som er merget men
udekket, og hva som er ventet men ikke bygget. Anmelderens fil, oppdatert i
takt med det dirigenten merger.

Kjøres med `npx playwright test` fra rota. Testene bygger appen og kjører mot
`vite preview` på port 4173 i mock-modus, headless Chromium, 1440 × 900,
`lang="nb"`. Hver testet tilstand kontrolleres med axe mot `wcag2a` og
`wcag2aa`; et brudd feiler testen.

**30 tester, alle grønne.** Sist kjørt mot `main` `70020c5` **pluss en lokal
montering** — se «Forutsetningen» rett under.

## Forutsetningen: viewene må være montert

`src/layout/viewComponents.ts` peker på `ViewPlaceholder` for alle fire
viewene på `main`, og hovedplassen bruker ikke `viewComponents` i det hele
tatt: ruta rendrer inn i `<main>` gjennom `Outlet`. Alle fire viewene er
merget, men ingen av dem er på skjermen.

De 22 testene under «navigasjonspanelet», «hovedkolonnen» og «kildepanelet»
er derfor skrevet og kjørt mot en **lokal, ucommittet montering** i
arbeidstreet, som er grunnmurens jobb å gjøre ordentlig. De feiler på `main`
slik den står. Det er meningen: de er klare den dagen monterings-PR-en er
inne, og de sier fra hvis den monterer noe annet enn det som ble anmeldt.

Monteringen krever tre ting, og det tredje er det eneste som må finnes opp:

1. `viewComponents.ts` peker på de fire viewene.
2. `src/routes/Thread.tsx` og `NewConversation.tsx` monterer `ChatView`, og
   `h1` blir «Kunnskapsassistenten» i stedet for trådtittelen.
3. **En kontekst som bærer svarets kilder fra `ChatView` til `SourcesView`.**
   Den finnes ikke. `SlotViewProps` har ikke noe `documents`-felt, og de to
   viewene importerer aldri hverandre — det er hele poenget. Mønsteret er
   allerede i repoet to ganger, `citationContext` og `filterContext`, og en
   tredje av samme form er omtrent tjue linjer.

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

## Merget, men ikke dekket

| Sak                                           | Hvorfor ikke                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feiltilstanden i chatten                      | **Kan ikke nås fra det bygde appen.** `MockChatClient` har ingen måte å feile på, og forhåndsvisningsflata som har en, er dev-only og ligger ikke i `dist`. Trenger en utløser fra #5, for eksempel et spørsmål som alltid feiler i mock-modus |
| Den ekte klienten                             | Testene kjører i mock-modus med vilje. Live krever nøkkel, en kjørende backend, og koster en agentkjøring per spørsmål. Proxyen er målt for hånd i `main-2026-09-11-pr8.md`                                                                    |
| Lastetilstanden i kildepanelet                | Vises bare mens `documents` er `undefined`, og monteringen gir dem med én gang. Trenger enten en treg mock eller en egen rute                                                                                                                  |
| Opplasting, «Vis flere dokumenter», topplinje | Ikke bygget. Se `skal-dette-implementeres.md`                                                                                                                                                                                                  |

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

**Et helt mock-svar tar rundt 7,5 sekunder.** Fire tenkesteg à 500 ms, så
svaret token for token à 18 ms. Ventingene i testene poller, så en test
koster det svaret koster. Hele suiten går på under 20 sekunder fordi testene
kjører i parallell.

## Det som ikke er en test

**Skjermbildene sammenlignes ikke automatisk.** De lagres under faste navn og
ses på av et menneske mot Figma-bildene. En pikselsammenligning ville feilet
på hver forskjell i fontrendering mellom to maskiner, og avvikene som betyr
noe er ikke piksler.

**Bare Chromium.** Suiten tester produktet, ikke nettleserkompatibilitet.

## Åpent

- **`npm run test:e2e` finnes ikke.** Skriptet hører i `package.json`, som er
  grunnmurens fil. `npx playwright test` virker i mellomtiden.
- **`tests/` typesjekkes ikke av `npm run build`.** `tsconfig.node.json`
  inkluderer bare `vite.config.ts`. Playwright typesjekker selv når testene
  kjører, så feil oppdages, men senere enn de kunne.
- **En utløser for feiltilstanden** i mock-modus, se tabellen over.
