import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { FilterFacet } from '../../model';
import { FacetField } from './FacetField';

const facet: FilterFacet = {
  dimension: 'documentType',
  label: 'Dokumenttype',
  values: [
    { value: 'arsrapport', label: 'Årsrapport', count: 3 },
    { value: 'tildelingsbrev', label: 'Tildelingsbrev', count: 2 },
  ],
};

/** The selection lives above the field, as it does in the view. */
function Harness({ partial = false }: { partial?: boolean }) {
  const [selected, setSelected] = useState<string[]>(partial ? ['arsrapport'] : []);
  return <FacetField facet={facet} selected={selected} onChange={setSelected} />;
}

describe('FacetField', () => {
  it('skiller de tre tilstandene i beskrivelsen', () => {
    // «Alle valgt» used to stand both on an untouched field and after the
    // user had picked every value, so the reader could not tell whether a
    // filter was set at all (brukerblikk, funn 3).
    render(<Harness />);

    expect(screen.getByText('Ingen avgrensning')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));
    expect(screen.getByText('Alle 2 valgt')).toBeTruthy();
    expect(screen.queryByText('Ingen avgrensning')).toBeNull();
  });

  it('teller opp et delvis utvalg', () => {
    render(<Harness partial />);

    expect(screen.getByText('1 av 2 valgt')).toBeTruthy();
    // Both actions are still on offer: one value is chosen, so there is both
    // something to add and something to clear.
    expect(screen.getByRole('button', { name: 'Velg alle dokumenttype' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tøm dokumenttype' })).toBeTruthy();
  });

  it('navngir søkefeltet etter dimensjonen', () => {
    // Three fields with the bare placeholder «Søk» read as one repeated
    // control (brukerblikk, funn 16).
    render(<Harness />);

    expect(screen.getByPlaceholderText('Søk i dokumenttype')).toBeTruthy();
  });

  it('keeps focus in the field when «Velg alle» removes itself', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));

    // The button is conditional on the state it changes, so it is gone now.
    // Without an explicit move, focus would be on <body>.
    expect(screen.queryByRole('button', { name: 'Velg alle dokumenttype' })).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('keeps focus in the field when «Tøm» removes itself', () => {
    render(<Harness />);

    const input = screen.getByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Velg alle dokumenttype' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tøm dokumenttype' }));

    expect(screen.queryByRole('button', { name: 'Tøm dokumenttype' })).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
