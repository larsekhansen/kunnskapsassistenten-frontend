import { Heading, Paragraph } from '@digdir/designsystemet-react';

/**
 * Tom tilstand, ruten «/». Her kommer kickstarterne og skrivefeltet, se
 * trinn 3 i bygg-rekkefølgen i design/skal-dette-implementeres.md.
 */
export function NySamtale() {
  return (
    <div className="ka-stabel">
      <Heading level={1} data-size="lg">
        Kunnskapsassistenten
      </Heading>
      <Paragraph variant="long">
        Still et spørsmål om dokumentene i korpuset. Filtrer først i navigasjonspanelet hvis du vil
        begrense søket til bestemte dokumenttyper, virksomheter eller år.
      </Paragraph>
      <Paragraph data-size="sm">
        Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.
      </Paragraph>
    </div>
  );
}
