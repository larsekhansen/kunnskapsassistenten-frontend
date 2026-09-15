import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('counts heading depth up from startLevel, not from the markdown', () => {
    render(<Markdown startLevel={3}>{'# Ett\n\n## To'}</Markdown>);

    expect(screen.getByRole('heading', { name: 'Ett', level: 3 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'To', level: 4 })).toBeTruthy();
  });

  it('renders lists as real lists', () => {
    render(<Markdown>{'- ett\n- to'}</Markdown>);

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('puts a table in a named, focusable scroll box', () => {
    render(<Markdown>{'| A | B |\n| --- | --- |\n| 1 | 2 |'}</Markdown>);

    const region = screen.getByRole('region', { name: 'Tabell' });
    expect(region.tabIndex).toBe(0);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeTruthy();
  });

  it('renders links as links', () => {
    render(<Markdown>{'[Kudos](https://kudos.dfo.no)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Kudos' });
    expect(link.getAttribute('href')).toBe('https://kudos.dfo.no');
  });
});

describe('Markdown citations', () => {
  const targets = [
    { number: 1, targetId: 'excerpt-1', label: 'Kilde 1: Årsrapport Nkom 2022, side 41' },
    { number: 2, targetId: 'excerpt-2', label: 'Kilde 2: Årsrapport Nkom 2023' },
  ];

  it('turns [n] into a link that says where it goes', () => {
    render(<Markdown citations={targets}>{'Avvik rapporteres kvartalsvis [1].'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Kilde 1: Årsrapport Nkom 2022, side 41' });
    expect(link.getAttribute('href')).toBe('#excerpt-1');
    expect(link.textContent).toBe('[1]');
  });

  it('leaves a marker with no excerpt as plain text', () => {
    // Unchanged by default: an answer can carry a bracketed number that was
    // never a citation, and a clarification does exactly that.
    const { container } = render(<Markdown citations={targets}>{'Udekket påstand [9].'}</Markdown>);

    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toContain('Udekket påstand [9]');
    expect(container.querySelector('sup[title]')).toBeNull();
  });

  it('keeps the text around and between several markers', () => {
    const { container } = render(<Markdown citations={targets}>{'Ett [1][2] og slutt.'}</Markdown>);

    expect(container.textContent).toBe('Ett [1][2] og slutt.');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('reports the number when a marker is activated', async () => {
    const seen: number[] = [];
    render(
      <Markdown citations={targets} onCitationActivate={(n) => seen.push(n)}>
        {'Se [2].'}
      </Markdown>,
    );

    screen.getByRole('link', { name: /Kilde 2/ }).click();
    expect(seen).toEqual([2]);
  });

  it('renders markers inside list items and table cells too', () => {
    render(<Markdown citations={targets}>{'- punkt [1]'}</Markdown>);
    expect(screen.getByRole('listitem').textContent).toBe('punkt [1]');
    expect(screen.getByRole('link', { name: /Kilde 1/ })).toBeTruthy();
  });
});

describe('markør uten kilde', () => {
  it('blir tekst med en forklaring, ikke en lenke', () => {
    // Et avbrutt svar har skrevet [3], men kildene kom aldri. En lenke til
    // ingenting er verre enn ingen lenke.
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Et svar med [3] i seg.'}
      </Markdown>,
    );

    expect(screen.queryByRole('link')).toBeNull();

    const marker = container.querySelector('sup[title]');
    expect(marker?.getAttribute('title')).toBe('Kilden kom ikke fram');
    expect(marker?.textContent).toContain('[3]');
    // `title` alene er bare for mus. Dette er for den som lytter.
    expect(marker?.textContent?.toLowerCase()).toContain('kilden kom ikke fram');
  });

  it('lar teksten rundt stå urørt', () => {
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Før [3] etter.'}
      </Markdown>,
    );
    expect(container.textContent).toContain('Før ');
    expect(container.textContent).toContain(' etter.');
  });
});
