import { filterDimensions } from '../../model';
import type {
  Excerpt,
  FilterSelection,
  SourceDocument,
  StreamEvent,
  ThinkingStep,
  Thread,
  ThreadDetail,
} from '../../model';
import { errorFromBackend } from '../backendErrors';
import type { DatasetFilterFields } from '../filterFields';
import { messagesFromApi, threadFromConversation } from '../live/conversations';
import { relevanceFromRank, toCitations } from '../live/mcp';
import type {
  BffConversationDetail,
  BffConversationSummary,
  BffSource,
  BffTurnEvent,
} from './contract';

/**
 * The BFF's wire format, translated into our model. Pure functions, so the
 * recorded fixtures can be run through them without a server.
 */

/**
 * The reader's filter, as `POST /api/ask` takes it: `{ type: ['Årsrapport'] }`.
 *
 * Keyed by the corpus's own field names from `VITE_KA_FILTER_FIELDS`, the same
 * translation the live client makes (docs/arkitektur/0001). `value-type` has
 * no place here: the BFF's contract is field to values and nothing else, and
 * the BFF decides what goes on to the backend.
 *
 * Undefined rather than `{}` when there is nothing to send, for the reason
 * `filterArguments` gives in live/mcp.ts: no opinion and an empty opinion are
 * different things, and only one of them should reach a server.
 */
