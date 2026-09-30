# 0005 — Teksten i utdragene, og kildene etter ny innlasting, i live

**Status:** foreslått · **Dato:** 2026-09-30

## Kontekst

To av Simens punkter i runde 3 gjelder dataene bak kildepanelet i live-modus.
Det er modusen testmiljøet i Azure kjører.

- **86d:** et åpent utdrag viser overskriftsstien og lenka til Kudos, men ikke
  teksten fra dokumentet.
- **Ekstra 2:** laster man siden på nytt, også etter en utrulling, forsvinner
  alle kildene.

Dette ble målt mot den lokale stakken på :8080 (tenant `kudos`, datasett
`kudos-full`) 30.09, med tre spørsmål gjennom `/api/mcp` slik
`LiveChatClient` sender dem:

- `structuredContent.chunks` har feltene `chunk_id`, `doc_num`,
  `chunk_index`, `title` og `metadata`, men ikke teksten. Svarene hadde 6, 15
  og 3 biter. I koden velger headless-rag feltene med `select-keys` uten
  `content_markdown`, og den tar bare de 20 første bitene
  (`mcp/tools.clj:731-740`, lest, ikke målt).
- En samtale som leses tilbake med `GET /api/conversations/:id`, har
  `chunks: []` på alle meldinger. Det er headless-rag #21:
  `transact-used-data` (`data/db.cljc:1297`) blir aldri kalt.
- Den lagrede teksten i svaret er tegn for tegn lik teksten i `tools/call`,
  målt i ett svar på 621 tegn. Meldingen får en egen id i backenden, mens
  klienten gir svaret id-en `msg-<tid>` i `done`. Id-en fra strømmen kan
  altså ikke brukes til å kjenne igjen svaret etter innlasting, men samtalens
  id og teksten i svaret kan.
- Referansene til bitene i ett svar med 3 biter var 1041 tegn i JSON, med
  overskriftene. Det blir om lag 350 tegn per bit.

headless-rag har ingen rute der en klient med `X-API-Key` får teksten til
biter ut fra id-ene. Det er lest i koden, ikke målt. Utdraget ligger i
Typesense, i bitsamlingen til datasettet, i feltet `content_markdown`, og
`chunk_id` er også Typesense-id-en (`docs/loader.clj:521`). Nikolais BFF
henter teksten derfra, med id-ene fra svaret (`apps/server/src/excerpts.ts` i
poden). Tynnserveren vår spør allerede Typesense om fasettene (0001).

## Beslutning

**1. Teksten.** Tynnserveren får `GET /api/excerpts?dataset=<nøkkel>&ids=<id>,…`.
Den slår opp id-ene i bitsamlingen til datasettet og svarer
`{ "excerpts": { "<chunk_id>": "<content_markdown>" } }`. En id som ikke
finnes, er ikke med. Ruta bruker samme `TYPESENSE_URL` og `TYPESENSE_API_KEY`
som fasettene, og en ny `KA_CHUNK_COLLECTIONS` (`datasett=samling;…`), med
samme grammatikk som `KA_FACET_COLLECTIONS`. `LiveChatClient` spør ruta når
svaret er ferdig og før kildene sendes videre. Teksten havner i
`Excerpt.text`, i samme form som BFF-en gir i bff-modus. Mislykkes oppslaget,
eller mangler en id, blir `textUnavailable` satt, og panelet sier det med
ord, slik det gjør i bff-modus.

**2. Kildene etter innlasting.** Klienten lagrer referansene til bitene for
hvert svar i `localStorage`. Nøkkelen er samtalens id og et fingeravtrykk av
teksten i svaret. Når en tråd åpnes og backenden ikke har bitene, finner
klienten referansene igjen, bygger kildene på samme måte som i strømmen og
henter teksten fra ruta i punkt 1. Det lagres bare det strømmen ga, altså
id-er, dokumentnummer, tittel, adresse og overskrifter. Ingen tekst fra
dokumentene lagres i nettleseren.

Grunnen til punkt 2 er at det er den eneste veien som virker nå uten en
endring i headless-rag. Oppslaget på id-ene er det samme i begge situasjonene,
så et nytt svar og et svar som leses tilbake, kan ikke vise ulik tekst for
samme bit.

## Alternativer som ble vurdert

