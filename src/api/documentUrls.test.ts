import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentUrl, parseDocumentUrls } from './documentUrls';

/**
 * Simens issue 92: kildene i testmiljøet hadde ingen lenke til Kudos, fordi
 * bitene har `doc_num` og ingen `url`. Adressen er kunnskap om korpuset, så
 * den er oppsett per datasett (0001), og koden setter bare nummeret inn.
 */
const KUDOS = 'kudos-full=https://kudos.dfo.no/documents/{doc_num}';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('parseDocumentUrls', () => {
  it('leser datasett=mal, med semikolon mellom', () => {
    const templates = parseDocumentUrls(`${KUDOS};annet=https://eksempel.no/d/{doc_num}?v=1`);
    expect([...templates]).toEqual([
      ['kudos-full', 'https://kudos.dfo.no/documents/{doc_num}'],
      // Første `=` skiller nøkkelen fra malen, så et `=` i malen er trygt.
      ['annet', 'https://eksempel.no/d/{doc_num}?v=1'],
    ]);
  });

  it('hopper over en mal uten {doc_num} eller uten http(s), med én advarsel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const templates = parseDocumentUrls(
      'a=https://kudos.dfo.no/documents;b=javascript:alert({doc_num});c=https://ok/{doc_num}',
    );
    expect([...templates.keys()]).toEqual(['c']);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('documentUrl', () => {
  const templates = parseDocumentUrls(KUDOS);

  it('setter nummeret inn i malen for datasettet', () => {
    // #4 målte 30.09 at denne gir 301 til riktig dokument hos Kudos.
    expect(documentUrl('kudos-full', '372017', templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
    expect(documentUrl('kudos-full', 372017, templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
  });

  it('gir ingen lenke for et datasett uten mal, eller uten nummer', () => {
    expect(documentUrl('norquad-docs', '7', templates)).toBeUndefined();
    expect(documentUrl('kudos-full', undefined, templates)).toBeUndefined();
    expect(documentUrl('kudos-full', '  ', templates)).toBeUndefined();
  });

  it('koder nummeret, så det ikke kan lede til en annen side', () => {
    expect(documentUrl('kudos-full', '../admin?x=1', templates)).toBe(
      'https://kudos.dfo.no/documents/..%2Fadmin%3Fx%3D1',
    );
  });

  it('bruker datasettet live spør når svaret ikke sier hvilket', () => {
    vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', 'kudos-full');
    expect(documentUrl(undefined, '372017', templates)).toBe(
      'https://kudos.dfo.no/documents/372017',
    );
  });

  it('leser malen fra oppsettet når ingen gis', () => {
    vi.stubEnv('VITE_KA_DOCUMENT_URLS', KUDOS);
    expect(documentUrl('kudos-full', '1')).toBe('https://kudos.dfo.no/documents/1');
  });
});
