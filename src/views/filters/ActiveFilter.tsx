import { Button, Chip, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  emptyFilterSelection,
  filterDimensions,
  type FilterDimension,
  type FilterSelection,
} from '../../model';

export type ActiveFilterProps = {
  selection: FilterSelection;
  onChange: (selection: FilterSelection) => void;
  /**
   * Where focus goes when the block takes the focused chip with it: the last
   * value removed, «Tøm» pressed, or the facets arriving so the fields take
   * over. It has to be an element that outlives this block.
   */
  focusWhenGone: RefObject<HTMLElement | null>;
  /** Tells the reader, through the view's own live region, what was removed. */
  onAnnounce: (text: string) => void;
};

type Chosen = { dimension: FilterDimension; value: string };

/** One key per chip. The same value could in principle sit in two dimensions. */
function keyOf({ dimension, value }: Chosen): string {
  return `${dimension}\u0000${value}`;
}

/**
 * The filter that is in force when there are no facets to draw it with.
 *
 * A filter stored on the thread still narrows every question, whether or not
 * the facets can be fetched: the key is missing and the server answers with
 * an empty list, or Typesense is down and it answers 502. Until now the panel
 * then said «Filtrering er ikke tilgjengelig ennå» or «Klarte ikke å hente
 * filtrene» and nothing else, so the reader could neither see the narrowing
 * nor get rid of it (#4 in the trial of the backend, #170).
 *
 * Without facets the values cannot be changed — there is nothing to choose
 * among — but they can be removed, and that is all this offers.
 *
 * `Chip.Removable`, one per value, is Designsystemet's own «active filter that
 * can be removed» (chip.md). The fields normally show the same thing as chips
 * inside the Suggestion; this only appears when there are no fields, so no
 * value is ever drawn twice (behov-til-komponent.md, «Velg én av to»).
 *
 * The chips carry the value alone, with no dimension name, and that is not a
 * shortcut: without facets there is neither the dimension's label nor the
 * value's to look up. The value IS the word the reader ticked — `facetsFrom`
 * and the mock both set `label` to the value (see filterSummary.ts in the chat
 * view) — so it is shown as it is, in the panel's dimension order. That is
 * word for word the «Avgrenset til: Årsrapport · 2024» line over the answer,
 * which is why the heading says the same.
 */
export function ActiveFilter({
  selection,
  onChange,
  focusWhenGone,
  onAnnounce,
}: ActiveFilterProps) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement | null>());
  /*
   * The chip the keyboard goes to after a removal, '' for «none left», and
   * undefined when nothing was removed. Read in an effect, because the chip
   * to focus is not settled until React has drawn the selection without the
   * one that went.
   */
  const focusAfterRemove = useRef<string | undefined>(undefined);

  const chosen: Chosen[] = filterDimensions.flatMap((dimension) =>
    selection[dimension].map((value) => ({ dimension, value })),
  );

  /*
   * A chip that is pressed removes itself, and focus would fall to `<body>`,
   * above the skip link (WCAG 2.4.3). The next chip is where the reader was
   * heading, the one before is the fallback when they took the last, and the
   * element the view hands in is what is left when there are none — the same
   * order as «Dine dokumenter» (OwnDocuments.tsx).
   */
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === undefined) return;
    focusAfterRemove.current = undefined;

    const chip = target === '' ? undefined : chipRefs.current.get(target);
    if (chip) chip.focus();
    else focusWhenGone.current?.focus();
  }, [selection, focusWhenGone]);

  /*
   * The other way the block can go: the facets arrive — Typesense is back, and
   * the refetch a removal started succeeded — so the view draws the fields
   * and unmounts this. A reader standing on a chip would then be dropped on
   * `<body>` with no action of their own to explain it.
   *
   * A layout effect, because on unmount its cleanup runs while the chips are
   * still in the document: that is the only moment `contains` can say where
   * focus was. Focus moves to an element that stays, before the chip is
   * taken away.
   *
   * Keyed on whether there is a section at all, because the view mounts this
   * before there is anything to show when a thread without a filter is open,
   * and the section appears later, when a thread with one is opened. Read
   * once at mount, it would be null for good.
   *
   * When the section goes because the last value was removed, this cleanup
   * finds focus already on `<body>` and does nothing: React takes the chips
   * out before it cleans up after an update. That case is the effect above.
   */
  const shown = chosen.length > 0;
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const fallback = focusWhenGone;
    if (!section) return;
    return () => {
      if (section.contains(document.activeElement)) fallback.current?.focus();
    };
  }, [shown, focusWhenGone]);

  if (!shown) return null;

  function remove(removed: Chosen) {
    const index = chosen.findIndex((candidate) => keyOf(candidate) === keyOf(removed));
    const next = chosen[index + 1] ?? chosen[index - 1];
    focusAfterRemove.current = next ? keyOf(next) : '';
    chipRefs.current.delete(keyOf(removed));

    onAnnounce(`Fjernet fra filteret: ${removed.value}`);
    onChange({
      ...selection,
      [removed.dimension]: selection[removed.dimension].filter((value) => value !== removed.value),
    });
  }

  function clear() {
    focusAfterRemove.current = '';
    onAnnounce('Filteret er fjernet.');
    onChange(emptyFilterSelection);
  }

  return (
    <section ref={sectionRef} className="active-filter" aria-labelledby={headingId}>
      {/*
        «Tøm» beside the heading, as it stands beside the label of every
        field (FacetField). A filter saved with «Velg alle» can hold every
        organisation in the corpus, and removing them chip by chip is not a
        way out of it.
      */}
      <div className="active-filter__head">
        <Heading level={3} data-size="2xs" id={headingId}>
          Avgrenset til
        </Heading>
        <Button
          variant="tertiary"
          data-color="neutral"
          data-size="sm"
          aria-label="Tøm hele filteret"
          onClick={clear}
        >
          Tøm
        </Button>
      </div>

      <Paragraph data-size="sm" variant="long">
        Filteret gjelder fortsatt for spørsmålene dine. Du kan fjerne det, men ikke endre det før
        filtrene kan hentes.
      </Paragraph>

      <div className="active-filter__chips">
        {chosen.map((item) => (
          /*
            `data-wrap`: an organisation's name is the information, and the
            chip's default ellipsis would cut it — the same call the chips
            inside the fields make (filters.css).

            The accessible name says what pressing does, because the cross is
            a pseudo-element with no text and the chip would otherwise read
            as the value alone (chip.md, «Tilgjengelighet»).
          */
          <Chip.Removable
            key={keyOf(item)}
            ref={(chip) => {
              chipRefs.current.set(keyOf(item), chip);
            }}
            data-wrap="wrap"
            aria-label={`Fjern filter: ${item.value}`}
            onClick={() => remove(item)}
          >
            {item.value}
          </Chip.Removable>
        ))}
      </div>
    </section>
  );
}