export function filterBody(
  selection: FilterSelection | undefined,
  fields: DatasetFilterFields | undefined,
): Record<string, string[]> | undefined {
  if (!selection || !fields) return undefined;

  const body: Record<string, string[]> = {};
  for (const dimension of filterDimensions) {
    const mapping = fields[dimension];
    if (!mapping) continue;
    const values = (selection[dimension] ?? []).map((value) => value.trim()).filter(Boolean);
    if (values.length > 0) body[mapping.field] = values;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

/**
 * The BFF's sources as documents with excerpts.
 *
 * One entry per CHUNK arrives, and `marker` is the answer's own `[n]`, so the
 * grouping here is the same one the live client does in `toSourceDocuments`:
 * the excerpts keep their numbers, and the documents are the coarser view of
 * the same list. Excerpts are grouped per document so the title is not
 * repeated once per excerpt (answer 57).
 *
 * Before the BFF numbered per chunk this had to say the opposite, and a
 * document that gave two chunks swallowed every marker after the first.
 *
 * `excerpt` absent is not an empty quote: the chunk was retrieved, its text
 * could not be looked up. That is `textUnavailable`, which the sources panel
 * says in words rather than drawing a blank.
 */
export function sourceDocumentsFrom(sources: BffSource[] | undefined): SourceDocument[] {
  const list = sources ?? [];
  const documents = new Map<string, SourceDocument>();

  list.forEach((source, index) => {
    const id = source.docNum || source.chunkId || `doc-${source.marker}`;
    const url = source.url || undefined;
    const excerpt: Excerpt = {
      id: source.chunkId ?? `${id}-${source.marker}`,
      text: source.excerpt ?? '',
      ...(source.excerpt ? {} : { textUnavailable: true as const }),
      relevance: relevanceFromRank(index, list.length),
      ...(url ? { kudosUrl: url } : {}),
      citationNumber: source.marker,
    };

    const existing = documents.get(id);
    if (existing) {
      existing.excerpts.push(excerpt);
      return;
    }
    documents.set(id, {
      id,
      title: source.title.trim() || 'Uten tittel',
      ...(url ? { url } : {}),
      excerpts: [excerpt],
    });
  });

  return [...documents.values()];
}

/** A stored conversation as a thread. Same shape as the backend's own. */
export function threadFromSummary(summary: BffConversationSummary, corpusKey?: string): Thread {
  return { ...threadFromConversation(summary), ...(corpusKey ? { corpusKey } : {}) };
}

/**
 * One conversation with its turns.
 *
 * The messages are the backend's own shape, passed through by the BFF, so the
 * live client's reading of them is reused as it is. The sources are not: the
 * BFF keeps only the LAST answer's, in memory, so they go on the last answer
 * and every earlier one is read back without — which is what the sources
 * panel is built to say.
 *
 * `corpusKey` is the one the deployment says the BFF answers from. The BFF
 * tags nothing with a corpus, and it serves exactly one.
 */
export function threadDetailFromBff(
  detail: BffConversationDetail,
  corpusKey?: string,
): ThreadDetail {
  const thread = threadFromSummary(detail.conversation, corpusKey);
  const turns = messagesFromApi(detail.messages, corpusKey);

  const documents = sourceDocumentsFrom(detail.sources);
  const last = turns.findLastIndex((message) => message.role === 'assistant');

  return {
    ...thread,
    // As in live: the last turn is the best «last activity» there is.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages:
      documents.length === 0
        ? turns
        : turns.map((message, index) =>
            index === last
              ? { ...message, sources: documents, citations: toCitations(documents) }
              : message,
          ),
  };
}

/** The same sentences the live client shows for the same steps. */
const SEARCH_LABEL = 'Jeg søker i dokumentene.';
const READ_LABEL = 'Jeg leser utdragene.';
const FINALIZING_LABEL = 'Jeg skriver svaret med kildehenvisninger.';

/**
 * What one turn has said so far, and the translation of the next event.
 *
 * The BFF's order is `conversation`, `stage` many times, `delta`, `sources`
 * and `done` — and ours wants `sources` exactly once before `done`, even when
 * it is empty, because an answer with no sources is a state the panel draws.
 * So `sources` is held and sent with `done`.
 *
 * `starting` and `writing` show nothing. `starting` is a loop going round
 * again, which the live client drops too; `writing` is the BFF's name for the
 * agent thinking, and it carries none of the thinking's words.
 */
export class BffTurnState {
  #text = '';
  #sources: BffSource[] = [];
  #keywords: string[] = [];
  #steps = 0;
  #conversationId: string | undefined;

  /** Set when the BFF has said which conversation this turn is in. */
  get conversationId(): string | undefined {
    return this.#conversationId;
  }

  read(event: BffTurnEvent, askedOf: { corpusKey?: string } = {}): StreamEvent[] {
    switch (event.type) {
      case 'conversation':
        this.#conversationId = event.id;
        return [];

      case 'stage': {
        const step = this.#step(event.stage, event.queries);
        return step ? [{ type: 'thinking-step', step }] : [];
      }

      case 'delta':
        if (!event.text) return [];
        this.#text += event.text;
        return [{ type: 'token', text: event.text }];

      case 'sources':
        this.#sources = event.sources;
        return [];

      // The BFF passes the backend's own text through as it came, English
      // and all, so it is read for a code like the live client's and never
      // put on screen.
      case 'error':
        return [
          {
            type: 'error',
            error: errorFromBackend(event.message),
            ...askedOf,
          },
        ];

      case 'done': {
        const documents = sourceDocumentsFrom(this.#sources);
        // Searched, found nothing, said nothing: an answer with no sources,
        // not a failure. Same test and same event as the live client.
        if (documents.length === 0 && this.#text === '') {
          return [{ type: 'error', error: { code: 'no-hits' }, ...askedOf }];
        }
        return [
          {
            type: 'sources',
            documents,
            citations: toCitations(documents),
            retrieval: {
              // A hit is one chunk and a document is the grouping of them, so
              // the two are counted apart now that the BFF sends one source
              // per chunk. They were the same number for as long as it sent
              // one per document. See `sourceDocumentsFrom`.
              hitCount: documents.reduce((n, document) => n + document.excerpts.length, 0),
              documentCount: documents.length,
              keywords: this.#keywords,
            },
          },
          {
            type: 'done',
            messageId: `msg-${Date.now()}`,
            conversationId: event.conversationId || this.#conversationId || '',
            ...askedOf,
          },
        ];
      }

      default:
        return [];
    }
  }

  #step(stage: string, queries: string[] | undefined): ThinkingStep | undefined {
    const kind =
      stage === 'searching'
        ? 'search'
        : stage === 'reading'
          ? 'read'
          : stage === 'done'
            ? 'finalizing'
            : undefined;
    if (!kind) return undefined;

    const id = `${stage}-${(this.#steps += 1)}`;
    if (kind === 'read') return { id, kind, label: READ_LABEL };
    if (kind === 'finalizing') return { id, kind, label: FINALIZING_LABEL };

    // Every search the agent ran, in order and without repeats, for
    // «Fremgangsmåte» — as the live client collects them.
    for (const query of queries ?? []) {
      if (!this.#keywords.includes(query)) this.#keywords.push(query);
    }
    return { id, kind, label: SEARCH_LABEL, ...(queries ? { queries } : {}) };
  }
}
