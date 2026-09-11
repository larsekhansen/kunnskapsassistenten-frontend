import { Heading, Paragraph } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** Norwegian. What is missing, stated plainly. */
  title: string;
  /** Norwegian. What the user can do about it. */
  description?: string;
  /** A button or link that resolves the empty state. */
  children?: ReactNode;
};

/**
 * Nothing to show yet — an empty thread list, a sources panel before the
 * first answer (answer 36). Not an error: an empty state is a normal state,
 * so it carries no alert semantics and announces nothing.
 */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Heading level={3} data-size="2xs">
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
