import { createContext, useContext, useEffect, useState } from 'react';
import { tokenStore } from '../service/tokenStore.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);

  // Registra el callback para que HttpService pueda actualizar el estado React
  // cuando hace un refresh automático de tokens
  useEffect(() => {
    tokenStore.onTokenUpdated((token) => setAccessToken(token));
  }, []);

  const login = (access, refresh) => {
    tokenStore.setAccess(access);
    tokenStore.setRefresh(refresh);
    setAccessToken(access);
  };

  const logout = () => {
    tokenStore.clearAll();
    setAccessToken(null);
  };

  const isAuthenticated = () => {
    const token = accessToken || tokenStore.getAccess();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ accessToken, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
