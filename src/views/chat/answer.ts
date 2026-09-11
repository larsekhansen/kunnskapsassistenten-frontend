import type { AnswerBlock, SourceReference } from './types';

/**
 * Split a streamed answer into heading and paragraph blocks.
 *
 * A placeholder for the shared Markdown component. The answer structure is
 * decided (answer 14): heading plus paragraph, with markdown lists and simple
 * tables inside the paragraph. Lists and tables need the real renderer, so
 * this handles the two block kinds the design actually shows and leaves
 * everything else as running text.
 *
 * It has to work on a half-finished string, because it runs on every token
 * while the answer streams.
 */
export function parseAnswerBlocks(text: string): AnswerBlock[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      if (block.startsWith('### ')) {
        return { kind: 'heading', level: 4, text: block.slice(4).trim() } as const;
      }
      if (block.startsWith('## ')) {
        return { kind: 'heading', level: 3, text: block.slice(3).trim() } as const;
      }
      return { kind: 'paragraph', text: block } as const;
    });
}

/** A run of plain text, or a `[n]` citation marker pointing at a source. */
export type AnswerSegment =
  | { kind: 'text'; text: string }
  | { kind: 'citation'; number: number; source?: SourceReference };

const CITATION = /\[(\d{1,3})\]/g;

/**
 * Pull the `[n]` markers out of a paragraph.
 *
 * Figma has the citations as plain text in parentheses, but answer 19 says to
 * implement them as numbered markers that point at source n. The markers are
 * therefore part of the answer text and are turned into controls here, so the
 * model can keep producing one flat string.
 *
 * An `[n]` without a matching source still renders as a marker; dropping it
 * would silently swallow a citation the model made.
 */
export function parseAnswerSegments(
  text: string,
  sources: SourceReference[] = [],
): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CITATION)) {
    const at = match.index;
    if (at > cursor) segments.push({ kind: 'text', text: text.slice(cursor, at) });

    const number = Number(match[1]);
    segments.push({
      kind: 'citation',
      number,
      source: sources.find((source) => source.number === number),
    });
    cursor = at + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/**
 * The answer as a reader would copy it: markers removed, blocks kept apart.
 *
 * «Kopier svaret» (answer 15) should put the text on the clipboard, not the
 * markup and not the `[1]` bookkeeping.
 */
export function answerAsPlainText(text: string): string {
  return parseAnswerBlocks(text)
    .map((block) => block.text.replace(CITATION, '').replace(/[ \t]+/g, ' ').trim())
    .join('\n\n');
}

/**
 * How much of a streaming answer is safe to announce.
 *
 * A screen reader must not hear every token, and it must not hear half a
 * sentence either. Everything up to the last blank line is finished text; the
 * tail is still being written, so it waits.
 */
export function announcedText(text: string): string {
  const lastBreak = text.lastIndexOf('\n\n');
  if (lastBreak < 0) return '';
  return answerAsPlainText(text.slice(0, lastBreak));
}
