# 0002 — Klienten vår som `apps/web`, bak Nikolais BFF

Skrevet 2026-09-28. Status: **retning valgt** av Lars. Detaljene under er
foreslått og ikke avtalt med Nikolai.

Rettet 2026-10-05 på tre punkter, etter at flyttingen ble prøvd på ordentlig:
rekkefølgen, `git subtree` og påstanden om at backenden lagrer bitene. Hver
rettelse står der påstanden sto. Nå-bildet for flyttingen er
`design/plan-monorepo-2026-09-29.md`.

## Valget

> «Vi sikter på å overta /web i digdir/kunnskapsassistenten/src/apps. …
> Jeg antar /server er backend for frontend. Men det må funke bra.»
>
> «Vi kan vel se for oss en merge hvor vi beholder det beste fra mitt og
> hans.» (Lars, 2026-09-28)

`digdir/kunnskapsassistenten/src` har tre deler:

- `apps/web`: en Preact-SPA på `@digdir/designsystemet-web`.
- `apps/server`: en Hono-server, altså BFF-en.
- `packages/contract`: typene mellom de to.

Appen er utrullet på <https://qa.kunnskap.digdir.cloud> med Entra ID.
Klienten vår skal erstatte `apps/web`, og BFF-en blir stående.

## Hvorfor BFF-en blir stående

Backenden autentiserer applikasjoner, ikke personer. Den godtar `X-User-Id`
uten å sjekke den, og den svarer ikke med CORS-hoder. Noe på serversiden må
derfor holde nøkkelen og _være_ identiteten. Nikolais ADR 0002 forklarer det.

BFF-en gjør alt dette, og en sikkerhetsgjennomgang har gått gjennom det:

- innlogging med Entra ID, med identiteten avledet fra økta
- CSP, HSTS, forbud mot innramming og CSRF
- `__Host-`-informasjonskapsler, eierskapssjekk før en tråd fortsettes, og tak
  på forespørselskroppen

Vår tynnserver lar nettleseren bestemme `X-User-Id`, og den slipper alt under
`/api/` gjennom med nøkkelen på. Den er riktig for et testmiljø i mock, men
ikke for noe som står åpent med ekte svar.

## Målt 2026-09-28

Nikolais BFF (`origin/main` `8639267`) kjørte lokalt med `AUTH_MODE=off` mot
vår backend: headless-rag på grenen `fix/mcp-retrieve-filter-by`, tenant
`kudos`, datasett `kudos-full`.

