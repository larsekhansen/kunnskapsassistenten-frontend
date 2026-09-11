# Kunnskapsassistenten, frontend

Ny frontend for Kunnskapsassistenten (KA) i Digdir. Vite, React, TypeScript,
React Router i klientmodus, og Designsystemet 1.21.0.

Dette er **Trinn 1**: skallet, temaet og rutene. Det er ingen chat, ingen
kilder og ingen filtrering ennå — bare de tre regionene med riktige
landemerker, temaet på plass og to ruter som virker.

## Kom i gang

```sh
npm install
npm run dev            # utviklingsserver på http://localhost:5173
```

Node 24 eller nyere.

| Skript                  | Gjør                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`           | Utviklingsserver                                                                                 |
| `npm run build`         | `tsc -b` og produksjonsbygg til `dist/`                                                          |
| `npm run preview`       | Server produksjonsbygget lokalt                                                                  |
| `npm run lint`          | oxlint, inkludert `jsx-a11y`-reglene                                                             |
| `npm run format`        | Prettier, skriver                                                                                |
| `npm run format:check`  | Prettier, sjekker bare                                                                           |
| `npm run tokens:build`  | Bygger temaet på nytt fra `designsystemet.config.json`                                           |
| `npm run tokens:verify` | Bygger temaet i en midlertidig mappe og feiler hvis resultatet er annerledes enn det innsjekkede |

Kjør `tokens:verify` etter hver oppgradering av Designsystemet. Feiler den, er
det informasjonen du vil ha: les diffen før du sjekker inn.

## Mappestruktur

```
designsystemet.config.json    kilden til temaet: fem farger, radius, font
design-tokens/                Design Tokens som JSON, Tokens Studio-format
design-tokens-build/
  digdir.css                  temaet, ~1155 linjer CSS-variabler
  types.d.ts                  typer for data-color og data-size
src/
  main.tsx                    inngangspunkt, BrowserRouter
  App.tsx                     rutene
  globals.d.ts                window.dsWarnings
  styles/global.css           importrekkefølge og all egen CSS
  layout/
    Skall.tsx                 de tre regionene
    views.ts                  view-begrepet, bare abstraksjonen
  sider/
    NySamtale.tsx             ruten /
    Traad.tsx                 ruten /traader/:traadId
```

Rutene er norske: `/` er ny samtale, `/traader/:traadId` er én samtale.

## De tre regionene, og hvorfor de heter det de gjør

| Region               | Element                               | Innhold                            |
| -------------------- | ------------------------------------- | ---------------------------------- |
| **navigasjonspanel** | `<nav aria-label="Tråder og filter">` | Trådliste og dokumentfilter        |
| **hovedkolonne**     | `<main id="hovedinnhold">`            | Spørsmålet, svaret og skrivefeltet |
| **kildepanel**       | `<aside aria-label="Kilder">`         | Kildelista, senere også verktøy    |

**Navnene er rollenavn, ikke sidenavn.** Det er et bevisst valg med to grunner:

1. **Skjermlesere.** Panelene skal kunne flyttes. En `aria-label` som sier
   «venstre panel» lyver for en skjermleserbruker den dagen panelet står til
   høyre, og en skjermleserbruker har ingen «venstre» å forholde seg til
   uansett.
2. **Flyttbare paneler.** Brukeren skal på sikt kunne velge hva som ligger
   hvor, og bytte mellom ulike _views_. Da må navnet følge rollen, ikke
   posisjonen.

Ingen klasse, variabel, ARIA-etikett eller filnavn i dette repoet bruker
«venstre» eller «høyre». Bruk ikke `left`/`right` i ny kode heller.

`src/layout/views.ts` er abstraksjonen bak punkt 2. Den beskriver hvilke
regioner som finnes, hva de kan vise, og hvilken rekkefølge de har. Det finnes
**ikke** noe grensesnitt for å endre view ennå, og ingen lagring. Grunnen til
at abstraksjonen kommer først står i fila.

### Bredder

Målt i nettleseren, ikke regnet ut:

```
navigasjonspanel   401 px  = 328 innhold + 2 × 36 padding + 1 ramme, fast
gap                 32 px  = var(--ds-size-8)
hovedkolonne       min 640, maks 800 px, fleksibel, egen skrolling
gap                 32 px
kildepanel         234 px  = 198 kollapset + 36 padding
```

**Vinduet må være minst 1339 px bredt** før hovedkolonnen får sine 640 px.
Under det skroller sida vannrett, og hovedkolonnen holder 640 px i stedet for å
krympe. Terskelen er målt: ved 1339 px er det ingen vannrett skrolling, ved
1338 px er det.

Det er ikke ferdig. Brytepunkter for skrivebord og nettbrett er neste
layoutoppgave; mobil kommer senere. Til da er 1339 px den reelle
minstebredden.

## Temaet

Digdir-temaet er ikke publisert på npm, så det genereres her med
Designsystemets kommandolinjeverktøy fra `designsystemet.config.json`. Bygget
(`design-tokens-build/digdir.css` og `types.d.ts`) er **sjekket inn**, slik at
et bygg av frontenden ikke trenger CLI-en i kjeden. `colors.d.ts` er utdatert
og holdes utenfor.

CSS-en importeres i denne rekkefølgen i `src/styles/global.css`, og
rekkefølgen har en grunn:

1. `@digdir/designsystemet-css` — komponent-CSS, og den erklærer
   layer-rekkefølgen `@layer ds.theme, ds.base, ds.components`
2. `design-tokens-build/digdir.css` — temaet, som legger seg i `ds.theme.*`
3. vår egen CSS, **utenfor alle layers**

Punkt 3 er nøkkelen: ulagret CSS slår all lagret CSS, så vi trenger aldri
`!important` for å overstyre Designsystemet.

**Skriv aldri px og aldri heksfarger.** Bruk `var(--ds-size-N)` og
`var(--ds-color-*)`. Faste verdier følger ikke tema, størrelsesmodus eller
mørk modus.

Rot-attributtene står i `index.html`, og **de står på to forskjellige
elementer med vilje**:

| Attributt                   | Element      | Hvorfor                                                                                                                                                                       |
| --------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lang="nb"`                 | `<html>`     | Flere Designsystemet-komponenter har norske standardtekster som bare slår inn når nærmeste `lang` starter på `nb`, `nn` eller `no`. `Suggestion` er det tydeligste eksempelet |
| `data-color-scheme="light"` | `<html>`     | Samme sted som Designsystemets egen nettside setter den                                                                                                                       |
| `data-size="md"`            | **`<body>`** | Se under                                                                                                                                                                      |
| `data-color="accent"`       | `<body>`     | Følger `data-size`                                                                                                                                                            |

