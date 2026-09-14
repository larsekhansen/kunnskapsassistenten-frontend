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
| `npm run test`          | vitest én gang. `npm run test:watch` for løpende kjøring                                         |
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
  env.d.ts                    VITE_API_MODE
  styles/global.css           importrekkefølge og all egen CSS
  model/                      delte domenetyper: Thread, Message, Citation,
                              SourceDocument, FilterFacet, StreamEvent …
  api/
    chatClient.ts             grensesnittet mock og ekte klient deler
    index.ts                  createChatClient(), leser VITE_API_MODE
    mock/                     fixtures og MockChatClient
    live/                     LiveChatClient, MCP-oversettelse, SSE-leser
  layout/
    Shell.tsx                 de tre plassene
    viewModel.ts              Slot, ViewId, View, Layout, bredder, brytepunkt
    layoutContext.ts          React-konteksten
    LayoutProvider.tsx        tilstanden: aktivt view, kollapset, bredder
    useLayout.ts              useLayout() og useSlot()
    viewComponents.ts         hvilken komponent som tegner hvilket view
    ViewPlaceholder.tsx       står i til viewene er bygget
    useNarrowViewport.ts      om begge sidekolonner får plass samtidig
    colorScheme.ts            mørk modus, window.ka.colorScheme
    citationContext.ts        hvilken [n] brukeren vil se
    useCitation.ts            useCitation()
  components/                 PanelHeader, Markdown, EmptyState, ErrorState
    icons.ts                  aksel-ikoner under KA-navn
  routes/
    NewConversation.tsx       ruten /
    Thread.tsx                ruten /threads/:threadId
  test/
    setup.ts                  jsdom-oppsett for vitest
    matchMedia.ts             matchMedia for jsdom, med bredde testen kan sette
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

## Sideflaten

Sida er lys grå, ikke hvit: `--ds-color-neutral-background-tinted` på
`.shell`. Designet setter hvite kort på grå flate, og på hvit flate forsvinner
kortene. Navigasjonspanelet har sin egen hvite flate over den grå.

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

