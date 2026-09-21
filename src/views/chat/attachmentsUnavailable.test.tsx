import { fireEvent, render, screen } from '@testing-library/react';
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
import { ATTACH_LABEL, uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Skrivefeltet der tjenesten ikke har opplasting i det hele tatt.
 *
 * Egen fil fordi `vi.mock` heises til toppen av fila den står i, og resten av
 * vedleggstestene skal kjøre mot den ekte mock-klienten. Samme oppdeling som
 * `FiltersView.corpus.test.tsx`.
 *
 * `unavailable` er kjent før noen velger en fil — klienten vet at det ikke
 * finnes noe endepunkt (API-bestilling A3) — så feltet kan si det ærlig i
 * stedet for å ta imot en fil og avvise den et øyeblikk senere.
 */
const upload = vi.hoisted(() => ({ calls: 0 }));

vi.mock('../../layout/useUserDocuments', () => ({
  useUserDocuments: () => ({
    documents: [],
    ready: [],
    uploading: false,
    unavailable: 'unavailable' as const,
    upload: async () => {
      upload.calls += 1;
      throw new Error('skal ikke kalles');
    },
    remove: async () => {},
  }),
}));

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

describe('vedlegg der tjenesten ikke har opplasting', () => {
  it('sier det ærlig i stedet for å åpne en velger som ikke fører noe sted', () => {
    /*
     * Knappen står — en kontroll som kommer er verdt å vite om — men den
     * åpner ingen filvelger. Setningen er den samme som en avvist fil får, så
     * leseren leser én slags setning om vedlegg og ikke to.
     */
    upload.calls = 0;
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    fireEvent.click(screen.getByRole('button', { name: ATTACH_LABEL }));

    expect(screen.getByText(uploadErrorText('unavailable'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
    expect(upload.calls).toBe(0);
  });
});
