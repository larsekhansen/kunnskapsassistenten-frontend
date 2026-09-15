import { describe, expect, test } from 'vitest';
import { kudosLinkLabel, reachesPage } from './kudosLink';

const LANDING = 'https://kudos.dfo.no/dokument/a1c3a188-a28d-4d96-b95a-2ab7cd0cf565';
const FILE = `${LANDING}/filer/a1c3a18b-d573-447e-bbf9-5fffa9b38bc9.pdf`;

describe('reachesPage', () => {
  test('sann bare for filadressen med riktig #page', () => {
    expect(reachesPage(`${FILE}#page=41`, 41)).toBe(true);
    expect(reachesPage(`${LANDING}#page=41`, 41)).toBe(true);
  });

  test('usann for feil sidetall', () => {
    expect(reachesPage(`${FILE}#page=41`, 52)).toBe(false);
  });

  test('usann uten fragment', () => {
    expect(reachesPage(LANDING, 41)).toBe(false);
    expect(reachesPage(FILE, 41)).toBe(false);
  });

  test('usann for #side-N, som ingen visning tolker', () => {
    expect(reachesPage(`${LANDING}#side-41`, 41)).toBe(false);
  });
});

describe('kudosLinkLabel', () => {
  test('lover en side bare når adressen kan holde løftet', () => {
    expect(kudosLinkLabel(`${FILE}#page=41`, 41)).toBe('Les side 41 på Kudos');
  });

  test('landingssiden lover dokumentet, ikke siden', () => {
    expect(kudosLinkLabel(`${LANDING}#side-41`, 41)).toBe('Les dokumentet på Kudos');
    expect(kudosLinkLabel(LANDING, 41)).toBe('Les dokumentet på Kudos');
  });

  test('uten sidetall lover den dokumentet', () => {
    expect(kudosLinkLabel(LANDING, undefined)).toBe('Les dokumentet på Kudos');
  });
});
