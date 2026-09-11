import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import { fixtures } from '../../../api/mock';
import { SecondarySidebarIcon } from '../../../components/icons';
import { SourcesView } from '../SourcesView';
import './preview.css';

/**
 * A harness for building and reviewing the sources view on its own.
 *
 * DEV ONLY, see `main.tsx`. It exists because loading, empty and collapsed are
 * states the real app cannot be steered into by hand, and because the shell
 * does not mount this view yet.
 *
 * The panel sits in an `<aside>` with the accessible name the slot gives it,
 * behind the same collapse button and the same `hidden` wrapper the shell
 * uses, so an accessibility snapshot of this page shows the structure the
 * shell will have — including the `[hidden]` behaviour the view has to
 * survive.
 */
type PreviewState = 'ready' | 'loading' | 'empty' | 'uncited';

const STATE_LABELS: Record<PreviewState, string> = {
  ready: 'Med kilder',
  loading: 'Laster',
  empty: 'Tom',
  uncited: 'Utdrag uten nummer',
};

/**
 * The same sources, with the last excerpt stripped of its `citationNumber`.
 *
 * The model allows it — the search finds more than the answer cites — and the
 * mock fixtures never produce it, so this is the only way to see that path.
 */
const uncitedSources = fixtures.nkomSources.map((source, index) =>
  index < fixtures.nkomSources.length - 1
    ? source
    : {
        ...source,
        excerpts: source.excerpts.map(({ citationNumber: _number, ...excerpt }) => excerpt),
      },
);

function documentsFor(state: PreviewState) {
  if (state === 'loading') return undefined;
  if (state === 'empty') return [];
  if (state === 'uncited') return uncitedSources;
  return fixtures.nkomSources;
}

/**
 * `?kilde=3` mounts the view with a citation already set.
 *
 * That is the one case the harness could not otherwise reach, and it is the
 * case where the view must NOT move focus: a citation that was already there
 * when the view mounted is not something the user just did.
 */
function citationFromUrl(): { number: number; nonce: number } | undefined {
  const value = Number(new URLSearchParams(window.location.search).get('kilde'));
  return Number.isInteger(value) && value > 0 ? { number: value, nonce: 0 } : undefined;
}

export function PreviewPanel() {
  const [state, setState] = useState<PreviewState>('ready');
  const [collapsed, setCollapsed] = useState(false);
  const [citation, setCitation] = useState<{ number: number; nonce: number } | undefined>(
    citationFromUrl,
  );
  const contentId = useId();

  const documents = documentsFor(state);

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
        </div>

        <Paragraph data-size="sm">
          Knappene under står for [n]-markørene i svaret. Det er dette hovedkolonnen sender inn.
          Kollaps panelet først for å se at en markør åpner det igjen.
        </Paragraph>

        <div className="preview__controls">
          {fixtures.nkomSources
            .flatMap((source) => source.excerpts)
            .map((excerpt) => (
              <Button
                key={excerpt.id}
                variant="tertiary"
                data-size="sm"
                onClick={() =>
                  setCitation((previous) => ({
                    number: excerpt.citationNumber as number,
                    nonce: (previous?.nonce ?? 0) + 1,
                  }))
                }
              >
                [{excerpt.citationNumber}]
              </Button>
            ))}
        </div>
      </main>

      {/* The same shape as Shell.tsx: the slot owns the button, the content
          stays mounted and is hidden with `hidden`. */}
      <aside aria-label="Kilder" className="preview__aside">
        <Button
          variant="tertiary"
          data-color="neutral"
          data-size="sm"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => setCollapsed((it) => !it)}
        >
          <SecondarySidebarIcon aria-hidden />
          {collapsed ? 'Vis kilder' : 'Skjul kilder'}
        </Button>

        <div id={contentId} hidden={collapsed} className="preview__aside-content">
          <SourcesView
            documents={documents}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            activeCitationNumber={citation?.number}
            activeCitationNonce={citation?.nonce}
          />
        </div>
      </aside>
    </div>
  );
}
