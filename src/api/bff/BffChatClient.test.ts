import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyFilterSelection, threadFromQuestion } from '../../model';
import type { FilterSelection, StreamEvent } from '../../model';
import type { DatasetFilterFields } from '../filterFields';
import { BffChatClient, resetBffClient } from './BffChatClient';
import askStream from './fixtures/ask.sse?raw';
import capabilities from './fixtures/capabilities.json';
import conversation from './fixtures/conversation.json';
import conversations from './fixtures/conversations.json';
import facets from './fixtures/facets.json';

/**
 * Fixturene er tatt opp fra Nikolais BFF (`8639267`, med rettelsen for plan og
 * svar) mot hele Kudos lokalt, 2026-09-28, med én cookie-jar: ett spørsmål
 * med `filter: { type: ['Årsrapport'] }`, og så lista og samtalen det ga.
 * `facets.json` er kuttet til ti virksomheter; resten er som det kom.
 */

const CONVERSATION_ID = 'kWn8jrWsHY5TgBLRU6LPs';

const KUDOS_FIELDS: DatasetFilterFields = {
  documentType: { field: 'type' },
  organisation: { field: 'orgs_long' },
  year: { field: 'concerned_years', valueType: 'integer' },
};

type Route = (init: RequestInit | undefined) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** A text body that arrives in pieces of `size` characters, as a network would. */
function streamed(text: string, size = text.length): Response {
  const encoder = new TextEncoder();
  let at = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= text.length) return controller.close();
      controller.enqueue(encoder.encode(text.slice(at, at + size)));
      at += size;
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

/** SSE the way the BFF writes it: one `data:` line per event. */
const sse = (...events: unknown[]) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

