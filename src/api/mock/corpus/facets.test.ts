import { describe, expect, it } from 'vitest';
import { emptyFilterSelection, type FilterSelection } from '../../../model';
import { documentsMatching, facetsFor } from './facets';
import { corpusDocuments, type CorpusDocument } from './index';

/** A small corpus, so the arithmetic is checkable by eye. */
const documents: CorpusDocument[] = [
  {
    id: '1',
    title: 'A',
    type: 'Årsrapport',
    organisation: 'Digdir',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '2',
    title: 'B',
    type: 'Årsrapport',
    organisation: 'Digdir',
    year: 2023,
    summary: '',
    url: '',
  },
  {
    id: '3',
    title: 'C',
    type: 'Årsrapport',
    organisation: 'Nkom',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '4',
    title: 'D',
    type: 'Evaluering',
    organisation: 'Nkom',
    year: 2024,
    summary: '',
    url: '',
  },
  {
    id: '5',
    title: 'E',
    type: 'Evaluering',
    organisation: 'Digdir',
    year: 2022,
    summary: '',
    url: '',
  },
];

const select = (patch: Partial<FilterSelection>): FilterSelection => ({
  ...emptyFilterSelection,
  ...patch,
});

const facet = (selection: FilterSelection, dimension: string) =>
  facetsFor(selection, documents).find((f) => f.dimension === dimension)!;

const counts = (selection: FilterSelection, dimension: string) =>
  Object.fromEntries(facet(selection, dimension).values.map((v) => [v.value, v.count]));

describe('facetsFor', () => {
  it('teller hele korpuset når ingenting er valgt', () => {
    expect(counts(emptyFilterSelection, 'documentType')).toEqual({ Årsrapport: 3, Evaluering: 2 });
    expect(counts(emptyFilterSelection, 'organisation')).toEqual({ Digdir: 3, Nkom: 2 });
    expect(counts(emptyFilterSelection, 'year')).toEqual({ '2024': 3, '2023': 1, '2022': 1 });
  });

  it('lar en dimensjon ikke snevre inn sine egne tellere', () => {
    // Dette er hele regelen. Huker du av «Årsrapport», skal «Evaluering»
    // fortsatt stå der med 2 — ellers ser lista ut som om det ikke finnes
    // noe annet, når sannheten er at du ikke har bedt om noe annet ennå.
    const selection = select({ documentType: ['Årsrapport'] });
    expect(counts(selection, 'documentType')).toEqual({ Årsrapport: 3, Evaluering: 2 });
  });

  it('lar de andre dimensjonene snevre inn', () => {
    // Med «Årsrapport» valgt teller årene bare årsrapporter: 2022 hadde bare
    // en evaluering og forsvinner.
    const selection = select({ documentType: ['Årsrapport'] });
    expect(counts(selection, 'year')).toEqual({ '2024': 2, '2023': 1 });
    expect(counts(selection, 'organisation')).toEqual({ Digdir: 2, Nkom: 1 });
  });

  it('kombinerer valg på tvers av dimensjoner', () => {
    const selection = select({ documentType: ['Årsrapport'], organisation: ['Digdir'] });
    expect(counts(selection, 'year')).toEqual({ '2024': 1, '2023': 1 });
    // Fortsatt ikke sin egen dimensjon, men nå betinget av Digdir.
    expect(counts(selection, 'documentType')).toEqual({ Årsrapport: 2, Evaluering: 1 });
  });

  it('beholder et valgt tomt treff i lista', () => {
    // Uten dette forsvinner den eneste kontrollen som kan angre valget som
    // tømte den.
    const selection = select({ documentType: ['Evaluering'], year: ['2023'] });
    expect(counts(selection, 'documentType')).toMatchObject({ Evaluering: 0 });
  });

  it('sorterer år nyest først og resten etter antall', () => {
    expect(facet(emptyFilterSelection, 'year').values.map((v) => v.value)).toEqual([
      '2024',
      '2023',
      '2022',
    ]);
    expect(facet(emptyFilterSelection, 'organisation').values.map((v) => v.value)).toEqual([
      'Digdir',
      'Nkom',
    ]);
  });
});

describe('documentsMatching', () => {
  it('lar en tom dimensjon bety «ingen begrensning»', () => {
    expect(documentsMatching(emptyFilterSelection, documents)).toHaveLength(5);
  });

  it('snevrer inn på hver dimensjon som har et valg', () => {
    expect(documentsMatching(select({ organisation: ['Nkom'] }), documents)).toHaveLength(2);
    // Nkom har to dokumenter, begge fra 2024, så året endrer ingenting her.
    expect(
      documentsMatching(select({ organisation: ['Nkom'], year: ['2024'] }), documents),
    ).toHaveLength(2);
    // Men et år Nkom ikke har noe i, tømmer treffet.
    expect(
      documentsMatching(select({ organisation: ['Nkom'], year: ['2022'] }), documents),
    ).toHaveLength(0);
  });
});

describe('det ekte korpuset', () => {
  it('er hentet, ikke tomt', () => {
    expect(corpusDocuments.length).toBeGreaterThan(500);
  });

  it('har de fem dokumenttypene oppdraget ber om', () => {
    const types = new Set(corpusDocuments.map((d) => d.type));
    for (const type of [
      'Årsrapport',
      'Evaluering',
      'Tildelingsbrev',
      'Statusrapport',
      'Strategi/plan',
    ]) {
      expect(types, `korpuset mangler ${type}`).toContain(type);
    }
  });

  it('har sammendrag å sitere fra, og lenke til Kudos', () => {
    for (const document of corpusDocuments) {
      expect(document.summary.length).toBeGreaterThanOrEqual(200);
      expect(document.url).toMatch(/^https:\/\/kudos\.dfo\.no\/dokument\//);
      expect(document.year).toBeGreaterThanOrEqual(2020);
    }
  });
});