| Attributt                  | Element      | Hvorfor                                                                                                                                                                       |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lang="nb"`                | `<html>`     | Flere Designsystemet-komponenter har norske standardtekster som bare slår inn når nærmeste `lang` starter på `nb`, `nn` eller `no`. `Suggestion` er det tydeligste eksempelet |
| `data-color-scheme="auto"` | `<html>`     | Følger operativsystemet. Overstyres av `window.ka.colorScheme`, se «Mørk modus»                                                                                               |
| `data-size="md"`           | **`<body>`** | Se under                                                                                                                                                                      |
| `data-color="accent"`      | `<body>`     | Følger `data-size`                                                                                                                                                            |

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
- Hopp-lenka er Designsystemets `SkipLink` og er alltid første fokuserbare
  element.

## Layout og brytepunkter

Avgjort 2026-09-14, se `design/visjon-og-beslutninger.md`. Appen har **ett**
brytepunkt, og det er regnet ut, ikke valgt.

### Bredder

| Plass               | Åpen           | Kollapset | Gir etter?                |
| ------------------- | -------------- | --------- | ------------------------- |
| `primary-sidebar`   | 400            | 236       | nei                       |
| `main`              | 640–800        | —         | ja, først, ned til gulvet |
| `secondary-sidebar` | 432, minst 336 | 198       | ja, deretter, ned til 336 |

Hovedkolonnen har **to gulv**, avgjort 2026-09-14: **640** når kildepanelet er
åpent, **618** når det er kollapset. Grunnen til 640 (svar 46, 49 og 59) er at
kildene skal kunne leses _ved siden av_ svaret; er panelet kollapset, står det
ingenting ved siden av. 618 er utledet, ikke valgt:
1280 − 400 − 32 − 32 − 198, altså det som er igjen til svaret på 1280 med
navigasjonspanelet åpent og kildepanelet kollapset. `layoutStyle()` vet om
kildepanelet er kollapset og skriver `--ka-main-min-width` deretter.

Mellom plassene er det 32 px (`--ds-size-8`). Tallene er **yttermål**, padding
medregnet, fordi sidepanelene er `border-box`. Det var de ikke før: med
`content-box` ble de 36 px paddingen på hver side lagt utenpå, og hvert tall i
modellen var 72 px kortere enn det tegnet. Et kildepanel oppgitt til 198 px
kollapset målte 270. Målt, ikke resonnert fram.

Navigasjonspanelets 400 er de 328 Lars satte (svar 59b) pluss paddingen, og
400 er også det malen tegner panelet som. De 236 kollapset er knappen «Vis
tråder og filter» på 195,78 px, pluss 36 px padding mot vinduskanten og 1 px
for panelets egen kant. Utledningen står i `src/layout/viewModel.ts`.

### Rekkefølgen når plassen blir knapp

1. **Hovedkolonnen** krymper først, ned til gulvet sitt på 640.
2. **Kildepanelet** deretter, fra 432 ned til 336.
3. **Navigasjonspanelet** gir aldri.

Ingen mediespørring bestemmer noe av det. Det faller ut av tre `flex`-linjer i
`src/styles/global.css`: hovedkolonnen vokser fra null og nekter å krympe,
kildepanelet er det eneste elementet på rada med `flex-shrink: 1`.

### Brytepunktet: 1440

Under 1440 kan ikke begge sidekolonnene være åpne samtidig. Åpner du den ene,
kollapses den andre; krymper vinduet forbi 1440 mens begge er åpne, kollapses
**kildepanelet**, som er det som gir etter. En kildehenvisning i svaret følger
samme regel, siden den også er en forespørsel om å åpne kildepanelet.

1440 er ikke et magisk tall og ikke en skjermstørrelse. Det er summen av det
de tre plassene trenger når ingen har noe å gi:

```
400 + 32 + 640 + 32 + 336 = 1440
```

640 og ikke de 618 hovedkolonnen kan falle til: dette er bredden der begge
sidekolonnene er åpne, og det lavere gulvet gjelder bare med kildepanelet
kollapset.

Konstanten heter `bothSidebarsMinViewport` i `src/layout/viewModel.ts` og er
**regnet ut** av breddene, ikke skrevet ned, så den flytter seg om en bredde
endres. At den lander på 1440, bredden alle Figma-framene er tegnet i, er en
sammentreff verdt å merke seg og ikke grunnen til tallet.

Regelen ligger i `LayoutProvider`, ikke i CSS, og `useNarrowViewport.ts`
forklarer hvorfor: det brytepunktet endrer er **kollapset tilstand**, som
knappene melder med `aria-expanded`. En CSS-regel som skjulte et panel ville
latt knappen påstå at panelet er åpent.

Regelen tar et panel bort når det ikke er plass. Den gir ikke noe tilbake når
vinduet vokser igjen: et panel som åpnet seg selv ville overstyrt et valg
brukeren har tatt.

### Garantien

**Ingen vannrett rulling ved 1280 eller bredere, i alle tilstander.** Målt i
bygget app, headless, lys og mørk modus:

| Bredde | Tilstand                          | Nav | Hoved | Kilder | Sum  |
| ------ | --------------------------------- | --- | ----- | ------ | ---- |
| 1536   | alt åpent                         | 400 | 640   | 432    | 1536 |
| 1440   | begge sidekolonner åpne           | 400 | 640   | 336    | 1440 |
| 1440   | nav åpent, kildepanelet kollapset | 400 | 778   | 198    | 1440 |
| 1280   | nav åpent, kildepanelet kollapset | 400 | 618   | 198    | 1280 |
| 1280   | kildepanelet åpent, nav kollapset | 236 | 640   | 340    | 1280 |
| 1280   | begge kollapset                   | 236 | 782   | 198    | 1280 |

Den fjerde rada er **tilstanden appen åpner i**, og den er grunnen til at
hovedkolonnen har to gulv: med ett gulv på 640 trengte den 1302 og rullet
22 px vannrett ved 1280.

## Åpne punkter

- **Under 1280 er et kjent avvik fra WCAG 1.4.10 Reflow (AA).** Kravet er at
  innhold skal kunne vises i 320 px bredde uten vannrett rulling; appen
  garanterer 1280. Det er en bevisst begrensning i v1 (spørsmål 45: desktop og
  stor tablet først), men det er et avvik og skal telles som det. **Planlagt
  fiks:** kildepanelet som **skuff** over hovedkolonnen, Designsystemets
  `Dialog` fra kanten, og tilsvarende for navigasjonspanelet. Ikke bygget.
- **Topplinje** er ikke bestemt, så det finnes ingen.
- ~~React Router-versjonen.~~ **Avgjort 2026-09-11:** 8.3.1, pinnet uten
  caret, samme versjon som ki.norge.no og Designsystemets egen nettside. Se
  «React Router» under.

## Ekte backend

`VITE_API_MODE=live` bytter `createChatClient()` fra mock til `LiveChatClient`.
Kopier `.env.example` til `.env.local` og fyll inn nøkkelen:

```sh
KA_API_URL=http://localhost:8080
KA_API_KEY=rag_…
```

**`VITE_API_MODE` skal ikke stå i `.env.local`.** Alle Vite-servere fra samme
sjekkout leser den samme fila, så en live-modus lagt inn der slår inn for alle
som kjører i treet. Sett den på kommandolinja for den ene kjøringen som skal
bruke ekte backend:

```sh
VITE_API_MODE=live npm run dev
```

`KA_API_URL` og `KA_API_KEY` har **ikke** `VITE_`-prefiks, og det er poenget:
Vite eksponerer bare `VITE_`-variabler for klientkoden, så nøkkelen kan ikke
havne i bundlen ved et uhell. Dev-serveren er proxyen som setter
`X-API-Key`, og klienten snakker bare med `/api` på samme opphav.

**Det er ikke en preferanse.** Backenden svarer `401` på en CORS-preflight og
sender ingen `Access-Control-*`-headere i det hele tatt, så en nettleser ville
nektet å gi koden svaret uansett. I produksjon må en ekte tjener gjøre den
samme jobben, med logging, rate limiting og verktøynavnet låst der.

### Målt mot kjørende stack 2026-09-11

Tre ekte spørringer mot `localhost:8080`, agenten
`builtin.agent-rag-agent__agent-rag-graph-bundled`:

- **Svaret strømmer ikke.** Alle `response/chunk`-deltaene denne agenten
  sender er dens egen plan i jeg-form, og hver serie følges av en
  `agent/thinking` med de samme ordene. Selve svaret kommer helt i
  sluttrammen. Derfor holdes deltaene tilbake til noe sier hva de var: en
  `agent/thinking` etterpå beviser at de var planen, og de forkastes; ellers
  slippes de ut som svartekst. Klienten er dermed riktig i dag og riktig igjen
  den dagen en agent faktisk strømmer svaret, uten at viewene endres.
- **`[n]` treffer utdrag `n-1`.** Verifisert: svaret bar `[1][4][2][1][3]` mot
  seks utdrag i to dokumenter.
- **Utdragsteksten er tom.** `structuredContent.chunks` bærer id, tittel og
  lengde, aldri passasjen. Feltet er merket i `Excerpt`.
  API-bestilling A1.
- **Relevans er utledet av rekkefølgen**, ikke målt. Serveren sender ingen
  poengsum, men rangerer utdragene, så posisjonen er det eneste signalet.
- **Overskriftsstien parses ut av en Clojure-streng**, ikke et objekt, selv om
  skjemaet sier `object`. «Birkebeinerne › Kong Sverre».
- **Trådhistorikk og fasetter finnes ikke** i live-modus. `listThreads()` og
  `listFacets()` svarer tomt med vilje: en samtale fra `tools/call` er ikke
  synlig i samtale-API-et, og backenden filtrerer på hele datasett.

## Views og plasser i kode

Et **view** er en komponent som tar `SlotViewProps` (`src/layout/viewModel.ts`)
og ikke noe annet. Alle fire tar de samme propene, så et view kan monteres i
hvilken som helst plass uten at skallet vet hva det er:

| Prop                   | Hva                                                           |
| ---------------------- | ------------------------------------------------------------- |
| `view`                 | hvilket view skallet tegner. Kan ignoreres                    |
| `collapsed`            | om plassen viewet står i er kollapset                         |
| `onCollapsedChange`    | be plassen kollapse eller åpne                                |
| `activeCitationNumber` | hvilken `[n]` brukeren sist ba om å få se                     |
| `activeCitationNonce`  | teller opp ved hver forespørsel, også når tallet er det samme |
| `siblingViews`         | de andre viewene i samme plass, å veksle til                  |
| `onShowView`           | be plassen vise et annet view den holder                      |
| `switchedByUser`       | om brukeren vekslet hit, eller om sida bare åpnet her         |

**Plassen eier kollapset/åpen, ikke viewet.** Et view som skjulte seg selv
ville etterlate knappen som lyver om sin egen tilstand.

Nonce-en finnes fordi to klikk på samme `[n]` ikke endrer tallet. Uten den
kunne kildepanelet ikke se at det ble spurt en gang til.

**`switchedByUser` finnes fordi et view ikke kan se forskjell på «brukeren
vekslet hit» og «sida ble lastet».** Begge er en første montering, og
standardlayouten åpner på filter (spørsmål 1). To view i samme plass er
moduser av ett panel: veksler du, avmonteres knappen du trykte på, og fokus
faller til `document.body`. Viewet som kommer opp må ta det tilbake, men bare
når noen faktisk ba om det. Å ta fokus ved sidelasting ville hoppet forbi
hopp-lenka.

Bare layouten vet forskjellen, for det er bare layouten som blir bedt om å
veksle. `LayoutProvider` husker hvilket view brukeren sist vekslet hver plass
til, og `isSwitchedByUser()` sammenligner det med viewet som faktisk står der,
så en forespørsel som ikke endret noe heller ikke gir fokus. Det ligger
bevisst **utenfor** `Layout`: det sier hvordan layouten kom hit, ikke hva den
er, og skal ikke lagres den dagen en layout blir husket.

Koblingen mellom svaret og kildene går gjennom `useCitation()`: chat-viewet
kaller `showCitation(n)`, kildepanelet leser `activeCitation`. De to viewene
importerer aldri hverandre, og det er nettopp det som gjør at hvert av dem kan
flyttes til en annen plass.

`src/layout/viewComponents.ts` sier hvilken komponent som tegner hvilket view.
Når et view er bygget, er det den ene linja som endres.

### Scroll

**Hovedkolonnen eier scrollen**, ikke viewet som står i den. Et view som skal
følge et svar som vokser, eller tilby «bla til nederst», bruker
`useMainScroll()` og får `ref` til elementet pluss `scrollToBottom()`. Ikke gå
opp i DOM-treet etter `.main`: det virker helt til viewet monteres et annet
sted, og da finner det feil element eller ingenting.

`ref.current` leses i en effekt eller en hendelseshåndterer, aldri under
render.

### Overskriftsnivåer

`Markdown` starter på nivå 2, så `#` blir nivå 2, `##` nivå 3 og `###` nivå 4
under sidetittelen. Starter et svar på `##`, hopper dokumentet fra nivå 1 til
3 med mindre noe annet tegner en nivå 2 imellom. Hev `startLevel` bare når
svaret ligger under en egen overskrift.