/** A BFF on `fetch`, answering from the fixtures unless a route says otherwise. */
function fakeBff(routes: Record<string, Route> = {}) {
  const defaults: Record<string, Route> = {
    'GET /api/capabilities': () => json(capabilities),
    'GET /api/facets': () => json(facets),
    'GET /api/conversations': () => json(conversations),
    [`GET /api/conversations/${CONVERSATION_ID}`]: () => json(conversation),
    'POST /api/ask': () => streamed(askStream),
  };
  const all = { ...defaults, ...routes };
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const route = all[`${init?.method ?? 'GET'} ${String(url)}`];
    return route ? route(init) : json({ error: 'Fant ikke samtalen.' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function client(options: ConstructorParameters<typeof BffChatClient>[0] = {}) {
  return new BffChatClient({
    datasetConfigKey: () => 'kudos-full',
    filterFields: (key) => (key === 'kudos-full' ? KUDOS_FIELDS : undefined),
    settleDelaysMs: [0, 0],
    ...options,
  });
}

async function drain(events: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

/** The body of every `POST /api/ask`, in order. */
function askBodies(fetchMock: ReturnType<typeof fakeBff>) {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url) === '/api/ask' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

const documentType = (values: string[]): FilterSelection => ({
  ...emptyFilterSelection,
  documentType: values,
});

beforeEach(() => {
  resetBffClient();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BffChatClient.ask, strømmen', () => {
  it('gjør den opptatte strømmen om til tenkesteg, svar, kilder og ferdig', async () => {
    fakeBff();
    const events = await drain(client().ask({ query: 'Hva skriver DFØ?' }));

    const steps = events.flatMap((event) => (event.type === 'thinking-step' ? [event.step] : []));
    expect(steps.map((step) => step.kind)).toEqual(['search', 'read', 'finalizing']);
    expect(steps[0]?.queries).toEqual([
      'DFØ årsrapport 2024 måloppnåelse',
      'site:dfo.no årsrapport 2024 måloppnåelse DFØ',
      'Direktoratet for forvaltning og økonomistyring årsrapport 2024 vurdering måloppnåelse',
    ]);

    const text = events.flatMap((event) => (event.type === 'token' ? [event.text] : [])).join('');
    expect(text).toMatch(/^DFØ skriver at virksomheten «i all hovedsak \[har\] oppnådd/);
    expect(text).toHaveLength(790);

    // `sources` exactly once, and right before `done`.
    expect(events.slice(-2).map((event) => event.type)).toEqual(['sources', 'done']);
    const sources = events.at(-2);
    if (sources?.type !== 'sources') throw new Error('ingen kilder');
    expect(sources.documents).toHaveLength(1);
    expect(sources.documents[0]).toMatchObject({
      id: '372017',
      title: expect.stringMatching(/^Årsrapport Direktoratet for forvaltning og økonomi/),
    });
    expect(sources.documents[0]?.excerpts[0]).toMatchObject({ citationNumber: 1 });
    expect(sources.documents[0]?.excerpts[0]?.text).toHaveLength(8363);
    expect(sources.citations).toEqual([{ number: 1, excerptId: '372017-1', documentId: '372017' }]);
    expect(sources.retrieval).toEqual({
      hitCount: 1,
      documentCount: 1,
      keywords: steps[0]?.queries,
    });

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      conversationId: CONVERSATION_ID,
      corpusKey: 'kudos-full',
    });
  });

  it('gir de samme hendelsene når strømmen kommer i biter på sju tegn', async () => {
    fakeBff();
    const whole = await drain(client().ask({ query: 'q' }));
    resetBffClient();
    fakeBff({ 'POST /api/ask': () => streamed(askStream, 7) });
    const pieces = await drain(client().ask({ query: 'q' }));

    const withoutIds = (events: StreamEvent[]) =>
      events.map((event) => (event.type === 'done' ? { ...event, messageId: '' } : event));
    expect(withoutIds(pieces)).toEqual(withoutIds(whole));
  });

  it('sier «no-hits» når BFF-en er ferdig uten tekst og uten kilder', async () => {
    fakeBff({
      'POST /api/ask': () =>
        streamed(sse({ type: 'done', conversationId: 'c1', insufficient: true })),
    });
    const events = await drain(client().ask({ query: 'q', conversationId: 'c1' }));
    expect(events).toEqual([
      { type: 'error', error: { code: 'no-hits' }, corpusKey: 'kudos-full' },
    ]);
  });

  it('viser ikke BFF-ens feilsetning når strømmen ender med error', async () => {
    fakeBff({
      'POST /api/ask': () =>
        streamed(
          sse(
            { type: 'delta', text: 'Del' },
            { type: 'error', message: 'Uventet feil mot backend.' },
          ),
        ),
    });
    const events = await drain(client().ask({ query: 'q', conversationId: 'c1' }));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'unknown' },
      corpusKey: 'kudos-full',
    });
  });

  it('leser backendens tekst i error-hendelsen for kode, og viser den ikke', async () => {
    // BFF-en sender isError-teksten fra backend videre som den er.
    const stall =
      'LLM request failed at iteration 2: LLM streaming: no event received for 30000ms. ' +
      'The provider stream stalled, or ended without a [DONE] terminator. ' +
      'Raise LLM_STREAM_IDLE_TIMEOUT_MS if a healthy stream legitimately pauses this long.';
    fakeBff({
      'POST /api/ask': () => streamed(sse({ type: 'error', message: stall, conversationId: 'c1' })),
    });
    const events = await drain(client().ask({ query: 'q', conversationId: 'c1' }));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'model-unavailable' },
      corpusKey: 'kudos-full',
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ text: stall }),
    );
  });

  it('sier at forbindelsen brøt når strømmen stopper uten done eller error', async () => {
    fakeBff({ 'POST /api/ask': () => streamed(sse({ type: 'delta', text: 'Halvt' })) });
    const events = await drain(client().ask({ query: 'q', conversationId: 'c1' }));
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
    });
  });

  it('oversetter BFF-ens setning for et for langt spørsmål til sin egen', async () => {
    fakeBff({
      'POST /api/ask': () => json({ error: 'Spørsmålet er for langt (maks 2000 tegn).' }, 400),
    });
    const events = await drain(client().ask({ query: 'q' }));
    expect(events).toEqual([
      {
        type: 'error',
        error: {
          code: 'unknown',
          message: 'Spørsmålet er lengre enn de 2000 tegnene tjenesten tar imot.',
        },
        corpusKey: 'kudos-full',
      },
    ]);
  });

  it('viser statusen, ikke teksten, når feilen i svaret er ukjent', async () => {
    fakeBff({
      'POST /api/ask': () => json({ error: 'Internal Server Error' }, 500),
    });
    const events = await drain(client().ask({ query: 'q' }));
    expect(events).toEqual([
      {
        type: 'error',
        error: { code: 'unknown', message: 'Kunnskapsassistenten svarte med feil (500).' },
        corpusKey: 'kudos-full',
      },
    ]);
  });

  it('sender leseren til innlogging på 401, og sier «unauthorized»', async () => {
    fakeBff({ 'POST /api/ask': () => json({ error: 'Ikke logget inn.' }, 401) });
    const onUnauthorized = vi.fn();
    const events = await drain(client({ onUnauthorized }).ask({ query: 'q' }));
    expect(events).toEqual([
      { type: 'error', error: { code: 'unauthorized' }, corpusKey: 'kudos-full' },
    ]);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('BffChatClient.ask, det som sendes', () => {
  it('sender spørsmålet og filteret med korpusets feltnavn, uten samtale-id første gang', async () => {
    const fetchMock = fakeBff();
    await drain(
      client().ask({
        query: 'Hva skriver DFØ?',
        filters: { ...documentType(['Årsrapport']), year: ['  '] },
      }),
    );
    expect(askBodies(fetchMock)).toEqual([
      { query: 'Hva skriver DFØ?', filter: { type: ['Årsrapport'] } },
    ]);
  });

  it('sender ikke noe filter når ingenting er valgt', async () => {
    const fetchMock = fakeBff();
    await drain(client().ask({ query: 'q', filters: emptyFilterSelection }));
    expect(askBodies(fetchMock)).toEqual([{ query: 'q' }]);
  });

  it('sender ikke filteret når BFF-en sier at backenden ikke kan filtrere', async () => {
    const fetchMock = fakeBff({
      'GET /api/capabilities': () =>
        json({ ...capabilities, capabilities: { ...capabilities.capabilities, filters: false } }),
    });
    await drain(client().ask({ query: 'q', filters: documentType(['Årsrapport']) }));
    expect(askBodies(fetchMock)).toEqual([{ query: 'q' }]);
  });

  it('fortsetter samtalen det kom et svar i', async () => {
    const fetchMock = fakeBff();
    await drain(client().ask({ query: 'Og i 2023?', conversationId: CONVERSATION_ID }));
    expect(askBodies(fetchMock)).toEqual([
      { query: 'Og i 2023?', conversationId: CONVERSATION_ID },
    ]);
  });
});

describe('BffChatClient, tråden og samtalen', () => {
  it('createThread får id-en BFF-en ga samtalen, før svaret er ferdig', async () => {
    fakeBff();
    const placeholder = threadFromQuestion('Hva skriver DFØ?');
    const created = client().createThread(placeholder);

    const answer = client().ask({ query: 'Hva skriver DFØ?' })[Symbol.asyncIterator]();
    const first = await answer.next();
    expect(first.value).toMatchObject({ type: 'thinking-step' });

    await expect(created).resolves.toEqual({
      ...placeholder,
      id: CONVERSATION_ID,
      conversationId: CONVERSATION_ID,
    });
    await answer.return?.(undefined);
  });

  it('neste spørsmål i tråden går til samme samtale, også fra en annen klient', async () => {
    const fetchMock = fakeBff();
    void client().createThread(threadFromQuestion('Første'));
    await drain(client().ask({ query: 'Første' }));
    await drain(client().ask({ query: 'Andre' }));
    expect(askBodies(fetchMock).map((body) => body.conversationId)).toEqual([
      undefined,
      CONVERSATION_ID,
    ]);
  });

  it('createThread gir undefined når spørsmålet feilet før samtalen fantes', async () => {
    fakeBff({ 'POST /api/ask': () => json({ error: 'Kunne ikke opprette samtale.' }, 502) });
    const created = client().createThread(threadFromQuestion('q'));
    await drain(client().ask({ query: 'q' }));
    await expect(created).resolves.toBeUndefined();
  });

  it('en tråd åpnet fra adressen før den er lest, fortsettes under sin egen id', async () => {
    const fetchMock = fakeBff();
    const bff = client();
    bff.openThread({ ...threadFromQuestion('q'), id: CONVERSATION_ID }, 'id-only');
    await drain(bff.ask({ query: 'q' }));
    expect(askBodies(fetchMock)[0]).toMatchObject({ conversationId: CONVERSATION_ID });
  });

  it('lister samtalene som tråder', async () => {
    fakeBff();
    expect(await client().listThreads()).toEqual([
      {
        id: CONVERSATION_ID,
        title: 'Hva skriver DFØ om måloppnåelse i årsrapporten for 2024?',
        titleFromQuestion: true,
        createdAt: new Date(1790590864097).toISOString(),
        updatedAt: new Date(1790590864097).toISOString(),
        conversationId: CONVERSATION_ID,
        corpusKey: 'kudos-full',
      },
    ]);
  });

  it('åpner samtalen med turene, og kildene på siste svar', async () => {
    fakeBff();
    const thread = await client().getThread(CONVERSATION_ID);
    expect(thread?.id).toBe(CONVERSATION_ID);
    expect(thread?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);

    const answer = thread?.messages[1];
    expect(answer?.content).toHaveLength(790);
    expect(answer).toMatchObject({ citationCount: 1, corpusKey: 'kudos-full' });
    expect(answer?.sources?.map((document) => document.id)).toEqual(['372017']);
    expect(answer?.citations).toEqual([{ number: 1, excerptId: '372017-1', documentId: '372017' }]);
  });

  it('gir null for en samtale som ikke finnes', async () => {
    fakeBff();
    expect(await client().getThread('finnes-ikke')).toBeNull();
  });
});

describe('BffChatClient.listFacets', () => {
  it('gjør fasettene om til de tre nedtrekkene, i designets rekkefølge', async () => {
    fakeBff();
    const found = await client().listFacets();
    expect(found.map(({ dimension, label }) => [dimension, label])).toEqual([
      ['documentType', 'Dokumenttyper'],
      ['organisation', 'Virksomheter'],
      ['year', 'År'],
    ]);
    expect(found[0]?.values).toHaveLength(8);
    expect(found[0]?.values[0]).toEqual({
      value: 'Tildelingsbrev',
      label: 'Tildelingsbrev',
      count: 3378,
    });
  });

  it('dropper tallene i de andre nedtrekkene når noe er valgt, siden de gjelder hele korpuset', async () => {
    fakeBff();
    const found = await client().listFacets(undefined, documentType(['Årsrapport']));
    const counted = (dimension: string) =>
      found
        .find((facet) => facet.dimension === dimension)
        ?.values.some((v) => v.count !== undefined);
    expect([counted('documentType'), counted('organisation'), counted('year')]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('viser bare felt som korpuset har gitt en dimensjon', async () => {
    fakeBff();
    const found = await client({
      filterFields: () => ({ documentType: { field: 'type' } }),
    }).listFacets();
    expect(found.map((facet) => facet.dimension)).toEqual(['documentType']);
  });

  it('gir ingen fasetter når BFF-en sier at backenden ikke kan filtrere', async () => {
    fakeBff({
      'GET /api/capabilities': () =>
        json({ ...capabilities, capabilities: { ...capabilities.capabilities, filters: false } }),
    });
    expect(await client().listFacets()).toEqual([]);
  });

  it('spør på nytt mens BFF-en ikke er ferdig med å prøve backenden', async () => {
    let asked = 0;
    fakeBff({
      'GET /api/capabilities': () =>
        (asked += 1) < 3
          ? json({ capabilities: { ...capabilities.capabilities, filters: false }, settled: false })
          : json(capabilities),
    });
    expect(await client().listFacets()).toHaveLength(3);
    expect(asked).toBe(3);
  });

  it('husker ikke et svar som ikke var sikkert', async () => {
    let asked = 0;
    fakeBff({
      'GET /api/capabilities': () => {
        asked += 1;
        return json({
          capabilities: { ...capabilities.capabilities, filters: false },
          settled: false,
        });
      },
    });
    const bff = client({ settleDelaysMs: [] });
    expect(await bff.listFacets()).toEqual([]);
    expect(await bff.listFacets()).toEqual([]);
    expect(asked).toBe(2);
  });
});

describe('createChatClient', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('gir BFF-klienten når VITE_API_MODE er bff', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    const { createChatClient } = await import('../index');
    expect(createChatClient()).toBeInstanceOf(BffChatClient);
  });
});
