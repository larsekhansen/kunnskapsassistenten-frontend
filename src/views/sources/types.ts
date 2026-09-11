import type { SourceDocument } from '../../model';

/**
 * What the sources view needs from whoever mounts it.
 *
 * The domain types live in `src/model/` and belong to the foundation; this
 * file only describes the seam between the layout and this view.
 *
 * Every prop is optional so the view can be rendered on its own, but two of
 * them are the real contract with the foundation:
 *
 *   collapsed / onCollapsedChange
 *     `src/layout/viewModel.ts` already carries a `collapsed` flag per slot.
 *     The view renders either the single «Vis kilder» button or the panel, but
 *     it does not own that state — the layout does.
 *
 *   activeCitationNumber / activeCitationNonce
 *     Clicking `[n]` in the answer must scroll to excerpt n and mark it
 *     (answer 19, the single most important item on the whole list).
 *     `activeCitationNonce` exists because clicking the same `[n]` twice has
 *     to scroll twice: the number alone does not change, so nothing would
 *     re-run. Any value that changes per click will do; a counter is enough.
 */
export type SourcesViewProps = {
  /** `undefined` means «still loading», `[]` means «no sources yet». */
  documents?: SourceDocument[];
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The `citationNumber` of the marker the user activated in the answer. */
  activeCitationNumber?: number;
  activeCitationNonce?: number;
};