|                                    | resultat                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run doctor`                   | 13 agenter, samtale-API-et avgrenset av `X-User-Id`, Typesense med 10 064 dokumenter                                            |
| `/api/capabilities`                | `filters: true`. Proben hans sender et umulig filter og fikk 0 treff. I hans utrullede miljø er filtrene av.                    |
| `/api/facets`                      | 8 dokumenttyper, 200 virksomheter, 22 år                                                                                        |
| `/api/models`                      | 13 agenter samlet til 8 valg, med modus under                                                                                   |
| `/api/ask` med `type = Årsrapport` | 18 s, én kilde (DFØs årsrapport 2024) med et utdrag på 9 372 tegn                                                               |
| svarteksten fra `/api/ask`         | **bare agentens plan, 393 tegn. Selve svaret kom ikke fram.**                                                                   |
| samme spørsmål rett mot `/api/mcp` | `response/chunk` hadde 527 tegn plan («Jeg vil finne …»), og siste ramme hadde svaret, 539 tegn                                 |
| identitet                          | uten informasjonskapsel ble hver forespørsel en ny anonym bruker. Identiteten ligger i økta, ikke i et hode nettleseren setter. |

Svaret forsvinner fordi BFF-en viser `response/chunk` som svartekst og hopper
over siste ramme når noe alt er strømmet. Mot denne backenden er hver slik
delta agentens plan, fulgt av en `agent/thinking` med de samme ordene.
Svaret kommer helt i siste ramme. Klienten vår har målt dette før, 11.09, og
holder deltaene tilbake til det er klart om de er plan eller svar
(`McpStreamState` i `src/api/live/mcp.ts`).

## Det beste fra begge

| Del                                   | Hans                                                                     | Vår                                                                                                             | Beholdes                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Klienten                              | Preact og DS-web: 1 353 linjer TypeScript uten tester, og 816 linjer CSS | React og DS-react, Figma-designet, paneler som kan dras, UU-arbeid, 984 unit- og 151 e2e-tester                 | **vår**. ADR 0001 hans kaller den for produktsporet.                                        |
| Server, innlogging og sikkerhet       | Hono, Entra og alt over                                                  | tynn proxy                                                                                                      | **hans**                                                                                    |
| Tolkningen av MCP-strømmen            | viser planen og mister svaret (målt)                                     | plan og svar skilt (målt)                                                                                       | **vår logikk, flyttet inn i BFF-en**                                                        |
| Kontrakten mellom nettleser og server | `TurnEvent`: conversation, stage, delta, sources, done og error          | rikere: tenkesteg, treff, kilder per svar                                                                       | **hans som grunnlag**, utvidet med det klienten vår viser                                   |
| Kilder når en tråd åpnes igjen        | i minnet til BFF-en, bare siste svar, borte ved omstart                  | referansene i nettleseren, og teksten slås opp (0005, bare live). Backenden lagrer dem ikke, se rettelsen under | **vår vei**, men gjennom BFF-en                                                             |
| Fasetter og filter                    | fasetter fra Typesense, probe, filteret låst per tråd                    | filtervalg sendes, felt per datasett som konfigurasjon                                                          | **hans** fasetter, probe og lås. Feltene blir konfigurasjon per datasett på sikt (0001, D). |
| Agentvelger                           | API og UI                                                                | ingen                                                                                                           | **hans API, vår UI**                                                                        |
| Endre navn på og slette tråder        | API og UI                                                                | bare søk                                                                                                        | **hans API, vår UI**                                                                        |
| Korpusvelger                          | ett datasett fra miljøet                                                 | flere                                                                                                           | **vår**. BFF-en må kunne velge mellom datasettene nøkkelen har lov til.                     |
| Mock uten backend                     | ingen                                                                    | full demo med fixturer                                                                                          | **vår**, til CI og demo                                                                     |
| Filterrettelser i headless-rag        | PR #15, strengere validering                                             | grenen, seks rettelser                                                                                          | **#15** for 1–5, og **vår** nr. 6 (`fetch-facets`) oppå. Se 0001.                           |
| Utrulling                             | `ka-app`, manuelt med `az`                                               | mal og utrulling fra GitHub (#166)                                                                              | **hans miljø**. Utrullingen fra GitHub kan tas med.                                         |

## Det som må endres

**I BFF-en** (Nikolais kode, så en PR dit krever Lars' ja per post):

1. Skille plan fra svar i strømmen, slik klienten vår gjør.
2. Sende kildene per melding når en tråd åpnes igjen. **Rettet 2026-10-05:**
   her sto det «Backenden har dem», og det stemmer ikke. `tools/call` lagrer
   bare svarteksten, og `transact-used-data` kalles aldri, så
   `GET /api/conversations/:id` gir `chunks: []` på hver melding. Målt 29.09
   av #5, meldt som digdir/digdir-headless-rag#21. Til det er rettet, må
   kildene komme et annet sted fra; 0005 gjør det i live-modus ved å slå opp
   teksten i Typesense og holde referansene i nettleseren.
3. Ha med tenkesteg og treff i kontrakten.
4. La klienten velge datasett blant dem nøkkelen har lov til.

**I klienten vår**:

- En `ChatClient` mot `/api/ask`, `/api/conversations`, `/api/facets`,
  `/api/capabilities`, `/api/models` og `/api/me`, ved siden av mock.
- Svar 401 fører til innlogging. Brukernavn og «Logg ut».
- UI for agentvelger, endre navn og slette, filterlås, tilbakemeldingslenke,
  og advarsel når svaret ikke har kilder.
- Skriptet inni `index.html`, som setter fargetemaet før første tegning, blir
  en egen fil. BFF-ens CSP (`script-src 'self'`) stopper et slikt skript.
- `/config.js` finnes ikke bak BFF-en. Det klienten trenger å vite om miljøet,
  må komme fra `/api/me` og `/api/capabilities`.

## Når det «funker bra»

- E2E-suiten er grønn mot BFF-en, ikke bare mot mock.
- Samme spørsmål gir samme svar og kilder gjennom BFF-en som rett mot
  backenden.
- Innlogging virker på den utrullede adressen, og strømmen kommer uten
  bufring.
- Ingen UU-regresjon: tastatur, fokus og skjermleser for tekst som strømmer
  inn.
- Den har stått side om side med Nikolais klient før den tar over adressen.

## Rekkefølge

**Erstattet 2026-10-05** av tabellen «Rekkefølge» i
`design/plan-monorepo-2026-09-29.md`, som er skrevet etter at flyttingen ble
prøvd på ordentlig. To ting ble snudd:

- **BFF-endringene kommer etter flyttingen, ikke før.** Hver av dem rører
  `apps/server`, `packages/contract` og `apps/web` samtidig, og det er
  enklest når alle tre ligger i samme repo.
- **Headless-rag er ikke lenger et eget trinn.** Det går gjennom issues, ikke
  PR-er fra oss.

Rekkefølgen som gjaldt da dette ble skrevet, for historikkens skyld:

1. Headless-rag: ta #15 i stedet for rettelse 1–5 hos oss, og send nr. 6 og
   seed-skriptet som egen PR.
2. `ChatClient` mot BFF-en i vårt repo, prøvd mot hans BFF lokalt.
3. Endringene i BFF-en, som PR-er til Nikolai.
4. Flytte klienten inn som `src/apps/web`, med historikken
   (`git subtree`), CI og e2e.
5. Utrulling i `ka-app`, og så overta adressen.

## Prisen

- Nikolais web-komponent-eksperiment (ADR 0001) blir ikke produktet. Resultatet
  er hans å skrive ned, og det må avtales med ham.
- Tynnserveren vår går ut når klienten er flyttet. Til da er den testmiljøet
  i mock.
- CI blir en monorepo-CI, med arbeidsområder og e2e i en undermappe.

## Rettet 2026-10-05: `git subtree` beholder ikke filhistorikken

Punkt 4 i den gamle rekkefølgen over sier «med historikken (`git subtree`)».
Prøveflyttingen 29.09 (`design/_briefs/bygg/maalt-monorepo-proeve-2026-09-29.md`)
målte at det ikke stemmer slik det var ment:

| Metode                 | Commits | `git log` på én fil under `src/apps/web/` | `--follow` | SHA-er   |
| ---------------------- | ------- | ----------------------------------------- | ---------- | -------- |
| `git subtree add`      | 734     | **1**, bare merge-commiten                | **0**      | beholdes |
| `filter-repo` og merge | 734     | 5, som i vårt repo                        | virker     | blir nye |

Begge tar med commitene. Forskjellen er om man kan følge historikken til en
enkelt fil etterpå, og det er `subtree` som ikke kan det. Valget mellom dem
står åpent som D1 i planen: `subtree` beholder SHA-ene, som 140 steder i våre
egne `docs/review/` viser til, mens `filter-repo` gir brukbar filhistorikk og
nye SHA-er.

## Rettet 2026-10-05: 0005 løser kildene bare i live

0005 («Teksten i utdragene, og kildene etter ny innlasting») gjelder
**live-modus alene**, som den selv sier under «Konsekvenser». Bak BFF-en er
problemet det samme, og det samme lageret kan brukes, men det er ikke gjort.
Så flyttingen hit tar ikke 0005 med seg: når klienten står bak BFF-en, er
kildene etter ny innlasting fortsatt BFF-ens sak, og i dag ligger de i minnet
til BFF-en, bare for siste svar, og er borte ved omstart.
