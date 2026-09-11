/**
 * Icons, re-exported under names from our own vocabulary.
 *
 * Designsystemet ships @navikt/aksel-icons as a dependency; this repo pins it
 * explicitly so an import does not rely on npm hoisting. The package sets
 * `sideEffects: false` and exports ES modules, so only the icons named here
 * reach the bundle.
 *
 * This file is the ONE place where the vendor's position-named icons are
 * allowed to appear. The rule against naming things after a side is about our
 * own vocabulary, and beyond this boundary the names are ours. The glyphs are
 * pictures of the layout as it stands today; when a user can move a panel,
 * the picture has to be looked at again.
 */
export {
  SidebarLeftIcon as PrimarySidebarIcon,
  SidebarRightIcon as SecondarySidebarIcon,
  SidebarBothIcon as BothSidebarsIcon,
  // «Back» is the role; which way the arrow points is the vendor's business
  // and today's layout's. A panel that moves keeps the role and may want a
  // different glyph, and then this line is the only one that changes.
  ArrowLeftIcon as BackIcon,
} from '@navikt/aksel-icons';
