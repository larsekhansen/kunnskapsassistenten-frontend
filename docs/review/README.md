# Review i kunnskapsassistenten-frontend

Anmelderens mappe. Én rapport per branch per dato,
`<branch-med-bindestrek>-<ÅÅÅÅ-MM-DD>.md`, pluss verktøyet som lager
grunnlaget for dem i `tools/`.

Rollen står i `design/_briefs/bygg/rolle-1-anmelder.md`, reglene i
`design/_briefs/bygg/regler.md`. Anmelderen skriver **ingen funksjonskode** og
eier bare denne mappa.

## Rapporter

| Fil                                                                                            | Hva                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`main-2026-09-11.md`](main-2026-09-11.md)                                                     | Grunnlinje for skallet etter Trinn 1, og første måling av mørk modus                                   |
| [`feat-foundation-2026-09-11.md`](feat-foundation-2026-09-11.md)                               | PR #1, domenetyper og mock-klient                                                                      |
| [`feat-secondary-sidebar-2026-09-11.md`](feat-secondary-sidebar-2026-09-11.md)                 | PR #2, kildepanelet                                                                                    |
| [`main-2026-09-11-pr6.md`](main-2026-09-11-pr6.md)                                             | Etterrevisjon av PR #6 på `main`                                                                       |
| [`feat-primary-sidebar-2026-09-11.md`](feat-primary-sidebar-2026-09-11.md)                     | PR #3, navigasjonspanelet                                                                              |
| [`feat-chat-2026-09-11.md`](feat-chat-2026-09-11.md)                                           | PR #5, chat-flyten i hovedkolonnen                                                                     |
| [`feat-secondary-sidebar-2026-09-11-runde-2.md`](feat-secondary-sidebar-2026-09-11-runde-2.md) | PR #2, etterrevisjon: de tre blokkerende er rettet                                                     |
| [`main-2026-09-11-pr8.md`](main-2026-09-11-pr8.md)                                             | Etterrevisjon av PR #8 på `main`, den ekte klienten                                                    |
| [`runde-2-pr3-pr5-2026-09-11.md`](runde-2-pr3-pr5-2026-09-11.md)                               | Etterrevisjon av PR #3 og PR #5: alle blokkerende rettet                                               |
| [`funksjonssjekk.md`](funksjonssjekk.md)                                                       | Hva e2e-testene dekker, hva som er merget men udekket                                                  |
| [`visuell-2026-09-11.md`](visuell-2026-09-11.md)                                               | Visuell gjennomgang mot Figma, alle fire views i lys og mørk                                           |
| [`layout-v1-2026-09-14.md`](layout-v1-2026-09-14.md)                                           | E2E-spec for layoutbeslutningen for V1, og hullet i regnestykket ved 1280                              |
| [`feat-foundation-2026-09-14.md`](feat-foundation-2026-09-14.md)                               | PR #14, layout V1: garantien holder, men regel B mister tastaturet                                     |
| [`brukerblikk-2026-09-15.md`](brukerblikk-2026-09-15.md)                                       | Brukerblikk: 17 ting som ser rart ut, ingen av dem fanget av axe eller e2e                             |
| [`e2e-runde2-2026-09-15.md`](e2e-runde2-2026-09-15.md)                                         | E2E-bølge 2, og to sømfunn: død trådlenke og fasettellere som aldri spørres om                         |
| [`main-2026-09-15-tapt-pr22.md`](main-2026-09-15-tapt-pr22.md)                                 | PR #22 er merget, men innholdet er ikke på main                                                        |
| [`feat-foundation-2026-09-15-rail.md`](feat-foundation-2026-09-15-rail.md)                     | PR #20, railen på 67 px                                                                                |
| [`feat-chat-brukerblikk-2026-09-15.md`](feat-chat-brukerblikk-2026-09-15.md)                   | PR #23, brukerblikk-funn 5, 6, 9 og 10 i hovedkolonnen                                                 |
| [`feat-thread-url-2026-09-15.md`](feat-thread-url-2026-09-15.md)                               | PR #25, tråd-URL og needs-clarification: plumbing uten kaller                                          |
| [`feat-secondary-sidebar-2026-09-15.md`](feat-secondary-sidebar-2026-09-15.md)                 | PR #24, kildepanelet på 336 px: utdragsteksten fra 174 til 246 px                                      |
| [`feat-sources-auto-open-2026-09-15.md`](feat-sources-auto-open-2026-09-15.md)                 | PR #30, auto-åpning med plass-regel, badge i navnet, settle() i axe                                    |
| [`feat-panel-scroll-2026-09-15.md`](feat-panel-scroll-2026-09-15.md)                           | PR #31, sticky panelhode, kant over 3:1, kildepanelet på midtens grunn                                 |
| [`brukerblikk-2-2026-09-15.md`](brukerblikk-2-2026-09-15.md)                                   | Brukerblikk runde 2 etter bølgen 15.09: sju funn, og åtte punkter som er lukket                        |
| [`brukerblikk-3-2026-09-16.md`](brukerblikk-3-2026-09-16.md)                                   | Brukerblikk runde 3 etter nattbølgen: ni funn, og alle sju fra runde 2 målt på nytt                    |
| [`fix-threads-title-clamp-2026-09-16.md`](fix-threads-title-clamp-2026-09-16.md)               | PR #80, trådtittelen stopper etter to linjer: målingen kjøres ikke på nytt når vekta endrer seg        |
| [`fix-chat-blikk3-2026-09-16.md`](fix-chat-blikk3-2026-09-16.md)                               | PR #82, søkestripa inn i view-hodet: runde 3 funn 1, 3 og 6 lukket                                     |
| [`fix-view-head-padding-2026-09-16.md`](fix-view-head-padding-2026-09-16.md)                   | PR #83, hodet fester seg på 0: 32 px-båndet over stripa er borte                                       |
| [`fix-mock-error-thinking-step-2026-09-16.md`](fix-mock-error-thinking-step-2026-09-16.md)     | PR #81, feilstien tenker på spørsmålet som ble stilt: runde 3 funn 4 lukket                            |
| [`feat-live-conversations-2026-09-16.md`](feat-live-conversations-2026-09-16.md)               | PR #84, trådliste og lagring i live: løkka målt mot kjørende stack, og tomtilstanden som ikke er nåbar |
| [`chore-tenkesteg-kan-2026-09-16.md`](chore-tenkesteg-kan-2026-09-16.md)                       | PR #86, de to «kan» fra #81 tatt: kommentaren myknet, pushene testet                                   |
| [`fix-chatview-test-flake-2026-09-16.md`](fix-chatview-test-flake-2026-09-16.md)               | PR #89, fire venteløse lesninger i ChatView-testene: rasen er lest i koden, ikke gjenskapt             |

