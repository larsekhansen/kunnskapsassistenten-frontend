import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('keeps the alert container in the DOM while there is no error', () => {
    const { container } = render(<ErrorState />);

    // The container has to exist before the message does, otherwise a screen
    // reader announces nothing when the error arrives.
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(screen.queryByRole('alert')?.textContent).toBe('');
  });

  it('shows the message and a retry button when there is one', () => {
    render(<ErrorState title="Svaret feilet" message="Prøv igjen om litt." onRetry={() => {}} />);

    expect(screen.getByRole('alert').textContent).toContain('Prøv igjen om litt.');
    expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('is not an alert: nothing missing is an error', () => {
    render(<EmptyState title="Ingen kilder ennå" description="Still et spørsmål først." />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ingen kilder ennå' })).toBeTruthy();
  });
});
