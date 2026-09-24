// Testmiljø for KA-frontenden: én Container App med den bygde klienten og
// serveren som holder API-nøkkelen.
//
// Kopi av Nikolais `src/deploy/main.bicep` fra digdir/kunnskapsassistenten,
// tilpasset vår app. Det som er tatt bort er innlogging (Supabase og Entra),
// Typesense og øktnøkkelen: første runde er et internt miljø på en
// azurecontainerapps.io-adresse uten pålogging, og alt som ikke er der kan
// ikke lekke. Innlogging er steg 5 i design/plan-testmiljo-2026-09-22.md.
//
// IKKE KJØRT. Første utrulling gjør et menneske med Contributor på
// ressursgruppa; se docs/deploy.md.

@description('Grunnnavn. Ressursene får suffikser av det.')
param name string = 'ka-frontend-test'
param location string = resourceGroup().location

@description('Bildet i ACR, f.eks. altinnaicontainers.azurecr.io/ka-frontend-test:sha-abc1234')
param image string
param acrLoginServer string

@description('Backenden serveren snakker med.')
param digdirApiBase string = 'https://test.rag.digdir.cloud'

@description('`mock` svarer fra fixturer og trenger ingen backend. `live` spør på ekte.')
@allowed(['mock', 'live'])
param kaMode string = 'live'

@description('Hostet backend bruker `kudos`; en lokal bruker `default`.')
param datasetConfigKey string = 'kudos'

@description('Tenant og datasettnøkkel er begge eller ingen: backenden forkaster én alene.')
param tenant string = 'digdir'

@description('Korpusene velgeren tilbyr: "nøkkel=Navn|beskrivelse;nøkkel=Navn". Tom = ett korpus og ingen velger.')
param datasets string = ''

@description('Hva hvert korpus kaller filterdimensjonene: "datasett=dimensjon:felt|dimensjon:felt:verditype;…". En dimensjon uten oppføring filtreres det ikke på.')
param filterFields string = 'kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer'

@secure()
param digdirApiKey string

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

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-id'
  location: location
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
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
      secrets: [{ name: 'digdir-api-key', value: digdirApiKey }]
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'PORT', value: '8787' }
            { name: 'KA_MODE', value: kaMode }
            { name: 'DIGDIR_API_BASE', value: digdirApiBase }
            { name: 'DIGDIR_API_KEY', secretRef: 'digdir-api-key' }
            { name: 'VITE_KA_TENANT', value: tenant }
            { name: 'VITE_KA_DATASET_CONFIG_KEY', value: datasetConfigKey }
            { name: 'VITE_KA_DATASETS', value: datasets }
            { name: 'VITE_KA_FILTER_FIELDS', value: filterFields }
          ]
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

output fqdn string = app.properties.configuration.ingress.fqdn
output principalId string = identity.properties.principalId
