import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { threadFromQuestion, type StreamEvent } from '../../model';
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

const clarification: StreamEvent[] = [
  { type: 'token', text: 'Mener du årsrapporten eller tildelingsbrevet?' },
  { type: 'done', messageId: 'm1', conversationId: 'c1', outcome: 'needs-clarification' },
];

const answer: StreamEvent[] = [
  { type: 'token', text: 'Svaret på spørsmålet.' },
  { type: 'done', messageId: 'm1', conversationId: 'c1' },
];

describe('ChatView', () => {
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
