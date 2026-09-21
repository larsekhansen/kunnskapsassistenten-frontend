import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import {
  activeCorpusKey,
  corpusIsChoosable,
  corpusOption,
  corpusOptions,
  setActiveCorpusKey,
  subscribeToCorpus,
  type CorpusOption,
} from '../api';

export type Corpus = {
  /** Every corpus this deployment can reach, in the order it named them. */
  options: CorpusOption[];
  /** The key on the wire. Undefined only when nothing is configured at all. */
  active: string | undefined;
  /**
   * The whole entry for the active corpus — label and description, not just
   * the key.
   *
   * The corpus line in the filter panel says what the reader is searching, and
   * that sentence has to change with the corpus or it says «Kudos» over
   * NorQuAD's articles. Asked for by #2, 21.09.
   */
  option: CorpusOption | undefined;
  /**
   * True when there is more than one to pick from. A single corpus is still a
   * corpus and still travels on every call; it just has no chooser.
   */
  choosable: boolean;
  /** Switch corpus. Starts a new thread; see below. */
  set: (key: string) => void;
};

/**
 * Which corpus the assistant searches, for the views that show or change it.
 *
 * The state lives outside React, in src/api/corpus.ts, because the chat client
 * has to read it when it builds a request and the client is not a component.
 * This is the React end of it: `useSyncExternalStore` reads the store during
 * render, the same shape `useViewportWidth` uses for the window, so the first
 * paint after a change is already right.
 *
 * **Switching starts a new thread, and that is not a convenience.** A thread's
 * answers cite documents from the corpus it was asked of; continuing it
 * against another corpus would produce a conversation whose citations point
 * into two different document sets, with nothing on screen saying which is
 * which. So the address goes to `/` and the next question starts a thread
 * bound to the new corpus. No confirmation — Lars 21.09, via the brief: just
 * switch.
 *
 * The navigation lives here rather than in the store for the same reason the
 * store is not a context: routes are the shell's, and a module under src/api
 * has no business knowing the app has addresses.
 */
export function useCorpus(): Corpus {
  const navigate = useNavigate();
  const active = useSyncExternalStore(subscribeToCorpus, activeCorpusKey);

  const set = useCallback(
    (key: string) => {
      if (key === activeCorpusKey()) return;
      setActiveCorpusKey(key);
      /*
        `/` and not a new thread id: a thread is minted by the first question,
        not by arriving on the page (see `threadFromQuestion`). Going to the
        front page is what «start a new thread» means here, and it is also
        what puts the reader where the next question will be asked.

        A push and not a replace: the thread they were reading is still theirs,
        and Back should take them to it. Replacing would drop it out of the
        history to save an entry nobody wanted saved.
      */
      navigate('/');
    },
    [navigate],
  );

  return useMemo(
    () => ({
      options: corpusOptions,
      active,
      option: corpusOption(active),
      choosable: corpusIsChoosable,
      set,
    }),
    [active, set],
  );
}
