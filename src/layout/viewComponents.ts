import type { ComponentType } from 'react';
import { ViewPlaceholder } from './ViewPlaceholder';
import type { SlotViewProps, ViewId } from './viewModel';

/**
 * Which component renders which view.
 *
 * The four views are owned by three other workers, so until their components
 * land every entry is the placeholder. When a view arrives, only its entry
 * changes — the shell, the layout model and the slot labels do not.
 *
 * `chat` is the exception: the main slot renders the router outlet, because
 * the route decides whether it shows a new conversation or an existing
 * thread. Its entry is kept so the model stays complete for the day a view
 * can be moved out of main.
 *
 * This is also where a view's own prop names are adapted. The shell hands
 * every view the same `SlotViewProps`; a view that would rather be called
 * with `onShowThreads` or `selection` gets a three-line wrapper here, and
 * `SlotViewProps` does not grow a field per view. The shell stays a shell.
 */
export const viewComponents: Record<ViewId, ComponentType<SlotViewProps>> = {
  threads: ViewPlaceholder,
  filters: ViewPlaceholder,
  chat: ViewPlaceholder,
  sources: ViewPlaceholder,
};
