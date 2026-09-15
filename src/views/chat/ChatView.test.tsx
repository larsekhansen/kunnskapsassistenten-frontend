import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { threadFromQuestion, type StreamEvent, type ThreadDetail } from '../../model';
import { ChatView } from './ChatView';
import {
  CLARIFICATION_PLACEHOLDER,
  CLARIFICATION_TAG,
  COMPOSE_PLACEHOLDER,
  FOLLOW_UP_QUESTIONS,
} from './text';

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

/** The pieces of the shell the chat view reads. */
function Shell({ children, startThread }: { children: ReactNode; startThread?: () => void }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MainScrollContext value={scrollRef}>
      <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
        <AnswerSourcesContext value={{ documents: undefined, setDocuments: () => {} }}>
          <ThreadContext
            value={{
              startThread: (question) => {
                startThread?.();
                return threadFromQuestion(question);
              },
            }}
          >
            {children}
          </ThreadContext>
        </AnswerSourcesContext>
      </CitationContext>
    </MainScrollContext>
  );
}

function field() {
  return screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
}

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

function threadWith(title: string): ThreadDetail {
  return {
    id: 't1',
    title,
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
}

const done: StreamEvent = { type: 'done', messageId: 'm1', conversationId: 'c1' };
const answer: StreamEvent[] = [{ type: 'token', text: 'Svaret på spørsmålet.' }, done];
const clarification: StreamEvent[] = [
  { type: 'token', text: 'Mener du årsrapporten eller tildelingsbrevet?' },
  { type: 'done', messageId: 'm1', conversationId: 'c1', outcome: 'needs-clarification' },
];

describe('ChatView', () => {
  it('gives a conversation started on the front page the same head as a thread', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    // Before the first question the only heading is the greeting.
    expect(screen.queryByRole('heading', { name: /rapporten/u })).toBeNull();

    ask('Hva sier rapporten? Og hva med 2023?');

    // The thread has no title yet, so the first sentence of the question
    // stands in — the head is the same on both routes (finding 5).
    const head = await waitFor(() =>
      screen.getByRole('heading', { level: 2, name: 'Hva sier rapporten' }),
    );

    // But it says no more than the question under it, so it is heard and not
    // seen: the same text twice on screen is what finding 5 asked to stop.
    expect(head.className).toContain('ds-sr-only');
    expect(screen.getAllByText(/Hva sier rapporten\?/u)).toHaveLength(1);
  });

  it('draws a real thread title, with the question under it', () => {
    render(
      <Shell>
        <ChatView client={clientYielding([done])} thread={threadWith('NKOM måloppnåelse')} />
      </Shell>,
    );

    const head = screen.getByRole('heading', { level: 2 });
    expect(head.textContent).toBe('NKOM måloppnåelse');
    expect(head.className).not.toContain('ds-sr-only');
  });

  it('gives the conversation an address when a question is sent', async () => {
    const startThread = vi.fn();
    render(
      <Shell startThread={startThread}>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('  Hva er måloppnåelse?  ');

    // Once, with the question as the reader typed it minus the padding. C16.
    await waitFor(() => expect(startThread).toHaveBeenCalledOnce());
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

  it('shows a clarification as a question and asks the reader to answer it', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(clarification)} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');

    expect(await screen.findByText(CLARIFICATION_TAG)).toBeTruthy();

    // The field says what it wants, and takes the caret: the reader has just
    // been asked something and this is where the answer goes.
    await waitFor(() => expect(field()).toHaveProperty('placeholder', CLARIFICATION_PLACEHOLDER));
    expect(document.activeElement).toBe(field());

    // «Kan du utdype?» is not an answer to anything the agent asked.
    expect(screen.queryByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeNull();

    // Nothing a finished answer carries.
    expect(screen.queryByRole('button', { name: 'Kopier lenke til tråden' })).toBeNull();
    expect(screen.queryByText('Fremgangsmåte')).toBeNull();
  });

  it('sends the reader’s answer as the next message in the same thread', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        for (const event of asked.length === 1 ? clarification : answer) yield event;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');
    await screen.findByText(CLARIFICATION_TAG);

    ask('Årsrapporten.');

    // An ordinary next turn: same thread, no special path.
    await waitFor(() => expect(asked).toEqual(['Hva er måloppnåelse?', 'Årsrapporten.']));
    await waitFor(() => expect(field()).toHaveProperty('placeholder', COMPOSE_PLACEHOLDER));
  });
});
