import { render, screen } from '@testing-library/react';
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
});

function renderLink(current = false) {
  return render(
    <MemoryRouter>
      <ThreadLink thread={thread} current={current} />
    </MemoryRouter>,
  );
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
});
