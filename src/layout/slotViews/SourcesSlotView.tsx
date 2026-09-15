import { SourcesView } from '../../views/sources';
import { useAnswerSources } from '../useAnswerSources';
import type { SlotViewProps } from '../viewModel';

/**
 * Mounts the sources view in whichever slot holds it.
 *
 * The view draws documents it is handed; the shell is what holds them, since
 * they are produced by the chat view and the two may not import each other.
 * See answerSourcesContext.ts.
 *
 * The shell now also carries sources per answer and which answer an activated
 * marker sits in — `answers` and `activeCitation.messageId`. They are NOT
 * passed on yet, because the props that take them arrive with #4's PR #36.
 * The two lines are:
 *
 *     answers={answers}
 *     activeCitationMessageId={activeCitation?.messageId}
 *
 * and they go in the moment that PR is on main. Until then the view falls
 * back to the flat list, which is exactly what it is built to do.
 */
export function SourcesSlotView(props: SlotViewProps) {
  const { documents } = useAnswerSources();
  return <SourcesView {...props} documents={documents} />;
}
