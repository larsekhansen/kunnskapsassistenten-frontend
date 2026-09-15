import { describe, expect, it } from 'vitest';
import { emptyFilterSelection, type SourceDocument } from '../../model';
import { nkomRetrieval, nkomSources } from './fixtures';
import { citedNumbers, narrowToSelection, retrievalFor, withOnlyCitations } from './filtering';

const years = (documents: SourceDocument[]) => documents.map((document) => document.year);

describe('narrowToSelection', () => {
  it('leaves everything alone when nothing is selected', () => {
    expect(narrowToSelection(nkomSources, emptyFilterSelection)).toBe(nkomSources);
    expect(narrowToSelection(nkomSources, undefined)).toBe(nkomSources);
  });

  it('narrows on a value the reader ticked', () => {
    // The dropdown value is the word itself; the document holds the number.
    const narrowed = narrowToSelection(nkomSources, { ...emptyFilterSelection, year: ['2023'] });

    expect(years(narrowed)).toEqual([2023]);
  });

  it('ands the dimensions together', () => {
    const narrowed = narrowToSelection(nkomSources, {
      documentType: ['Årsrapport'],
      organisation: ['Nasjonal kommunikasjonsmyndighet'],
      year: ['2022', '2023'],
    });

    expect(years(narrowed)).toEqual([2022, 2023]);
  });

  it('keeps nothing when the selection matches nothing', () => {
    const narrowed = narrowToSelection(nkomSources, {
      ...emptyFilterSelection,
      documentType: ['Tildelingsbrev'],
    });

    expect(narrowed).toEqual([]);
  });

  it('leaves out a document that says nothing about a narrowed dimension', () => {
    const nameless: SourceDocument = { id: 'x', title: 'Uten år', excerpts: [] };

    expect(narrowToSelection([nameless], { ...emptyFilterSelection, year: ['2023'] })).toEqual([]);
  });
});

describe('retrievalFor', () => {
  it('counts the excerpts and documents that survived', () => {
    const narrowed = narrowToSelection(nkomSources, { ...emptyFilterSelection, year: ['2023'] });
    const retrieval = retrievalFor(narrowed, nkomRetrieval);

    expect(retrieval.documentCount).toBe(1);
    expect(retrieval.hitCount).toBe(narrowed[0]!.excerpts.length);
    // The keywords are what was searched for, not what came back.
    expect(retrieval.keywords).toEqual(nkomRetrieval.keywords);
  });
});

describe('withOnlyCitations', () => {
  it('removes the markers whose excerpt is outside the selection', () => {
    expect(withOnlyCitations('Nkom melder kvartalsvis [1][4].', new Set([1]))).toBe(
      'Nkom melder kvartalsvis [1].',
    );
  });

  it('takes the space in front of the marker with it', () => {
    expect(withOnlyCitations('kvartalsvis [3].', new Set())).toBe('kvartalsvis.');
  });

  it('agrees with what the narrowed documents actually cite', () => {
    const narrowed = narrowToSelection(nkomSources, { ...emptyFilterSelection, year: ['2022'] });
    const kept = citedNumbers(narrowed);
    const text = withOnlyCitations('Ett [1], to [2], tre [3], fire [4].', kept);

    for (const number of [1, 2, 3, 4]) {
      expect(text.includes(`[${number}]`)).toBe(kept.has(number));
    }
  });
});
