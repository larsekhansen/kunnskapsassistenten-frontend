import type { Excerpt, SourceDocument } from '../../model';

/**
 * Excerpts as text a reader can read.
 *
 * The chunks are the corpus's own `content_markdown`: what Marker made of a
 * PDF. Measured on Kudos 2026-09-28 (Benjamin's `KUDOS_preprod_v4_*`), they
 * carry page markers (`{5}` on a line of its own, then a line of 48 dashes),
 * pipe tables with `<br>` inside the cells, `<sup>1)</sup>` footnote marks,
 * `**bold**`, `*italic*` and `- ` lists. The heading path carries the anchor
 * Marker puts before a heading, `<span id="page-4-0"></span>`, with its quotes
 * still escaped from the Clojure string it arrived in. All of it reached the
 * panel as literal text (#4 on #170, #5 on #168).
 *
 * **Stripped to text, not rendered as markdown.** An excerpt is a quote, and
 * the panel says so above the list. The search in this panel counts and
 * steps through hits by their offsets in `excerpt.text`, and the closed
 * excerpt shows the first 180 characters of it; both need the string on
 * screen to be the string they measured. Rendering markdown would draw
 * something other than what was searched, and `Markdown.tsx` would also turn
 * any heading inside a chunk into a heading in the panel's outline.
 *
 * What survives is what carries meaning: paragraphs and line breaks (drawn
 * with `white-space: pre-line`), list items as «•», and table rows as lines
 * with their cells joined by « · ». An empty cell inside a row becomes «–», so
 * the numbers in a sparse row keep their column.
 *
 * **Not a sanitiser, and it does not need to be one.** The result is only
 * ever drawn as a React text node, never as HTML, so a tag that slipped
 * through would be seen, not run. Tags are removed because they are noise.
 */

const HEADING_SEPARATOR = ' › ';

/**
 * Markdown's backslash escapes, and the `\"` the heading path keeps from the
 * Clojure string it was cut out of.
 *
 * Swapped for a private-use character first and put back last, so an escaped
 * `*` or `|` is never read as emphasis or as a table cell on the way.
 */
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|"'~<>])/g;
const PRIVATE_USE_BASE = 0xe000;
const PRIVATE_USE = /[-]/g;

function protectEscapes(text: string): string {
  return text.replace(ESCAPED, (_, char: string) =>
    String.fromCharCode(PRIVATE_USE_BASE + char.charCodeAt(0)),
  );
}

function restoreEscapes(text: string): string {
  return text.replace(PRIVATE_USE, (char) =>
    String.fromCharCode(char.charCodeAt(0) - PRIVATE_USE_BASE),
  );
}

/** Their content is not text a reader would want either. */
const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const LINE_BREAK_TAG = /<br\s*\/?>/gi;
/**
 * An HTML tag: a letter after `<` or `</`. A `<` in prose, as in «< 5 %» or
 * «a<b», has no letter straight after it, or no `>` to close it, and stays.
 */
const TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi;

/**
 * Last, after the tags are gone: `&lt;span&gt;` is a document that meant the
 * characters, and they are shown as the characters.
 */
function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, decimal?: string, hex?: string, name?: string) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
    const code = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hex ?? '', 16);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole;
  });
}

/**
 * Emphasis, links and code, inside one line or one cell.
 *
 * `_` counts only at a word boundary, so `snake_case` and a file name keep
 * theirs; `*` counts only with no space just inside it, so «5 * 3» keeps its.
 */
function stripInline(text: string): string {
  return (
    text
      .replace(SCRIPT_OR_STYLE, '')
      .replace(HTML_COMMENT, '')
      .replace(TAG, '')
      // ![alt](src) before [text](href), or the image would leave its «!».
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')
      .replace(/(?<![\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
      .replace(/(?<![\p{L}\p{N}*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}*])/gu, '$1')
      .replace(/(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu, '$1')
  );
}

/** Marker's page marker: the page number alone on its line. */
const PAGE_MARKER = /^\{\d+\}$/;
/** `---`, `***`, `___`, with or without spaces between, and a setext `===`. */
const THEMATIC_BREAK = /^(?:([-*_])(?:\s*\1){2,}|={3,})$/;
const TABLE_ROW = /^\|.*\|$/;
/** `|---|:---:|`, the line under a table's header. */
const TABLE_DELIMITER = /^\|?(?:\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?$/;

/**
 * One table row as one line: cells joined by « · ».
 *
 * A row of nothing but empty cells is spacing Marker added, and goes. Empty
 * cells at the end say nothing about where the others sit, and go too. An
 * empty cell before a filled one becomes «–», so a sparse row of numbers keeps
 * its columns.
 */
function tableRow(line: string): string | undefined {
  const cells = line
    .slice(1, -1)
    .split('|')
    .map((cell) => stripInline(cell.replace(LINE_BREAK_TAG, ' ')).replace(/\s+/g, ' ').trim());
  while (cells.length > 0 && cells.at(-1) === '') cells.pop();
  if (cells.length === 0) return undefined;
  return cells.map((cell) => cell || '–').join(' · ');
}

/**
 * An excerpt's markdown as readable text, line structure kept.
 *
 * Paragraphs stay separated by a blank line and list items and table rows by
 * a line break, so the view draws them with `white-space: pre-line`.
 */
export function readableExcerptText(markdown: string): string {
  const lines = protectEscapes(markdown.replace(/\r\n?/g, '\n'))
    .replace(SCRIPT_OR_STYLE, '')
    .replace(HTML_COMMENT, '')
    .split('\n');

  const readable: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();

    if (PAGE_MARKER.test(line) || THEMATIC_BREAK.test(line)) continue;

    if (TABLE_ROW.test(line)) {
      if (TABLE_DELIMITER.test(line)) continue;
      const row = tableRow(line);
      if (row !== undefined) readable.push(row);
      continue;
    }

    const block = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/\s+#+$/, '')
      .replace(/^>\s?/, '')
      .replace(/^[-*+]\s+/, '• ');
    readable.push(stripInline(block.replace(LINE_BREAK_TAG, '\n')).replace(/[ \t]+/g, ' '));
  }

  return decodeEntities(
    restoreEscapes(
      readable
        .join('\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    ),
  );
}

/**
 * A heading path as one readable line.
 *
 * Cleaned step by step, so a step that was nothing but an anchor disappears
 * with its separator rather than leaving «… › » behind.
 */
export function readableHeading(heading: string | undefined): string | undefined {
  if (heading === undefined) return undefined;
  const path = heading
    .split(HEADING_SEPARATOR)
    .map((step) =>
      decodeEntities(restoreEscapes(stripInline(protectEscapes(step).replace(LINE_BREAK_TAG, ' '))))
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((step) => step !== '')
    .join(HEADING_SEPARATOR);
  return path || undefined;
}

function readableExcerpt(excerpt: Excerpt): Excerpt {
  return {
    ...excerpt,
    text: readableExcerptText(excerpt.text),
    heading: readableHeading(excerpt.heading),
  };
}

/**
 * The documents with every excerpt made readable.
 *
 * Applied once, where the view receives the documents, so the search, the
 * closed preview and the open quote all read the same string.
 */
export function readableDocuments(documents: SourceDocument[]): SourceDocument[] {
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map(readableExcerpt),
  }));
}