## Kildehenvisninger

Avgjort 2026-09-11. **Et `[n]` i svaret peker på et UTDRAG, ikke på et
dokument.** Det stemmer med backenden, der `[n]` er 1-indeksert inn i
`structuredContent.chunks`.

- Markøren tegnes som hevet skrift og er en lenke til `#excerpt-n`.
- Id-en bygges av `excerptDomId(n)` i `src/model/source.ts`, av begge sider.
  Ingen bygger strengen selv.
- Markørens tilgjengelige navn er `Kilde 3: Årsrapport Nkom 2022, side 41`,
  fra `citationAccessibleName()`. «[3]» alene sier en skjermleserbruker
  ingenting om hvor lenken går.
- `citationTargets(documents)` gir hele lista ferdig til `<Markdown citations=…>`.
- En markør uten utdrag blir stående som ren tekst. Det er riktig oppførsel
  når modellen siterer noe som ikke finnes.

Merk at et utdrag kan mangle `citationNumber`: søket finner mer enn svaret
bruker, og «10 treff» ved siden av fem kilder er derfor riktig, ikke en feil.

## Ikoner

`@navikt/aksel-icons` følger med Designsystemet, men er pinnet eksplisitt her
så en import ikke er avhengig av hvordan npm hoister. Pakken er ES-moduler med
`sideEffects: false`, så bare ikonene som brukes havner i bundlen: **målt
+1,99 kB for to ikoner**, mot flere megabyte om pakken ikke var ristet.

