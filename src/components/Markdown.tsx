import { Heading, Link, List, Paragraph, Table } from '@digdir/designsystemet-react';
import { Children, useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CitationTarget } from '../model';
import { HighlightedText } from './HighlightedText';
import { MIN_QUERY_LENGTH, findHits } from './textSearch';

/**
 * Renders an answer's markdown onto Designsystemet components.
 *
 * Lars settled the answer structure on 2026-09-11 (answer 14): a heading plus
 * paragraphs, with markdown lists and simple tables inside the flow. The
 * mapping below is the one in design/designsystemet/behov-til-komponent.md.
 *
 * Three things Designsystemet does not cover, and which are therefore written
 * by hand in src/styles/global.css: `pre`/`code`, `blockquote`, and the
 * spacing between blocks (there is no prose container). The fourth is the
 * horizontal scroll box around wide tables — `Table` does not scale down, and
 * the answer column is at most 800 px.
 */
export type MarkdownProps = {
  /** The markdown to render. */
  children: string;
  /**
   * Heading level for a top-level `#`. Deeper headings count up from here and
   * stop at 6. The default is 2, because an answer sits directly under the
   * page heading. Raise it when the answer sits under a heading of its own,
   * so the document never skips a level. Level is semantics; the visual size
   * follows the depth in the markdown, not the level.
   */
  startLevel?: 2 | 3 | 4;
  /**
   * Turns the `[n]` markers in the text into links to excerpt n in the
   * sources panel. Markers with no target stay plain text, which is
   * what should happen when the model cites something that is not there.
   */
  citations?: CitationTarget[];
  /**
   * The sources for this answer never arrived, so a `[n]` in it points at
   * nothing.
   *
   * Set it for an answer the user stopped mid-stream: the markers are
   * written, the excerpts were still on their way. The marker is then drawn
   * as text that says why instead of as a dead link.
   *
   * Off by default, and that matters: an answer that asks a clarifying
   * question can contain a `[1]` as ordinary prose, and nothing was lost
   * there — no search ran. Saying «kilden kom ikke fram» about it would be a
   * lie. Only the caller knows which case it is.
   */
  sourcesLost?: boolean;
  /** Called when the reader activates a marker, with its number. */
  onCitationActivate?: (citationNumber: number) => void;
  /**
   * Wraps every occurrence of this string in `<mark>`, one block at a time.
   *
   * Shorter than `MIN_QUERY_LENGTH` marks nothing, which is the same rule the
   * sources panel searches by — there is one search mechanism, not two
   * (answers 27 and 55).
   *
   * What is deliberately NOT here is which hit is the current one, or how
   * many there are. Both are questions about reading order, and reading order
   * is what the rendered document already knows: the `<mark>` elements come
   * back from `querySelectorAll` in exactly that order. So the caller counts
   * and steps through them in the DOM, and this component stays a pure
   * function of its markdown. See `AnswerSearch` in the chat view.
   */
  searchQuery?: string;
  /**
   * Class on each `<mark>`, so the highlight sits on the caller's own
   * surface. Left out, the browser's default yellow stands in.
   */
  markClassName?: string;
};

const CITATION_MARKER = /\[(\d+)\]/g;

/**
 * Replaces `[n]` in the text with a superscript link to the excerpt.
 *
 * A bare «[3]» tells a screen reader user nothing, so the link carries the
 * document and page as its accessible name. Convention decided 2026-09-11:
 * the marker points at an EXCERPT, not at a document.
 */
/**
 * What a `[n]` says when the excerpt behind it never arrived.
 *
 * Norwegian, because a user reads it. An answer the user stopped has markers
 * whose sources were still on their way.
 */
export const MISSING_SOURCE = 'Kilden kom ikke fram';

function withCitations(
  children: ReactNode,
  targets: Map<number, CitationTarget>,
  onActivate?: (citationNumber: number) => void,
  sourcesLost?: boolean,
): ReactNode {
  /*
   * No early return when there are no targets, and that is the point rather
   * than an oversight. An answer the user stopped has markers and no sources
   * at all, so `targets` is empty — and that is exactly the case the
   * unlinked marker below exists for. Returning early here meant the
   * explanation never appeared for the one answer that needed it. Caught by
   * its own test.
   *
   * Prose without markers costs one regex that matches nothing.
   */

  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child;

    const parts: ReactNode[] = [];
    let consumed = 0;

    for (const match of child.matchAll(CITATION_MARKER)) {
      const number = Number(match[1]);
      const target = targets.get(number);

      /*
       * A marker with no excerpt behind it. It happens for real: an answer
       * stopped mid-stream has written `[3]` but the sources never arrived,
       * so there is nothing to point at. Found by #3.
       *
       * It stays plain text — a link to nowhere is worse than no link — but
       * it says why, so a reader is not left wondering whether they missed
       * something. `title` alone would be mouse-only, hence the second half
       * for anyone listening.
       */
      if (!target) {
        if (!sourcesLost) continue;
        if (match.index > consumed) parts.push(child.slice(consumed, match.index));
        parts.push(
          <sup
            className="markdown__citation"
            title={MISSING_SOURCE}
            key={`${childIndex}-${match.index}`}
          >
            {match[0]}
            <span className="ds-sr-only"> ({MISSING_SOURCE.toLocaleLowerCase('nb-NO')})</span>
          </sup>,
        );
        consumed = match.index + match[0].length;
        continue;
      }

      if (match.index > consumed) parts.push(child.slice(consumed, match.index));
      parts.push(
        <sup className="markdown__citation" key={`${childIndex}-${match.index}`}>
          <Link
            href={`#${target.targetId}`}
            aria-label={target.label}
            title={target.label}
            /*
              `preventDefault`, because the href must not be followed.
              `onActivate` already opens the sources panel and moves focus to
              the excerpt, so the browser's own fragment jump adds nothing —
              and once the conversation has an address it costs everything:
              the marker then resolves to `/threads/:id#excerpt-n`, which is a
              real navigation, and the chat slot remounts with the whole
              conversation inside it. Measured by #3 against PR #25: 5 e2e red.

              The href stays. It is what makes this a link for a screen
              reader, for «open in new tab» and for copying the address of an
              excerpt, and none of those go through this handler.
            */
            onClick={(event) => {
              event.preventDefault();
              onActivate?.(number);
            }}
          >
            {match[0]}
          </Link>
        </sup>,
      );
      consumed = match.index + match[0].length;
    }

    if (parts.length === 0) return child;
    if (consumed < child.length) parts.push(child.slice(consumed));
    return parts;
  });
}

