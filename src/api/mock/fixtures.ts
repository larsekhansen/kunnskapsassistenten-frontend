import type {
  Citation,
  FilterFacet,
  Message,
  RetrievalDetails,
  SourceDocument,
  Thread,
  ThreadDetail,
  ThinkingStep,
} from '../../model';
import { daysAgo } from './clock';
import { scriptedThreads } from './conversations/threads';

/**
 * Norwegian fixtures for development without a backend.
 *
 * The text is taken from the September 2026 specifications in
 * design/omraader/september-2026/: the NKOM answer, the thread titles from
 * the thread list, the facet values and counts from the filter, and the
 * excerpt headings from the sources panel.
 *
 * Two deliberate departures from Figma's sample data:
 *
 *   1. The search keywords in Figma («Datadeling kunstig intelligens» …)
 *      belong to a different question than the NKOM answer they sit next to.
 *      The keywords here match the question instead, so the mock is coherent.
 *   2. Figma repeats «Årsrapport NKOM 2024» seven times in the document list.
 *      Distinct documents here, per answer 58.
 */

/** Timestamps relative to now, so the thread grouping has something to group. */

const NKOM_QUESTION =
  'Hvordan jobber Nasjonal kommunikasjonsmyndighet med måloppnåelse, og hva har endret seg fra 2022 til 2023?';

/**
 * The answer, as markdown. Heading plus paragraph, with a list and a simple
 * table inside the flow (answer 14). The `[n]` markers are 1-indexed into
 * `nkomCitations`, the same convention the backend uses.
 */
const NKOM_ANSWER = `# Måloppnåelse i Nasjonal kommunikasjonsmyndighet

Nkom rapporterer måloppnåelse gjennom risikostyring, ressursbruk og
strategiske prioriteringer. Årsrapportene for 2022 og 2023 beskriver det
samme systemet, men vektlegger ulike deler av det.

## Internkontroll og risikovurdering

Internkontrollen bygger på årlige risikovurderinger som følges opp gjennom
året, og avvik rapporteres til ledelsen kvartalsvis [1]. I 2023 er
risikovurderingen knyttet tettere til virksomhetsstrategien, slik at hvert
hovedmål har egne risikoer med navngitt eier [3].

## Ressursbruk og måloppnåelse

Ressursbruken fordeles på fire hovedmål, og rapporteringen viser både
timeforbruk og oppnådde resultater per mål [2][4]:

- Sikre og robuste elektroniske kommunikasjonsnett
- God konkurranse i markedene
- Trygg digital hverdag for innbyggerne
- Effektiv forvaltning av frekvenser og nummer

## Sammenligning

| Tema | 2022 | 2023 |
| --- | --- | --- |
| Risikoeiere per hovedmål | Ikke spesifisert | Navngitt |
| Rapportering av avvik | Kvartalsvis | Kvartalsvis |
| Egen omtale av 5G | Delvis | Eget kapittel |

## Fokus på digital transformasjon

Begge årene omtaler digital transformasjon som en forutsetning for
måloppnåelse, men 2023-rapporten knytter den til konkrete tiltak i
saksbehandlingen [3].

## 5G-utvikling

Utbyggingen av 5G får et eget kapittel i 2023, med dekningstall per
fylke [4]. I 2021 er 5G omtalt som en framtidig oppgave [5].

Disse rapportene viser hvordan Nkom arbeider systematisk med måloppnåelse
gjennom risikostyring, ressursbruk og strategiske prioriteringer, med en
tydelig utvikling mot digital transformasjon og 5G-teknologi.`;

