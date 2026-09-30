import { useEffect, useState } from 'react';

/**
 * Whether an element is taller inside than it is drawn, so it scrolls.
 *
 * For the sidebars' scrolling region, which has to take the keyboard when it
 * scrolls and has nothing else in it that can (WCAG 2.1.1; axe's
 * `scrollable-region-focusable`). Found by KA CC in bff mode with no BFF
 * behind it: the filter panel waits for the BFF with only skeletons in it,
 * and at 1280 × 720 it scrolls 786 px of content in a 592 px window with not
 * one control to tab to — the «Tråder» button is on the panel's own row,
 * outside the region.
 *
 * Returns a callback ref and not a ref object, because the region is not one
 * element for life: the shell draws the same content in the panel on the row
 * or inside the drawer, and crossing the breakpoint mounts it in the other.
 *
 * Measured, not worked out. The element's own box changes with the window;
 * its children change when a view loads or is switched, which is what makes
 * it taller inside, so both are observed, and the list of children is
 * watched so a new view is observed too.
 */
export function useScrollsItself(): [boolean, (element: HTMLElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    // jsdom has no ResizeObserver, and nothing there scrolls.
    if (element === null || typeof ResizeObserver === 'undefined') return;

    const measure = () => setScrolls(element.scrollHeight > element.clientHeight);
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(element);
      for (const child of element.children) sizes.observe(child);
    };
    const children = new MutationObserver(() => {
      watch();
      measure();
    });

    watch();
    children.observe(element, { childList: true });
    measure();

    return () => {
      sizes.disconnect();
      children.disconnect();
    };
  }, [element]);

  return [element !== null && scrolls, setElement];
}