Importer alltid fra `src/components/icons.ts`, aldri fra pakken direkte. Den
fila er det ene stedet leverandørens posisjonsnavn får stå, og den døper dem om
til våre. Se kommentaren i fila.

## Mørk modus

**Avgjort av Lars 2026-09-11: KA leverer mørk modus**, rett fra Digdir-temaets
tokens. Temaet har allerede 147 variabler i lys og mørk utgave, så kostnaden er
å verifisere skjermene, ikke å bygge noe.

`<html data-color-scheme="auto">` følger operativsystemet, og det er
standarden. Det finnes **ingen synlig bryter**, fordi ingen knapp er tegnet.
Bryteren er en konsollkommando:

```js
window.ka.colorScheme.get(); // 'auto' | 'light' | 'dark'
window.ka.colorScheme.set('dark');
window.ka.colorScheme.set('auto'); // tilbake til operativsystemet
```

Valget lagres per nettleser i `localStorage` under `ka.color-scheme`, og leses
av et lite innebygd skript i `index.html` **før første maling**, så sida aldri
blinker i feil modus. Det skriptet og `src/layout/colorScheme.ts` deler to
strenger, nøkkelen og attributtnavnet, og ingenting annet.

Når designeren tegner en knapp, kaller den `set()`. Resten er uendret.

Dette er også grunnen til at ingen farge skrives som heks noe sted: en
hardkodet farge følger ikke `data-color-scheme`, og mørk modus ryker på første
regel som gjør det.

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
