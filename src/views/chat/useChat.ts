import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatClient } from '../../api';
import {
  emptyFilterSelection,
  isEmptySelection,
  type ChatError,
  type FilterSelection,
  type Message,
  type MessageStatus,
} from '../../model';
import { announcedText } from './answerText';
import {
  CLARIFICATION_ANNOUNCEMENT,
  NO_HITS_ANNOUNCEMENT,
  NO_HITS_FILTERED,
  NO_HITS_WHOLE_CORPUS,
} from './text';

/** Where the current turn is. Drives the skeleton, the stop button and the error. */
export type ChatStatus = 'idle' | 'pending' | 'streaming' | 'error';

/** What an answer can be once the turn is over. */
type SettledStatus = Extract<
  MessageStatus,
  'complete' | 'needs-clarification' | 'aborted' | 'error'
>;

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export type UseChat = {
  messages: Message[];
  status: ChatStatus;
  /**
   * Why the turn failed, set only when status is 'error'.
   *
   * The code and not the sentence: which case it was decides the heading, the
   * text and whether «Prøv igjen» is offered at all, and that mapping belongs
   * to the view (errorText.ts). A hook that handed over a finished string
   * would have to know what the button under it says.
   */
  error: ChatError | null;
  /**
   * What the polite live region should say at this moment (answer 33).
   *
   * It lives here rather than in the view because only this loop knows when a
   * paragraph finished and when the turn ended. A live region driven by
   * rendering instead of by events either stutters once per token or has to
   * read a ref during render to remember what it already said.
   */
  announcement: string;
  /**
   * The filter each answer was asked under, by message id.
   *
   * Kept beside the messages rather than on them: the answer says which
   * documents it was narrowed to, and «which documents» is what the reader
   * chose at the time, not what is selected now. A second question under a
   * different filter must not rewrite the first answer's line.
   */
  appliedFilters: Record<string, FilterSelection>;
  /**
   * The answers whose search came back empty, by message id.
   *
   * Kept beside the messages rather than derived from their text: a turn that
   * found nothing is a fact about the turn, and reading it back out of the
   * words would break the moment the wording changed. The view needs it
   * because the fixed follow-up suggestions do not apply under one — «Kan du
   * utdype?» asks the assistant to say more about nothing.
   */
  noHitsAnswers: ReadonlySet<string>;
  send: (question: string) => void;
  /** Stop the generation and keep what has arrived (answer 34). */
  cancel: () => void;
  /**
   * Ask the last question again, in place of the answer that did not make
   * it. «Prøv igjen» after a failure and «Generer på nytt» after a stop are
   * the same move: the question stands, the answer is replaced.
   */
  retry: () => void;
};

/**
 * The chat state machine: messages in, one streamed answer at a time.
 *
 * Streaming is built in rather than added later, because it changes how the
 * answer is rendered — which is why the build order says to do step 3 and
 * step 5 together (design/skal-dette-implementeres.md).
 *
 *   idle       nothing in flight
 *   pending    question sent, no token yet — this is what the skeleton shows
 *   streaming  tokens arriving
 *   error      the turn failed; `error` carries the code, and the view
 *              looks the Norwegian up from it
 *
 * Two of the codes never reach that last state. Cancelling is not an error:
 * the client reports it as an `error` event with
 * code `aborted`, and here that means: keep the partial answer, mark it
 * `aborted`, go back to idle. That is what a reader expects from a stop
 * button, and it is why the code checks the code rather than the event type.
 * The status is kept apart from `complete` because a stopped answer is not a
 * whole one — its sources never arrived, so it carries no action row of a
 * finished answer and offers to run again instead.
 *
 * `no-hits` is not one either: the search ran and found nothing, which is a
 * finished answer with an empty source list rather than a failure. It is the
 * same move in the other direction — an `error` frame settled as `complete`.
 *
 * Only one turn counts at a time. A question asked mid-stream aborts the one
 * before it, and the old turn is then forbidden from touching status,
 * announcement or error — see `turnRef` in `run`.
 */
