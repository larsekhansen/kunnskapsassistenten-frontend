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

/*
 * These two carry no side in the vendor's name, so the naming rule does not
 * force them through here. They pass through anyway because the role is what
 * the views mean and the glyph is a choice: a funnel for filtering and a
 * pencil for a new thread are both conventions, not facts, and a designer who
 * changes one should change one line.
 */
export { FunnelIcon as FilterIcon, PencilWritingIcon as NewThreadIcon } from '@navikt/aksel-icons';

/*
 * The two ends of the inline axis, for a control that moves an edge along it.
 *
 * These keep a direction in the name where every other export here has a
 * role, and that is because the direction IS the role: the width buttons in a
 * panel head point the way the edge will travel, and which end that is
 * depends on which side of the answer column the panel sits — the same fact
 * `growthDirection()` reads off `slotOrder`. A role name like «wider» could
 * not carry a glyph, because wider is one direction for one panel and the
 * other for the other.
 *
 * «Inline start» and «inline end» are CSS's own words for the two ends, the
 * vendor vocabulary the naming rule makes an exception for — not «left» and
 * «right», which would be wrong the day the app is read in a language that
 * runs the other way.
 */
export {
  ChevronLeftIcon as InlineStartIcon,
  ChevronRightIcon as InlineEndIcon,
} from '@navikt/aksel-icons';
