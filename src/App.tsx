import { Route, Routes } from 'react-router';
import { Skall } from './layout/Skall';
import { NySamtale } from './sider/NySamtale';
import { Traad } from './sider/Traad';

/**
 * Rutene er norske, som resten av grensesnittet.
 *
 *   /                  ny samtale, tom tilstand
 *   /traader/:traadId  én samtale
 */
export function App() {
  return (
    <Routes>
      <Route element={<Skall />}>
        <Route index element={<NySamtale />} />
        <Route path="traader/:traadId" element={<Traad />} />
      </Route>
    </Routes>
  );
}
