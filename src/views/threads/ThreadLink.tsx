import { Link } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import type { Thread } from '../../model';

export type ThreadLinkProps = {
  thread: Thread;
  /** This is the conversation on screen. See openThreadContext.ts. */
  current: boolean;
};

/**
 * One thread's title, as a link, cut off after two lines.
 *
 * The cut is for the rows nobody has titled. `Thread.title` is the reader's
 * own question until a backend writes a real title (see `titleFromQuestion`),
 * so the thread they just started is the one row in the list that is raw
 * question text: three lines against one for «NKOM måloppnåelse», and the
 * same subject written twice in the panel — once as a heading further down
 * the list, once as the question at the top (brukerblikk runde 3, funn 5).
 *
 * Two lines rather than one, because a question cut after one line is rarely
 * still a question. The cut is visual only: the whole title stays in the DOM,
 * so it is the link's accessible name and a screen reader reads all of it.
 *
 * `title` — the tooltip — is set only when something is actually hidden, and
 * that is why this is measured rather than always on. As a description it is
 * read after the name by some screen readers, so an unconditional one would
 * have every short row announce its own title twice; and a tooltip on a row
 * that is not cut off promises the reader something they can already see. The
 * panel is resizable (#50), so the answer changes without the title changing.
 */
export function ThreadLink({ thread, current }: ThreadLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // A line clamp leaves the element's own box at two lines and the content
    // taller. The pixel of slack is for sub-pixel line heights, which round
    // the two apart on a row where nothing is hidden.
    const measure = () => setClipped(element.scrollHeight - element.clientHeight > 1);
    measure();

    /*
     * Again when the web font has arrived.
     *
     * Inter is loaded from altinncdn, and `document.fonts.status` is still
     * `loading` while these rows first measure themselves — so the first
     * answer is about the fallback face, whose metrics are not Inter's. A row
     * that fits in the fallback and not in Inter kept its tooltip off, and
     * the reader had no way to the rest of the question (KA CC on #80).
     *
     * `document.fonts` is absent in jsdom, so this is read as optional.
     */
    let live = true;
    const fonts: FontFaceSet | undefined = document.fonts;
    void fonts?.ready.then(() => {
      if (live) measure();
    });

    // jsdom has no ResizeObserver, and nothing there has a layout to measure
    // in the first place. Same guard as the shell's region head.
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
    /*
     * `current` is in here for a reason a resize cannot cover: the open row is
     * drawn semibold (see threads.css), which makes the same title about 6 px
     * wider without changing the box it is drawn in. `ResizeObserver` watches
     * the box, so it stays silent through exactly the change that can push a
     * title onto a third line. Measured by KA CC on #80.
     */
  }, [thread.title, current]);

  return (
    <Link asChild data-size="sm" className="threads-view__thread">
      {/*
        `aria-current="page"` — not the colour — is what makes the open thread
        available to a screen reader, and the style hangs off the same
        attribute so the two can never drift.

        It came from `NavLink`, which reads the router's location, until
        2026-09-15. That missed the commonest way in: a conversation the
        reader starts on `/` gets its address from `history.replaceState`,
        which the router never sees, so the thread they had just made stayed
        unmarked until a reload (KA CC). The shell knows which conversation is
        on screen however the address got there; see openThreadContext.ts.
      */}
      <RouterLink
        ref={ref}
        aria-current={current ? 'page' : undefined}
        title={clipped ? thread.title : undefined}
        to={`/threads/${thread.id}`}
      >
        {thread.title}
      </RouterLink>
    </Link>
  );
}
