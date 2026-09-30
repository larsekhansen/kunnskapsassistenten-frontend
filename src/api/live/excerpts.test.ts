import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SourceDocument } from '../../model';
import { excerptIds, fetchExcerptTexts, withExcerptTexts } from './excerpts';

const documents: SourceDocument[] = [
  {
    id: '7',
    title: 'Årsrapport 2022',
    excerpts: [
      { id: 'c1', text: '', relevance: 'high', citationNumber: 1 },
      { id: 'c2', text: '', relevance: 'medium', citationNumber: 2 },
    ],
  },
  {
    id: '9',
    title: 'Tildelingsbrev 2023',
    excerpts: [{ id: '9-2', text: '', relevance: 'low', citationNumber: 3 }],
  },
];

function answering(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchExcerptTexts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('spør serverens egen rute for datasettet, med id-ene skilt med komma', async () => {
    const fetchMock = answering(200, { excerpts: { c1: 'Tekst 1', c2: '  ', c3: 42 } });

    const texts = await fetchExcerptTexts('/api', 'kudos-full', ['c1', 'c2', 'c3']);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      '/api/excerpts?dataset=kudos-full&ids=c1%2Cc2%2Cc3',
    );
    // Blank text and a text that is not text are not text.
    expect([...(texts ?? [])]).toEqual([['c1', 'Tekst 1']]);
  });

  it('gir undefined når ruta feiler, så utdragene kan si at teksten mangler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    answering(502, { error: 'Fikk ikke hentet utdragene.' });

    expect(await fetchExcerptTexts('/api', 'kudos-full', ['c1'])).toBeUndefined();
  });

  it('gir undefined når fetch aldri kom fram', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    expect(await fetchExcerptTexts('/api', 'kudos-full', ['c1'])).toBeUndefined();
  });

  it('spør ikke uten datasett eller uten id-er', async () => {
    const fetchMock = answering(200, { excerpts: {} });

    expect((await fetchExcerptTexts('/api', undefined, ['c1']))?.size).toBe(0);
    expect((await fetchExcerptTexts('/api', 'kudos-full', []))?.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('excerptIds', () => {
  it('tar id-ene i rekkefølge, én gang hver, og bare dem ruta godtar', () => {
    const odd: SourceDocument[] = [
      ...documents,
      {
        id: 'x',
        title: 'X',
        excerpts: [
          { id: 'c1', text: '', relevance: 'low' },
          { id: 'har mellomrom', text: '', relevance: 'low' },
        ],
      },
    ];

    expect(excerptIds(odd)).toEqual(['c1', 'c2', '9-2']);
  });
});

describe('withExcerptTexts', () => {
  it('fyller inn teksten, og sier fra der den mangler', () => {
    const filled = withExcerptTexts(documents, new Map([['c1', 'Tekst 1']]));

    expect(filled[0]?.excerpts[0]).toMatchObject({ id: 'c1', text: 'Tekst 1' });
    expect(filled[0]?.excerpts[0]?.textUnavailable).toBeUndefined();
    expect(filled[0]?.excerpts[1]).toMatchObject({ id: 'c2', text: '', textUnavailable: true });
    expect(filled[1]?.excerpts[0]).toMatchObject({ textUnavailable: true });
  });

  it('sier fra om alle når oppslaget feilet', () => {
    const filled = withExcerptTexts(documents, undefined);

    expect(filled.flatMap((document) => document.excerpts.map((e) => e.textUnavailable))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('lar nummer, overskrift og lenke stå', () => {
    const [document] = withExcerptTexts(
      [
        {
          ...documents[0],
          excerpts: [
            {
              id: 'c1',
              text: '',
              relevance: 'high',
              citationNumber: 1,
              heading: 'Kapittel 3',
              kudosUrl: 'https://kudos.test/7',
            },
          ],
        },
      ],
      new Map([['c1', 'Tekst']]),
    );

    expect(document?.excerpts[0]).toEqual({
      id: 'c1',
      text: 'Tekst',
      relevance: 'high',
      citationNumber: 1,
      heading: 'Kapittel 3',
      kudosUrl: 'https://kudos.test/7',
    });
  });
});
