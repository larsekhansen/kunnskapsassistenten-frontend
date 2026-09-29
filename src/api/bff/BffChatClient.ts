import type {
  ChatError,
  FilterFacet,
  FilterSelection,
  StreamEvent,
  Thread,
  ThreadDetail,
} from '../../model';
import type { AskParams, ChatClient, ThreadCertainty } from '../chatClient';
import { filterFieldsFor } from '../filterFields';
import type { DatasetFilterFields } from '../filterFields';
import { errorFromBackend, errorFromStatus } from '../backendErrors';
import { createSseDecoder } from '../live/sse';
import type {
  BffAskRequest,
  BffCapabilities,
  BffConversationDetail,
  BffConversationSummary,
  BffFacet,
  BffTurnEvent,
} from './contract';
import { facetsFrom } from '../facets';
import { BffTurnState, filterBody, threadDetailFromBff, threadFromSummary } from './mapping';

export type BffChatClientOptions = {
  /** Where the BFF's API is. Relative: the BFF serves this client itself. */
  basePath?: string;
  /**
   * Which corpus the BFF answers from, read per call as in live.
   *
   * The BFF serves one dataset, set in its own environment, and this does not
   * choose it — nothing on the wire says which one it is. It is the
   * deployment's statement of the same thing, and it is used for two jobs:
   * the field names in `VITE_KA_FILTER_FIELDS`, and saying which corpus an
   * answer came from.
   */
  datasetConfigKey?: () => string | undefined;
  /** Defaults to the deployment's configuration, as in live. */
  filterFields?: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  /**
   * What a 401 does. Defaults to the BFF's own sign-in, which comes back to
   * the page the reader was on. An option so a test can see it happen.
   */
  onUnauthorized?: () => void;
  /**
   * How long to wait between asking whether the BFF's startup probe has
   * finished. See `#capabilities`.
   */
  settleDelaysMs?: number[];
};

let redirecting = false;

/**
 * To the BFF's sign-in, and back to where the reader was.
 *
 * Once per page: several calls fail with 401 at once when a session runs
 * out, and one navigation is enough. Not from `/auth/` itself, which would
 * loop.
 */
