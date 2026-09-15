import type { Citation, Message, ThreadDetail } from '../../../model';
import { daysAgo } from '../clock';
import { scriptedConversations } from './scripts';
import type { ScriptedConversation } from './types';

/**
 * The `[n]` markers in a conversation's answer, resolved.
 *
 * Derived from the excerpts rather than written out beside them, so a
 * renumbered excerpt cannot end up pointing at the wrong one. Excerpts the
 * answer never cited carry no number and are skipped.
 */
export function citationsFor(conversation: ScriptedConversation): Citation[] {
  return conversation.documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .map(({ document, excerpt }) => ({
      number: excerpt.citationNumber!,
      excerptId: excerpt.id,
      documentId: document.id,
    }))
    .sort((a, b) => a.number - b.number);
}

/**
 * How long ago each scripted conversation was had, in days.
 *
 * The same spread the thread list had when its rows were titles and nothing
 * else: today, this week, this month, some months back, and one from last
 * year. That spread is the point — it is what keeps every bucket in
 * `views/threads/grouping.ts` drawn on a page anybody opens, and a list where
 * everything happened today would quietly stop testing four of them.
 *
 * Paired with `scriptedConversations` by position, so a conversation added to
 * that list needs a day here too. `conversations.test.ts` checks the two
 * stay the same length rather than letting the last one fall off the end.
 */
const daysOld = [0, 3, 4, 6, 7, 12, 18, 26, 48, 310];

/**
 * A scripted conversation, as a thread that is already in the list.
 *
 * The question, then the answer with everything behind it: the sources
 * grouped per document, the `[n]` markers resolved against them, the thinking
 * steps, and «Fremgangsmåte». Opening one of these from the list is the same
 * screen as asking the question and waiting — which is the whole point, and
 * what it was not: the rows were titles with no conversation under them, so
 * every thread a reader opened from the list was empty. Punkt 16 på
 * brukerreise-lista, målt av #4.
 */
function threadFor(conversation: ScriptedConversation, days: number): ThreadDetail {
  const asked = daysAgo(days, 8);
  const answered = daysAgo(days, 9);

  const question: Message = {
    id: `${conversation.id}-question`,
    role: 'user',
    content: conversation.question,
    createdAt: asked,
    citations: [],
    status: 'complete',
  };

  /*
   * `needs-clarification` is a finished turn and not a failed one: the agent
   * answered that it cannot answer yet and asked back. The message list draws
   * it as a question to the reader, and there are no sources because nothing
   * was retrieved — which is why `documents` being empty here is right rather
   * than missing.
   */
  const answer: Message = {
    id: `${conversation.id}-answer`,
    role: 'assistant',
    content: conversation.answer,
    createdAt: answered,
    citations: citationsFor(conversation),
    sources: conversation.documents,
    retrieval: conversation.retrieval,
    thinkingSteps: conversation.thinkingSteps,
    status: conversation.outcome === 'needs-clarification' ? 'needs-clarification' : 'complete',
  };

  return {
    id: conversation.id,
    title: conversation.threadTitle,
    createdAt: asked,
    updatedAt: answered,
    messages: [question, answer],
  };
}

/**
 * The scripted conversations as threads, with their content.
 *
 * All of them but one. `klima-feil` is the conversation that FAILS, and a
 * failed turn has no answer to store: its `answer` is the empty string on
 * purpose, because the text a reader sees belongs to the view
 * (`views/chat/errorText.ts`, keyed on the error code) and the alert is
 * driven by the live turn's own state rather than by a message. Writing it
 * down as a thread would put an empty bubble in the list with nothing to say
 * what went wrong. It stays reachable the way it was meant to be reached, by
 * asking the question.
 */
export const scriptedThreads: ThreadDetail[] = scriptedConversations
  .filter((conversation) => conversation.failure === undefined)
  .map((conversation, index) => threadFor(conversation, daysOld[index] ?? 0));
