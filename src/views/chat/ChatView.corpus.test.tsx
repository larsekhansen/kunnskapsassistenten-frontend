import { render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion } from '../../model';
import { ChatView } from './ChatView';
import { GENERAL_KICKSTARTERS, KICKSTARTERS } from './text';

/**
 * Forslagene på tomtilstanden, sett gjennom viewet (brukerblikk 5, funn 2).
 *
 * `kickstartersFor` er testet for seg. Dette er koblingen: at viewet faktisk
 * leser det aktive korpuset, og at lista bytter når korpuset bytter — uten
 * omlasting, som er hele poenget med at `useCorpus` leser en ekstern lagring
 * under render.
 *
 * Hooken står inn for her av samme grunn som i `FiltersView.corpus.test.tsx`:
 * den leser en modul-lagring som er låst ved oppstart fra miljøet, så begge
 * tilstandene finnes ikke i én kjøring uten dette.
 */
const corpus = vi.hoisted(() => ({ active: 'kudos-pilot' as string | undefined }));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: [],
    active: corpus.active,
    option: undefined,
    choosable: false,
    set: vi.fn(),
  }),
}));

/** En klient som aldri blir spurt: tomtilstanden stiller ingen spørsmål. */
const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('ikke spurt');
  },
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: (question) => threadFromQuestion(question) }}>
              <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
                {children}
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

const shown = () => screen.getAllByRole('button').map((button) => button.textContent?.trim() ?? '');

describe('ChatView og forslagene per korpus', () => {
  it('viser Kudos-spørsmålene over Kudos-pilot', () => {
    corpus.active = 'kudos-pilot';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of KICKSTARTERS) expect(shown()).toContain(question);
  });

  it('viser de generelle spørsmålene over Wikipedia-korpuset', () => {
    corpus.active = 'norquad-docs';
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    for (const question of GENERAL_KICKSTARTERS) expect(shown()).toContain(question);
    // Og ingen av Kudos-spørsmålene, som er selve funnet.
    for (const question of KICKSTARTERS) expect(shown()).not.toContain(question);
  });

  it('bytter liste når korpuset byttes, uten omlasting', () => {
    /*
     * Viewet leser korpuset under render, så en ny render er alt som skal til.
     * Cachet det lista ved montering, ville en leser som byttet korpus sittet
     * igjen med forslagene fra det forrige til hen lastet sida på nytt.
     */
    corpus.active = 'kudos-pilot';
    const { rerender } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );
    expect(shown()).toContain(KICKSTARTERS[0]);

    corpus.active = 'norquad-docs';
    rerender(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(shown()).toContain(GENERAL_KICKSTARTERS[0]);
    expect(shown()).not.toContain(KICKSTARTERS[0]);
  });
});
