import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';
import { VaultKeyProvider } from './context/VaultKeyProvider.jsx';
import { SidebarProvider } from './context/SidebarProvider.jsx';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <VaultKeyProvider>
            <SidebarProvider>
              <App />
            </SidebarProvider>
          </VaultKeyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
