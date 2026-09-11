# Funksjonssjekk

Hva ende-til-ende-testene i `tests/e2e/` faktisk dekker, hva som er merget
men udekket, og hva som er ventet men ikke bygget. Anmelderens fil, oppdatert
i takt med det dirigenten merger.

Kjøres med `npx playwright test` fra rota. Testene bygger appen og kjører mot
`vite preview` på port 4173 i mock-modus, headless Chromium, 1440 × 900,
`lang="nb"`. Hver testet tilstand kontrolleres med axe mot `wcag2a` og
`wcag2aa`; et brudd feiler testen.

Sist oppdatert mot `main` `2707109`.

## Dekket nå

| Det brukeren gjør                   | Spec            | Merknad                                                                         |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| Åpner `/` og får ny samtale         | `shell.spec.ts` | h1, tre landemerker, `lang="nb"`, axe grønn                                     |
| Åpner `/threads/:id` og får tråden  | `shell.spec.ts` | samme, med det innsjekkede mock-svaret                                          |
| Tabber til hopp-lenka og hopper     | `shell.spec.ts` | to tester, se «Det som måtte måles»                                             |
| Skjuler og viser navigasjonspanelet | `shell.spec.ts` | `aria-expanded`, `data-collapsed`, og at knappen beholder fokus                 |
| Bytter til mørk modus fra konsollen | `shell.spec.ts` | `window.ka.colorScheme.set('dark')`, uten reload, og valget overlever en reload |
| Tabber gjennom hele skallet         | `shell.spec.ts` | hvert steg har et navn, og alle unntatt hopp-lenka har synlig fokusring         |
| Ser på rutene i lys og mørk         | `shell.spec.ts` | skjermbilder til `design/skjermbilder-frontend/e2e/`                            |

## Merget, men ikke dekket

| Sak                                         | Hvorfor ikke                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kildepanelet (PR #2)                        | Merget, men **ikke montert**. `src/layout/viewComponents.ts` peker på `ViewPlaceholder` for alle fire viewene, så `SourcesView` er ikke på skjermen i appen. Kan ikke testes ende til ende før monterings-PR-en |
| Utdragssøket, snarveislista, `[n]` → utdrag | Samme grunn                                                                                                                                                                                                     |
| Den ekte klienten (PR #8)                   | Testene kjører i mock-modus med vilje. Live krever nøkkel og en kjørende backend, og hver spørring koster en agentkjøring. Proxyen er i stedet målt for hånd, se `main-2026-09-11-pr8.md`                       |

## Ventet, men ikke bygget

Fra rolle-1b-e2e.md, i den rekkefølgen dirigenten merger:

| Sak                                              | Venter på                 |
| ------------------------------------------------ | ------------------------- |
| Filtre kan velges og gir chips                   | PR #3                     |
| Tråder er gruppert, søk i tråder                 | PR #3                     |
| Kickstarter fyller feltet                        | PR #5                     |
| Spørsmål gir strømmet svar med `[n]`-markører    | PR #5                     |
| Klikk på `[n]` ruller og fokuserer riktig utdrag | PR #5 + PR #2 + montering |
| Avbryt stopper genereringen                      | PR #5                     |
| Feil vises som `Alert`                           | PR #5                     |
| Søk i utdrag gir treffteller                     | PR #2 + montering         |

## Det som måtte måles før det kunne påstås

**Hopp-lenka lander to forskjellige steder, og begge er riktige.**
`#main-content` er en `<main>`, som ikke er fokuserbar i seg selv. På
trådruta har hovedkolonnen fokuserbart innhold, og nettleseren setter fokus
på `main` selv; neste Tab lander da inne i hovedinnholdet. På `/` har
hovedkolonnen ingenting fokuserbart, så `document.activeElement` blir stående
på `<body>` og vandringen fortsetter FORBI main — første Tab etterpå treffer
«Vis kilder» i kildepanelet.

Det er nettleseren som gjør det riktige med en tom region, ikke en feil. Men
det betyr at «hopp-lenka flytter fokus inn i hovedinnholdet» bare kan påstås
på en rute som har noe der. Derfor er det to tester: den sterke påstanden på
trådruta, og den svake — «vandringen starter ikke på nytt i sidepanelet» — på
forsida.

Første utgave av testen påsto det sterke på forsida og feilet. Testen var
feil, ikke appen.

## Det som ikke er en test

**Skjermbildene sammenlignes ikke automatisk.** De lagres under faste navn og
ses på av et menneske mot Figma-bildene i
`design/omraader/september-2026/*/skjermbilder/`. En pikselsammenligning ville
feilet på hver forskjell i fontrendering mellom to maskiner, og avvikene som
betyr noe er ikke piksler.

**Bare Chromium.** Suiten tester produktet, ikke nettleserkompatibilitet.
`field-sizing: content` i skrivefeltet er det ene stedet der Firefox oppfører
seg annerledes i dag, og det står dokumentert der det brukes.

## Åpent

- **`npm run test:e2e` finnes ikke.** Skriptet hører i `package.json`, som er
  grunnmurens fil, og denne PR-en rører den ikke. `npx playwright test`
  virker i mellomtiden. Én linje fra #5:
  `"test:e2e": "playwright test"`.
- **`tests/` typesjekkes ikke av `npm run build`.** `tsconfig.node.json`
  inkluderer bare `vite.config.ts`. Playwright typesjekker selv når testene
  kjører, så feil oppdages, men senere enn de kunne. `"include": ["vite.config.ts",
"playwright.config.ts", "tests"]` ville lukket det. Også grunnmurens fil.
