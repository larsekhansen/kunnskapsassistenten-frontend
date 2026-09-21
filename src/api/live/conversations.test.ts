import { describe, expect, it } from 'vitest';
import {
  agentIdFromToolName,
  citationCountIn,
  messagesFromApi,
  sourcesFromChunks,
  threadDetailFrom,
  threadFromConversation,
  type ApiConversation,
  type ApiMessage,
} from './conversations';

/**
 * A real response, recorded off the running stack on 2026-09-16.
 *
 * `GET /api/conversations/:id` after one live turn against `norquad-docs`.
 * The answer is kept whole, and that is not laziness: it was trimmed at first,
 * and the trim cut away three of its four `[n]` markers — the very thing the
 * count below is about. A fixture shortened past the property under test
 * measures nothing. Recorded rather than invented, because
 * every surprise in it is a thing the mapping has to survive and none of them
 * were in the route's name: the system prompt stored as a message, `created`
 * as epoch milliseconds, and — the one that decides what the sources panel
 * can show — `chunks: []` on an answer that had just retrieved five of them.
 */
const RECORDED = {
  conversation: {
    id: '5G7i1YoIdX432vrCDLrwk',
    topic: 'Prøvetråd fra 5k',
    agentId: 'builtin/agent-rag-agent',
    userId: 'ka-test-5k',
    tags: [],
    created: 1789543530940,
  },
  messages: [
    {
      id: 'ZSWJWJ_kRkX8FqPkqFNdo',
      text: 'You are a helpful assistant.',
      role: 'system',
      created: 1789543530940,
      tags: [],
      filterValue: null,
      chunks: [],
    },
    {
      id: 'T59ekArTAWZFtR6EeodCc',
      text: 'Hva er Norge kjent for?',
      role: 'user',
      created: 1789543552826,
      tags: [],
      filterValue: null,
      chunks: [],
    },
    {
      id: 'J6R-1phfYTQ0-kKZkyveD',
      text: 'Norge er blant annet kjent for:\n\n- En lang kyst mot Nordsjøen, Norskehavet og Barentshavet, samt store fiskefelter og petroleumsforekomster på kontinentalsokkelen. [2]  \n- Olje- og gassvirksomhet i Nordsjøen, særlig etter funnet av Ekofiskfeltet i 1969. Gassproduksjonen har økt, mens oljeproduksjonen nådde toppen i 2000 og deretter har hatt en nedadgående trend. [3]  \n- Vannkraft og et deregulert kraftmarked, med handel gjennom den nordiske kraftbørsen Nord Pool. [4]  \n- Store verneområder: 17 % av hovedlandets areal og 65 % av Svalbard var vernet, ifølge tall fra 2018. [2]  \n- Et langt og smalt hovedland på Den skandinaviske halvøya, med grense mot Sverige, Finland og Russland. [2]  \n- Et navn med gammel historie: «Norge» kan trolig rekonstrueres som *Norðrvegr*, «veien mot nord», og var opprinnelig navn på skipsleia langs vestkysten. [1]',
      role: 'assistant',
      created: 1789543570840,
      tags: [],
      filterValue: null,
      chunks: [],
    },
  ],
} as { conversation: ApiConversation; messages: ApiMessage[] };

describe('agentIdFromToolName', () => {
  it('gjør verktøynavnet om til agent-id-en', () => {
    // Samme agent, to skrivemåter, og bare én virker hvert sted. Målt på tre
    // agenter mot den lokale stakken; verktøynavnet gir «Agent not found».
    expect(agentIdFromToolName('builtin.agent-rag-agent__agent-rag-graph-bundled')).toBe(
      'builtin/agent-rag-agent',
    );
    expect(agentIdFromToolName('digdir.altinn-docs-tuned__agent-rag-graph-faithful')).toBe(
      'digdir/altinn-docs-tuned',
    );
    expect(agentIdFromToolName('builtin.ai-overview-agent__ai-overview')).toBe(
      'builtin/ai-overview-agent',
    );
  });

  it('lar et navn uten skillegraf være', () => {
    expect(agentIdFromToolName('builtin.agent-rag-agent')).toBe('builtin/agent-rag-agent');
  });
});

