import { Heading, Paragraph } from '@digdir/designsystemet-react';

/**
 * The empty state, route `/`. Kickstarters and the compose field arrive here;
 * see step 3 of the build order in design/skal-dette-implementeres.md.
 */
export function NewConversation() {
  return (
    <div className="stack">
      <Heading level={1} data-size="lg">
        Kunnskapsassistenten
      </Heading>
      <Paragraph variant="long">
        Still et spørsmål om dokumentene i korpuset. Filtrer først i sidepanelet hvis du vil
        begrense søket til bestemte dokumenttyper, virksomheter eller år.
      </Paragraph>
      <Paragraph data-size="sm">
        Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.
      </Paragraph>
    </div>
  );
}
