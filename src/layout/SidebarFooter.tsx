import { Link } from '@digdir/designsystemet-react';
import { CogIcon } from '@navikt/aksel-icons';
import { Link as RouterLink, useLocation } from 'react-router';
import { infoPages } from '../routes/info/infoPages';
import { SETTINGS_HASH } from '../views/chat/displayLevel';

/**
 * The foot of the navigation panel: the pages about Kunnskapsassistenten, and
 * the app's own settings.
 *
 * The links first, right under the line the foot draws against the thread
 * list, and the way into the settings under them — the order the old
 * Kunnskapsassistenten has (issue 85c,
 * design/_sources/eksisterende-ka-sider/lenkene-i-foten.png), with the
 * setting last because it is the one thing here that changes the app rather
 * than going somewhere.
 *
 * Lys, mørk og auto used to stand here as a control of its own. It moved into
 * the settings menu (chosen 06.10), and what is left in its place is the way
 * in: one link to `#innstillinger`, which until now had no way in at all and
 * could only be reached by typing the address. The display level and where
 * the foot sits become reachable with it.
 *
 * A link and not a button, because the address is what opens the menu: the
 * hash is the state, so the control that sets it is a link, and it reads as
 * one for a screen reader. It keeps whatever page the reader is on — only the
 * hash is written — so the menu opens over the page they were already on.
 *
 * A named list rather than a `nav`: the panel is already the navigation
 * landmark (`Sidebar` mounts it as one), and a second landmark inside the
 * first says there are two places to navigate from when there is one. The
 * name on the list is what tells a screen reader these three are about the
 * app and the ones above are threads.
 *
 * `aria-current="page"` marks the open page. These are ordinary route
 * navigations, so the location is the whole truth here — unlike the thread
 * links, which the shell has to tell, see ThreadLink.tsx.
 *
 * Which pages, what they are called and what icon each has is read from one
 * list; see src/routes/info/infoPages.tsx.
 */
export function SidebarFooter() {
  const { pathname } = useLocation();

  return (
    <div className="sidebar-footer">
      <ul className="sidebar-footer__links" aria-label="Om Kunnskapsassistenten">
        {infoPages.map(({ path, title, Icon }) => {
          const to = `/${path}`;
          return (
            <li key={path}>
              <Link asChild data-size="sm">
                <RouterLink to={to} aria-current={pathname === to ? 'page' : undefined}>
                  <Icon aria-hidden />
                  {title}
                </RouterLink>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link asChild className="sidebar-footer__settings" data-size="sm">
        <RouterLink to={{ hash: SETTINGS_HASH }}>
          <CogIcon aria-hidden />
          Innstillinger
        </RouterLink>
      </Link>
    </div>
  );
}
