import { chatErrorCode } from '../../model';
import type { ChatError, FilterFacet, StreamEvent, Thread, ThreadDetail } from '../../model';
import type { AskParams, ChatClient } from '../chatClient';
import { CORPUS_TAG_PREFIX } from '../corpus';
import { filterFieldsFor } from '../filterFields';
import type { DatasetFilterFields } from '../filterFields';
import {
  DEFAULT_TOOL_NAME,
  MCP_PROTOCOL_VERSION,
  McpStreamState,
  datasetArguments,
  filterArguments,
  toCitations,
  toSourceDocuments,
} from './mcp';
import { createSseDecoder } from './sse';
import {
  agentIdFromToolName,
  threadDetailFrom,
  threadFromConversation,
  type ApiConversation,
  type ApiMessage,
} from './conversations';
import { currentUserId } from './userId';

export type LiveChatClientOptions = {
  /** Where the proxy lives. Relative on purpose: same origin, no CORS. */
  basePath?: string;
  toolName?: string;
  /**
   * Which corpus to ask. Both or neither; see `datasetArguments` in mcp.ts.
   * Left out, the backend picks, which is the behaviour up to now.
   *
   * These are dataset names and not credentials, which is why they may come
   * from `VITE_`-prefixed variables at all. The API key is a different thing
   * entirely and stays with the proxy.
   */
  tenant?: string;
  /**
   * Which corpus to ask — read on every call, not once.
   *
   * A function and not a string, because the corpus is a runtime choice now:
   * the reader picks one, and the next question has to go to that one. The
   * client is built once by `createChatClient()`, so a value resolved in the
   * constructor would pin the app to whatever was selected at startup.
   *
   * `createChatClient` wires this to the store in src/api/corpus.ts. Tests
   * pass a closure over a local variable, which is the whole reason it is an
   * argument rather than a direct import.
   */
  datasetConfigKey?: string | (() => string | undefined);
  /**
   * What the corpus in question calls the design's three filter dimensions.
   *
   * A function of the dataset key, because a client outlives a corpus choice:
   * the reader may switch corpus between two questions, and the second one
   * has to be filtered by the second corpus's field names.
   *
   * Defaults to the deployment's configuration in src/api/filterFields.ts,
   * so nothing has to be wired in `createChatClient` — the field names are
   * read once at startup and do not change while the app runs. It is an
   * option at all so a test can state a mapping without an environment.
   */
  filterFields?: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  /**
   * Which agent owns a conversation this client creates. Derived from the
   * tool name when left out; see `agentIdFromToolName` for why the two are
   * spelled differently and why deriving beats a second setting.
   */
  agentId?: string;
};

/**
 * What an HTTP status says about the turn, and what it does not.
 *
 * Only what the status actually establishes. A 5xx means the backend broke;
 * it does not say whether the language model was down or the search was, and
 * the two want opposite things from the reader — so it is `unknown` and says
 * so, rather than guessing at a code the reader would act on
 * (API-bestilling A16 asks the backend for the missing half).
 *
 * The status number stays in the text: it is the one thing anyone debugging
 * this from a screenshot has to go on.
 */
function errorFromStatus(status: number): ChatError {
  switch (status) {
    case 401:
    case 403:
      return { code: 'unauthorized' };
    case 408:
    case 504:
      return { code: 'timeout' };
    case 429:
      return { code: 'rate-limited' };
    default:
      return { code: 'unknown', message: `Kunnskapsassistenten svarte med feil (${status}).` };
  }
}

