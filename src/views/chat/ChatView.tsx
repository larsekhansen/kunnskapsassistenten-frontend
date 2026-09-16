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
import { chatErrorText } from './errorText';
import { filterSummaryText } from './filterSummary';
import { CLARIFICATION_PLACEHOLDER } from './text';
import { threadHeading } from './threadHeading';
import { useAtBottom } from './useAtBottom';
import { useComposerShortcut } from './useComposerShortcut';
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

/**
 * What the shell has been told about one answer, as one comparable string.
 *
 * The status and how many documents; nothing else changes what the sources
 * panel draws, and everything else changes on every token.
 *
 * An answer whose sources have not arrived counts as zero and not as a state
 * of its own, because zero is what the shell stores for it — `AnswerSources`
 * carries an array and never `undefined`. Saying «venter» on this side of the
 * comparison and reading `[]` on the other made the two never agree, so the
 * view reported on every render, which re-rendered the shell, which ran the
 * view again. The suite hung rather than failed.
 */
function sourcesSignature(documents: number, status: string): string {
  return `${status}:${documents}`;
}

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

  const {
    messages,
    status,
    error,
    announcement,
    appliedFilters,
    noHitsAnswers,
    send,
    cancel,
    retry,
  } = useChat(chatClient, thread?.messages ?? [], selection);

  // What the alert says, per case. Undefined while the turn is fine, which is
  // what keeps the region mounted and empty.
  const errorText = error ? chatErrorText(error) : undefined;

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
  // «Prøv igjen», so focus can be put on it when the error takes the control
  // the reader was holding.
  const retryRef = useRef<HTMLButtonElement>(null);
  // The send button, which is the stop button mid-answer. The one control
  // that changes meaning under the reader when a turn fails.
  const sendRef = useRef<HTMLButtonElement>(null);

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
  // other.
  //
  // One entry per answer, under the answer's own message id. A thread has
  // several answers and each numbers its excerpts from 1, so a single flat
  // list made `[2]` in the first answer open the second answer's excerpt two
  // — it looked right and was not (#4, brukerreiser punkt 5). The status
  // travels with it, because an empty `documents` means four different
  // things and only the answer knows which.
  const {
    answers: reported,
    setAnswerSources,
    clearAnswerSources,
    setDocuments,
  } = useAnswerSources();

  /*
   * What the shell is holding, against what this thread has to report.
   *
   * Compared against the shell's own state and not against a memo of what was
   * sent, which is the fix for brukerblikk runde 2, funn 1: a reloaded
   * conversation came back with its answer, its markers and its sources in
   * `sessionStorage`, and both side panels still said «Kildene vises her når
   * du har stilt et spørsmål». A `useRef` of what had already been sent
   * cannot know that something emptied the shell afterwards — and several
   * things may, since leaving a thread, a route with no conversation and this
   * view's own unmount all clear it. Whatever the order was on the day, the
   * view had said its piece once and would not say it again.
   *
   * Reading the shell instead makes that impossible to get wrong: whatever
   * empties it, the next render sees the gap and fills it. Reporting changes
   * `answers`, which runs this again, and the second pass finds nothing to do
   * — so it settles rather than loops.
   *
   * `messages` changes on every token, and almost none of those changes say
   * anything about sources. The signature is the two things that do — the
   * answer's status, and whether its documents have arrived — so the shell is
   * told once per real change instead of once per word.
   */
  useEffect(() => {
    const answers = messages.filter((message) => message.role === 'assistant');
    const live = new Set(answers.map((message) => message.id));

    /*
     * An answer that never produced a token is taken out of the thread again
     * (see `settleAnswer` in useChat), and the context can only be emptied
     * whole. So a disappearance costs a rebuild rather than a removal. It
     * happens when a reader stops a turn before the first word, and the
     * alternative is a sources panel waiting forever for an answer that is no
     * longer on screen.
     */
    if ((reported ?? []).some((answer) => !live.has(answer.messageId))) {
      clearAnswerSources();
      return;
    }

    /*
     * A thread with no answers at all, which `answers` cannot say on its own:
     * `clearAnswerSources()` sets it to undefined, and undefined means
     * «nobody has reported yet», which is what draws «Henter kilder …». An
     * untouched front page is not loading anything. So the empty state still
     * goes through the flat slot, and hands over the moment there is a real
     * answer to report.
     */
    if (answers.length === 0) {
      setDocuments([]);
      return;
    }

    for (const message of answers) {
      const held = (reported ?? []).find((answer) => answer.messageId === message.id);
      const signature = sourcesSignature(message.sources?.length ?? 0, message.status);
      if (held && sourcesSignature(held.documents.length, held.status) === signature) continue;

      setAnswerSources({
        messageId: message.id,
        documents: message.sources ?? [],
        status: message.status,
        /*
         * How many `[n]` the answer's own text carries, which is not the same
         * as how many excerpts came with it. A conversation restored from the
         * live backend has the markers and no chunks behind them, and without
         * this the panel says «Svaret viser ikke til noen utdrag» beside an
         * answer showing four. Only a stored turn sets it; a streamed one
         * resolves its markers as they arrive and leaves this undefined.
         */
        ...(message.citationCount === undefined ? {} : { citationCount: message.citationCount }),
      });
    }
  }, [messages, reported, setAnswerSources, clearAnswerSources, setDocuments]);

  /*
   * Leaving the thread takes its sources with it. This view is keyed on the
   * thread, so unmount is exactly that moment — and an empty dependency list
   * is what makes «unmount» mean unmount.
   *
   * Through a ref, because the alternative is a trap. With
   * `[clearAnswerSources]` the effect re-runs whenever that function changes
   * identity, and re-running an effect means running its cleanup first: the
   * sources would be wiped on an ordinary re-render rather than on the way
   * out. The shell memoises the callback today, so nothing has gone wrong
   * yet; measured here 2026-09-15 against a provider that does not, and it
   * was an endless clear-and-report between the two effects.
   */
  const clearOnUnmount = useRef(clearAnswerSources);
  useEffect(() => {
    clearOnUnmount.current = clearAnswerSources;
  }, [clearAnswerSources]);
  useEffect(() => () => clearOnUnmount.current(), []);

  const hasAnswer = messages.some(
    (message) => message.role === 'assistant' && message.status === 'complete',
  );

  /**
   * The turn on screen searched and found nothing.
   *
   * The fixed suggestions do not apply under one: «Kan du utdype?» asks the
   * assistant to say more about nothing, and «Identifiser utfordringer» is a
   * question about documents that were never found. The advice the answer
   * already carries — loosen the filter, ask in other words — is the way on
   * from here, and three buttons that lead back to the same nothing are in
   * its way (the conductor, 2026-09-15).
   *
   * Read off the last message and not off the thread: an earlier answer that
   * did find something is still worth following up, right up until this one
   * replaced it as the turn the suggestions would act on.
   */
  const lastMessage = messages.at(-1);
  const foundNothing = lastMessage !== undefined && noHitsAnswers.has(lastMessage.id);

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

  // `/` from anywhere on the page, the way GitHub and Slack do it. See
  // useComposerShortcut.ts for what it refuses to do.
  useComposerShortcut(fieldRef);

  /*
   * The same rescue, for the error that arrives on its own.
   *
   * The send button becomes the stop button while an answer is on its way,
   * and when the turn fails it becomes the send button again — disabled,
   * because the field is empty. A reader who clicked it is still standing on
   * it at this moment and lands on `<body>` one frame later, when the browser
   * takes focus off a control that has just been switched off. Traced in the
   * built app, 2026-09-15: «Avbryt genereringen» at 210 ms, «Send spørsmålet»
   * with the alert already up at 5091 ms, `<body>` at 5107 ms.
   *
   * So «is focus lost» cannot be asked of `document.activeElement` alone —
   * asked here it is still the button, and one frame later it is too late.
   * That one button counts as lost too, and it is compared by identity: the
   * reasoning is about the control that changed meaning under the reader, so
   * «a button in the composer» was too wide a net. It caught the paperclip,
   * which changes nothing when a turn fails and has every right to keep the
   * focus a reader put on it (KA CC on #59).
   *
   * Where focus goes is «Prøv igjen», which is the one thing to do next, and
   * the compose field when the error offers no retry — a rejected key does
   * not, and the reader's way on is to write to someone (#4, funn B).
   *
   * The compose field itself is left alone. Enter leaves the caret there, and
   * a reader who is typing must not have it taken away.
   */
  useEffect(() => {
    if (status !== 'error') return;

    const active = document.activeElement;
    const onSendButton = active !== null && active === sendRef.current;
    if (active !== document.body && active !== null && !onSendButton) return;

    (retryRef.current ?? fieldRef.current)?.focus();
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
          foundNothing={(messageId) => noHitsAnswers.has(messageId)}
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

        Heading, text and whether there is a button at all come from the code
        (errorText.ts). A rejected key gets no «Prøv igjen»: the same question
        with the same key fails the same way, and a button that cannot work
        sends the reader round the loop instead of towards whoever can fix it.
      */}
      <ErrorState
        message={errorText?.message}
        retryRef={retryRef}
        onRetry={
          errorText?.retryable
            ? () => {
                retry();
                focusField();
              }
            : undefined
        }
        title={errorText?.title}
      />

      <Composer
        fieldRef={fieldRef}
        sendRef={sendRef}
        onCancel={() => {
          cancel();
          focusField();
        }}
        onChange={setDraft}
        onFollowUp={submit}
        onSubmit={() => submit(draft)}
        placeholder={awaitingClarification ? CLARIFICATION_PLACEHOLDER : undefined}
        ref={composerRef}
        showFollowUps={hasAnswer && !awaitingClarification && !foundNothing}
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
 * **It does not key itself.** It used to: `key={props.thread?.id ?? 'new'}`,
 * so that moving between threads started from that thread's messages instead
 * of carrying the previous conversation across. The trouble is that `thread`
 * is undefined until the client has answered, so on `/threads/:id` the key
 * went `'new'` → the id a moment after mount, and the session remounted with
 * everything the compose field was holding. Type while the thread is loading
 * and the text was gone. In CI, which is slower, the remount landed in the
 * middle of a test's keystrokes and `chat.spec` went red on main.
 *
 * The remount it was for already happens above: `ChatSlotView` renders
 * `<ChatSlot key={threadId}>` off the route, so a real thread change replaces
 * this whole subtree, and the preview passes a key of its own. Keying here as
 * well only added the one transition the route never makes — from «no thread»
 * to «this thread» — which is not a change of conversation at all. It is the
 * same conversation arriving.
 *
 * Which is also why the route is not read here instead: a view takes a
 * `ThreadDetail` and never a route (see slotViews/ChatSlotView.tsx), and the
 * caller that knows the address is already doing the job.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession {...props} />;
}
