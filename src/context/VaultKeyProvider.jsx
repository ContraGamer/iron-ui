import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportVaultKey, importVaultKey } from '../crypto/kdf.js';
import { URLS } from '../const/URLs.jsx';

// vault_key es un CryptoKey (AES-256-GCM) derivado de la master password.
// Se persiste en sessionStorage (cifrado, exportable) para sobrevivir recargas
// dentro de la misma sesión de navegador. Se borra al cerrar la pestaña/navegador
// o cuando el temporizador de inactividad expira (vaultTimeoutMinutes).
const SK_KEY     = 'ik-vault-key';
const SK_TIMEOUT = 'ik-vault-timeout'; // ms
const SK_LAST    = 'ik-vault-last-act'; // timestamp última actividad

const VaultKeyContext = createContext();

export const VaultKeyProvider = ({ children }) => {
  const [vaultKey, setVaultKeyState] = useState(null);
  const navigate    = useNavigate();
  const intervalRef = useRef(null);

  const stopMonitor = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearVaultKey = useCallback(() => {
    setVaultKeyState(null);
    sessionStorage.removeItem(SK_KEY);
    sessionStorage.removeItem(SK_TIMEOUT);
    sessionStorage.removeItem(SK_LAST);
    stopMonitor();
  }, []);

  // Cada 30 s comprueba si el usuario lleva más de timeoutMs inactivo
  const startMonitor = useCallback((timeoutMs) => {
    stopMonitor();
    if (!timeoutMs) return; // 0 = solo expirar al cerrar el navegador
    intervalRef.current = setInterval(() => {
      const last = parseInt(sessionStorage.getItem(SK_LAST) ?? '0', 10);
      if (Date.now() - last > timeoutMs) {
        clearVaultKey();
        navigate(URLS.UNLOCK);
      }
    }, 30_000);
  }, [clearVaultKey, navigate]);

  // Actualiza la última actividad en sessionStorage en cada interacción del usuario
  useEffect(() => {
    const onActivity = () => sessionStorage.setItem(SK_LAST, Date.now().toString());
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, []);

  // Al montar: restaurar vault key de sessionStorage si la sesión no expiró
  useEffect(() => {
    const restore = async () => {
      const stored    = sessionStorage.getItem(SK_KEY);
      const timeoutMs = parseInt(sessionStorage.getItem(SK_TIMEOUT) ?? '0', 10);
      const last      = parseInt(sessionStorage.getItem(SK_LAST) ?? '0', 10);

      if (!stored || !last) return;
      if (timeoutMs && Date.now() - last > timeoutMs) {
        // Sesión expirada mientras el navegador estaba cerrado
        clearVaultKey();
        return;
      }

      try {
        const key = await importVaultKey(stored);
        setVaultKeyState(key);
        startMonitor(timeoutMs);
      } catch {
        clearVaultKey();
      }
    };

    restore();
    return stopMonitor;
  }, []);

  const setVaultKey = useCallback(async (key, timeoutMinutes = 15) => {
    setVaultKeyState(key);
    if (!key) { clearVaultKey(); return; }

    try {
      const exported  = await exportVaultKey(key);
      const timeoutMs = timeoutMinutes * 60 * 1000;
      sessionStorage.setItem(SK_KEY,     exported);
      sessionStorage.setItem(SK_TIMEOUT, timeoutMs.toString());
      sessionStorage.setItem(SK_LAST,    Date.now().toString());
      startMonitor(timeoutMs);
    } catch {
      // Si falla la exportación la key sigue en memoria; no bloquea el flujo
    }
  }, [clearVaultKey, startMonitor]);

  return (
    <VaultKeyContext.Provider value={{ vaultKey, setVaultKey, clearVaultKey }}>
      {children}
    </VaultKeyContext.Provider>
  );
};

export const useVaultKey = () => useContext(VaultKeyContext);