/**
 * The client against the KA backend.
 *
 * It talks to a proxy on the same origin, never to the backend directly, for
 * two measured reasons: the API key must not be in the bundle, and the
 * backend sends no CORS headers at all, so a browser would refuse the
 * response even if it had the key. The Vite dev server is that proxy here;
 * production needs a real one. See design/eksisterende/api-for-frontend.md.
 *
 * `listThreads` and `getThread` read the conversation store; see
 * conversations.ts for what the backend keeps and what it drops. They used to
 * return nothing, on the belief that a conversation could not be read back at
 * all — it can, once the conversation is created with an owner this reader
 * can be listed by.
 *
 * `listFacets` still returns nothing on purpose: the backend filters by whole
 * dataset, so there are no counts to give (API-bestilling A2). Mock mode has
 * the data, live mode says the truth.
 */
/**
 * The conversation the questions that follow belong to.
 *
 * Module state and not an instance field, for the reason the mock's
 * `openThreadId` is (sessionThreads.ts): there is more than one client in the
 * running app — the shell builds one to read the thread, the chat view builds
 * another to ask questions — and they have to agree about which conversation
 * is on screen. A client is a stand-in for one backend, so it has one session.
 *
 * It holds a promise while the conversation is being made, and that is the
 * point rather than a detail: `createThread` and the first `ask` start within
 * a tick of each other, and two creators would mean two conversations — the
 * address pointing at one and the answer landing in the other. A question
 * asked in that gap awaits the same creation instead of starting its own.
 */
let openConversation: string | Promise<string | undefined> | undefined;

/** For tests: forget which conversation is open. */
export function resetLiveConversation(): void {
  openConversation = undefined;
}