export const nkomSources: SourceDocument[] = [
  {
    id: 'doc-nkom-2022',
    title: 'Årsrapport Nasjonal kommunikasjonsmyndighet 2022',
    url: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2022',
    documentType: 'Årsrapport',
    organisation: 'Nasjonal kommunikasjonsmyndighet',
    year: 2022,
    excerpts: [
      {
        id: 'chunk-2022-04',
        citationNumber: 1,
        relevance: 'high',
        heading: 'Internkontroll og risikovurdering',
        page: 41,
        kudosUrl: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2022#side-41',
        text: 'Nkom gjennomfører årlige risikovurderinger på virksomhetsnivå. Vurderingene følges opp gjennom året, og avvik rapporteres til ledelsen kvartalsvis. Internkontrollen er innrettet slik at den skal gi rimelig sikkerhet for måloppnåelse innenfor de fire hovedmålene.',
      },
      {
        id: 'chunk-2022-09',
        citationNumber: 2,
        relevance: 'medium',
        heading: 'Ressursbruk og måloppnåelse',
        page: 52,
        kudosUrl: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2022#side-52',
        text: 'Ressursbruken fordeles på hovedmålene, og rapporteringen viser både timeforbruk og oppnådde resultater per mål. Fordelingen er stabil sammenlignet med foregående år, med en mindre vridning mot tilsynsvirksomhet.',
      },
    ],
  },
  {
    id: 'doc-nkom-2023',
    title: 'Årsrapport Nasjonal kommunikasjonsmyndighet 2023',
    url: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2023',
    documentType: 'Årsrapport',
    organisation: 'Nasjonal kommunikasjonsmyndighet',
    year: 2023,
    excerpts: [
      {
        id: 'chunk-2023-02',
        citationNumber: 3,
        relevance: 'high',
        heading: 'Internkontroll og risikovurdering',
        page: 38,
        kudosUrl: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2023#side-38',
        text: 'Risikovurderingen er i 2023 knyttet tettere til virksomhetsstrategien. Hvert hovedmål har egne risikoer med navngitt eier, og digital transformasjon av saksbehandlingen er ført opp som et eget tiltak under to av målene.',
      },
      {
        id: 'chunk-2023-11',
        citationNumber: 4,
        relevance: 'medium',
        heading: '5G-utvikling og dekning',
        page: 64,
        kudosUrl: 'https://kudos.dfo.no/dokument/nkom-arsrapport-2023#side-64',
        text: 'Utbyggingen av 5G omtales i et eget kapittel med dekningstall per fylke. Rapporten knytter dekningsutviklingen til målet om sikre og robuste elektroniske kommunikasjonsnett, og viser ressursbruk per hovedmål i samme tabell.',
      },
    ],
  },
  {
    id: 'doc-nkom-2021',
    title: 'Årsrapport Nasjonal kommunikasjonsmyndighet 2021',
    documentType: 'Årsrapport',
    organisation: 'Nasjonal kommunikasjonsmyndighet',
    year: 2021,
    excerpts: [
      {
        id: 'chunk-2021-07',
        citationNumber: 5,
        relevance: 'low',
        heading: 'Framtidige oppgaver',
        // No kudosUrl: this document has no public URL. The backend returns
        // `url: null` for folder-based corpora, and the panel must handle it.
        text: '5G er omtalt som en framtidig oppgave. Nkom forbereder tildeling av frekvensressurser og varsler at dekningskrav vil bli vurdert i kommende auksjoner.',
      },
    ],
  },
];

export const nkomCitations: Citation[] = nkomSources.flatMap((document) =>
  document.excerpts
    .filter((excerpt) => excerpt.citationNumber !== undefined)
    .map((excerpt) => ({
      number: excerpt.citationNumber as number,
      excerptId: excerpt.id,
      documentId: document.id,
    })),
);

/**
 * «10 treff i 3 dokumenter», as the design writes it.
 *
 * `hitCount` counts what the SEARCH found — 10 relevant chunks — not what the
 * answer cited. The answer used 5 of them, which is why the sources below
 * hold five excerpts and not ten. That gap is normal and worth showing: it is
 * the difference between what was read and what was used.
 */
export const nkomRetrieval: RetrievalDetails = {
  hitCount: 10,
  documentCount: 3,
  keywords: [
    'Måloppnåelse Nkom',
    'Internkontroll og risikovurdering',
    'Ressursbruk per hovedmål',
    'Digital transformasjon Nkom',
    '5G-dekning 2023',
  ],
};

export const nkomThinkingSteps: ThinkingStep[] = [
  {
    id: 'step-1',
    kind: 'reasoning',
    label:
      'Jeg deler spørsmålet i to: hvordan måloppnåelse måles, og hva som skiller 2022 fra 2023.',
  },
  {
    id: 'step-2',
    kind: 'search',
    label: 'Jeg søker i årsrapportene.',
    queries: ['måloppnåelse Nkom 2022', 'måloppnåelse Nkom 2023', 'internkontroll risikovurdering'],
    detail: '60 utdrag funnet, 10 beholdt etter rangering.',
    durationMs: 2410,
  },
  {
    id: 'step-3',
    kind: 'read',
    label: 'Jeg leser de mest relevante utdragene.',
    detail: '5 utdrag fra 3 dokumenter.',
    durationMs: 980,
  },
  {
    id: 'step-4',
    kind: 'finalizing',
    label: 'Jeg skriver svaret med kildehenvisninger.',
    durationMs: 620,
  },
];

/**
 * The one thread written by hand, and the only one that is not a scripted
 * conversation.
 *
 * It stays because it is the only fixture with `page` on its excerpts — Kudos
 * gives a summary per document and no page for any part of it, so the
 * scripted conversations have none, and this is what keeps the sources
 * panel's page rendering drawn by something. It is also the thread the
 * end-to-end suite opens by name.
 */
