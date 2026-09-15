import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import type { StreamEvent } from '../../model';
import { useChat } from './useChat';

/** One `ask` call, held open so a test can decide when the next frame lands. */
type OpenTurn = {
  query: string;
  emit: (event: StreamEvent) => void;
};

/**
 * A client whose streams never end on their own.
 *
 * The real clients are driven by the network, so the interesting states —
 * mid-stream, stopped before the first token, overtaken by a second question
 * — are all about when a frame arrives relative to what the reader does.
 * Cancellation comes back as an `error` frame with code `aborted` rather than
 * a thrown exception, exactly as `MockChatClient` reports it.
 */
function heldClient(): { client: ChatClient; turns: OpenTurn[] } {
  const turns: OpenTurn[] = [];

  async function* ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
    const queue: StreamEvent[] = [];
    let wake: (() => void) | null = null;

    turns.push({
      query,
      emit(event) {
        queue.push(event);
        wake?.();
      },
    });

    for (;;) {
      if (signal?.aborted) {
        yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
        return;
      }
      const next = queue.shift();
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
        signal?.addEventListener('abort', () => resolve(), { once: true });
      });
    }
  }

  return {
    client: {
      ask,
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    },
    turns,
  };
}

const assistantMessages = (messages: { role: string }[]) =>
  messages.filter((message) => message.role === 'assistant');

describe('useChat', () => {
  it('drops an answer that was stopped before its first token', async () => {
    const { client } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(assistantMessages(result.current.messages)).toHaveLength(1);

    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe('Genereringen ble avbrutt.');
    // The question stays; the answer that never said anything does not. Kept,
    // it would be an <li> whose only content is the hidden sender line
    // «Kunnskapsassistenten svarte:».
    expect(assistantMessages(result.current.messages)).toHaveLength(0);
    expect(result.current.messages).toHaveLength(1);
  });

  it('keeps a partial answer when the reader stops it mid-stream', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() => turns[0].emit({ type: 'token', text: 'Måloppnåelse er ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.status).toBe('idle'));
    const [answer] = assistantMessages(result.current.messages);
    expect(answer).toMatchObject({ content: 'Måloppnåelse er ', status: 'complete' });
  });

  it('lets a new question override the turn it interrupted', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Første spørsmål'));
    await waitFor(() => expect(turns).toHaveLength(1));
    act(() => turns[0].emit({ type: 'token', text: 'Starten på svaret ' }));
    await waitFor(() => expect(result.current.status).toBe('streaming'));

    // The follow-up chips stay on screen while an answer streams, so this is
    // two clicks away.
    act(() => result.current.send('Andre spørsmål'));
    await waitFor(() => expect(turns).toHaveLength(2));

    // The first turn's abort lands after the second turn has already said
    // «Henter svar.». It must not put the status back to idle — that would
    // take the stop button away from a generation still running — and it must
    // not announce a cancellation the reader never asked for.
    await waitFor(() => expect(result.current.announcement).toBe('Henter svar.'));
    expect(result.current.status).toBe('pending');

    act(() => turns[1].emit({ type: 'done', messageId: 'm-2', conversationId: 'c-1' }));
    await waitFor(() => expect(result.current.status).toBe('idle'));

    // Both questions and the partial first answer are kept. The second turn
    // finished without a single token, so it holds nothing to show and is
    // gone — the same rule that removes an answer stopped before its first
    // token.
    expect(result.current.messages.map((message) => message.content)).toEqual([
      'Første spørsmål',
      'Starten på svaret ',
      'Andre spørsmål',
    ]);
  });

  it('reports a failed turn once and clears it on retry', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() =>
      turns[0].emit({
        type: 'error',
        error: { code: 'network', message: 'Assistenten svarte ikke.' },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('Assistenten svarte ikke.');
    expect(result.current.announcement).toBe('');
    expect(assistantMessages(result.current.messages)).toHaveLength(0);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('pending'));
    expect(result.current.error).toBeNull();
    expect(turns[1].query).toBe('Hva er måloppnåelse?');
  });

  it('says it is searching once, however many steps arrive', async () => {
    const { client, turns } = heldClient();
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));
    await waitFor(() => expect(turns).toHaveLength(1));

    act(() =>
      turns[0].emit({
        type: 'thinking-step',
        step: { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.' },
      }),
    );
    await waitFor(() => expect(result.current.announcement).toBe('Kunnskapsassistenten søker …'));

    // A dozen more steps must not turn the polite region into a reading of
    // every step; it is still the same sentence when the answer starts.
    act(() =>
      turns[0].emit({
        type: 'thinking-step',
        step: { id: 's2', kind: 'search', label: 'Jeg søker i årsrapportene.' },
      }),
    );
    await waitFor(() => expect(result.current.messages.at(-1)?.thinkingSteps).toHaveLength(2));
    expect(result.current.announcement).toBe('Kunnskapsassistenten søker …');
  });
});
