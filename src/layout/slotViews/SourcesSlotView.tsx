import { SourcesView } from '../../views/sources';
import { useAnswerSources } from '../useAnswerSources';
import type { SlotViewProps } from '../viewModel';

/**
 * Mounts the sources view in whichever slot holds it.
 *
 * The view draws documents it is handed; the shell is what holds them, since
 * they are produced by the chat view and the two may not import each other.
 * See answerSourcesContext.ts.
 */
export function SourcesSlotView(props: SlotViewProps) {
  const { documents } = useAnswerSources();
  return <SourcesView {...props} documents={documents} />;
}
