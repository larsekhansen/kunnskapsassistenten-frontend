import corpus from './kudos-korpus.json' with { type: 'json' };

/**
 * One document in the mock corpus.
 *
 * Everything in it is real: the title, the type, the organisation, the year
 * and the summary Kudos publishes. Nothing is generated. The answers and the
 * thinking steps in the scripted conversations are ours and live elsewhere.
 *
 * Fetched by scripts/fetch-mock-corpus.mjs; see the header in that file and
 * the metadata at the top of the JSON.
 */
export type CorpusDocument = {
  /** The Kudos uuid, and the id an excerpt points back to. */
  id: string;
  title: string;
  /** «Årsrapport», «Evaluering», «Tildelingsbrev», «Statusrapport», «Strategi/plan». */
  type: string;
  /** The organisation that owns the document, under the name it goes by. */
  organisation: string;
  /** The year the document is ABOUT, not the year it was published. */
  year: number;
  /** Kudos's own summary. This is what excerpts are quoted from. */
  summary: string;
  /** The document's page on Kudos, for «Les dokumentet på Kudos». */
  url: string;
};

type Corpus = {
  source: string;
  fetched: string;
  note: string;
  counts: { total: number; byType: Record<string, number> };
  documents: CorpusDocument[];
};

const loaded = corpus as Corpus;

export const corpusDocuments: CorpusDocument[] = loaded.documents;

/** Where the corpus came from and when, for the README and for the console. */
export const corpusSource = { source: loaded.source, fetched: loaded.fetched };

/** Lookup by Kudos uuid, for the scripted conversations' excerpts. */
const byId = new Map(corpusDocuments.map((document) => [document.id, document]));

export function corpusDocument(id: string): CorpusDocument | undefined {
  return byId.get(id);
}
