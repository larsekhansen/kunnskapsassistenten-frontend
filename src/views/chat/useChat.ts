import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatClient } from '../../api';
import type { Message } from '../../model';
import { announcedText } from './answerText';

/** Where the current turn is. Drives the skeleton, the stop button and the error. */
export type ChatStatus = 'idle' | 'pending' | 'streaming' | 'error';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export type UseChat = {
  messages: Message[];
  status: ChatStatus;
  /** Norwegian error text, set only when status is 'error'. */
  error: string | null;
  /**
   * What the polite live region should say at this moment (answer 33).
   *
   * It lives here rather than in the view because only this loop knows when a
   * paragraph finished and when the turn ended. A live region driven by
   * rendering instead of by events either stutters once per token or has to
   * read a ref during render to remember what it already said.
   */
  announcement: string;
  send: (question: string) => void;
  /** Stop the generation and keep what has arrived (answer 34). */
  cancel: () => void;
  /** Ask the last question again after an error. */
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
 *   error      the turn failed; `error` carries the Norwegian message
 *
 * Cancelling is not an error. The client reports it as an `error` event with
 * code `aborted`, and here that means: keep the partial answer, mark it
 * complete, go back to idle. That is what a reader expects from a stop
 * button, and it is why the code checks the code rather than the event type.
 *
 * Only one turn counts at a time. A question asked mid-stream aborts the one
 * before it, and the old turn is then forbidden from touching status,
 * announcement or error — see `turnRef` in `run`.
 */
export function useChat(client: ChatClient, initialMessages: Message[] = []): UseChat {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
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
   * The list holds no answer without content unless it is still streaming.
   * An answer stopped, failed or finished before its first token draws no
   * card anyway, so leaving it in only leaves an `<li>` whose whole content
   * is the hidden «Kunnskapsassistenten svarte:» — a screen reader hears an
   * assistant that answered nothing.
   */
  const settleAnswer = useCallback((id: string, status: 'complete' | 'error') => {
    setMessages((current) => {
      const answer = current.find((message) => message.id === id);
      if (answer && answer.content.length === 0) {
        return current.filter((message) => message.id !== id);
      }
      return current.map((message) => (message.id === id ? { ...message, status } : message));
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

      try {
        for await (const event of client.ask({
          query: question,
          conversationId: conversationRef.current,
          signal: controller.signal,
        })) {
          switch (event.type) {
            case 'token': {
              setStatus('streaming');
              content += event.text;
              patchAnswer(answerId, (message) => ({ ...message, content }));
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
              patchAnswer(answerId, (message) => ({
                ...message,
                thinkingSteps: [...(message.thinkingSteps ?? []), event.step],
              }));
              break;

            case 'sources':
              patchAnswer(answerId, (message) => ({
                ...message,
                sources: event.documents,
                citations: event.citations,
                retrieval: event.retrieval,
              }));
              break;

            case 'done':
              conversationRef.current = event.conversationId;
              settleAnswer(answerId, 'complete');
              if (isCurrentTurn()) {
                setAnnouncement('Svaret er ferdig.');
                setStatus('idle');
              }
              return;

            case 'error':
              if (event.error.code === 'aborted') {
                settleAnswer(answerId, 'complete');
                if (isCurrentTurn()) {
                  setAnnouncement('Genereringen ble avbrutt.');
                  setStatus('idle');
                }
                return;
              }
              settleAnswer(answerId, 'error');
              if (isCurrentTurn()) {
                setError(event.error.message);
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
          settleAnswer(answerId, 'complete');
          if (isCurrentTurn()) {
            setAnnouncement('Genereringen ble avbrutt.');
            setStatus('idle');
          }
          return;
        }
        settleAnswer(answerId, 'error');
        if (isCurrentTurn()) {
          setError('Noe gikk galt da svaret skulle hentes. Prøv igjen.');
          setAnnouncement('');
          setStatus('error');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [client, patchAnswer, settleAnswer],
  );

  const send = useCallback(
    (question: string) => {
      const query = question.trim();
      if (query.length === 0) return;

      abortRef.current?.abort();
      lastQuestionRef.current = query;

      const now = new Date().toISOString();
      const answerId = nextId('assistant');
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
    [run],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    const question = lastQuestionRef.current;
    if (!question) return;

    // Replace the failed answer rather than stacking a second one under the
    // same question.
    const answerId = nextId('assistant');
    setMessages((current) => [
      ...current.filter((message) => !(message.role === 'assistant' && message.status === 'error')),
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
  }, [run]);

  return { messages, status, error, announcement, send, cancel, retry };
}
