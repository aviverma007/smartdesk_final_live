import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';

import App from './App.jsx';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppProvider>
  </StrictMode>,
);
