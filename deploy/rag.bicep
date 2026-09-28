// Vår egen digdir-headless-rag i testmiljøet: backenden frontenden spør når
// den står i live. Samme bilde og samme korpus som lokalt (tenant `kudos`,
// datasett `kudos-full` mot Benjamins Typesense), i det samme Container
// Apps-miljøet som frontenden, og bare med intern adresse.
//
// Lages i tillegg til main.bicep, som må være kjørt først: miljøet og
// registeret er `existing` her. Oppskriften er docs/deploy-backend.md, og den
// kjøres i to omganger:
//   1. uten `withApp`: lagring, deling og seed-jobben, så databasen kan seedes
//      før noen server har den åpen;
//   2. med `withApp=true`: selve backenden.
//
// Databasen er Datahike på fil, på en Azure Files-deling. Den tåler én
// skriver, og derfor er det én replika, og jobben kjøres bare mens appen ikke
// svarer.
//
// IKKE KJØRT. Bevist lokalt i samme form under Colima, se «Prøve det lokalt» i
// docs/deploy-backend.md.

@description('Backendens navn. Frontenden når den på http://<navn> inne i miljøet.')
param name string = 'ka-rag-test'
param location string = resourceGroup().location

@description('Miljøet main.bicep laget.')
param environmentName string = 'ka-frontend-test-env'

@description('Registeret main.bicep laget, med admin-brukeren på. Samme uttrykk som der, så standarden treffer i samme ressursgruppe.')
param registryName string = 'kafrontend${uniqueString(resourceGroup().id)}'

@description('Taggen på headless-rag-bildet, som er commit-sha-en det er bygget fra.')
@minLength(7)
param imageTag string

@description('Uten denne lages bare lagringen og seed-jobben. Appen lages når databasen er seedet.')
param withApp bool = false

@description('Lagringskontoen. Globalt unikt navn, derfor avledet av ressursgruppa.')
@minLength(3)
@maxLength(24)
param storageAccountName string = 'karag${uniqueString(resourceGroup().id)}'

param shareName string = 'ka-rag-db'

param tenant string = 'kudos'
param dataset string = 'kudos-full'

@description('Benjamins Typesense, som vert:port uten skjema.')
param typesenseHost string
param typesenseTls string = 'true'
param collectionPrefix string
param docsCollection string
param chunksCollection string
param phrasesCollection string

param colbertApiUrl string

param azureOpenAiEndpoint string
param azureOpenAiDeployment string

@secure()
@description('Krypterer hemmelighetene i config-databasen. Mistes den, kan de ikke leses igjen.')
param configMasterKey string

@secure()
param jwtSecret string

@secure()
@description('Nøkkelen frontenden bruker. «rag_» og 64 heksadesimale tegn.')
param apiKey string

@secure()
param azureOpenAiApiKey string

@secure()
param typesenseApiKeyAdmin string

@secure()
param colbertApiKey string

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: registryName
}

var image = '${registry.properties.loginServer}/${name}:${imageTag}'

// Bildet hentes med registerets admin-bruker, ikke med en identitet: en
// identitet trenger AcrPull, og den rollen kan ingen av oss gi (Contributor gir
// ikke rett til å tildele roller). main.bicep slår admin-brukeren på. Passordet
// hentes her, ved utrulling, og står aldri i oppskriften eller i en variabel.
var registryLogin = [
  {
    server: registry.properties.loginServer
    username: registry.name
    passwordSecretRef: 'registry-password'
  }
]
var registrySecret = { name: 'registry-password', value: registry.listCredentials().passwords[0].value }

// Container Apps monterer Azure Files med kontonøkkelen, så den må være på.
// Ingen blob-tilgang utenfra; kontoen har bare delingen.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
  }
}

// En slettet deling kan hentes tilbake i sju dager. Databasen er alt som er
// her, og den tar tid å seede på nytt.
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    shareDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

// SMB, fordi NFS i Container Apps krever et miljø i eget virtuelt nettverk,
// og det har ikke miljøet fra main.bicep.
resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: shareName
  properties: {
    enabledProtocols: 'SMB'
    shareQuota: 10
  }
}

resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: containerEnv
  name: shareName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: share.name
      accessMode: 'ReadWrite'
    }
  }
}

// Datahike-filene og seed-skriptet ligger på delingen, på samme sti som i
// headless-rags egen compose-fil.
var dbVolume = { name: 'db', storageType: 'AzureFile', storageName: envStorage.name }
var dbMount = { volumeName: 'db', mountPath: '/var/lib/digdir' }

// Standard er en fjerdedel av minnet til heapen. Et svar med agenten bruker
// mer enn det, og containeren har ikke annet å bruke minnet til.
var jvmEnv = { name: 'JAVA_TOOL_OPTIONS', value: '-XX:MaxRAMPercentage=75' }

