import type { SlotViewProps } from '../../layout/viewModel';
import type { AnswerSources, SourceDocument } from '../../model';

/**
 * What the sources view needs from whoever mounts it.
 *
 * `SlotViewProps` plus the sources. The slot props are partial so the view
 * also renders outside the shell, as in the preview harness; a component with
 * partial props is still assignable to `ComponentType<SlotViewProps>`.
 *
 * The shell owns the collapse button and hides the view with `hidden`.
 * `collapsed` is still read: a collapsed panel should not scroll itself to a
 * citation it cannot show.
 *
 * `activeCitationNumber` and `activeCitationNonce` come from `useCitation()`
 * through the shell. The nonce makes a second click on the same `[n]` count as
 * a new request.
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /**
   * Every answer in the thread that has sources, oldest first.
   *
   * `undefined` means the mounter does not know yet, which is the loading
   * state. `[]` means the thread has no answers. `SourcesSlotView` passes this
   * from `answerSourcesContext`.
   */
  answers?: readonly AnswerSources[];
  /**
   * The flat list: the newest answer's sources. Read only when `answers` is
   * absent, and made a one-entry `answers` list at the top of the view.
   *
   * `undefined` means «still loading», `[]` means «no sources yet».
   */
  documents?: SourceDocument[];
  /**
   * Which answer the activated `[n]` marker sits in, so a marker in the first
   * answer can be told from one in the third. From `useCitation()`. Without
   * it, the marker is resolved against the answer on screen.
   */
  activeCitationMessageId?: string;
};
