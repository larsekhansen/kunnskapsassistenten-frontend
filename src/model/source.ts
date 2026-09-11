/**
 * How relevant an excerpt is to the question. Three levels, because the
 * design draws three tags: «Mest relevant», «Relevant», «Minst relevant».
 *
 * backend: mangler, se API-bestilling A1 — the MCP answer ranks chunks by
 * order only, it carries no relevance score.
 */
export type RelevanceLevel = 'high' | 'medium' | 'low';

/**
 * The Norwegian tag text for each level. Shared so the sources panel, the
 * answer and any future filtering agree on the wording.
 */
export const relevanceLabels: Record<RelevanceLevel, string> = {
  high: 'Mest relevant',
  medium: 'Relevant',
  low: 'Minst relevant',
};

/**
 * One excerpt — a chunk — from a source document. A «treff» in
 * «Fremgangsmåte» is exactly one of these (answer 12).
 */
export interface Excerpt {
  id: string;
  /**
   * The quoted passage. Everything the user reads in the sources panel is a
   * literal quote from the document, never generated text.
   * backend: mangler, se API-bestilling A1 — `structuredContent.chunks`
   * carries id, title and length, not the text itself. Only `/v1` has it.
   */
  text: string;
  /**
   * Heading path inside the document, e.g. «Ressursbruk og måloppnåelse».
   * The backend ships it as a Clojure map in a string, so it needs parsing.
   */
  heading?: string;
  /** Page in the source document, when the corpus has pages. */
  page?: number;
  relevance: RelevanceLevel;
  /**
   * «Les dokumentet på Kudos». Absent for folder-based corpora, where the
   * backend returns `url: null` — never render a link without checking.
   */
  kudosUrl?: string;
  /**
   * 1-indexed position in the answer's flat excerpt list, which is what a
   * `[n]` marker in the answer text points at. See {@link Citation}.
   */
  citationNumber: number;
}

/**
 * A source document with the excerpts the answer used. Excerpts are grouped
 * per document so the title is not repeated per excerpt (answer 57).
 */
export interface SourceDocument {
  id: string;
  title: string;
  /** Public URL, when the corpus has one. Absent is normal, not an error. */
  url?: string;
  /** «Årsrapport», «Tildelingsbrev», … Same vocabulary as the filter facets. */
  documentType?: string;
  /** The organisation that published the document. */
  organisation?: string;
  year?: number;
  excerpts: Excerpt[];
}
