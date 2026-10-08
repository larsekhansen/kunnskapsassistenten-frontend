/**
 * «Utdrag 1–3» when the numbers run unbroken, «Utdrag 1, 2, 5» when they do
 * not, and nothing for a document whose excerpts the answer never cited.
 *
 * A list of documents is numbered by document and the excerpts by `[n]`, and
 * without this line the reader meets two numberings with no way to tell them
 * apart. «Kilder brukt i svaret» under the answer uses it. It lives here
 * because the excerpts and their numbers are this panel's.
 */
export function excerptRange(numbers: (number | undefined)[]): string {
  const sorted = numbers.filter((number) => number !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const unbroken = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);

  if (sorted.length === 1) return `Utdrag ${sorted[0]}`;
  if (unbroken) return `Utdrag ${sorted[0]}–${sorted[sorted.length - 1]}`;

  return `Utdrag ${sorted.join(', ')}`;
}
