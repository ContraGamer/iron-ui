import { createContext, useContext, useState } from 'react';

// vault_key es un CryptoKey (AES-256-GCM) derivado de la master password.
// NUNCA se persiste — vive solo en memoria. Si el usuario recarga, debe
// volver a ingresar su contraseña maestra para re-derivarla.
const VaultKeyContext = createContext();

export const VaultKeyProvider = ({ children }) => {
  const [vaultKey, setVaultKey] = useState(null);

  const clearVaultKey = () => setVaultKey(null);

  return (
    <VaultKeyContext.Provider value={{ vaultKey, setVaultKey, clearVaultKey }}>
      {children}
    </VaultKeyContext.Provider>
  );
};

export const useVaultKey = () => useContext(VaultKeyContext);
