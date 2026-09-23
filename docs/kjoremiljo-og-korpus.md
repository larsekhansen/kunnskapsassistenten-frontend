# Å kjøre opp Kunnskapsassistenten lokalt, og hva korpuset faktisk inneholder

Målt 2026-09-23 mot `main` (0232d27) og den lokale RAG-stacken. Skrevet fordi
det ellers må måles på nytt hver gang noen lurer, og fordi flere av tallene
forklarer ting som ser ut som feil og ikke er det.

`docs/deploy.md` har kommandoene for Azure og for containeren. Denne fila er
det som er målt: hvor lang tid det tar, hva som svarer, og hvorfor to av
panelene står tomme i live når de er fulle i mock.

## Å kjøre det opp

Backenden først — se `CLAUDE.md` i paraplymappa for Colima og compose. Så:

```sh
npm ci                    # 7,2 s
npm run build             # 16,5 s
PORT=8799 KA_MODE=live \
  DIGDIR_API_BASE=http://localhost:8080 \
  DIGDIR_API_KEY=<nøkkel> \
  VITE_KA_TENANT=demo \
  VITE_KA_DATASET_CONFIG_KEY=kudos-pilot \
  npm start
```

Fra ingenting til en kjørende app i live-modus: **under 25 sekunder** når
stacken alt står. `curl localhost:8799/healthz` svarer
`{"ok":true,"mode":"live"}`.

Målt i nettleseren, headless mot den kjørende stacken:

|                                |                                                               |
| ------------------------------ | ------------------------------------------------------------- |
| forsida lastet                 | 1,3 s                                                         |
| svar ferdig etter spørsmålet   | 21,5 s (målt fra 14,9 s til 33,5 s over fire spørsmål)        |
| konsollfeil                    | 0                                                             |
| adressen etter første spørsmål | `/threads/U3CoiKzj8BaujUwldgqVE` — backendens egen samtale-id |

## Hva korpusene inneholder

Lest ut av Typesense 2026-09-23.

| datasett       | dokumenter | biter |
| -------------- | ---------- | ----- |
| `kudos-pilot`  | 5          | 360   |
| `norquad-docs` | 351        | 7 109 |

**Kudos-piloten er fem årsrapporter, alle fra 2025:**

- Årsrapport Statens pensjonskasse 2025 (AID)
- Årsrapport Statens graderte plattformtjenester 2025 (FD)
- Årsrapport Forsvaret 2025 (FD)
- Årsrapport Forsvarets forskningsinstitutt (FFI) 2025 (FD)
- Årsrapport Forsvarsbygg 2025 (FD)

Det er verdt å lese den lista før man tester. Et spørsmål om DFØ, om et annet
årstall eller om en virksomhet som ikke står der, kan ikke besvares med
kilder — og appen tegner det som et tomt kildepanel, som ser ut som en feil.

Målt, samme app og samme korpus:

| spørsmål                                                                    | kilder |
| --------------------------------------------------------------------------- | ------ |
| «Hva er de viktigste forskjellene mellom DFØs årsrapport for 2025 og 2024?» | **0**  |
| «Hva rapporterer Statens pensjonskasse om måloppnåelse i 2025?»             | **4**  |

Agenten svarte selv «Kunnskapsbasen inneholder ikke …» på det første. Det er
riktig oppførsel; det er innholdet i korpuset som er grensa, ikke klienten.

## Hvorfor to paneler er tomme i live og fulle i mock

Begge er med vilje, og ingen av dem henger på metadata i Kudos-korpuset.

**Filtrering.** Live-backenden har ingen fasett-telling i det hele tatt
(API-bestilling A2), så `LiveChatClient.listFacets` returnerer tom liste og
panelet sier «Filtrering er ikke tilgjengelig ennå». Mock regner fasettene ut
av fixturkorpuset sitt, og derfor virker det der. Det gjelder alle datasett i
live, ikke bare Kudos.

**Dokumentlista og kildepanelet.** De viser dokumentene og utdragene _dette
svaret_ hentet. Fikk turen null biter, er begge tomme — og det er sant. Se
tabellen over: samme korpus gir fire kilder på et spørsmål det finnes
dokumenter for.

## Grenser som er målt, ikke antatt

**En delt lenke virker ikke for mottakeren.** Identiteten er `ka.user.v1` i
`localStorage`, og backenden filtrerer samtaler på `X-User-Id`. Målt begge
veier på samme adresse:

|                                        | resultat                                 |
| -------------------------------------- | ---------------------------------------- |
| full sidelast i **samme** nettleser    | tråden kommer tilbake, spørsmålet synlig |
| samme adresse i en **annen** nettleser | «Fant ikke tråden»                       |

«Kopier lenke til tråden» lover altså mer enn live kan holde. Det er en egen
sak, ikke en feil i adressen: adressen er riktig, den navngir backendens egen
samtale (fikset i #157).

**Svarkvaliteten varierer med spørsmålet.** Ett av fire spørsmål kom tilbake
med «verktøyets lesebudsjett hindrer uthenting», riktig dokument funnet og
null kilder, etter 33,5 s. Det er agentsida. Verdt å vite før man demonstrerer
for noen: velg spørsmål mot dokumenter som finnes, og prøv dem på forhånd.
