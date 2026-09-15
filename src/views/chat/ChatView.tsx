import { Heading } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatClient, type ChatClient } from '../../api';
import { ErrorState } from '../../components';
import { useAnswerSources } from '../../layout/useAnswerSources';
import { useCitation } from '../../layout/useCitation';
import { useFilterSelection } from '../../layout/useFilterSelection';
import { useMainScroll } from '../../layout/useMainScroll';
import { useThread } from '../../layout/useThread';
import { isEmptySelection, type ThreadDetail } from '../../model';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { filterSummaryText } from './filterSummary';
import { CLARIFICATION_PLACEHOLDER } from './text';
import { threadHeading } from './threadHeading';
import { useAtBottom } from './useAtBottom';
import { useChat } from './useChat';
import { Welcome } from './Welcome';
import './chat.css';

export type ChatViewProps = {
  /** The signed-in user's first name, for the greeting before the first question. */
  userName?: string;
  /** The thread to show. Absent means a new conversation. */
  thread?: ThreadDetail;
  /** Which backend to talk to. Defaults to whatever `createChatClient` picks. */
  client?: ChatClient;
};

let fallbackClient: ChatClient | undefined;
function defaultClient(): ChatClient {
  fallbackClient ??= createChatClient();
  return fallbackClient;
}