var bootstrapEnv = [
  { name: 'DATAHIKE_FILE_PATH', value: '/var/lib/digdir/db' }
  { name: 'CONFIG_MASTER_KEY', secretRef: 'config-master-key' }
  { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
  jvmEnv
]

// Seed-jobben: scripts/kudos-full/seed.clj fra headless-rag-grenen, som
// oppskriften legger på delingen. Den skriver tenanten, datasettet og
// tjenestene (Typesense, ColBERT, Azure OpenAI) inn i config-databasen,
// kryptert med CONFIG_MASTER_KEY, og avslutter med et frasesøk som må gi treff.
//
// Vakta foran skriptet (`refuse-if-server-running!`) avslutter med 1 hvis appen
// svarer på /up. En seeding mens appen står, melder suksess og mister
// skrivingen (headless-rag #493). Adressen er appens interne navn, fordi
// vaktas egne standardadresser gjelder docker compose.
//
// Vakta er en reserve, ikke en stopper: den slipper gjennom på alt annet enn
// 2xx innen 500 ms, altså også på en omdirigering, mens appen starter og når
// navnet ikke slås opp. Oppskriften kjører derfor jobben bare når appen ikke
// finnes.
resource seedJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${name}-seed'
  location: location
  properties: {
    environmentId: containerEnv.id
    configuration: {
      triggerType: 'Manual'
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      replicaTimeout: 1800
      // Ingen ny runde av seg selv: en ny kjøring over en tenant som alt er
      // seedet, er ikke prøvd.
      replicaRetryLimit: 0
      registries: registryLogin
      secrets: [
        registrySecret
        { name: 'config-master-key', value: configMasterKey }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'azure-openai-api-key', value: azureOpenAiApiKey }
        { name: 'typesense-api-key-admin', value: typesenseApiKeyAdmin }
        { name: 'colbert-api-key', value: colbertApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'seed'
          image: image
          command: ['java']
          args: [
            '-cp'
            '/app/app.jar'
            'clojure.main'
            '-e'
            '(require \'digdir.setup.common) (digdir.setup.common/refuse-if-server-running! "seed-kudos-full.clj")'
            '/var/lib/digdir/seed-kudos-full.clj'
          ]
          resources: { cpu: json('1'), memory: '2Gi' }
          env: concat(bootstrapEnv, [
            { name: 'DIGDIR_SEED_GUARD_ADDRESSES', value: '${name}:80' }
            { name: 'KUDOS_TENANT', value: tenant }
            { name: 'KUDOS_DATASET', value: dataset }
            { name: 'KUDOS_COLLECTION_PREFIX', value: collectionPrefix }
            { name: 'KUDOS_DOCS_COLLECTION', value: docsCollection }
            { name: 'KUDOS_CHUNKS_COLLECTION', value: chunksCollection }
            { name: 'KUDOS_PHRASES_COLLECTION', value: phrasesCollection }
            { name: 'TYPESENSE_API_HOST', value: typesenseHost }
            { name: 'TYPESENSE_API_TLS', value: typesenseTls }
            { name: 'TYPESENSE_COLLECTION_PREFIX', value: collectionPrefix }
            { name: 'TYPESENSE_API_KEY_ADMIN', secretRef: 'typesense-api-key-admin' }
            { name: 'COLBERT_API_URL', value: colbertApiUrl }
            { name: 'COLBERT_API_KEY', secretRef: 'colbert-api-key' }
            { name: 'AZURE_OPENAI_USE_AZURE', value: 'true' }
            { name: 'AZURE_OPENAI_API_ENDPOINT', value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: azureOpenAiDeployment }
            { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }
          ])
          volumeMounts: [dbMount]
        }
      ]
      volumes: [dbVolume]
    }
  }
}

// Backenden. Tjenestenøklene får den ikke: de ligger i config-databasen etter
// seedingen, og serveren leser dem derfra. Den trenger bare nøklene som åpner
// databasen, og nøkkelen frontenden bruker.
//
// `E2E_API_KEY` er headless-rags krok for første oppstart
// (`digdir.e2e.seed/maybe-seed!`): ved hver oppstart legger den inn de
// innebygde agentene og lagrer akkurat denne verdien som API-nøkkel, med
// scope `query` og uten grense for tenant, datasett, agent eller modus. Hva det
// betyr, står i docs/deploy-backend.md, «Nøkkelen».
resource app 'Microsoft.App/containerApps@2024-03-01' = if (withApp) {
  name: name
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'auto'
        // Frontenden kaller http://<navn>. Uten denne omdirigerer ingressen
        // http til https (Microsofts dokumentasjon for `allowInsecure`), og et
        // POST som følger en 301, blir et GET. Ikke målt i Azure. Adressen
        // finnes bare inne i miljøet.
        allowInsecure: true
      }
      registries: registryLogin
      secrets: [
        registrySecret
        { name: 'config-master-key', value: configMasterKey }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'api-key', value: apiKey }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json('2'), memory: '4Gi' }
          env: concat(bootstrapEnv, [
            { name: 'TENANT', value: tenant }
            { name: 'DATASET_CONFIG_KEY', value: dataset }
            { name: 'E2E_API_KEY', secretRef: 'api-key' }
          ])
          volumeMounts: [dbMount]
          // /up svarer først når oppstarten er ferdig: skjema, agenter og
          // nøkkel skrives før serveren lytter.
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/up', port: 8080 }
              initialDelaySeconds: 30
              periodSeconds: 10
              failureThreshold: 10
            }
            {
              type: 'Readiness'
              httpGet: { path: '/up', port: 8080 }
              periodSeconds: 10
            }
            {
              type: 'Liveness'
              httpGet: { path: '/up', port: 8080 }
              periodSeconds: 30
              failureThreshold: 3
            }
          ]
        }
      ]
      volumes: [dbVolume]
      // Én, fordi databasen tåler én skriver. Aldri null: en kaldstart her tar
      // like lang tid som oppstarten over.
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

@description('Adressen frontenden bruker som DIGDIR_API_BASE.')
output apiBase string = 'http://${name}'
output storageAccountName string = storage.name
output shareName string = share.name
output seedJobName string = seedJob.name
