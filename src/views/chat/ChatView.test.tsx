import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import {
  emptyFilterSelection,
  type AnswerSources,
  threadFromQuestion,
  type FilterSelection,
  type StreamEvent,
  type ThreadDetail,
} from '../../model';
import { ChatView } from './ChatView';
import {
  CLARIFICATION_PLACEHOLDER,
  CLARIFICATION_TAG,
  COMPOSE_PLACEHOLDER,
  FOLLOW_UP_QUESTIONS,
  NO_HITS_WHOLE_CORPUS,
  SHORTCUT_DESCRIPTION,
  shortcutHint,
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

type ShellProps = {
  children: ReactNode;
  startThread?: () => void;
  /** What the filter view has narrowed to, as the shell would hold it. */
  selection?: FilterSelection;
  /** Records what the view reports about each answer's sources. */
  onAnswerSources?: (answer: AnswerSources) => void;
  /** Records `[n]` activations, with the answer they came from. */
  onCitation?: (number: number, messageId?: string) => void;
};

/** The pieces of the shell the chat view reads. */
function Shell({ children, startThread, selection, onAnswerSources, onCitation }: ShellProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MainScrollContext value={scrollRef}>
      <CitationContext
        value={{ activeCitation: undefined, showCitation: onCitation ?? (() => {}) }}
      >
        <AnswerSourcesContext
          value={{ ...inertAnswerSources, setAnswerSources: onAnswerSources ?? (() => {}) }}
        >
          <ThreadContext
            value={{
              startThread: (question) => {
                startThread?.();
                return threadFromQuestion(question);
              },
            }}
          >
            <FilterContext
              value={{ selection: selection ?? emptyFilterSelection, setSelection: () => {} }}
            >
              {children}
            </FilterContext>
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

function threadWith(title: string, titleFromQuestion?: boolean): ThreadDetail {
  return {
    id: 't1',
    title,
    titleFromQuestion,
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
/** An answer with a source behind its one marker, for the clipboard. */
const sourcedAnswer: StreamEvent[] = [
  { type: 'token', text: 'Nkom melder kvartalsvis [1].' },
  {
    type: 'sources',
    documents: [
      {
        id: 'd1',
        title: 'Årsrapport Nkom 2022',
        organisation: 'Nkom',
        year: 2022,
        excerpts: [{ id: 'e1', text: '', relevance: 'high', citationNumber: 1, page: 41 }],
      },
    ],
    citations: [{ number: 1, excerptId: 'e1', documentId: 'd1' }],
    retrieval: { hitCount: 1, documentCount: 1, keywords: [] },
  },
  done,
];

const clarification: StreamEvent[] = [
  {
    type: 'thinking-step',
    step: { id: 's1', kind: 'search', label: 'Jeg leter etter årsrapporter.', durationMs: 2000 },
  },
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

  it('hides a title the client made out of the question', () => {
    // `threadFromQuestion` stores the whole question and says so with
    // `titleFromQuestion`. The flag decides, not a comparison of the strings:
    // the stored title is the whole question and the stand-in is its first
    // sentence, so the two do not match for a question of several sentences.
    render(
      <Shell>
        <ChatView
          client={clientYielding([done])}
          thread={threadWith('Hva sier rapporten? Og hva med 2023?', true)}
        />
      </Shell>,
    );

    const head = screen.getByRole('heading', { level: 2 });
    expect(head.className).toContain('ds-sr-only');
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

  it('names the case in the heading and tells two failures apart', async () => {
    const { unmount } = render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'model-unavailable' } }])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const first = await screen.findByRole('alert');
    await waitFor(() => expect(first.textContent).toContain('Assistenten svarte ikke'));
    unmount();

    render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'retrieval-unavailable' } }])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const second = await screen.findByRole('alert');
    // «Noe gikk galt» said the same thing for both, and the two need
    // different things from the reader (brukerreiser punkt 12).
    await waitFor(() => expect(second.textContent).toContain('Søket i dokumentene svarte ikke'));
  });

  it('offers no «Prøv igjen» when the key was rejected', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'unauthorized' } }])} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('Ingen tilgang'));
    // The same question with the same key fails the same way; a button that
    // cannot work sends the reader round the loop instead of onwards.
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();
  });

  it('draws a search that found nothing as an answer, not as an alert', async () => {
    const reported: AnswerSources[] = [];
    render(
      <Shell onAnswerSources={(answerSources) => reported.push(answerSources)}>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'no-hits' } }])} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');

    // In the thread, as a turn of its own. The live region says the same
    // thing, so the answer is looked for where answers are.
    await waitFor(() =>
      expect(document.querySelector('.ka-messages')?.textContent).toContain(
        NO_HITS_WHOLE_CORPUS.split('\n')[0],
      ),
    );
    // No red box and no retry: the search ran, and running it again against
    // the same documents finds the same nothing.
    expect(screen.getByRole('alert').textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();

    // The sources panel is told it is a finished answer with nothing behind
    // it, which is what stops it waiting on «Henter kilder …».
    const last = reported.at(-1);
    expect(last?.status).toBe('complete');
    expect(last?.documents).toEqual([]);
  });

  it('offers no follow-up suggestions under an answer that found nothing', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'no-hits' } }])} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');

    await waitFor(() =>
      expect(document.querySelector('.ka-messages')?.textContent).toContain(
        NO_HITS_WHOLE_CORPUS.split('\n')[0],
      ),
    );

    // «Kan du utdype?» asks the assistant to say more about nothing, and the
    // other two lead back to the same empty search.
    for (const question of FOLLOW_UP_QUESTIONS) {
      expect(screen.queryByRole('button', { name: question }), question).toBeNull();
    }
  });

  it('brings the suggestions back for the next answer that did find something', async () => {
    let turn = 0;
    const client: ChatClient = {
      async *ask(): AsyncIterable<StreamEvent> {
        turn += 1;
        if (turn === 1) {
          yield { type: 'error', error: { code: 'no-hits' } };
          return;
        }
        for (const event of answer) yield event;
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

    ask('Hva sier dokumentene om romfart?');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeNull(),
    );

    // The empty search was one turn, not a property of the thread.
    ask('Hva sier rapporten?');
    expect(await screen.findByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeTruthy();
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

  it('sends the document filter with the question, and says so over the answer', async () => {
    const asked: (FilterSelection | undefined)[] = [];
    const client: ChatClient = {
      async *ask({ filters }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(filters);
        for (const event of answer) yield event;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const selection: FilterSelection = {
      ...emptyFilterSelection,
      documentType: ['Årsrapport'],
      year: ['2023'],
    };

    render(
      <Shell selection={selection}>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    // The filter is part of the question, not a view decoration (reise 8).
    await waitFor(() => expect(asked).toEqual([selection]));

    // And the answer says what it was asked against.
    expect(await screen.findByText(/Avgrenset til: Årsrapport · 2023/u)).toBeTruthy();
  });

  it('says nothing about the filter when nothing was narrowed', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    expect(screen.queryByText(/Avgrenset til/u)).toBeNull();
  });

  it('copies the answer with its sources, and counts them in the receipt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(
      <Shell>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Kopier svaret' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0]![0] as string;
    // The marker survives, because there is now something for it to point at.
    expect(copied).toContain('kvartalsvis [1].');
    expect(copied).toContain('[1] Nkom (2022). Årsrapport Nkom 2022, s. 41.');
    expect(await screen.findByText('Svaret og 1 kilde er kopiert.')).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('offers to run a stopped answer again, and says why it has no sources', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        yield { type: 'token', text: 'Halve svaret' };
        if (asked.length === 1) {
          await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()));
          yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
          return;
        }
        yield done;
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

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt genereringen' }));

    // The text that arrived stays, and the card says why nothing is behind it.
    const again = await screen.findByRole('button', { name: /Generer på nytt/u });
    expect(screen.getByText(/Halve svaret/u)).toBeTruthy();
    expect(screen.getByText(/kildene bak det kom aldri fram/u)).toBeTruthy();
    // Nothing to copy from half an answer.
    expect(screen.queryByRole('button', { name: 'Kopier svaret' })).toBeNull();

    fireEvent.click(again);
    await waitFor(() => expect(asked).toEqual(['Hva sier rapporten?', 'Hva sier rapporten?']));
  });

  it('takes focus back to the field when a failure arrives after a mouse click', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([
            { type: 'error', error: { code: 'unknown', message: 'Noe gikk galt.' } },
          ])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    // The click landed on the send button, which became the stop button and
    // then vanished with the failure. A real browser leaves focus on body;
    // so does this.
    (document.activeElement as HTMLElement | null)?.blur();

    await screen.findByRole('alert');
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it('keeps «Tenkte i N sekunder» over a clarification', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(clarification)} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');
    await screen.findByText(CLARIFICATION_TAG);

    // The agent searched before it asked back, and that is the same fact here
    // as over an answer.
    expect(screen.getByText('Tenkte i 2 sekunder')).toBeTruthy();
  });

  it('puts the caret in the field on Ctrl+/ from anywhere on the page', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    // shiftKey is true because on a Norwegian keyboard «/» IS Shift+7. A
    // handler that rejected shift could never fire on the layout this app is
    // written for.
    fireEvent.keyDown(elsewhere, { key: '/', ctrlKey: true, shiftKey: true });

    expect(document.activeElement).toBe(field());
  });

  it('answers to Cmd+/ as well, for a Mac', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    fireEvent.keyDown(elsewhere, { key: '/', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(field());
  });

  it('does nothing on a bare «/»', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    // A shortcut on a single character key is WCAG 2.1.4, level A, and this
    // one could not be switched off. The modifier is what takes it out of
    // scope — so the bare key has to stay inert.
    const notSwallowed = fireEvent.keyDown(elsewhere, { key: '/', cancelable: true });

    expect(document.activeElement).toBe(elsewhere);
    expect(notSwallowed).toBe(true);
  });

  it('leaves Ctrl+Alt+/ alone, because that is AltGr on Windows', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    fireEvent.keyDown(elsewhere, { key: '/', ctrlKey: true, altKey: true, shiftKey: true });

    expect(document.activeElement).toBe(elsewhere);
  });

  it('reaches the handler from inside a shadow root', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    // The three filter dropdowns are Designsystemet `Suggestion`, whose input
    // lives in a shadow root. With a modifier the shortcut is welcome there
    // too — nobody holds Ctrl to write a slash — but the event has to cross
    // the boundary at all, which is what this guards.
    const host = document.createElement('div');
    document.body.append(host);
    const inner = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(inner);
    inner.focus();

    inner.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );

    expect(document.activeElement).toBe(field());
    host.remove();
  });

  it('says how to reach the field, on screen and to a screen reader', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    expect(screen.getByText(shortcutHint())).toBeTruthy();

    // The field itself carries the spelled-out version: «/» read aloud is
    // «skråstrek» in some voices and silence in others.
    const described = field().getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toBe(SHORTCUT_DESCRIPTION);
  });

  it('reports every answer under its own message id', async () => {
    const reported: AnswerSources[] = [];
    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    // One id all the way through, and the status travels with the sources:
    // an empty `documents` means four different things, and only the answer
    // knows which (#4, brukerreiser punkt 5).
    const ids = new Set(reported.map((answer) => answer.messageId));
    expect(ids.size).toBe(1);
    expect(reported.at(0)).toMatchObject({ documents: [], status: 'streaming' });
    expect(reported.at(-1)?.status).toBe('complete');
    expect(reported.at(-1)?.documents).toHaveLength(1);
  });

  it('reports once per real change, not once per token', async () => {
    const reported: AnswerSources[] = [];
    const manyTokens: StreamEvent[] = [
      ...'ett to tre fire fem seks'
        .split(' ')
        .map((word): StreamEvent => ({ type: 'token', text: `${word} ` })),
      done,
    ];

    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding(manyTokens)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    // Six tokens, two states: writing, then finished. The shell is told
    // about the second, not about the words.
    expect(reported.map((answer) => answer.status)).toEqual(['streaming', 'complete']);
  });

  it('tells the shell which answer a marker sits in', async () => {
    const activated: [number, string | undefined][] = [];
    render(
      <Shell onCitation={(number, messageId) => activated.push([number, messageId])}>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const marker = await screen.findByRole('link', { name: /^Kilde 1:/u });
    fireEvent.click(marker);

    expect(activated).toHaveLength(1);
    const [number, messageId] = activated[0]!;
    expect(number).toBe(1);
    // Each answer numbers its excerpts from 1, so the number alone does not
    // say which excerpt.
    expect(messageId).toBeTruthy();
  });

  it('draws a stopped answer’s markers as text that says why', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        yield { type: 'token', text: 'Halve svaret med [1] i seg' };
        await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()));
        yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
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

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt genereringen' }));
    await screen.findByRole('button', { name: /Generer på nytt/u });

    // The marker was written; the excerpt was still on its way. A link to
    // nothing would be worse than no link.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTitle('Kilden kom ikke fram')).toBeTruthy();
  });
});
