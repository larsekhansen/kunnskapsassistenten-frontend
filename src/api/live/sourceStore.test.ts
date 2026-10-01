import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_STORED_CHARS,
  SOURCES_STORAGE_KEY,
  answerFingerprint,
  recallThreadSources,
  rememberAnswerSources,
} from './sourceStore';

const chunks = [
  {
    chunk_id: 'ef0a96e7e2bb',
    doc_num: '32062',
    title: 'Tildelingsbrev Digdir 2023',
    metadata: '{"Header 1" "Mål"}',
  },
  { chunk_id: '3c399236a70d', doc_num: '32062', docTitle: 'Tildelingsbrev Digdir 2023' },
];

const stored = () => JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) ?? 'null');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('answerFingerprint', () => {
  it('er lik for lik tekst, og for tekst som bare skiller seg i mellomrom i endene', () => {
    expect(answerFingerprint('Svar [1].')).toBe(answerFingerprint('  Svar [1].\n'));
  });

  it('skiller tekster som er ulike', () => {
    expect(answerFingerprint('Svar [1].')).not.toBe(answerFingerprint('Svar [2].'));
    expect(answerFingerprint('ab')).not.toBe(answerFingerprint('ba'));
  });
});

describe('rememberAnswerSources og recallThreadSources', () => {
  it('finner bitene igjen under tråden og teksten i svaret', () => {
    rememberAnswerSources('conv-1', 'Svar [1].', chunks, 1000);

    const remembered = recallThreadSources('conv-1', 2000);

    expect(remembered?.get(answerFingerprint('Svar [1].'))).toEqual([
      {
        chunk_id: 'ef0a96e7e2bb',
        doc_num: '32062',
        title: 'Tildelingsbrev Digdir 2023',
        metadata: '{"Header 1" "Mål"}',
      },
      // One name for the title, whichever it arrived under.
      { chunk_id: '3c399236a70d', doc_num: '32062', title: 'Tildelingsbrev Digdir 2023' },
    ]);
  });

  it('lagrer bare det svaret bar, ikke tekst fra dokumentene', () => {
    rememberAnswerSources('conv-1', 'Svar.', [
      { ...chunks[0], content_markdown: 'Hele utdraget.' } as never,
    ]);

    expect(localStorage.getItem(SOURCES_STORAGE_KEY)).not.toContain('Hele utdraget');
  });

  it('holder svarene i en tråd fra hverandre', () => {
    rememberAnswerSources('conv-1', 'Første svar.', [chunks[0]]);
    rememberAnswerSources('conv-1', 'Andre svar.', [chunks[1]]);

    const remembered = recallThreadSources('conv-1');
    expect(remembered?.get(answerFingerprint('Første svar.'))?.[0]?.chunk_id).toBe('ef0a96e7e2bb');
    expect(remembered?.get(answerFingerprint('Andre svar.'))?.[0]?.chunk_id).toBe('3c399236a70d');
  });

  it('skriver ingenting uten tråd, uten tekst eller uten biter', () => {
    rememberAnswerSources('', 'Svar.', chunks);
    rememberAnswerSources('conv-1', '  ', chunks);
    rememberAnswerSources('conv-1', 'Svar.', []);

    expect(localStorage.getItem(SOURCES_STORAGE_KEY)).toBeNull();
    expect(recallThreadSources('conv-1')).toBeUndefined();
  });

  it('regner det som bruk å åpne tråden', () => {
    rememberAnswerSources('conv-1', 'Svar.', chunks, 1000);

    recallThreadSources('conv-1', 5000);

    expect(stored().threads['conv-1'].usedAt).toBe(5000);
  });

  it('fjerner tråden som ble brukt lengst siden når lageret blir for stort', () => {
    // Four threads whose chunks each take a third of the room: only three fit.
    const big = [{ chunk_id: 'a', metadata: 'x'.repeat(MAX_STORED_CHARS / 3) }];
    rememberAnswerSources('eldst', 'Svar.', big, 1);
    rememberAnswerSources('nest', 'Svar.', big, 2);
    recallThreadSources('eldst', 3);
    rememberAnswerSources('nyest', 'Svar.', big, 4);

    // «nest» was used longest ago once «eldst» was opened again.
    expect(Object.keys(stored().threads).sort()).toEqual(['eldst', 'nyest']);
    expect(localStorage.getItem(SOURCES_STORAGE_KEY)?.length).toBeLessThanOrEqual(MAX_STORED_CHARS);
  });

  it('tåler et lager med søppel i', () => {
    localStorage.setItem(SOURCES_STORAGE_KEY, '{ikke json');
    expect(recallThreadSources('conv-1')).toBeUndefined();

    localStorage.setItem(
      SOURCES_STORAGE_KEY,
      JSON.stringify({
        threads: { 'conv-1': { usedAt: 1, answers: { x: [null, 7, { chunk_id: 3 }] } } },
      }),
    );
    expect(recallThreadSources('conv-1')?.get('x')).toEqual([{}]);
  });

  it('kaster ikke når nettleseren nekter å skrive', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => rememberAnswerSources('conv-1', 'Svar.', chunks)).not.toThrow();
  });

  it('kaster ikke når nettleseren nekter å lese', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blokkert', 'SecurityError');
    });

    expect(recallThreadSources('conv-1')).toBeUndefined();
  });
});
