import { createContext } from 'react';
import type { Layout, Slot, ViewId } from './viewModel';

export type LayoutContextValue = {
  layout: Layout;
  /** Show a view that already sits in the slot. */
  setActiveView: (slot: Slot, view: ViewId) => void;
  setCollapsed: (slot: Slot, collapsed: boolean) => void;
  toggleCollapsed: (slot: Slot) => void;
  /** Resize a fixed slot. No drag handle calls this yet. */
  setWidth: (slot: Slot, width: number) => void;
  /** Move a view to another slot. No UI calls this yet (answers 10, 48). */
  moveView: (view: ViewId, target: Slot) => void;
};

/**
 * Lives in its own file so LayoutProvider.tsx exports nothing but a
 * component and Fast Refresh keeps working while the views are built.
 */
export const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);
