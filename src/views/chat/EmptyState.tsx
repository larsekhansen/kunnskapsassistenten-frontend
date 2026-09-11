import { Heading } from '@digdir/designsystemet-react';
import { Kickstarters } from './Kickstarters';

type EmptyStateProps = {
  /** The signed-in user's first name. Figma hardcodes «Simen»; this does not. */
  userName?: string;
  onPickKickstarter: (question: string) => void;
};

/**
 * What a reader meets before the first question: a greeting and three
 * suggestions.
 *
 * The greeting is two lines in Figma, «Hei, Simen 👋» and «Hva lurer du på?».
 * Without a name the first line would read «Hei,  👋», so it falls back to a
 * plain «Hei 👋». The waving hand is decorative — a screen reader announcing
 * «vinkende hånd» in the middle of a greeting adds nothing — so it is hidden
 * and the greeting is a real heading either way.
 */
export function EmptyState({ userName, onPickKickstarter }: EmptyStateProps) {
  return (
    <>
      <div className="ka-chat-greeting">
        <Heading data-size="lg" level={2}>
          {userName ? `Hei, ${userName} ` : 'Hei '}
          <span aria-hidden="true">👋</span>
        </Heading>
        <Heading data-size="lg" level={3}>
          Hva lurer du på?
        </Heading>
      </div>
      <Kickstarters onPick={onPickKickstarter} />
    </>
  );
}
