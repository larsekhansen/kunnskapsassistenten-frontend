# 0001 — Hvor kunnskapen om et korpus skal bo

Skrevet 2026-09-24. Status: **foreslått**, ikke avtalt med Benjamin eller Nikolai.

## Spørsmålet

Filterpanelet trenger fasetter: lister over dokumenttyper, virksomheter og år,
med antall. Noen må vite at Kudos kaller dem `type`, `orgs_long` og
`concerned_years`, at `concerned_years` har støy som «2436», og at `orgs_short`
står tom. Hvor skal den kunnskapen ligge?

Headless-rag skal fungere med en hvilken som helst frontend, og andre
virksomheter kommer med andre korpus, kanskje flere samtidig. Datasett og
struktur vil alltid være forskjellige fra org til org.

## Det som er gjort i dag

**Nikolais frontend** har fasettene som en fast liste i sin egen server
(`apps/server/src/facets.ts`), med kommentaren _«orgs_short is left out: it is
empty in this corpus»_. Serveren spør Typesense direkte, med egen nøkkel.

**Vår frontend** har fasetter bare i mock. I live returnerer `listFacets` tom
liste, fordi backenden ikke har noe fasett-API.

Begge løsningene fungerer for Kudos, og ingen av dem fungerer for et annet
korpus uten ny kode.

## Alternativer

|       | hvor                                                             | pris                                                                                                |
| ----- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **A** | Fast liste i hver frontend                                       | Hver frontend trenger Typesense-nøkkel og feltnavn. Logikken kopieres per frontend.                 |
| **B** | Fast liste i backenden                                           | Like hardkodet som A, bare ett sted. Et nytt korpus krever fortsatt ny kode.                        |
| **C** | En agent genererer en MCP eller et API per virksomhet            | Én kodebase per org å vedlikeholde, teste og sikkerhetsgodkjenne. Generert kode glir fra hverandre. |
| **D** | Felles mekanisme i backenden, policy i datasettets konfigurasjon | Krever at noen skriver en fasettprofil per datasett — se under.                                     |

## Anbefalt: D

Benjamin har alt skrevet prinsippet ned, for tittelfelt og auto-filter, i
`digdir-headless-rag/plans/proposed/retrieval-configurable-fields-rules-plan.md`:

> Code should ship the **mechanism** (…); the **policy** (which fields, which
> markers, which patterns) belongs in dataset-scoped config.

Fasetter er det naturlige neste steget.

**Mekanismen, skrevet én gang.** Et Typesense-skjema beskriver seg selv: hvert
felt sier om det er en fasett. Et felles verktøy i backenden leser skjemaet og
datasettets profil, og returnerer fasettene i et generisk format:

```
[{ field: "type", label: "dokumenttyper", options: [{ value: "Årsrapport", count: 2874 }, …] }, …]
```

Det er formatet Nikolai alt bruker. Frontenden tegner det som kommer, og vet
ingenting om Kudos.

**Policyen, per datasett.** Skjemaet alene holder ikke. I Kudos er også
`title`, `url` og `doc_num` merket som fasetter, og ingen vil filtrere på dem.
Hvert datasett trenger derfor en liten profil i config-treet backenden alt har
per datasett:

- hvilke felt som er filtre, og i hvilken rekkefølge
- etiketten på norsk
- opprydding — `concerned_years` mellom 1990 og 2035, skjul felt som er tomme
- sortering — år synkende, virksomheter etter antall

**Agenten, som forslagsstiller.** Å skrive profilen for et nytt korpus kan en
agent gjøre: lese skjemaet, se at `orgs_long` har 457 organisasjonsnavn, at
`concerned_years` har uteliggere og at `orgs_short` er tom, og foreslå
profilen. Et menneske godkjenner, og den lagres som konfigurasjon. Tilnærmet
plug and play, uten generert kode i drift.

**Flere korpus samtidig** følger av seg selv: hvert datasett har sin profil, og
korpusvelgeren i frontenden finnes alt.

## Filteret selv er allerede riktig plassert

Et valgt filter sendes til backenden som
`overrides.retrieve-filter-by = { fields: [{ field, selected-options }] }` —
backendens eget interne format, som auto-filteret og agentens søkeverktøy også
bruker. Det er generisk og korpusuavhengig.

Det virket ikke før 2026-09-24, av fem grunner i headless-rag, rettet på lokal
gren `fix/mcp-retrieve-filter-by` (ikke sendt inn ennå):

1. `retrieve-filter-by` manglet på hvitelista over per-kall-innstillinger.
2. MCP-transporten gjorde ikke nøklene om til keywords, så **ingen**
   per-kall-innstilling har virket via MCP — målt: `retrieve-top-k 7` ga 100.
3. Agentens søk lot modellens filter, som regel tomt, erstatte leserens. Nå
   gjelder begge, og fallbacken slipper bare modellens del.
4. `value-type` kom som tekst og ble sammenlignet med et keyword, så et
   årsfilter sitertes som streng og Typesense avviste det — stille 0 treff.
5. En filterverdi kunne bli filtersyntaks. Målt: et årsfilter på 1 883
   dokumenter ble til 4 706 når «året» var `2024] || type:=[…`. Utrygge
   verdier droppes nå. Det ble nåbart med punkt 1–3: før nådde et
   kallervalgt filter aldri søket. Funnet av KA CC.

Målt etterpå mot hele Kudos-korpuset: et umulig filter gir 0 treff, DFØ +
Årsrapport gir bare DFØs årsrapport 2024 — der det før kom Statens vegvesen —
og Årsrapport + 2024 gir bare årsrapporter fra 2024.

## Prisen

- Profilen er én ting til å vedlikeholde per datasett. Men den er data, ikke
  kode, og uten den kopieres logikken i hver frontend i stedet.
- Mekanismen må bygges i headless-rag. Det er et tillegg, ikke en omskriving,
  men det er Benjamins kode og hans avgjørelse.
- Inntil den finnes, må noen levere fasettene midlertidig. Se «Neste steg».

## Neste steg

1. Avklare med Nikolai om han har løst filter på en annen måte, og med
   Benjamin om D og de fem rettelsene over.
2. Imens: la live-klienten sende valgt filter. Den delen er riktig uansett
   hvor fasettene ender, fordi formatet er backendens eget.
3. Midlertidig bro for fasettene: vår tynne server leverer dem i det generiske
   formatet over, fra Typesense. Når backenden får mekanismen, byttes kilden bak
   samme kontrakt, og frontenden endres ikke.
