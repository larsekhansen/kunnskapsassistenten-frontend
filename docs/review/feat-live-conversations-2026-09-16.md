# PR #84, `feat/live-conversations`: trådliste og lagring i live-modus

2026-09-16, anmelderen (KA CC). Anmeldt på `84f98c7` slått sammen med
`origin/main` (`2fc6122`). Rent sammenslått. Ti filer, nøyaktig de
beskrivelsen lister.

## Portene

| Port            | Resultat                                    |
| --------------- | ------------------------------------------- |
| `build`         | grønt                                       |
| `lint`          | grønt                                       |
| `format:check`  | grønt                                       |
| `tokens:verify` | grønt                                       |
| `test` (vitest) | 565 av 565, 55 filer                        |
| `test:e2e`      | **128 av 128**, 1,9 min, port 4173, CI=true |

## Hvor målingen ble gjort, og hvorfor det måtte flyttes

Jeg ble pekt på 5183. Den viser en live-forside — filterpanelet sier
«Filtrering er ikke tilgjengelig ennå» og korpuslinja står uten tall — men
trådlista sa «Ingen tråder ennå» og **det gikk ikke ett eneste kall til
backenden**, og `ka.user.v1` ble aldri skrevet.

Det så ut som et funn. Det var feil server: 5183 kjøres fra
`kunnskapsassistenten-frontend/`, altså hovedcheckouten på `main`, der
`listThreads` ennå returnerer tom liste med vilje. Sjekket med
`lsof -p <pid> -a -d cwd`.

Min egen på 5177, fra dette arbeidstreet, med `.env.local` kopiert fra
hovedcheckouten og `VITE_API_MODE=live` — det siste er bryteren, ikke
nøklene. Kopien er slettet igjen etterpå.

## Hele løkka målt mot kjørende stack

Ett spørsmål brukt av de to tillatte, resten `GET`:

```
→ POST /api/conversations                          ← 201
→ POST /api/mcp                                    ← 200
   adressen blir /threads/01478f55-…

etter reload, samme nettleser:
→ GET  /api/conversations?page_size=100            ← 200
→ GET  /api/conversations/4gJH8zomBFFf826l8I44_    ← 200
```

- **Eierskapet holder.** Tråden ligger i **min** liste, under «I dag», 10:23,
  med spørsmålet som tittel. Det er hele poenget med å opprette samtalen selv,
  og det stemmer.
- **`ka.user.v1`** skrives ved første kall, ikke ved oppstart.
- **Systemledeteksten er borte.** Den gjenopprettede samtalen har bare
  spørsmålet og svaret.
- **Den utledede agent-id-en ble godtatt** — `POST` svarte 201.
- **Ingen utdrag lagres**, som beskrevet: panelet er tomt selv om svaret viser
  til to.

## Funn

### 1. Den nye tomtilstanden er ikke nåbar, heller ikke i tilfellet den er skrevet for — bør

**Live-modus, 1440.** `blikk3/pr84-06-live-gjenopprettet-1440-light.png`

Den gjenopprettede tråden:

```
svaret         «… Bryggen i Bergen, som står på UNESCOs verdensarvliste
                siden 1979. [1] … anslagsvis 7 000 innbyggere før
                svartedauden … [2]»
kildepanelet   «Ingen kilder til dette svaret
                Svaret viser ikke til noen utdrag fra dokumentene.»
```

Det er setningen leseren kan motbevise ved å se på svaret ved siden av — den
PR-en er skrevet for å fjerne. `citationCount` er `undefined`, så
`emptyStateFor` faller tilbake på `BY_STATUS.complete` og `NOT_STORED` tegnes
aldri.

Beskrivelsen sier det selv («feltet er valgfritt til chatviewet begynner å
telle»), så det er ingen overraskelse. Men PR-en leser som om forbedringen er
levert, og i live er den det ikke — og live er der problemet er.

Den trenger heller ikke vente på #3: `messagesFromApi`
(`src/api/live/conversations.ts:193`) har `message.text` i hånda når den
bygger meldinga. Å telle `[n]` der gjør tilstanden nåbar i dag, i nettopp det
tilfellet den ble skrevet for, uten å røre `src/views/chat/`.

Ordlyden selv er riktig etter #4 sin runde. «Still spørsmålet på nytt for å få
et svar med kilder du kan åpne» lover ikke det den avbrutte lover, og det er
den rette forskjellen: et avbrutt svar finnes ikke ennå, mens dette svaret
står der og et nytt vil bygge på noe annet.

### 2. Klassekommentaren sier fortsatt at `listThreads` ikke gjør noe — kan

`src/api/live/LiveChatClient.ts:80`:

> `listThreads`, `getThread` and `listFacets` return nothing on purpose: the
> backend has neither thread history a frontend can read back nor facet counts.

To av de tre gjør nå nettopp det. Kommentaren er uendret i denne PR-en, og
bare `listFacets` er igjen. Det var dessuten den som fikk meg til å tro at
5183 var riktig server lenger enn jeg burde.

## Notert, ikke et funn

- **`main sup` er 0** i den gjenopprettede tråden: `[1]` og `[2]` er ren
  tekst, ikke markører, siden det ikke finnes kilder å peke på. Ingen døde
  lenker — de er inerte, og README sier det.
- **Bruker-id-en er ingen identitet**, og det står tre steder: modulkommentar,
  README og PR-beskrivelse. Det er den typen forbehold som pleier å forsvinne.
  Kvitterer på at det står.

## Til dirigenten

Ingen blokkerende. Ett bør, ett kan.

Avgjørelsen er hvem som lukker funn 1: fire linjer i `conversations.ts` her,
eller #3 sin oppfølger. Velges det siste, bør det stå et sted at live fortsatt
sier feil setning til den er inne.
