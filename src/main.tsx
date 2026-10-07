import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './ui/App';

// The retired daily featured operation kept its best results here; clear them once.
try {
  localStorage.removeItem('tactically-idle/featured-best');
} catch {
  // Blocked storage has nothing to clear.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
