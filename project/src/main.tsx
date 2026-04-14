import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SiteGate from './components/SiteGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SiteGate>
    <App />
  </SiteGate>
);