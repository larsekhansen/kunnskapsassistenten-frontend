import { describe, expect, it } from 'vitest';
import { MOCK_CORPUS } from '../../api/corpus';
import { GENERAL_KICKSTARTERS, KICKSTARTERS, kickstartersFor } from './text';

/**
 * Forslagene på tomtilstanden følger korpuset (brukerblikk 5, funn 2).
 *
 * De tre Kudos-spørsmålene sto over hvert eneste korpus, også over 351
 * Wikipedia-artikler som ikke kan svare på noen av dem. Det er ikke en påstand
 * som leses rart, det er en invitasjon til å stille tre spørsmål korpuset ikke
 * kan svare på.
 */
describe('kickstartersFor', () => {
  it('gir Kudos-spørsmålene til kudos-pilot', () => {
    expect(kickstartersFor('kudos-pilot')).toEqual(KICKSTARTERS);
  });

  it('gir Kudos-spørsmålene til mock-korpuset', () => {
    // Mock svarer fra 938 Kudos-dokumenter, så det er de samme tre.
    expect(kickstartersFor('mock')).toEqual(KICKSTARTERS);
  });

  it('holder seg til mock-korpusets faktiske nøkkel', () => {
    /*
     * Nøkkelen står som streng her og eies av src/api/corpus.ts. Denne
     * påstanden er hele koblingen: døpes korpuset om der, blir dette rødt i
     * stedet for at mock stille faller tilbake til de generelle forslagene.
     */
    expect(kickstartersFor(MOCK_CORPUS.key)).toEqual(KICKSTARTERS);
  });

  it('gir de generelle spørsmålene til norquad-docs', () => {
    expect(kickstartersFor('norquad-docs')).toEqual(GENERAL_KICKSTARTERS);
  });

  it('gir de generelle spørsmålene til en nøkkel ingen har skrevet en liste for', () => {
    // Den trygge retningen å ta feil i: et generelt spørsmål over Kudos virker
    // fortsatt, et Kudos-spørsmål over Wikipedia gjør ikke det.
    expect(kickstartersFor('et-korpus-som-kommer-senere')).toEqual(GENERAL_KICKSTARTERS);
  });

  it('gir de generelle spørsmålene når ingen nøkkel er satt', () => {
    expect(kickstartersFor(undefined)).toEqual(GENERAL_KICKSTARTERS);
  });

  it('spør om dokumentene og ikke om noe i dem', () => {
    /*
     * Det er det som gjør de generelle tre generelle. Nevner ett av dem et
     * emne, er det den samme feilen ett korpus lenger fram — så testen holder
     * dem fra å samle opp innhold over tid.
     */
    expect(GENERAL_KICKSTARTERS).toHaveLength(3);
    for (const question of GENERAL_KICKSTARTERS) {
      expect(question, question).not.toMatch(/Kudos|Digdir|Udir|DSS|årsrapport|tildelingsbrev/iu);
      // Hele spørsmål, ikke halve: knappen leses før den plukkes.
      expect(question, question).not.toMatch(/…|\.\.\./u);
    }
  });
});
