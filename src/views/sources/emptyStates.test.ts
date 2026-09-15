import { describe, expect, it } from 'vitest';
import type { MessageStatus } from '../../model';
import { NO_ANSWER_YET, emptyStateFor } from './emptyStates';

const WITH_AN_ANSWER: Exclude<MessageStatus, 'streaming'>[] = [
  'complete',
  'aborted',
  'error',
  'needs-clarification',
];

describe('emptyStateFor', () => {
  it('never tells a reader who has asked a question that they have not', () => {
    // The bug this file exists to prevent: every one of these states follows a
    // question the user actually asked.
    for (const status of WITH_AN_ANSWER) {
      expect(emptyStateFor(status).description).not.toContain('når du har stilt et spørsmål');
    }
  });

  it('says that a stopped answer was stopped', () => {
    expect(emptyStateFor('aborted').title).toBe('Svaret ble avbrutt før kildene kom');
  });

  it('gives every state its own words', () => {
    const titles = WITH_AN_ANSWER.map((status) => emptyStateFor(status).title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).not.toContain(NO_ANSWER_YET.title);
  });
});
