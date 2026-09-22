# Utrulling av testmiljøet

Én container: serveren holder API-nøkkelen, snakker med `digdir-headless-rag`
og serverer den bygde klienten fra samme origin. Samme origin er ikke
kosmetikk — backenden svarer på en CORS-preflight med 401 og sender ingen
CORS-hoder, så en nettleser kan ikke kalle den direkte uansett, og nøkkelen
skal uansett aldri dit.

**Ikke rullet ut ennå.** Alt under er skrevet og prøvd lokalt; første
utrulling gjør et menneske med Contributor på ressursgruppa. Bakgrunn og
avgjørelser: `design/plan-testmiljo-2026-09-22.md`.

## Hva som finnes

| Fil                 | Hva                                                            |
| ------------------- | -------------------------------------------------------------- |
| `server/`           | Serveren. Node uten rammeverk og uten avhengigheter.           |
| `Dockerfile`        | To steg: bygg med devDependencies, kjøretid uten node_modules. |
| `deploy/main.bicep` | Container App, miljø, logganalyse og managed identity.         |

Serveren gjør fire ting: proxyer `/api/*` til backenden med `X-API-Key` påsatt,
serverer `dist/` med SPA-fallback, svarer på `/healthz`, og skriver
`/config.js` med de variablene klienten skal lese.

## Modus og korpus uten å bygge på nytt

`vite build` baker `VITE_*` inn i bundelen, så et bilde ville ellers vært låst
til modusen det ble bygget i. Serveren skriver derfor `window.__KA_CONFIG__` i
`/config.js`, som klienten leser før bundelen kjører (`src/api/runtimeConfig.ts`).
Ett bilde, og modusen og korpuset er miljøvariabler.

| Variabel                     | Hva                                                      | Standard                |
| ---------------------------- | -------------------------------------------------------- | ----------------------- |
| `PORT`                       | Porten serveren lytter på.                               | `8787`                  |
| `KA_MODE`                    | `mock` eller `live`. Alt annet enn `live` er mock.       | `mock`                  |
| `DIGDIR_API_BASE`            | Backenden `/api/*` går til.                              | `http://localhost:8080` |
| `DIGDIR_API_KEY`             | Nøkkelen. Container Apps-secret, aldri i repoet.         | tom                     |
| `VITE_KA_TENANT`             | Tenant. Begge eller ingen, se under.                     | tom                     |
| `VITE_KA_DATASET_CONFIG_KEY` | Datasettnøkkel. `kudos` hostet, `default` lokalt.        | tom                     |
| `VITE_KA_DATASETS`           | Korpusene velgeren tilbyr: `nøkkel=Navn\|beskrivelse;…`. | tom                     |

`VITE_KA_TENANT` og `VITE_KA_DATASET_CONFIG_KEY` er **begge eller ingen**.
Backenden bygger datasett-scopet bare når den har begge, så én alene blir
forkastet der og svaret kommer fra standardkorpuset likevel — et halvt
oppsett ser ut som om det peker på pilotkorpuset og svarer fra demodataene.

## Bygge og rulle ut

`az acr build` laster opp arbeidstreet, så ingenting må pushes til GitHub
først.

```sh
git diff --quiet HEAD || { echo 'ucommittede endringer'; exit 1; }
SHA=$(git rev-parse --short HEAD)

az acr build --registry altinnaicontainers --image ka-frontend-test:$SHA .
az containerapp update -n ka-frontend-test -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-frontend-test:$SHA \
  --revision-suffix sha$SHA
```

Den gamle revisjonen svarer til den nye er frisk, så et dårlig bilde tar ikke
miljøet ned. Rull tilbake ved å rulle ut en eldre tagg.

## Bytte hemmelighet eller modus

```sh
# Nøkkelen.
az containerapp secret set -n ka-frontend-test -g rg-ka-app \
  --secrets digdir-api-key=<verdi>

# Modus: mock for demo, live for ekte spørsmål.
az containerapp update -n ka-frontend-test -g rg-ka-app \
  --set-env-vars KA_MODE=mock --revision-suffix mode$(date +%H%M%S)
```

`secret set` alene endrer ingenting som kjører: verdien plukkes opp av en ny
revisjon, som den andre kommandoen tvinger fram. Et modusbytte trenger ingen
ny bygging — `/config.js` skrives ved hver forespørsel og lagres aldri.

## Første gang

```sh
az deployment group create -g rg-ka-app --template-file deploy/main.bicep \
  --parameters image=altinnaicontainers.azurecr.io/ka-frontend-test:$SHA \
               acrLoginServer=altinnaicontainers.azurecr.io \
               digdirApiKey=<verdi>
```

Den **feiler første gang** på å hente bildet, og det er ventet: den managed
identityen finnes ikke før malen har laget den, og den har ingen rettigheter i
registeret før noen gir den dem. Gi dem, og kjør igjen:

```sh
az role assignment create --role AcrPull \
  --assignee-object-id "$(az identity show -n ka-frontend-test-id -g rg-ka-app --query principalId -o tsv)" \
  --assignee-principal-type ServicePrincipal \
  --scope "$(az acr show -n altinnaicontainers --query id -o tsv)"
```

Samme felle som Nikolai beskriver i `digdir/kunnskapsassistenten/src/deploy/README.md`.

## Prøve det lokalt før Azure

```sh
npm run build
KA_MODE=live DIGDIR_API_BASE=http://localhost:8080 DIGDIR_API_KEY=<verdi> npm start
```

Eller i container, mot stacken på maskinen:

```sh
docker build -t ka-frontend-test:local .
docker run --rm -p 8787:8787 \
  -e KA_MODE=live \
  -e DIGDIR_API_BASE=http://host.docker.internal:8080 \
  -e DIGDIR_API_KEY=<verdi> \
  -e VITE_KA_TENANT=demo -e VITE_KA_DATASET_CONFIG_KEY=norquad-docs \
  ka-frontend-test:local

curl -fsS localhost:8787/healthz   # {"ok":true,"mode":"live"}
```

`host.docker.internal` er hvordan containeren når stacken på maskinen, og den
virker under Colima — målt 22.09: containeren fikk svar med kilder fra
`localhost:8080` gjennom den. `localhost` inne i containeren er containeren
selv og treffer ingenting.

## Kjente grenser

**Spørsmål svarer ikke mot den hostede backenden.**
`test.rag.digdir.cloud` avviser `agent-rag-graph-bundled` med
`mode_not_allowed`, og det er agenten klienten spør. Målt av Nikolai med to
nøkler, så det er backendens oppsett og ikke et nøkkelomfang. Til Benjamin
åpner den, er `KA_MODE=mock` det som gir et miljø der noen kan se produktet;
alt annet enn selve svaret virker også i live: tråder, filter, korpusvelger og
opplasting i ærlig utilgjengelig-tilstand.

**Datasettnøkkelen er `kudos` hostet, ikke `default`.** Feil verdi feiler hvert
kall med «API key is not allowed to access the requested dataset», som leser
som et rettighetsproblem.

**Ingen innlogging i denne runden.** Adressen er intern på
`azurecontainerapps.io` og ingenting bak den er hemmelig, men det er heller
ingen dør. Innlogging er steg 5 i planen, og avgjøres med Nikolai:
Supabase-kode på e-post virker hos ham i dag, Entra venter på tenant-samtykke.
