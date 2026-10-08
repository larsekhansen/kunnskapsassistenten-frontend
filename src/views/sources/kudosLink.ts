/**
 * What the link out to Kudos can honestly promise.
 *
 * - `https://kudos.dfo.no/dokument/<uuid>` is a landing page with the
 *   document's summary. It has no PDF viewer and no per-page anchors, so no
 *   fragment on it scrolls anywhere: `#side-41` and `#page=41` land at the top.
 * - The PDF is a separate address,
 *   `https://kudos.dfo.no/dokument/<uuid>/filer/<fil-uuid>.pdf`, served inline
 *   as `application/pdf`. The browser's viewer honours `#page=N`.
 *
 * So «Les side 41 på Kudos» is only true for the file with `#page=41` on it.
 * Anywhere else the link opens the document at the top, and says so. The
 * excerpt prints «side 41» above the quote either way.
 *
 * The rule asks about the address rather than a flag from the data, so the
 * label follows when the backend hands out file URLs.
 */

/** True when this address opens the named page, not just the document. */
export function reachesPage(kudosUrl: string, page: number): boolean {
  const hash = kudosUrl.slice(kudosUrl.indexOf('#'));

  return kudosUrl.includes('#') && hash === `#page=${page}`;
}

/**
 * The link text for an excerpt's «read it at the source» link.
 *
 * The corpus is the answer's, named rather than written in: «Les dokumentet
 * på Kudos» over a NorQuAD article would be false.
 *
 * `undefined` when nothing names the corpus, and then the link says only what
 * it does. A link label is a name for a control, so it does not take the
 * disclaimer's «standardkorpuset» stand-in.
 *
 * Only a file URL with `#page=N` opens a page, whoever serves it; anything
 * else says «dokumentet».
 */
export function kudosLinkLabel(
  kudosUrl: string,
  page: number | undefined,
  corpusName: string | undefined,
): string {
  const what =
    page !== undefined && reachesPage(kudosUrl, page) ? `Les side ${page}` : 'Les dokumentet';

  return corpusName === undefined ? what : `${what} på ${corpusName}`;
}

/** The same, for a document card's own link, which never names a page. */
export function documentLinkLabel(corpusName: string | undefined): string {
  return corpusName === undefined ? 'Les dokumentet' : `Les dokumentet på ${corpusName}`;
}
