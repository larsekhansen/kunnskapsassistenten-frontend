import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { MainScrollContext } from '../../layout/scrollContext';
import type { StreamEvent, ThreadDetail } from '../../model';
import { ChatView } from './ChatView';

/*
 * Designsystemet's Skeleton asks document.getAnimations, which jsdom does not
 * have. The empty answer card renders one while the first token is on its way.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/** A client whose whole turn is decided up front. */
function clientYielding(events: StreamEvent[]): ChatClient {
  return {
    async *ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
      for (const event of events) {
        if (signal?.aborted) return;
        yield event;
      }
      // Nothing more is coming, but the turn is not over either: the stop
      // button has to stay reachable when the list is empty.
      if (events.length === 0) await new Promise(() => {});
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

/** The three pieces of the shell the chat view reads. */
function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MainScrollContext value={scrollRef}>
      <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
        <AnswerSourcesContext value={{ documents: undefined, setDocuments: () => {} }}>
          {children}
        </AnswerSourcesContext>
      </CitationContext>
    </MainScrollContext>
  );
}

function ask(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

const done: StreamEvent = { type: 'done', messageId: 'm1', conversationId: 'c1' };

describe('ChatView', () => {
  it('gives a conversation started on the front page the same head as a thread', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'token', text: 'Svar.' }, done])} />
      </Shell>,
    );

    // Before the first question the only heading is the greeting.
    expect(screen.queryByRole('heading', { name: /rapporten/u })).toBeNull();

    ask('Hva sier rapporten? Og hva med 2023?');

    // The thread has no title yet, so the first sentence of the question
    // stands in — the head is the same on both routes (finding 5).
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Hva sier rapporten' })).toBeTruthy(),
    );
  });

  it('keeps the thread title when the thread has one', () => {
    const thread: ThreadDetail = {
      id: 't1',
      title: 'NKOM måloppnåelse',
      createdAt: '2026-09-15T09:00:00Z',
      updatedAt: '2026-09-15T09:00:00Z',
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'Hva sier rapporten?',
          createdAt: '2026-09-15T09:00:00Z',
          citations: [],
          status: 'complete',
        },
      ],
    };

    render(
      <Shell>
        <ChatView client={clientYielding([done])} thread={thread} />
      </Shell>,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('NKOM måloppnåelse');
  });

  it('does not ask for a retry in the text right above the retry button', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([
            { type: 'error', error: { code: 'unknown', message: 'Noe gikk galt. Prøv igjen.' } },
          ])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('Noe gikk galt.'));

    // Once, on the button (finding 9).
    expect(alert.textContent?.match(/Prøv igjen/gu)).toHaveLength(1);
  });

  it('says «Avbryt» in words while the answer is on its way', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([])} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    // A bare square is not obviously «stopp» to anyone looking (finding 10).
    const stop = await screen.findByRole('button', { name: 'Avbryt genereringen' });
    expect(stop.textContent).toContain('Avbryt');
  });
});
