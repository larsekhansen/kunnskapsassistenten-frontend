import { describe, expect, it } from 'vitest';
import { GENERIC_CHAT_ERROR, withoutRetryPrompt } from './errorText';

describe('withoutRetryPrompt', () => {
  it('drops the closing «Prøv igjen» and keeps the sentence before it', () => {
    expect(withoutRetryPrompt('Noe gikk galt. Prøv igjen.')).toBe('Noe gikk galt.');
  });

  it('drops «Prøv igjen om litt» too', () => {
    expect(withoutRetryPrompt('Assistenten svarte ikke. Prøv igjen om litt.')).toBe(
      'Assistenten svarte ikke.',
    );
  });

  it('leaves a message that only mentions the words in passing', () => {
    // The button says «Prøv igjen»; «Prøv igjen senere» says something else,
    // and a sentence has to end with the prompt to count as a duplicate.
    const message = 'Tjenesten er nede. Prøv igjen senere i dag.';
    expect(withoutRetryPrompt(message)).toBe(message);
  });

  it('falls back to a message of its own rather than emptying the alert', () => {
    expect(withoutRetryPrompt('Prøv igjen.')).toBe(GENERIC_CHAT_ERROR);
  });

  it('leaves an ordinary message alone', () => {
    expect(withoutRetryPrompt('Du har ikke tilgang til dette korpuset.')).toBe(
      'Du har ikke tilgang til dette korpuset.',
    );
  });
});
