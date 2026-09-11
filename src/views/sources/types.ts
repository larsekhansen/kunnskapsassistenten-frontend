import type { SlotViewProps } from '../../layout/viewModel';
import type { SourceDocument } from '../../model';

/**
 * What the sources view needs from whoever mounts it.
 *
 * It is `SlotViewProps` plus the documents. The slot props are partial so the
 * view also renders on its own, outside the shell, which is what the preview
 * harness does; a component with partial props is still assignable to
 * `ComponentType<SlotViewProps>`, so the shell can mount it unchanged.
 *
 * The shell owns the collapse button and hides the whole view with `hidden`
 * when the slot is collapsed, so nothing here has to draw a «Vis kilder»
 * button. `collapsed` is still read: a collapsed panel should not scroll
 * itself to a citation it cannot show.
 *
 * `activeCitationNumber` and `activeCitationNonce` come from
 * `useCitation()` through the shell. The nonce is what makes a second click
 * on the same `[n]` count as a new request (answer 19).
 *
 * `documents` has no home in `SlotViewProps` yet, because the shell does not
 * hold the answer. Until a thread context carries them, whoever mounts the
 * view passes them — `viewComponents.ts` is where that adapter belongs.
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /** `undefined` means «still loading», `[]` means «no sources yet». */
  documents?: SourceDocument[];
};
