import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Outlet } from 'react-router';
import { standardView } from './views';

/**
 * Skallet: tre regioner på én rad.
 *
 * Navnene er rollenavn, ikke sidenavn: navigasjonspanel, hovedkolonne,
 * kildepanel. Begrunnelsen står i design/visjon-og-beslutninger.md — paneler
 * skal kunne flyttes, og «venstre» i en aria-label lyver for en
 * skjermleserbruker når panelet står til høyre.
 *
 * Bredder og hvilket innhold panelene viser leses fra standardView, se
 * views.ts.
 */
export function Skall() {
  const { navigasjonspanel, kildepanel } = standardView.regioner;

  return (
    <>
      <a className="ka-hopp-lenke" href="#hovedinnhold">
        Hopp til hovedinnhold
      </a>

      <div className="ka-skall">
        <nav aria-label="Tråder og filter" className="ka-navigasjonspanel">
          <div className="ka-stabel">
            <Heading level={2} data-size="xs">
              {navigasjonspanel.viser === 'filter' ? 'Filtrering' : 'Tråder'}
            </Heading>
            <Paragraph data-size="sm">
              Dokumentfilter og trådliste kommer her. En førstegangsbruker lander på filtrering.
            </Paragraph>
            <Button variant="tertiary" data-color="neutral">
              Tråder
            </Button>
          </div>
        </nav>

        <main id="hovedinnhold" className="ka-hovedkolonne">
          <Outlet />
        </main>

        <aside aria-label="Kilder" className="ka-kildepanel">
          <Button variant="tertiary" data-color="neutral">
            {kildepanel.kollapset ? 'Vis kilder' : 'Skjul kilder'}
          </Button>
        </aside>
      </div>
    </>
  );
}
