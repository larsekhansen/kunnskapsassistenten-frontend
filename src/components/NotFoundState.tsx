import { Link } from '@digdir/designsystemet-react';
import { Link as RouterLink } from 'react-router';
import { EmptyState } from './EmptyState';

export type NotFoundStateProps = {
  /** Norwegian. What was not found, stated plainly. */
  title: string;
  /** Norwegian. Why it might not be there. */
  description: string;
};

/**
 * A link that leads nowhere, said out loud, with the one way out.
 *
 * Two places need it and they need the same way out, which is why it is here
 * rather than written twice: an address that matches no route, and a thread
 * id the client does not know. Reise 14 in
 * design/brukerreiser-2026-09-15.md, punkt 10 on the ranked list — a shared
 * link that has gone stale used to draw a fresh, working front page under an
 * address that names a conversation, so the reader was told nothing at all.
 *
 * An `EmptyState` and not an `ErrorState`, deliberately. Nothing has just
 * gone wrong: the page IS this. `ErrorState` is an `Alert` with
 * `role="alert"`, and announcing the whole page the moment it renders is
 * noise a screen reader user did not ask for — they are about to read it.
 *
 * Level 2, because this is the whole page: it sits directly under the route's
 * own level 1. See `EmptyState`.
 */
export function NotFoundState({ title, description }: NotFoundStateProps) {
  return (
    <EmptyState level={2} title={title} description={description}>
      <Link asChild>
        <RouterLink to="/">Gå til forsiden</RouterLink>
      </Link>
    </EmptyState>
  );
}