function toLogin(): void {
  if (redirecting || window.location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/auth/login?next=${next}`);
}

/**
 * The conversation the questions that follow belong to. Module state for the
 * reason it is in live (LiveChatClient.ts): the shell and the chat view each
 * build a client, and they have to agree.
 */
let openConversation: string | undefined;

/**
 * A thread the shell is waiting to hear the real id of.
 *
 * The BFF has no endpoint that makes a conversation. `POST /api/ask` does it,
 * and says so in its first event. So `createThread` cannot make one — it
 * waits for the question that is about to be asked, and the `conversation`
 * event of that question is its answer. The shell calls it a tick before it
 * asks (ChatSlotView.tsx), which is why this is a promise and not a callback
 * the ask looks for.
 */
let creation: { promise: Promise<string | undefined>; settle: (id?: string) => void } | undefined;

function awaitCreation(): NonNullable<typeof creation> {
  if (creation) return creation;
  let settle!: (id?: string) => void;
  const promise = new Promise<string | undefined>((resolve) => {
    settle = resolve;
  });
  creation = { promise, settle };
  return creation;
}

/** What the BFF can do, once it has said so for certain. Kept for the page's life. */
let settledCapabilities: BffCapabilities | undefined;

/** For tests: forget the open conversation, the waiting thread and the probe. */
export function resetBffClient(): void {
  openConversation = undefined;
  creation = undefined;
  settledCapabilities = undefined;
  redirecting = false;
}

const NOT_SETTLED: BffCapabilities = {
  capabilities: { filters: false, othersThreads: false, threadTitles: false },
  settled: false,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The client against Nikolai's BFF (`apps/server` in digdir/kunnskapsassistenten).
 *
 * The BFF holds the API key and the sign-in, and the identity comes from the
 * session cookie rather than from anything this client sends — so there is
 * no `X-User-Id` here, and no tenant or dataset on the wire. The browser
 * sends a question; the server decides what it is asked of
 * (docs/arkitektur/0002-klienten-bak-bff.md).
 */
export class BffChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #corpusKey: () => string | undefined;
  readonly #filterFields: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  readonly #onUnauthorized: () => void;
  readonly #settleDelaysMs: number[];

  constructor(options: BffChatClientOptions = {}) {
    this.#basePath = options.basePath ?? '/api';
    this.#corpusKey = options.datasetConfigKey ?? (() => undefined);
    this.#filterFields = options.filterFields ?? filterFieldsFor;
    this.#onUnauthorized = options.onUnauthorized ?? toLogin;
    this.#settleDelaysMs = options.settleDelaysMs ?? [2000, 4000, 6000];
  }

  /** Every call goes through here, so a 401 anywhere leads to sign-in. */
  async #fetch(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.#basePath}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (response.status === 401) this.#onUnauthorized();
    return response;
  }

  async #json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await this.#fetch(path, { signal });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return (await response.json()) as T;
  }

  /**
   * What the BFF can do.
   *
   * It probes the backend when it starts, and until that is done it says
   * `filters: false` with `settled: false`. A settled answer is kept; an
   * unsettled one is not, so the next call asks afresh.
   *
   * `patient` is for the filter panel, which is drawn once and would
   * otherwise say «no filters» for good to a page loaded in the seconds the
   * probe takes. So it asks again a few times before it believes it. A
   * question does not wait like that: it asks once, and without a settled yes
   * it goes without the filter — the panel had none to offer anyway.
   *
   * No abort signal, on purpose. The answer is shared, and one caller giving
   * up must not decide it for the others.
   */
  async #capabilities(patient = false): Promise<BffCapabilities> {
    if (settledCapabilities) return settledCapabilities;

    const delays = patient ? this.#settleDelaysMs : [];
    for (let attempt = 0; ; attempt += 1) {
      const found = await this.#json<BffCapabilities>('/capabilities').catch(() => NOT_SETTLED);
      if (found.settled) {
        settledCapabilities = found;
        return found;
      }
      const delay = delays[attempt];
      if (delay === undefined) return found;
      await wait(delay);
    }
  }

  /** Nothing to send when the BFF says its backend cannot filter. */
  async #filter(
    selection: FilterSelection | undefined,
    corpusKey: string | undefined,
  ): Promise<Record<string, string[]> | undefined> {
    const body = filterBody(selection, this.#filterFields(corpusKey));
    if (!body) return undefined;
    const { capabilities: can } = await this.#capabilities();
    return can.filters ? body : undefined;
  }

  /**
   * Which conversation the next question belongs to.
   *
   * `conversationId`, as in live — and for `id-only`, the id itself. That is
   * the shell saying «the address names this thread, it has not been read
   * yet»; the address is `/threads/<conversation id>`, so the id is the one
   * thing about it that is certain, and it is the conversation's.
   */
  openThread(thread: Thread, certainty?: ThreadCertainty): void {
    openConversation = thread.conversationId ?? (certainty === 'id-only' ? thread.id : undefined);
  }

  /**
   * The thread as the BFF names it, once the question that makes it has been
   * asked. See `creation`.
   */
  async createThread(thread: Thread): Promise<Thread | undefined> {
    openConversation = undefined;
    const id = await awaitCreation().promise;
    return id ? { ...thread, id, conversationId: id } : undefined;
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const corpusKey = this.#corpusKey();
    const askedOf = corpusKey ? { corpusKey } : {};
    const conversationId = params.conversationId ?? openConversation;
    // A question with no conversation makes one, and a thread may be waiting
    // to hear what it is called. It hears it the moment the BFF says, not
    // when the answer is done: the address should not wait for fifteen
    // seconds of answer.
    const creating = conversationId ? undefined : awaitCreation();
    const made = (id: string) => {
      openConversation = id;
      creating?.settle(id);
    };

    try {
      yield* this.#stream(params, conversationId, corpusKey, askedOf, made);
    } finally {
      if (creating) {
        // Nothing was made if the BFF never said so. Settling twice is a
        // no-op, so this only matters for a question that failed first.
        creating.settle(undefined);
        if (creation === creating) creation = undefined;
      }
    }
  }

  async *#stream(
    params: AskParams,
    conversationId: string | undefined,
    corpusKey: string | undefined,
    askedOf: { corpusKey?: string },
    made: (id: string) => void,
  ): AsyncGenerator<StreamEvent> {
    const state = new BffTurnState();
    const aborted = (): ChatError => ({ code: 'aborted' });

    let response: Response;
    try {
      const filter = await this.#filter(params.filters, corpusKey);
      const body: BffAskRequest = {
        query: params.query,
        ...(conversationId ? { conversationId } : {}),
        ...(filter ? { filter } : {}),
      };
      response = await this.#fetch('/ask', {
        method: 'POST',
        signal: params.signal,
        headers: { Accept: 'text/event-stream' },
        body: JSON.stringify(body),
      });
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? aborted()
          : { code: 'unknown', message: 'Fikk ikke kontakt med tjenesten.' },
        ...askedOf,
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: await errorFromResponse(response), ...askedOf };
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
          let event: BffTurnEvent;
          try {
            event = JSON.parse(frame.data) as BffTurnEvent;
          } catch {
            continue;
          }
          if (event.type === 'conversation') made(event.id);

          const translated = state.read(event, askedOf);
          yield* translated;
          if (translated.some((out) => out.type === 'done' || out.type === 'error')) return;
        }

        if (done) break;
      }
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? aborted()
          : { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
        ...askedOf,
      };
      return;
    } finally {
      await reader.cancel().catch(() => {});
    }

    // The BFF always ends with `done` or `error`. A stream that stops without
    // either was cut off somewhere between the two.
    yield {
      type: 'error',
      error: { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
      ...askedOf,
    };
  }

  /** The reader's conversations, newest first. Empty on failure, as in live. */
  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    try {
      const { conversations } = await this.#json<{ conversations?: BffConversationSummary[] }>(
        '/conversations',
        signal,
      );
      const corpusKey = this.#corpusKey();
      return (conversations ?? []).map((summary) => threadFromSummary(summary, corpusKey));
    } catch {
      return [];
    }
  }

  /** Null for «not there» and «could not ask», as in live. */
  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    try {
      const detail = await this.#json<BffConversationDetail>(
        `/conversations/${encodeURIComponent(threadId)}`,
        signal,
      );
      return detail.conversation ? threadDetailFromBff(detail, this.#corpusKey()) : null;
    } catch {
      return null;
    }
  }

  /**
   * The facets the BFF counts, as the filter panel's dropdowns — or none when
   * the BFF says its backend cannot filter, which the panel draws as
   * «Filtrering er ikke tilgjengelig ennå».
   *
   * Throws when the BFF cannot be reached, so the panel can offer to try again.
   */
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    const { capabilities: can } = await this.#capabilities(true);
    // The probe is not the caller's to cancel (see above), so the caller's
    // own abort is honoured here — the panel drops a stale answer by it.
    signal?.throwIfAborted();
    if (!can.filters) return [];
    const { facets } = await this.#json<{ facets?: BffFacet[] }>('/facets', signal);
    return facetsFrom(facets ?? [], this.#filterFields(this.#corpusKey()), selection);
  }
}

/**
 * An HTTP error from `/api/ask`, as a code — and, when the BFF's sentence is
 * one this client knows, a sentence of its own. The BFF's text is read like
 * the backend's and never shown as it stands: most of it is written for
 * whoever runs the service, and what is not («Spørsmålet er for langt (maks
 * 2000 tegn).») is translated in `errorFromBackend`, so the screen only ever
 * says what this client wrote.
 */
async function errorFromResponse(response: Response): Promise<ChatError> {
  const fromStatus = errorFromStatus(response.status);
  if (fromStatus.code !== 'unknown') return fromStatus;
  const body = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (typeof body.error !== 'string' || !body.error.trim()) return fromStatus;
  const fromText = errorFromBackend(body.error);
  return fromText.code === 'unknown' && !fromText.message ? fromStatus : fromText;
}
