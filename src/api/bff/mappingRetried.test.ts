import { describe, expect, it } from 'vitest';
import type { BffConversationDetail } from './contract';
import retried from './fixtures/conversation-retried.json';
import { threadDetailFromBff } from './mapping';

/**
 * A turn the reader stopped and then asked again («Generer på nytt»).
 *
 * The backend has no way to replace a turn, so the retry is stored as a new
 * one, and the stopped turn keeps the agent loop's failure as its answer
 * (digdir/digdir-headless-rag#22). Recorded from the BFF's
 * `GET /api/v2/conversations/:id` after exactly that.
 */
describe('threadDetailFromBff, et svar som ble prøvd på nytt', () => {
  it('viser spørsmålet én gang, med svaret fra det nye forsøket', () => {
    const thread = threadDetailFromBff(retried as BffConversationDetail);

    expect(thread.messages.map((message) => [message.role, message.status])).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
    expect(thread.messages[1]?.content).toBe(retried.messages[3]?.text);
    expect(thread.messages[1]?.sources?.length).toBeGreaterThan(0);
  });
});
