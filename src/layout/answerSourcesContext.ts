import { createContext } from 'react';
import type { SourceDocument } from '../model';

/**
 * The sources behind the answer currently on screen, held above the views.
 *
 * The chat view produces them — they arrive at the end of a stream, in the
 * `sources` event — and the sources view draws them. Neither can own it, for
 * the same reason neither owns the active citation or the filter: two views
 * that must agree may never import each other, and either of them can be
 * moved to another slot.
 *
 * `undefined` and `[]` are different answers, and the sources view renders
 * them differently: undefined is «no answer yet, so nothing is known», and an
 * empty array is «an answer, with nothing behind it».
 */
export type AnswerSourcesContextValue = {
  documents: SourceDocument[] | undefined;
  /** Called by the view that owns the answer, when its sources change. */
  setDocuments: (documents: SourceDocument[] | undefined) => void;
};

export const AnswerSourcesContext = createContext<AnswerSourcesContextValue | undefined>(undefined);
