# BFF-modus

`VITE_API_MODE=bff` lar klienten snakke med Nikolais BFF (`src/apps/server` i
`digdir/kunnskapsassistenten`) i stedet for rett med backenden. BFF-en holder
API-nøkkelen og innloggingen, og identiteten kommer fra økta. Klienten sender
spørsmålet, samtale-id-en og filteret, ikke tenant, datasett eller
`X-User-Id`. Bakgrunnen står i `docs/arkitektur/0002-klienten-bak-bff.md`.

| BFF-en                         | i klienten                                                |
| ------------------------------ | --------------------------------------------------------- |
| `POST /api/ask`                | `ask`, og samtale-id-en som svar på `createThread`        |
| `GET /api/conversations[/:id]` | `listThreads`, `getThread`                                |
| `GET /api/facets`              | `listFacets`, med feltnavnene fra `VITE_KA_FILTER_FIELDS` |
| `GET /api/capabilities`        | filtrene slås av når `filters` er `false`                 |
| 401 på et kall                 | til `/auth/login`, og tilbake til siden                   |

BFF-en svarer fra ett datasett, satt i dens egen `.env`
(`DIGDIR_DATASET_CONFIG_KEY`). `VITE_KA_DATASET_CONFIG_KEY` må være det samme,
for det er den klienten slår opp feltnavnene og korpusnavnet med. Det blir
ingen korpusvelger i bff-modus.

## Kjøre

BFF-en fra `src/` i sitt eget arbeidstre, på `:8788` med `AUTH_MODE=off`:

```sh
npm run start --workspace apps/server
```

Klienten i utvikling, med `/api` og `/auth` proxyet til `:8788`:

```sh
VITE_API_MODE=bff VITE_KA_DATASET_CONFIG_KEY=kudos-full VITE_KA_FILTER_FIELDS='kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer' npm run dev
```

Slik det skal kjøre, med klienten servert av BFF-en fra samme origin og under
dens CSP: bygg i bff-modus, og start BFF-en med `WEB_ROOT` pekt på `dist/`.
Stien under er hovedsjekkouten i paraplymappa; juster den hvis bygget ligger
et annet sted.

```sh
VITE_API_MODE=bff VITE_KA_DATASET_CONFIG_KEY=kudos-full VITE_KA_FILTER_FIELDS='kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer' npm run build
```

```sh
WEB_ROOT="$HOME/projects/kunnskapsassistenten/kunnskapsassistenten-frontend/dist" npm run start --workspace apps/server
```

BFF-en serverer bare `/assets/*` og `/favicon.ico` som filer; alt annet er
`index.html`. Derfor ligger fargetema-skriptet og favicon-en under `/assets/`
med hash, og derfor finnes ikke `/config.js` her: modus og korpus må bygges
inn.
