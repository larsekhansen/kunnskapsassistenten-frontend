import type {
  ChatError,
  Excerpt,
  RelevanceLevel,
  RetrievalDetails,
  SourceDocument,
  ThinkingStep,
} from '../../../model';
import { corpusDocument } from '../corpus';

/**
 * One cached conversation: a question the mock has a real answer for.
 *
 * Lars asked for «noen nye søk, cachede, så jeg kan teste selv». These are
 * those: ten questions across the Kudos corpus, each with the whole shape a
 * real turn has — thinking steps, a streamed answer, excerpts behind it, and
 * «Fremgangsmåte».
 *
 * **What is real and what is ours.** Every document, title, organisation,
 * year and URL comes from the corpus, and every excerpt is a literal quote
 * from that document's Kudos summary — `conversations.test.ts` checks that
 * each one is still a substring of the summary it claims to come from. The
 * answers, the thinking steps and the keywords are written by us. Nothing is
 * generated.
 */
export type ScriptedConversation = {
  id: string;
  /** The question as a user would type it. Matched loosely; see `matches`. */
  question: string;
  /** Other phrasings that should land on the same answer. */
  aliases?: string[];
  /** The thread title, which is the question until a backend writes one. */
  threadTitle: string;
  /** Markdown. Heading and paragraphs, sometimes a list or a table. */
  answer: string;
  documents: SourceDocument[];
  retrieval: RetrievalDetails;
  thinkingSteps: ThinkingStep[];
  /** Suggested next questions, shown under the answer. */
  followUps: string[];
  /**
   * The agent asking back instead of answering. The answer text is then a
   * real question to the user and there are no sources, because nothing was
   * retrieved.
   */
  outcome?: 'needs-clarification';
  /** This question fails instead of answering. */
  failure?: ChatError;
};

/** One excerpt to quote, before it is grounded in a corpus document. */
export type ExcerptDraft = {
  /**
   * A literal quote from the document's Kudos summary. Not a paraphrase: the
   * sources panel shows this as something the document says.
   */
  text: string;
  /** Where in the document, when the summary makes that clear. */
  heading?: string;
  relevance: RelevanceLevel;
  /**
   * The `[n]` in the answer that points here. Left out for an excerpt the
   * search found but the answer never cited — which is normal, and why «10
   * treff» beside five sources is right rather than a bug.
   */
  citationNumber?: number;
};

/**
 * Build a source document from the corpus, so nothing about it is typed twice.
 *
 * Title, type, organisation, year and the Kudos URL all come from the fetched
 * record. Pass an id the corpus does not have and this throws: a scripted
 * conversation that quotes a document nobody can open is worse than no
 * conversation, and a refetch that drops a document should say so loudly
 * rather than ship a broken link.
 *
 * No `page` anywhere. Kudos gives a summary per document and no page for any
 * part of it, and the brief is explicit that a page invented from nothing is
 * worse than none. The NKOM fixture keeps its pages, so the sources panel's
 * page rendering still has something to draw.
 */
export function sourceFrom(corpusId: string, drafts: ExcerptDraft[]): SourceDocument {
  const document = corpusDocument(corpusId);
  if (!document) {
    throw new Error(
      `Scriptet samtale viser til et dokument som ikke finnes i korpuset: ${corpusId}. ` +
        'Er korpuset hentet på nytt, må samtalen oppdateres.',
    );
  }

  const excerpts: Excerpt[] = drafts.map((draft, index) => ({
    id: `${corpusId}-${index + 1}`,
    text: draft.text,
    ...(draft.heading ? { heading: draft.heading } : {}),
    relevance: draft.relevance,
    kudosUrl: document.url,
    ...(draft.citationNumber === undefined ? {} : { citationNumber: draft.citationNumber }),
  }));

  return {
    id: document.id,
    title: document.title,
    url: document.url,
    documentType: document.type,
    organisation: document.organisation,
    year: document.year,
    excerpts,
  };
}
