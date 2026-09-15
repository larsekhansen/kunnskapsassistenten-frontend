import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SourceDocument } from '../../model';
import { DocumentsList } from './DocumentsList';

/**
 * Seven documents, as the `active` variant in Figma draws. The mock corpus
 * has three, which is one fewer than «Vis flere dokumenter» needs to appear
 * at all, so the case is made here rather than in `src/api/mock/`.
 */
const documents: SourceDocument[] = Array.from({ length: 7 }, (_, index) => ({
  id: `doc-${index}`,
  title: `Årsrapport Nasjonal kommunikasjonsmyndighet ${2018 + index}`,
  url: `https://kudos.dfo.no/dokument/nkom-${2018 + index}`,
  documentType: 'Årsrapport',
  organisation: 'Nasjonal kommunikasjonsmyndighet',
  year: 2018 + index,
  excerpts: [],
}));

const titles = () => screen.getAllByRole('listitem').map((item) => item.textContent);

describe('DocumentsList', () => {
  it('keeps the placeholder sentence when no answer has sources yet', () => {
    render(<DocumentsList />);

    expect(screen.getByText('Dokumentene som er relevante for søket ditt vises her.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Fra Kudos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
  });

  it('says the same about an answer that had no sources', () => {
    // undefined and [] differ in the sources panel — «loading» against
    // «nothing behind this answer» — but here both mean nothing to list.
    render(<DocumentsList documents={[]} />);

    expect(screen.getByText('Dokumentene som er relevante for søket ditt vises her.')).toBeTruthy();
  });

  it('lists five of seven, and counts the rest', () => {
    render(<DocumentsList documents={documents} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Viser 5 av 7 dokumenter.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vis flere dokumenter' })).toBeTruthy();
  });

  it('writes type, organisation and year under the title', () => {
    render(<DocumentsList documents={documents} />);

    expect(screen.getByText('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2018')).toBeTruthy();
  });

  it('links each title to the document on Kudos', () => {
    render(<DocumentsList documents={documents} />);

    // A pattern, not the literal name: the accessible name drops the space
    // that separates the title from the sr-only warning.
    const link = screen.getByRole('link', {
      name: /^Årsrapport Nasjonal kommunikasjonsmyndighet 2018\s*\(åpnes i ny fane\)$/,
    });
    expect(link.getAttribute('href')).toBe('https://kudos.dfo.no/dokument/nkom-2018');
  });

  it('writes the title as text when the document has no public URL', () => {
    // Folder-based corpora come back with `url: null`. A dead link would be
    // worse than a plain title.
    const [first, ...rest] = documents;
    render(<DocumentsList documents={[{ ...first, url: undefined }, ...rest]} />);

    expect(screen.getByText('Årsrapport Nasjonal kommunikasjonsmyndighet 2018')).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: /Årsrapport Nasjonal kommunikasjonsmyndighet 2018/ }),
    ).toBeNull();
  });

  it('shows the rest, drops the button, and leaves focus on the list', () => {
    render(<DocumentsList documents={documents} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vis flere dokumenter' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    // The button is conditional on the state it changes, so it is gone. Focus
    // would otherwise be on <body>, a whole page away from the list that grew.
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Fra Kudos' }));
    // Nothing to count once everything is listed.
    expect(screen.queryByText(/^Viser /)).toBeNull();
  });

  it('lists everything and offers no button when there are five or fewer', () => {
    render(<DocumentsList documents={documents.slice(0, 3)} />);

    expect(titles()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
    expect(screen.queryByText(/^Viser /)).toBeNull();
  });

  it('starts over at five when the next answer brings other documents', () => {
    const { rerender } = render(<DocumentsList documents={documents} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vis flere dokumenter' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);

    // A new answer, a new array. An expanded list carried over from the previous
    // one would show seven rows the reader never asked to see.
    rerender(<DocumentsList documents={documents.map((source) => ({ ...source }))} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Vis flere dokumenter' })).toBeTruthy();
  });
});
