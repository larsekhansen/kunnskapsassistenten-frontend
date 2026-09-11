/**
 * An arrow pointing back to where the user came from.
 *
 * Hand-drawn rather than taken from @navikt/aksel-icons because every arrow
 * in that set is named after a side, and no file in this repo may contain
 * that word — see CONTRIBUTING, «Navn». The path is the same 24×24 grid as
 * the icon set, so it lines up with the icons next to it.
 *
 * Decorative: the button around it carries the text.
 */
export function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ds-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}
