import { Dialog, Fieldset, Heading, Label, Paragraph, Radio } from '@digdir/designsystemet-react';
import { useId } from 'react';
import { ColorSchemeToggle } from '../../layout/ColorSchemeToggle';
import { setFooterMode, type FooterMode } from '../../layout/footerMode';
import { setDisplayLevel, type DisplayLevel } from './displayLevel';

export type SettingsDialogProps = {
  /** The level on screen now. */
  level: DisplayLevel;
  /** Where the navigation panel's foot sits now. */
  footerMode: FooterMode;
  /** Takes `#innstillinger` back out of the address. */
  onClose: () => void;
};

const OPTIONS: { value: DisplayLevel; label: string; description: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    description:
      'Fremgangsmåte over svaret, med stegene assistenten gikk gjennom og søkeordene den brukte.',
  },
  {
    value: 'detaljert',
    label: 'Detaljert',
    description:
      'Alt det tekniske i tillegg: søkestrengene for hvert steg, antall treff og tiden det tok.',
  },
];

/**
 * Issue 123, which asks whether the panel's foot has to be pinned at
 * all or whether the whole panel could be one container with nothing fixed.
 * Both are here so the two can be compared on the same page.
 */
const FOOTER_OPTIONS: { value: FooterMode; label: string; description: string }[] = [
  {
    value: 'pinned',
    label: 'Festet',
    description: 'Lenkene står nederst i panelet, uansett hvor langt du har rullet.',
  },
  {
    value: 'scrolls',
    label: 'Ruller med',
    description: 'Alt ligger i én kolonne. Lenkene står etter den siste tråden og ruller med den.',
  },
];

/**
 * The hidden settings menu.
 *
 * Asked for 30.09: a settings menu reachable by typing something in the
 * address, in the same design as the rest, kept small — more settings are
 * expected later.
 *
 * So: one Designsystemet `Dialog`, a `Fieldset` of radios per setting, and
 * nothing else. It held one setting when it was built and took the second
 * without changing shape — which is the whole reason it is a menu and not a
 * console command like `window.ka.colorScheme`.
 *
 * **Opened by `#innstillinger`** and not by a query, because a hash never
 * reaches the server, never changes the route, and never travels in a link
 * somebody pastes into a ticket — a reader who shares the address of a thread
 * does not hand the next person a settings dialog. Closing it takes the hash
 * back out, so the browser's back button is not the only way out.
 *
 * Radios and not a switch: there are two levels now and the next one is a
 * third, and a switch that has to become a list later is a control that gets
 * redrawn. The choice applies on the spot rather than behind a «Lagre» —
 * there is nothing to undo, and the answer behind the dialog is already
 * drawn the new way when it is closed.
 *
 * Modal. The dialog covers the whole reading area at this width, so a
 * non-modal one would leave a reader tabbing into an answer they cannot see.
 *
 * Mounted only while the hash is there, so a page nobody asked it of holds no
 * trace of it at all. The chat view does that; this component is open by the
 * time it exists.
 */
export function SettingsDialog({ level, footerMode, onClose }: SettingsDialogProps) {
  const headingId = useId();
  const groupName = useId();
  const footerGroupName = useId();
  const colourLegendId = useId();

  return (
    <Dialog
      aria-labelledby={headingId}
      closeButton="Lukk"
      closedby="closerequest"
      data-size="sm"
      onClose={onClose}
      open
    >
      <Dialog.Block>
        <Heading data-size="xs" id={headingId} level={2}>
          Innstillinger
        </Heading>
      </Dialog.Block>
      <Dialog.Block>
        <Fieldset>
          <Fieldset.Legend>Hvor mye skal svaret vise om hvordan det ble til?</Fieldset.Legend>
          {OPTIONS.map((option) => (
            <Radio
              checked={level === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              name={groupName}
              onChange={() => setDisplayLevel(option.value)}
              value={option.value}
            />
          ))}
        </Fieldset>
        <Fieldset className="ka-settings__group">
          <Fieldset.Legend>Foten i navigasjonspanelet</Fieldset.Legend>
          {FOOTER_OPTIONS.map((option) => (
            <Radio
              checked={footerMode === option.value}
              description={option.description}
              key={option.value}
              label={option.label}
              name={footerGroupName}
              onChange={() => setFooterMode(option.value)}
              value={option.value}
            />
          ))}
        </Fieldset>
        {/*
          Lys, mørk og auto, moved here from the foot of the navigation panel
          (chosen 06.10): it is a setting like the two above, and the foot was
          the one place in the app that carried a control of its own.

          The group it already was, not a third pair of radios. Three fixed
          answers with an icon each read faster than three rows of text, and
          the control is the one a reader has used before. The legend names it,
          so the group itself carries no second name.
        */}
        <div className="ka-settings__group">
          {/*
            A label beside the group and not a `Fieldset` around it: the toggle
            group IS a fieldset, and a second one around it gave two groups
            with the same name, one inside the other. `Label asChild` on a
            span draws the same line the two legends above draw, without
            claiming a control of its own.
          */}
          <Label asChild id={colourLegendId}>
            <span>Fargemodus</span>
          </Label>
          <ColorSchemeToggle labelledBy={colourLegendId} />
        </div>
        <Paragraph className="ka-settings__note" data-size="sm" variant="long">
          Valgene huskes i denne nettleseren.
        </Paragraph>
      </Dialog.Block>
    </Dialog>
  );
}
