import { Heading, Link, List, Paragraph, Table } from '@digdir/designsystemet-react';
import type { Citation, SourceDocument } from '../../model';
import { parseAnswerBlocks, parseAnswerSegments, type AnswerSegment } from './answer';
import { excerptAnchor } from './sourceAnchor';

type AnswerBodyProps = {
  /** The answer as markdown, possibly half written. */
  content: string;
  citations?: Citation[];
  sources?: SourceDocument[];
  /** Still streaming? Adds the caret after the last block. */
  streaming?: boolean;
  /** Opens source `n` in the sources panel (answer 19). */
  onSelectSource?: (citationNumber: number) => void;
};

/*
 * Keys are indices throughout this file on purpose: the blocks and segments
 * are reparsed from one string on every token, so nothing in them has an
 * identity that outlives a render. An index is the honest key here.
 */
function Segments({
  text,
  citations,
  sources,
  onSelectSource,
}: {
  text: string;
  citations?: Citation[];
  sources?: SourceDocument[];
  onSelectSource?: (citationNumber: number) => void;
}) {
  const segments: AnswerSegment[] = parseAnswerSegments(text, citations, sources);

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <Link
            aria-label={segment.label}
            className="ka-citation"
            href={`#${excerptAnchor(segment.number)}`}
            key={index}
            onClick={() => onSelectSource?.(segment.number)}
          >
            [{segment.number}]
          </Link>
        ),
      )}
    </>
  );
}

/**
 * The answer itself: heading plus paragraph, with markdown lists and simple
 * tables in the flow (answer 14).
 *
 * Two things are deliberate here:
 *
 *   1. The `[n]` markers are links, not text. Figma leaves them as plain
 *      parentheses, but answer 19 says a citation must reach the excerpt it
 *      came from. A link to the excerpt's anchor is what does that, and it is
 *      also what makes the marker work with a keyboard and in a new tab.
 *   2. Heading levels are ours, not the model's. The answer sits under the
 *      thread title, so `##` is a level 3 and `###` a level 4 regardless of
 *      what the model wrote. Size is a look, level is a structure, and they
 *      are set separately.
 *
 * A table gets its own scroll container: Table does not shrink, and the main
 * column is at most 800 px wide (answer 59).
 */
export function AnswerBody({
  content,
  citations,
  sources,
  streaming,
  onSelectSource,
}: AnswerBodyProps) {
  const blocks = parseAnswerBlocks(content);

  return (
    <div className="ka-answer">
      {blocks.map((block, index) => {
        const last = index === blocks.length - 1;
        const caret = streaming && last ? <span className="ka-streaming-caret" /> : null;
        const inline = (text: string) => (
          <Segments
            citations={citations}
            onSelectSource={onSelectSource}
            sources={sources}
            text={text}
          />
        );
        const key = index;

        if (block.kind === 'heading') {
          return (
            <Heading
              className="ka-answer__heading"
              data-size={block.level === 3 ? 'sm' : 'xs'}
              key={key}
              level={block.level}
            >
              {block.text}
            </Heading>
          );
        }

        if (block.kind === 'list') {
          const Items = block.ordered ? List.Ordered : List.Unordered;
          return (
            <Items key={key}>
              {block.items.map((item, itemIndex) => (
                <List.Item key={itemIndex}>
                  {inline(item)}
                  {caret && itemIndex === block.items.length - 1 ? caret : null}
                </List.Item>
              ))}
            </Items>
          );
        }

        if (block.kind === 'table') {
          return (
            <div className="ka-answer__table" key={key}>
              <Table data-size="sm">
                <Table.Head>
                  <Table.Row>
                    {block.head.map((cell, cellIndex) => (
                      <Table.HeaderCell key={cellIndex}>{inline(cell)}</Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {block.rows.map((row, rowIndex) => (
                    <Table.Row key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <Table.Cell key={cellIndex}>{inline(cell)}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          );
        }

        return (
          <Paragraph key={key} variant="long">
            {inline(block.text)}
            {caret}
          </Paragraph>
        );
      })}
    </div>
  );
}
