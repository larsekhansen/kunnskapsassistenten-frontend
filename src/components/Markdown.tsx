import { Heading, Link, List, Paragraph, Table } from '@digdir/designsystemet-react';
import { Children, useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CitationTarget } from '../model';

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
  /** Called when the reader activates a marker, with its number. */
  onCitationActivate?: (citationNumber: number) => void;
};

const CITATION_MARKER = /\[(\d+)\]/g;

/**
 * Replaces `[n]` in the text with a superscript link to the excerpt.
 *
 * A bare «[3]» tells a screen reader user nothing, so the link carries the
 * document and page as its accessible name. Convention decided 2026-09-11:
 * the marker points at an EXCERPT, not at a document.
 */
function withCitations(
  children: ReactNode,
  targets: Map<number, CitationTarget>,
  onActivate?: (citationNumber: number) => void,
): ReactNode {
  if (targets.size === 0) return children;

  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child;

    const parts: ReactNode[] = [];
    let consumed = 0;

    for (const match of child.matchAll(CITATION_MARKER)) {
      const number = Number(match[1]);
      const target = targets.get(number);
      if (!target) continue;

      if (match.index > consumed) parts.push(child.slice(consumed, match.index));
      parts.push(
        <sup className="markdown__citation" key={`${childIndex}-${match.index}`}>
          <Link
            href={`#${target.targetId}`}
            aria-label={target.label}
            title={target.label}
            onClick={() => onActivate?.(number)}
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

const sizeByDepth = ['md', 'sm', 'xs', '2xs', '2xs', '2xs'] as const;

function headingComponents(startLevel: number): Partial<Components> {
  const entries = ([1, 2, 3, 4, 5, 6] as const).map((depth) => {
    const level = Math.min(startLevel + depth - 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const render = ({ children }: { children?: React.ReactNode }) => (
      <Heading level={level} data-size={sizeByDepth[depth - 1]}>
        {children}
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
}: MarkdownProps) {
  const targets = useMemo(
    () => new Map((citations ?? []).map((target) => [target.number, target])),
    [citations],
  );

  const components = useMemo<Components>(
    () => ({
      ...headingComponents(startLevel),
      p: ({ children: content }) => (
        <Paragraph variant="long">{withCitations(content, targets, onCitationActivate)}</Paragraph>
      ),
      ul: ({ children: content }) => <List.Unordered>{content}</List.Unordered>,
      ol: ({ children: content }) => <List.Ordered>{content}</List.Ordered>,
      li: ({ children: content }) => (
        <List.Item>{withCitations(content, targets, onCitationActivate)}</List.Item>
      ),
      a: ({ children: content, href }) => <Link href={href}>{content}</Link>,
      // A wide table gets its own scroll box, and a scrollable box must be
      // reachable by keyboard and carry a name. Pattern from
      // design/designsystemet/behov-til-komponent.md, question 14.
      table: ({ children: content }) => (
        // A scrollable box has to be reachable from the keyboard (WCAG 2.1.1).
        // Chrome and Firefox now focus scroll containers on their own, Safari
        // does not, so the tabIndex stays. The rule below assumes tabIndex on
        // a non-interactive element is a mistake; here it is the fix.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <section className="markdown__table ds-focus--visible" aria-label="Tabell" tabIndex={0}>
          <Table data-size="sm">{content}</Table>
        </section>
      ),
      thead: ({ children: content }) => <Table.Head>{content}</Table.Head>,
      tbody: ({ children: content }) => <Table.Body>{content}</Table.Body>,
      tfoot: ({ children: content }) => <Table.Foot>{content}</Table.Foot>,
      tr: ({ children: content }) => <Table.Row>{content}</Table.Row>,
      th: ({ children: content }) => <Table.HeaderCell>{content}</Table.HeaderCell>,
      td: ({ children: content }) => (
        <Table.Cell>{withCitations(content, targets, onCitationActivate)}</Table.Cell>
      ),
      // Designsystemet styles none of these three. See global.css.
      pre: ({ children: content }) => <pre className="markdown__pre">{content}</pre>,
      code: ({ children: content }) => <code className="markdown__code">{content}</code>,
      blockquote: ({ children: content }) => (
        <blockquote className="markdown__quote">{content}</blockquote>
      ),
    }),
    [startLevel, targets, onCitationActivate],
  );

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
