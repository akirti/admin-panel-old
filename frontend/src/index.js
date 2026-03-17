import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

// Derive router basename from APP_BASE_PATH (Apigee proxy prefix).
// This ensures React Router generates correct links (e.g. /a/b/c/login
// instead of /login) when the app is served behind a proxy subpath.
const basename = (window.__env && window.__env.APP_BASE_PATH) || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
