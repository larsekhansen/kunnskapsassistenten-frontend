import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { createChatClient } from '../../api';
import { threadFromQuestion, type Thread, type ThreadDetail } from '../../model';
import { ChatView } from '../../views/chat';
import { ThreadContext } from '../threadContext';
import { useAnswerSources } from '../useAnswerSources';

/**
 * Mounts the chat view in whichever slot holds it.
 *
 * Three things the view should not have to know are settled here.
 *
 * The thread comes from the URL. `/threads/:threadId` names one, `/` names
 * none, and the view takes a `ThreadDetail` and never a route. It is fetched
 * through `createChatClient()`, so it follows `VITE_API_MODE` like everything
 * else: mock mode has the fixtures, live mode has no readable thread history
 * and says so by returning null. Reaching into `src/api/mock/` directly would
 * put fixtures in a production bundle.
 *
 * A conversation started on `/` gets an address here, through
 * `ThreadContext`. See `ChatSlot` below.
 *
 * The sources behind the answer are lifted to the shell, so the sources view
 * can draw them without the two views knowing about each other. See
 * answerSourcesContext.ts.
 */
export function ChatSlotView() {
  const { threadId } = useParams();

  // Keyed on the address, so moving between threads starts from nothing
  // rather than showing the previous thread until the next one has loaded.
  // It is also what lets the state below start at null without an effect
  // writing it back on every navigation.
  return <ChatSlot key={threadId ?? 'new'} threadId={threadId} />;
}

function ChatSlot({ threadId }: { threadId?: string }) {
  const client = useMemo(() => createChatClient(), []);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const { setDocuments } = useAnswerSources();

  /**
   * The conversation the user started here, on a page that had no address.
   *
   * Separate state from `thread` because they are answers to different
   * questions: `thread` is what the backend had, `started` is what this tab
   * made. Only one of them can be set — this component is keyed on the route,
   * so a route with an id never starts anything.
   */
  const [started, setStarted] = useState<Thread | undefined>(undefined);
  const startedRef = useRef<Thread | undefined>(undefined);

  useEffect(() => {
    if (!threadId) return;

    const abort = new AbortController();
    client
      .getThread(threadId, abort.signal)
      .then((found) => {
        if (!abort.signal.aborted) setThread(found);
      })
      .catch(() => {
        // A thread that cannot be read is a new conversation, not an error
        // page: the compose field still works and the user can ask again.
      });

    return () => abort.abort();
  }, [client, threadId]);

  // The sources on screen belong to the answer on screen. Leaving a thread
  // has to clear them, or the sources panel keeps citing the previous answer.
  useEffect(() => () => setDocuments(undefined), [setDocuments]);

  /**
   * Give the conversation an address, once.
   *
   * Without this the first question on `/` produces a thread in the list and
   * an answer on screen while the URL still says `/`, so «Kopier lenke til
   * tråden» copies the front page. C16 in design/funksjonssjekk-v1.md.
   *
   * `history.replaceState` and NOT the router, and that is the whole reason
   * this is three lines rather than one `navigate()`. The router would
   * re-render, `useParams` would change, `ChatSlotView`'s key would go from
   * `new` to the id, and this component would remount — taking the answer
   * that is streaming into it with it. The address is a link for later, not a
   * navigation: nothing on screen should move.
   *
   * What that costs: React Router's own idea of the location stays `/` until
   * the next real navigation. Every link in this app is absolute, so nothing
   * resolves against it, and a reload lands on `/threads/:id` and reads the
   * thread properly. A relative `navigate('..')` would be wrong, and there
   * is none.
   *
   * The ref is what makes it once-only. State would be read from a closure
   * that is one render stale, and the second question of a conversation would
   * mint a second thread.
   */
  const startThread = useCallback(
    (question: string): Thread => {
      const existing = startedRef.current ?? thread ?? undefined;
      if (existing) return existing;

      const created = threadFromQuestion(question);
      startedRef.current = created;
      setStarted(created);
      window.history.replaceState(window.history.state, '', `/threads/${created.id}`);
      return created;
    },
    [thread],
  );

  const value = useMemo(
    () => ({ thread: thread ?? started, startThread }),
    [thread, started, startThread],
  );

  return (
    <ThreadContext value={value}>
      <ChatView thread={thread ?? undefined} />
    </ThreadContext>
  );
}
