import { describe, expect, it } from 'vitest';
import type { StreamEvent } from '../../model';
import { MockChatClient } from './MockChatClient';
import { mockAnswerMarkdown, nkomThinkingSteps } from './fixtures';

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
