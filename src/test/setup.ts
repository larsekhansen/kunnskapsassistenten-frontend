import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetViewport } from './matchMedia';

/**
 * Test environment fixes for jsdom.
 *
 * Designsystemet loads @oddbird/popover-polyfill, which reads CSS.escape at
 * import time. jsdom has no CSS object, so importing any Designsystemet
 * component throws before a test runs. The escape below is the spec algorithm
 * reduced to what a polyfill needs: it is never rendered, only used to build
 * selectors.
 */
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    escape: (value: string) => value.replace(/[^a-zA-Z0-9_ -￿-]/g, '\\$&'),
  } as unknown as typeof globalThis.CSS;
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_ -￿-]/g, '\\$&');
}

/**
 * jsdom runs no animations and has no Web Animations API, so
 * `document.getAnimations` is missing. Designsystemet's `Skeleton` calls it on
 * mount to line its shimmer up with the others, and throws before a test that
 * renders a loading state reaches its first assertion.
 *
 * An empty list is the truthful answer here: nothing IS animating.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/**
 * Testing Library normally registers its own afterEach, but only when vitest
 * runs with globals. This project imports describe/it/expect explicitly, so
 * the cleanup is registered here instead — without it the DOM from one test
 * is still there in the next.
 */
afterEach(cleanup);

/**
 * jsdom has no matchMedia at all, so importing this installs one. See
 * matchMedia.ts: without it any component that asks about the viewport — the
 * layout, SourcesView and its reduced-motion check — throws before a test
 * reaches its first assertion.
 */
afterEach(resetViewport);
