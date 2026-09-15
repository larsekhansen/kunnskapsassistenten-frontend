import { Route, Routes } from 'react-router';
import { LayoutProvider } from './layout/LayoutProvider';
import { Shell } from './layout/Shell';
import { NewConversation } from './routes/NewConversation';
import { NotFound } from './routes/NotFound';
import { Thread } from './routes/Thread';

/**
 * Routes are English, like the rest of the code. The text they render is
 * Norwegian.
 *
 *   /                   new conversation, empty state
 *   /threads/:threadId  one conversation
 *   anything else       «Siden finnes ikke»
 *
 * Two layout routes and not one, because the shell is mounted differently for
 * the two kinds of page. The catch-all draws its own main slot
 * (`routeOwnsMain`); the real routes let the view in the slot draw it. A
 * single layout route could not say that, and `/tull` would get the front
 * page's welcome screen under the words «siden finnes ikke».
 *
 * Switching between the two remounts the shell. The layout lives above it, in
 * `LayoutProvider`, so nothing a reader has set up is lost — and navigating
 * to or from a broken address is not a thing that happens twice a minute.
 */
export function App() {
  return (
    <LayoutProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<NewConversation />} />
          <Route path="threads/:threadId" element={<Thread />} />
        </Route>
        <Route element={<Shell routeOwnsMain />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </LayoutProvider>
  );
}
