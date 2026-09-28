// Testmiljø for KA-frontenden: én Container App med den bygde klienten og
// serveren som holder API-nøkkelen, og en identitet GitHub ruller ut med.
//
// Kopi av Nikolais `src/deploy/main.bicep` fra digdir/kunnskapsassistenten,
// tilpasset vår app. Det som er tatt bort er innlogging (Supabase og Entra),
// Typesense og øktnøkkelen: første runde er et internt miljø på en
// azurecontainerapps.io-adresse uten pålogging, og alt som ikke er der kan
// ikke lekke. Innlogging er steg 5 i design/plan-testmiljo-2026-09-22.md.
//
// Kjøres i to omganger, se «Første gang» i docs/deploy.md:
//   1. uten `image`: miljø, logger og begge identitetene, så rollene kan gis
//      før appen finnes og første henting av bildet ikke feiler;
//   2. med `image`: selve appen.
//
// IKKE KJØRT. Første utrulling gjør et menneske med Contributor på
// ressursgruppa; rolletildelingene er et eget steg fordi de krever Owner eller
// User Access Administrator, som malen ikke kan anta.

@description('Grunnnavn. Ressursene får suffikser av det.')
param name string = 'ka-frontend-test'
param location string = resourceGroup().location

@description('Bildet i registeret, f.eks. altinnaicontainers.azurecr.io/ka-frontend-test:<sha>. Tom = bare grunnmuren, ingen app.')
param image string = ''
param acrLoginServer string = 'altinnaicontainers.azurecr.io'

@description('Repoet som får rulle ut, som «eier/navn». Byttes den dagen repoet flyttes til digdir.')
param githubRepository string = 'larsekhansen/kunnskapsassistenten-frontend'

@description('Backenden serveren snakker med.')
param digdirApiBase string = 'https://test.rag.digdir.cloud'

@description('`mock` svarer fra fixturer og trenger ingen backend eller nøkkel. `live` spør på ekte.')
@allowed(['mock', 'live'])
param kaMode string = 'mock'

@description('Hostet backend bruker `kudos`; en lokal bruker `default`.')
param datasetConfigKey string = 'kudos'

@description('Tenant og datasettnøkkel er begge eller ingen: backenden forkaster én alene.')
param tenant string = 'digdir'

@description('Korpusene velgeren tilbyr: "nøkkel=Navn|beskrivelse;nøkkel=Navn". Tom = ett korpus og ingen velger.')
param datasets string = ''

@description('Hva hvert korpus kaller filterdimensjonene: "datasett=dimensjon:felt|dimensjon:felt:verditype;…". En dimensjon uten oppføring filtreres det ikke på.')
param filterFields string = 'kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer'

@description('Tom i mock. Da får appen verken secret eller variabel.')
@secure()
param digdirApiKey string = ''

// Uten nøkkel står både secret og variabel utenfor. Det er ikke målt om
// Container Apps godtar en secret med tom verdi, og en app i mock har ingen
// bruk for en; utelatt er riktig uansett hva svaret er.
var hasKey = !empty(digdirApiKey)

// Tomme verdier utelates av samme grunn. Serveren leser en tom variabel og en
// manglende likt (`value()` i server/config.ts), så ingenting endrer mening.
var plainEnv = filter(
  [
    { name: 'PORT', value: '8787' }
    { name: 'KA_MODE', value: kaMode }
    { name: 'DIGDIR_API_BASE', value: digdirApiBase }
    { name: 'VITE_KA_TENANT', value: tenant }
    { name: 'VITE_KA_DATASET_CONFIG_KEY', value: datasetConfigKey }
    { name: 'VITE_KA_DATASETS', value: datasets }
    { name: 'VITE_KA_FILTER_FIELDS', value: filterFields }
  ],
  entry => !empty(entry.value)
)
var keyEnv = hasKey ? [{ name: 'DIGDIR_API_KEY', secretRef: 'digdir-api-key' }] : []

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// Appens egen identitet: henter bildet fra registeret (AcrPull), og ingenting
// annet.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-id'
  location: location
}

// Identiteten GitHub Actions logger inn som. Egen, og ikke appens: den som
// kan rulle ut en ny versjon skal ikke være den samme som kjører den.
resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-deploy'
  location: location
}

// OIDC: en kjøring i repoet får et kortlivet token fra GitHub, og Azure godtar
// det bare for dette subjektet. Ingen hemmelighet ligger i repoet. Bare `main`,
// så en gren eller en PR fra en fork kan ikke rulle ut.
resource github 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployer
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:ref:refs/heads/main'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = if (!empty(image)) {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8787
        transport: 'auto'
        // Ingen timeout satt her, fordi det ikke finnes noen å sette:
        // Container Apps' ingress har 240 sekunder som plattformverdi og
        // eksponerer den ikke i denne API-versjonen. Det holder for et svar
        // som strømmer i 30–90 sekunder, og det er verdt å vite når en tur
        // mot et tregt korpus nærmer seg grensa.
        stickySessions: { affinity: 'none' }
      }
      registries: [{ server: acrLoginServer, identity: identity.id }]
      secrets: hasKey ? [{ name: 'digdir-api-key', value: digdirApiKey }] : []
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(plainEnv, keyEnv)
          probes: [
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 8787 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      // Én replika står alltid oppe. Et testmiljø som skalerer til null
      // svarer først etter en kaldstart, og det er den som demonstrerer noe
      // som betaler for ventetiden.
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output fqdn string = empty(image) ? '' : app!.properties.configuration.ingress.fqdn
output principalId string = identity.properties.principalId
@description('Settes som GitHub-variabelen AZURE_CLIENT_ID.')
output deployClientId string = deployer.properties.clientId
output deployPrincipalId string = deployer.properties.principalId
output tenantId string = deployer.properties.tenantId
