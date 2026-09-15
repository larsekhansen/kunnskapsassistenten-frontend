import { describe, expect, it } from 'vitest';
import { nkomSources } from '../../api/mock/fixtures';
import {
  MIN_QUERY_LENGTH,
  buildSearchIndex,
  findHits,
  hitsFor,
  splitByHits,
  stepHit,
} from './search';

describe('buildSearchIndex', () => {
  it('holds one item per excerpt, across documents', () => {
    const index = buildSearchIndex(nkomSources);

    expect(index).toHaveLength(5);
    expect(index.every((item) => item.kind === 'excerpt')).toBe(true);
    expect(index[0].id).toBe('chunk-2022-04');
  });
});

describe('findHits', () => {
  it('ignores a query shorter than the minimum', () => {
    const index = buildSearchIndex(nkomSources);

    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(findHits(index, 'r')).toEqual([]);
    expect(findHits(index, '  ')).toEqual([]);
  });

  it('matches without regard to case, and keeps offsets into the original', () => {
    const index = [{ id: 'a', kind: 'excerpt' as const, text: 'Risiko og risikovurdering' }];
    const hits = findHits(index, 'RISIKO');

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ itemId: 'a', start: 0, end: 6 });
    // The offsets point into the original string, so the casing survives.
    expect(index[0].text.slice(hits[0].start, hits[0].end)).toBe('Risiko');
    expect(index[0].text.slice(hits[1].start, hits[1].end)).toBe('risiko');
  });

  it('matches Norwegian letters', () => {
    const index = [{ id: 'a', kind: 'excerpt' as const, text: 'Måloppnåelse og ressursbruk' }];

    expect(findHits(index, 'måloppnåelse')).toHaveLength(1);
    expect(findHits(index, 'MÅLOPPNÅELSE')).toHaveLength(1);
  });

  it('does not overlap matches', () => {
    const index = [{ id: 'a', kind: 'excerpt' as const, text: 'aaaa' }];

    expect(findHits(index, 'aa')).toHaveLength(2);
  });

  it('returns hits in reading order across the index', () => {
    const index = buildSearchIndex(nkomSources);
    const hits = findHits(index, 'risiko');
    const order = index.map((item) => item.id);

    const positions = hits.map((hit) => order.indexOf(hit.itemId));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('hitsFor', () => {
  it('picks out the hits inside one excerpt', () => {
    const index = buildSearchIndex(nkomSources);
    const hits = findHits(index, 'risiko');

    expect(hitsFor(hits, 'chunk-2022-04').every((hit) => hit.itemId === 'chunk-2022-04')).toBe(
      true,
    );
    expect(hitsFor(hits, 'finnes-ikke')).toEqual([]);
  });
});

describe('stepHit', () => {
  it('stops at both ends rather than wrapping', () => {
    expect(stepHit(3, 2, 1)).toBe(2);
    expect(stepHit(3, 0, -1)).toBe(0);
    expect(stepHit(3, 0, 1)).toBe(1);
    expect(stepHit(3, 2, -1)).toBe(1);
  });

  it('stays at zero when there is nothing to step through', () => {
    expect(stepHit(0, 0, 1)).toBe(0);
    expect(stepHit(0, 0, -1)).toBe(0);
  });
});

describe('splitByHits', () => {
  it('covers the whole text exactly once', () => {
    const text = 'Risiko og risikovurdering';
    const hits = findHits([{ id: 'a', kind: 'excerpt', text }], 'risiko');
    const runs = splitByHits(text, hits);

    expect(runs.map((run) => run.text).join('')).toBe(text);
    expect(runs.filter((run) => run.hit !== undefined)).toHaveLength(2);
  });

  it('returns the text untouched when nothing matched', () => {
    expect(splitByHits('Ressursbruk', [])).toEqual([{ text: 'Ressursbruk' }]);
  });
});
