import type { SlotViewProps } from '../../layout/viewModel';
import type { MessageStatus, SourceDocument } from '../../model';

/**
 * The sources behind ONE answer in the thread.
 *
 * A thread has several answers, and each has its own numbering: `[2]` in the
 * first answer and `[2]` in the second point at different excerpts from
 * different documents. The panel used to hold one flat list — the last
 * answer's — so a marker in an older answer opened the newer answer's excerpt
 * with the same number. It looked right and was not
 * (design/brukerreiser-2026-09-15.md, punkt 5).
 *
 * `status` is the answer's own `MessageStatus`, not a second vocabulary: the
 * chat view already has it on the message and passes it through. It is here
 * because an empty `documents` means four different things — the answer is
 * still writing, it was stopped, it failed, or it genuinely cited nothing —
 * and the panel has to say which (`emptyStates.ts`).
 */
export type AnswerSources = {
  /** The assistant message these sources belong to. */
  messageId: string;
  /** Grouped per document (answer 57). Empty until they arrive, or if none. */
  documents: SourceDocument[];
  status: MessageStatus;
};

/**
 * What the sources view needs from whoever mounts it.
 *
 * It is `SlotViewProps` plus the sources. The slot props are partial so the
 * view also renders on its own, outside the shell, which is what the preview
 * harness does; a component with partial props is still assignable to
 * `ComponentType<SlotViewProps>`, so the shell can mount it unchanged.
 *
 * The shell owns the collapse button and hides the whole view with `hidden`
 * when the slot is collapsed, so nothing here has to draw a «Vis kilder»
 * button. `collapsed` is still read: a collapsed panel should not scroll
 * itself to a citation it cannot show.
 *
 * `activeCitationNumber` and `activeCitationNonce` come from `useCitation()`
 * through the shell. The nonce is what makes a second click on the same `[n]`
 * count as a new request (answer 19).
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /**
   * Every answer in the thread that has sources, oldest first.
   *
   * `undefined` means the mounter does not know yet, which is the loading
   * state. `[]` means the thread has no answers.
   *
   * This is the shape `answerSourcesContext` grows into (rolle-5h). Until it
   * does, the shell passes `documents` below and this stays undefined.
   */
  answers?: readonly AnswerSources[];
  /**
   * The single set the shell holds today: the last answer's sources.
   *
   * Transitional, and read only when `answers` is absent. It is normalised to
   * a one-entry `answers` list at the top of the view, so there is one code
   * path below that point. It goes away the day `answerSourcesContext` carries
   * sources per message id, and nothing but the normaliser has to change.
   *
   * `undefined` means «still loading», `[]` means «no sources yet».
   */
  documents?: SourceDocument[];
  /**
   * Which answer the activated `[n]` marker sits in.
   *
   * Without it the panel cannot tell a marker in the first answer from one in
   * the third, and switching sets is guesswork. The shell reads it from
   * `useCitation()` once `ActiveCitation` carries a message id; until then it
   * is undefined and the marker is resolved against the answer already on
   * screen, which is what the panel did before.
   */
  activeCitationMessageId?: string;
};
