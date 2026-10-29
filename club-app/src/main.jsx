import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Çevrimdışı açılış ve "Ana Ekrana Ekle" için service worker (yalnızca güvenli bağlamda, üst seviyede).
if ('serviceWorker' in navigator && window.isSecureContext && window.top === window.self && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
