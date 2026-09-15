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

/**
 * The visible counter, which is `aria-hidden` and therefore has no role to
 * query it by. Its spoken twin is the `role="status"` region, so a plain
 * `getByText` would find both.
 */
function visibleCounter(): string | undefined {
  return document.querySelector('.sources-answer-switcher__count')?.textContent ?? undefined;
}

describe('SourcesView, one answer at a time', () => {
  it('shows the newest answer and says which one it is', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
    expect(screen.getByRole('heading', { name: 'Tildelingsbrev 2024' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Årsrapport 2021' })).toBeNull();
  });

  it('draws no switcher for a thread with one answer', () => {
    render(<Harness answers={[secondAnswer]} />);

    expect(visibleCounter()).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Forrige svar' })).toBeNull();
  });

  it('steps back to the previous answer', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
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
    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
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

    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
    expect(screen.getByText('Sitat nummer 1 fra Årsrapport 2021.')).toBeTruthy();
    expect(screen.queryByText('Sitat nummer 1 fra Tildelingsbrev 2024.')).toBeNull();
  });

  it('follows a new answer when one arrives', () => {
    const { rerender } = render(<Harness answers={[firstAnswer]} />);

    rerender(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
  });

  it('follows a new answer even after the reader has stepped back', () => {
    const { rerender } = render(<Harness answers={[firstAnswer, secondAnswer]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));
    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');

    rerender(
      <Harness answers={[firstAnswer, secondAnswer, { ...firstAnswer, messageId: 's3' }]} />,
    );

    expect(visibleCounter()).toBe('Kilder til svar 3 av 3');
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

describe('SourcesView, the active marker stays with its answer', () => {
  /** `data-active` is the blue band; the excerpt the reader was sent to. */
  function activeExcerptText(): string | undefined {
    return document.querySelector('[data-active="true"]')?.textContent ?? undefined;
  }

  it('leaves the highlight behind when the reader steps to another answer', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Årsrapport 2021.');

    // Both answers have an excerpt 1. Comparing only the number used to carry
    // the band — and «Tilbake til svaret» — along to an excerpt nobody had
    // been sent to.
    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
    // A closed excerpt has its quote twice: in the preview and inside the
    // collapsed Details. Both belong to the second answer, which is the point.
    expect(screen.getAllByText('Sitat nummer 1 fra Tildelingsbrev 2024.').length).toBeGreaterThan(
      0,
    );
    expect(activeExcerptText()).toBeUndefined();
  });

  it('offers no way back from the answer the reader stepped to', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tilbake til svaret' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));

    expect(screen.queryByRole('button', { name: 'Tilbake til svaret' })).toBeNull();
  });

  it('gives the highlight back when the reader steps home again', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Årsrapport 2021.');
    expect(screen.getByRole('button', { name: 'Tilbake til svaret' })).toBeTruthy();
  });

  it('stays behind even when nobody said which answer the marker was in', () => {
    // The state between #39 and the chat view widening onSelectSource: several
    // answers, no message id on the citation. The marker is resolved against
    // the answer on screen, and the highlight has to stay with that answer all
    // the same.
    render(<Harness answers={[firstAnswer, secondAnswer]} citation={{ number: 1, nonce: 1 }} />);

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Tildelingsbrev 2024.');

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(activeExcerptText()).toBeUndefined();
  });
});

describe('SourcesView, the live region that says which answer', () => {
  /** `<output>` is role=status, which is a polite live region. */
  function liveRegion(): HTMLElement {
    return screen.getByRole('status');
  }

  it('is in the document before there is anything to announce', () => {
    // A live region mounted together with its text is not announced, and the
    // second answer arriving is the one moment it matters (KA CC on PR #36).
    render(<Harness answers={[firstAnswer]} />);

    const region = liveRegion();
    expect(region).toBeTruthy();
    expect(region.textContent).toBe('');
  });

  it('is the same element once the second answer arrives', () => {
    const { rerender } = render(<Harness answers={[firstAnswer]} />);
    const before = liveRegion();

    rerender(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(liveRegion()).toBe(before);
    expect(before.textContent).toBe('Kilder til svar 2 av 2');
  });

  it('says the same thing as the visible row, and only says it once', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const visible = document.querySelector('.sources-answer-switcher__count') as HTMLElement;
    expect(visible.getAttribute('aria-hidden')).toBe('true');
    expect(liveRegion().textContent).toBe(visible.textContent);
  });

  it('follows the reader stepping between answers', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(liveRegion().textContent).toBe('Kilder til svar 1 av 2');
  });
});

describe('SourcesView, the panel head that stays put', () => {
  function head(): HTMLElement | null {
    return document.querySelector('.sources-head');
  }

  it('holds the answer selector and the search, so one box can be pinned', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const box = head();
    expect(box).toBeTruthy();
    expect(box?.querySelector('.sources-answer-switcher')).toBeTruthy();
    expect(box?.querySelector('.sources-search')).toBeTruthy();
  });

  it('leaves the Kudos line outside, where it scrolls with the excerpts', () => {
    // Everything pinned is taken off the reading area for as long as the
    // reader scrolls; this line never changes and says something about the
    // excerpts below it.
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const line = screen.getByText(/All tekst er sitater fra dokumentene fra Kudos/);
    expect(line).toBeTruthy();
    expect(head()?.contains(line)).toBe(false);
  });

  it('keeps the search field described by the line that moved', () => {
    // `aria-describedby` resolves by id, not by position, and that is the only
    // reason the line may sit somewhere else at all.
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const field = screen.getByRole('searchbox');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(
      /All tekst er sitater/,
    );
  });

  it('draws no head on a page with nothing to pin', () => {
    // `:empty` hides it, so the border does not appear on the untouched front
    // page. The box is still rendered, so it does not pop in and out.
    render(<Harness answers={[]} />);

    expect(head()?.children.length).toBe(0);
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
    expect(visibleCounter()).toBeUndefined();
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
