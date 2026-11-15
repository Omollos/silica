import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {flushPendingRuns} from './api/runsClient';

createRoot(document.getElementById('root')!).render(<App />);

void flushPendingRuns();
window.addEventListener('online', () => {
  void flushPendingRuns();
});