## Sånn går en review

1. **Hent branchen, og slå `main` inn i den.**
   `git fetch origin && git checkout --detach <sha>`, så
   `git merge --no-edit origin/main`. Detached, ikke `checkout <branch>`:
   eierens arbeidstre har branchen utsjekket, og git nekter å ha den to
   steder.

   **Sammenslåingen er det som merges, og den er det som skal måles.** På
   travle dager grener fire arbeidere fra hver sin `main`. PR #37 var grønn
   på sitt eget hode og slo samtidig ut filteret PR #38 hadde lagt inn to
   timer før — det var usynlig på branchen og tydelig på sammenslåingen. Sjekk
   alltid `git merge-tree --write-tree origin/main HEAD` først: en konflikt er
   ofte funnet selv, ikke bare tekst som må ryddes.

2. **Kjør alle fire portene** og skriv resultatet i rapporten, også når de er
   grønne:
   ```sh
   npm run build && npm run lint && npm run format:check && npm run tokens:verify
   ```
3. **Kjør WCAG-sjekken** på rutene PR-en berører:
   ```sh
   docs/review/tools/a11y.sh <branch-med-bindestrek> / /threads/nkom-maaloppnaaelse
   ```
4. **Gå gjennom sjekklista** under.
5. **Verifiser hver verdi mot fasiten.** Ikke tro på PR-beskrivelsen. Slå opp
   tallene, tekstene og komponentvalgene i `design/omraader/september-2026/`.
   Både i PR #1 og på `main` var det nettopp her funnene lå.
