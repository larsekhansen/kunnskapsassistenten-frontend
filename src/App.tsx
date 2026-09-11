import { Route, Routes } from 'react-router';
import { Shell } from './layout/Shell';
import { NewConversation } from './views/NewConversation';
import { Thread } from './views/Thread';

/**
 * Routes are English, like the rest of the code. The text they render is
 * Norwegian.
 *
 *   /                   new conversation, empty state
 *   /threads/:threadId  one conversation
 */
export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<NewConversation />} />
        <Route path="threads/:threadId" element={<Thread />} />
      </Route>
    </Routes>
  );
}
