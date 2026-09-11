import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** How close to the end still counts as «at the bottom», in CSS pixels. */
const SLACK = 24;

/**
 * The nearest ancestor that actually scrolls.
 *
 * The chat does not own its scroll container: `.main` scrolls, and that
 * belongs to the shell. Walking up to find it keeps this view from nesting a
 * second scroller inside the first, which would give the reader two
 * scrollbars and one of them the wrong one. When the shell offers a ref or a
 * context for its scroll container, this walk is replaced by that.
 */
function findScrollParent(element: Element | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Tracks whether the conversation is scrolled to the end, and scrolls there.
 *
 * «Bla til nederst» (answer 17) only makes sense when there is something
 * below the fold, so the button is hidden when there is not — a control that
 * does nothing is worse than no control.
 */
export function useScrollToBottom(rootRef: RefObject<HTMLElement | null>) {
  const [atBottom, setAtBottom] = useState(true);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const container = findScrollParent(root);
    containerRef.current = container;
    if (!root || !container) return;

    const update = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      setAtBottom(distance <= SLACK);
    };

    update();
    container.addEventListener('scroll', update, { passive: true });

    // The container keeps its size while the answer grows inside it, so the
    // content is what has to be observed, not the container.
    const observer = new ResizeObserver(update);
    observer.observe(root);

    return () => {
      container.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [rootRef]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({ top: container.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  return { atBottom, scrollToBottom };
}
