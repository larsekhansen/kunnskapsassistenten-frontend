/**
 * The answer as text rather than as markup.
 *
 * Two places need the answer without its markup: the clipboard («Kopier
 * svaret», answer 15) and the live region that follows a streaming answer.
 * `Markdown` renders; it does not read back, so this is the small amount of
 * text handling that stays here. It deliberately does no block parsing and no
 * component mapping — that is `src/components/Markdown.tsx` and only there.
 */

/*
 * A marker and the space in front of it. The space goes with the marker,
 * because «kvartalsvis [1].» would otherwise be pasted as «kvartalsvis .»
 */
const CITATION = /[ \t]?\[\d{1,3}\]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/;

/**
 * Markdown stripped down to what a reader would paste into a document.
 *
 * The `[1]` markers go: they are bookkeeping that points at a panel the
 * clipboard cannot carry. Headings and list items keep their text and lose
 * their marks. Table rows become tab separated, so a paste into a spreadsheet
 * still has columns.
 */
export function answerAsPlainText(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line.startsWith('|')
        ? line
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim())
            .join('\t')
        : line.replace(BLOCK_SYNTAX, ''),
    )
    .join('\n')
    .replace(CITATION, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
