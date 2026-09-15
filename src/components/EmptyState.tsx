import { Heading, Paragraph } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** Norwegian. What is missing, stated plainly. */
  title: string;
  /** Norwegian. What the user can do about it. */
  description?: string;
  /**
   * Heading level for the title. 3 by default, which is what a panel needs:
   * the panel head is the level 2 and this sits under it.
   *
   * It is a prop because the level says where the empty state SITS, and the
   * component cannot know. An empty state that is the whole page — a broken
   * address, a thread that is not there — sits directly under the page's own
   * level 1 and is a level 2. Skipping a level there is a heading order axe
   * reports and a screen reader user has to guess past.
   */
  level?: 2 | 3 | 4;
  /** A button or link that resolves the empty state. */
  children?: ReactNode;
};

/**
 * Nothing to show yet — an empty thread list, a sources panel before the
 * first answer (answer 36). Not an error: an empty state is a normal state,
 * so it carries no alert semantics and announces nothing.
 */
export function EmptyState({ title, description, level = 3, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Heading level={level} data-size="2xs">
        {title}
      </Heading>
      {description ? (
        <Paragraph data-size="sm" variant="long">
          {description}
        </Paragraph>
      ) : null}
      {children}
    </div>
  );
}
