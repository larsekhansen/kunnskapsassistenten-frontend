import { use, useCallback, useEffect, useRef } from 'react';
import type { ChatClient } from '../api';
import { isEmptySelection, type FilterSelection, type ThreadDetail } from '../model';
import { FilterContext } from './filterContext';

/**
 * The lock a thread carries, or none. An empty filter locks nothing: the BFF
 * only remembers one that had values in it.
 */
export function lockOf(detail: ThreadDetail | null | undefined): FilterSelection | undefined {
  const filter = detail?.filter;
  return filter && !isEmptySelection(filter) ? filter : undefined;
}

/**
 * Tells the shell what the thread on the page is locked to (filterContext.ts,
 * `locked`), for the page that holds the thread.
 *
 * Its own hook so the page carries one call and one line, and not the
 * bookkeeping: `ChatSlotView` is where several owners write.
 *
 *   - A thread read from its address carries its lock, and a page with none
 *     read has none — which is also how leaving lets it go: the page the
 *     reader goes to says its own, on mount, and `/` has none. There is no
 *     cleanup on unmount for that reason; it would say the same thing twice.
 *   - A corpus switch lets it go. The page stays mounted through one (the
 *     navigation to `/` does nothing there), so nothing else would. The
 *     corpus is kept, because an effect runs on mount as well, and a mount is
 *     not a switch.
 *
 * The context and not `useFilterSelection()`, which throws outside a
 * LayoutProvider: the page is mounted on its own in tests, and with no shell
 * there is no filter panel to tell.
 *
 * Returns what the page calls for a thread it started: the BFF locks a
 * conversation from its first question — it remembers the filter when it
 * makes it, which is before it says the id — so the thread is read back once
 * it has one, and what the backend says is the lock. Nothing is guessed from
 * which client this is; mock and live keep no filter on a thread and say
 * none. `stillOpen` is asked when the answer comes, so a reader who has moved
 * on is not given a lock for a thread that is no longer on screen.
 */
export function useThreadFilterLock(
  client: ChatClient,
  read: ThreadDetail | null | undefined,
  corpusKey: string | undefined,
): (threadId: string, stillOpen: () => boolean) => void {
  const setLocked = use(FilterContext)?.setLocked;

  useEffect(() => {
    setLocked?.(lockOf(read));
  }, [read, setLocked]);

  const lockCorpus = useRef(corpusKey);
  useEffect(() => {
    if (lockCorpus.current === corpusKey) return;
    lockCorpus.current = corpusKey;
    setLocked?.(undefined);
  }, [corpusKey, setLocked]);

  return useCallback(
    (threadId: string, stillOpen: () => boolean) => {
      void client
        .getThread(threadId)
        .then((detail) => {
          if (stillOpen()) setLocked?.(lockOf(detail));
        })
        .catch(() => {});
    },
    [client, setLocked],
  );
}