6. **Prøv interaksjonen i nettleser, ikke bare les koden.** Skriv i feltene
   tegn for tegn og se hvor fokus havner, trykk knappene som bytter tilstand
   og se om fokus overlever, og kjør de tilstandene som er standard i
   `defaultLayout`, ikke bare de forhåndsvisningen starter i. De tre
   blokkerende funnene i PR #2 var alle usynlige i koden og tydelige i
   nettleseren.
7. **Skriv rapporten:** funn nummerert, alvor, fil og linje, og hva
   Designsystemet tilbyr i stedet. Del i **blokkerer / bør / kan**, og la en
   egen seksjon si hva som er riktig, med hvor du sjekket det. Avslutt med
   «Til dirigenten» for det som er en avgjørelse og ikke en kodeendring.
8. **Legg funnene som én samlet kommentar i PR-en.** Ikke som GitHub-review
   med approve eller request changes; det gjør Lars.

   Maestri mister meldinger, så **PR-kommentaren er dommen**. Dirigenten får
   én linje i tillegg, ikke i stedet.

9. **Rapporter til dirigenten** med antall funn per alvor og om PR-en er klar
   for Lars.

### Alvorsgradene

| Grad          | Betyr                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **blokkerer** | Må endres før merge. Enten brudd på WCAG AA, eller noe som tvinger en typeendring etter at andre har bygget mot det |
| **bør**       | Endres nå fordi det er billig nå og dyrt senere, eller fordi to filer i repoet er uenige med hverandre              |
| **kan**       | Verdt å vite. Eieren avgjør                                                                                         |

Vær sparsom med **blokkerer**. Den skal bety noe.

## Sjekklista

### Designsystemet først

- [ ] Hver komponent slått opp i
      `design/designsystemet/behov-til-komponent.md` **før** egen markup.
      42 komponenter finnes; `oversikt.md` lister dem.
- [ ] Egen markup der Designsystemet har en komponent = funn. Grep etter
      `<button`, `<input`, `<select`, `<textarea`, `<table`, `<dialog`,
      `<h1`–`<h6`, `<p `, `<a ` og `<details` i JSX.
- [ ] Varianter er `data-*`-attributter, ikke egne klasser. Trenger noen en ny
      variant: sjekk `data-color` og `data-size` først.
- [ ] Alle felt pakket i `Field`, unntatt `Checkbox`, `Radio`, `Switch` og
      `Textfield`, som gjør det selv.
- [ ] Egen CSS **utenfor** alle `ds`-layer. Ingen `!important`.
- [ ] Hover og fokus arves, tegnes ikke selv.

### Fellene i 1.21.0

Fra `design/designsystemet/funn-tverrgaaende.md`. Disse koster tid å finne på
nytt:

- [ ] **Feilmelding skjules med `hidden`, aldri `display: none`.** `ds-field`
      leser `hidden`-attributtet for å avgjøre `aria-invalid`; skjuler du med
      CSS står feltet `aria-invalid="true"` uten at brukeren ser hvorfor.
      Verktøyet sjekker dette i DOM-en.
- [ ] **`Combobox` er deprecated**, «Use Suggestion instead». Flervalg _må_
      være `Suggestion`: `Select` har `multiple` fjernet fra typen.
- [ ] **`ErrorSummary` tar fokus i `connectedCallback`.** Monter den når den
      skal vises, ikke la den ligge skjult i DOM.
- [ ] **`Badge` er usynlig for skjermleser** (tallet er `content: attr()`).
      Krever egen sr-tekst.
