import type { RelevanceLevel } from '../../model';

/**
 * Relevance level -> the Tag colour that carries it.
 *
 * The Norwegian labels come from `relevanceLabels` in `src/model/source.ts`,
 * shared with the answer; only the colour is a presentation choice and lives
 * here.
 *
 * The mapping is the one `design/omraader/atoms/skjermer/relevance.md` calls
 * «sannsynlig, ikke verifisert»: green, blue, grey. Nothing here is a hex
 * value — `data-color` swaps the theme tokens, which is how Designsystemet
 * expects a Tag to be coloured. Colour never carries the meaning on its own;
 * the label says the level, which Tag's own accessibility note requires.
 */
export const relevanceTagColor: Record<RelevanceLevel, 'success' | 'info' | 'neutral'> = {
  high: 'success',
  medium: 'info',
  low: 'neutral',
};
