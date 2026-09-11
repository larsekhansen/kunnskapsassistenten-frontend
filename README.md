# Kunnskapsassistenten, frontend

Ny frontend for Kunnskapsassistenten (KA) i Digdir. Vite, React, TypeScript,
React Router i klientmodus, og Designsystemet 1.21.0.

Dette er **Trinn 1**: skallet, temaet og rutene. Det er ingen chat, ingen
kilder og ingen filtrering ennå — bare de tre plassene med riktige landemerker,
temaet på plass og to ruter som virker.

Navnereglene står under [Naming](#naming), og kortversjonen av arbeidsreglene i
[CONTRIBUTING.md](CONTRIBUTING.md).

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
    Shell.tsx                 de tre plassene
    viewModel.ts              Slot, ViewId, View, Layout. Bare abstraksjonen
  routes/
    NewConversation.tsx       ruten /
    Thread.tsx                ruten /threads/:threadId
```

Rutene er `/` for ny samtale og `/threads/:threadId` for én samtale.

Mappene `src/api/`, `src/model/` og `src/components/` kommer med grunnmuren.
`src/routes/` er rutesider som monterer views i plassene; `src/views/`
(`threads/`, `filters/`, `chat/`, `sources/`) er selve viewene, og hver
undermappe eies av én arbeider, se `CONTRIBUTING.md`.

## Naming

Regelen er Lars sin, satt 2026-09-11:

- **Kode, filnavn, mapper, CSS-klasser, CSS-variabler, typer og ruter:
  engelsk.**
- **Alt brukeren ser eller hører: norsk bokmål med ekte æøå.** UI-tekst,
  `aria-label`, `title`, feilmeldinger, `lang="nb"`.
- **Plasser heter etter posisjon, innhold heter etter innhold**, som i VS Code.

Denne fila og `CONTRIBUTING.md` er på norsk. Kommentarer i koden er på engelsk,
siden de er kode.

### Plasser og views

En **plass** (slot) er et sted i layouten. Det er tre av dem, og de har faste
navn etter posisjon:

| Plass               | Element                    | CSS-klasse           |
| ------------------- | -------------------------- | -------------------- |
| `primary-sidebar`   | `<nav>`                    | `.primary-sidebar`   |
| `main`              | `<main id="main-content">` | `.main`              |
| `secondary-sidebar` | `<aside>`                  | `.secondary-sidebar` |

Et **view** er innhold som kan flyttes mellom plasser, og heter etter
innholdet: `threads`, `filters`, `chat`, `sources`. Standardoppsettet har
threads og filters i `primary-sidebar`, chat i `main` og sources i
`secondary-sidebar`.

**En plass har aldri en fast `aria-label`.** Navnet kommer fra viewet som står
der, via `slotLabel()` i `src/layout/viewModel.ts`: «Tråder og filter» for
primary, «Kilder» for secondary. `<main>` får ingen etikett, siden det er unikt
på sida.

To grunner til at plassene ikke er navngitt etter hvilken side de står på:

1. **Skjermlesere.** Flytter man et view, skal navnet følge med. En fast
   etikett som nevner en side lyver den dagen panelet flyttes, og en
   skjermleserbruker har ingen sider å navigere etter uansett.
2. **Flyttbare paneler.** Brukeren skal på sikt kunne velge hva som ligger
   hvor. Et navn bundet til posisjon overlever ikke det.

Derfor finnes ikke ordene «venstre», «høyre», `left` eller `right` noe sted i
dette repoet, heller ikke i kommentarer. Det er grep-bart, og det skal
fortsette å være det.

### Layout-abstraksjonen

`src/layout/viewModel.ts` har typene `Slot`, `ViewId`, `View`, `SlotState` og
`Layout`, pluss `defaultLayout` som skallet leser fra. Det finnes **ikke** noe
grensesnitt for å bytte layout ennå, ingen dra-håndtak og ingen lagring.
Grunnen til at abstraksjonen kommer først står i fila: plassinnhold,
plassbredde og modusvekslingen i begge sidepaneler er samme problem.

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
- Hopp-lenka til `#main-content` skal alltid være første fokuserbare element.

## Åpne punkter i Trinn 1

- **Mørk modus er ikke avgjort.** `data-color-scheme="light"` er satt fordi
  temaet har mørke verdier, men ingen Figma-skjerm er tegnet i mørk modus og
  fargene er ikke verifisert der. Skal mørk modus støttes, er verdien `auto`,
  og da må kontrasten sjekkes.
- **Brytepunkter** finnes ikke. Se «Bredder».
- **Bredden på åpen `secondary-sidebar`** er ikke bestemt. Plassen er kollapset på
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
