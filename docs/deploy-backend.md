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

| Ressurs                | Hva                                                                   |
| ---------------------- | --------------------------------------------------------------------- |
| `karagvxd2q2aj52lqw`   | Lagringskonto, Standard LRS, bare for delingen.                       |
| `ka-rag-db`            | Azure Files-deling (SMB), montert på `/var/lib/digdir`.               |
| `ka-rag-db` i miljøet  | Miljøets kobling til delingen, med kontonøkkelen.                     |
| `ka-rag-test-seed`     | Container Apps-jobb, manuell. Seeder tenanten og datasettet.          |
| `ka-rag-test`          | Backenden. Intern ingress på port 8080, én replika, 2 vCPU og 4 GiB.  |
| `ka-rag-test:<commit>` | Bildet, i registeret `kafrontendvxd2q2aj52lqw` som frontenden bruker. |

Lagringskontoen heter `karag` pluss det samme suffikset som registeret, fordi
begge er avledet av ressursgruppa.

Utenfor Azure, som lokalt: Benjamins Typesense, Azure OpenAI (`gpt-5.6-terra`)
og ColBERT.

## Før du begynner

- **Grunnmuren fra `docs/deploy.md`** er rullet ut i `rg-ka-test`, med
  admin-brukeren i registeret slått på. Steg 0 sjekker det.
- **Innlogging eller IP-begrensning foran frontenden** før steg 7. Uten en av
  dem kan alle med adressen bruke tjenesten på vår modellkostnad.
- **Contributor på `rg-ka-test`** holder, og det trengs ingen
  rolletildelinger. Appen og jobben henter bildet med registerets
  admin-bruker, og malen henter passordet selv med `listCredentials()` ved
  utrulling. Delingen monteres med kontonøkkelen, som malen også henter selv.
  Ingen av dem står i oppskriften.
- **På maskinen:** headless-rag-checkouten i
  `~/projects/kunnskapsassistenten/digdir-headless-rag` med `.env`
  (Azure OpenAI-verdiene) og `.env.benjamin` (Typesense og ColBERT), og grenen
  pushet. `git`, `openssl` og `jq`.

**Hver kommando står alene.** Ingen variabel går fra én blokk til den neste.
Det som må følge med, ligger i to filer: commiten i
`~/.cache/ka-rag-test/commit` (steg 1) og verdiene i
`~/.config/ka-rag-test/parameters.json` (steg 2). Hver `az`-kommando begynner
med `--subscription Altinn-AI-Assistant`, og med `-g rg-ka-test` rett etter der
kommandoen tar en ressursgruppe. Kommandoene kjøres fra rota i dette repoet.

## Steg 0: sjekken

```sh
az account show --subscription Altinn-AI-Assistant --query name -o tsv
az provider show --subscription Altinn-AI-Assistant -n Microsoft.Storage --query registrationState -o tsv
az containerapp env show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test-env --query properties.provisioningState -o tsv
az acr show --subscription Altinn-AI-Assistant -g rg-ka-test -n kafrontendvxd2q2aj52lqw --query adminUserEnabled -o tsv
```

Linjene skal vise `Altinn-AI-Assistant`, `Registered`, `Succeeded` og `true`.
Står den siste på `false`, er admin-brukeren ikke slått på i `main.bicep` ennå,
og da feiler steg 3 på `listCredentials()`.

## Steg 1: kildene og bildet

Commiten skrives til en fil, så bildet, seed-skriptet og utrullingene senere
bruker samme commit selv om grenen flytter seg i mellomtiden.

```sh
git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" fetch origin fix/mcp-retrieve-filter-by
mkdir -p "$HOME/.cache/ka-rag-test" && git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" rev-parse origin/fix/mcp-retrieve-filter-by > "$HOME/.cache/ka-rag-test/commit"
rm -rf "$HOME/.cache/ka-rag-test/src" && mkdir -p "$HOME/.cache/ka-rag-test/src" && git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" archive "$(cat "$HOME/.cache/ka-rag-test/commit")" | tar -x -C "$HOME/.cache/ka-rag-test/src"
cat "$HOME/.cache/ka-rag-test/commit"
```