function ChatSession({ userName, thread, client }: ChatViewProps) {
  const chatClient = useMemo(() => client ?? defaultClient(), [client]);

  // The document filter is part of the question. The filter view writes it,
  // the shell holds it, and this view sends it — the two views never meet.
  const { selection } = useFilterSelection();

  const { messages, status, error, announcement, appliedFilters, send, cancel, retry } = useChat(
    chatClient,
    thread?.messages ?? [],
    selection,
  );

  const filterSummary = useCallback(
    (messageId: string) => {
      const applied = appliedFilters[messageId];
      return applied && !isEmptySelection(applied) ? filterSummaryText(applied) : undefined;
    },
    [appliedFilters],
  );

  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // The main slot owns the scroll, and the shell hands it over. A view must
  // not go looking for it: the day chat is moved to another slot, a search up
  // the DOM finds the wrong element or nothing.
  const { ref: scrollRef, scrollToBottom } = useMainScroll();
  const atBottom = useAtBottom(scrollRef, rootRef);

  /*
   * The compose field is sticky and opaque, so anything the browser scrolls
   * to can land underneath it — a citation link or an action button reached
   * by Tab ends up behind the field, which is WCAG 2.4.11. `scroll-padding`
   * tells the scroll container to stop that much short of the bottom.
   *
   * Measured rather than written down: the field grows with the question
   * (`field-sizing: content`) and the follow-up chips come and go, so the
   * height is not a number this view knows. The property is set on the
   * container the shell owns, and cleared again when the chat leaves it.
   */
  useEffect(() => {
    const area = composerRef.current;
    const scroller = scrollRef.current;
    // jsdom has no ResizeObserver; the padding is a scroll affordance, so a
    // test environment without one loses nothing.
    if (!area || !scroller || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      scroller.style.scrollPaddingBlockEnd = `${Math.round(area.offsetHeight)}px`;
    });
    observer.observe(area);

    return () => {
      observer.disconnect();
      scroller.style.scrollPaddingBlockEnd = '';
    };
  }, [scrollRef]);

  // Activating a `[n]` marker is the shell's business: it opens the sources
  // panel and tells it which excerpt to show. Neither view knows the other.
  const { showCitation } = useCitation();

  // The shell gives the conversation an address the first time a question is
  // asked here, so «Kopier lenke til tråden» has something to copy (C16).
  // Once per question and a no-op after the first; the thread it returns is
  // the shell's business, not this view's.
  const { startThread } = useThread();

  // The sources go the same way, and for the same reason: the sources view
  // draws them, this view produces them, and the two may not import each
  // other. The last answer that carries sources is the one on screen; they
  // arrive at the end of a stream, so earlier messages keep theirs.
  //
  // `undefined` and `[]` are different answers over there: undefined draws
  // «loading», an empty array draws «no sources yet». So undefined is only
  // honest while an answer is actually on its way. An untouched front page
  // has nothing to load, and a turn that ended without sources has finished
  // not loading; both are empty, not pending.
  const { setDocuments } = useAnswerSources();
  const answerSources = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === 'assistant' && message.sources) return message.sources;
    }
    return status === 'pending' || status === 'streaming' ? undefined : [];
  }, [messages, status]);

  useEffect(() => setDocuments(answerSources), [answerSources, setDocuments]);

  const hasAnswer = messages.some(
    (message) => message.role === 'assistant' && message.status === 'complete',
  );

  /**
   * The same head on both routes (brukerblikk 2026-09-15, finding 5). A
   * thread opened from the list brings its title; a conversation started on
   * `/` has none until the client names it, and then the question stands in.
   * See threadHeading.ts for why a stand-in is heard and not seen.
   */
  const heading = threadHeading(thread, messages);

  /**
   * The agent asked back and is waiting: the last turn ended as
   * `needs-clarification` and nothing has been sent since.
   *
   * The reader's next message is the answer to that question — an ordinary
   * next turn in the same thread, sent the ordinary way. What changes is the
   * field: it says what it wants, and the fixed follow-up suggestions step
   * aside, because «Kan du utdype?» is not an answer to anything the agent
   * asked.
   */
  const awaitingClarification =
    messages.at(-1)?.role === 'assistant' && messages.at(-1)?.status === 'needs-clarification';

  /*
   * Focus follows the question, once per clarification.
   *
   * The reader has just been asked something, and the one place to answer it
   * is the field. Focus is only taken from the composer itself or from
   * nobody: the click or the Enter that sent the question left it there, and
   * a reader who has moved on — into the answer above, into the sources —
   * must not have the page pulled back under them.
   */
  const clarificationId = awaitingClarification ? messages.at(-1)?.id : undefined;
  useEffect(() => {
    if (!clarificationId) return;

    const active = document.activeElement;
    const inComposer = active instanceof Node && composerRef.current?.contains(active);
    if (active === document.body || active === null || inComposer) fieldRef.current?.focus();
  }, [clarificationId]);

  function submit(question: string) {
    const query = question.trim();
    if (query.length === 0) return;

    startThread(query);
    send(query);
    setDraft('');
  }

  /**
   * Where focus goes when a control disappears because of the click that hit
   * it. Both the stop button and «Prøv igjen» are gone by the time their own
   * handler has run, and a control that vanishes without saying where focus
   * should land drops a keyboard user on `<body>`, at the top of the
   * document, mid-action (WCAG 2.4.3). The compose field is where the reader
   * is going anyway: to rewrite the question after stopping, or to keep
   * typing while the retry runs.
   */
  function focusField() {
    fieldRef.current?.focus();
  }

  /*
   * The same rescue, for the error that arrives on its own.
   *
   * The send button becomes the stop button while an answer is on its way,
   * and the stop button is gone the moment the turn fails. A reader who
   * clicked it is then standing on `<body>` — Enter keeps the caret in the
   * field, a mouse click does not, and the difference was measured (reise 10
   * and 15). Focus is only taken when nobody holds it, so a reader who has
   * moved on keeps their place.
   */
  useEffect(() => {
    if (status !== 'error') return;
    if (document.activeElement === document.body || document.activeElement === null) {
      fieldRef.current?.focus();
    }
  }, [status]);

  return (
    <div className="ka-chat" ref={rootRef}>
      {heading ? (
        <Heading
          className={heading.repeatsQuestion ? 'ds-sr-only' : undefined}
          data-size="lg"
          level={2}
        >
          {heading.title}
        </Heading>
      ) : null}

      {messages.length === 0 ? (
        <Welcome
          onPickKickstarter={(question) => {
            // Fills the field, does not send (answer 40). The caret goes with
            // it, so the reader can edit before asking.
            setDraft(question);
            focusField();
          }}
          userName={userName}
        />
      ) : (
        <MessageList
          canScrollToBottom={!atBottom}
          filterSummary={filterSummary}
          messages={messages}
          onRegenerate={() => {
            retry();
            focusField();
          }}
          onScrollToBottom={() => scrollToBottom()}
          onSelectSource={showCitation}
        />
      )}

      {/*
        Mounted whether or not there is an error: an alert region only
        announces content that appears inside a region already in the page.
        See src/components/ErrorState.tsx.
      */}
      <ErrorState
        message={error ?? undefined}
        onRetry={() => {
          retry();
          focusField();
        }}
        title="Svaret kom ikke fram"
      />

      <Composer
        fieldRef={fieldRef}
        onCancel={() => {
          cancel();
          focusField();
        }}
        onChange={setDraft}
        onFollowUp={submit}
        onSubmit={() => submit(draft)}
        placeholder={awaitingClarification ? CLARIFICATION_PLACEHOLDER : undefined}
        ref={composerRef}
        showFollowUps={hasAnswer && !awaitingClarification}
        status={status}
        value={draft}
      />

      {/*
        How the answer is coming along, for a screen reader. Polite, never
        assertive: an answer being written is not an interruption. It carries
        whole paragraphs rather than tokens, because a region updated per
        token stutters, and the finished answer is in the page anyway.
      */}
      <p aria-live="polite" className="ds-sr-only">
        {announcement}
      </p>
    </div>
  );
}

/**
 * The chat: the greeting, the conversation and the compose field.
 *
 * Mounted in the `main` slot by the shell. It is a view, so it is named after
 * its content and could sit in another slot the day the layout lets a reader
 * move it. It expects the route around it to carry the page's level 1
 * heading, as Figma draws it: «Kunnskapsassistenten» on top, the thread title
 * under it.
 *
 * The session is keyed on the thread, so moving between threads starts from
 * that thread's messages instead of carrying the previous conversation across.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession key={props.thread?.id ?? 'new'} {...props} />;
}
