import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { lockViewportZoom } from './utils/disableZoom';

lockViewportZoom();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