export class LiveChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #toolName: string;
  readonly #tenant: string | undefined;
  readonly #corpusKey: () => string | undefined;
  readonly #filterFields: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  readonly #agentId: string;

  constructor(options: LiveChatClientOptions = {}) {
    this.#basePath = options.basePath ?? '/api';
    this.#toolName = options.toolName ?? DEFAULT_TOOL_NAME;
    this.#tenant = options.tenant;
    this.#corpusKey =
      typeof options.datasetConfigKey === 'function'
        ? options.datasetConfigKey
        : () => options.datasetConfigKey as string | undefined;
    this.#filterFields = options.filterFields ?? filterFieldsFor;
    this.#agentId = options.agentId ?? agentIdFromToolName(this.#toolName);
  }

  /**
   * The corpus arguments for the call about to be made.
   *
   * Resolved per call rather than in the constructor, which is the change
   * runtime corpus choice asked for. `datasetArguments` still enforces the
   * backend's both-or-neither rule and still warns; it now warns per question
   * instead of once at startup, and that is the right trade — a reader who
   * switches corpus mid-session should hear about a broken pair then, not
   * only if they reload.
   */
  #dataset(): Record<string, string> {
    return datasetArguments(this.#tenant, this.#corpusKey());
  }

  /**
   * Which conversation the questions that follow belong to.
   *
   * Only `conversationId` is read, never `thread.id`, and the difference is
   * the whole of this change. In live the two are the same string for a
   * thread that exists — `threadFromConversation` sets both from the
   * backend's id — while a stand-in minted by the shell has an id this
   * browser made up and no `conversationId` at all. Reading the id would
   * therefore send a uuid the backend has never seen as `conversation_id`.
   *
   * Undefined clears it, and that is right: a new thread must not continue
   * the conversation the reader just left.
   */
  openThread(thread: Thread): void {
    openConversation = thread.conversationId;
  }

  /**
   * Make the conversation, and hand back the thread as the backend names it.
   *
   * The id IS the conversation id here. A thread in live is a conversation in
   * `/api/conversations`, so giving it a second identity of our own is what
   * produced an address that 404-ed (brukerblikk 8).
   *
   * The pending creation is published before it is awaited, so a question
   * asked in the same tick joins it rather than making a second conversation.
   */
  async createThread(thread: Thread, signal?: AbortSignal): Promise<Thread | undefined> {
    const dataset = this.#dataset();
    const pending = this.#createConversation(thread.title, dataset.dataset_config_key, signal);
    openConversation = pending;

    const id = await pending;
    if (id === undefined) {
      // Nothing was made, so nothing is open. `ask` will try again on its own,
      // which is what it did before this method existed.
      openConversation = undefined;
      return undefined;
    }

    openConversation = id;
    return { ...thread, id, conversationId: id };
  }

  /**
   * The conversation store. Every call needs `X-User-Id`; the API key is the
   * proxy's business and never appears here.
   */
  async #conversations(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.#basePath}/conversations${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId(),
        ...init?.headers,
      },
    });
  }

  /**
   * Make the conversation before asking, so it belongs to this reader.
   *
   * `tools/call` would make one for free, and that is the trap: it stores the
   * API key's client id as the owner, and `/api/conversations` lists by
   * `X-User-Id`. The cheaper path produces threads nobody can ever list, in a
   * bucket shared with every other user of the key. See conversations.ts.
   *
   * Returns undefined if it fails. A thread that cannot be created is a
   * reason to answer without one, not a reason not to answer: the turn still
   * streams, and `tools/call` falls back to making its own.
   */
  async #createConversation(
    title: string,
    corpusKey: string | undefined,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    try {
      const response = await this.#conversations('', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          title: title.trim().replace(/\s+/g, ' '),
          'agent-id': this.#agentId,
          /*
            The corpus the thread belongs to, stored on the thread itself.

            `tags` is the backend's own field and it keeps what it is given —
            measured against the running stack on 21.09: a conversation
            created with `["corpus:kudos-pilot"]` came back with it from both
            `GET /api/conversations` and `GET /api/conversations/:id`. So the
            brief's fallback of keeping this in local metadata is not needed;
            a thread read on another machine still knows its corpus.

            Prefixed, because `tags` is a shared list the conversation store
            labels things with. `corpus:` is ours; see `corpusKeyFromTags`.
          */
          ...(corpusKey ? { tags: [`${CORPUS_TAG_PREFIX}${corpusKey}`] } : {}),
        }),
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { conversation?: ApiConversation };
      return body.conversation?.id;
    } catch {
      return undefined;
    }
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const state = new McpStreamState();
    /*
      Resolved once per question and then used for both calls below, so the
      conversation is tagged with the same corpus the tool call searches. Two
      reads could disagree if the reader switched corpus between them — which
      takes a deliberate act and starts a new thread anyway, but a question
      that searched one corpus and was filed under another would be a thread
      whose sources do not match its label, and that is not worth leaving to
      timing.
    */
    const dataset = this.#dataset();
    /*
      The corpus this turn is asked of, as the call itself carries it — which
      is why it is read off `dataset` and not off the store a second time.
      Absent when the pair was not configured: `datasetArguments` then sends
      neither value and the backend picks its own dataset, and nothing on this
      side knows which one that was. Undefined is «not known», and every frame
      below says so by leaving the field out.
    */
    const askedOf = dataset.dataset_config_key ? { corpusKey: dataset.dataset_config_key } : {};
    // The first turn of a thread makes the conversation; every later one
    // already has the id and goes straight to the tool call.
    /*
      Three sources, most specific first. The caller's own is the turn's — a
      follow-up carries the conversation it is a follow-up in. The open one is
      the thread on screen, made by `createThread` or read off the thread the
      shell opened. Only when there is neither is a conversation made here,
      which is the first question of a thread nobody minted for us.
    */
    const conversationId =
      params.conversationId ??
      (await openConversation) ??
      (await this.#createConversation(params.query, dataset.dataset_config_key, params.signal));
    /*
      The reader's filter, in the backend's own filter format.

      Resolved from the same `dataset` the query is sent with, so the field
      names belong to the corpus being asked — reading the corpus store a
      second time could translate the filter with one corpus's field names
      and search another's, which would be a filter on a field that is not
      there and no hits for a question that has answers.

      Empty when nothing is ticked, when this corpus has no configured field
      for what is ticked, or when the backend is picking the dataset itself.
      See `filterArguments`.
    */
    const filters = filterArguments(params.filters, this.#filterFields(dataset.dataset_config_key));
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: this.#toolName,
        arguments: {
          query: params.query,
          ...dataset,
          ...filters,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
          // Setting this is what turns the response into a stream. Without
          // it the server answers with one JSON body when the agent is done.
          progressToken: `ka-${Date.now()}`,
        },
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.#basePath}/mcp`, {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          // These three must agree with the body or the server answers 400
          // with -32020. The API key is added by the proxy, never here.
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
          'Mcp-Method': 'tools/call',
          'Mcp-Name': this.#toolName,
        },
        body: JSON.stringify(body),
      });
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? { code: 'aborted' }
          : // A fetch that never came back says the browser could not reach
            // the proxy. Whether the corpus behind it is up is not something
            // this can know, so the code stays `unknown` and the sentence
            // says the one thing that was observed.
            { code: 'unknown', message: 'Fikk ikke kontakt med tjenesten.' },
        ...askedOf,
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: errorFromStatus(response.status), ...askedOf };
      return;
    }
    if (!response.body) {
      yield {
        type: 'error',
        error: { code: 'unknown', message: 'Tomt svar fra tjeneren.' },
        ...askedOf,
      };
      return;
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const decoder = createSseDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        const frames = done ? decoder.flush() : decoder.push(value ?? '');

        for (const frame of frames) {
          yield* readFrame(frame.data, state, conversationId, askedOf);
        }

        if (done) return;
      }
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? { code: 'aborted' }
          : { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
        ...askedOf,
      };
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  /**
   * The reader's own conversations, newest first.
   *
   * The comment that stood here said a conversation created by `tools/call`
   * carries no owner and cannot be read back. It carries one — the API key's
   * client id — which is not the reader's, and that is what made it look like
   * none. Creating the conversation ourselves is what fixed it; see
   * `#createConversation`.
   *
   * An empty list on failure, and no throw: the thread list is chrome around
   * the answer, and a panel that cannot load its rows must not take the page
   * with it. `page_size` is the backend's maximum (100).
   */
  async listThreads(): Promise<Thread[]> {
    try {
      const response = await this.#conversations('?page_size=100');
      if (!response.ok) return [];
      const body = (await response.json()) as { conversations?: ApiConversation[] };
      return (body.conversations ?? []).map(threadFromConversation);
    } catch {
      return [];
    }
  }

  /**
   * One conversation with its turns, or null when there is none to show.
   *
   * Null covers «no such conversation» and «could not ask», because the route
   * does the same thing with both: it draws «Fant ikke tråden» rather than an
   * empty conversation the reader could type into.
   */
  async getThread(threadId: string): Promise<ThreadDetail | null> {
    try {
      const response = await this.#conversations(`/${encodeURIComponent(threadId)}`);
      if (!response.ok) return null;
      const body = (await response.json()) as {
        conversation?: ApiConversation;
        messages?: ApiMessage[];
      };
      if (!body.conversation) return null;
      return threadDetailFrom(body.conversation, body.messages);
    } catch {
      return null;
    }
  }

  /**
   * backend: mangler, se API-bestilling A2 — the backend filters by whole
   * dataset, so there are no facets to count within one.
   */
  async listFacets(): Promise<FilterFacet[]> {
    return [];
  }
}

