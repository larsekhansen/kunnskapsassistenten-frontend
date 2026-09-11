/**
 * Icons for the chat view, drawn here on purpose.
 *
 * Designsystemet uses @navikt/aksel-icons, and it is in node_modules as an
 * indirect dependency — but only the foundation adds dependencies in round
 * one (design/_briefs/bygg/regler.md), and importing a package we do not
 * declare is a phantom dependency that breaks the day the tree is hoisted
 * differently. So these are local until aksel-icons is a declared dependency,
 * and then every one of them is deleted.
 *
 * Each icon is decorative: it sits next to a text label or inside a button
 * that carries its own Norwegian accessible name, so they are aria-hidden and
 * never the only carrier of meaning. They size with the text (1em) and take
 * their colour from it, so they follow the theme and dark mode.
 */

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Send the question. */
export function PaperplaneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 3.5 3.5 10.2l6.6 3.1 3.1 6.6z" />
      <path d="M10.1 13.3 20.5 3.5" />
    </Icon>
  );
}

/** Attachments, which are in scope but have no endpoint yet (answer 53). */
export function PaperclipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17.5 8.5v8a5.5 5.5 0 0 1-11 0V7a3.5 3.5 0 0 1 7 0v9.3a1.6 1.6 0 0 1-3.2 0V8.5" />
    </Icon>
  );
}

/** «Fremgangsmåte»: how the assistant searched. */
export function MagnifyingGlassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 20.5 20.5" />
    </Icon>
  );
}

/** Stop generating (answer 34). */
export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Icon>
  );
}

/** Copy the answer (answer 15). */
export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
    </Icon>
  );
}

/** Copy a link to the thread (answer 16). */
export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.3-1.3" />
    </Icon>
  );
}

/** Jump to the newest message (answer 17). */
export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5v14" />
      <path d="m5.5 12.5 6.5 6.5 6.5-6.5" />
    </Icon>
  );
}

/** A document, next to each kickstarter. */
export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13.5 3.5V9H19" />
    </Icon>
  );
}
