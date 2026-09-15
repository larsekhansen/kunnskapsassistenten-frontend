import { beforeEach, describe, expect, it } from 'vitest';
import type { StreamEvent, Thread } from '../../model';
import { MOCK_CLARIFICATION_QUERY, MockChatClient } from './MockChatClient';
import { mockAnswerMarkdown, nkomThinkingSteps, threads } from './fixtures';
import { resetMockThreads } from './sessionThreads';

/** No artificial delay: the test is about order and content, not timing. */
const client = new MockChatClient({
  thinkingStepMs: 0,
  firstTokenMs: 0,
  tokenMs: 0,
  sourcesMs: 0,
  requestMs: 0,
});

async function collect(iterable: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('MockChatClient.ask', () => {
  it('streams thinking steps, then text, then sources, then done', async () => {
    const events = await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));
    const kinds = events.map((event) => event.type);

    expect(kinds.filter((kind) => kind === 'thinking-step')).toHaveLength(nkomThinkingSteps.length);
    expect(kinds.lastIndexOf('thinking-step')).toBeLessThan(kinds.indexOf('token'));
    expect(kinds.lastIndexOf('token')).toBeLessThan(kinds.indexOf('sources'));
    expect(kinds.at(-1)).toBe('done');
    expect(kinds).not.toContain('error');
  });

  it('joins the tokens back into the answer, unchanged', async () => {
    const events = await collect(client.ask({ query: 'Nkom' }));
    const text = events
      .filter((event) => event.type === 'token')
      .map((event) => event.text)
      .join('');

    expect(text).toBe(mockAnswerMarkdown);
  });

  it('resolves every [n] in the answer to an excerpt', async () => {
    const events = await collect(client.ask({ query: 'Nkom' }));
    const sources = events.find((event) => event.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    const markers = [...mockAnswerMarkdown.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
    const numbers = new Set(sources.citations.map((citation) => citation.number));

    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(numbers.has(marker)).toBe(true);
    }
  });

  it('ends with an aborted error instead of throwing', async () => {
    const controller = new AbortController();
    const slow = new MockChatClient({ thinkingStepMs: 5 });
    const events: StreamEvent[] = [];

    for await (const event of slow.ask({ query: 'Nkom', signal: controller.signal })) {
      events.push(event);
      controller.abort();
    }

    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'aborted', message: 'Svaret ble avbrutt.' },
    });
  });
});

describe('MockChatClient reads', () => {
  it('finds a thread with messages, and one without', async () => {
    const withMessages = await client.getThread('nkom-maaloppnaaelse');
    const withoutMessages = await client.getThread('om-stimulab');

    expect(withMessages?.messages).toHaveLength(2);
    expect(withoutMessages?.messages).toHaveLength(0);
    expect(await client.getThread('finnes-ikke')).toBeNull();
  });

  it('returns the three filter dimensions', async () => {
    const facets = await client.listFacets();
    expect(facets.map((facet) => facet.dimension)).toEqual([
      'documentType',
      'organisation',
      'year',
    ]);
  });
});

describe('MockChatClient og avklaring', () => {
  it('svarer med et spørsmål tilbake, og sier at det er det den gjør', async () => {
    const events = await collect(client.ask({ query: MOCK_CLARIFICATION_QUERY }));
    const last = events.at(-1);

    expect(last).toMatchObject({ type: 'done', outcome: 'needs-clarification' });

    // Ingen kilder: ingenting ble hentet. En avklaring med kilder bak seg
    // ville vært noe helt annet enn en avklaring.
    expect(events.map((event) => event.type)).not.toContain('sources');
    expect(events.some((event) => event.type === 'token')).toBe(true);
  });

  it('bryr seg ikke om store bokstaver eller mellomrom rundt', async () => {
    const events = await collect(client.ask({ query: '  Simuler Avklaring  ' }));
    expect(events.at(-1)).toMatchObject({ outcome: 'needs-clarification' });
  });

  it('lar et vanlig spørsmål være uendret', async () => {
    const events = await collect(client.ask({ query: 'Hva rapporterer Nkom?' }));

    // Fraværende outcome betyr «complete». Et vanlig svar skal ikke begynne å
    // bære feltet bare fordi feltet finnes.
    expect(events.at(-1)).toMatchObject({ type: 'done' });
    expect(events.at(-1)).not.toHaveProperty('outcome');
  });
});

/**
 * The conversation surviving a reload, decided 2026-09-15 (rolle-5h, punkt 3).
 *
 * Reise 12 and 14 in design/brukerreiser-2026-09-15.md: a question asked on
 * `/` produced an address, and the address led to an empty conversation the
 * moment the page was reloaded. A new client on the same storage is what a
 * reload is, so that is what these build.
 */
describe('MockChatClient husker samtalen', () => {
  beforeEach(() => resetMockThreads());

  const started: Thread = {
    id: 'tråd-fra-nettleseren',
    title: 'Hvordan måler Nkom måloppnåelse?',
    titleFromQuestion: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('gir samtalen tilbake på samme adresse etter en ny start', async () => {
    client.openThread(started);
    await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));

    // A new client, the way a reload builds one. Nothing is carried over in
    // memory; everything comes back out of sessionStorage.
    const reloaded = new MockChatClient({ requestMs: 0 });
    const thread = await reloaded.getThread(started.id);

    expect(thread?.title).toBe(started.title);
    expect(thread?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(thread?.messages[1]?.content).toBe(mockAnswerMarkdown);
    // «id, tittel, meldinger, kilder» — the sources are what the sources panel
    // draws again on the other side of the reload.
    expect(thread?.messages[1]?.sources?.length).toBeGreaterThan(0);
  });

  it('viser den i trådlista', async () => {
    client.openThread(started);
    await collect(client.ask({ query: 'Hvordan måler Nkom måloppnåelse?' }));

    const listed = await new MockChatClient({ requestMs: 0 }).listThreads();

    expect(listed.map((thread) => thread.id)).toContain(started.id);
    // The fixtures are still there; this is added to them, not instead.
    expect(listed.length).toBe(threads.length + 1);
  });

  it('legger et oppfølgingssvar til en tråd fra fixturene, uten å skrive den av', async () => {
    const fixture = threads.find((thread) => thread.id === 'nkom-maaloppnaaelse');
    if (!fixture) throw new Error('fant ikke fixture-tråden');

    const before = await client.getThread(fixture.id);
    client.openThread(fixture);
    await collect(client.ask({ query: 'Og hva med 2024?' }));

    const after = await new MockChatClient({ requestMs: 0 }).getThread(fixture.id);

    expect(after?.messages).toHaveLength((before?.messages.length ?? 0) + 2);
    expect(after?.messages[0]?.id).toBe(before?.messages[0]?.id);
    // The follow-up moves the thread in the list's period grouping.
    expect(after?.updatedAt).not.toBe(fixture.updatedAt);
  });

  it('husker ingenting når ingen tråd er åpnet', async () => {
    await collect(client.ask({ query: 'Nkom' }));

    expect(await new MockChatClient({ requestMs: 0 }).listThreads()).toHaveLength(threads.length);
  });

  it('svarer null på en tråd ingen kjenner', async () => {
    expect(await client.getThread('finnes-ikke')).toBeNull();
  });
});