export function useChat(
  client: ChatClient,
  initialMessages: Message[] = [],
  filters: FilterSelection = emptyFilterSelection,
): UseChat {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  /*
   * The thread can arrive after the view has mounted, and usually does:
   * `ChatSlotView` draws the chat straight away and fills `thread` in when
   * the client answers, so on `/threads/:id` this hook starts with no
   * messages and the conversation lands a moment later.
   *
   * It used to land by remounting — the view keyed itself on the thread id,
   * so `undefined → id` replaced the whole session. That is how the restored
   * conversation got in, and it is also why anything the reader had typed
   * while it loaded was thrown away with it, and why CI went red on main
   * (the remount fell in the middle of a test's keystrokes; two different
   * assertions, one cause). So the messages are adopted instead.
   *
   * A reader who has already asked something at this address keeps what they
   * asked. The stored conversation is laid in FRONT of it rather than instead
   * of it: both are real, and the order is the one they happened in — the
   * saved turns are older than the question asked while they loaded.
   *
   * It used to be dropped outright (`if (messages.length === 0)`), which is
   * the hole KA CC found in #66: ask something on `/threads/:id` before
   * `getThread` answers, and the conversation that was already there never
   * arrived. Only the turn in flight was protected, and protecting it did not
   * require throwing the rest away.
   *
   * By id, so nothing lands twice. The live turn and the stored one can be
   * the same turn — the mock writes a finished answer into the store under
   * the id it just streamed (`recordMockTurn`), so a thread that resolves
   * after the answer settled carries it back. What is already on screen wins;
   * only ids the conversation has not seen are prepended.
   *
   * Adjusted while rendering the change rather than in an effect, which is
   * React's own answer to «a prop changed and state has to follow»: an effect
   * would draw the empty conversation once first.
   *
   * Compared on what the messages ARE and not on the identity of the array
   * that carries them. `initialMessages` has a default of `[]`, which is a
   * fresh array on every call, so a reference check said «a new thread» every
   * render and looped. Length plus the last id is enough: a thread that has
   * grown or been replaced differs, and the same thread handed over twice
   * does not.
   */
  const threadSignature =
    initialMessages.length === 0 ? '' : `${initialMessages.length}:${initialMessages.at(-1)?.id}`;
  const [adopted, setAdopted] = useState(threadSignature);
  if (threadSignature !== '' && threadSignature !== adopted) {
    setAdopted(threadSignature);
    setMessages((current) => {
      if (current.length === 0) return initialMessages;
      const here = new Set(current.map((message) => message.id));
      const stored = initialMessages.filter((message) => !here.has(message.id));
      return stored.length === 0 ? current : [...stored, ...current];
    });
  }
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterSelection>>({});
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<ChatError | null>(null);
  const [noHitsAnswers, setNoHitsAnswers] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const turnRef = useRef(0);
  const conversationRef = useRef<string | undefined>(undefined);
  const lastQuestionRef = useRef<string | null>(null);

  // Abort a turn still in flight when the view goes away, so the stream does
  // not keep setting state on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const patchAnswer = useCallback((id: string, patch: (message: Message) => Message) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? patch(message) : message)),
    );
  }, []);

  /**
   * End a turn: mark the answer, or drop it if nothing ever arrived.
   *
   * An answer that failed or finished before its first token draws no card,
   * so leaving it in the list leaves an `<li>` whose whole content is the
   * hidden «Kunnskapsassistenten svarte:» — a screen reader hears an
   * assistant that answered nothing. The alert says what became of a failed
   * turn, and carries the way onward.
   *
   * A stopped one is the exception, and it is the whole of #4's funn A: the
   * reader pressed stop while «Tenker …» was still running, and the turn
   * vanished — no «Generer på nytt», and a sources panel back to «Kildene
   * vises her når du har stilt et spørsmål» for someone who had just asked
   * something. Stopping the same answer one second later, after the first
   * word, left both. So a stopped turn stays whatever phase it was in, and
   * the card says it was stopped and offers to run it again.
   */
  const settleAnswer = useCallback((id: string, status: SettledStatus, createdAt?: string) => {
    /*
     * The answer is stamped here and not when its placeholder was made,
     * because the time on an answer means «when the answer was finished»
     * — that is what a reader refers back to, and it is what the turn is
     * written down with.
     *
     * Stamping it at both ends is what made one answer carry two times:
     * the placeholder was made when the question was sent and the stored
     * copy when the turn was recorded, a whole answer apart. «14:32» on
     * screen, «14:32:15» after a reload (KA CC on #71). Nothing draws the
     * time until the turn settles, so moving it costs nothing on screen.
     *
     * The `done` frame's own time wins when there is one, so the message
     * and the stored turn are the same string and not merely the same
     * second. A stream that ends any other way — stopped, failed, or with
     * no `done` at all — has no time to be given, and the local clock is
     * that same instant give or take the trip home.
     */
    const settledAt = createdAt ?? new Date().toISOString();
    setMessages((current) => {
      const answer = current.find((message) => message.id === id);
      if (answer && answer.content.length === 0 && status !== 'aborted') {
        return current.filter((message) => message.id !== id);
      }
      return current.map((message) =>
        message.id === id ? { ...message, createdAt: settledAt, status } : message,
      );
    });
  }, []);

  const run = useCallback(
    async (question: string, answerId: string) => {
      // Every turn gets a number, and only the newest one may write status,
      // announcement or error. Asking a second question while the first is
      // still streaming aborts the first, but that abort is handled one tick
      // later — after the new turn has already said «Henter svar.». Without
      // this guard the old turn overwrites it with «Genereringen ble
      // avbrutt.», which is a status message that lies, and puts the status
      // back to idle, which takes the stop button away from a generation
      // that is still running.
      const turn = (turnRef.current += 1);
      const isCurrentTurn = () => turnRef.current === turn;

      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('pending');
      setError(null);
      setAnnouncement('Henter svar.');

      // The running text, so a finished paragraph can be spotted without
      // reading it back out of state.
      let content = '';

      /*
       * Which of the two «fant ingenting» answers fits this turn. Read here,
       * from the filter the question was asked under, and not when it lands:
       * telling a reader to loosen a filter they never set sends them looking
       * for a control they have not touched.
       */
      const noHitsAnswer = isEmptySelection(filters) ? NO_HITS_WHOLE_CORPUS : NO_HITS_FILTERED;

      // Said once per turn, when the first step lands. The steps arrive
      // seconds apart and there can be a dozen of them; a polite region that
      // spoke once per step would still be reading them out when the answer
      // arrived. The panel itself is silent, see ThinkingPanel.
      let saidSearching = false;

      /*
       * When the thinking started, so how long it took can be written down
       * rather than worked out afterwards (brukerblikk runde 2, funn 5). The
       * stream is where the two ends of that interval actually are: the first
       * step arriving, and the first word of the answer.
       */
      let thinkingStartedAt: number | undefined;

      try {
        for await (const event of client.ask({
          query: question,
          conversationId: conversationRef.current,
          // The document filter is part of the question, not a view
          // decoration. The backend ignores it today (API-bestilling A2) and
          // it is sent regardless: that is the contract, and the day it is
          // honoured nothing here has to change.
          filters,
          signal: controller.signal,
        })) {
          switch (event.type) {
            case 'token': {
              setStatus('streaming');
              const thoughtMs =
                thinkingStartedAt === undefined ? undefined : Date.now() - thinkingStartedAt;
              // Only the first token ends the thinking; the rest are the
              // answer being written.
              thinkingStartedAt = undefined;
              content += event.text;
              patchAnswer(answerId, (message) => ({
                ...message,
                content,
                ...(thoughtMs === undefined ? {} : { thoughtMs }),
              }));
              // Blocks are separated by a blank line, so only a token with a
              // newline in it can have finished one. Everything else would be
              // half a sentence.
              if (event.text.includes('\n')) {
                const finished = announcedText(content);
                if (finished) setAnnouncement(finished);
              }
              break;
            }

            case 'thinking-step':
              thinkingStartedAt ??= Date.now();
              patchAnswer(answerId, (message) => ({
                ...message,
                thinkingSteps: [...(message.thinkingSteps ?? []), event.step],
              }));
              if (!saidSearching && isCurrentTurn()) {
                saidSearching = true;
                setAnnouncement('Kunnskapsassistenten søker …');
              }
              break;

            case 'sources':
              patchAnswer(answerId, (message) => ({
                ...message,
                sources: event.documents,
                citations: event.citations,
                retrieval: event.retrieval,
              }));
              break;

            case 'done': {
              conversationRef.current = event.conversationId;
              // `outcome` absent means the turn completed, which is what every
              // answer was before the field existed. See model/stream.ts.
              const clarifying = event.outcome === 'needs-clarification';
              settleAnswer(
                answerId,
                clarifying ? 'needs-clarification' : 'complete',
                event.createdAt,
              );
              if (isCurrentTurn()) {
                setAnnouncement(clarifying ? CLARIFICATION_ANNOUNCEMENT : 'Svaret er ferdig.');
                setStatus('idle');
              }
              return;
            }

            case 'error':
              if (event.error.code === 'aborted') {
                settleAnswer(answerId, 'aborted', event.createdAt);
                if (isCurrentTurn()) {
                  setAnnouncement('Genereringen ble avbrutt.');
                  setStatus('idle');
                }
                return;
              }

              /*
               * A search that found nothing is not a failure: the assistant
               * did the work and came back empty-handed, which is an answer
               * with an empty source list (API-bestilling A16). So the turn
               * finishes rather than fails — no red alert, no «Prøv igjen»
               * offering to ask the same question of the same documents
               * again — and the empty `sources` is what makes the sources
               * panel say the same thing in its own words instead of waiting
               * for excerpts that are not coming.
               *
               * It arrives as an `error` event because that is the frame
               * that ends a stream with no content in it; see model/stream.ts.
               */
              if (event.error.code === 'no-hits') {
                patchAnswer(answerId, (message) => ({
                  ...message,
                  // Whatever the agent managed to write stands; the notice
                  // only stands in when it wrote nothing, which is the case
                  // this exists for.
                  content: message.content.length > 0 ? message.content : noHitsAnswer,
                  sources: [],
                  citations: [],
                }));
                settleAnswer(answerId, 'complete', event.createdAt);
                setNoHitsAnswers((current) => new Set(current).add(answerId));
                if (isCurrentTurn()) {
                  setAnnouncement(NO_HITS_ANNOUNCEMENT);
                  setStatus('idle');
                }
                return;
              }

              settleAnswer(answerId, 'error', event.createdAt);
              if (isCurrentTurn()) {
                setError(event.error);
                // The Alert has role="alert" and announces itself.
                setAnnouncement('');
                setStatus('error');
              }
              return;
          }
        }
        // The stream ended without a `done` frame. Nothing is in flight any
        // more, so the answer is as finished as it is going to get.
        settleAnswer(answerId, 'complete');
        if (isCurrentTurn()) {
          setAnnouncement('Svaret er ferdig.');
          setStatus('idle');
        }
      } catch {
        if (controller.signal.aborted) {
          settleAnswer(answerId, 'aborted');
          if (isCurrentTurn()) {
            setAnnouncement('Genereringen ble avbrutt.');
            setStatus('idle');
          }
          return;
        }
        settleAnswer(answerId, 'error');
        if (isCurrentTurn()) {
          // A client that threw rather than yielding an error frame says
          // nothing about what went wrong, which is what `unknown` means.
          setError({ code: 'unknown' });
          setAnnouncement('');
          setStatus('error');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [client, filters, patchAnswer, settleAnswer],
  );

  const send = useCallback(
    (question: string) => {
      const query = question.trim();
      if (query.length === 0) return;

      abortRef.current?.abort();
      lastQuestionRef.current = query;

      const now = new Date().toISOString();
      const answerId = nextId('assistant');
      setAppliedFilters((current) => ({ ...current, [answerId]: filters }));
      setMessages((current) => [
        ...current,
        {
          id: nextId('user'),
          role: 'user',
          content: query,
          createdAt: now,
          citations: [],
          status: 'complete',
        },
        {
          id: answerId,
          role: 'assistant',
          content: '',
          createdAt: now,
          citations: [],
          status: 'streaming',
        },
      ]);

      void run(query, answerId);
    },
    [filters, run],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    const question = lastQuestionRef.current;
    if (!question) return;

    // Replace the answer that did not make it rather than stacking a second
    // one under the same question. A failed turn and a stopped one are both
    // replaced: neither is an answer the reader chose to keep.
    const answerId = nextId('assistant');
    setAppliedFilters((current) => ({ ...current, [answerId]: filters }));
    setMessages((current) => [
      ...current.filter(
        (message) =>
          !(
            message.role === 'assistant' &&
            (message.status === 'error' || message.status === 'aborted')
          ),
      ),
      {
        id: answerId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        citations: [],
        status: 'streaming',
      },
    ]);
    void run(question, answerId);
  }, [filters, run]);

  return {
    messages,
    status,
    error,
    announcement,
    appliedFilters,
    noHitsAnswers,
    send,
    cancel,
    retry,
  };
}
