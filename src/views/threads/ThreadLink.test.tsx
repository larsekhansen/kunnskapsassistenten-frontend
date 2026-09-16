import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Thread } from '../../model';
import { ThreadLink } from './ThreadLink';

const now = new Date().toISOString();
const thread: Thread = {
  id: 'dss-regnskap',
  title:
    'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  createdAt: now,
  updatedAt: now,
};

/**
 * jsdom lays nothing out, so both heights are 0 and nothing is ever clipped
 * — which is the right default for every other test in the project. The two
 * tests that are about the measurement say what the browser would have
 * measured, on the prototype, and put it back afterwards.
 */
function withHeights(scrollHeight: number, clientHeight: number): void {
  for (const [name, value] of [
    ['scrollHeight', scrollHeight],
    ['clientHeight', clientHeight],
  ] as const) {
    Object.defineProperty(HTMLAnchorElement.prototype, name, { configurable: true, value });
  }
}

afterEach(() => {
  for (const name of ['scrollHeight', 'clientHeight']) {
    delete (HTMLAnchorElement.prototype as unknown as Record<string, unknown>)[name];
  }
  // jsdom has no FontFaceSet, so the font test installs one. Anything left
  // behind would make the next file's rows measure themselves twice.
  delete (document as unknown as Record<string, unknown>).fonts;
});

function view(current: boolean) {
  return (
    <MemoryRouter>
      <ThreadLink thread={thread} current={current} />
    </MemoryRouter>
  );
}

function renderLink(current = false) {
  return render(view(current));
}

/** The link, whatever it is called this instant. */
function link() {
  return screen.getByRole('link', { name: thread.title });
}

describe('ThreadLink', () => {
  it('har hele tittelen som tilgjengelig navn, uansett hva som vises', () => {
    // The cut is visual. A screen reader reads the DOM, and the DOM has the
    // whole question.
    renderLink();

    expect(screen.getByRole('link', { name: thread.title })).toBeTruthy();
  });

  it('gir ingen tooltip når tittelen får plass', () => {
    // A tooltip on a row that is not cut off promises the reader something
    // they can already see — and is read as a description after the name they
    // have just heard.
    renderLink();

    expect(screen.getByRole('link', { name: thread.title }).getAttribute('title')).toBeNull();
  });

  it('gir hele tittelen som tooltip når to linjer ikke holder', () => {
    withHeights(72, 44);

    renderLink();

    expect(screen.getByRole('link', { name: thread.title }).getAttribute('title')).toBe(
      thread.title,
    );
  });

  it('teller ikke en halv piksel som avkorting', () => {
    // Sub-pixel line heights round the two boxes apart on a row where
    // nothing is hidden.
    withHeights(44.5, 44);

    renderLink();

    expect(screen.getByRole('link', { name: thread.title }).getAttribute('title')).toBeNull();
  });

  it('merker den åpne tråden, og bare den', () => {
    renderLink(true);
    expect(screen.getByRole('link', { name: thread.title }).getAttribute('aria-current')).toBe(
      'page',
    );

    renderLink(false);
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('måler på nytt når raden blir den åpne', () => {
    /*
     * The open row is drawn semibold, which makes the same title wider
     * without changing the box it is drawn in — so `ResizeObserver` never
     * fires, and the row that has just been pushed onto a third line keeps
     * saying it fits. KA CC on #80.
     */
    withHeights(44, 44);
    const { rerender } = renderLink(false);
    expect(link().getAttribute('title')).toBeNull();

    withHeights(72, 44);
    rerender(view(true));

    expect(link().getAttribute('title')).toBe(thread.title);
  });

  it('måler på nytt når skriften er lastet', async () => {
    /*
     * Inter comes from altinncdn, and the first measurement happens in the
     * fallback face. Its metrics are not Inter's, so a row that fits before
     * the font arrives can be cut off after it.
     */
    let arrive = () => {};
    const ready = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });

    withHeights(44, 44);
    renderLink();
    expect(link().getAttribute('title')).toBeNull();

    withHeights(72, 44);
    await act(async () => {
      arrive();
      await ready;
    });

    expect(link().getAttribute('title')).toBe(thread.title);
  });
});
