import { createContext, useContext, useEffect, useState } from 'react';
import { useVaultKey } from './VaultKeyProvider.jsx';
import FolderService from '../service/domains/FolderService.jsx';
import { encryptVaultItem, decryptVaultItem } from '../crypto/vault.js';

const FolderContext = createContext();

export const FolderProvider = ({ children }) => {
  const { vaultKey } = useVaultKey();
  const folderService = FolderService();

  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);

  useEffect(() => {
    if (!vaultKey) { setFolders([]); setSelectedFolderId(null); return; }

    let cancelled = false;
    (async () => {
      try {
        const raw = await folderService.listFolders();
        if (cancelled) return;
        const decrypted = await Promise.all(
          (raw || []).map(async (f) => {
            try {
              const data = await decryptVaultItem(vaultKey, f.encryptedName, f.iv);
              return { ...f, name: data.name };
            } catch {
              return { ...f, name: '⚠ Error' };
            }
          }),
        );
        if (!cancelled) setFolders(decrypted);
      } catch { /* silent */ }
    })();

    return () => { cancelled = true; };
  }, [vaultKey]);

  const createFolder = async (name) => {
    const { encryptedData, iv } = await encryptVaultItem(vaultKey, { name });
    const folder = await folderService.createFolder({ encryptedName: encryptedData, iv });
    const newFolder = { ...folder, name };
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  };

  const removeFolder = async (id) => {
    await folderService.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  };

  return (
    <FolderContext.Provider value={{ folders, selectedFolderId, setSelectedFolderId, createFolder, removeFolder }}>
      {children}
    </FolderContext.Provider>
  );
};

export const useFolders = () => useContext(FolderContext);
