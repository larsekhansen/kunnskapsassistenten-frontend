import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFollowAnswer } from './useFollowAnswer';

/**
 * Following an answer down the column (Simens runde 3, ekstra 4).
 *
 * jsdom lays nothing out, so the column's three numbers are set by hand and
 * the observer is a stand-in that the test fires when the content «grows».
 * What is asserted is the rule: follow only while an answer is on its way,
 * and only if the reader was at the bottom when it grew.
 */

let grow: (() => void) | undefined;

class FakeResizeObserver {
  constructor(callback: () => void) {
    grow = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
  grow = undefined;
});

/** A column 500 high with `height` of content, scrolled to `top`. */
function column(height: number, top: number) {
  const element = document.createElement('div');
  let scrollHeight = height;
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 500 });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  element.scrollTop = top;
  return {
    element,
    /** The answer grew by `by`; the observer is told, as the browser would. */
    growBy(by: number) {
      scrollHeight += by;
      act(() => grow?.());
    },
    /** The reader scrolled. */
    scrollTo(value: number) {
      element.scrollTop = value;
      act(() => {
        element.dispatchEvent(new Event('scroll'));
      });
    },
  };
}

function Follow({ element, answering }: { element: HTMLElement; answering: boolean }) {
  const container = useRef<HTMLElement | null>(element);
  const content = useRef<HTMLElement | null>(element);
  useFollowAnswer(container, content, answering);
  return null;
}

describe('useFollowAnswer', () => {
  it('follows an answer down when the reader is at the bottom', () => {
    // 1000 of content in 500: the bottom is at 500.
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.growBy(120);

    expect(col.element.scrollTop).toBe(1120);
  });

  it('leaves the column where it is when the reader is further up', () => {
    const col = column(1000, 200);
    render(<Follow element={col.element} answering />);

    col.growBy(120);

    expect(col.element.scrollTop).toBe(200);
  });

  it('lets go when the reader scrolls up, and takes hold again at the bottom', () => {
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.scrollTo(300);
    col.growBy(100);
    expect(col.element.scrollTop).toBe(300);

    // The bottom is now at 600.
    col.scrollTo(600);
    col.growBy(100);
    expect(col.element.scrollTop).toBe(1200);
  });

  it('does not follow growth when no answer is on its way', () => {
    // A thread opening: the page was empty, and then it was long.
    const col = column(500, 0);
    const { rerender } = render(<Follow element={col.element} answering={false} />);

    col.growBy(1500);
    expect(col.element.scrollTop).toBe(0);

    // And that growth counts as leaving the bottom, so a question asked from
    // the top of the thread does not pull the column down.
    rerender(<Follow element={col.element} answering />);
    col.growBy(200);
    expect(col.element.scrollTop).toBe(0);
  });

  it('follows the last render of an answer, which lands with the status that ends it', () => {
    const col = column(1000, 500);
    const { rerender } = render(<Follow element={col.element} answering />);

    // The action row and the follow-ups arrive in the same render as «idle».
    col.element.scrollTop = 500;
    Object.defineProperty(col.element, 'scrollHeight', { configurable: true, value: 1080 });
    rerender(<Follow element={col.element} answering={false} />);

    expect(col.element.scrollTop).toBe(1080);
  });
});
