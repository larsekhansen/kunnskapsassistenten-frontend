import type { Citation, Message, SourceDocument, Thread, ThreadDetail } from '../../model';
import { corpusKeyFromTags } from '../corpus';

/**
 * The conversation store behind `/api/conversations`.
 *
 * Measured against the running stack on 2026-09-16, not guessed from the
 * route names. What the backend actually does:
 *
 *   GET  /api/conversations       lists the conversations whose stored
 *                                 `user-id` equals the `X-User-Id` header.
 *                                 400 without that header.
 *   POST /api/conversations       creates one owned by that header, with the
 *                                 `title` given. `agent-id` is required as
 *                                 soon as the key can reach more than one
 *                                 agent, which it can locally.
 *   GET  /api/conversations/:id   the conversation and its messages.
 *
 * **Why the frontend creates the conversation itself**, rather than letting
 * `tools/call` do it, which it will: a conversation `tools/call` creates is
 * owned by the API KEY's client id, not by `X-User-Id` (`ensure-conversation!`
 * in mcp/tools.clj). It would cost one call fewer and be invisible in the
 * list forever, in a bucket shared with every other user of that key. Created
 * here it carries our id and our title, and `tools/call` appends to it when
 * it is handed the `conversation_id` — verified end to end against the local
 * stack: owner and topic both survived the turn.
 */

/** A conversation as the backend writes it. `created` is epoch milliseconds. */
export type ApiConversation = {
  id: string;
  topic?: string | null;
  agentId?: string | null;
  userId?: string | null;
  tags?: string[];
  created?: number | null;
};

/**
 * One stored chunk. Note what is NOT here: no url and no page.
 *
 * `contentMarkdown` is the passage itself, which the live stream does not
 * carry at all (`structuredContent.chunks` has ids and titles only — see
 * API-bestilling A1). So a conversation read back can hold more than the one
 * that was watched, and less: no address to send the reader to.
 */
export type ApiChunk = {
  chunkId?: string | null;
  docTitle?: string | null;
  docNum?: string | number | null;
  contentMarkdown?: string | null;
};

export type ApiMessage = {
  id: string;
  text?: string | null;
  /** `user`, `assistant` — and `system`, which is the prompt and not a turn. */
  role?: string | null;
  created?: number | null;
  chunks?: ApiChunk[] | null;
  /**
   * Written down because the backend sends them, not because anything here
   * reads them. `filterValue` is the narrowing the turn was asked with, which
   * the frontend does not use yet (API-bestilling A2), and `tags` is the
   * conversation store's own labelling.
   */
  tags?: string[] | null;
  filterValue?: string | null;
};

/**
 * The agent id for `POST /api/conversations`, derived from the MCP tool name.
 *
 * The same agent has two spellings, and only one works in each place:
 * `builtin.agent-rag-agent__agent-rag-graph-bundled` names the tool,
 * `builtin/agent-rag-agent` names the agent. Measured on three agents
 * (`builtin.agent-rag-agent`, `digdir.altinn-docs-tuned`,
 * `builtin.ai-overview-agent`): drop the skill graph after `__`, and the
 * first dot is a slash. Passing the tool name gives «Agent not found».
 *
 * Derived rather than configured because a second setting that must agree
 * with the first is a second thing to get wrong. `agentId` in the options
 * overrides it for a backend that names them differently.
 */
export function agentIdFromToolName(toolName: string): string {
  const withoutSkillGraph = toolName.split('__')[0] ?? toolName;
  return withoutSkillGraph.replace('.', '/');
}

/** Epoch milliseconds to ISO 8601, which is what the model holds. */
function isoFrom(created: number | null | undefined, fallback: string): string {
  if (typeof created !== 'number' || !Number.isFinite(created)) return fallback;
  return new Date(created).toISOString();
}

/**
 * A stored conversation as a thread in the list.
 *
 * `updatedAt` is the creation time, because that is all there is: the record
 * has `created` and nothing that moves when a turn is added. The thread list
 * groups on `updatedAt` — «I dag», «Siste 7 dager» — so a conversation
 * answered today but started last month is filed under last month. That is a
 * gap in the backend and not something to paper over here; a guessed
 * timestamp would put rows in the wrong group just as wrongly, without saying
 * so.
 *
 * `titleFromQuestion` is true because the title we `POST` is the reader's own
 * first question. The day the backend writes a real topic, this is what has
 * to stop being set.
 */