```sh
az acr build --subscription Altinn-AI-Assistant --registry kafrontendvxd2q2aj52lqw --image "ka-rag-test:$(cat "$HOME/.cache/ka-rag-test/commit")" --file server.Dockerfile --build-arg VERSION="$(cat "$HOME/.cache/ka-rag-test/commit")" "$HOME/.cache/ka-rag-test/src"
```

Bildet bygges fra en `git archive` av commiten, ikke fra repo-mappa.
headless-rag har ingen `.dockerignore`, så `az acr build` fra mappa ville
lastet opp `.env` og `.env.benjamin` til byggetjenesten. Arkivet har bare det
som er committet (84 MB for `a836b91`).

`VERSION` er det samme headless-rags egen `deploy.yml` sender med, og gjør at
commiten står i serverens diagnosepanel. Lokalt tar bygget om lag ti minutter.
I registeret er det ikke målt.

## Steg 2: parameterfila, én gang

Alle verdiene malen trenger utenom commiten, i én fil som bare du kan lese.
`value` leser verdien etter `navn =` i `.env`-filene uten å skrive noe ut.
Navnene i `.env.benjamin` er backendens config-stier, som i
`scripts/kudos-full/seed.sh`; de nakne `url` og `key` er ColBERT.
`CONFIG_MASTER_KEY`, `JWT_SECRET` og API-nøkkelen lages nye, fordi databasen
er ny. API-nøkkelen har formatet backenden lager selv: `rag_` og 64
heksadesimale tegn.

```sh
ka_rag_parameters() {
  local file="$HOME/.config/ka-rag-test/parameters.json"
  local rag="$HOME/projects/kunnskapsassistenten/digdir-headless-rag"
  [ -e "$file" ] && { echo "Finnes alt: $file. Lag den ikke på nytt over en seedet database."; return 1; }
  mkdir -p "$HOME/.config/ka-rag-test" && chmod 700 "$HOME/.config/ka-rag-test"
  (
    umask 077
    value() { sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//p" "$1" | head -n 1 | sed 's/[[:space:]]*$//; s/^"\(.*\)"$/\1/'; }
    export P_TS_HOST="$(value "$rag/.env.benjamin" 'services\.typesense\.api-host')"
    export P_TS_TLS="$(value "$rag/.env.benjamin" 'services\.typesense\.api-tls')"
    export P_TS_KEY="$(value "$rag/.env.benjamin" 'services\.typesense\.api-key-admin')"
    export P_PREFIX="$(value "$rag/.env.benjamin" 'pipeline\.storage\.collection-prefix')"
    export P_DOCS="$(value "$rag/.env.benjamin" 'pipeline\.storage\.docs-collection')"
    export P_CHUNKS="$(value "$rag/.env.benjamin" 'pipeline\.storage\.chunks-collection')"
    export P_PHRASES="$(value "$rag/.env.benjamin" 'pipeline\.storage\.phrases-collection')"
    export P_COLBERT_URL="$(value "$rag/.env.benjamin" url)"
    export P_COLBERT_KEY="$(value "$rag/.env.benjamin" key)"
    export P_AOAI_ENDPOINT="$(value "$rag/.env" AZURE_OPENAI_API_ENDPOINT)"
    export P_AOAI_DEPLOYMENT="$(value "$rag/.env" AZURE_OPENAI_DEPLOYMENT_NAME)"
    export P_AOAI_KEY="$(value "$rag/.env" AZURE_OPENAI_API_KEY)"
    export P_CMK="${KA_CONFIG_MASTER_KEY:-$(openssl rand -base64 32)}"
    export P_JWT="${KA_JWT_SECRET:-$(openssl rand -base64 32)}"
    export P_KEY="${KA_API_KEY:-rag_$(openssl rand -hex 32)}"
    jq -n '{
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: {
        typesenseHost: { value: env.P_TS_HOST },
        typesenseTls: { value: env.P_TS_TLS },
        collectionPrefix: { value: env.P_PREFIX },
        docsCollection: { value: env.P_DOCS },
        chunksCollection: { value: env.P_CHUNKS },
        phrasesCollection: { value: env.P_PHRASES },
        colbertApiUrl: { value: env.P_COLBERT_URL },
        azureOpenAiEndpoint: { value: env.P_AOAI_ENDPOINT },
        azureOpenAiDeployment: { value: env.P_AOAI_DEPLOYMENT },
        configMasterKey: { value: env.P_CMK },
        jwtSecret: { value: env.P_JWT },
        apiKey: { value: env.P_KEY },
        azureOpenAiApiKey: { value: env.P_AOAI_KEY },
        typesenseApiKeyAdmin: { value: env.P_TS_KEY },
        colbertApiKey: { value: env.P_COLBERT_KEY }
      }
    }' > "$file"
  )
  jq -r '.parameters | to_entries[] | "\(.key) \(.value.value | length)"' "$file"
}
ka_rag_parameters
```

