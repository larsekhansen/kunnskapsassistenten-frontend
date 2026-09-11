import { useEffect, useState, type RefObject } from 'react';

/** How close to the end still counts as «at the bottom», in CSS pixels. */
const SLACK = 24;

/**
 * Is the given scroll container at its bottom?
 *
 * «Bla til nederst» (answer 17) only means something when there is something
 * below the fold, so the button is hidden when there is not: a control that
 * does nothing is worse than no control.
 *
 * `content` is watched rather than the container, because the container keeps
 * its size while an answer grows inside it.
 */
export function useAtBottom(
  container: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): boolean {
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const element = container.current;
    const watched = content.current;
    if (!element) return;

    const update = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      setAtBottom(distance <= SLACK);
    };

    update();
    element.addEventListener('scroll', update, { passive: true });

    const observer = new ResizeObserver(update);
    observer.observe(watched ?? element);

    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [container, content]);

  return atBottom;
}
