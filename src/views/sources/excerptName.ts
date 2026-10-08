/**
 * What names one excerpt apart from the others in the panel.
 *
 * The toggle and the links need it, and neither can use its visible text:
 * every toggle says «Åpne» and every link «Les dokumentet på Kudos», which a
 * screen reader listing them reads as identical rows (WCAG 2.4.9).
 *
 * A cited excerpt is named by its citation number: the `[n]` in the answer and
 * the «Utdrag n» heading, unique across the panel.
 *
 * An uncited excerpt is named by where it sits in its document, «utdrag 2 av
 * 5», which is unique within the document. The link adds the document title,
 * and the toggle, under its own document heading, does not. The mock has no
 * uncited excerpts, but in live data they are ordinary.
 */
export function excerptName(
  citationNumber: number | undefined,
  /** 1-based position of this excerpt among its document's excerpts. */
  position: number,
  /** How many excerpts that document has. */
  total: number,
): string {
  return citationNumber !== undefined
    ? `utdrag ${citationNumber}`
    : `utdrag ${position} av ${total}`;
}
