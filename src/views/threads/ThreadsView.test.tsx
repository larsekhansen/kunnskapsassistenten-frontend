import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Thread } from '../../model';
import { ThreadsView } from './ThreadsView';

/*
 * A client whose fetch never settles, so the loading state can be observed.
 * The mock client resolves within the same act() as the render, which loads
 * the list before an assertion can see it.
 */
/*
 * Skeleton calls document.getAnimations through Designsystemet's
 * useSynchronizedAnimation, and jsdom has no Web Animations. Local to this
 * file: only the loading state renders a Skeleton.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/*
 * Only the client is replaced. `importOriginal` keeps the rest of the module,
 * which the shell's corpus store lives in — a bare factory drops
 * `subscribeToCorpus` and every test in the file fails on an import rather
 * than on what it is about.
 */
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  createChatClient: () => ({ listThreads: () => new Promise(() => {}) }),
}));

const now = new Date().toISOString();
const threads: Thread[] = [
  { id: 'a', title: 'Måloppnåelse i Nkom', createdAt: now, updatedAt: now },
  { id: 'b', title: 'Årsrapport for Digdir', createdAt: now, updatedAt: now },
];

function renderView(given: Thread[] | undefined, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={given} />
    </MemoryRouter>,
  );
}

/**
 * The search text itself is not driven here: Designsystemet's Search.Input
 * does not deliver `onInput` under jsdom, measured with a bare probe. What
 * the count says for a given query is verified in the browser instead. These
 * tests cover the part that broke — whether the region exists at all.
 */
describe('ThreadsView', () => {
  it('has the hit count region in the DOM before there is a hit count', () => {
    const { container } = renderView(threads);

    // A live region only announces text that appears inside a region that
    // already existed, so the region may not be mounted with its text.
    const status = container.querySelector('output.threads-view__search-status');
    expect(status).not.toBeNull();
    expect(status?.textContent).toBe('');
  });

  it('keeps the same region node across renders', () => {
    const { container, rerender } = renderView(threads);
    const before = container.querySelector('output.threads-view__search-status');

    rerender(
      <MemoryRouter>
        <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={[threads[0]]} />
      </MemoryRouter>,
    );

    expect(container.querySelector('output.threads-view__search-status')).toBe(before);
  });

  it('marks the list busy and says so while the threads are loading', () => {
    const { container } = renderView(undefined);

    expect(container.querySelector('.threads-view')?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Henter tråder')).toBeTruthy();
  });

  it('keeps the loading region in the DOM once the threads are there', () => {
    const { container } = renderView(threads);

    expect(container.querySelector('.threads-view')?.getAttribute('aria-busy')).toBeNull();
    expect(container.querySelector('output.ds-sr-only')).not.toBeNull();
  });

  it('does not mark «Ny tråd» as the current page', () => {
    renderView(threads, '/');

    // It is an action, not a place. The thread rows are the places.
    expect(screen.getByRole('link', { name: /Ny tråd/ }).getAttribute('aria-current')).toBeNull();
  });
});
