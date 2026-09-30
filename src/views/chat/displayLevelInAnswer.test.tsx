import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { ChatView } from './ChatView';
import { getDisplayLevel, resetDisplayLevel, setDisplayLevel } from './displayLevel';

/*
 * Designsystemets Skeleton spør etter document.getAnimations, som jsdom ikke
 * har. Det tomme svarkortet tegner en mens det første tegnet er på vei.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  thinkingSteps: [
    { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.', durationMs: 2000 },
    {
      id: 's2',
      kind: 'search',
      label: 'Jeg søker i årsrapportene.',
      detail: 'Fant 10 biter i 3 dokumenter.',
      queries: ['Nkom måloppnåelse 2025'],
      durationMs: 2000,
    },
  ],
  retrieval: { hitCount: 10, documentCount: 3, keywords: ['måloppnåelse', 'Nkom'] },
  thoughtMs: 4000,
  status: 'complete',
};

/** Søket eies av `MessageList`; disse testene handler om noe annet. */
const utenSok = {
  searchOpen: false,
  searchQuery: '',
  onSearchQueryChange: () => {},
  onToggleSearch: () => {},
  onCloseSearch: () => {},
  searchLabel: 'Søk i svaret',
};

function showAnswer() {
  return render(
    <ol>
      <AnswerMessage
        {...utenSok}
        canScrollToBottom={false}
        message={answer}
        onRegenerate={() => {}}
        onScrollToBottom={() => {}}
        onSelectSource={() => {}}
      />
    </ol>,
  );
}

const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('ikke spurt');
  },
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

function Shell({ children, at }: { children: ReactNode; at: string }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter initialEntries={[at]}>
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

describe('visningsnivået i svaret', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
  });

  it('viser «Fremgangsmåte» og stegene, uten det tekniske, på standard', () => {
    /*
     * Simens issue 88: stegene sier hva assistenten prøver å gjøre, og det er
     * det som blir stående. Søkestrengen, treffene og tiden er maskineri, og
     * en «bit» er ikke noe en leser har sett.
     */
    showAnswer();

    expect(screen.getByText('Fremgangsmåte')).toBeTruthy();
    expect(screen.getByText('Jeg søker i årsrapportene.')).toBeTruthy();
    // Det ene tallet som blir igjen: dokumentene, som også står i kildepanelet.
    expect(screen.getByText('Svaret bygger på 3 dokumenter.')).toBeTruthy();

    expect(screen.queryByText('Tenkte i 4 sekunder')).toBeNull();
    expect(screen.queryByText('10 treff i 3 dokumenter')).toBeNull();
    expect(screen.queryByText('Nkom måloppnåelse 2025')).toBeNull();
    expect(screen.queryByText('Fant 10 biter i 3 dokumenter.')).toBeNull();
  });

  it('viser tenkepanelet og treffene på detaljert', () => {
    setDisplayLevel('detaljert');
    showAnswer();

    expect(screen.getByText('Tenkte i 4 sekunder')).toBeTruthy();
    expect(screen.getByText('10 treff i 3 dokumenter')).toBeTruthy();
    expect(screen.getByText('Nkom måloppnåelse 2025')).toBeTruthy();
  });
});

describe('den skjulte innstillingsmenyen', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
  });

  it('finnes ikke uten adressen', () => {
    // «Standard er standard. Uten adressen ser ingen at menyen finnes.»
    render(
      <Shell at="/">
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Innstillinger')).toBeNull();
  });

  it('åpnes av #innstillinger og skifter nivå med én gang', () => {
    render(
      <Shell at="/#innstillinger">
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.getByText('Innstillinger')).toBeTruthy();
    const detailed = screen.getByRole('radio', { name: /Detaljert/u });
    expect((screen.getByRole('radio', { name: /Standard/u }) as HTMLInputElement).checked).toBe(
      true,
    );

    fireEvent.click(detailed);

    expect(getDisplayLevel()).toBe('detaljert');
    expect((detailed as HTMLInputElement).checked).toBe(true);
  });
});
