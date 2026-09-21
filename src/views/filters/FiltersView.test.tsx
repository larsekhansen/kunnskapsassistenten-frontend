import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { emptyFilterSelection, type FilterFacet } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * The view reads two pieces of shell state, so both contexts are mounted the
 * way LayoutProvider mounts them. No documents: the document list is its own
 * test, and this one is about the facets.
 *
 * The router is here because the corpus chooser switches corpus by starting a
 * new thread, and `useCorpus` navigates to do it — so the view now needs a
 * router the way it needs the two contexts.
 */
function renderView(facets?: FilterFacet[]) {
  return render(
    <MemoryRouter>
      <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
        <AnswerSourcesContext value={inertAnswerSources}>
          <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={facets} />
        </AnswerSourcesContext>
      </FilterContext>
    </MemoryRouter>,
  );
}

describe('FiltersView', () => {
  it('says so when there are no facets, instead of showing nothing', () => {
    renderView([]);

    expect(
      screen.getByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
    ).toBeTruthy();
    expect(screen.queryByText('Henter filtre')).toBeNull();
  });

  it('does not mistake an empty list for still loading', () => {
    const { container } = renderView([]);

    // An empty array is truthy, so the loading branch has to test !facets and
    // the empty branch facets.length === 0. Getting that wrong showed a
    // skeleton forever, or nothing at all.
    expect(container.querySelector('.filters-view__loading')).toBeNull();
  });

  it('shows a field per facet when there are facets', () => {
    renderView([
      {
        dimension: 'documentType',
        label: 'Dokumenttype',
        values: [{ value: 'arsrapport', label: 'Årsrapport', count: 3 }],
      },
    ]);

    expect(
      screen.queryByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
    ).toBeNull();
    expect(screen.getByLabelText('Dokumenttype')).toBeTruthy();
  });
});