- [ ] **`Card`-klikkdelegering kjører i `useEffect` med tom deps.** Innhold
      som kommer asynkront får ikke klikkbar flate. Gjelder kildekort.
- [ ] **`Dropdown` lager ikke semantisk meny.** W3C menubar må gjøres selv.
- [ ] **`Skeleton variant="text"` bruker `width` som tegnantall.**
- [ ] **`Popover` har `--dsc-popover-max-width: 300px`.**
- [ ] **`autoPlacement` på `Suggestion.List` virker ikke** i 1.21.0. Bruk
      `data-autoplacement="false"`.
- [ ] Deprecated props: `tooltip` (`open`, `type`), `select` (`readOnly`),
      `toggle-group` (`data-toggle-group`, `icon`), `skeleton` (`characters`),
      `field-counter` (`hint`).

### Tokens

- [ ] Ingen heksfarger. `grep -rnE '#[0-9a-fA-F]{3,8}\b' src`
- [ ] Ingen `px`, `rem` eller `em` med tallverdi.
      `grep -rnE '[0-9](px|rem|em)\b' src`. Unntak som skal begrunnes i en
      kommentar: `1px` i `ds-sr-only`-teknikken.
- [ ] Border-bredder er `var(--ds-border-width-default)`, ikke `1px`.
- [ ] Tallverdier hentet fra `design/tokens/`, aldri fra Figma Dev Mode.
- [ ] Krom skrevet med eksplisitt familie —
      `--ds-color-neutral-text-default`, `--ds-color-neutral-border-default` —
      siden `data-color="accent"` står på `body` og rolletokens alene ville
      gjort brødteksten mørk marine og skjemarammene blå.
- [ ] `--ds-size-*` måler det README lover. Verktøyet måler `--ds-size-8` i
      piksler; er den ikke 32 px, står `data-size` feil.

### WCAG AA, headless

Verktøyet dekker det meste av dette. Les rapportlinjene, ikke bare
avslutningskoden.

- [ ] Null axe-brudd, i **både lys og mørk modus**, på hver rute.
- [ ] Uavklarte axe-funn (`incomplete`) er vurdert manuelt, ikke ignorert.
- [ ] Landemerker: én `main`, og hver plass navngitt fra viewet via
      `slotLabel()`, på norsk. Aldri en fast etikett som nevner en side.
- [ ] Overskriftsnivåer henger sammen, ingen hopp, og **første overskrift i
      DOM er en `h1`**.
- [ ] Hopp-lenka er første fokuserbare element.
- [ ] Hvert interaktivt element har et navn, og navnet er norsk.
- [ ] Fokusrekkefølgen følger den visuelle rekkefølgen, og hvert steg har en
      synlig fokusring i begge moduser.
- [ ] Ikonknapper har `aria-label`. Uten unntak.
- [ ] `aria-live` riktig brukt: `polite` for strømmende svar, og ikke på et
      element som byttes ut i sin helhet.
- [ ] Kontrast målt der det er tvil. AA er 4,5:1 for tekst, 3:1 for stor
      tekst og grafiske elementer.
- [ ] Alle synlig fokuserbare elementer nås med Tab. Verktøyet teller dem i
      DOM-en og sier fra hvis vandringen fant færre. Tre av dem er alltid
      Designsystemets egne: `Suggestion.Toggle` og `Suggestion.Clear` har
      `tabindex="-1"` med vilje, og funksjonen ligger på inputfeltet
      (ArrowDown åpner lista). Sjekk hva som mangler før du melder funn.
- [ ] **En knapp som avmonterer seg selv, mister fokus til `<body>`.** Hver
      kontroll som bare rendres på en tilstand den selv endrer — «Velg alle»,
      «Tøm», en modusveksler — kaster tastaturbrukeren til toppen av
      dokumentet. Klikk hver slik knapp og les av `document.activeElement`.
      Fire tilfeller i PR #3.
