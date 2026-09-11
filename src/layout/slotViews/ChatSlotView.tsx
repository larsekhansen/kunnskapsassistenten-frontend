import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { createChatClient } from '../../api';
import type { ThreadDetail } from '../../model';
import { ChatView } from '../../views/chat';
import { useAnswerSources } from '../useAnswerSources';

/**
 * Mounts the chat view in whichever slot holds it.
 *
 * Two things the view should not have to know are settled here.
 *
 * The thread comes from the URL. `/threads/:threadId` names one, `/` names
 * none, and the view takes a `ThreadDetail` and never a route. It is fetched
 * through `createChatClient()`, so it follows `VITE_API_MODE` like everything
 * else: mock mode has the fixtures, live mode has no readable thread history
 * and says so by returning null. Reaching into `src/api/mock/` directly would
 * put fixtures in a production bundle.
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

  return <ChatView thread={thread ?? undefined} />;
}
