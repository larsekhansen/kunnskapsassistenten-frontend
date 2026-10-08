import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { useFlag } from '../../flags';
import type { FilterFacet } from '../../model';
import { MAX_VALUES_PER_FIELD, SCREEN_READER_TEXTS } from './suggestionField';

/** What the view may do with a field from outside: put the keyboard in it. */
export type FacetFieldHandle = { focus: () => void };

/**
 * From how many chosen values the `compact-filter-chips` flag
 * (digdir/kunnskapsassistenten#116) draws one chip instead of one per value.
 * Every value chosen always does.
 */
const COMPACT_FROM = 6;

/**
 * The value of the one chip that stands for all the chosen values. Not a
 * value any facet can hold: no key the backend sends starts with a null.
 */
const SUMMARY_VALUE = '\u0000chosen';

export type FacetFieldProps = {
  /** For the view's focus handling after the active filter goes (ActiveFilter). */
  ref?: Ref<FacetFieldHandle>;
  facet: FilterFacet;
  /** Selected {@link FacetValue.value}s. Empty means «no restriction». */
  selected: string[];
  onChange: (values: string[]) => void;
};

/**
 * One filter dimension as a multi-select dropdown.
 *
 * Designsystemet's Suggestion with `multiple`. Three things are worth
 * knowing about it:
 *
 *   1. Selected values render as chips inside the field, so there is no
 *      second row of Chip.Removable; both would show every filter twice.
 *   2. The list is locked to the width of the input by an inline style unless
 *      `data-overscroll="contain"` turns that off. It does, and the width
 *      then has to come from our own CSS. The design draws the list wider
 *      than the field, and the labels here are long enough to need it.
 *   3. `autoPlacement` is a dead prop in 1.21.0, destructured and never
 *      used. `data-autoplacement` is the attribute that works.
 *
 * Suggestion.Clear only clears the text the user has typed, not the
 * selection: u-combobox hides it whenever the input is empty. «Tøm» is
 * therefore our own button.
 */
