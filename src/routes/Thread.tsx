import { Heading, Paragraph } from '@digdir/designsystemet-react';
import { useParams } from 'react-router';
import { fixtures } from '../api/mock';
import { Markdown } from '../components';
import { useCitation } from '../layout/useCitation';
import { citationTargets } from '../model';

/**
 * Route `/threads/:threadId`.
 *
 * The answer, the «Fremgangsmåte» panel and the compose field arrive with
 * ChatView; see steps 3, 5 and 6 of the build order. Until then this renders
 * the mock answer through the markdown renderer, which is what makes the
 * renderer verifiable: headings, a list and a table in one answer.
 */
export function Thread() {
  const { threadId } = useParams();
  const { showCitation } = useCitation();
  const thread = threadId ? fixtures.findThread(threadId) : null;

  return (
    <article className="stack">
      <Heading level={1} data-size="lg">
        {thread?.title ?? 'Tråd'}
      </Heading>
      {thread?.messages.length ? (
        thread.messages.map((message) =>
          message.role === 'user' ? (
            <Paragraph key={message.id} variant="long" data-size="lg">
              {message.content}
            </Paragraph>
          ) : (
            <Markdown
              key={message.id}
              citations={citationTargets(message.sources ?? [])}
              onCitationActivate={showCitation}
            >
              {message.content}
            </Markdown>
          ),
        )
      ) : (
        <Paragraph variant="long">Denne tråden har ingen meldinger ennå.</Paragraph>
      )}
    </article>
  );
}
