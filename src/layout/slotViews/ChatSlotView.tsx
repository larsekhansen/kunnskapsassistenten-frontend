import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { activeCorpusKey, createChatClient, subscribeToCorpus } from '../../api';
import { NotFoundState } from '../../components';
import { threadFromQuestion, type Thread, type ThreadDetail } from '../../model';
import { ChatView } from '../../views/chat';
import { ThreadContext } from '../threadContext';
import { useAnswerSources } from '../useAnswerSources';
import { useComposerPresence } from '../useComposerPresence';
import { useNoAnswers } from '../useNoAnswers';
import { useReportOpenThread } from '../useOpenThread';

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
 * An id the client does not know draws «Fant ikke tråden» instead of a
 * conversation. Before that it drew a fresh, working front page under an
 * address naming a thread, so a shared link that had gone stale looked like
 * it had worked — reise 14 in design/brukerreiser-2026-09-15.md. That state
 * has no compose field, and the shell is told, because the shell draws a skip
 * link straight to one. See composerContext.ts.
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
  /**
   * The client answered, and the answer was «no such thread».
   *
   * Separate from `thread === null`, which is also what «not read yet» looks
   * like. Only the client saying no counts, and only saying no in so many
   * words: a read that THREW says nothing about whether the thread exists, so
   * it is left alone below and the conversation carries on.
   */
  const [missing, setMissing] = useState(false);
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

  /*
   * Switching corpus lets go of the thread this page started.
   *
   * A thread belongs to the corpus it was started in, and the selector says
   * so by navigating to `/`. That navigation is a no-op here, and the reason
   * is three paragraphs down: the address was written with
   * `history.replaceState`, which the ROUTER never sees, so React Router
   * still believes the location is `/` and navigating there changes nothing.
   * Nothing remounts, this ref keeps the old thread, and the next question is
   * filed under it — one thread with answers from two corpora, which is what
   * the thread list then draws one corpus for (KA CC on #131).
   *
   * So the thread is released here instead, where the change is actually
   * observable. `useChat` empties the conversation on the same change; this
   * is the other half, and without it the empty screen would still mint its
   * next question into the old thread.
   *
   * The state goes while rendering, the ref in the effect beside it: a ref
   * written during render is a change React cannot see. Nothing reads this
   * one before then — `startThread` runs from a question, which is a click or
   * a keystroke, long after effects.
   */
  const corpusKey = useSyncExternalStore(subscribeToCorpus, activeCorpusKey);
  const [corpusInUse, setCorpusInUse] = useState(corpusKey);
  if (corpusKey !== corpusInUse) {
    setCorpusInUse(corpusKey);
    setStarted(undefined);
  }

  useEffect(() => {
    startedRef.current = undefined;
  }, [corpusKey]);

  useEffect(() => {
    if (!threadId) return;

    const abort = new AbortController();
    client
      .getThread(threadId, abort.signal)
      .then((found) => {
        if (abort.signal.aborted) return;
        setThread(found);
        setMissing(found === null);
        // Tell the client which conversation the questions that follow belong
        // to. Only a client that remembers anything implements it; see
        // ChatClient.openThread.
        if (found) client.openThread?.(found);
      })
      .catch(() => {
        // A thread that cannot be READ is a new conversation, not an error
        // page: the compose field still works and the user can ask again.
        // «Does not exist» is the other answer and is handled above.
      });

    return () => abort.abort();
  }, [client, threadId]);

  // The sources on screen belong to the answer on screen. Leaving a thread
  // has to clear them, or the sources panel keeps citing the previous answer.
  useEffect(() => () => setDocuments(undefined), [setDocuments]);

  /**
   * «Fant ikke tråden» has no compose field, so «Hopp til skrivefeltet» must
   * not be drawn over it. The shell cannot see this: the route is an ordinary
   * `/threads/:threadId` and draws an ordinary main slot, and only the answer
   * from the client says which of the two things goes in it. Tab Tab + Enter
   * on an unknown thread left the focus on a link to an element that was not
   * in the document (KA CC, 2026-09-15).
   *
   * `!missing` and not «the view is mounted»: the chat view always brings a
   * composer when it draws a conversation, and this is the one branch where
   * it draws something else. While the client is still answering, `missing`
   * is false and a composer really is on screen — the welcome screen is drawn
   * until the answer comes — so the link is right at every moment, not only
   * at the end.
   */
  useComposerPresence(!missing);

  // A thread that is not there has no answers either, and the panel has to
  // say so rather than draw skeletons. It happens to be right without this
  // today — the chat view mounts for a moment before the client answers, and
  // reports an empty list on its way past — but that is a race in another
  // view, not a decision this page has made. See useNoAnswers.ts.
  useNoAnswers(missing);

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
   *
   * A thread that is still being read is NOT no thread. See below.
   */
  const startThread = useCallback(
    (question: string): Thread => {
      const existing = startedRef.current ?? thread ?? undefined;
      if (existing) return existing;

      /*
       * The address already names a conversation; it just has not arrived
       * yet. The question belongs to that one.
       *
       * This is the rest of the hole KA CC found in #66. The compose field
       * works while `getThread` is in flight — deliberately, and `useChat`
       * lays the stored conversation in front of the turn when it lands — but
       * nothing here could tell «no thread» from «a thread that is still on
       * its way», and the two look identical: `thread` is null in both. So a
       * question asked in that gap minted a thread of its own, wrote the
       * address over to it, and left an empty conversation in the list beside
       * the one the reader was standing in. «Kopier lenke til tråden» copies
       * `window.location.href`, so it copied the wrong one. Measured on
       * `/threads/nkom-maaloppnaaelse`.
       *
       * Nothing is minted and nothing is navigated, because there is nothing
       * to do: the address is already right.
       *
       * The client IS told, here and not only when the read lands, and that
       * is the second half of the same hole (KA CC on #149). The read is what
       * used to say where the answer goes — and it says it too late when it
       * comes back after the turn is over. Then nothing had filed the answer
       * anywhere, and the question the reader asked in the gap was gone at
       * the next reload. Measured with a read that takes longer than the
       * answer: the turn finished at 3 s, the read landed at 4 s, and nothing
       * was written down.
       *
       * Saying it twice costs nothing: opening a thread that is already open
       * is what the effect above does on every mount.
       *
       * The id is the part of this that is true, and `id-only` is how the
       * client is told so. The title is a stand-in until the read lands with
       * the real one — and the client is the one that has to know the
       * difference, or it writes the stand-in down as the conversation's name
       * (KA CC on #153). See `ChatClient.openThread`.
       */
      if (threadId) {
        const asked: Thread = { ...threadFromQuestion(question), id: threadId };
        client.openThread?.(asked, 'id-only');
        return asked;
      }

      /*
        Stamped with the corpus the question is about to be asked of, so a
        thread minted here says the same thing as one read back from the
        backend (which carries it as a `corpus:` tag). A thread belongs to one
        corpus for good: switching starts a new one rather than moving this.
      */
      const created: Thread = { ...threadFromQuestion(question), corpusKey: activeCorpusKey() };
      startedRef.current = created;
      setStarted(created);
      // Before the address is written, so a client that remembers threads has
      // somewhere to file the answer that is about to stream in.
      client.openThread?.(created);
      window.history.replaceState(window.history.state, '', `/threads/${created.id}`);
      return created;
    },
    [client, thread, threadId],
  );

  const value = useMemo(
    () => ({ thread: thread ?? started, startThread }),
    [thread, started, startThread],
  );

  /**
   * Tell the shell which conversation is on screen, so the thread list can
   * mark its row.
   *
   * `thread ?? started` and not the route's id, and that is the whole point:
   * a conversation the reader started here has an address written with
   * `history.replaceState` (see `startThread`), which `NavLink` never sees.
   * The row for the thread they had just made stayed unmarked until the next
   * reload — measured by KA CC, and for a screen reader an open thread
   * without `aria-current` is a thread that is not open.
   *
   * `missing` is the one case where the address names a thread and none is on
   * screen. Marking a row for a thread that is not there would point the
   * reader at the conversation they failed to open.
   */
  useReportOpenThread(missing ? undefined : (thread ?? started)?.id);

  return (
    <ThreadContext value={value}>
      {missing ? (
        <NotFoundState
          title="Fant ikke tråden"
          description="Lenken peker på en samtale som ikke finnes her. Tråder lagres ikke på tvers av nettlesere, så en delt lenke fører ikke fram ennå."
        />
      ) : (
        <ChatView thread={thread ?? undefined} />
      )}
    </ThreadContext>
  );
}
