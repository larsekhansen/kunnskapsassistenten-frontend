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
function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

const NKOM_QUESTION =
  'Hvordan jobber Nasjonal kommunikasjonsmyndighet med måloppnåelse, og hva har endret seg fra 2022 til 2023?';

/**
 * The answer, as markdown. Heading plus paragraph, with a list and a simple
 * table inside the flow (answer 14). The `[n]` markers are 1-indexed into
 * `nkomCitations`, the same convention the backend uses.
 */
const NKOM_ANSWER = `## Måloppnåelse i Nasjonal kommunikasjonsmyndighet

Nkom rapporterer måloppnåelse gjennom risikostyring, ressursbruk og
strategiske prioriteringer. Årsrapportene for 2022 og 2023 beskriver det
samme systemet, men vektlegger ulike deler av det.

### Internkontroll og risikovurdering

Internkontrollen bygger på årlige risikovurderinger som følges opp gjennom
året, og avvik rapporteres til ledelsen kvartalsvis [1]. I 2023 er
risikovurderingen knyttet tettere til virksomhetsstrategien, slik at hvert
hovedmål har egne risikoer med navngitt eier [3].

### Ressursbruk og måloppnåelse

Ressursbruken fordeles på fire hovedmål, og rapporteringen viser både
timeforbruk og oppnådde resultater per mål [2][4]:

- Sikre og robuste elektroniske kommunikasjonsnett
- God konkurranse i markedene
- Trygg digital hverdag for innbyggerne
- Effektiv forvaltning av frekvenser og nummer

### Sammenligning

| Tema | 2022 | 2023 |
| --- | --- | --- |
| Risikoeiere per hovedmål | Ikke spesifisert | Navngitt |
| Rapportering av avvik | Kvartalsvis | Kvartalsvis |
| Egen omtale av 5G | Delvis | Eget kapittel |

### Fokus på digital transformasjon

Begge årene omtaler digital transformasjon som en forutsetning for
måloppnåelse, men 2023-rapporten knytter den til konkrete tiltak i
saksbehandlingen [3].

### 5G-utvikling

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
  document.excerpts.map((excerpt) => ({
    number: excerpt.citationNumber,
    excerptId: excerpt.id,
    documentId: document.id,
  })),
);

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

export const threads: Thread[] = [
  {
    id: 'nkom-maaloppnaaelse',
    title: 'NKOM måloppnåelse',
    createdAt: daysAgo(0, 8),
    updatedAt: daysAgo(0, 9),
    conversationId: 'conv-nkom-1',
  },
  {
    id: 'digdir-rapportering',
    title: 'Digdir rapportering 2022-2023',
    createdAt: daysAgo(0, 7),
    updatedAt: daysAgo(0, 8),
  },
  {
    id: 'politiet-ungdomskriminalitet',
    title: 'Politiet om ungdomskriminalitet',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: 'om-stimulab',
    title: 'Om Stimulab',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: 'aarsrapport-digdir-2021',
    title: 'Årsrapport Digdir 2021',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: 'tilgang-til-aarsrapporter',
    title: 'Tilgang til årsrapporter',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
  },
  {
    id: 'fullmaktene-dss',
    title: 'Fullmaktene for departementenes sikkerhets- og serviceorganisasjon',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
  {
    id: 'okonomifullmaktene-dss',
    title: 'Økonomifullmaktene til DSS',
    createdAt: daysAgo(18),
    updatedAt: daysAgo(18),
  },
  {
    id: 'tilleggsoppdrag-dss',
    title: 'Tilleggsoppdrag for DSS',
    createdAt: daysAgo(26),
    updatedAt: daysAgo(26),
  },
  {
    id: 'anskaffelser-tre-aar',
    title: 'Anskaffelser i årsrapportene de siste tre årene',
    createdAt: daysAgo(48),
    updatedAt: daysAgo(48),
  },
  {
    id: 'evaluering-av-stimulab',
    title: 'Evaluering av Stimulab-prosjektene',
    createdAt: daysAgo(83),
    updatedAt: daysAgo(83),
  },
  {
    id: 'tildelingsbrev-2024',
    title: 'Tildelingsbrev 2024 mot 2023',
    createdAt: daysAgo(310),
    updatedAt: daysAgo(310),
  },
];

const nkomMessages: Message[] = [
  {
    id: 'msg-nkom-question',
    role: 'user',
    content: NKOM_QUESTION,
    createdAt: daysAgo(0, 8),
    citations: [],
    status: 'complete',
  },
  {
    id: 'msg-nkom-answer',
    role: 'assistant',
    content: NKOM_ANSWER,
    createdAt: daysAgo(0, 9),
    citations: nkomCitations,
    sources: nkomSources,
    retrieval: nkomRetrieval,
    thinkingSteps: nkomThinkingSteps,
    status: 'complete',
  },
];

/** Threads that have messages. The rest resolve to an empty conversation. */
const messagesByThread: Record<string, Message[]> = {
  'nkom-maaloppnaaelse': nkomMessages,
};

export function findThread(threadId: string): ThreadDetail | null {
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
