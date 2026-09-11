import { createContext } from 'react';

/**
 * Which citation the user last asked to see.
 *
 * `nonce` counts up on every request, including a repeat of the same number.
 * Without it, clicking `[3]`, scrolling away and clicking `[3]` again would
 * change nothing, because the value is identical — and the sources panel
 * would have no way to know it was asked a second time.
 */
export type ActiveCitation = {
  /** 1-indexed, as written in the answer. */
  number: number;
  nonce: number;
};

export type CitationContextValue = {
  activeCitation: ActiveCitation | undefined;
  /** The chat view calls this when the user activates a `[n]` marker. */
  showCitation: (number: number) => void;
};

export const CitationContext = createContext<CitationContextValue | undefined>(undefined);
