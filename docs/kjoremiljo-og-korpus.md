# Å kjøre opp Kunnskapsassistenten lokalt, og hva korpuset faktisk inneholder

Målt 2026-09-23 og 2026-09-24 mot `main` og den lokale RAG-stacken. Skrevet
fordi det ellers må måles på nytt hver gang noen lurer, og fordi flere av
tallene forklarer ting som ser ut som feil og ikke er det.

`docs/deploy.md` har kommandoene for Azure og for containeren. Denne fila er
det som er målt. Hvorfor fasettene ikke kommer fra backenden står i
`docs/arkitektur/0001-fasetter-og-korpuskunnskap.md`.

## Det store korpuset

**Hele Kudos er 10 064 dokumenter**, ferdig indeksert av Benjamin i Typesense
som `KUDOS_preprod_v4_*` på `typesense-test.digdir.cloud`:

| samling    | antall    |
| ---------- | --------- |
| dokumenter | 10 064    |
| biter      | 621 244   |
| fraser     | 6 564 478 |

Det er et øyeblikksbilde fra februar 2026. Årsrapporter for 2025 finnes derfor
ikke ennå — de publiseres utover våren.

Lokalt nås det gjennom en egen tenant, så de lokale demodatasettene blir
stående:

|                                 |              |
| ------------------------------- | ------------ |
| tenant                          | `kudos`      |
| datasett (`dataset_config_key`) | `kudos-full` |

Tilgangen står i `digdir-headless-rag/.env.benjamin`. Navnene der er
backendens egne config-stier (`services.typesense.api-host`,
`pipeline.storage.docs-collection`), ikke miljøvariabler, og skal ikke gis nye
navn. De to nakne linjene `url` og `key` nederst er ColBERT-reranker-en
(`services.colbert.api-url` og `api-key`), en annen tjeneste enn Typesense.

## Å kjøre det opp

Backenden først — se `CLAUDE.md` i paraplymappa for Colima og compose. Så:

```sh
npm ci                    # 7,2 s
npm run build             # 16,5 s
PORT=8799 KA_MODE=live \
  DIGDIR_API_BASE=http://localhost:8080 \
  DIGDIR_API_KEY=<nøkkel> \
  VITE_KA_TENANT=kudos \
  VITE_KA_DATASET_CONFIG_KEY=kudos-full \
  npm start
```

Fra ingenting til en kjørende app i live-modus: under 25 sekunder når stacken
alt står.

Målt i nettleseren mot det store korpuset, «Hva står i DFØs årsrapport for 2024
om kundetilfredshet?»:

|               |                                                                                       |
| ------------- | ------------------------------------------------------------------------------------- |
| svar ferdig   | 16,5 s                                                                                |
| dokumentlista | «Årsrapport Direktoratet for forvaltning og økonomistyring 2024» — og ingenting annet |
| konsollfeil   | 0                                                                                     |
| auto-filter   | «Auto-filtered by orgs_long» i tenkepanelet                                           |

Over flere spørsmål tar et svar fra 16 til 80 sekunder.

## Pilot-korpuset

`kudos-pilot` (tenant `demo`) er **fem årsrapporter fra 2025**, med vilje —
`:document-limit 5` i `design/_sources/tools/seed_kudos_pilot.clj`. Et
spørsmål om noe utenfor de fem gir null kilder og et tomt kildepanel. Det er
riktig oppførsel, men det ser ut som en feil; bruk det store korpuset.

## Filter

**Et valgt filter virker**, med backenden fra grenen
`fix/mcp-retrieve-filter-by` i headless-rag. Det sendes som
`overrides.retrieve-filter-by`. Målt:

|                                              | resultat                                |
| -------------------------------------------- | --------------------------------------- |
| umulig filter (`type = ZZZ_ingen_slik_type`) | 0 treff                                 |
| `type = Årsrapport`                          | bare årsrapporter                       |
| DFØ + Årsrapport, gjennom agenten            | bare DFØs årsrapport 2024               |
| uten filter                                  | 5 dokumenter på tvers av typer, som før |

Uten den grenen slippes filteret stille — tre feil i headless-rag, beskrevet i
arkitekturnotatet.

**Fasettene kommer ikke fra backenden ennå.** `LiveChatClient.listFacets`
returnerer tom liste, så panelet sier «Filtrering er ikke tilgjengelig ennå».
I mock regnes de ut av fixturkorpuset. Kudos-skjemaet har feltene som trengs —
`type`, `orgs_long` og `concerned_years`, alle som fasetter — men hvor de skal
hentes fra er ikke avgjort.

**Auto-filteret virker, men har en svakhet.** Det henter årstall fra agentens
_omskrevne_ søk, ikke bare fra spørsmålet. Målt: det la på «2023» og «2024» på
et spørsmål uten årstall.

## Grenser som er målt, ikke antatt

**En delt lenke virker ikke for mottakeren.** Identiteten er `ka.user.v1` i
`localStorage`, og backenden filtrerer samtaler på `X-User-Id`. Samme adresse:
full sidelast i samme nettleser henter tråden tilbake; en annen nettleser får
«Fant ikke tråden». Adressen er riktig — den navngir backendens egen samtale
(#157). Det er identitetsmodellen som mangler.

**Svarkvaliteten varierer med spørsmålet.** Velg spørsmål mot dokumenter som
finnes, og prøv dem på forhånd før du viser noe fram.
