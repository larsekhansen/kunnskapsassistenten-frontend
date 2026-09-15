import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';

/**
 * The routes, and what an address that leads nowhere draws.
 *
 * Reise 14 in design/brukerreiser-2026-09-15.md, punkt 10 on the ranked list:
 * `/tull` used to render a completely blank page, because `Routes` renders
 * null when nothing matches and the shell sits under it as a layout route. A
 * broken link has to say that it is broken, and it has to say it inside the
 * shell — with the landmarks, the skip link and the thread list a reader
 * needs to get somewhere that exists.
 */
/*
 * Two things jsdom does not have, and the whole app needs both: the chat view
 * watches its own height with a ResizeObserver, and Designsystemet asks the
 * document for its running animations to keep them in step. Neither has
 * anything to do with what is under test — a no-op and an empty list are the
 * right answers in a document that never paints.
 *
 * Local to this file rather than in src/test/setup.ts: this is the only test
 * that mounts every view at once, and a global stub would quietly hide a real
 * missing guard from the tests that mount one view at a time.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

function openAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('en adresse som ikke finnes', () => {
  it('tegner skallet med «Siden finnes ikke»', () => {
    openAt('/tull');

    expect(screen.getByRole('heading', { level: 2, name: 'Siden finnes ikke' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Gå til forsiden' })).toBeDefined();

    // The shell, not a bare page: the landmarks and the skip link are the
    // whole point of drawing this inside it.
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Tråder og filter' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Hopp til hovedinnhold' })).toBeDefined();
  });

  it('lar være å tegne en samtale under beskjeden', () => {
    openAt('/tull');

    // «Siden finnes ikke» with a working compose field under it would be two
    // answers to the same question, and the wrong one is the bigger.
    expect(screen.queryByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' })).toBeNull();
  });

  it('har fortsatt sidens nivå 1', () => {
    openAt('/tull');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kunnskapsassistenten');
  });

  it('lar kildepanelet si at det ikke er noen kilder, ikke at de er på vei', async () => {
    openAt('/tull');

    // The chat view is what reports sources, and this page has none, so
    // nobody used to say anything at all — and «nothing said» is the loading
    // state. Measured by KA CC: «Henter kilder …» with twelve skeletons,
    // forever. See src/layout/useNoAnswers.ts.
    expect(await screen.findByText('Ingen kilder ennå')).toBeDefined();
    expect(screen.queryByText('Henter kilder …')).toBeNull();
  });
});

describe('en tråd som ikke finnes', () => {
  it('sier fra i stedet for å tegne en tom samtale', async () => {
    openAt('/threads/finnes-ikke');

    // The client has to answer first: «not read yet» and «no such thread» look
    // the same until it does.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Fant ikke tråden' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Gå til forsiden' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' })).toBeNull();
  });

  it('lar kildepanelet si det samme som oppsamlingsruta gjør', async () => {
    openAt('/threads/finnes-ikke');
    await screen.findByRole('heading', { level: 2, name: 'Fant ikke tråden' });

    expect(screen.getByText('Ingen kilder ennå')).toBeDefined();
    expect(screen.queryByText('Henter kilder …')).toBeNull();
  });
});
