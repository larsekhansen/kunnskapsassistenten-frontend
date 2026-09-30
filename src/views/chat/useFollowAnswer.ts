import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { AT_BOTTOM_SLACK } from './useAtBottom';

/**
 * Keeps the main column at its bottom while an answer arrives, if that is
 * where the reader already was — and leaves it alone otherwise (Simens
 * runde 3, ekstra 4).
 *
 * «Where the reader was» is decided by the reader's own scrolling, and by
 * nothing else. Measured in the scroll events, before the answer grows, and
 * kept while it grows: a column that grew by a paragraph is no longer at its
 * bottom, but the reader who was there is still following. Scrolling up
 * lets go, and scrolling back down takes hold again.
 *
 * Only while an answer is on its way. Growth at any other time is somebody
 * opening a thread, or a panel in it, and a column that went to the bottom
 * then would take the reader away from the top of what they came to read.
 * That growth is measured instead, so a long thread that has just loaded
 * does not count as «at the bottom» because the page was empty a moment ago.
 *
 * The last render of an answer lands together with the status that ends it:
 * the action row under the answer and the follow-up suggestions under the
 * field. That growth is followed once more, on the transition, or the column
 * would stop one row short of the bottom on every answer.
 *
 * Instant rather than smooth. It runs once a frame while the answer streams,
 * and a smooth scroll restarted every frame never arrives.
 */
export function useFollowAnswer(
  container: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  answering: boolean,
): void {
  const stuck = useRef(true);
  const following = useRef(answering);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const measure = () => {
      stuck.current = distanceToBottom(element) <= AT_BOTTOM_SLACK;
    };

    measure();
    element.addEventListener('scroll', measure, { passive: true });

    // jsdom has no ResizeObserver, and there is no layout there to follow.
    if (typeof ResizeObserver === 'undefined') {
      return () => element.removeEventListener('scroll', measure);
    }

    const observer = new ResizeObserver(() => {
      if (following.current && stuck.current) toEnd(element);
      else measure();
    });
    observer.observe(content.current ?? element);

    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [container, content]);

  /*
   * A layout effect, so the flag is set before the browser lays the new
   * question out and the observer above sees it grow. A plain effect runs
   * after paint, and the first growth of every turn — the question itself —
   * was measured as the reader leaving the bottom.
   */
  useLayoutEffect(() => {
    const was = following.current;
    following.current = answering;

    const element = container.current;
    if (was && !answering && stuck.current && element) toEnd(element);
  }, [answering, container]);
}

/** To the end of the column, at once. */
function toEnd(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

function distanceToBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}
