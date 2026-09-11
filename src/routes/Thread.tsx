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
 *
 * The h1 is the application, not the thread. A thread is one section of the
 * page and its title is an h2, the level ChatView renders it at, so the two
 * agree before and after ChatView is mounted here. Naming the page after the
 * thread would also rename it mid-session the moment a title is generated
 * from the first question.
 */
export function Thread() {
  const { threadId } = useParams();
  const { showCitation } = useCitation();
  const thread = threadId ? fixtures.findThread(threadId) : null;

  return (
    <article className="stack">
      <Heading level={1} className="ds-sr-only">
        Kunnskapsassistenten
      </Heading>
      <Heading level={2} data-size="lg">
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
              // The answer sits under the thread title, so its own headings
              // start one level further down and the document skips nothing.
              startLevel={3}
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
