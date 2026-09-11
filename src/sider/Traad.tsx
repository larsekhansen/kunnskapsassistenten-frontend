import { Heading, Paragraph } from '@digdir/designsystemet-react';
import { useParams } from 'react-router';

/**
 * Plassholder for ruten «/traader/:traadId». Svaret, «Fremgangsmåte»-panelet
 * og skrivefeltet kommer her, se trinn 3, 5 og 6 i bygg-rekkefølgen.
 */
export function Traad() {
  const { traadId } = useParams();

  return (
    <div className="ka-stabel">
      <Heading level={1} data-size="lg">
        Tråd
      </Heading>
      <Paragraph variant="long">
        Samtalen med id <code>{traadId}</code> vises her. Svaret bygges av overskrift og avsnitt,
        med markdown-lister og enkle tabeller.
      </Paragraph>
    </div>
  );
}
