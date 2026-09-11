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
function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return <FacetField facet={facet} selected={selected} onChange={setSelected} />;
}

describe('FacetField', () => {
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