/** The answer text in the final frame, if it carried one. */
function finalAnswerText(content: { type?: string; text?: string }[] | undefined): string {
  return content?.find((block) => block.type === 'text')?.text ?? '';
}

/** Turns one decoded SSE payload into zero or more of our events. */
function* readFrame(
  data: string,
  state: McpStreamState,
  fallbackConversationId?: string,
  /**
   * `{ corpusKey }` or `{}`, ready to spread — the corpus the call was made
   * against, resolved once in `ask`. A spreadable object rather than a
   * `string | undefined`, so «not known» leaves the field out of the frame
   * instead of putting `undefined` in it.
   */
  askedOf: { corpusKey?: string } = {},
): Generator<StreamEvent> {
  let message: {
    method?: string;
    params?: { _meta?: Record<string, unknown> };
    result?: {
      isError?: boolean;
      content?: { type?: string; text?: string }[];
      structuredContent?: { chunks?: unknown[]; conversation_id?: string };
      _meta?: { conversation_id?: string; status?: string; error_code?: string };
    };
    /**
     * `data.code` is API-bestilling A16: a small documented set of codes, so
     * «modellen svarer ikke» and «korpuset er nede» can be told apart. Not
     * sent yet, and read as `unknown` until it is — including any code this
     * frontend has not heard of.
     */
    error?: { message?: string; data?: { code?: string } };
  };

  try {
    message = JSON.parse(data);
  } catch {
    // A frame we cannot read is not worth ending the answer over.
    return;
  }

  if (message.error) {
    yield {
      type: 'error',
      error: {
        code: chatErrorCode(message.error.data?.code),
        message: message.error.message ?? 'Ukjent feil fra tjeneren.',
      },
      ...askedOf,
    };
    return;
  }

  if (message.method === 'notifications/progress') {
    yield* state.progress(message.params?._meta ?? {});
    return;
  }

  const result = message.result;
  if (!result) return;

  // A tool that ran and failed is 200 with isError: true. An answer that says
  // the evidence was thin is isError: false and a perfectly good answer.
  //
  // The agent says it failed, not which half of it did — so `unknown` unless
  // `_meta.error_code` is there to say (A16), and its own text stands as the
  // first sentence either way.
  if (result.isError) {
    const text = result.content?.find((block) => block.type === 'text')?.text;
    yield {
      type: 'error',
      error: {
        code: chatErrorCode(result._meta?.error_code),
        message: text ?? 'Spørringen feilet.',
      },
      ...askedOf,
    };
    return;
  }

  const chunks = (result.structuredContent?.chunks ?? []) as Parameters<
    typeof toSourceDocuments
  >[0];
  const documents = toSourceDocuments(chunks);

  // Anything still held back was answer text after all: nothing followed it
  // to prove it was the agent's plan.
  yield* state.flushPending();

  // The final frame carries the whole answer. Against this agent that is the
  // only place it appears, because the deltas were all reasoning — so emit it
  // unless the stream already delivered the text, which would double it.
  const finalText = state.answerText === '' ? finalAnswerText(result.content) : state.answerText;

  /*
   * Nothing found and nothing said. The agent searched, came back with no
   * chunks and wrote no answer — which is not a failure, it is an answer with
   * an empty source list, and the chat draws it as one (A16 asks the backend
   * to report it that way too). Told apart from a failure by both halves
   * being empty: an answer that cites nothing is still an answer, and a
   * `sources` frame with no documents is what the panel needs to say so.
   */
  if (documents.length === 0 && finalText === '') {
    yield { type: 'error', error: { code: 'no-hits' }, ...askedOf };
    return;
  }

  if (state.answerText === '' && finalText !== '') {
    yield { type: 'token', text: finalText };
  }

  yield {
    type: 'sources',
    documents,
    citations: toCitations(documents),
    retrieval: state.retrieval(documents, chunks.length),
  };

  yield {
    type: 'done',
    messageId: `msg-${Date.now()}`,
    conversationId:
      result._meta?.conversation_id ??
      result.structuredContent?.conversation_id ??
      fallbackConversationId ??
      '',
    // Only the one value is read. `complete` is the default anyway, and the
    // schema's `error` is left alone on purpose: a failed turn already came
    // through as an `error` event above, from `isError`. If a frame ever
    // arrives saying `error` without `isError`, this drops it rather than
    // inventing a second route to the same state — and that is worth finding
    // out about rather than papering over.
    ...(result._meta?.status === 'needs-clarification'
      ? { outcome: 'needs-clarification' as const }
      : {}),
    ...askedOf,
  };
}
