import { describe, expect, it } from 'vitest';
import {
  McpStreamState,
  parseHeadingPath,
  relevanceFromRank,
  toCitations,
  toSourceDocuments,
} from './mcp';

describe('parseHeadingPath', () => {
  it('reads the Clojure map the server sends instead of an object', () => {
    expect(parseHeadingPath('{"Header 1" "Akershus slott og festning"}')).toBe(
      'Akershus slott og festning',
    );
  });

  it('joins a nested path', () => {
    expect(parseHeadingPath('{"Header 1" "Birkebeinerne" "Header 2" "Politisk ståsted"}')).toBe(
      'Birkebeinerne › Politisk ståsted',
    );
  });

  it('gives up quietly on nothing', () => {
    expect(parseHeadingPath(undefined)).toBeUndefined();
    expect(parseHeadingPath('{}')).toBeUndefined();
  });
});

describe('relevanceFromRank', () => {
  it('ranks by position, since the server sends no score', () => {
    expect(relevanceFromRank(0, 9)).toBe('high');
    expect(relevanceFromRank(4, 9)).toBe('medium');
    expect(relevanceFromRank(8, 9)).toBe('low');
  });
});

describe('toSourceDocuments', () => {
  const chunks = [
    { chunk_id: 'c1', doc_num: 'd1', title: 'Årsrapport 2022', url: null, metadata: '{"H" "Mål"}' },
    { chunk_id: 'c2', doc_num: 'd2', title: 'Årsrapport 2023', url: 'https://kudos/2023' },
    { chunk_id: 'c3', doc_num: 'd1', title: 'Årsrapport 2022', url: null },
  ];

  it('groups excerpts per document and keeps the citation numbers', () => {
    const documents = toSourceDocuments(chunks);

    expect(documents.map((document) => document.id)).toEqual(['d1', 'd2']);
    expect(documents[0].excerpts.map((excerpt) => excerpt.citationNumber)).toEqual([1, 3]);
    expect(documents[1].excerpts[0].citationNumber).toBe(2);
  });

  it('reads the heading out of the metadata string', () => {
    expect(toSourceDocuments(chunks)[0].excerpts[0].heading).toBe('Mål');
  });

  it('leaves the link out when the corpus has no URL', () => {
    const documents = toSourceDocuments(chunks);

    expect(documents[0].url).toBeUndefined();
    expect(documents[0].excerpts[0].kudosUrl).toBeUndefined();
    expect(documents[1].excerpts[0].kudosUrl).toBe('https://kudos/2023');
  });

  it('numbers citations so [n] lands on chunk n-1', () => {
    const citations = toCitations(toSourceDocuments(chunks));
    expect(citations.map((citation) => citation.number).sort()).toEqual([1, 2, 3]);
    expect(citations.find((citation) => citation.number === 2)?.documentId).toBe('d2');
  });
});

describe('McpStreamState', () => {
  it('holds a delta back until something says what it was', () => {
    const state = new McpStreamState();

    // Measured: every delta this agent streams is its own plan, and the
    // answer arrives whole in the final frame. So a delta is not an answer
    // token until nothing has claimed it.
    expect(state.progress({ event: 'response/chunk', delta: 'Nkom ' })).toEqual([]);
    expect(state.answerText).toBe('');

    state.progress({ event: 'response/chunk', delta: 'rapporterer' });
    expect(state.flushPending()).toEqual([
      { type: 'token', text: 'Nkom ' },
      { type: 'token', text: 'rapporterer' },
    ]);
    expect(state.answerText).toBe('Nkom rapporterer');
  });

  it('throws away the deltas that turned out to be the agent talking to itself', () => {
    const state = new McpStreamState();

    state.progress({ event: 'response/chunk', delta: 'Jeg vil slå opp kilder om ' });
    state.progress({ event: 'response/chunk', delta: 'birkebeinerne.' });
    const [event] = state.progress({
      event: 'agent/thinking',
      reasoning: 'Jeg vil slå opp kilder om birkebeinerne.',
    });

    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.label).toBe('Jeg vil slå opp kilder om birkebeinerne.');
    expect(state.flushPending()).toEqual([]);
    expect(state.answerText).toBe('');
  });

  it('releases held-back text when the agent finalizes', () => {
    const state = new McpStreamState();

    state.progress({ event: 'response/chunk', delta: 'Svaret.' });
    const events = state.progress({ event: 'agent/finalized', iteration: 3 });

    expect(events[0]).toEqual({ type: 'token', text: 'Svaret.' });
    expect(events[1].type).toBe('thinking-step');
  });

  it('keeps every search it ran, not just the last', () => {
    const state = new McpStreamState();

    state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'search', args: { queries: ['birkebeinerne navn', 'Håkon'] } }],
    });
    state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'search', args: { queries: ['Håkon', 'hva var birkebeinerne'] } }],
    });

    expect(state.keywords).toEqual(['birkebeinerne navn', 'Håkon', 'hva var birkebeinerne']);
  });

  it('turns a search into a thinking step and keeps the search words', () => {
    const state = new McpStreamState();
    const events = state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [
        { tool: 'search', args: { queries: ['måloppnåelse Nkom'] }, 'duration-ms': 41 },
      ],
    });

    expect(events).toHaveLength(1);
    const [event] = events;
    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.kind).toBe('search');
    expect(event.step.queries).toEqual(['måloppnåelse Nkom']);
    expect(state.keywords).toEqual(['måloppnåelse Nkom']);
  });

  it('sees reading chunks as reading, not searching', () => {
    const state = new McpStreamState();
    const [event] = state.progress({
      event: 'agent/turn-completed',
      'tool-calls': [{ tool: 'read_chunks', args: { chunk_ids: ['c1'] } }],
    });

    if (event.type !== 'thinking-step') throw new Error('forventet et tenkesteg');
    expect(event.step.kind).toBe('read');
  });

  it('drops the frames that say nothing to a reader', () => {
    const state = new McpStreamState();
    expect(state.progress({ event: 'agent/iteration-started', iteration: 2 })).toEqual([]);
    expect(state.progress({ event: 'response/chunk' })).toEqual([]);
  });
});
