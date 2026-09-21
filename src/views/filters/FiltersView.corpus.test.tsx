import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * The corpus chooser in `FiltersView`: the corpus line, when there is more
 * than one corpus to search.
 *
 * Its own file rather than more tests in `FiltersView.test.tsx`, because
 * `vi.mock` is per file: the hook has to be replaced here, and the other file
 * should keep testing the view against the real corpus store. Named after the
 * component it mounts — there is no `CorpusSelect.tsx`, and a test file that
 * names a component nobody can open sends the next reader looking for it
 * (KA CC on #106).
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
    // egne ord er det linja har. Navnet står, resten ligger bak «Vis mer»
    // (N2).
    renderView();

    expect(screen.getByText('Dokumenter fra Wikipedia (NorQuAD)')).toBeTruthy();
    // `hidden`, ikke fjernet: `aria-controls` peker på det, og et element
    // som ikke er i dokumentet kan ingen skjermleser følge pekeren til.
    expect(screen.getByText('351 artikler.').hasAttribute('hidden')).toBe(true);
    expect(screen.getByRole('button', { name: 'Vis mer om korpuset' })).toBeTruthy();
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
    renderView();

    expect(screen.queryByRole('combobox', { name: 'Korpus' })).toBeNull();
    // Linja står som før: navnet på én linje, resten bak «Vis mer».
    expect(screen.getByText('Dokumenter fra Wikipedia (NorQuAD)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vis mer om korpuset' })).toBeTruthy();
  });
});
