# Bidra til kunnskapsassistenten-frontend

Kortversjonen av byggereglene. Fullversjonen er `design/_briefs/bygg/regler.md`
i Lars sin lokale `design/`-mappe, og den er fasit der de er uenige.

## Navn

Dette er den regelen det er lettest å bryte og dyrest å rette.

- **Engelsk:** kode, filnavn, mapper, CSS-klasser, CSS-variabler, typer, ruter,
  kommentarer.
- **Norsk bokmål med ekte æøå:** alt brukeren ser eller hører. UI-tekst,
  `aria-label`, `title`, feilmeldinger, `lang="nb"`. Også `README.md` og denne
  fila.
- **Plasser heter etter posisjon, views etter innhold**, som i VS Code.
  Plassene er `primary-sidebar`, `main` og `secondary-sidebar`. Viewene er
  `threads`, `filters`, `chat`, `sources`.
- **En plass har aldri en fast `aria-label`.** Navnet kommer fra viewet som
  står der, via `slotLabel()` i `src/layout/viewModel.ts`.
- **Ingen «venstre», «høyre», `left` eller `right` noe sted**, heller ikke i
  kommentarer. Kjør `grep -rin 'venstre\|høyre\|left\|right' src` før du
  pusher; det skal ikke gi treff utenom CSS-logiske egenskaper som
  `padding-inline`.

Se [README, Naming](README.md#naming) for begrunnelsen.

## Eierskap etter mappe

Rør aldri en mappe du ikke eier. Trenger du noe der, meld behovet til
dirigenten, som gir det til eieren.

| Mappe                                                                                        | Eier              |
| -------------------------------------------------------------------------------------------- | ----------------- |
| `src/api/`, `src/model/`, `src/layout/`, `src/components/`, `vite.config.ts`, `package.json` | grunnmur          |
| `src/views/threads/`, `src/views/filters/`                                                   | primary sidebar   |
| `src/views/chat/`                                                                            | main              |
| `src/views/sources/`                                                                         | secondary sidebar |
| `docs/review/`                                                                               | anmelder          |

- **Bare grunnmuren legger til avhengigheter.** Andre melder behov.
- Delte typer bor i `src/model/`. Kod mot dem, be om endringer.
- Før grunnmuren er merget: bruk mock-data fra `src/api/mock/`, eller egne
  fixtures i din egen mappe.

## Designsystemet først, alltid

Bygg aldri en komponent Designsystemet allerede har. Det koster dyrt å rette
senere.

1. Slå opp behovet i `design/designsystemet/behov-til-komponent.md`.
2. Les komponenten i `design/designsystemet/komponenter/<navn>.md`.
3. Først da, hvis Designsystemet ikke har noe: egen konstruksjon, med
   semantikk og tastaturstøtte fra dag én.

- **Ingen hardkodede farger, størrelser eller fonter.** `var(--ds-*)`.
  Tallverdier fra `design/tokens/`, aldri fra Figma Dev Mode.
- Egen CSS skrives **utenfor alle layers**, se README.
- Hover, fokus og tastaturfokus **arves** fra Designsystemet og tegnes ikke
  selv.

## WCAG 2.x AA er et krav

Ikke et mål. Offentlig sektor og uu-kravene. Enhver snarvei som gir utseende
uten tilgjengelighet er utelukket.

- `npm run lint` kjører `jsx-a11y`-reglene som feil, ikke advarsler.
- Ikonknapper må ha `aria-label`.
- Landemerker og overskriftsnivåer skal henge sammen.
- Kjør appen headless og ta et accessibility-snapshot av det du bygde før du
  melder ferdig. Skjermbilde til
  `design/skjermbilder-frontend/<branch>-<slug>.png`.

## Git og PR

- Branch `feat/<område>` fra `main`. Små commits.
- Commit-melding på **norsk** med ekte æøå, trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Push til origin, **åpne PR som draft tidlig**, og oppdater den.
- **Aldri merge.** Lars merger. Rebase på `main` når dirigenten sier det.
- PR-beskrivelsen dekker **kun** det som er i PR-en. Kort. Ingen
  AI-attribusjon, ingen «oppfølging» eller «test-plan» — sånt sier du til
  dirigenten.
- Kommentarer i egen PR er greit. Ingen andre GitHub-poster uten ja fra Lars.

## Grønt før push

```sh
npm run build
npm run lint
npm run format:check
npm run tokens:verify
```

Alle fire, hver gang.

## Delte ressurser

- Dev-server: 5173 er grunnmurens. Primary sidebar bruker 5174, main 5175,
  secondary sidebar 5176 (`--port`). Sjekk
  `lsof -nP -iTCP -sTCP:LISTEN | grep 517` før du starter, og **stopp etter
  deg**.
- Ingen nettleservinduer på skjermen. Headless.
- Ikke rør RAG-stacken (8080 og 3030). Les, ikke restart.

## Spesifikasjonene

- `design/omraader/september-2026/` er **fasit**.
- `design/omraader/molecules/` og `organisms/` for komponentdetaljer.
- `design/svar-skjema.md` og `design/visjon-og-beslutninger.md` for
  beslutninger.
- `design/skal-dette-implementeres.md` for hva som er ja, senere og nei, og
  for bygg-rekkefølgen.