- [ ] **Et live-område monteres før innholdet, aldri sammen med det.** Et
      `<output>` eller `role="status"` som dukker opp samtidig med teksten
      sin, kunngjøres ikke. `src/components/ErrorState.tsx` viser formen som
      virker. Gjelder også lastemeldinger; `Skeleton` er `aria-hidden`, så
      noe annet må si fra.
- [ ] **Mål synlighet med `checkVisibility()`, aldri med
      `getBoundingClientRect()`.** Innhold bak `content-visibility: hidden` —
      som er det en lukket `Details` bruker — rapporterer siste kjente
      størrelse fra `getClientRects()`. Målt på kildepanelet: 25 mot 21
      fokuserbare, der 21 er tallet Tab gir. Det ga ett falskt blokkerende
      funn før det ble rettet.
- [ ] Skjermbilde av det som er bygget, i begge moduser, til
      `design/skjermbilder-frontend/`.

### Navn og norsk

- [ ] Engelsk: kode, filnavn, mapper, CSS-klasser, CSS-variabler, typer,
      ruter og kommentarer. KA-begrepene siteres på norsk i kommentarer der
      det trengs («tråd», «kilde»).
- [ ] Norsk bokmål med ekte æøå: all UI-tekst, `aria-label`, `title`,
      feilmeldinger.
- [ ] Plasser heter etter posisjon, views etter innhold.
- [ ] `grep -rinE 'venstre|høyre|\bleft\b|\bright\b' src index.html` gir
      ingen treff utenom CSS-logiske egenskaper som `padding-inline`.
- [ ] Norsk brukertekst bor i `src/model/`, ikke spredt i klienter og views,
      slik `relevanceLabels` viser mønsteret.

### Typer og data

- [ ] Delte typer i `src/model/`. Ingen `any`, ingen `@ts-ignore`.
- [ ] En union dekker alle tilstander produktet faktisk har. Sjekk at to filer
      ikke sier motstridende ting om samme hendelse.
- [ ] Ingen delte muterbare konstanter eller fixtures som deles ut ved
      referanse.
- [ ] Fixtures bruker ekte tekst fra `design/omraader/september-2026/`, og
      hvert bevisst avvik fra Figma er dokumentert der fixturen står.
- [ ] Felt designet trenger og backend ikke har er merket der de erklæres.

## Feller i målingen selv

Feller som har kostet tid, og to til fra 16.09. En måling som lyver er verre
enn ingen måling, fordi den blir stående i en rapport.

- **`.first()` og `.last()` på en knapp som alt finnes.** «Vent til svar
  nummer to er ferdig» skrevet som
  `getByRole('button', { name: 'Kopier svaret' }).last()` returnerer med én
  gang: svar nummer én har den knappen fra før. Målingen skjer da midt i
  strømmen, og du rapporterer at det andre svaret ikke har kilder. Bruk
  `.nth(n - 1)` eller tell knappene. Målt på nytt 16.09 i anmeldelsen av #82,
  der `.first()` ga det samme: det nyeste svaret så ut til å mangle hele
  handlingsraden, og hadde bare ikke kommet ennå. Det som virker er å vente på
  ANTALLET: `waitForFunction(n => knapper med «Kopier svaret» === n)`.
- **Hovedkolonnen ruller på `main` selv**, ikke på en boks inni den —
  `main` har `overflow-y: auto`. En hjelper som leter etter en rullende
  ETTERKOMMER med `main.querySelectorAll('*')` finner ingen, og hvis den
  hopper over rullingen i stillhet (`if (sc) sc.scrollTop = …`) får du tre
  identiske avlesninger for tre ulike rullestillinger. Det ser ut som et svar.
  Rull med `main.scrollTop`, og les `scrollTop` tilbake i samme avlesning som
  resten. Sidepanelene ruller derimot på `.sidebar-content` inni `.panel`.
  Målt 16.09 i anmeldelsen av #83.
