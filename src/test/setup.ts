import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
 * Testing Library normally registers its own afterEach, but only when vitest
 * runs with globals. This project imports describe/it/expect explicitly, so
 * the cleanup is registered here instead — without it the DOM from one test
 * is still there in the next.
 */
afterEach(cleanup);
