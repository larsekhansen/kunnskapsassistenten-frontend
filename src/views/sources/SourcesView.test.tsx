import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { excerptDomId, type AnswerSources, type SourceDocument } from '../../model';
import { SourcesView } from './SourcesView';

/**
 * jsdom does no layout and implements no scrolling, so the method the view
 * calls on arrival does not exist. Installing a no-op is what lets the focus
 * half of that pair be tested at all.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function documentWith(id: string, title: string, numbers: number[]): SourceDocument {
  return {
    id,
    title,
    documentType: 'Årsrapport',
    organisation: 'Nasjonal kommunikasjonsmyndighet',
    year: 2023,
    excerpts: numbers.map((number) => ({
      id: `${id}-utdrag-${number}`,
      citationNumber: number,
      relevance: 'high' as const,
      heading: `Avsnitt ${number} i ${title}`,
      text: `Sitat nummer ${number} fra ${title}.`,
    })),
  };
}

/** Two answers that both number their excerpts from 1 — the case that broke. */
const firstAnswer: AnswerSources = {
  messageId: 'svar-1',
  status: 'complete',
  documents: [documentWith('doc-a', 'Årsrapport 2021', [1, 2])],
};

const secondAnswer: AnswerSources = {
  messageId: 'svar-2',
  status: 'complete',
  documents: [documentWith('doc-b', 'Tildelingsbrev 2024', [1, 2])],
};

/**
 * The view plus a `[1]` marker of the kind the answer draws, so the way back
 * has something real to go back to.
 *
 * The marker carries the same `href` the main column gives it; that href is
 * the whole contract between the two, and it is what the view searches for.
 */
function Harness({
  answers,
  citation,
}: {
  answers?: readonly AnswerSources[];
  citation?: { number: number; nonce: number; messageId?: string };
}) {
  return (
    <>
      <a href={`#${excerptDomId(1)}`} data-testid="markoer">
        [1]
      </a>
      <SourcesView
        answers={answers}
        activeCitationNumber={citation?.number}
        activeCitationNonce={citation?.nonce}
        activeCitationMessageId={citation?.messageId}
      />
    </>
  );
}

/** Clicking a marker is what the reader does; this is that, end to end. */
function ClickableHarness({ answers }: { answers: readonly AnswerSources[] }) {
  const [citation, setCitation] = useState<
    { number: number; nonce: number; messageId?: string } | undefined
  >(undefined);

  return (
    <>
      <a
        href={`#${excerptDomId(1)}`}
        data-testid="markoer"
        onClick={(event) => {
          event.preventDefault();
          setCitation({ number: 1, nonce: 1, messageId: 'svar-1' });
        }}
      >
        [1]
      </a>
      <SourcesView
        answers={answers}
        activeCitationNumber={citation?.number}
        activeCitationNonce={citation?.nonce}
        activeCitationMessageId={citation?.messageId}
      />
    </>
  );
}

