import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { threadTitle } from './threadTitle';

function question(content: string): Message[] {
  return [
    {
      id: 'u1',
      role: 'user',
      content,
      createdAt: '2026-09-15T09:00:00Z',
      citations: [],
      status: 'complete',
    },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Svar.',
      createdAt: '2026-09-15T09:00:01Z',
      citations: [],
      status: 'complete',
    },
  ];
}

describe('threadTitle', () => {
  it('keeps the thread title the backend gave', () => {
    expect(threadTitle('NKOM måloppnåelse', question('Hva sier rapporten?'))).toBe(
      'NKOM måloppnåelse',
    );
  });

  it('has nothing to show before the first question', () => {
    expect(threadTitle(undefined, [])).toBeUndefined();
  });

  it('uses the first sentence of the first question, as a label', () => {
    // No question mark: it is a title standing in for «NKOM måloppnåelse»,
    // and the question itself is right under it.
    expect(threadTitle(undefined, question('Hva sier rapporten? Og hva med 2023?'))).toBe(
      'Hva sier rapporten',
    );
  });

  it('does not break a sentence on a decimal point or a section number', () => {
    // «2.1» is not the end of a sentence, so the whole question stands.
    expect(threadTitle(undefined, question('Hva står i avsnitt 2.1?'))).toBe(
      'Hva står i avsnitt 2.1',
    );
  });

  it('shortens a long question on a word boundary', () => {
    const long =
      'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?';
    const title = threadTitle(undefined, question(long));

    expect(title?.endsWith(' …')).toBe(true);
    expect(title?.length).toBeLessThanOrEqual(82);
    // Cut between words, never inside one. The « …» stays: it says the title
    // is shortened, which is not what a question mark would have said.
    expect(long.startsWith(title!.slice(0, -2))).toBe(true);
  });

  it('collapses the line breaks a pasted question brings with it', () => {
    expect(threadTitle(undefined, question('Hva sier\n  rapporten'))).toBe('Hva sier rapporten');
  });
});
