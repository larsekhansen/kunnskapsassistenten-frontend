import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CORPUS_TAG_PREFIX, corpusKeyFromTags, parseCorpusOptions, resolveCorpus } from './corpus';

/**
 * The corpus list, which is configuration, and the tag, which is how a thread
 * remembers which corpus it was asked of.
 *
 * The ACTIVE key is a module store resolved from `import.meta.env` when the
 * module is first imported, so it cannot be re-resolved per test without
 * resetting modules. It is measured in corpusStore.test.ts, which does exactly
 * that. What is here is the pure half: parsing, precedence, and the tag.
 */
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseCorpusOptions', () => {
  it('leser nøkkel og navn, adskilt med semikolon', () => {
    expect(parseCorpusOptions('norquad-docs=Wikipedia;kudos-pilot=Kudos-pilot')).toEqual([
      { key: 'norquad-docs', label: 'Wikipedia' },
      { key: 'kudos-pilot', label: 'Kudos-pilot' },
    ]);
  });

  it('lar navnet inneholde parenteser og mellomrom', () => {
    // Bare den FØRSTE `=` deler, og resten er navnet uansett hva det er.
    // Ellers ville «Wikipedia (NorQuAD)» vært en ugyldig oppføring.
    expect(parseCorpusOptions('norquad-docs=Wikipedia (NorQuAD)')).toEqual([
      { key: 'norquad-docs', label: 'Wikipedia (NorQuAD)' },
    ]);
  });

  it('tar med beskrivelsen etter loddrett strek', () => {
    expect(parseCorpusOptions('kudos-pilot=Kudos-pilot|5 årsrapporter')).toEqual([
      { key: 'kudos-pilot', label: 'Kudos-pilot', description: '5 årsrapporter' },
    ]);
  });

  it('godtar fortsatt en oppføring uten beskrivelse', () => {
    // Beskrivelsen er et tillegg til formatet i briefen, ikke en endring av
    // det. En oppsetting som ikke har noen, mister bare den andre linja.
    const [option] = parseCorpusOptions('kudos-pilot=Kudos-pilot');
    expect(option).toEqual({ key: 'kudos-pilot', label: 'Kudos-pilot' });
    expect(option.description).toBeUndefined();
  });

  it('trimmer rundt nøkkel, navn og beskrivelse', () => {
    expect(parseCorpusOptions('  a = Alfa | Første  ;  b = Beta ')).toEqual([
      { key: 'a', label: 'Alfa', description: 'Første' },
      { key: 'b', label: 'Beta' },
    ]);
  });

  it('er tom når variabelen ikke er satt eller er blank', () => {
    expect(parseCorpusOptions(undefined)).toEqual([]);
    expect(parseCorpusOptions('')).toEqual([]);
    expect(parseCorpusOptions('   ')).toEqual([]);
  });

  it('hopper over en ugyldig oppføring i stedet for å kaste', () => {
    // En oppsettingsvariabel leses ved oppstart. Én dårlig oppføring skal
    // koste den oppføringa, ikke hele appen.
    expect(parseCorpusOptions('a=Alfa;ingen-likhetstegn;=uten nøkkel;b=Beta')).toEqual([
      { key: 'a', label: 'Alfa' },
      { key: 'b', label: 'Beta' },
    ]);
  });

  it('sier fra i konsollen om det den hoppet over', () => {
    // Et korpus som stille lar være å dukke opp, er den slags feil som får
    // skylda på backend i en halv ettermiddag.
    parseCorpusOptions('a=Alfa;ingen-likhetstegn');
    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain('ingen-likhetstegn');
  });

  it('lar den første vinne når en nøkkel står to ganger', () => {
    // To rader som sender det samme er verre enn én.
    expect(parseCorpusOptions('a=Først;a=Så')).toEqual([{ key: 'a', label: 'Først' }]);
  });
});

describe('resolveCorpus', () => {
  it('velger det som står i VITE_KA_DATASET_CONFIG_KEY', () => {
    const { options, fallback } = resolveCorpus('a=Alfa;b=Beta', 'b');
    expect(options.map((option) => option.key)).toEqual(['a', 'b']);
    expect(fallback).toBe('b');
  });

  it('velger den første i lista når ingen er pekt ut', () => {
    expect(resolveCorpus('a=Alfa;b=Beta', undefined).fallback).toBe('a');
  });

  it('beholder en enslig nøkkel uten liste, som før', () => {
    // Bakoverkompatibelt: VITE_KA_DATASET_CONFIG_KEY var den eneste
    // innstillinga til i dag, og en oppsetting som bare har den skal virke.
    const { options, fallback } = resolveCorpus(undefined, 'kudos-pilot');
    expect(options).toEqual([{ key: 'kudos-pilot', label: 'kudos-pilot' }]);
    expect(fallback).toBe('kudos-pilot');
  });

  it('legger til en utpekt nøkkel som lista har glemt', () => {
    // En nøkkel som når backend i dag skal ikke slutte å gjøre det fordi noen
    // skrev en liste som ikke hadde den med.
    const { options, fallback } = resolveCorpus('a=Alfa', 'glemt');
    expect(options.map((option) => option.key)).toEqual(['glemt', 'a']);
    expect(fallback).toBe('glemt');
  });

  it('er tom når verken liste eller nøkkel er satt', () => {
    expect(resolveCorpus(undefined, undefined)).toEqual({ options: [], fallback: undefined });
  });
});

describe('korpusmerket på en tråd', () => {
  it('leser nøkkelen ut av taggene backend lagrer', () => {
    expect(corpusKeyFromTags([`${CORPUS_TAG_PREFIX}kudos-pilot`])).toBe('kudos-pilot');
  });

  it('lar andres tagger ligge', () => {
    // `tags` er en delt liste. Uten prefikset kunne vi lest noen andres
    // merkelapp som et korpus, og de kunne lest vårt som sitt.
    expect(corpusKeyFromTags(['viktig', 'kudos-pilot'])).toBeUndefined();
    expect(corpusKeyFromTags(['viktig', `${CORPUS_TAG_PREFIX}norquad-docs`])).toBe('norquad-docs');
  });

  it('svarer undefined på tomt, manglende og halvt merke', () => {
    expect(corpusKeyFromTags(undefined)).toBeUndefined();
    expect(corpusKeyFromTags(null)).toBeUndefined();
    expect(corpusKeyFromTags([])).toBeUndefined();
    expect(corpusKeyFromTags([CORPUS_TAG_PREFIX])).toBeUndefined();
  });
});
