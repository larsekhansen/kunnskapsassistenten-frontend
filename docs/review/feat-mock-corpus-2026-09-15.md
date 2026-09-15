# PR #33, ekte Kudos-korpus i mock

2026-09-15, anmelderen (KA CC). `feat/mock-corpus`. Fasit:
`rolle-5g-mock-korpus.md` (938 dokumenter, betingede fasetter,
`VITE_MOCK_SPEED`).

**Klar, med ett «bør» som bør tas før dette står lenge:** korpuset havner i
produksjonsbunten.

## Portene

| Sjekk                                               | Resultat                                     |
| --------------------------------------------------- | -------------------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | OK                                           |
| `npm test`                                          | 141 tester, 18 filer, grønne                 |
| `npm run test:e2e`                                  | 56 grønne, 0 røde, **31 s inkludert bygget** |

`VITE_MOCK_SPEED=fast` virker: 938 dokumenter og suiten bruker fortsatt 31 s
med bygg. Standarden er `realistic`, som er riktig — en mock som svarer
momentant kan ikke vise skjelettet, tenkepanelet eller strømmingen.

## Bør

### 1. Korpuset ligger i live-bunten

Bygget med `VITE_API_MODE=live` inneholder hele mock-korpuset. Målt ved å lete
etter en tittel som bare finnes der:

```
leter etter: «Forskningsrådets budsjettforslag 2027 overfor departementene»
funnet i   : dist/assets/index-CnrfEMNX.js   (live-bygg)
```

Hva det koster:

|                      | Rå       | Gzippet |
| -------------------- | -------- | ------- |
| Hele live-bunten, JS | 1,45 MB  | 442 kB  |
| Korpuset alene       | 879 kB   | 243 kB  |
| **Korpusets andel**  | **59 %** | ~55 %   |

Altså: mer enn halvparten av JavaScriptet en produksjonsbruker laster ned er
fixtures hen aldri kan se.

**Hvorfor det skjer.** `src/api/index.ts` importerer begge klientene statisk:

```ts
import { LiveChatClient } from './live';
import { defaultMockSpeed, MockChatClient, mockSpeeds } from './mock';
```

Grenen under er en `if` på `import.meta.env.VITE_API_MODE`, og Vite bytter ut
verdien ved bygg — men den statiske importen holder `./mock` og JSON-en den
drar med seg i modulgrafen uansett hva grenen sier.

Dette er ikke innført av #33 i seg selv; den statiske importen sto der fra før.
Det #33 gjør er å gjøre prisen ekte: fixtures var noen kB før, nå er de 879.

**Retning, ikke oppskrift:** en `await import('./mock')` gir bundleren et eget
chunk som live-modus aldri ber om. Det gjør `createChatClient()` asynkron, og
hvordan det skal løses er #5 sin arkitektur og ikke min å tegne.

## De to unntakene i `tests/`

Begge riktige, og den andre retter noe som var mitt problem.

**`VITE_MOCK_SPEED` i `webServer.env`.** Riktig sted og riktig begrunnelse:
Vite bytter ut begge variablene ved _bygg_, så de må stå på kommandoen som
bygger. `env` på `webServer` gjelder hele `npm run build && npm run preview`.

**`/^1 av \d+ valgt$/`.** «1 av 6 valgt» var sant så lenge fasettene var seks
håndskrevne verdier. De telles nå fra korpuset, der «Virksomheter» har 259, og
det blir et annet tall neste gang korpuset hentes. Testen handler om at ett
valg vises som ett valgt, og det tallet har ingenting med korpusstørrelsen å
gjøre.

Og #5 rettet en ekte skjørhet i testen min underveis: den skrev «Nasjonal» og
tok første treff, som i det ekte korpuset er «Nasjonalarkivet» og ikke
«Nasjonal kommunikasjonsmyndighet». Nå skrives hele navnet. Det er en feil
testen min hadde hele tiden og som bare ikke kunne slå ut med seks
håndskrevne verdier. Takk.

## Det som er riktig, og hvor jeg sjekket det

- **Betingede fasetter.** `listFacets(signal, selection)`, og kommentaren sier
  regelen som betyr noe: en dimensjon smalner aldri sine egne tellere, ellers
  ville hver ukrysset verdi falt til null i det den første ble krysset.
- **Live-modus returnerer ingen fasetter**, som stemmer med at backend ikke
  har fasettaggregering (A2), og det er skrevet i grensesnittet.
- **`scripts/fetch-mock-corpus.mjs`** gjør korpuset reproduserbart i stedet
  for å være en fil noen la der en gang.
- **`.prettierignore`** tar JSON-en, så `format:check` ikke bruker tid på 879
  kB maskingenerert data.
- `tests/` er ellers urørt.

## Til dirigenten

1. **Klar å merge.** Funn 1 er ikke en regresjon og blokkerer ingenting i dag
   — appen kjører i mock hos alle som ser den nå.
2. **Men det bør ikke bli stående.** Første gang noen bygger dette for ekte,
   sender vi 243 kB gzippet fixtures til hver bruker. Det er billigere å dele
   importen nå enn etter at noen har målt lastetiden i produksjon.
3. Til #2: `listFacets` tar nå `selection` som andre argument.
