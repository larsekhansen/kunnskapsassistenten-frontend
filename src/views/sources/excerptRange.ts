/**
 * «Utdrag 1–3» when the numbers run unbroken, «Utdrag 1, 2, 5» when they do
 * not, and nothing at all for a document whose excerpts the answer never
 * cited.
 *
 * It removes an ambiguity the design has: a list of documents is numbered by
 * document, the excerpts are numbered by `[n]` marker, and without this line
 * the reader meets two numbering systems with no way to tell them apart. Two
 * lists have it: the shortcuts in this panel, and «Kilder brukt i svaret»
 * under the answer.
 */
export function excerptRange(numbers: (number | undefined)[]): string {
  const sorted = numbers.filter((number) => number !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const unbroken = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);

  if (sorted.length === 1) return `Utdrag ${sorted[0]}`;
  if (unbroken) return `Utdrag ${sorted[0]}–${sorted[sorted.length - 1]}`;

  return `Utdrag ${sorted.join(', ')}`;
}