describe('SourcesView, one answer at a time', () => {
  it('shows the newest answer and says which one it is', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(screen.getByText('Kilder til svar 2 av 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tildelingsbrev 2024' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Årsrapport 2021' })).toBeNull();
  });

  it('draws no switcher for a thread with one answer', () => {
    render(<Harness answers={[secondAnswer]} />);

    expect(screen.queryByText(/Kilder til svar/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forrige svar' })).toBeNull();
  });

  it('steps back to the previous answer', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(screen.getByText('Kilder til svar 1 av 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
  });

  it('stops at the ends without dropping the keyboard', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const previous = screen.getByRole('button', { name: 'Forrige svar' });
    fireEvent.click(previous);
    fireEvent.click(previous);

    // aria-disabled, not disabled: the button keeps its tab stop, so pressing
    // it once too often does not send focus to <body>.
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(previous.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Kilder til svar 1 av 2')).toBeTruthy();
  });

  it('opens the excerpt of the answer the marker sits in, not the newest', () => {
    // The bug: [1] in the first answer used to open the SECOND answer's
    // excerpt 1, because both are numbered 1 and the panel held one list.
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );

    expect(screen.getByText('Kilder til svar 1 av 2')).toBeTruthy();
    expect(screen.getByText('Sitat nummer 1 fra Årsrapport 2021.')).toBeTruthy();
    expect(screen.queryByText('Sitat nummer 1 fra Tildelingsbrev 2024.')).toBeNull();
  });

  it('follows a new answer when one arrives', () => {
    const { rerender } = render(<Harness answers={[firstAnswer]} />);

    rerender(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(screen.getByText('Kilder til svar 2 av 2')).toBeTruthy();
  });

  it('follows a new answer even after the reader has stepped back', () => {
    const { rerender } = render(<Harness answers={[firstAnswer, secondAnswer]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));
    expect(screen.getByText('Kilder til svar 1 av 2')).toBeTruthy();

    rerender(
      <Harness answers={[firstAnswer, secondAnswer, { ...firstAnswer, messageId: 's3' }]} />,
    );

    expect(screen.getByText('Kilder til svar 3 av 3')).toBeTruthy();
  });

  it('keeps the switcher when the answer on screen has no sources', () => {
    // Otherwise a stopped answer would trap the reader: nothing to see, and no
    // way back to the answer that did have sources.
    render(
      <Harness
        answers={[firstAnswer, { messageId: 'svar-2', status: 'aborted', documents: [] }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Forrige svar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));
    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
  });
});

describe('SourcesView, empty states', () => {
  it('says a stopped answer was stopped', () => {
    render(<Harness answers={[{ messageId: 'svar-1', status: 'aborted', documents: [] }]} />);

    expect(screen.getByText('Svaret ble avbrutt før kildene kom')).toBeTruthy();
    expect(screen.queryByText(/når du har stilt et spørsmål/)).toBeNull();
  });

  it('says nothing has been asked only when nothing has been asked', () => {
    render(<Harness answers={[]} />);

    expect(screen.getByText('Ingen kilder ennå')).toBeTruthy();
  });

  it('draws the skeleton while an answer is still being written', () => {
    render(<Harness answers={[{ messageId: 'svar-1', status: 'streaming', documents: [] }]} />);

    expect(screen.getByText('Henter kilder …')).toBeTruthy();
  });
});

describe('SourcesView, the way back to the answer', () => {
  it('moves focus back to the marker the reader came from', async () => {
    render(<ClickableHarness answers={[firstAnswer, secondAnswer]} />);
    const marker = screen.getByTestId('markoer');

    // A click focuses the link, which is how the view knows where to return.
    marker.focus();
    fireEvent.click(marker);

    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));

    fireEvent.click(screen.getByRole('button', { name: 'Tilbake til svaret' }));
    expect(document.activeElement).toBe(marker);
  });

  it('returns on Escape from inside the excerpt', async () => {
    render(<ClickableHarness answers={[firstAnswer, secondAnswer]} />);
    const marker = screen.getByTestId('markoer');

    marker.focus();
    fireEvent.click(marker);

    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));

    fireEvent.keyDown(excerpt, { key: 'Escape' });
    expect(document.activeElement).toBe(marker);
  });

  it('offers no way back from an excerpt nobody was sent to', () => {
    // Opened by hand, so there is nowhere to go back to, and a control that
    // does nothing is worse than no control.
    render(<Harness answers={[firstAnswer]} />);

    expect(screen.queryByRole('button', { name: 'Tilbake til svaret' })).toBeNull();
  });
});

describe('SourcesView, the shell as it is today', () => {
  it('keeps the single-list prop working unchanged', () => {
    render(<SourcesView documents={firstAnswer.documents} />);

    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
    expect(screen.queryByText(/Kilder til svar/)).toBeNull();
  });

  it('still reads an empty list as «nothing asked yet»', () => {
    render(<SourcesView documents={[]} />);

    expect(screen.getByText('Ingen kilder ennå')).toBeTruthy();
  });

  it('still reads no list at all as loading', () => {
    render(<SourcesView />);

    expect(screen.getByText('Henter kilder …')).toBeTruthy();
  });
});
