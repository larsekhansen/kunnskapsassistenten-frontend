# Review i kunnskapsassistenten-frontend

Anmelderens mappe. Én rapport per branch per dato,
`<branch-med-bindestrek>-<ÅÅÅÅ-MM-DD>.md`, pluss verktøyet som lager
grunnlaget for dem i `tools/`.

Rollen står i `design/_briefs/bygg/rolle-1-anmelder.md`, reglene i
`design/_briefs/bygg/regler.md`. Anmelderen skriver **ingen funksjonskode** og
eier bare denne mappa.

## Rapporter

| Fil                                                                                            | Hva                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`main-2026-09-11.md`](main-2026-09-11.md)                                                     | Grunnlinje for skallet etter Trinn 1, og første måling av mørk modus      |
| [`feat-foundation-2026-09-11.md`](feat-foundation-2026-09-11.md)                               | PR #1, domenetyper og mock-klient                                         |
| [`feat-secondary-sidebar-2026-09-11.md`](feat-secondary-sidebar-2026-09-11.md)                 | PR #2, kildepanelet                                                       |
| [`main-2026-09-11-pr6.md`](main-2026-09-11-pr6.md)                                             | Etterrevisjon av PR #6 på `main`                                          |
| [`feat-primary-sidebar-2026-09-11.md`](feat-primary-sidebar-2026-09-11.md)                     | PR #3, navigasjonspanelet                                                 |
| [`feat-chat-2026-09-11.md`](feat-chat-2026-09-11.md)                                           | PR #5, chat-flyten i hovedkolonnen                                        |
| [`feat-secondary-sidebar-2026-09-11-runde-2.md`](feat-secondary-sidebar-2026-09-11-runde-2.md) | PR #2, etterrevisjon: de tre blokkerende er rettet                        |
| [`main-2026-09-11-pr8.md`](main-2026-09-11-pr8.md)                                             | Etterrevisjon av PR #8 på `main`, den ekte klienten                       |
| [`runde-2-pr3-pr5-2026-09-11.md`](runde-2-pr3-pr5-2026-09-11.md)                               | Etterrevisjon av PR #3 og PR #5: alle blokkerende rettet                  |
| [`funksjonssjekk.md`](funksjonssjekk.md)                                                       | Hva e2e-testene dekker, hva som er merget men udekket                     |
| [`visuell-2026-09-11.md`](visuell-2026-09-11.md)                                               | Visuell gjennomgang mot Figma, alle fire views i lys og mørk              |
| [`layout-v1-2026-09-14.md`](layout-v1-2026-09-14.md)                                           | E2E-spec for layoutbeslutningen for V1, og hullet i regnestykket ved 1280 |

## Sånn går en review

1. **Hent branchen.** `git fetch origin && git checkout --detach <sha>`.
   Detached, ikke `checkout <branch>`: eierens arbeidstre har branchen
   utsjekket, og git nekter å ha den to steder.
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
