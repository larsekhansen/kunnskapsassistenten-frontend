import { Heading, Paragraph } from '@digdir/designsystemet-react';
import { useParams } from 'react-router';

/**
 * Placeholder for route `/threads/:threadId`. The answer, the «Fremgangsmåte»
 * panel and the compose field arrive here; see steps 3, 5 and 6 of the build
 * order.
 */
export function Thread() {
  const { threadId } = useParams();

  return (
    <div className="stack">
      <Heading level={1} data-size="lg">
        Tråd
      </Heading>
      <Paragraph variant="long">
        Samtalen med id <code>{threadId}</code> vises her. Svaret bygges av overskrift og avsnitt,
        med markdown-lister og enkle tabeller.
      </Paragraph>
    </div>
  );
}