**`data-size` må ikke stå på `<html>`.** Designsystemets `[data-size]`-regel
setter `font-size` på elementet den treffer. Står den på `<html>`, blir `1rem`
18 px i stedet for 16 px, og da skalerer **alle** `--ds-size-*`-tokens 12,5 %
opp, siden de er regnet ut av `calc(1rem * 4 / 18 * 1.125)`. Målt: 36 px blir
40 px. Designsystemet sier det selv i `base.css`: «Setting default font on
`<body>` not `:root`/`<html>` to ensure 1rem is still 16px».

## Tilgjengelighet

**WCAG 2.x AA er et krav, ikke et mål.** Offentlig sektor og
uu-kravene. Enhver snarvei som gir utseende uten tilgjengelighet er
utelukket.

Praktisk betyr det:

- `npm run lint` kjører `jsx-a11y`-reglene som feil, ikke advarsler.
- Bruk Designsystemets komponenter for det Designsystemet dekker. De har
  fokusring, tastaturstøtte og ARIA ferdig. Hover og fokus **arves** og
  tegnes ikke selv.
- Alt er norsk, også tilgjengelige navn.
- Ikonknapper må ha `aria-label`.
- Hopp-lenka til `#hovedinnhold` skal alltid være første fokuserbare element.

## Åpne punkter i Trinn 1

- **Mørk modus er ikke avgjort.** `data-color-scheme="light"` er satt fordi
  temaet har mørke verdier, men ingen Figma-skjerm er tegnet i mørk modus og
  fargene er ikke verifisert der. Skal mørk modus støttes, er verdien `auto`,
  og da må kontrasten sjekkes.
- **Brytepunkter** finnes ikke. Se «Bredder».
- **Bredden på åpent kildepanel** er ikke bestemt. Panelet er kollapset på
  198 px nå.
- **Topplinje** er ikke bestemt, så det finnes ingen.
- ~~React Router-versjonen.~~ **Avgjort 2026-09-11:** 8.3.1, pinnet uten
  caret, samme versjon som ki.norge.no og Designsystemets egen nettside. Se
  «React Router» under.

## React Router

**8.3.1, pinnet uten caret** (avgjort 2026-09-11). Samme versjon som
ki.norge.no og Designsystemets egen nettside kjører, så de to
referanseoppsettene og dette repoet er på samme major.

Klientmodus: `BrowserRouter` i `src/main.tsx`, og rutene som `Routes`/`Route`
i `src/App.tsx`. Ingen framework-modus, ingen loaders, ingen
`createBrowserRouter` ennå.

Oppgraderingen fra 7 til 8 krevde **ingen** endringer i koden vår:
`BrowserRouter`, `Routes`, `Route`, `Outlet` og `useParams` eksporteres
uendret fra `react-router` i 8.3.1. Verifisert både med typesjekk og ved å
laste begge rutene i nettleseren.

Versjonen er pinnet fordi en major i ruteren flytter API. Oppgrader bevisst.

## Designgrunnlaget

Spesifikasjonene ligger **ikke** i dette repoet. De ligger i Lars sin lokale
`design/`-mappe i paraplymappa `kunnskapsassistenten/`, som ikke er et
git-repo:

| Fil                                  | Innhold                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `design/visjon-og-beslutninger.md`   | Det Lars har bestemt, med dato                                                          |
| `design/skal-dette-implementeres.md` | Spørsmålsliste med fasit, og bygg-rekkefølgen for første versjon                        |
| `design/designsystemet/`             | Designsystemet kartlagt fra kildekoden: alle 42 komponenter, oppsett, behov → komponent |
| `design/omraader/`                   | Figma-spesifikasjoner per område                                                        |
| `design/tema/`                       | Temaoppsettet dette repoet er kopiert fra                                               |

Start i `design/INDEX.md`.
