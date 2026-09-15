import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { threadHeading } from './threadHeading';

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

describe('threadHeading', () => {
  it('shows a title that says more than the question', () => {
    expect(threadHeading('NKOM måloppnåelse', question('Hva sier rapporten?'))).toEqual({
      title: 'NKOM måloppnåelse',
      repeatsQuestion: false,
    });
  });

  it('has nothing to head before the first question', () => {
    expect(threadHeading(undefined, [])).toBeUndefined();
  });

  it('stands in with the first sentence, as a label, and marks it a repeat', () => {
    // No question mark: it replaces titles like «NKOM måloppnåelse». And the
    // question is right under it, so the heading is structure only.
    expect(threadHeading(undefined, question('Hva sier rapporten? Og hva med 2023?'))).toEqual({
      title: 'Hva sier rapporten',
      repeatsQuestion: true,
    });
  });

  it('marks a given title that is the question over again', () => {
    // The client names a new thread after the question until the backend has
    // a title of its own; that is the same text twice, whoever wrote it.
    expect(
      threadHeading('Hva sier rapporten?', question('Hva sier rapporten?'))?.repeatsQuestion,
    ).toBe(true);
  });

  it('does not treat a title that merely starts the same way as a repeat', () => {
    expect(threadHeading('Årsrapport', question('Årsrapport for Digdir 2023?'))).toEqual({
      title: 'Årsrapport',
      repeatsQuestion: false,
    });
  });

  it('does not break a sentence on a decimal point or a section number', () => {
    expect(threadHeading(undefined, question('Hva står i avsnitt 2.1?'))?.title).toBe(
      'Hva står i avsnitt 2.1',
    );
  });

  it('shortens a long question on a word boundary', () => {
    const long =
      'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?';
    const title = threadHeading(undefined, question(long))?.title;

    expect(title?.endsWith(' …')).toBe(true);
    expect(title?.length).toBeLessThanOrEqual(82);
    // Cut between words, never inside one. The « …» stays: it says the title
    // is shortened, which is not what a question mark would have said.
    expect(long.startsWith(title!.slice(0, -2))).toBe(true);
  });

  it('collapses the line breaks a pasted question brings with it', () => {
    expect(threadHeading(undefined, question('Hva sier\n  rapporten'))?.title).toBe(
      'Hva sier rapporten',
    );
  });
});
