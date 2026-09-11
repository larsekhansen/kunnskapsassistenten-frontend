import { Alert, Button, Heading, Paragraph } from '@digdir/designsystemet-react';

export type ErrorStateProps = {
  /** Norwegian heading inside the alert. Optional. */
  title?: string;
  /** Norwegian. Nothing is announced while this is undefined. */
  message?: string;
  /** Shows a retry button when given. */
  onRetry?: () => void;
  /** Norwegian label for the retry button. */
  retryLabel?: string;
};

/**
 * An error the user needs to see (answer 35).
 *
 * The `role="alert"` container is rendered even when there is no error, and
 * that is the point. A screen reader only announces an alert when content
 * appears INSIDE a region that already exists; mounting the whole region and
 * its text at once announces nothing. So render this component permanently
 * where an error can appear, and pass `message` when one does.
 * See design/designsystemet/komponenter/alert.md.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Prøv igjen',
}: ErrorStateProps) {
  return (
    <div role="alert" className="error-state">
      {message ? (
        <Alert data-color="danger">
          {title ? (
            <Heading level={3} data-size="2xs">
              {title}
            </Heading>
          ) : null}
          <Paragraph variant="long">{message}</Paragraph>
          {onRetry ? (
            <Button variant="secondary" data-size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
