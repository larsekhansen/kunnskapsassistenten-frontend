import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useState } from 'react';
import { fixtures } from '../../../api/mock';
import { SourcesView } from '../SourcesView';
import './preview.css';

/**
 * A harness for building and reviewing the sources view on its own.
 *
 * DEV ONLY, see `main.tsx`. It exists because the view is not mounted in
 * the shell yet, and because loading, empty and collapsed are states the real
 * app cannot be steered into by hand.
 *
 * The panel sits in an `<aside>` with the accessible name the slot will give
 * it, so an accessibility snapshot of this page shows the landmark structure
 * the shell will have.
 */
type PreviewState = 'ready' | 'loading' | 'empty';

const STATE_LABELS: Record<PreviewState, string> = {
  ready: 'Med kilder',
  loading: 'Laster',
  empty: 'Tom',
};

export function PreviewPanel() {
  const [state, setState] = useState<PreviewState>('ready');
  const [collapsed, setCollapsed] = useState(false);
  const [citation, setCitation] = useState<{ number: number; nonce: number } | undefined>(
    undefined,
  );

  const documents = state === 'loading' ? undefined : state === 'empty' ? [] : fixtures.nkomSources;

  return (
    <div className="preview">
      <main className="preview__main">
        <Heading level={1} data-size="lg">
          Kilder, forhåndsvisning
        </Heading>

        <div className="preview__controls">
          {(Object.keys(STATE_LABELS) as PreviewState[]).map((value) => (
            <Button
              key={value}
              variant={state === value ? 'primary' : 'secondary'}
              data-size="sm"
              onClick={() => setState(value)}
            >
              {STATE_LABELS[value]}
            </Button>
          ))}
          <Button variant="secondary" data-size="sm" onClick={() => setCollapsed((it) => !it)}>
            {collapsed ? 'Åpne panelet' : 'Kollaps panelet'}
          </Button>
        </div>

        <Paragraph data-size="sm">
          Knappene under står for [n]-markørene i svaret. Det er dette hovedkolonnen sender inn.
        </Paragraph>

        <div className="preview__controls">
          {fixtures.nkomSources
            .flatMap((document) => document.excerpts)
            .map((excerpt) => (
              <Button
                key={excerpt.id}
                variant="tertiary"
                data-size="sm"
                onClick={() =>
                  setCitation((previous) => ({
                    number: excerpt.citationNumber,
                    nonce: (previous?.nonce ?? 0) + 1,
                  }))
                }
              >
                [{excerpt.citationNumber}]
              </Button>
            ))}
        </div>
      </main>

      <aside aria-label="Kilder" className="preview__aside">
        <SourcesView
          documents={documents}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          activeCitationNumber={citation?.number}
          activeCitationNonce={citation?.nonce}
        />
      </aside>
    </div>
  );
}
