import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from '@paper-and-ink/design-system';
import App from './App.tsx';
import './index.css';

registerSW({ immediate: true });

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary appName="Paper & Ink Reader">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
