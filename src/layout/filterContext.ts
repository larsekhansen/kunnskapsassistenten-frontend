import { createContext } from 'react';
import type { FilterSelection } from '../model';

/**
 * The document filter, held above the views.
 *
 * The filter view writes it and the chat view reads it — a question is asked
 * against the documents the user has narrowed to — so neither can own it. The
 * shell does, for the same reason it owns the active citation: two views that
 * must agree may never import each other.
 */
export type FilterContextValue = {
  /**
   * What questions are asked with. The reader's own choice — or, while the
   * thread on screen is locked, the lock (see `locked`).
   */
  selection: FilterSelection;
  setSelection: (selection: FilterSelection) => void;
  /**
   * The filter the thread on screen is locked to, when it is.
   *
   * The BFF keeps the filter a conversation was started with and asks every
   * later question in it with that, whatever the client sends
   * (`threadFilters` in its server.ts). A panel that let the reader change
   * the filter there would change nothing but the words on screen, so while
   * this is set the panel shows the lock instead, and `selection` above IS
   * the lock — which makes the question and the «Avgrenset til» line over its
   * answer right without either having to know.
   *
   * The reader's own choice is kept apart, untouched, and is back when they
   * leave the thread. Optional, so a test that builds the context by hand
   * need not say it.
   */
  locked?: FilterSelection;
  /** Said by the view holding a thread: what it is locked to, or undefined. */
  setLocked?: (filter: FilterSelection | undefined) => void;
};

export const FilterContext = createContext<FilterContextValue | undefined>(undefined);