- **`[role="option"]` finnes i alle tre fasettlistene samtidig.** De to
  lukkede er `display: none`, så `.first()` treffer noe usynlig. Å filtrere på
  tekst er **ikke nok**: «2026» treffer både «2026 (180)» i År og «Regelrådet
  (avviklet 2026) (3)» i Virksomheter, og den skjulte kommer først i DOM-en —
  da venter testen på noe som aldri blir synlig, og henger i stedet for å
  feile. Scope til feltet, slik `facetOption()` i `tests/e2e/helpers.ts` gjør.
  Målt 2026-09-16: 275 options i DOM samtidig, alle inne i en `ds-suggestion`.
  Denne fella sto beskrevet her mens hjelperen min gikk rett i den — en
  advarsel er ikke en sperre.
- **ArrowDown skriver den framhevede verdien inn i feltet.** Et tastetrykk
  etterpå legger seg bakerst, og lista filtrerer på «AksjeNorgeNasjonal».
  Skriv først, framhev etterpå.
- **Markørene i et svar er ikke `<sup>` før kildene har kommet.** Å lete etter
  `.markdown__citation` mens svaret strømmer finner ingenting, uansett hvor
  mange `[n]` som står i teksten. Let i teksten, ikke i elementene.
- **`aria-disabled` er «ikke enabled» for Playwright.** `isEnabled()` gir
  `false`, og et vanlig `click()` på en slik knapp står og venter til det
  tidsavbrytes med «element is not enabled» — selv om en ekte leser kan klikke
  den, som er hele poenget med `aria-disabled`. Bruk
  `toHaveAttribute('aria-disabled', 'true')`, ikke `toBeDisabled()`. Og
  `click({ force: true })` er ikke svaret: den klikker på gamle koordinater, så
  et element som ruller (en søkestripe som følger en myk rulling til treffet)
  kan bomme, og du rapporterer et steg som slukt. Målt i #60.
- **Les én gang, og du måler et øyeblikk, ikke en tilstand.** Etter en reload
  bygges appen opp over noen hundre millisekunder, og et panel som er tomt ved
  170 ms har innhold ved 490 ms. Prøv over tid før du skriver at noe «står»
  tomt. Det kostet #3 fem forsøk på et funn som ikke fantes (#57).

## Verktøyet

```sh
docs/review/tools/a11y.sh <navn> [rute ...]
```

Kjører axe-core 4.13 mot hver rute i **både** lys og mørk modus, og
rapporterer landemerker, overskrifter, `aria-live`, fokusrekkefølge med synlig
fokusring, rot-attributtene og målt `--ds-size-8`. Skriver skjermbilder til
`design/skjermbilder-frontend/` og rådata som JSON til
`~/.cache/ka-review/runs/<navn>/`.

To valg det er verdt å vite om:

- **Mørk modus tvinges** ved å sette `data-color-scheme` på `<html>`, ikke ved
  å emulere operativsystemet. `index.html` har i dag verdien fast til `light`,
  og da gjør `prefers-color-scheme` ingenting; mørk modus ville aldri blitt
  sett. Hva appen faktisk sender ut rapporteres som `shipped` i JSON-en, så
  begge spørsmålene besvares: er paletten god, og er den i det hele tatt
  tilgjengelig for brukeren. Se funn 1 i `main-2026-09-11.md`.
- **axe-core lastes ned til `~/.cache/ka-review/`**, ikke til `package.json`.
  Bare grunnmuren legger til avhengigheter. Rådataene ligger også utenfor
  repoet, fordi Prettier leser `.prettierignore` og ikke `.gitignore`, og
  `.prettierignore` er grunnmurens fil. Skal sjekken bo i repoet, trengs
  `@axe-core/playwright` fra grunnmuren.

Krever `playwright-cli` globalt. Dev-serveren startes på 5177 hvis porten er
ledig, og stoppes etterpå. `KA_KEEP=1` lar nettleseren stå åpen mellom
kjøringer, `KA_PORT` og `KA_VIEWPORT` overstyrer resten.
