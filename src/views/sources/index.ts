/**
 * The sources view: what sits in the secondary sidebar (answer 49).
 *
 * The scroll targets are exported as well, because the `[n]` markers in the
 * answer have to point at them. `excerptDomId` is re-exported from the model
 * rather than redefined, so the main column can import it from here without
 * reaching into this folder, and both sides still build the id from one
 * function.
 */
export { SourcesView } from './SourcesView';
export type { AnswerSources, SourcesViewProps } from './types';
export { documentDomId } from './ids';
export { excerptDomId } from '../../model';
