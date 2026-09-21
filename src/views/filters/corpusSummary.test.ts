import { describe, expect, it } from 'vitest';
import type { CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';
import { corpusSummary } from './corpusSummary';

const types = (...values: [string, number][]): FilterFacet => ({
  dimension: 'documentType',
  label: 'Dokumenttyper',
  values: values.map(([label, count]) => ({ value: label.toLowerCase(), label, count })),
});

/**
 * The corpus these sentences are about. It used to be baked into the
 * function; now the line names whatever corpus it is handed, so the tests
 * hand it the one mock mode has.
 */
const kudos: CorpusOption = { key: 'mock', label: 'Kudos, 938 dokumenter (mock)' };

const years = (...values: number[]): FilterFacet => ({
  dimension: 'year',
  label: 'År',
  values: values.map((year) => ({ value: String(year), label: String(year) })),
});

describe('corpusSummary', () => {
  it('names the source, the size, the types and the years', () => {
    const line = corpusSummary(
      [
        types(['Årsrapport', 500], ['Evaluering', 300], ['Tildelingsbrev', 138]),
        years(2020, 2024, 2027),
      ],
      kudos,
    );

    expect(line).toBe(
      'Dokumenter fra Kudos: 938 dokumenter, årsrapporter, evalueringer og tildelingsbrev, 2020–2027',
    );
  });

  it('says «Dokumenter fra Kudos» alone when there are no facets', () => {
    // Live mode: the backend has no facet aggregation (API-bestilling A2), so
    // there is nothing to count. Saying where the answers come from is still
    // the one thing the reader did not know.
    expect(corpusSummary([], kudos)).toBe('Dokumenter fra Kudos');
    expect(corpusSummary(undefined, kudos)).toBe('Dokumenter fra Kudos');
  });

  it('drops the count rather than adding up a partial one', () => {
    const facet = types(['Årsrapport', 500], ['Evaluering', 300]);
    facet.values[1] = { value: 'evaluering', label: 'Evaluering' };

    // A sum over values where one count is missing is a wrong number, and a
    // wrong number is worse than no number.
    expect(corpusSummary([facet, years(2020, 2024)], kudos)).toBe(
      'Dokumenter fra Kudos: årsrapporter og evalueringer, 2020–2024',
    );
  });

  it('keeps a type it has no plural for, rather than inventing one', () => {
    // «Strategi/plan» has no clean Norwegian plural. The facet's own word is
    // what the dropdown below says, so it is the honest fallback.
    expect(corpusSummary([types(['Strategi/plan', 12])], kudos)).toBe(
      'Dokumenter fra Kudos: 12 dokumenter, strategi/plan',
    );
  });

  it('names a sixth type rather than saying «med flere» about one', () => {
    // «med flere» is longer than the type it would replace, and says less.
    const line = corpusSummary(
      [
        types(
          ['Årsrapport', 6],
          ['Evaluering', 5],
          ['Tildelingsbrev', 4],
          ['Statusrapport', 3],
          ['Proposisjon til Stortinget', 2],
          ['Strategi/plan', 1],
        ),
      ],
      kudos,
    );

    expect(line).toBe(
      'Dokumenter fra Kudos: 21 dokumenter, årsrapporter, evalueringer, tildelingsbrev, statusrapporter, proposisjoner til Stortinget og strategi/plan',
    );
  });

  it('stops naming types once there are more than one over the cap', () => {
    const line = corpusSummary(
      [
        types(
          ['Årsrapport', 7],
          ['Evaluering', 6],
          ['Tildelingsbrev', 5],
          ['Statusrapport', 4],
          ['Proposisjon til Stortinget', 3],
          ['Strategi/plan', 2],
          ['Høringsnotat', 1],
        ),
      ],
      kudos,
    );

    expect(line).toBe(
      'Dokumenter fra Kudos: 28 dokumenter, årsrapporter, evalueringer, tildelingsbrev, statusrapporter og proposisjoner til Stortinget med flere',
    );
  });

  it('names the biggest types first, not the facet order', () => {
    const line = corpusSummary([types(['Evaluering', 10], ['Årsrapport', 900])], kudos);

    expect(line).toBe('Dokumenter fra Kudos: 910 dokumenter, årsrapporter og evalueringer');
  });

  it('writes one year without a range', () => {
    expect(corpusSummary([years(2024)], kudos)).toBe('Dokumenter fra Kudos: 2024');
  });
});

describe('corpusSummary med et valgt korpus', () => {
  const norquad: CorpusOption = {
    key: 'norquad-docs',
    label: 'Wikipedia (NorQuAD)',
    description: '351 artikler fra Wikipedia, brukt til å prøve ut spørsmål og svar.',
  };

  it('sier korpusets egne ord når det ikke er noe å telle', () => {
    // Live: ingen fasettaggregering (A2). Linja sa «Dokumenter fra Kudos» over
    // NorQuAD sine artikler til korpusvalget kom (målt av KA CC 21.09).
    const line = `Dokumenter fra Wikipedia (NorQuAD): ${norquad.description}`;
    expect(corpusSummary(undefined, norquad)).toBe(line);
    expect(corpusSummary([], norquad)).toBe(line);
  });

  it('navngir korpuset når det ikke har noen beskrivelse', () => {
    expect(corpusSummary([], { key: 'kudos-pilot', label: 'Kudos-pilot' })).toBe(
      'Dokumenter fra Kudos-pilot',
    );
  });

  it('bruker navnet foran kommaet i en setning som teller selv', () => {
    // Etiketten er skrevet for en rad i en velger: «Kudos, 938 dokumenter
    // (mock)». Setningen under teller dokumentene selv, så den skal ikke si
    // tallet to ganger.
    const line = corpusSummary([types(['Årsrapport', 12])], {
      key: 'mock',
      label: 'Kudos, 938 dokumenter (mock)',
    });

    expect(line).toBe('Dokumenter fra Kudos: 12 dokumenter, årsrapporter');
  });

  it('lar et navn med parentes stå helt', () => {
    expect(corpusSummary([types(['Årsrapport', 3])], norquad)).toBe(
      'Dokumenter fra Wikipedia (NorQuAD): 3 dokumenter, årsrapporter',
    );
  });

  it('står som før uten korpus', () => {
    expect(corpusSummary(undefined, kudos)).toBe('Dokumenter fra Kudos');
  });
  it('navngir ikke et korpus den ikke kjenner', () => {
    /*
     * Live uten både `VITE_KA_DATASETS` og `VITE_KA_DATASET_CONFIG_KEY`:
     * backenden velger datasett, og ingenting på denne siden vet hvilket. Da
     * er «Dokumenter fra Kudos» den samme påstanden denne fila ble endret for
     * å slutte med (KA CC på #106).
     */
    expect(corpusSummary(undefined, undefined)).toBe('Dokumenter fra standardkorpuset');
    expect(corpusSummary([types(['Årsrapport', 4])], undefined)).toBe(
      'Dokumenter fra standardkorpuset: 4 dokumenter, årsrapporter',
    );
  });
});
