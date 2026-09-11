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
  selection: FilterSelection;
  setSelection: (selection: FilterSelection) => void;
};

export const FilterContext = createContext<FilterContextValue | undefined>(undefined);
