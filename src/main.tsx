import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { initColorScheme } from './layout/colorScheme';
import './styles/global.css';

// Designsystemet's warnings help in development but are noise in production.
if (import.meta.env.PROD) {
  window.dsWarnings = false;
}

// Applies the stored colour scheme and exposes window.ka.colorScheme before
// the first render. index.html has already applied the same value inline, so
// this installs the console API rather than preventing a flash.
initColorScheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
