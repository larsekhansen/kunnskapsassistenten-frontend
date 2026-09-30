import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { emptyFilterSelection, type FilterSelection, type Thread } from '../../model';
import { resetViewport, setViewportWidth } from '../../test/matchMedia';
import { ThreadsView } from '../../views/threads';
import { COMPOSER_ID } from '../ids';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { useFilterSelection } from '../useFilterSelection';
import { useLayout } from '../useLayout';
import type { Layout } from '../viewModel';
import { ChatSlotView } from './ChatSlotView';

/**
 * «Ny tråd» after a conversation started on this page (Simen's issue 114).
 *
 * The thread list and the chat slot side by side under the real provider,
 * which is how the shell mounts them: the link is the thread list's own, the
 * filter and the layout are the provider's, and the conversation is the chat
 * slot's. Only the shell's chrome is left out.
 *
 * The answer is stopped rather than awaited. It does not finish in jsdom,
 * and what these tests are about — which conversation is on screen after the
 * click — is settled the moment the question is sent: that is when the
 * thread is started and given its address.
 */

function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

/** What the provider holds, read out so a test can check it after a click. */
const seen: { selection?: FilterSelection; layout?: Layout } = {};
const control: {
  setSelection?: (selection: FilterSelection) => void;
  setCollapsed?: ReturnType<typeof useLayout>['setCollapsed'];
} = {};

function Probe() {
  const { chosen, selection, setSelection } = useFilterSelection();
  const { layout, setCollapsed } = useLayout();
  useEffect(() => {
    seen.selection = chosen ?? selection;
    seen.layout = layout;
    control.setSelection = setSelection;
    control.setCollapsed = setCollapsed;
  });
  return null;
}

const now = new Date().toISOString();
const listed: Thread[] = [{ id: 'eldre', title: 'Eldre tråd', createdAt: now, updatedAt: now }];

function show(threads: Thread[] = listed) {
  return render(
    <MemoryRouter>
      <LayoutProvider>
        <Probe />
        <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={threads} />
        <Scroll>
          <ChatSlotView />
        </Scroll>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const field = () => screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
const newThread = () => screen.getByRole('link', { name: /Ny tråd/ });

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

function stop() {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt genereringen' }));
  });
}

beforeEach(() => {
  resetMockThreads();
  setActiveCorpusKey('mock');
  window.history.replaceState(null, '', '/');
});

afterEach(() => resetViewport());

describe('«Ny tråd» after a conversation started on this page', () => {
  it('gives the thread its address at once, and then an empty conversation', () => {
    show();

    ask('Hva står i årsrapporten?');
    // The address names the thread as soon as it has an id — before any
    // answer, and without the reader going out of the thread and back.
    expect(window.location.pathname).toMatch(/^\/threads\/.+/u);
    expect(screen.getAllByText('Hva står i årsrapporten?').length).toBeGreaterThan(0);
    stop();

    act(() => fireEvent.click(newThread()));

    // To the router the page was `/` all along; the click still has to give
    // a new conversation, not the one it was already showing.
    expect(screen.queryAllByText('Hva står i årsrapporten?')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: /Hva lurer du på\?/u })).toBeTruthy();
  });

  it('empties the filter', () => {
    show();
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));
    expect(seen.selection?.documentType).toEqual(['Årsrapport']);

    ask('Hva står i årsrapporten?');
    stop();
    act(() => fireEvent.click(newThread()));

    expect(seen.selection).toEqual(emptyFilterSelection);
  });

  it('puts the keyboard in the compose field of the new conversation', () => {
    show();
    ask('Hva står i årsrapporten?');
    stop();

    // Where a real click leaves it: on the link. «Avbryt» hands focus to the
    // compose field, and without this the assertion below would pass on that
    // alone.
    act(() => newThread().focus());
    expect(document.activeElement).toBe(newThread());

    act(() => fireEvent.click(newThread()));

    expect(document.activeElement?.id).toBe(COMPOSER_ID);
    expect(field().textContent).toBe('');
  });

  it('closes the drawer it stood in, below the drawer breakpoint', () => {
    setViewportWidth(768);
    show();
    act(() => control.setCollapsed?.('primary-sidebar', false));
    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(false);

    act(() => fireEvent.click(newThread()));

    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(true);
  });

  it('leaves the panel open beside the answer column', () => {
    show();
    act(() => control.setCollapsed?.('primary-sidebar', false));

    act(() => fireEvent.click(newThread()));

    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(false);
  });

  it('changes nothing on this page for a click that opens a new tab', () => {
    show();
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));

    act(() => fireEvent.click(newThread(), { ctrlKey: true }));

    expect(seen.selection?.documentType).toEqual(['Årsrapport']);
  });

  /*
   * Above an empty list the way to a new thread is the empty state's own
   * (Simen's issue 82), and it is the same action: the same link, and the same
   * click.
   */
  it('is the same action from the empty state, as «Start din første tråd»', () => {
    show([]);
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));
    const start = screen.getByRole('link', { name: /Start din første tråd/ });
    act(() => start.focus());

    act(() => fireEvent.click(start));

    expect(seen.selection).toEqual(emptyFilterSelection);
    expect(document.activeElement?.id).toBe(COMPOSER_ID);
  });
});
