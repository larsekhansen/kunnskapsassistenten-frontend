import type { Citation, SourceDocument } from '../../model';

/**
 * A minimal markdown reader for the answer.
 *
 * This is a placeholder. The shared `Markdown` component belongs to the
 * foundation, and when it lands this file's block parsing goes away and
 * AnswerBody calls that instead. It exists now because the mock answer
 * already contains a list and a table (answer 14), and rendering those as raw
 * pipes and dashes would hide how the answer actually reads.
 *
 * It covers exactly what answer 14 decided — heading, paragraph, markdown
 * lists, simple tables — and nothing else. No links, no emphasis, no code
 * blocks. Anything it does not know stays running text, which is the safe
 * failure for a renderer fed by a language model.
 *
 * It has to work on a half-finished string, because it runs on every token
 * while the answer streams.
 */

export type AnswerBlock =
  | { kind: 'heading'; level: 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

const CITATION = /\[(\d{1,3})\]/g;
const ORDERED_ITEM = /^\d+\.\s+/;
const TABLE_RULE = /^\|[\s:|-]+\|$/;

function tableCells(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseBlock(block: string): AnswerBlock {
  const lines = block.split('\n').map((line) => line.trim());

  if (block.startsWith('### ')) return { kind: 'heading', level: 4, text: block.slice(4).trim() };
  if (block.startsWith('## ')) return { kind: 'heading', level: 3, text: block.slice(3).trim() };

  if (lines.every((line) => line.startsWith('- ') || line.startsWith('* '))) {
    return { kind: 'list', ordered: false, items: lines.map((line) => line.slice(2).trim()) };
  }

  if (lines.every((line) => ORDERED_ITEM.test(line))) {
    return {
      kind: 'list',
      ordered: true,
      items: lines.map((line) => line.replace(ORDERED_ITEM, '').trim()),
    };
  }

  if (lines.length > 1 && lines.every((line) => line.startsWith('|'))) {
    const [head, ...rest] = lines;
    return {
      kind: 'table',
      head: tableCells(head),
      rows: rest.filter((line) => !TABLE_RULE.test(line)).map(tableCells),
    };
  }

  // Markdown soft wraps: newlines inside a paragraph are spaces, not breaks.
  return { kind: 'paragraph', text: lines.join(' ') };
}

export function parseAnswerBlocks(markdown: string): AnswerBlock[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(parseBlock);
}

/** A run of plain text, or a `[n]` marker pointing at a source excerpt. */
export type AnswerSegment =
  { kind: 'text'; text: string } | { kind: 'citation'; number: number; label: string };

/**
 * The Norwegian accessible name for a `[n]` marker.
 *
 * A marker whose citation or document cannot be resolved still gets a name,
 * because the sources arrive at the end of the stream: while the answer is
 * still being written, every marker in it is unresolved, and a nameless
 * control in the meantime is worse than a slightly vague one.
 */
export function citationLabel(
  reference: number,
  citations: Citation[] = [],
  sources: SourceDocument[] = [],
): string {
  const citation = citations.find((candidate) => candidate.number === reference);
  const document = sources.find((candidate) => candidate.id === citation?.documentId);
  return document ? `Vis kilde ${reference}: ${document.title}` : `Vis kilde ${reference}`;
}

/**
 * Pull the `[n]` markers out of a run of text.
 *
 * Figma has the citations as plain text in parentheses, but answer 19 says to
 * implement them as numbered markers that point at source n, so they are
 * turned into controls here and the model keeps producing one flat string.
 */
export function parseAnswerSegments(
  text: string,
  citations: Citation[] = [],
  sources: SourceDocument[] = [],
): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CITATION)) {
    const at = match.index;
    if (at > cursor) segments.push({ kind: 'text', text: text.slice(cursor, at) });

    const reference = Number(match[1]);
    segments.push({
      kind: 'citation',
      number: reference,
      label: citationLabel(reference, citations, sources),
    });
    cursor = at + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/** Strip the `[n]` bookkeeping from a run of text. */
function withoutMarkers(text: string): string {
  return text
    .replace(CITATION, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * The answer as a reader would want it on the clipboard (answer 15): the
 * text, not the markup and not the `[1]` bookkeeping.
 */
export function answerAsPlainText(markdown: string): string {
  return parseAnswerBlocks(markdown)
    .map((block) => {
      if (block.kind === 'list')
        return block.items.map((item) => `- ${withoutMarkers(item)}`).join('\n');
      if (block.kind === 'table') {
        return [block.head, ...block.rows]
          .map((row) => row.map(withoutMarkers).join('\t'))
          .join('\n');
      }
      return withoutMarkers(block.text);
    })
    .filter((block) => block.length > 0)
    .join('\n\n');
}

/**
 * How much of a streaming answer is safe to announce.
 *
 * A screen reader must not hear every token, and it must not hear half a
 * sentence either. Everything up to the last blank line is finished text; the
 * tail is still being written, so it waits.
 */
export function announcedText(markdown: string): string {
  const lastBreak = markdown.lastIndexOf('\n\n');
  if (lastBreak < 0) return '';
  return answerAsPlainText(markdown.slice(0, lastBreak));
}
