import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The active corpus: what it starts as, what it remembers, and what it
 * refuses.
 *
 * Every test re-imports the module, because the store resolves itself from
 * `import.meta.env` and `localStorage` once, at import time — which is the
 * right shape for the app (one store for its whole life) and the awkward one
 * for a test. `vi.resetModules()` plus a fresh `import()` is what gives each
 * case its own startup.
 *
 * `vi.stubEnv` is what sets the environment for that startup. It reaches
 * `import.meta.env` in Vitest the same way it reaches `process.env`.
 */
const CORPORA = 'norquad-docs=Wikipedia (NorQuAD);kudos-pilot=Kudos-pilot|5 årsrapporter';

async function load({ datasets = CORPORA, configured = '', mode = 'live' } = {}) {
  vi.stubEnv('VITE_API_MODE', mode);
  vi.stubEnv('VITE_KA_DATASETS', datasets);
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', configured);
  vi.resetModules();
  return import('./corpus');
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('hvilket korpus som er aktivt ved oppstart', () => {
  it('tar det første i lista når ingenting er lagret', async () => {
    const corpus = await load();
    expect(corpus.activeCorpusKey()).toBe('norquad-docs');
    expect(corpus.corpusIsChoosable).toBe(true);
  });

  it('lar VITE_KA_DATASET_CONFIG_KEY peke ut startvalget', async () => {
    const corpus = await load({ configured: 'kudos-pilot' });
    expect(corpus.activeCorpusKey()).toBe('kudos-pilot');
  });

  it('tar det lagrede valget framfor begge deler', async () => {
    localStorage.setItem('ka.corpus.v1', 'kudos-pilot');
    const corpus = await load({ configured: 'norquad-docs' });
    expect(corpus.activeCorpusKey()).toBe('kudos-pilot');
  });

  it('faller tilbake når det lagrede korpuset ikke finnes lenger', async () => {
    // Et korpus kan bli tatt bort mellom to økter. Å falle tilbake er bedre
    // enn å spørre backend om et datasett som ikke er der.
    localStorage.setItem('ka.corpus.v1', 'borte-for-lengst');
    const corpus = await load();
    expect(corpus.activeCorpusKey()).toBe('norquad-docs');
  });

  it('har ett korpus og ingen velger i mock', async () => {
    const corpus = await load({ mode: 'mock', datasets: '' });
    expect(corpus.corpusOptions).toEqual([corpus.MOCK_CORPUS]);
    expect(corpus.corpusIsChoosable).toBe(false);
    expect(corpus.activeCorpusKey()).toBe('mock');
  });

  it('har ingen velger når live bare har ett korpus', async () => {
    const corpus = await load({ datasets: 'kudos-pilot=Kudos-pilot' });
    expect(corpus.corpusIsChoosable).toBe(false);
    // Nøkkelen går likevel på tråden: ett korpus er fortsatt et korpus.
    expect(corpus.activeCorpusKey()).toBe('kudos-pilot');
  });
});

describe('å bytte korpus', () => {
  it('lagrer valget og varsler den som lytter', async () => {
    const corpus = await load();
    const heard = vi.fn();
    corpus.subscribeToCorpus(heard);

    corpus.setActiveCorpusKey('kudos-pilot');

    expect(corpus.activeCorpusKey()).toBe('kudos-pilot');
    expect(localStorage.getItem('ka.corpus.v1')).toBe('kudos-pilot');
    expect(heard).toHaveBeenCalledOnce();
  });

  it('overlever at sida lastes på nytt', async () => {
    const first = await load();
    first.setActiveCorpusKey('kudos-pilot');

    const second = await load();
    expect(second.activeCorpusKey()).toBe('kudos-pilot');
  });

  it('avviser en nøkkel som ikke er i lista', async () => {
    const corpus = await load();
    const heard = vi.fn();
    corpus.subscribeToCorpus(heard);

    corpus.setActiveCorpusKey('finnes-ikke');

    expect(corpus.activeCorpusKey()).toBe('norquad-docs');
    expect(heard).not.toHaveBeenCalled();
  });

  it('sier ingenting når valget ikke endret seg', async () => {
    // Ellers ville hvert klikk på det som alt er valgt startet en ny tråd.
    const corpus = await load();
    const heard = vi.fn();
    corpus.subscribeToCorpus(heard);

    corpus.setActiveCorpusKey('norquad-docs');

    expect(heard).not.toHaveBeenCalled();
  });

  it('slutter å varsle den som har meldt seg av', async () => {
    const corpus = await load();
    const heard = vi.fn();
    corpus.subscribeToCorpus(heard)();

    corpus.setActiveCorpusKey('kudos-pilot');

    expect(heard).not.toHaveBeenCalled();
  });
});

describe('etikett og beskrivelse', () => {
  it('gir hele oppføringa for det aktive korpuset, ikke bare nøkkelen', async () => {
    // Korpuslinja i filterpanelet skal ikke si «Kudos» når det er
    // norquad-docs som er valgt. Bedt om av #2, 21.09.
    const corpus = await load({ configured: 'kudos-pilot' });
    expect(corpus.corpusOption(corpus.activeCorpusKey())).toEqual({
      key: 'kudos-pilot',
      label: 'Kudos-pilot',
      description: '5 årsrapporter',
    });
  });

  it('svarer undefined for en nøkkel ingen kjenner', async () => {
    const corpus = await load();
    expect(corpus.corpusOption('finnes-ikke')).toBeUndefined();
    expect(corpus.corpusLabel(undefined)).toBeUndefined();
  });
});

describe('når lagring er avslått', () => {
  it('leser konfigurasjonen sin likevel', async () => {
    // Privat modus, blokkert lagring. Valget er en bekvemmelighet; at det går
    // tapt skal ikke hindre appen i å lese sin egen oppsetting.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blokkert');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blokkert');
    });

    const corpus = await load();
    expect(corpus.activeCorpusKey()).toBe('norquad-docs');

    corpus.setActiveCorpusKey('kudos-pilot');
    expect(corpus.activeCorpusKey()).toBe('kudos-pilot');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
