import type { ChatError, FilterFacet, StreamEvent, Thread, ThreadDetail } from '../../model';
import type { AskParams, ChatClient } from '../chatClient';
import {
  DEFAULT_TOOL_NAME,
  MCP_PROTOCOL_VERSION,
  McpStreamState,
  toCitations,
  toSourceDocuments,
} from './mcp';
import { createSseDecoder } from './sse';

export type LiveChatClientOptions = {
  /** Where the proxy lives. Relative on purpose: same origin, no CORS. */
  basePath?: string;
  toolName?: string;
};

/** The server answers two ways, and the question they answer is not the same. */
function errorFromStatus(status: number): ChatError {
  switch (status) {
    case 401:
    case 403:
      return { code: 'unauthorized', message: 'Ikke tilgang til Kunnskapsassistenten.' };
    case 429:
      return { code: 'rate-limited', message: 'For mange spørsmål på kort tid. Vent litt.' };
    default:
      return { code: 'agent', message: `Kunnskapsassistenten svarte med feil (${status}).` };
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
 * `listThreads`, `getThread` and `listFacets` return nothing on purpose: the
 * backend has neither thread history a frontend can read back nor facet
 * counts. Both are marked at the type that needs them. Mock mode has the
 * data, live mode says the truth.
 */
export class LiveChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #toolName: string;

  constructor(options: LiveChatClientOptions = {}) {
    this.#basePath = options.basePath ?? '/api';
    this.#toolName = options.toolName ?? DEFAULT_TOOL_NAME;
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const state = new McpStreamState();
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: this.#toolName,
        arguments: {
          query: params.query,
          ...(params.conversationId ? { conversation_id: params.conversationId } : {}),
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
          ? { code: 'aborted', message: 'Svaret ble avbrutt.' }
          : { code: 'network', message: 'Fikk ikke kontakt med Kunnskapsassistenten.' },
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: errorFromStatus(response.status) };
      return;
    }
    if (!response.body) {
      yield { type: 'error', error: { code: 'network', message: 'Tomt svar fra tjeneren.' } };
      return;
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const decoder = createSseDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        const frames = done ? decoder.flush() : decoder.push(value ?? '');

        for (const frame of frames) {
          yield* readFrame(frame.data, state, params.conversationId);
        }

        if (done) return;
      }
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? { code: 'aborted', message: 'Svaret ble avbrutt.' }
          : { code: 'network', message: 'Forbindelsen brøt sammen mens svaret kom.' },
      };
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  /**
   * backend: mangler — a conversation created by `tools/call` carries no
   * owner and is not readable through `/api/conversations`. Thread history
   * needs either a different route into the backend or our own store.
   */
  async listThreads(): Promise<Thread[]> {
    return [];
  }

  async getThread(): Promise<ThreadDetail | null> {
    return null;
  }

  /**
   * backend: mangler, se API-bestilling A2 — the backend filters by whole
   * dataset, so there are no facets to count within one.
   */
  async listFacets(): Promise<FilterFacet[]> {
    return [];
  }
}

/** Turns one decoded SSE payload into zero or more of our events. */
function* readFrame(
  data: string,
  state: McpStreamState,
  fallbackConversationId?: string,
): Generator<StreamEvent> {
  let message: {
    method?: string;
    params?: { _meta?: Record<string, unknown> };
    result?: {
      isError?: boolean;
      content?: { type?: string; text?: string }[];
      structuredContent?: { chunks?: unknown[]; conversation_id?: string };
      _meta?: { conversation_id?: string };
    };
    error?: { message?: string };
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
      error: { code: 'agent', message: message.error.message ?? 'Ukjent feil fra tjeneren.' },
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
  if (result.isError) {
    const text = result.content?.find((block) => block.type === 'text')?.text;
    yield { type: 'error', error: { code: 'agent', message: text ?? 'Spørringen feilet.' } };
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
  if (state.answerText === '') {
    const text = result.content?.find((block) => block.type === 'text')?.text;
    if (text) yield { type: 'token', text };
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
  };
}
