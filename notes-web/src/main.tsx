import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@paper-and-ink/design-system';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary appName="Paper & Ink Notes">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
