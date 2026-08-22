import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { restoreTheme } from './theme/theme';

// Before the first paint, not in an effect: a choice applied one render late
// shows the other theme for that render, which is the flash every themed
// application either handles here or apologises for.
restoreTheme();

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html has no #root element to mount into');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
