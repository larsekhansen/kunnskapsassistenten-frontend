import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatStatus, ChatTransport, Message } from './types';

/** Thrown into the stream when the reader cancels. Not an error to show. */
const CANCELLED = Symbol('cancelled');

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export type UseChat = {
  messages: Message[];
  status: ChatStatus;
  /** Norwegian error text, set only when status is 'error'. */
  error: string | null;
  send: (question: string) => void;
  /** Stop the generation and keep what has arrived so far (answer 34). */
  cancel: () => void;
  /** Ask the last question again after an error. */
  retry: () => void;
};

/**
 * The chat state machine: messages in, one streamed answer at a time.
 *
 * Streaming is built in rather than added later, because it changes how the
 * answer is rendered — that is exactly why the build order says to do step 3
 * and step 5 together (design/skal-dette-implementeres.md).
 *
 *   idle       nothing in flight
 *   pending    question sent, no token yet — this is what the skeleton shows
 *   streaming  tokens arriving
 *   error      the transport failed; `error` carries the Norwegian message
 *
 * Cancelling is not an error: the partial answer stays on screen and the
 * status goes back to idle, which is what a reader expects from a stop button.
 */
export function useChat(transport: ChatTransport, initialMessages: Message[] = []): UseChat {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef<string | null>(null);

  // Abort an answer still in flight when the view goes away, so the stream
  // does not keep setting state on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(CANCELLED), []);

  const run = useCallback(
    async (question: string, answerId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('pending');
      setError(null);

      try {
        for await (const event of transport(question, controller.signal)) {
          if (controller.signal.aborted) break;

          if (event.type === 'error') {
            setError(event.message);
            setStatus('error');
            return;
          }

          setStatus('streaming');
          setMessages((current) =>
            current.map((message) => {
              if (message.id !== answerId) return message;
              if (event.type === 'token') return { ...message, text: message.text + event.text };
              if (event.type === 'retrieval') return { ...message, retrieval: event.retrieval };
              return { ...message, sources: event.sources };
            }),
          );
        }
        setStatus('idle');
      } catch (thrown) {
        if (thrown === CANCELLED || controller.signal.aborted) {
          setStatus('idle');
          return;
        }
        setError('Noe gikk galt da svaret skulle hentes. Prøv igjen.');
        setStatus('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [transport],
  );

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (trimmed.length === 0) return;

      abortRef.current?.abort(CANCELLED);
      lastQuestionRef.current = trimmed;

      const answerId = nextId('assistant');
      setMessages((current) => [
        ...current,
        { id: nextId('user'), role: 'user', text: trimmed },
        { id: answerId, role: 'assistant', text: '' },
      ]);

      void run(trimmed, answerId);
    },
    [run],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort(CANCELLED);
  }, []);

  const retry = useCallback(() => {
    const question = lastQuestionRef.current;
    if (!question) return;

    // Drop the empty answer the failed attempt left behind, then ask again.
    const answerId = nextId('assistant');
    setMessages((current) => [
      ...current.filter((message) => !(message.role === 'assistant' && message.text === '')),
      { id: answerId, role: 'assistant', text: '' },
    ]);
    void run(question, answerId);
  }, [run]);

  return { messages, status, error, send, cancel, retry };
}
