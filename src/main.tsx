import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import './styles/global.css';

// Designsystemets advarsler er nyttige i utvikling, men støy i produksjon.
if (import.meta.env.PROD) {
  window.dsWarnings = false;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