describe('threadFromConversation', () => {
  it('gjør epoke-millisekunder om til ISO', () => {
    const thread = threadFromConversation(RECORDED.conversation);

    expect(thread.id).toBe('5G7i1YoIdX432vrCDLrwk');
    expect(thread.title).toBe('Prøvetråd fra 5k');
    expect(Date.parse(thread.createdAt)).not.toBeNaN();
    expect(thread.conversationId).toBe(thread.id);
  });

  it('setter updatedAt lik createdAt, fordi det er alt som finnes', () => {
    /*
     * Samtalen har `created` og ingenting som flytter seg når en tur legges
     * til. Trådlista grupperer på `updatedAt`, så en samtale besvart i dag
     * men startet forrige måned havner under forrige måned. Det er et hull i
     * backenden; et gjettet tidspunkt ville plassert rader like galt uten å
     * si fra.
     */
    const thread = threadFromConversation(RECORDED.conversation);
    expect(thread.updatedAt).toBe(thread.createdAt);
  });

  it('gir en samtale uten emne et navn likevel', () => {
    expect(threadFromConversation({ id: 'x', topic: '  ' }).title).toBe('Uten tittel');
  });

  it('leser korpuset tråden ble startet i, ut av taggene', () => {
    // Skrevet av `#createConversation` da tråden ble laget. Målt mot den
    // kjørende stacken 21.09: backend tar imot `tags` og gir dem tilbake på
    // både liste og enkeltoppslag, så en tråd lest på en annen maskin vet
    // fortsatt hvilket korpus den hører til.
    const thread = threadFromConversation({ id: 'x', tags: ['corpus:kudos-pilot'] });
    expect(thread.corpusKey).toBe('kudos-pilot');
  });

  it('lar corpusKey være usatt for en tråd fra før det fantes et valg', () => {
    // Ikke satt til det som er valgt nå: et korpus er et faktum om når
    // tråden ble spurt, ikke om hva leseren har valgt i dag.
    expect(threadFromConversation({ id: 'x' }).corpusKey).toBeUndefined();
    expect(threadFromConversation({ id: 'x', tags: [] }).corpusKey).toBeUndefined();
    expect(threadFromConversation({ id: 'x', tags: ['viktig'] }).corpusKey).toBeUndefined();
  });
});

describe('messagesFromApi', () => {
  it('lar systemmeldingen ligge', () => {
    // Stakken skriver «You are a helpful assistant.» som første melding i
    // hver samtale. Det er ledeteksten, ikke noe noen har sagt.
    const turns = messagesFromApi(RECORDED.messages);

    expect(turns.map((turn) => turn.role)).toEqual(['user', 'assistant']);
    expect(turns.some((turn) => turn.content.includes('helpful assistant'))).toBe(false);
  });

  it('tar med spørsmålet og svaret slik de ble lagret', () => {
    const [question, answer] = messagesFromApi(RECORDED.messages);

    expect(question?.content).toBe('Hva er Norge kjent for?');
    expect(answer?.content.startsWith('Norge er blant annet kjent for')).toBe(true);
    expect(Date.parse(answer!.createdAt)).not.toBeNaN();
  });

  it('gir svaret et markørtall og spørsmålet ingen', () => {
    // Bare et svar siterer. Et spørsmål med klammer i er et spørsmål med
    // klammer i.
    const [question, answer] = messagesFromApi(RECORDED.messages);

    expect(answer?.citationCount).toBe(4);
    expect(question?.citationCount).toBeUndefined();
    // Og siteringene er tomme, fordi ingen utdrag ble lagret. Det er nettopp
    // de to som kommer fra hverandre her.
    expect(answer?.citations).toEqual([]);
  });

  it('dropper en tur uten tekst', () => {
    // En tur som feilet lar en tom melding ligge igjen, og en tom boble midt
    // i en samtale leses som en tegnefeil.
    expect(messagesFromApi([{ id: 'a', role: 'assistant', text: '   ' }])).toHaveLength(0);
  });
});

