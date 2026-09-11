import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../styles/global.css';
import { Preview } from './Preview';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