export function threadFromConversation(conversation: ApiConversation): Thread {
  const createdAt = isoFrom(conversation.created, new Date(0).toISOString());
  const topic = conversation.topic?.trim();
  const corpusKey = corpusKeyFromTags(conversation.tags);
  return {
    id: conversation.id,
    title: topic === undefined || topic === '' ? 'Uten tittel' : topic,
    titleFromQuestion: true,
    createdAt,
    updatedAt: createdAt,
    conversationId: conversation.id,
    // Written by `#createConversation` when the thread was made. Absent on
    // threads from before there was a choice, which is why it is optional
    // rather than defaulted to whatever is selected now — a thread's corpus
    // is a fact about when it was asked, not about the reader's current pick.
    ...(corpusKey ? { corpusKey } : {}),
  };
}

/**
 * The sources behind one stored answer, grouped per document (answer 57).
 *
 * Returns undefined when the message carries no chunks, and that is the state
 * the backend is in today: measured against the local stack, an answer read
 * back had `chunks: []` even though the field exists and the live turn had
 * retrieved five. Undefined and empty mean different things to the sources
 * panel — «nothing is known» against «nothing was found» — and this is the
 * first.
 *
 * No `kudosUrl` on the excerpts and no `url` on the documents: the stored
 * chunk has neither. The panel already draws an excerpt with nowhere to go.
 */
export function sourcesFromChunks(
  chunks: ApiChunk[] | null | undefined,
): SourceDocument[] | undefined {
  if (!chunks || chunks.length === 0) return undefined;

  const documents = new Map<string, SourceDocument>();

  chunks.forEach((chunk, index) => {
    const documentId = String(chunk.docNum ?? chunk.chunkId ?? `doc-${index}`);
    const excerpt = {
      id: chunk.chunkId ?? `${documentId}-${index}`,
      text: chunk.contentMarkdown ?? '',
      // The order the backend returns them in is the ranking, and `[n]` in
      // the answer is 1-indexed into it. Same convention as the live stream.
      relevance: 'medium' as const,
      citationNumber: index + 1,
    };

    const existing = documents.get(documentId);
    if (existing) {
      existing.excerpts.push(excerpt);
      return;
    }

    documents.set(documentId, {
      id: documentId,
      title: chunk.docTitle?.trim() || 'Uten tittel',
      excerpts: [excerpt],
    });
  });

  return [...documents.values()];
}

function citationsFromSources(documents: SourceDocument[] | undefined): Citation[] {
  return (documents ?? []).flatMap((document) =>
    document.excerpts
      .filter((excerpt) => excerpt.citationNumber !== undefined)
      .map((excerpt) => ({
        number: excerpt.citationNumber as number,
        excerptId: excerpt.id,
        documentId: document.id,
      })),
  );
}

/**
 * How many distinct `[n]` an answer's text carries.
 *
 * Distinct, because the number is «how many sources does this answer point
 * at», not «how many times does it point». The recorded answer writes `[2]`
 * twice, and it is still one source.
 *
 * Counted off the text rather than taken from the store, because the store is
 * exactly what is missing: the backend keeps the answer and not the chunks
 * behind it, so this is the only place left that knows the markers were ever
 * there.
 */
export function citationCountIn(text: string | null | undefined): number {
  const numbers = new Set((text ?? '').match(/\[\d+\]/g) ?? []);
  return numbers.size;
}

/**
 * The stored messages as turns.
 *
 * `system` is dropped: the stack writes «You are a helpful assistant.» as the
 * first message of every conversation, and that is the prompt rather than
 * something anybody said. Measured on the local stack.
 *
 * A message with no text is dropped too. A turn that failed leaves one
 * behind, and an empty bubble in the middle of a conversation reads as a
 * rendering fault rather than as what it is.
 */
export function messagesFromApi(messages: ApiMessage[] | null | undefined): Message[] {
  return (messages ?? [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => (message.text ?? '').trim() !== '')
    .map((message) => {
      const sources = sourcesFromChunks(message.chunks);
      const role = message.role === 'user' ? ('user' as const) : ('assistant' as const);
      return {
        id: message.id,
        role,
        content: message.text ?? '',
        createdAt: isoFrom(message.created, new Date(0).toISOString()),
        citations: citationsFromSources(sources),
        // Only an answer cites. A question with brackets in it is a question
        // with brackets in it.
        ...(role === 'assistant' ? { citationCount: citationCountIn(message.text) } : {}),
        ...(sources ? { sources } : {}),
        status: 'complete' as const,
      };
    });
}

export function threadDetailFrom(
  conversation: ApiConversation,
  messages: ApiMessage[] | null | undefined,
): ThreadDetail {
  const thread = threadFromConversation(conversation);
  const turns = messagesFromApi(messages);
  return {
    ...thread,
    // The last turn is the best «last activity» available, and it is better
    // than `created` whenever there is one. The list endpoint returns no
    // messages, so only a thread that has been opened can say this.
    updatedAt: turns.at(-1)?.createdAt ?? thread.updatedAt,
    messages: turns,
  };
}