- **Lagre kildene med teksten i `localStorage`.** Da trengs ikke noe oppslag
  ved innlasting. Men teksten fra dokumentene blir liggende i nettleseren, og
  den tar mer plass. Hvor mye er ikke målt, fordi teksten ikke finnes i
  live. Det er det bff-modus kunne gjort, fordi BFF-en
  gir teksten, men BFF-en har ingen rute for oppslag på id-er.
- **`POST /api/skills/enrichment-fetch-chunk-context/execute` i
  headless-rag.** Den tar én bit per kall, og ifølge sin egen dokumentasjon er
  den verktøy for arbeid utenfor kjøringen, ikke en del av søket. Den er ikke
  målt. Den ville gitt 3 til 20 kall per svar gjennom en flate som ikke er
  laget for oss.
- **`/v1/chat/completions`.** Den gir teksten for de bitene svaret siterer,
  men bare ved å kjøre en ny tur med agenten.
- **`sessionStorage`.** Den overlever at siden lastes på nytt, men ikke at
  fanen lukkes. Simen vil ha kildene tilbake også dagen etter.
- **Vente på headless-rag #21.** Det er den riktige rettelsen, men den er
  ikke på plass.

## Konsekvenser

- **Testmiljøet trenger en nøkkel som kan søke i bitsamlingen.** Søkenøkkelen
  frontenden har der i dag (id 2), har bare `documents:search` på
  `KUDOS_preprod_v4_documents_.*`. Da svarer oppslaget med feil, og alle
  utdragene får `textUnavailable`. En ny nøkkel er en skriving mot Typesense,
  og den må Lars eller Benjamin lage. Navnet på bitsamlingen må også inn i
  `KA_CHUNK_COLLECTIONS`. Uten disse to fungerer punkt 2 fortsatt, men uten
  tekst.
- **Id-ene fra nettleseren går inn i et filter i Typesense.** Ruta tar bare id-er
  som består av `A–Z`, `a–z`, `0–9`, `.`, `_`, `:` og `-`, og høyst 20 om
  gangen, det samme som headless-rag gir per svar. Hver id settes i
  backticks i `filter_by`. Nøkkelen forlater aldri serveren. Datasettet må
  være et av dem som er satt opp.
- **Kildene kommer litt senere enn svaret,** med den tiden oppslaget tar. Det
  er ikke målt. Ruta har et tak på 5 sekunder.
- **Lageret i nettleseren har en grense.** Referansene tar om lag 350 tegn per
  bit og høyst 20 biter per svar, altså høyst 7 000 tegn per svar. Klienten
  holder lageret under 1 000 000 tegn ved å fjerne tråden som ble brukt
  lengst siden. Går det ikke å skrive, er alt som før: kildene forsvinner ved
  innlasting, og det er det eneste som skjer.
- **Lageret er per nettleser, ikke per bruker.** Det inneholder bare referanser
  til et offentlig korpus. En tråd kan bare få kilder fra lageret hvis
  backenden gir den til brukeren.
- **Et svar kjennes igjen på teksten.** Endrer backenden teksten etter at den
  er lagret, får svaret ikke kildene tilbake, og panelet er da som i dag. Det
  er tryggere enn å sette kilder på feil svar.
- **Bare live-modus.** Mock har egne data. Bak BFF-en er problemet det samme,
  og det samme lageret kan brukes der, men det er ikke en del av denne
  beslutningen.
- **Tynnserveren skal ut** (0002). Ruta er en bro, som fasettene i 0001. I
  monorepoet er det BFF-en som eier oppslaget.

## Hva som ville endret beslutningen

- **headless-rag lagrer bitene per melding (#21).** `GET /api/conversations/:id`
  gir da `contentMarkdown` for hver bit, og `sourcesFromChunks` leser den
  allerede. Da kan lageret i nettleseren fjernes.
- **headless-rag tar med `content_markdown` i `structuredContent.chunks`.**
  Da trengs ikke punkt 1 for et nytt svar. Det er API-bestilling A1, og i
  koden er det å legge til ett felt i en `select-keys`.
- **Fingeravtrykket treffer ikke.** Viser det seg at lagret tekst og strømmet
  tekst er ulike for mange svar, må nøkkelen bli noe annet. Da kan det være
  spørsmålets tekst og plassen i samtalen. Dette er målt i ett svar.
