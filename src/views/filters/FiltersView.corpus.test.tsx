import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * The corpus chooser, which is the corpus line when there is more than one
 * corpus to search.
 *
 * `useCorpus` is the shell's (#5), and it reads a module store fixed at
 * startup from the environment — so the only way to see both states in a test
 * is to stand in for the hook. What is asserted here is this view's half: that
 * the chooser appears only when there is a choice, that picking one asks the
 * shell to switch, and that a screen reader is told which corpus it landed on.
 */
const corpus = vi.hoisted(() => ({
  options: [
    { key: 'norquad-docs', label: 'Wikipedia (NorQuAD)', description: '351 artikler.' },
    { key: 'kudos-pilot', label: 'Kudos-pilot', description: 'Fem årsrapporter.' },
  ],
  active: 'norquad-docs',
  choosable: true,
  set: vi.fn(),
}));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: corpus.options,
    active: corpus.active,
    option: corpus.options.find((option) => option.key === corpus.active),
    choosable: corpus.choosable,
    set: corpus.set,
  }),
}));

function renderView() {
  return render(
    <MemoryRouter>
      <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
        <AnswerSourcesContext value={inertAnswerSources}>
          <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={[]} />
        </AnswerSourcesContext>
      </FilterContext>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  corpus.active = 'norquad-docs';
  corpus.choosable = true;
  corpus.set.mockClear();
});

describe('korpusvelgeren', () => {
  it('er en nedtrekksliste med etiketten «Korpus» og korpuset som er valgt', () => {
    renderView();

    const select = screen.getByRole('combobox', { name: 'Korpus' });
    expect((select as HTMLSelectElement).value).toBe('norquad-docs');
    expect(screen.getByRole('option', { name: 'Kudos-pilot' })).toBeTruthy();
  });

  it('viser beskrivelsen av korpuset under velgeren', () => {
    // Live har ingen fasetter å regne ut en setning fra (A2), så korpusets
    // egne ord er det linja har.
    const { container } = renderView();

    expect(container.querySelector('.filters-view__corpus')?.textContent).toBe(
      'Dokumenter fra Wikipedia (NorQuAD): 351 artikler.',
    );
  });

  it('ber skallet bytte, og annonserer hvilket korpus det ble', () => {
    const { container } = renderView();

    fireEvent.change(screen.getByRole('combobox', { name: 'Korpus' }), {
      target: { value: 'kudos-pilot' },
    });

    // Bytte er skallets sak: ny tråd og ny adresse hører til der, ikke her.
    expect(corpus.set).toHaveBeenCalledWith('kudos-pilot');
    // Og den ene tingen som endret seg er den ingen ser: skjermbildet tegnes
    // om, men ingenting sier hva som nå blir søkt i.
    expect(container.querySelector('output.ds-sr-only')?.textContent).toBe('Korpus: Kudos-pilot');
  });

  it('tegner ingen velger når det bare finnes ett korpus', () => {
    corpus.choosable = false;
    const { container } = renderView();

    expect(screen.queryByRole('combobox', { name: 'Korpus' })).toBeNull();
    // Linja står som før, med korpusets egne ord.
    expect(container.querySelector('.filters-view__corpus')?.textContent).toBe(
      'Dokumenter fra Wikipedia (NorQuAD): 351 artikler.',
    );
  });
});
