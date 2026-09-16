import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../model';
import { LiveChatClient } from './LiveChatClient';

/**
 * What the client actually puts on the wire.
 *
 * `datasetArguments` is tested on its own in mcp.test.ts; what is in question
 * here is that the result reaches the `tools/call` arguments beside the query,
 * which is the only place the backend looks for it.
 */
function captureRequest() {
  const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Runs one question to completion and hands back the parsed request body. */
async function askAndReadBody(client: LiveChatClient, fetchMock: ReturnType<typeof vi.fn>) {
  // The stubbed 503 makes `ask` yield one error event and stop, which is all
  // this needs: the request has already been built by then.
  for await (const _event of client.ask({ query: 'Hva rapporterer Nkom?' })) {
    // drained on purpose
  }
  /*
   * Found by address and not by position. A first turn now makes the
   * conversation before it asks — see `#createConversation` — so the tool
   * call is the second request, and it would be the first again the day that
   * `POST` is dropped or moved. What this test is about is what reaches
   * `tools/call`, so that is what it looks for.
   */
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/mcp'));
  const init = call?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    params: { arguments: Record<string, unknown> };
  };
}

describe('LiveChatClient og datasettvalg', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sender tenant og dataset_config_key når begge er satt', async () => {
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ tenant: 'demo', datasetConfigKey: 'kudos-pilot' });

    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toMatchObject({
      query: 'Hva rapporterer Nkom?',
      tenant: 'demo',
      dataset_config_key: 'kudos-pilot',
    });
  });

  it('sender ingen av dem når ingen er satt', async () => {
    const fetchMock = captureRequest();
    const client = new LiveChatClient();

    const body = await askAndReadBody(client, fetchMock);

    // Uendret oppførsel: backend velger datasett selv.
    expect(body.params.arguments).toEqual({ query: 'Hva rapporterer Nkom?' });
    expect(body.params.arguments).not.toHaveProperty('tenant');
    expect(body.params.arguments).not.toHaveProperty('dataset_config_key');
  });

  it('sender ingen av dem når bare den ene er satt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = captureRequest();
    const client = new LiveChatClient({ datasetConfigKey: 'kudos-pilot' });

    const body = await askAndReadBody(client, fetchMock);

    expect(body.params.arguments).toEqual({ query: 'Hva rapporterer Nkom?' });
  });
});

/**
 * A finished answer as the server sends it: one SSE frame carrying the
 * `tools/call` result. `_meta.status` is the field under test.
 */
function finalFrame(meta: Record<string, unknown>): Response {
  const body = {
    result: {
      content: [{ type: 'text', text: 'Svar.' }],
      structuredContent: { chunks: [] },
      _meta: meta,
    },
  };
  return new Response(`data: ${JSON.stringify(body)}\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function askWith(meta: Record<string, unknown>): Promise<StreamEvent[]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => finalFrame(meta)),
  );
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient().ask({ query: 'Hva rapporterer Nkom?' })) {
    events.push(event);
  }
  return events;
}

describe('LiveChatClient og needs-clarification', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leser statusen agenten sender i _meta', async () => {
    const events = await askWith({ conversation_id: 'c1', status: 'needs-clarification' });

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      conversationId: 'c1',
      outcome: 'needs-clarification',
    });
  });

  it('lar et vanlig svar være uten outcome', async () => {
    // Fraværende betyr «complete». Et svar som alltid bar feltet ville tvunget
    // hver leser til å håndtere det.
    const events = await askWith({ conversation_id: 'c1', status: 'complete' });

    expect(events.at(-1)).toMatchObject({ type: 'done' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });

  it('finner seg i at feltet mangler helt', async () => {
    const events = await askWith({ conversation_id: 'c1' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });
});

/** Runs one question against a stubbed `fetch` and collects what comes out. */
async function askAgainst(response: () => Response | Promise<Response>): Promise<StreamEvent[]> {
  vi.stubGlobal('fetch', vi.fn(response));
  const events: StreamEvent[] = [];
  for await (const event of new LiveChatClient().ask({ query: 'Hva rapporterer Nkom?' })) {
    events.push(event);
  }
  return events;
}

/** One SSE frame with whatever payload the test wants to send. */
function frameWith(payload: unknown): Response {
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function errorOf(events: StreamEvent[]) {
  const last = events.at(-1);
  return last?.type === 'error' ? last.error : undefined;
}

describe('LiveChatClient og feilkoder', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leser det statuskoden faktisk slår fast', async () => {
    for (const [status, code] of [
      [401, 'unauthorized'],
      [403, 'unauthorized'],
      [408, 'timeout'],
      [504, 'timeout'],
      [429, 'rate-limited'],
    ] as const) {
      const events = await askAgainst(() => new Response(null, { status }));
      expect(errorOf(events)?.code, String(status)).toBe(code);
      vi.unstubAllGlobals();
    }
  });

  it('gjetter ikke modell mot korpus på en 5xx', async () => {
    const events = await askAgainst(() => new Response(null, { status: 503 }));

    // «Språkmodellen svarer ikke» og «korpuset er nede» ber brukeren om hver
    // sin ting, og statuskoden sier ikke hvilken det var. A16 er bestillingen
    // som skal gjøre den forskjellen mulig.
    expect(errorOf(events)?.code).toBe('unknown');
    expect(errorOf(events)?.message).toContain('503');
  });

  it('sier at kontakten manglet når fetch aldri kom fram', async () => {
    const events = await askAgainst(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(errorOf(events)).toEqual({
      code: 'unknown',
      message: 'Fikk ikke kontakt med tjenesten.',
    });
  });

  it('leser error.code fra backend når den kommer', async () => {
    const events = await askAgainst(() =>
      frameWith({
        error: { message: 'Søket svarte ikke.', data: { code: 'retrieval-unavailable' } },
      }),
    );

    expect(errorOf(events)?.code).toBe('retrieval-unavailable');
  });

  it('tar en ukjent kode som unknown i stedet for å krasje', async () => {
    const events = await askAgainst(() =>
      frameWith({ error: { message: 'Noe nytt.', data: { code: 'kvote-brukt-opp' } } }),
    );

    expect(errorOf(events)?.code).toBe('unknown');
    expect(errorOf(events)?.message).toBe('Noe nytt.');
  });

  it('melder tomt søk med tomt svar som no-hits', async () => {
    const events = await askAgainst(() =>
      frameWith({ result: { content: [], structuredContent: { chunks: [] }, _meta: {} } }),
    );

    // Ikke en feil: agenten søkte og fant ingenting, som er et svar med tom
    // kildeliste. Ingen `sources` og ingen `done`, for chatten gjør denne om
    // til en ferdig tur selv.
    expect(errorOf(events)).toEqual({ code: 'no-hits' });
  });

  it('lar et svar uten kilder være et svar', async () => {
    const events = await askAgainst(() =>
      frameWith({
        result: {
          content: [{ type: 'text', text: 'Dette står i ingen av dokumentene.' }],
          structuredContent: { chunks: [] },
          _meta: {},
        },
      }),
    );

    // Tekst uten utdrag er fortsatt et svar. Bare begge deler tomme er
    // «fant ingenting».
    expect(events.map((event) => event.type)).toEqual(['token', 'sources', 'done']);
  });
});
