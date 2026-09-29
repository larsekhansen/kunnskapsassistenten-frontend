import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../api/chatClient';
import { emptyFilterSelection, type FilterSelection } from '../model';
import { askedSelection } from './filterContext';

/**
 * A field where every value is ticked is not sent with the question.
 *
 * KA CC measured the reason through the BFF: all 457 organisations went with
 * the question, and the answer ten minutes later was a 400. The pure function
 * first, then the whole app from «Velg alle» to what the client is asked.
 */
const asked = vi.hoisted(() => ({ params: [] as AskParams[] }));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    createChatClient: (): ChatClient => {
      const inner = actual.createChatClient();
      return {
        ask: (params) => {
          asked.params.push(params);
          return inner.ask(params);
        },
        listThreads: (signal) => inner.listThreads(signal),
        getThread: (id, signal) => inner.getThread(id, signal),
        listFacets: (signal, selection) => inner.listFacets(signal, selection),
        openThread: (thread, certainty) => inner.openThread?.(thread, certainty),
        createThread: (thread, signal) =>
          inner.createThread?.(thread, signal) ?? Promise.resolve(undefined),
      };
    },
  };
});

const { App } = await import('../App');
const { setActiveCorpusKey } = await import('../api');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

describe('askedSelection', () => {
  const chosen: FilterSelection = {
    documentType: ['Årsrapport', 'Evaluering'],
    organisation: ['Nkom'],
    year: ['2024'],
  };

  it('leaves out a field where every value it has is ticked', () => {
    expect(
      askedSelection(chosen, {
        documentType: ['Evaluering', 'Årsrapport'],
        year: ['2023', '2024'],
      }),
    ).toEqual({ ...chosen, documentType: [] });
  });

  it('keeps a field that is one value short', () => {
    expect(
      askedSelection(chosen, { documentType: ['Årsrapport', 'Evaluering', 'Instruks'] }),
    ).toEqual(chosen);
  });

  it('keeps a field the panel has not been given', () => {
    expect(askedSelection(chosen, {})).toEqual(chosen);
    expect(askedSelection(chosen, { organisation: [] })).toEqual(chosen);
  });

  it('compares value by value, so a stale tick cannot make up for a missing one', () => {
    // Two ticked, two known — but not the same two.
    expect(askedSelection(chosen, { documentType: ['Årsrapport', 'Instruks'] })).toEqual(chosen);
  });

  it('gives back what it was given when nothing is left out', () => {
    expect(askedSelection(chosen, { year: ['2023', '2024'] })).toBe(chosen);
  });
});

describe('«Velg alle» and the question', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MOCK_SPEED', 'fast');
    setActiveCorpusKey('mock');
    asked.params.length = 0;
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('asks without the field, and says nothing about it over the answer', async () => {
    window.history.replaceState(null, '', '/');
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole('heading', { name: 'Filtrering' });
    const panel = heading.closest('.sidebar-content');
    if (!(panel instanceof HTMLElement)) throw new Error('Fant ikke filterpanelet');

    fireEvent.click(
      await within(panel).findByRole(
        'button',
        { name: 'Velg alle dokumenttyper' },
        { timeout: 5000 },
      ),
    );
    await within(panel).findByText(/^Alle \d+ valgt, altså ingen avgrensning$/);

    const field = screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
    fireEvent.change(field, { target: { value: 'Hva rapporterer Nkom?' } });
    act(() => screen.getByRole('button', { name: 'Send spørsmålet' }).click());

    await waitFor(() => expect(asked.params.length).toBe(1));
    expect(asked.params[0]?.filters).toEqual(emptyFilterSelection);
    await screen.findByRole('button', { name: 'Kopier svaret' }, { timeout: 10000 });
    expect(document.querySelector('.ka-filter-summary')).toBeNull();
    // A whole mock answer, at the speed the suite uses.
  }, 30_000);
});