Den skriver navnet og lengden på hver verdi, aldri verdien. Alle skal være
over 0, og `apiKey` skal ha 68. Står en på 0, er et navn i `.env`-filene ikke
funnet: slett fila og finn ut hvorfor, før steg 3.

**Fila er nøkkelen til databasen.** Tjenestenøklene i config-databasen er
kryptert med `configMasterKey`, og med en ny verdi kan de ikke leses igjen. Derfor
nekter funksjonen å skrive over en fil som finnes. Er fila borte, se
[Hvis parameterfila er borte](#hvis-parameterfila-er-borte).

## Steg 3: lagringen og seed-jobben

```sh
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-grunnmur --template-file deploy/rag.bicep --parameters @"$HOME/.config/ka-rag-test/parameters.json" registryName=kafrontendvxd2q2aj52lqw imageTag="$(cat "$HOME/.cache/ka-rag-test/commit")" withApp=false --query properties.outputs -o json
```

Uten `withApp` lager malen lagringskontoen, delingen, miljøets kobling til den
og jobben, men ingen app. Jobben startes ikke av seg selv. Utdataene skal vise
`storageAccountName` lik `karagvxd2q2aj52lqw`.

Verdiene går til ARM i parameterfila og ikke på kommandolinja. Malen tar dem
som `@secure()`, så de lagres ikke i utrullingshistorikken.

## Steg 4: seed-skriptet på delingen

`scripts/kudos-full/seed.clj` er ikke i bildet: `server.Dockerfile` kopierer
bare `server/`. Jobben kjører det fra delingen, fra samme commit som bildet.
Med `--auth-mode key` og uten nøkkel henter `az` kontonøkkelen selv.

```sh
az storage file upload --subscription Altinn-AI-Assistant --auth-mode key --account-name karagvxd2q2aj52lqw --share-name ka-rag-db --source "$HOME/.cache/ka-rag-test/src/scripts/kudos-full/seed.clj" --path seed-kudos-full.clj
```

## Steg 5: seeding

**Jobben kjøres bare når appen ikke finnes.** Databasen tåler én prosess, og
en seeding mens serveren har den åpen, melder suksess og mister skrivingen
(headless-rag #493). Første gang finnes ikke appen, fordi steg 3 lot den være.
Sjekk det likevel; linja skal ikke skrive ut noe:

```sh
az containerapp list --subscription Altinn-AI-Assistant -g rg-ka-test --query "[?name=='ka-rag-test'].name" -o tsv
```

Så jobben, som skriver ut navnet på kjøringen:

```sh
az containerapp job start --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --query name -o tsv
```

Og ventingen på den nyeste kjøringen. Den venter i inntil 30 minutter, like
lenge som jobbens `replicaTimeout`, og stopper når kjøringen er ferdig på den
ene eller andre måten:

```sh
for i in $(seq 1 90); do
  STATUS=$(az containerapp job execution list --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --query 'sort_by(@, &properties.startTime)[-1].properties.status' -o tsv)
  echo "$(date +%H:%M:%S) $STATUS"
  case "$STATUS" in
    Succeeded|Failed|Stopped|Degraded) break ;;
  esac
  sleep 20
done
```

**Gå videre til steg 6 bare når siste linje er `Succeeded`.** Skriptet
avslutter med 0 bare når frasesøket mot Kudos til slutt gir treff. Lokalt tok
jobben 34 sekunder mot en tom database og ga 20 treff. I Azure kommer hentingen
av bildet på ca. 1 GB i tillegg. Står den på noe annet, eller fortsatt på
`Running` etter 30 minutter, er databasen ikke klar; les loggen i portalen,
under jobben → **Execution history**.

**Vakta i jobben er en reserve, ikke en stopper.** Skriptet kjører bak
headless-rags `refuse-if-server-running!`, som avslutter med 1 hvis
`ka-rag-test:80` svarer 2xx på `/up` innen 500 ms. Den slipper gjennom på alt
annet:

- på en omdirigering, som ingressen gir hvis `allowInsecure` ikke virker slik
  malen antar;
- mens appen starter: skjema, agenter og nøkkel skrives før `/up` svarer, så
  appen har databasen åpen før vakta kan se den;
- når navnet ikke slås opp, eller svaret bruker mer enn 500 ms.

Derfor sikrer oppskriften at appen ikke finnes, og lar ikke vakta gjøre det.
Å skalere appen til 0 er ikke det samme: den vekkes av den første
forespørselen, også av vaktas egen.

## Steg 6: backenden

```sh
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-app --template-file deploy/rag.bicep --parameters @"$HOME/.config/ka-rag-test/parameters.json" registryName=kafrontendvxd2q2aj52lqw imageTag="$(cat "$HOME/.cache/ka-rag-test/commit")" withApp=true --query properties.outputs -o json
```

At oppstarten la inn agentene og nøkkelen. Loggen har de første åtte tegnene av
nøkkelen i `:api-key-prefix`, og `sed` tar dem ut før de vises:

```sh
az containerapp logs show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --format text --tail 100 | grep -E "e2e/seeded|Started oejs.Server" | sed -E 's/:api-key-prefix "[^"]*"/:api-key-prefix skjult/'
```

Første gang skal linja med `e2e/seeded` vise `:agents-after 8` og
`:api-key-existed? false`. Ved senere oppstarter står det `true`.

Oppstartsproben venter i inntil 130 sekunder på `/up`. Lokalt, med 2 CPU og
4 GiB som her, svarte den etter 44 sekunder.

## Steg 7: frontenden peker på backenden

Først når innlogging eller IP-begrensning står foran frontenden. Nøkkelen blir
secret, og modus, adresse og korpus settes i en ny revisjon:

```sh
az containerapp secret set --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --secrets digdir-api-key="$(jq -r .parameters.apiKey.value "$HOME/.config/ka-rag-test/parameters.json")"
```

```sh
az containerapp update --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --set-env-vars KA_MODE=live DIGDIR_API_BASE=http://ka-rag-test DIGDIR_API_KEY=secretref:digdir-api-key VITE_KA_TENANT=kudos VITE_KA_DATASET_CONFIG_KEY=kudos-full "VITE_KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no" "VITE_KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer" --revision-suffix rag$(date +%H%M%S)
```

```sh
az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --query properties.configuration.ingress.fqdn -o tsv
```

`http://ka-rag-test` er appens navn inne i miljøet; adressen finnes ikke
utenfra. Åpne frontendens adresse og still et spørsmål. Et svar tar fra 16 til
80 sekunder.

**Kjøres `main.bicep` på nytt, må den få de samme verdiene**, ellers setter den
frontenden tilbake til mock mot `test.rag.digdir.cloud`: `kaMode=live`,
`digdirApiBase=http://ka-rag-test`, `tenant=kudos`,
`datasetConfigKey=kudos-full`, `datasets` og `filterFields` som over, og
`digdirApiKey` fra parameterfila. `filterFields` må ha nøkkelen `kudos-full`,
ikke `kudos` som i standardverdien.

At tråden overlever en omstart av backenden:

```sh
az containerapp revision restart --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --revision "$(az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --query properties.latestRevisionName -o tsv)"
```

Last tråden på nytt når omstarten er ferdig. Spørsmålet og svaret står der;
kildene lagres ikke med samtalen, og det sier frontenden selv.

## Nøkkelen

Backenden lager ingen nøkkel av seg selv. Det finnes to veier i koden:
konsollet (`digdir.config.api-keys/create-api-key!`, bak admin-innlogging), og
oppstartskroken `digdir.e2e.seed/maybe-seed!`. Oppsettet her bruker kroken,
som er det lokal kjøring også gjør:

- Når `E2E_API_KEY` er satt, gjør hver oppstart tre ting: legger inn de
  innebygde agentene og to testagenter (8 i alt), lagrer akkurat denne verdien
  som API-nøkkel hvis den ikke finnes, og registrerer tenanten i `TENANT`. Uten
  variabelen gjør den ingenting.
- Nøkkelen lagres som SHA-256 av verdien, ikke som klartekst, med navnet
  `e2e-harness` og scope `query`. Loggen får de første åtte tegnene.
- **Hva den får:** alle kall under `/api/*` og `/v1/*` som krever en gyldig
  nøkkel. Den har ingen grense for tenant, datasett, agent eller modus, og for
  MCP betyr tom grense ingen grense (`digdir.mcp.tools`, merknaden om
  `:dataset-scopes`). Databasen her har bare tenanten `kudos`, så i praksis er
  det Kudos-korpuset. Den har verken `ingest` eller `admin`.
- **Hvem sine tråder:** nøkkelen er ikke knyttet til en bruker.
  `/api/conversations` skiller brukerne på `X-User-Id`, som den som har
  nøkkelen setter selv. Derfor må tynnserveren sette den fra innloggingen, ikke
  fra nettleseren, den dagen det er innlogging.
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
  én replika, og seed-jobben bare når appen ikke finnes (steg 5).
- **Nye revisjoner overlapper.** En ny revisjon av `ka-rag-test` (nytt bilde,
  ny variabel, ny secret) startes før den gamle stoppes, så to JVM-er har
  databasen åpen en liten stund. Hva Datahike gjør da, er ikke målt. Ta et
  øyeblikksbilde av delingen først; `az` henter kontonøkkelen selv:

  ```sh
  az storage share snapshot --subscription Altinn-AI-Assistant --account-name karagvxd2q2aj52lqw --name ka-rag-db
  ```

  Om en omstart av samme revisjon (steg 7) også overlapper, er ikke målt.

- **Størrelse:** 12,5 MB i 1 472 filer etter seeding og én tråd (målt lokalt).
  Kvoten er 10 GiB. En slettet deling kan hentes tilbake i sju dager.
- **SMB, ikke NFS.** NFS krever et miljø i eget virtuelt nettverk, og det har
  ikke miljøet fra `main.bicep`. Hvor raskt Datahike skriver mange små filer
  over SMB, er ikke målt.
- **Frasehurtigbufferen** (`/app/cache`) er ikke på delingen. Den brukes når et
  korpus lastes inn, og Kudos er ferdig indeksert hos Benjamin.

## Et nytt bilde

Steg 1 gir ny commit i `~/.cache/ka-rag-test/commit` og nytt bilde. Ta
øyeblikksbildet over, og kjør utrullingen i steg 6. Jobben får det nye bildet
samtidig.

En ny seeding over en tenant som alt er seedet, er ikke prøvd, verken lokalt
eller her. Skal det gjøres, må appen først slettes, så steg 5 og 6 gjelder som
første gang. Delingen og databasen står når appen slettes.

## Hvis parameterfila er borte

De tre verdiene som ble laget i steg 2, ligger som secrets på appen. Lim inn
funksjonen fra steg 2 først, og kjør den så med dem:

```sh
KA_CONFIG_MASTER_KEY="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name config-master-key --query value -o tsv)" KA_JWT_SECRET="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name jwt-secret --query value -o tsv)" KA_API_KEY="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name api-key --query value -o tsv)" ka_rag_parameters
```

Finnes ikke appen ennå, ligger de to første på jobben i stedet:
`az containerapp job secret show` med `-n ka-rag-test-seed`.

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

Etter steg 1 og 2 over. Verdiene hentes fra parameterfila inn i miljøet, og
`-e NAVN` uten verdi tar dem derfra, så de står ikke på kommandolinja:

```sh
P="$HOME/.config/ka-rag-test/parameters.json"
SRC="$HOME/.cache/ka-rag-test/src"
IMG="ka-rag-test:$(cat "$HOME/.cache/ka-rag-test/commit")"
param() { jq -r ".parameters.$1.value" "$P"; }
export CONFIG_MASTER_KEY="$(param configMasterKey)" JWT_SECRET="$(param jwtSecret)" E2E_API_KEY="$(param apiKey)" DIGDIR_API_KEY="$(param apiKey)"
export TYPESENSE_API_HOST="$(param typesenseHost)" TYPESENSE_API_TLS="$(param typesenseTls)" TYPESENSE_API_KEY_ADMIN="$(param typesenseApiKeyAdmin)"
export KUDOS_COLLECTION_PREFIX="$(param collectionPrefix)" TYPESENSE_COLLECTION_PREFIX="$(param collectionPrefix)" KUDOS_DOCS_COLLECTION="$(param docsCollection)" KUDOS_CHUNKS_COLLECTION="$(param chunksCollection)" KUDOS_PHRASES_COLLECTION="$(param phrasesCollection)"
export COLBERT_API_URL="$(param colbertApiUrl)" COLBERT_API_KEY="$(param colbertApiKey)"
export AZURE_OPENAI_API_ENDPOINT="$(param azureOpenAiEndpoint)" AZURE_OPENAI_DEPLOYMENT_NAME="$(param azureOpenAiDeployment)" AZURE_OPENAI_API_KEY="$(param azureOpenAiApiKey)"

docker build -t $IMG -f "$SRC/server.Dockerfile" --build-arg VERSION="$(cat "$HOME/.cache/ka-rag-test/commit")" "$SRC"
docker build -t ka-frontend-proeve:local .
docker network create ka-rag-proeve
docker volume create ka-rag-proeve-db
docker run --rm -i -v ka-rag-proeve-db:/var/lib/digdir alpine sh -c 'cat > /var/lib/digdir/seed-kudos-full.clj' < "$SRC/scripts/kudos-full/seed.clj"
```

Seed-jobben, med det samme som jobben i malen:

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

Lokalt henter containerne bildet fra maskinen og ikke fra registeret, så
admin-brukeren er ikke med i prøven.

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

Alt dette kan bare prøves i Azure. De tre første er de som kan gå galt ved
første kjøring:

- Datahike på en Azure Files-deling over SMB: fillåser, fart, og om to
  revisjoner som overlapper skader noe.
- At Container Apps når Benjamins Typesense, Azure OpenAI og ColBERT. Alle har
  offentlige adresser, men om noen bare slipper inn bestemte IP-adresser, vet
  vi ikke.
- At frontenden når `http://ka-rag-test`, og at `allowInsecure` er det som
  trengs for `http://` inne i miljøet. Det samme gjelder vakta, som når appen
  på `ka-rag-test:80`: gir ingressen en omdirigering, slipper vakta gjennom.
  Oppskriften lar derfor aldri vakta være det eneste som hindrer en seeding
  mens appen kjører.
- At `listCredentials()` gir passordet når admin-brukeren er på, og at appen og
  jobben henter bildet med det.
- At `az acr build` bygger bildet for amd64 uten feil; lokalt er det arm64.
- At abonnementets policy lar en lagringskonto ha nøkkeltilgang på, som
  monteringen krever.
- At miljøets kobling til delingen står når `main.bicep` kjøres på nytt.
- At `az storage file upload` og `az storage share snapshot` henter
  kontonøkkelen selv, som hjelpeteksten sier.
