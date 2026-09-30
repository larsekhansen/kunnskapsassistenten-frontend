import { Dialog, Fieldset, Heading, Paragraph, Radio } from '@digdir/designsystemet-react';
import { useId } from 'react';
import { setDisplayLevel, type DisplayLevel } from './displayLevel';

export type SettingsDialogProps = {
  /** The level on screen now. */
  level: DisplayLevel;
  /** Takes `#innstillinger` back out of the address. */
  onClose: () => void;
};

const OPTIONS: { value: DisplayLevel; label: string; description: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Fremgangsmåte over svaret, med stegene assistenten gikk gjennom.',
  },
  {
    value: 'detaljert',
    label: 'Detaljert',
    description: 'Alt det tekniske i tillegg: søkeordene, antall treff og tiden det tok.',
  },
];

/**
 * The hidden settings menu.
 *
 * Lars, 30.09: «kanskje egentlig bare at jeg kan skrive noe i urlen for å få
 * opp en settings-meny. Jeg ser for meg at vi vil ha en sånn senere, så lag
 * den i det samme type designet, men ikke gjør for mye ut av det heller.»
 *
 * So: one Designsystemet `Dialog`, one `Fieldset` of radios, and nothing
 * else. It holds one setting today and has room for the next without
 * changing shape — which is the whole reason it is a menu and not a console
 * command like `window.ka.colorScheme`.
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
export function SettingsDialog({ level, onClose }: SettingsDialogProps) {
  const headingId = useId();
  const groupName = useId();

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
        <Paragraph className="ka-settings__note" data-size="sm" variant="long">
          Valget huskes i denne nettleseren.
        </Paragraph>
      </Dialog.Block>
    </Dialog>
  );
}
