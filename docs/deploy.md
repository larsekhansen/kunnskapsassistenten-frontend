# Utrulling av testmiljøet

Én container: serveren holder API-nøkkelen, snakker med `digdir-headless-rag`
og serverer den bygde klienten fra samme origin. Samme origin er ikke
kosmetikk — backenden svarer på en CORS-preflight med 401 og sender ingen
CORS-hoder, så en nettleser kan ikke kalle den direkte uansett, og nøkkelen
skal uansett aldri dit.

**Ikke rullet ut ennå.** Alt under er skrevet og prøvd lokalt. Engangsoppsettet
under [Første gang](#første-gang) gjør et menneske med rettigheter i Azure;
etter det ruller hver merge til `main` ut av seg selv. Bakgrunn og
avgjørelser: `design/plan-testmiljo-2026-09-22.md`.

Miljøet kjører **mock** som standard: svarene kommer fra fixturene i
`src/api/mock/`, ingen nøkkel er satt, og ingenting bak adressen kan
misbrukes. Se [Bytte mellom mock og live](#bytte-mellom-mock-og-live).

## Hva som finnes

| Fil                            | Hva                                                            |
| ------------------------------ | -------------------------------------------------------------- |
| `server/`                      | Serveren. Node uten rammeverk og uten avhengigheter.           |
| `Dockerfile`                   | To steg: bygg med devDependencies, kjøretid uten node_modules. |
| `deploy/main.bicep`            | Register, Container App, miljø, logganalyse og to identiteter  |
| `.github/workflows/deploy.yml` | Bygger, pusher og ruller ut ved hver push til `main`.          |
| `.github/workflows/ci.yml`     | Bygger og starter bildet på hver PR, uten å pushe.             |

Serveren gjør fire ting: proxyer `/api/*` til backenden med `X-API-Key` påsatt,
serverer `dist/` med SPA-fallback, svarer på `/healthz`, og skriver
`/config.js` med de variablene klienten skal lese.

## Slik rulles det ut

Merge til `main`, og `Deploy`-workflowen gjør resten:

1. bygger bildet og pusher det som `ka-frontend-test:<commit>` til vårt eget
   register;
2. peker appen på det med `az containerapp update`, som gir en ny revisjon
   `ka-frontend-test--sha<7 tegn>-<kjøring>-<forsøk>`;
3. spør `/healthz` på **den nye revisjonens** egen adresse, og feiler hvis den
   ikke svarer innen fem minutter;
4. skriver adressen i kjøringens sammendrag og under **Deployments → test** på
   repoets forside.

Den gamle revisjonen svarer til den nye er frisk, så et dårlig bilde tar ikke
miljøet ned. To merger rett etter hverandre ruller ut én om gangen, i rekkefølge
(`concurrency` i workflowen).

Hvor lang tid det tar: bildet bygges på ca. 30 sekunder (målt i CI på PR #166).
Pushing, ny revisjon og helsesjekk er ikke målt før første utrulling; regn med
noen minutter.

For hånd, uten ny commit: **Actions → Deploy → Run workflow**, eller
`gh workflow run deploy.yml`.

Før engangsoppsettet er gjort, hopper workflowen over med meldingen «Ingen
utrulling» og står grønn, så `main` ikke blir rød av et miljø som ikke finnes.

## Første gang

Oppskriften kjøres ovenfra og ned, i ett skall, fra repo-rota. Alt havner i
`rg-ka-app`, også registeret bildene ligger i; se
[Hvorfor eget register](#hvorfor-eget-register). Bytt verdiene i steg 0 hvis
det blir andre.

### Rettigheter du trenger først

| Hva                                                                                                             | Hvor                      | Steg |
| --------------------------------------------------------------------------------------------------------------- | ------------------------- | ---- |
| Contributor (eller Owner)                                                                                       | ressursgruppa `rg-ka-app` | 1, 5 |
| Owner, User Access Administrator eller Role Based Access Control Administrator                                  | ressursgruppa `rg-ka-app` | 2, 6 |
| Admin i repoet (for variablene)                                                                                 | GitHub                    | 3    |
| `Microsoft.App`, `Microsoft.OperationalInsights` og `Microsoft.ContainerRegistry` registrert (sjekkes i steg 0) | abonnementet              | 0    |

Ingen rettigheter i `altinnaicontainers` eller andre steder utenfor
ressursgruppa. Steg 2 og 6 er de eneste som krever rett til å gi roller. Har du
den ikke, kan noen som har den kjøre akkurat de to stegene; kommandoene står
ferdige. Er Contributor bak PIM, aktiver den før du begynner.

Står ikke `Altinn-AI-Assistant` i `az account list --refresh -o table`, har du
ingen rolle i abonnementet ennå, og steg 0 stopper på `az account set`. Da må
noen med tilgang gi deg Contributor på `rg-ka-app`, eller kjøre oppskriften.

### Steg 0: verdiene, og en sjekk

```sh
SUB=Altinn-AI-Assistant
RG=rg-ka-app
APP=ka-frontend-test
REPO=larsekhansen/kunnskapsassistenten-frontend

# Velg abonnementet selv. Alt under skriver dit az peker, og standardvalget
# kan være et helt annet team sitt, målt 28.09 hos Lars: dis-core-prod.
az account set --subscription "$SUB"
az account show --query '{abonnement:name, id:id}' -o table    # må være $SUB, ellers stopp her
az extension add --name containerapp --upgrade --only-show-errors
for provider in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry; do
  echo "$provider $(az provider show -n $provider --query registrationState -o tsv)"   # Registered
done
az group show -n $RG --query location -o tsv    # finnes ikke? az group create -n $RG -l <region>
```

Steg 4 og 7 starter `Deploy` og venter på den. Denne funksjonen gjør det, og den
venter på **akkurat den kjøringen den startet**. `gh run list -L 1` rett etter
`gh workflow run` kan ellers treffe forrige kjøring, som etter hver merge er en
som hoppet over og står grønn. Den sammenligner kjøringens ID og ikke
tidspunkt: GitHub gir kjøringer stigende ID-er, så klokka på maskinen spiller
ingen rolle.

```sh
deploy_and_watch() {
  before=$(gh run list -R $REPO -w deploy.yml --event workflow_dispatch -L 1 --json databaseId -q '.[0].databaseId // 0')
  gh workflow run deploy.yml -R $REPO --ref main
  RUN=$before
  for _ in $(seq 1 40); do
    sleep 3
    RUN=$(gh run list -R $REPO -w deploy.yml --event workflow_dispatch -L 1 --json databaseId -q '.[0].databaseId // 0')
    [ "$RUN" -gt "$before" ] && break
  done
  [ "$RUN" -gt "$before" ] || { echo "Fant ingen ny Deploy-kjøring etter 40 forsøk."; return 1; }
  gh run watch -R $REPO "$RUN" --exit-status
}
```

### Steg 1: grunnmuren

Uten `imageTag` lager malen registeret, miljøet, loggene og de to
identitetene, men ingen app. Da kan rollene gis før appen prøver å hente et
bilde.

```sh
az deployment group create -g $RG -n ka-frontend-grunnmur \
  --template-file deploy/main.bicep --parameters name=$APP githubRepository=$REPO

ACR=$(az deployment group show -g $RG -n ka-frontend-grunnmur --query properties.outputs.registryName.value -o tsv)
ACR_ID=$(az acr show -n $ACR -g $RG --query id -o tsv)
RUNTIME_ID=$(az identity show -n $APP-id -g $RG --query principalId -o tsv)
DEPLOY_ID=$(az identity show -n $APP-deploy -g $RG --query principalId -o tsv)
DEPLOY_CLIENT_ID=$(az identity show -n $APP-deploy -g $RG --query clientId -o tsv)
```

`$APP-deploy` har en federert legitimasjon for
`repo:$REPO:ref:refs/heads/main`: bare en kjøring fra `main` i dette repoet kan
logge inn som den, og det ligger ingen hemmelighet noe sted.

### Steg 2: roller i registeret (krever rett til å gi roller)

Registeret er vårt eget, så begge rollene gjelder bare våre bilder.

```sh
# Appen henter bildet.
az role assignment create --role AcrPull --scope "$ACR_ID" \
  --assignee-object-id "$RUNTIME_ID" --assignee-principal-type ServicePrincipal

# GitHub pusher bildet.
az role assignment create --role AcrPush --scope "$ACR_ID" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal
```

En rolle kan bruke noen minutter på å slå inn. Vent litt før steg 4.

### Steg 3: variablene i GitHub

Ingen av dem er hemmelige, derfor variabler og ikke secrets.

```sh
gh variable set AZURE_CLIENT_ID       -R $REPO --body "$DEPLOY_CLIENT_ID"
gh variable set AZURE_TENANT_ID       -R $REPO --body "$(az account show --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID -R $REPO --body "$(az account show --query id -o tsv)"
gh variable set KA_REGISTRY           -R $REPO --body "$ACR"
```

Bare hvis du brukte andre navn i steg 0 (standardverdiene står i workflowen):

```sh
gh variable set KA_RESOURCE_GROUP -R $REPO --body "$RG"
gh variable set KA_APP_NAME       -R $REPO --body "$APP"
```

### Steg 4: første bilde, fra GitHub

```sh
deploy_and_watch
```

Denne kjøringen **blir rød, og det er ventet**: bildet pushes, men appen finnes
ikke ennå. Feilmeldingen «Appen finnes ikke» sier hvilken tagg den pushet.

```sh
# Commiten akkurat denne kjøringen bygde, ikke din lokale main, som kan være eldre.
TAG=$(gh run view -R $REPO "$RUN" --json headSha -q .headSha)
```

### Steg 5: appen

```sh
az deployment group create -g $RG -n ka-frontend-app \
  --template-file deploy/main.bicep --parameters name=$APP githubRepository=$REPO imageTag=$TAG \
  --query properties.outputs.fqdn.value -o tsv
```

Siste linje er adressen. Mock, ingen nøkkel.

### Steg 6: roller på appen (krever rett til å gi roller)

```sh
# GitHub oppdaterer appen, og bare den.
az role assignment create --role Contributor \
  --scope "$(az containerapp show -n $APP -g $RG --query id -o tsv)" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal

# En oppdatering av en app med egen identitet krever også rett til å «tildele»
# den identiteten, selv når den ikke endres.
az role assignment create --role "Managed Identity Operator" \
  --scope "$(az identity show -n $APP-id -g $RG --query id -o tsv)" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal
```

Contributor på appen og ikke på ressursgruppa: `rg-ka-app` kan ha andre ting i
seg, og utrullingen trenger ikke røre dem.

### Steg 7: en ekte utrulling, og adressen på forsiden

```sh
deploy_and_watch
gh repo edit $REPO --homepage "https://$(az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)"
```

Kjøringen blir grønn, og adressen står i sammendraget og under **Deployments →
test**. Den andre linja legger den også øverst på repoets forside, under
«About», der `docs/kom-i-gang.md` sier at den står.

### Når repoet flyttes til digdir

Den federerte legitimasjonen gjelder bare `repo:larsekhansen/kunnskapsassistenten-frontend:ref:refs/heads/main`.
Den dagen repoet flyttes, slutter utrullingen å kunne logge inn. Kjør steg 1 på
nytt med det nye navnet (`REPO=digdir/<navn>`), og sett variablene i steg 3 i
det nye repoet. Resten står.

## Hvorfor eget register

Bildene ligger i et register malen lager i `rg-ka-app`, og ikke i det delte
`altinnaicontainers`. Der bygger også Nikolais `ka-app`, og `AcrPush` gjelder
hele registeret den gis på: en kjøring fra `main` her kunne da ha overskrevet
bildene hans. Utrullingen skal bare kunne skrive til sine egne.

Alternativene, og hvorfor de ikke ble valgt:

- **Rettigheter per repository i `altinnaicontainers`** (ABAC, rollen
  `Container Registry Repository Writer` med en betingelse på
  `ka-frontend-test`). Da må registeret slås over til ABAC-modus, og i den
  modusen gjelder ikke `AcrPull` og `AcrPush`
  ([Microsofts dokumentasjon](https://learn.microsoft.com/azure/container-registry/container-registry-rbac-abac-repository-permissions)).
  `ka-app` ville mistet rollen den henter bildene sine med, til noen ga den nye.
- **Token med scope map.** Kan begrenses til ett repository, men er et passord,
  og det måtte ligget som hemmelighet i GitHub. Hele utrullingen er bygget for
  å klare seg uten.

Prisen, fra Azures offentlige prisliste for Norway East 28.09: Basic koster
0,1666 USD per dag, altså ca. 5 USD i måneden, med 10 GiB lagring inkludert og
0,10 USD per GB i måneden utover det. Basic har Entra-innlogging, som er alt
utrullingen bruker ([SKU-oversikten](https://learn.microsoft.com/azure/container-registry/container-registry-skus)).
Hvert nytt bilde legger bare til de lagene som endrer seg, målt til ca. 2 MB
(klienten og serveren; Node-laget på ca. 60 MB lagres én gang), så 10 GiB
holder lenge.

Malen låser registeret til den klassiske rollemodusen. Microsoft skal gjøre
ABAC til standard for nye registre, og da ville `AcrPull` og `AcrPush` i steg 2
ikke virket. ABAC gir heller ikke noe her, der registeret bare har våre egne
bilder.

Registerets navn er `kafrontend` pluss en verdi avledet av ressursgruppa, fordi
navnet må være unikt i hele Azure. Det står i utdataene fra steg 1 og i
GitHub-variabelen `KA_REGISTRY`.

## Verdiene i et nytt skall

Kommandoene fra og med her bruker de samme variablene som oppskriften. I et
skall der den ikke er kjørt, hentes de slik; registernavnet ligger i
GitHub-variabelen fra steg 3.

```sh
RG=rg-ka-app
APP=ka-frontend-test
REPO=larsekhansen/kunnskapsassistenten-frontend
ACR=$(gh variable get KA_REGISTRY -R $REPO)
```

## Rulle tilbake

- **Enklest, og uten Azure:** åpne den mergede PR-en på GitHub og trykk
  **Revert**. Det gir en ny PR som angrer endringen; merge den, så rulles den
  gamle versjonen ut som en hvilken som helst annen.
- **Raskere, uten ny PR:** åpne en eldre, grønn kjøring under **Actions →
  Deploy** og velg **Re-run all jobs**. En omkjøring bygger den commiten den
  gjaldt, og ruller den ut. Neste merge ruller ut `main` igjen.
- **Fra kommandolinja:** et eldre bilde, med en ny revisjon.

  ```sh
  az containerapp update -n $APP -g $RG \
    --image $ACR.azurecr.io/$APP:<commit> --revision-suffix rollback$(date +%H%M%S)
  ```

## Logger

```sh
az containerapp logs show -n $APP -g $RG --follow --tail 100    # serverens egne linjer
az containerapp logs show -n $APP -g $RG --type system          # plattformen: henting, oppstart, prober
az containerapp revision list -n $APP -g $RG -o table           # hvilke revisjoner som finnes og kjører
```

I portalen: appen → **Log stream**. Utrullingens egen logg er kjøringen under
**Actions → Deploy**.

## Modus og korpus uten å bygge på nytt

`vite build` baker `VITE_*` inn i bundelen, så et bilde ville ellers vært låst
til modusen det ble bygget i. Serveren skriver derfor `window.__KA_CONFIG__` i
`/config.js`, som klienten leser før bundelen kjører (`src/api/runtimeConfig.ts`).
Ett bilde, og modusen og korpuset er miljøvariabler.

| Variabel                     | Hva                                                       | Standard                |
| ---------------------------- | --------------------------------------------------------- | ----------------------- |
| `PORT`                       | Porten serveren lytter på.                                | `8787`                  |
| `KA_MODE`                    | `mock` eller `live`. Alt annet enn `live` er mock.        | `mock`                  |
| `DIGDIR_API_BASE`            | Backenden `/api/*` går til.                               | `http://localhost:8080` |
| `DIGDIR_API_KEY`             | Nøkkelen. Container Apps-secret, aldri i repoet.          | tom                     |
| `VITE_KA_TENANT`             | Tenant. Begge eller ingen, se under.                      | tom                     |
| `VITE_KA_DATASET_CONFIG_KEY` | Datasettnøkkel. `kudos` hostet, `default` lokalt.         | tom                     |
| `VITE_KA_DATASETS`           | Korpusene velgeren tilbyr: `nøkkel=Navn\|beskrivelse;…`.  | tom                     |
| `VITE_KA_FILTER_FIELDS`      | Feltnavn per datasett: `datasett=dimensjon:felt:type\|…`. | tom                     |

`VITE_KA_FILTER_FIELDS` sier hva hvert korpus kaller filterdimensjonene
`documentType`, `organisation` og `year`, så feltnavna ikke står i koden. En
dimensjon uten oppføring filtreres det ikke på. Se README, «Hva korpuset
kaller filterdimensjonene».

`VITE_KA_TENANT` og `VITE_KA_DATASET_CONFIG_KEY` er **begge eller ingen**.
Backenden bygger datasett-scopet bare når den har begge, så én alene blir
forkastet der og svaret kommer fra standardkorpuset likevel — et halvt
oppsett ser ut som om det peker på pilotkorpuset og svarer fra demodataene.

## Bytte mellom mock og live

**Ikke slå på live på denne adressen før det finnes innlogging.** I live setter
serveren nøkkelen på hvert kall, for hvem som helst som har adressen. I mock
finnes det ingen nøkkel å misbruke. Live bak innlogging er en egen runde.

Når den tid kommer:

```sh
# Nøkkelen, som secret. Første gang lager dette secreten.
az containerapp secret set -n $APP -g $RG --secrets digdir-api-key=<verdi>

# Modus og nøkkel inn i en ny revisjon.
az containerapp update -n $APP -g $RG \
  --set-env-vars KA_MODE=live DIGDIR_API_KEY=secretref:digdir-api-key \
  --revision-suffix live$(date +%H%M%S)

# Tilbake til mock.
az containerapp update -n $APP -g $RG \
  --set-env-vars KA_MODE=mock --revision-suffix mock$(date +%H%M%S)
```

`secret set` alene endrer ingenting som kjører: verdien plukkes opp av en ny
revisjon, som `update` tvinger fram. Et modusbytte trenger ingen ny bygging —
`/config.js` skrives ved hver forespørsel og lagres aldri.

**Kjør ikke malen på nytt med en gammel `imageTag` for å bytte modus.** Den
setter bildet til den taggen, og da ruller du tilbake til den versjonen. Må den
kjøres igjen, gi den taggen som kjører nå:

```sh
TAG=$(az containerapp show -n $APP -g $RG --query 'properties.template.containers[0].image' -o tsv | cut -d: -f2)
```

Uten `imageTag` rører malen ikke appen i det hele tatt, bare grunnmuren.

Uten `digdirApiKey` utelater malen både secreten og variabelen. Det er ikke
målt om Container Apps godtar en secret med tom verdi; utelatt virker uansett.

## Bygge og rulle ut for hånd

For når GitHub ikke er et alternativ. `az acr build` laster opp arbeidstreet
og bygger i registeret, så ingenting må pushes først. Contributor på
ressursgruppa holder, siden registeret ligger der.

```sh
git diff --quiet HEAD || { echo 'ucommittede endringer'; exit 1; }
SHA=$(git rev-parse HEAD)

az acr build --registry $ACR --image $APP:$SHA .
az containerapp update -n $APP -g $RG \
  --image $ACR.azurecr.io/$APP:$SHA --revision-suffix hand${SHA:0:7}
```

## Prøve det lokalt før Azure

```sh
npm run build
KA_MODE=live DIGDIR_API_BASE=http://localhost:8080 DIGDIR_API_KEY=<verdi> npm start
```

Eller i container. I mock, som testmiljøet:

```sh
docker build -t ka-frontend-test:local .
docker run --rm -p 8787:8787 -e KA_MODE=mock ka-frontend-test:local
curl -fsS localhost:8787/healthz   # {"ok":true,"mode":"mock"}
```

Mot stacken på maskinen:

```sh
docker run --rm -p 8787:8787 \
  -e KA_MODE=live \
  -e DIGDIR_API_BASE=http://host.docker.internal:8080 \
  -e DIGDIR_API_KEY=<verdi> \
  -e VITE_KA_TENANT=demo -e VITE_KA_DATASET_CONFIG_KEY=norquad-docs \
  ka-frontend-test:local
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

**Hvem som helst med skrivetilgang til `main` ruller ut.** Det er poenget, men
det betyr også at en PR som er merget uten grønn CI, går rett ut. Den gamle
revisjonen står til den nye svarer på `/healthz`, men `/healthz` vet ikke om
siden ser riktig ut.