const nkomThread: Thread = {
  id: 'nkom-maaloppnaaelse',
  title: 'NKOM måloppnåelse',
  /*
   * An hour later than a scripted conversation from the same day, which are
   * asked at 8 and answered at 9 (conversations/threads.ts). Sharing those
   * hours put this thread and «Regnskap og bevilgning i DSS» on the same
   * instant, and two rows at the same instant have no order — the list would
   * draw them either way round on different runs. Measured 2026-09-16.
   */
  createdAt: daysAgo(0, 9),
  updatedAt: daysAgo(0, 10),
  conversationId: 'conv-nkom-1',
};

/** A `ThreadDetail` as it appears in the list, without its messages. */
function withoutMessages({ messages, ...thread }: ThreadDetail): Thread {
  void messages;
  return thread;
}

/**
 * The thread list.
 *
 * Every row has a conversation under it, which it did not until 2026-09-15:
 * the list was twelve titles and one of them had messages, so eleven of the
 * twelve threads a reader could open were empty. The scripted conversations
 * were sitting right there with the whole shape of a real turn — answer,
 * sources, thinking steps, «Fremgangsmåte» — and reachable only by typing the
 * question they answer. Punkt 16 på brukerreise-lista, målt av #4.
 *
 * Sorting is the list view's own business; it orders by `updatedAt`.
 */
export const threads: Thread[] = [nkomThread, ...scriptedThreads.map(withoutMessages)];

const nkomMessages: Message[] = [
  {
    id: 'msg-nkom-question',
    role: 'user',
    content: NKOM_QUESTION,
    createdAt: daysAgo(0, 9),
    citations: [],
    status: 'complete',
  },
  {
    id: 'msg-nkom-answer',
    role: 'assistant',
    content: NKOM_ANSWER,
    createdAt: daysAgo(0, 10),
    citations: nkomCitations,
    sources: nkomSources,
    retrieval: nkomRetrieval,
    thinkingSteps: nkomThinkingSteps,
    status: 'complete',
  },
];

/** Threads whose messages are written out here rather than scripted. */
const messagesByThread: Record<string, Message[]> = {
  'nkom-maaloppnaaelse': nkomMessages,
};

export function findThread(threadId: string): ThreadDetail | null {
  const scripted = scriptedThreads.find((candidate) => candidate.id === threadId);
  if (scripted) return scripted;

  const thread = threads.find((candidate) => candidate.id === threadId);
  if (!thread) return null;
  return { ...thread, messages: messagesByThread[thread.id] ?? [] };
}

/**
 * The filter dropdowns. Values and counts are the ones drawn in
 * design/omraader/molecules/skjermer/filter.md. The counts are sample data:
 * no backend produces them yet (API-bestilling A2).
 */
export const facets: FilterFacet[] = [
  {
    dimension: 'documentType',
    label: 'Dokumenttyper',
    values: [
      { value: 'evaluering', label: 'Evaluering', count: 779 },
      { value: 'proposisjon', label: 'Proposisjon til Stortinget', count: 576 },
      { value: 'statusrapport', label: 'Statusrapport', count: 1084 },
      { value: 'strategi-plan', label: 'Strategi/plan', count: 267 },
      { value: 'tildelingsbrev', label: 'Tildelingsbrev', count: 2042 },
      { value: 'arsrapport', label: 'Årsrapport', count: 1032 },
    ],
  },
  {
    dimension: 'organisation',
    label: 'Virksomheter',
    values: [
      { value: '22-juli-senteret', label: '22. juli-senteret', count: 14 },
      { value: 'advokattilsynet', label: 'Advokattilsynet', count: 11 },
      { value: 'agder-fylkeskommune', label: 'Agder fylkeskommune', count: 3 },
      { value: 'as-vinmonopolet', label: 'AS Vinmonopolet', count: 7 },
      { value: 'digdir', label: 'Digitaliseringsdirektoratet', count: 96 },
      { value: 'nkom', label: 'Nasjonal kommunikasjonsmyndighet', count: 42 },
    ],
  },
  {
    dimension: 'year',
    label: 'År',
    values: [
      { value: '2025', label: '2025', count: 545 },
      { value: '2024', label: '2024', count: 854 },
      { value: '2023', label: '2023', count: 789 },
      { value: '2022', label: '2022', count: 456 },
      { value: '2021', label: '2021', count: 321 },
      { value: '2020', label: '2020', count: 123 },
    ],
  },
];

export const mockAnswerMarkdown = NKOM_ANSWER;
