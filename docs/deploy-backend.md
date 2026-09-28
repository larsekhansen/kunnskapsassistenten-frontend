# Egen backend i testmiljøet

Testmiljøets frontend spør vår egen `digdir-headless-rag` i Azure Container
Apps, med samme bilde og samme korpus som lokalt: grenen
`fix/mcp-retrieve-filter-by`, tenant `kudos` og datasett `kudos-full` mot
Benjamins Typesense. Backenden har bare intern adresse, og databasen ligger på
en Azure Files-deling. Malen er `deploy/rag.bicep`.

**Ikke rullet ut.** Ingen `az`-kommando her er kjørt mot Azure. Oppsettet er
prøvd lokalt i samme form 28.09, med seed-jobb, backend og frontend som egne
containere på et eget nettverk; se [Prøve det lokalt](#prøve-det-lokalt) og
[Det som ikke er målt](#det-som-ikke-er-målt).

`test.rag.digdir.cloud` svarer ikke med agentene (`mode_not_allowed`) og tar
ikke imot filteret, og det er Benjamins oppsett og kode. Derfor en egen backend.

## Hva som lages

I `rg-ka-test`, i miljøet `ka-frontend-test-env` som `deploy/main.bicep` laget:

| Ressurs                | Hva                                                                  |
| ---------------------- | -------------------------------------------------------------------- |
| `karag<suffiks>`       | Lagringskonto, Standard LRS, bare for delingen.                      |
| `ka-rag-db`            | Azure Files-deling (SMB), montert på `/var/lib/digdir`.              |
| `ka-rag-db` i miljøet  | Miljøets kobling til delingen, med kontonøkkelen.                    |
| `ka-rag-test-seed`     | Container Apps-jobb, manuell. Seeder tenanten og datasettet.         |
| `ka-rag-test`          | Backenden. Intern ingress på port 8080, én replika, 2 vCPU og 4 GiB. |
| `ka-rag-test:<commit>` | Bildet, i registeret frontenden også bruker.                         |

Utenfor Azure, som lokalt: Benjamins Typesense, Azure OpenAI (`gpt-5.6-terra`)
og ColBERT.

## Før du begynner

- **Grunnmuren fra `docs/deploy.md`**: steg 1–3 der er kjørt, så miljøet,
  registeret, identiteten `ka-frontend-test-id` med `AcrPull` og
  GitHub-variabelen `KA_REGISTRY` finnes.
- **Innlogging foran frontenden** før steg 7. Uten den kan alle med adressen
  bruke tjenesten på vår modellkostnad, og tynnserveren sender `X-User-Id`
  videre slik nettleseren satte den.
- **Contributor på `rg-ka-test`** holder. Det trengs ingen nye
  rolletildelinger: appen og jobben henter bildet med `ka-frontend-test-id`,
  som alt har `AcrPull`, og delingen monteres med kontonøkkelen.
- **På maskinen:** headless-rag-checkouten med `.env` (Azure OpenAI-verdiene)
  og `.env.benjamin` (Typesense og ColBERT), og grenen pushet. `git`,
  `openssl` og `gh`.

Kommandoene kjøres ovenfra og ned, i ett skall, fra rota i dette repoet. Hver
`az`-kommando har `--subscription "$SUB"`, og ingen blokk har kommentarer; se
«Steg 0» i `docs/deploy.md` for hvorfor.

## Steg 0: verdiene, og en sjekk

```sh
SUB=Altinn-AI-Assistant
RG=rg-ka-test
FRONTEND=ka-frontend-test
RAG_APP=ka-rag-test
REPO=larsekhansen/kunnskapsassistenten-frontend
RAG="$HOME/projects/kunnskapsassistenten/digdir-headless-rag"
BRANCH=fix/mcp-retrieve-filter-by
ACR=$(gh variable get KA_REGISTRY -R $REPO)

az account show --subscription "$SUB" --query name -o tsv
az provider show --subscription "$SUB" -n Microsoft.Storage --query registrationState -o tsv
az containerapp env show --subscription "$SUB" -g $RG -n $FRONTEND-env --query properties.provisioningState -o tsv
az acr show --subscription "$SUB" -g $RG -n "$ACR" --query loginServer -o tsv
```

Linjene skal vise `Altinn-AI-Assistant`, `Registered`, `Succeeded` og
registerets adresse.

## Steg 1: bildet

```sh
git -C "$RAG" fetch origin "$BRANCH"
SHA=$(git -C "$RAG" rev-parse FETCH_HEAD)
SRC=$(mktemp -d)
git -C "$RAG" archive "$SHA" | tar -x -C "$SRC"
az acr build --subscription "$SUB" --registry "$ACR" --image "$RAG_APP:$SHA" \
  --file server.Dockerfile --build-arg VERSION="$SHA" "$SRC"
```

Bildet bygges fra en `git archive` av commiten, ikke fra repo-mappa.
headless-rag har ingen `.dockerignore`, så `az acr build` fra mappa ville
lastet opp `.env` og `.env.benjamin` til byggetjenesten. Arkivet har bare det
som er committet (84 MB for `a836b91`), og samme mappe gir seed-skriptet i
steg 4, fra samme commit.

`VERSION` er det samme headless-rags egen `deploy.yml` sender med, og gjør at
commiten står i serverens diagnosepanel. Lokalt tar bygget om lag ti minutter.
I registeret er det ikke målt.

## Steg 2: hemmelighetene, uten å vise dem

### 2a: fra filene

`value` leser verdien etter `navn =` inn i en variabel og skriver ingenting
ut. Navnene i `.env.benjamin` er backendens config-stier, som i
`scripts/kudos-full/seed.sh`; de nakne `url` og `key` er ColBERT.

```sh
value() {
  sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//p" "$1" | head -n 1 | sed 's/[[:space:]]*$//; s/^"\(.*\)"$/\1/'
}
B="$RAG/.env.benjamin"
E="$RAG/.env"
TYPESENSE_API_HOST=$(value "$B" 'services\.typesense\.api-host')
TYPESENSE_API_TLS=$(value "$B" 'services\.typesense\.api-tls')
TYPESENSE_API_KEY_ADMIN=$(value "$B" 'services\.typesense\.api-key-admin')
KUDOS_COLLECTION_PREFIX=$(value "$B" 'pipeline\.storage\.collection-prefix')
KUDOS_DOCS_COLLECTION=$(value "$B" 'pipeline\.storage\.docs-collection')
KUDOS_CHUNKS_COLLECTION=$(value "$B" 'pipeline\.storage\.chunks-collection')
KUDOS_PHRASES_COLLECTION=$(value "$B" 'pipeline\.storage\.phrases-collection')
COLBERT_API_URL=$(value "$B" url)
COLBERT_API_KEY=$(value "$B" key)
AZURE_OPENAI_API_ENDPOINT=$(value "$E" AZURE_OPENAI_API_ENDPOINT)
AZURE_OPENAI_DEPLOYMENT_NAME=$(value "$E" AZURE_OPENAI_DEPLOYMENT_NAME)
AZURE_OPENAI_API_KEY=$(value "$E" AZURE_OPENAI_API_KEY)
```

### 2b: nye, bare første gang

Databasen er ny, så `CONFIG_MASTER_KEY` og `JWT_SECRET` er det også.
`KA_KEY` er nøkkelen frontenden bruker, i formatet backenden lager selv:
`rag_` og 64 heksadesimale tegn.

**Kjør aldri 2b mot en database som alt er seedet.** Tjenestenøklene i
config-databasen er kryptert med `CONFIG_MASTER_KEY`, og med en ny verdi kan de
ikke leses igjen. Etter første gang hentes de tre fra Azure; se
[Et nytt skall, eller et nytt bilde](#et-nytt-skall-eller-et-nytt-bilde).

```sh
CONFIG_MASTER_KEY=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
KA_KEY="rag_$(openssl rand -hex 32)"
```

### Sjekken

Lengden på hver, ikke verdien. Alle skal være over 0, og `KA_KEY` skal ha 68.

```sh
for v in TYPESENSE_API_HOST TYPESENSE_API_TLS TYPESENSE_API_KEY_ADMIN KUDOS_COLLECTION_PREFIX KUDOS_DOCS_COLLECTION KUDOS_CHUNKS_COLLECTION KUDOS_PHRASES_COLLECTION COLBERT_API_URL COLBERT_API_KEY AZURE_OPENAI_API_ENDPOINT AZURE_OPENAI_DEPLOYMENT_NAME AZURE_OPENAI_API_KEY CONFIG_MASTER_KEY JWT_SECRET KA_KEY; do
  eval "echo $v \${#$v}"
done
```

## Steg 3: lagringen og seed-jobben

Samme funksjon brukes i steg 6. Verdiene står på kommandolinja til `az` mens
den kjører, som med `secret set` i `docs/deploy.md`; de vises ikke og havner
ikke i historikken, der bare variabelnavnene står. Malen tar dem som
`@secure()`, så de lagres ikke i utrullingshistorikken.

```sh
rag_deploy() {
  az deployment group create --subscription "$SUB" -g $RG -n ka-rag-$1 \
    --template-file deploy/rag.bicep \
    --parameters name=$RAG_APP registryName="$ACR" imageTag="$SHA" withApp=$2 \
      typesenseHost="$TYPESENSE_API_HOST" typesenseTls="$TYPESENSE_API_TLS" \
      collectionPrefix="$KUDOS_COLLECTION_PREFIX" docsCollection="$KUDOS_DOCS_COLLECTION" \
      chunksCollection="$KUDOS_CHUNKS_COLLECTION" phrasesCollection="$KUDOS_PHRASES_COLLECTION" \
      colbertApiUrl="$COLBERT_API_URL" azureOpenAiEndpoint="$AZURE_OPENAI_API_ENDPOINT" \
      azureOpenAiDeployment="$AZURE_OPENAI_DEPLOYMENT_NAME" \
      configMasterKey="$CONFIG_MASTER_KEY" jwtSecret="$JWT_SECRET" apiKey="$KA_KEY" \
      azureOpenAiApiKey="$AZURE_OPENAI_API_KEY" typesenseApiKeyAdmin="$TYPESENSE_API_KEY_ADMIN" \
      colbertApiKey="$COLBERT_API_KEY" \
    --query properties.outputs -o json
}
rag_deploy grunnmur false
```

Uten `withApp` lager malen lagringskontoen, delingen, miljøets kobling til den
og jobben, men ingen app. Jobben startes ikke av seg selv.

## Steg 4: seed-skriptet på delingen

`scripts/kudos-full/seed.clj` er ikke i bildet: `server.Dockerfile` kopierer
bare `server/`. Jobben kjører det fra delingen, fra samme commit som bildet.
Kontonøkkelen går til `az` som miljøvariabel for akkurat den ene kommandoen.

```sh
STORAGE=$(az deployment group show --subscription "$SUB" -g $RG -n ka-rag-grunnmur --query properties.outputs.storageAccountName.value -o tsv)
AZURE_STORAGE_KEY=$(az storage account keys list --subscription "$SUB" -g $RG -n "$STORAGE" --query '[0].value' -o tsv) \
  az storage file upload --subscription "$SUB" --account-name "$STORAGE" --share-name ka-rag-db \
    --source "$SRC/scripts/kudos-full/seed.clj" --path seed-kudos-full.clj
```

## Steg 5: seeding

Jobben kjører `seed-kudos-full.clj` bak headless-rags egen vakt
(`refuse-if-server-running!`). Den avslutter med 1 hvis appen svarer på `/up`
på `ka-rag-test:80`, fordi en seeding mens serveren har databasen åpen, melder
suksess og mister skrivingen (headless-rag #493). Første gang finnes ikke
appen, og vakta slipper gjennom.

`seed_and_watch` starter jobben og venter på akkurat den kjøringen.

```sh
seed_and_watch() {
  EXEC=$(az containerapp job start --subscription "$SUB" -g $RG -n $RAG_APP-seed --query name -o tsv) || return 1
  for _ in $(seq 1 45); do
    STATUS=$(az containerapp job execution show --subscription "$SUB" -g $RG -n $RAG_APP-seed --job-execution-name "$EXEC" --query properties.status -o tsv)
    echo "$EXEC $STATUS"
    case "$STATUS" in
      Succeeded) return 0 ;;
      Failed|Stopped|Degraded) return 1 ;;
    esac
    sleep 20
  done
  return 1
}
seed_and_watch
```

`Succeeded` betyr at skriptet avsluttet med 0, og det gjør det bare når
frasesøket mot Kudos til slutt gir treff. Lokalt tok jobben 34 sekunder mot en
tom database og ga 20 treff. I Azure kommer hentingen av bildet på ca. 1 GB i
tillegg.

Loggen, hvis den feilet (ikke prøvd etter at kjøringen er ferdig; portalen har
den under jobben → **Execution history**):

```sh
az containerapp job logs show --subscription "$SUB" -g $RG -n $RAG_APP-seed --container seed --execution "$EXEC" --format text --tail 100
```

## Steg 6: backenden

```sh
rag_deploy app true
az containerapp logs show --subscription "$SUB" -g $RG -n $RAG_APP --format text --tail 100 | grep -E "e2e/seeded|Started oejs.Server"
```

Første gang skal linja med `e2e/seeded` vise `:agents-after 8` og
`:api-key-existed? false`: oppstarten har lagt inn agentene og nøkkelen. Ved
senere oppstarter står det `true`.

Oppstartsproben venter i inntil 130 sekunder på `/up`. Lokalt, med 2 CPU og
4 GiB som her, svarte den etter 44 sekunder.

## Steg 7: frontenden peker på backenden

Først når innloggingen står foran frontenden. Nøkkelen blir secret, og modus,
adresse og korpus settes i en ny revisjon:

```sh
az containerapp secret set --subscription "$SUB" -n $FRONTEND -g $RG --secrets digdir-api-key="$KA_KEY"
az containerapp update --subscription "$SUB" -n $FRONTEND -g $RG \
  --set-env-vars KA_MODE=live DIGDIR_API_BASE=http://$RAG_APP DIGDIR_API_KEY=secretref:digdir-api-key \
    VITE_KA_TENANT=kudos VITE_KA_DATASET_CONFIG_KEY=kudos-full \
    "VITE_KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no" \
    "VITE_KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer" \
  --revision-suffix rag$(date +%H%M%S)
az containerapp show --subscription "$SUB" -n $FRONTEND -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

`http://ka-rag-test` er appens navn inne i miljøet; adressen finnes ikke
utenfra. Åpne frontendens adresse, logg inn og still et spørsmål. Et svar tar
fra 16 til 80 sekunder.

**Kjøres `main.bicep` på nytt, må den få de samme verdiene**, ellers setter den
frontenden tilbake til mock mot `test.rag.digdir.cloud`: `kaMode=live`,
`digdirApiBase=http://ka-rag-test`, `tenant=kudos`,
`datasetConfigKey=kudos-full`, `datasets` og `filterFields` som over, og
`digdirApiKey="$KA_KEY"`. `filterFields` må ha nøkkelen `kudos-full`, ikke
`kudos` som i standardverdien.

At tråden overlever en omstart av backenden:

```sh
az containerapp revision restart --subscription "$SUB" -g $RG -n $RAG_APP \
  --revision "$(az containerapp show --subscription "$SUB" -g $RG -n $RAG_APP --query properties.latestRevisionName -o tsv)"
```

Last tråden på nytt når omstarten er ferdig. Spørsmålet og svaret står der;
kildene lagres ikke med samtalen, og det sier frontenden selv.

## Nøkkelen

Backenden lager ingen nøkkel av seg selv. Det finnes to veier i koden:
konsollet (`digdir.config.api-keys/create-api-key!`, bak admin-innlogging), og
oppstartskroken `digdir.e2e.seed/maybe-seed!`. Oppsettet her bruker kroken,
som er det lokal kjøring også gjør:

- Når `E2E_API_KEY` er satt, gjør hver oppstart tre ting: legger inn de
  innebygde agentene og to testagenter (8 i alt), lagrer akkurat denne verdien som API-nøkkel hvis den
  ikke finnes, og registrerer tenanten i `TENANT`. Uten variabelen gjør den
  ingenting.
- Nøkkelen lagres som SHA-256 av verdien, ikke som klartekst, med navnet
  `e2e-harness` og scope `query`.
- **Hva den får:** alle kall under `/api/*` og `/v1/*` som krever en gyldig
  nøkkel. Den har
  ingen grense for tenant, datasett, agent eller modus, og for MCP betyr tom
  grense ingen grense (`digdir.mcp.tools`, merknaden om `:dataset-scopes`).
  Databasen her har bare tenanten `kudos`, så i praksis er det Kudos-korpuset.
  Den har verken `ingest` eller `admin`.
- **Hvem sine tråder:** nøkkelen er ikke knyttet til en bruker. `/api/conversations`
  skiller brukerne på `X-User-Id`, som den som har nøkkelen setter selv. Derfor
  må tynnserveren sette den fra innloggingen, ikke fra nettleseren.
- **Den offentlige nøkkelen virker ikke her.** Standardverdien i
  `docker-compose.newcomer.yml` er ikke i denne databasen. Målt lokalt:
  `/api/conversations` gir 200 med den nye nøkkelen og 401 med den offentlige.
- **Bytte nøkkel:** ny verdi i begge secrets (`api-key` på backenden og
  `digdir-api-key` på frontenden), så en ny revisjon av begge. **Den gamle
  nøkkelen virker fortsatt**: kroken legger til, den trekker ikke tilbake.
  Tilbaketrekking går via konsollet, og det krever en admin-bruker, som dette
  oppsettet ikke har.

En nøkkel låst til `kudos/kudos-full` går an: `store-api-key` tar
`:dataset-scopes`. Det krever egen kode i seed-jobben i stedet for kroken, og
er ikke gjort.

## Databasen på Azure Files

- **Én skriver.** Datahike på fil tåler én prosess med databasen åpen. Derfor
  én replika, og seed-jobben bare mens appen står stille. Vakta i steg 5 sjekker
  det; lokalt nektet den med «a server is already answering /up at
  ka-rag-test:8080» og exit 1.
- **Nye revisjoner overlapper.** En ny revisjon av `ka-rag-test` (nytt bilde,
  ny variabel, ny secret) startes før den gamle stoppes, så to JVM-er har
  databasen åpen en liten stund. Hva Datahike gjør da, er ikke målt. Ta et
  øyeblikksbilde av delingen først:

  ```sh
  AZURE_STORAGE_KEY=$(az storage account keys list --subscription "$SUB" -g $RG -n "$STORAGE" --query '[0].value' -o tsv) \
    az storage share snapshot --subscription "$SUB" --account-name "$STORAGE" --name ka-rag-db
  ```

  Om en omstart av samme revisjon (steg 7) også overlapper, er ikke målt.

- **Størrelse:** 12,5 MB i 1 472 filer etter seeding og én tråd (målt lokalt).
  Kvoten er 10 GiB. En slettet deling kan hentes tilbake i sju dager.
- **SMB, ikke NFS.** NFS krever et miljø i eget virtuelt nettverk, og det har
  ikke miljøet fra `main.bicep`. Hvor raskt Datahike skriver mange små filer
  over SMB, er ikke målt.
- **Frasehurtigbufferen** (`/app/cache`) er ikke på delingen. Den brukes når et
  korpus lastes inn, og Kudos er ferdig indeksert hos Benjamin.

## Et nytt skall, eller et nytt bilde

Steg 0 og 2a som før, men **ikke 2b**. De tre egne verdiene hentes fra appen,
og taggen fra bildet som kjører:

```sh
CONFIG_MASTER_KEY=$(az containerapp secret show --subscription "$SUB" -g $RG -n $RAG_APP --secret-name config-master-key --query value -o tsv)
JWT_SECRET=$(az containerapp secret show --subscription "$SUB" -g $RG -n $RAG_APP --secret-name jwt-secret --query value -o tsv)
KA_KEY=$(az containerapp secret show --subscription "$SUB" -g $RG -n $RAG_APP --secret-name api-key --query value -o tsv)
SHA=$(az containerapp show --subscription "$SUB" -g $RG -n $RAG_APP --query 'properties.template.containers[0].image' -o tsv | cut -d: -f2)
STORAGE=$(az deployment group show --subscription "$SUB" -g $RG -n ka-rag-grunnmur --query properties.outputs.storageAccountName.value -o tsv)
```

Et nytt bilde: steg 1 gir ny `SHA`. Ta øyeblikksbildet over, og kjør
`rag_deploy app true`. Jobben får det nye bildet samtidig.

En ny seeding over en tenant som alt er seedet, er ikke prøvd, verken lokalt
eller her.

## Kostnad

Fra Azures offentlige prisliste for Norway East, 28.09: vCPU koster 0,000024
USD per sekund aktiv og 0,000003 i tomgang, minne 0,000003 USD per GiB-sekund.
Backenden står alltid oppe med 2 vCPU og 4 GiB, altså om lag 47 USD i måneden i
tomgang og opp mot 156 USD hvis den regnet hele tiden, før abonnementets
gratiskvote. Lagringen er ubetydelig ved 12,5 MB; transaksjonene er ikke målt.

## Prøve det lokalt

Samme bilde, samme kommando for jobben og samme variabler som i
`deploy/rag.bicep`, under Colima. Et docker-volum står for delingen, og et eget
nettverk for miljøet. Backenden har ingen publisert port, så den er intern som
i Azure; bare frontenden er åpen, på `127.0.0.1:8797`. Navnene og porten
kolliderer ikke med stacken på `:8080`.

Etter steg 1, 2a og 2b over:

```sh
IMG=ka-rag-test:$SHA
docker build -t $IMG -f "$SRC/server.Dockerfile" --build-arg VERSION="$SHA" "$SRC"
docker build -t ka-frontend-proeve:local .

export TYPESENSE_API_HOST TYPESENSE_API_TLS TYPESENSE_API_KEY_ADMIN KUDOS_COLLECTION_PREFIX KUDOS_DOCS_COLLECTION KUDOS_CHUNKS_COLLECTION KUDOS_PHRASES_COLLECTION COLBERT_API_URL COLBERT_API_KEY AZURE_OPENAI_API_ENDPOINT AZURE_OPENAI_DEPLOYMENT_NAME AZURE_OPENAI_API_KEY CONFIG_MASTER_KEY JWT_SECRET
export TYPESENSE_COLLECTION_PREFIX="$KUDOS_COLLECTION_PREFIX" E2E_API_KEY="$KA_KEY" DIGDIR_API_KEY="$KA_KEY"

docker network create ka-rag-proeve
docker volume create ka-rag-proeve-db
docker run --rm -i -v ka-rag-proeve-db:/var/lib/digdir alpine sh -c 'cat > /var/lib/digdir/seed-kudos-full.clj' < "$SRC/scripts/kudos-full/seed.clj"
```

Seed-jobben, med det samme som jobben i malen. `-e NAVN` uten verdi tar verdien
fra skallet, så den står ikke på kommandolinja:

```sh
docker run --rm --network ka-rag-proeve --cpus 1 --memory 2g -v ka-rag-proeve-db:/var/lib/digdir \
  -e DATAHIKE_FILE_PATH=/var/lib/digdir/db -e CONFIG_MASTER_KEY -e JWT_SECRET -e JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 \
  -e DIGDIR_SEED_GUARD_ADDRESSES=ka-rag-test:8080 \
  -e KUDOS_TENANT=kudos -e KUDOS_DATASET=kudos-full \
  -e KUDOS_COLLECTION_PREFIX -e KUDOS_DOCS_COLLECTION -e KUDOS_CHUNKS_COLLECTION -e KUDOS_PHRASES_COLLECTION \
  -e TYPESENSE_API_HOST -e TYPESENSE_API_TLS -e TYPESENSE_COLLECTION_PREFIX -e TYPESENSE_API_KEY_ADMIN \
  -e COLBERT_API_URL -e COLBERT_API_KEY \
  -e AZURE_OPENAI_USE_AZURE=true -e AZURE_OPENAI_API_ENDPOINT -e AZURE_OPENAI_DEPLOYMENT_NAME -e AZURE_OPENAI_API_KEY \
  --entrypoint java $IMG -cp /app/app.jar clojure.main \
  -e "(require 'digdir.setup.common) (digdir.setup.common/refuse-if-server-running! \"seed-kudos-full.clj\")" \
  /var/lib/digdir/seed-kudos-full.clj
```

Siste linje skal være `frasesøk «DFØ årsrapport 2024»: 20 treff`. Så backenden
og frontenden:

```sh
docker run -d --name ka-rag-test --network ka-rag-proeve --cpus 2 --memory 4g -v ka-rag-proeve-db:/var/lib/digdir \
  -e DATAHIKE_FILE_PATH=/var/lib/digdir/db -e CONFIG_MASTER_KEY -e JWT_SECRET -e JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 \
  -e TENANT=kudos -e DATASET_CONFIG_KEY=kudos-full -e E2E_API_KEY \
  $IMG
until docker exec ka-rag-test curl -fsS -o /dev/null http://localhost:8080/up; do sleep 2; done

docker run -d --name ka-frontend-proeve --network ka-rag-proeve -p 127.0.0.1:8797:8787 \
  -e KA_MODE=live -e DIGDIR_API_BASE=http://ka-rag-test:8080 -e DIGDIR_API_KEY \
  -e VITE_KA_TENANT=kudos -e VITE_KA_DATASET_CONFIG_KEY=kudos-full \
  -e "VITE_KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no" \
  -e "VITE_KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer" \
  ka-frontend-proeve:local
```

Åpne `http://127.0.0.1:8797`. Lokalt er backendens adresse
`ka-rag-test:8080`, fordi det ikke er noen ingress foran; i Azure er den
`ka-rag-test` på port 80.

Omstart, og vakta:

```sh
docker restart ka-rag-test
until docker exec ka-rag-test curl -fsS -o /dev/null http://localhost:8080/up; do sleep 2; done
```

Kjøres seed-jobben over på nytt nå, skal den nekte med exit 1. Rydd etterpå:

```sh
docker rm -f ka-frontend-proeve ka-rag-test
docker volume rm ka-rag-proeve-db
docker network rm ka-rag-proeve
```

### Målt 28.09

Med bildet `digdir-rag-server:newcomer`, som er bygget fra `a836b91`, grenens
hode: alle 222 kildefilene og de 11 ressursfilene i `app.jar` er like med
commiten. Frontenden bygget fra `main` (`553b061`). Colima, arm64.

| Hva                                            | Resultat                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| Seed-jobben mot tomt volum, ingen server først | exit 0 etter 34 s, frasesøket ga 20 treff        |
| Backenden, 2 CPU og 4 GiB                      | `/up` etter 44 s; 8 agenter og nøkkelen lagt inn |
| Minne etter ett svar                           | 1,4 GiB av 4                                     |
| Ny nøkkel / offentlig nøkkel / ingen           | 200 / 401 / 401 på `/api/conversations`          |
| Spørsmål med årsfilter 2024 i nettleseren      | svar etter ca. 20 s, to kilder, begge fra 2024   |
| Omstart av backenden                           | `/up` etter 42 s, tråden står der                |
| Seed-jobben mens backenden svarer              | nektet, exit 1                                   |
| Databasen etterpå                              | 12,5 MB, 1 472 filer                             |

## Det som ikke er målt

Alt dette kan bare prøves i Azure:

- Datahike på en Azure Files-deling over SMB: fillåser, fart, og om to
  revisjoner som overlapper skader noe.
- At Container Apps når Benjamins Typesense, Azure OpenAI og ColBERT. Alle har
  offentlige adresser, men om noen bare slipper inn bestemte IP-adresser, vet
  vi ikke.
- At frontenden når `http://ka-rag-test`, og at jobben når `ka-rag-test:80`,
  så vakta virker. Svarer den ikke, slipper vakta gjennom.
- At `allowInsecure` er det som trengs for `http://` inne i miljøet.
- At `az acr build` bygger bildet for amd64 uten feil; lokalt er det arm64.
- At abonnementets policy lar en lagringskonto ha nøkkeltilgang på, som
  monteringen krever.
- At miljøets kobling til delingen står når `main.bicep` kjøres på nytt.
- `az containerapp job logs show` etter at kjøringen er ferdig.