export function FacetField({ ref, facet, selected, onChange }: FacetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const total = facet.values.length;
  const chosen = selected.length;
  /*
   * Every value the list holds is ticked, which is the rule the question
   * leaves the field out by (`askedSelection`), so the field and the question
   * say the same. Not `chosen === total`: the list can hold fewer values than
   * are ticked. A field where everything is ticked is not sent, so the facets
   * are counted without it, and a value with no documents under the other
   * fields can be left out of the list.
   */
  const allChosen = total > 0 && facet.values.every((value) => selected.includes(value.value));
  const dimension = facet.label.toLocaleLowerCase('nb-NO');

  /*
   * Behind `compact-filter-chips`: with every value or many of them chosen,
   * one chip says so («Alle dokumenttyper», «12 virksomheter») instead of
   * hundreds of chips stacked over the panel. Removing it removes them all.
   *
   * The cost, while the chip stands: u-combobox ticks an option only when a
   * chip carries its value, so the list shows no ticks. Choosing a value that
   * is already chosen changes nothing.
   */
  const compactFlag = useFlag('compact-filter-chips');
  const compact = compactFlag && chosen > 0 && (allChosen || chosen >= COMPACT_FROM);

  /*
   * Suggestion must be given `{ label, value }`, not bare strings: a bare
   * string becomes both the label and the value, and the chip then shows the
   * key («arsrapport») instead of the name («Årsrapport»). See
   * `sanitizeItems` in the component.
   */
  const selectedItems = compact
    ? [{ value: SUMMARY_VALUE, label: allChosen ? `Alle ${dimension}` : `${chosen} ${dimension}` }]
    : selected.map((value) => ({
        value,
        label: facet.values.find((candidate) => candidate.value === value)?.label ?? value,
      }));

  /*
   * Which dimension a chip is removed from, in the chip's own name.
   *
   * u-combobox builds a chip's accessible name as `label`, then
   * `data-sr-remove`: «Årsrapport, Trykk for å fjerne». Three fields hold
   * chips, and without this nothing says which filter a value is in. Naming
   * the dimension here puts it where the chip is read rather than in a second
   * live region.
   */
  const screenReaderTexts = {
    ...SCREEN_READER_TEXTS,
    'data-sr-remove': `Trykk for å fjerne fra ${facet.label.toLocaleLowerCase('nb-NO')}`,
  };

  /*
   * The dimension name stays the field's Label, and the state goes in the
   * description under it. Renaming a control as its value changes, as the
   * Figma sketch does with «Alle valgt», breaks the promise a label makes to
   * a screen reader user: the name has to stay put.
   *
   * Three states, three sentences. An untouched field and one where every
   * value is picked must not read the same, or the reader cannot tell whether
   * a filter is set, and «Velg alle» offers what the text already claims.
   * Both are no restriction, and «Alle valgt» says so: such a field is not
   * sent (the BFF strikes it, and sending every organisation would break the
   * limit below for nothing).
   */
  const state =
    chosen === 0
      ? 'Ingen avgrensning'
      : allChosen
        ? `Alle ${total} valgt, altså ingen avgrensning`
        : `${chosen} av ${total} valgt`;

  /*
   * Over the limit and short of all: a question asked like this would be
   * turned away. The way out is in the sentence — fewer, or all, which is no
   * narrowing and is not sent.
   */
  const overLimit = chosen > MAX_VALUES_PER_FIELD && !allChosen;

  /*
   * Empties the search text.
   *
   * Picking a value from the list leaves the value key in the input —
   * `u-combobox` only restores what the user typed when the click arrives
   * through the native datalist path, and it does not here. The list is
   * filtered on that text, so the next open would show «Ingen treff».
   * Clearing after every change is what a multi-select should do anyway: the
   * search is spent once the value is a chip.
   *
   * The event is dispatched because both `u-combobox` and Suggestion's own
   * filtering listen for it; setting `value` alone would leave both stale.
   */
  function clearQuery() {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function change(values: string[]) {
    clearQuery();
    onChange(values);
  }

  /*
   * What Suggestion reports, as values. The summary chip stands for the
   * values behind it.
   *
   * A value of '' is «Ingen treff»: ds-suggestion labels it with the text
   * typed and gives it no value, and u-combobox chooses on Enter the option
   * whose label is the text. Text that names no value would choose it and
   * draw a chip with no value. It is not a choice: nothing changes, and the
   * text stays to be finished.
   *
   * A '' already in the selection comes from an older filter and goes with
   * the next change: `readStoredFilter` drops a stored one, but a thread
   * asked with one keeps it in its filter, and «Ny tråd» from the lock
   * carries that over.
   */
  function choose(items: { value: string }[]) {
    const values = [
      ...new Set(items.flatMap((item) => (item.value === SUMMARY_VALUE ? selected : [item.value]))),
    ];
    if (values.includes('') && !selected.includes('')) return;
    change(values.filter((value) => value !== ''));
  }

  /*
   * «Velg alle» and «Tøm» are rendered on the very state they change, so
   * React takes the button out of the DOM in the same render and focus falls
   * to `document.body`. A keyboard user would be thrown back above the skip
   * link on every choice (WCAG 2.4.3). The field below the button is where
   * they are going next, so focus moves there first, while the button still
   * exists.
   *
   * Only from these two buttons. `onSelectedChange` must not focus the
   * input: the user may be inside the chips, where ArrowLeft and Enter walk
   * and remove, and pulling focus out would break that.
   */
  function changeFromButton(values: string[]) {
    inputRef.current?.focus();
    change(values);
  }

  return (
    <Field>
      <div className="facet-field__label-row">
        <Label>{facet.label}</Label>

        <div className="facet-field__actions">
          {!allChosen && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Velg alle ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() =>
                // Adds to the choice and never takes from it: a value ticked
                // and not in the list now is kept, so «Velg alle» under a
                // narrowing does not shrink the filter for later.
                changeFromButton([
                  ...new Set([...selected, ...facet.values.map((value) => value.value)]),
                ])
              }
            >
              Velg alle
            </Button>
          )}
          {chosen > 0 && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Tøm ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() => changeFromButton([])}
            >
              Tøm
            </Button>
          )}
        </div>
      </div>

      {/*
        Over the chips and not after them, where Designsystemet usually puts a
        validation message: the message only exists when more than a hundred
        values are ticked, and under a hundred chips it is a scroll away
        from anyone who could act on it. `ds-field` links it to the input
        wherever it stands.
      */}
      {overLimit && (
        <ValidationMessage>
          {`Høyst ${MAX_VALUES_PER_FIELD} kan brukes i ett felt, og ${chosen} er valgt. Fjern noen, eller velg alle.`}
        </ValidationMessage>
      )}

      <Suggestion
        multiple
        selected={selectedItems}
        onSelectedChange={choose}
        {...screenReaderTexts}
      >
        {/*
          The placeholder names the dimension. With the bare word «Søk», the
          three fields read as one repeated control even though each has its
          own <label>.
        */}
        <Suggestion.Input
          ref={inputRef}
          placeholder={`Søk i ${facet.label.toLocaleLowerCase('nb-NO')}`}
        />
        <Suggestion.Toggle />
        <Suggestion.Clear />
        <Suggestion.List data-overscroll="contain" data-autoplacement="false">
          {facet.values.map((value) => (
            /*
              `label` is what the chip and the filtering use, the children are
              what the list shows. Keeping the count out of the label means a
              chip reads «Årsrapport», not «Årsrapport (1032)».
            */
            <Suggestion.Option key={value.value} value={value.value} label={value.label}>
              {value.count === undefined ? value.label : `${value.label} (${value.count})`}
            </Suggestion.Option>
          ))}
          {/*
            After the values, not before. Enter chooses the FIRST option whose
            label is the text, and «Ingen treff» carries the text as its label
            (see `choose`): first in the list, it would be chosen even on
            «Årsrapport» or «2024». Designsystemet hides it by CSS whenever a
            value is shown, wherever it stands.
          */}
          <Suggestion.Empty>Ingen treff</Suggestion.Empty>
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
}