/**
 * The same children again, with search matches wrapped in `<mark>`.
 *
 * Runs after `withCitations` and over its output, so a `[n]` that has already
 * become a link is left alone and only the prose around it is searched. The
 * matching is `findHits`, the splitting is `HighlightedText`: the sources
 * panel searches by the same two, and a second implementation of «what counts
 * as a match» would drift from it within the week.
 *
 * One block at a time, because that is what react-markdown hands over. A
 * query spanning a paragraph boundary finds nothing, which is also true of
 * the browser's own find.
 */
function withHighlights(children: ReactNode, query: string, markClassName?: string): ReactNode {
  if (query.trim().length < MIN_QUERY_LENGTH) return children;

  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    const hits = findHits([{ id: 'block', kind: 'answer', text: child }], query);
    if (hits.length === 0) return child;

    return <HighlightedText text={child} hits={hits} markClassName={markClassName} />;
  });
}

const sizeByDepth = ['md', 'sm', 'xs', '2xs', '2xs', '2xs'] as const;

function headingComponents(
  startLevel: number,
  decorateHeading: (children: ReactNode) => ReactNode,
): Partial<Components> {
  const entries = ([1, 2, 3, 4, 5, 6] as const).map((depth) => {
    const level = Math.min(startLevel + depth - 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const render = ({ children }: { children?: React.ReactNode }) => (
      <Heading level={level} data-size={sizeByDepth[depth - 1]}>
        {decorateHeading(children)}
      </Heading>
    );
    return [`h${depth}`, render] as const;
  });
  return Object.fromEntries(entries);
}

export function Markdown({
  children,
  startLevel = 2,
  citations,
  onCitationActivate,
  sourcesLost,
  searchQuery = '',
  markClassName,
}: MarkdownProps) {
  const targets = useMemo(
    () => new Map((citations ?? []).map((target) => [target.number, target])),
    [citations],
  );

  const components = useMemo<Components>(() => {
    const decorate = (content: ReactNode) =>
      withHighlights(
        withCitations(content, targets, onCitationActivate, sourcesLost),
        searchQuery,
        markClassName,
      );

    return {
      ...headingComponents(startLevel, (content) =>
        withHighlights(content, searchQuery, markClassName),
      ),
      p: ({ children: content }) => <Paragraph variant="long">{decorate(content)}</Paragraph>,
      ul: ({ children: content }) => <List.Unordered>{content}</List.Unordered>,
      ol: ({ children: content }) => <List.Ordered>{content}</List.Ordered>,
      li: ({ children: content }) => <List.Item>{decorate(content)}</List.Item>,
      a: ({ children: content, href }) => <Link href={href}>{content}</Link>,
      // A wide table gets its own scroll box, and a scrollable box must be
      // reachable by keyboard and carry a name. Pattern from
      // design/designsystemet/behov-til-komponent.md, question 14.
      table: ({ children: content }) => (
        // A scrollable box has to be reachable from the keyboard (WCAG 2.1.1).
        // Chrome and Firefox now focus scroll containers on their own, Safari
        // does not, so the tabIndex stays. The rule below assumes tabIndex on
        // a non-interactive element is a mistake; here it is the fix.
        //
        // `ds-focus` draws the ring on :focus-visible. NOT `ds-focus--visible`,
        // which is the forced-on variant and painted a 3 px ring around every
        // table in every answer at rest — worst in dark mode, where it read as
        // a border nobody had drawn (brukerblikk 3, funn 3). The same note is
        // in src/views/filters/DocumentsList.tsx, which got the choice right.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <section className="markdown__table ds-focus" aria-label="Tabell" tabIndex={0}>
          <Table data-size="sm">{content}</Table>
        </section>
      ),
      thead: ({ children: content }) => <Table.Head>{content}</Table.Head>,
      tbody: ({ children: content }) => <Table.Body>{content}</Table.Body>,
      tfoot: ({ children: content }) => <Table.Foot>{content}</Table.Foot>,
      tr: ({ children: content }) => <Table.Row>{content}</Table.Row>,
      th: ({ children: content }) => <Table.HeaderCell>{content}</Table.HeaderCell>,
      td: ({ children: content }) => <Table.Cell>{decorate(content)}</Table.Cell>,
      // Designsystemet styles none of these three. See global.css.
      pre: ({ children: content }) => <pre className="markdown__pre">{content}</pre>,
      code: ({ children: content }) => <code className="markdown__code">{content}</code>,
      blockquote: ({ children: content }) => (
        <blockquote className="markdown__quote">{content}</blockquote>
      ),
    };
  }, [startLevel, targets, onCitationActivate, sourcesLost, searchQuery, markClassName]);

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
