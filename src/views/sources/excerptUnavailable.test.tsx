import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Excerpt } from '../../model';
import { EXCERPT_UNAVAILABLE, SourceExcerpt } from './SourceExcerpt';

/**
 * Et utdrag uten tekst er ikke et tomt utdrag: biten ble hentet, det var
 * teksten som ikke lot seg slå opp. Målt 29.09 mot poden med Typesense nede,
 * der hver kilde kom med tittel og Kudos-lenke og uten `excerpt`.
 *
 * Kortet er lukket når leseren møter det, så det er der setningen må stå.
 * Første forsøk satte den bare i `Details.Content`, som nettleseren skjuler
 * til «Åpne» er trykket, og da sto «Utdrag 1», «Mest relevant» og «Åpne» over
 * ingenting — nøyaktig gåten setningen finnes for å svare på (KA CC på #182).
 *
 * Påstandene peker derfor på FORHÅNDSVISNINGEN og ikke på dokumentet som
 * helhet. `getByText` finner tekst inne i et lukket `<details>` også, fordi
 * jsdom ikke skjuler noe, så en påstand om at setningen «finnes» ville vært
 * grønn med feilen i behold. Det var slik den gikk gjennom runde 1.
 *
 * Unntak fra dirigenten for `src/views/sources/`.
 */
function excerptWith(over: Partial<Excerpt> = {}): Excerpt {
  return {
    id: 'utdrag-1',
    citationNumber: 1,
    relevance: 'high',
    text: '',
    textUnavailable: true,
    kudosUrl: 'https://kudos.example/documents/1',
    ...over,
  };
}

function Kort({ excerpt, open: start }: { excerpt: Excerpt; open: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <SourceExcerpt
      excerpt={excerpt}
      documentTitle="Tildelingsbrev Landbruksdirektoratet 2025"
      corpusName="Kudos"
      position={1}
      total={1}
      open={open}
      onOpenChange={setOpen}
      hits={[]}
      active={false}
    />
  );
}

const preview = (container: HTMLElement) =>
  container.querySelector('.source-excerpt__preview')?.textContent ?? '';

describe('et utdrag som ikke lot seg hente', () => {
  it('sier fra i FORHÅNDSVISNINGEN, som er det leseren ser før «Åpne»', () => {
    const { container } = render(<Kort excerpt={excerptWith()} open={false} />);

    expect(preview(container)).toContain(EXCERPT_UNAVAILABLE);
  });

  it('sier fra i det åpne kortet også', () => {
    const { container } = render(<Kort excerpt={excerptWith()} open />);

    // Åpent finnes ingen forhåndsvisning; setningen står i innholdet.
    expect(container.querySelector('.source-excerpt__preview')).toBeNull();
    expect(screen.getByText(EXCERPT_UNAVAILABLE)).toBeTruthy();
  });

  it('merkes som noe annet enn et sitat, så den ikke leses som tekst fra dokumentet', () => {
    const { container } = render(<Kort excerpt={excerptWith()} open={false} />);

    const sagt = container.querySelector('.source-excerpt__quote--unavailable');
    expect(sagt?.textContent).toBe(EXCERPT_UNAVAILABLE);
  });

  it('rører ikke et utdrag som faktisk har tekst', () => {
    const { container } = render(
      <Kort
        excerpt={excerptWith({
          text: 'Departementet stiller midler til disposisjon.',
          textUnavailable: undefined,
        })}
        open={false}
      />,
    );

    expect(preview(container)).toContain('Departementet stiller midler');
    expect(preview(container)).not.toContain(EXCERPT_UNAVAILABLE);
    expect(container.querySelector('.source-excerpt__quote--unavailable')).toBeNull();
  });
});
