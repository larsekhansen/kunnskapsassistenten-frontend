import { describe, expect, it } from 'vitest';
import { emptyFilterSelection, type FilterSelection, type StreamEvent } from '../../model';
import { KICKSTARTERS } from '../../views/chat/text';
import { scriptedFor } from './conversations';
import { MOCK_CLARIFICATION_QUERY, MockChatClient } from './MockChatClient';
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
 * The filter and the scripted conversations, together.
 *
 * Eleven of the twelve questions the mock can answer are scripted, and three
 * of them are the kickstarters — the road a first-time user actually takes.
 * Until this branch met #38 none of them went through `narrowToSelection`, so
 * the filter worked on exactly one question, the unscripted NKOM answer, and
 * the «control with no effect» of reise 8 was back on the main road. KA CC
 * found it; these hold it.
 *
 * Written against the real `KICKSTARTERS` strings and not against a question
 * copied in here. The matching is deliberately loose, but it is still
 * matching: the day one of the three is reworded past the threshold, this is
 * what has to go red. A test file reaching into a view for one constant is
 * the point — nothing in `src/api/` does.
 */
const [dssKickstarter, clarificationKickstarter] = KICKSTARTERS;

function withSelection(partial: Partial<FilterSelection>): FilterSelection {
  return { ...emptyFilterSelection, ...partial };
}

function sourcesIn(events: StreamEvent[]) {
  return events.find((event) => event.type === 'sources');
}

function answerIn(events: StreamEvent[]): string {
  return events
    .filter((event) => event.type === 'token')
    .map((event) => event.text)
    .join('');
}

describe('filteret og de scriptede samtalene', () => {
  it('har en scriptet samtale bak hver kickstarter', () => {
    for (const question of KICKSTARTERS) {
      expect(scriptedFor(question), question).toBeDefined();
    }
  });

  it('lar en kickstarter uten filter beholde alle kildene sine', async () => {
    const events = await collect(client.ask({ query: dssKickstarter! }));
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    expect(sources.documents).toHaveLength(2);
    expect(sources.citations.map((citation) => citation.number)).toEqual([1, 2, 3, 4]);
    expect(answerIn(events)).toContain('[4]');
  });

  it('snevrer kildene, markørene og henvisningene til en kickstarter', async () => {
    // «Årsrapport» lar det ene av de to dokumentene stå igjen. Det andre er
    // et tildelingsbrev, og markørene som pekte inn i det må forsvinne med
    // det: en død [3] i prosaen sier «frontenden er ødelagt», ikke «det
    // dokumentet er utenfor utvalget».
    const events = await collect(
      client.ask({
        query: dssKickstarter!,
        filters: withSelection({ documentType: ['Årsrapport'] }),
      }),
    );
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('ingen kilder i strømmen');

    expect(sources.documents).toHaveLength(1);
    expect(sources.documents[0]?.documentType).toBe('Årsrapport');
    expect(sources.citations.map((citation) => citation.number)).toEqual([1, 2]);
    expect(sources.retrieval.documentCount).toBe(1);

    const answer = answerIn(events);
    expect(answer).toContain('[1]');
    expect(answer).not.toContain('[3]');
    expect(answer).not.toContain('[4]');
  });

  it('sender kilder med tom liste når utvalget ikke slipper noe gjennom', async () => {
    // Ikke det samme som en avklaring, og derfor ikke samme vei ut av
    // løkka: kildepanelet må få beskjed om at utvalget er tomt, ellers står
    // det igjen med forrige svars kilder.
    const events = await collect(
      client.ask({
        query: dssKickstarter!,
        filters: withSelection({ organisation: ['Virksomheten som ikke finnes'] }),
      }),
    );
    const sources = sourcesIn(events);
    if (sources?.type !== 'sources') throw new Error('kildehendelsen skal komme, også tom');

    expect(sources.documents).toHaveLength(0);
    expect(sources.citations).toHaveLength(0);
    expect(sources.retrieval.documentCount).toBe(0);
    expect(answerIn(events)).not.toContain('[1]');
  });

  it('lar en avklaring være en avklaring, også med filter på', async () => {
    // Vakten leser scriptets egen liste og ikke den filtrerte. En samtale som
    // aldri hentet noe skal hoppe over hele kildehendelsen, uansett hva som
    // står i filteret.
    const events = await collect(
      client.ask({
        query: clarificationKickstarter!,
        filters: withSelection({ documentType: ['Årsrapport'] }),
      }),
    );

    expect(sourcesIn(events)).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'done', outcome: 'needs-clarification' });
  });
});
