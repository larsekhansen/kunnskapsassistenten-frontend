import type { SlotViewProps } from '../../layout/viewModel';
import type { AnswerSources, SourceDocument } from '../../model';

/**
 * `SlotViewProps`, partial so the view also renders outside the shell, plus the
 * sources. The nonce makes a second click on the same `[n]` count.
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /**
   * Every answer with sources, oldest first. `undefined` is loading, and `[]` is
   * a thread with no answers.
   */
  answers?: readonly AnswerSources[];
  /**
   * The newest answer's sources, read only without `answers`. `undefined` is
   * loading, and `[]` is no sources yet.
   */
  documents?: SourceDocument[];
  /**
   * The answer the activated marker sits in. Without it, the marker is resolved
   * against the answer on screen.
   */
  activeCitationMessageId?: string;
};
