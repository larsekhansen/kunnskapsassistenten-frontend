import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** How close to the end counts as «at the bottom»: a line of the answer and
    half a wheel step, so a reader who stops just short still has the last
    line under the edge and the column keeps following. */
const SLACK = 80;

/**
 * Keeps the main column at its bottom while an answer arrives, if that is
 * where the reader already was, and returns whether it is there, which is
 * what «Bla til nederst» is drawn from. One hook for both, because two cannot
 * agree on the same growth and the button then flickers all answer long.
 *
 * **Only scrolling UP lets go.** The scroll event for a jump this hook makes
 * arrives a frame later, by which time the answer may have grown, so a rule
 * asking only «is it at the bottom» lets go there and leaves the answer
 * behind. And only while an answer is on its way: other growth is a thread
 * opening, where jumping to the bottom takes the reader off what they came
 * to read. Instant rather than smooth, since a smooth scroll restarted every
 * frame never arrives.
 */
export function useFollowAnswer(
  container: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  answering: boolean,
): boolean {
  const [atBottom, setAtBottom] = useState(true);
  const stuck = useRef(true);
  const following = useRef(answering);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const near = () => distanceToBottom(element) <= SLACK;
    // Held at the bottom counts as at the bottom: see above.
    const report = () => setAtBottom(near() || (following.current && stuck.current));

    // Where the column stood at the last scroll event, to tell up from down.
    let lastTop = element.scrollTop;
    const scrolled = () => {
      const top = element.scrollTop;
      if (near()) stuck.current = true;
      else if (top < lastTop) stuck.current = false;
      lastTop = top;
      report();
    };

    stuck.current = near();
    report();
    element.addEventListener('scroll', scrolled, { passive: true });

    // jsdom has no ResizeObserver, and there is no layout there to follow.
    if (typeof ResizeObserver === 'undefined') {
      return () => element.removeEventListener('scroll', scrolled);
    }

    const observer = new ResizeObserver(() => {
      if (following.current && stuck.current) toEnd(element);
      else stuck.current = near();
      report();
    });
    observer.observe(content.current ?? element);

    return () => {
      element.removeEventListener('scroll', scrolled);
      observer.disconnect();
    };
  }, [container, content]);

  // A layout effect, so the flag is set before the browser lays the new
  // question out: after paint, the first growth of every turn — the question
  // itself — is measured as the reader leaving the bottom.
  useLayoutEffect(() => {
    const was = following.current;
    following.current = answering;

    const element = container.current;
    if (was && !answering && stuck.current && element) toEnd(element);
  }, [answering, container]);

  return atBottom;
}

/** To the end of the column, at once. */
function toEnd(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

function distanceToBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}