describe('citationCountIn', () => {
  it('teller ingen markører i en tekst uten', () => {
    expect(citationCountIn('Norge er kjent for fjell og fisk.')).toBe(0);
    expect(citationCountIn('')).toBe(0);
    expect(citationCountIn(null)).toBe(0);
  });

  it('teller én', () => {
    expect(citationCountIn('Nkom rapporterer kvartalsvis [1].')).toBe(1);
  });

  it('teller flere, også flersifrede', () => {
    expect(citationCountIn('Ett [1], to [2], tolv [12].')).toBe(3);
  });

  it('teller den samme markøren én gang', () => {
    /*
     * Tallet er «hvor mange kilder peker svaret på», ikke «hvor mange ganger
     * peker det». Det opptakede svaret skriver [2] to ganger, og det er
     * fortsatt én kilde.
     */
    expect(citationCountIn('Kysten [2]. Verneområdene [2]. Navnet [1].')).toBe(2);
  });

  it('teller markørene i det ekte svaret', () => {
    const answer = RECORDED.messages.find((message) => message.role === 'assistant');
    // Fire distinkte markører i en tekst uten ett eneste lagret utdrag. Det er
    // hele grunnen til at tomtilstanden måtte skrives om.
    expect(citationCountIn(answer?.text)).toBe(4);
  });
});

describe('sourcesFromChunks', () => {
  it('sier «ingenting er kjent» når backenden ikke lagret noe', () => {
    /*
     * Dette er tilstanden backenden faktisk er i: svaret over hadde hentet
     * fem utdrag, og kom tilbake med `chunks: []`. undefined og tom liste er
     * forskjellige svar for kildepanelet — «ingenting er kjent» mot
     * «ingenting ble funnet» — og dette er det første.
     */
    const answer = messagesFromApi(RECORDED.messages).at(-1);

    expect(answer?.sources).toBeUndefined();
    expect(sourcesFromChunks([])).toBeUndefined();
    expect(sourcesFromChunks(null)).toBeUndefined();
  });

  it('grupperer utdrag per dokument og beholder nummereringen', () => {
    const documents = sourcesFromChunks([
      { chunkId: 'c1', docNum: '7', docTitle: 'Norge', contentMarkdown: 'Første utdrag' },
      { chunkId: 'c2', docNum: '7', docTitle: 'Norge', contentMarkdown: 'Andre utdrag' },
      { chunkId: 'c3', docNum: '9', docTitle: 'Nordsjøen', contentMarkdown: 'Tredje utdrag' },
    ]);

    expect(documents).toHaveLength(2);
    expect(documents?.[0]?.excerpts.map((excerpt) => excerpt.citationNumber)).toEqual([1, 2]);
    expect(documents?.[1]?.excerpts[0]?.citationNumber).toBe(3);
    // Teksten finnes her og ikke i strømmen: lagrede utdrag bærer
    // contentMarkdown, mens structuredContent.chunks bare har id og tittel.
    expect(documents?.[0]?.excerpts[0]?.text).toBe('Første utdrag');
    // Ingen adresse å sende leseren til. Panelet tegner utdraget uten lenke.
    expect(documents?.[0]?.url).toBeUndefined();
    expect(documents?.[0]?.excerpts[0]?.kudosUrl).toBeUndefined();
  });
});

describe('threadDetailFrom', () => {
  it('lar siste tur si når tråden sist var i bruk', () => {
    // Bedre enn `created` når det finnes en tur. Lista kan ikke gjøre dette:
    // den får ingen meldinger, så bare en åpnet tråd vet det.
    const detail = threadDetailFrom(RECORDED.conversation, RECORDED.messages);
    const last = detail.messages.at(-1);

    expect(detail.messages).toHaveLength(2);
    expect(detail.updatedAt).toBe(last?.createdAt);
    expect(Date.parse(detail.updatedAt)).toBeGreaterThan(Date.parse(detail.createdAt));
  });

  it('gir en tom samtale tidspunktet den ble laget', () => {
    const detail = threadDetailFrom(RECORDED.conversation, []);
    expect(detail.updatedAt).toBe(detail.createdAt);
    expect(detail.messages).toEqual([]);
  });
});
