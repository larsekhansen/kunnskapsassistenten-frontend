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
  const init = fetchMock.mock.calls[0][1] as RequestInit;
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
