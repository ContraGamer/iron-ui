import { useAuth } from '../context/AuthProvider.jsx';
import { useVaultKey } from '../context/VaultKeyProvider.jsx';
import { useSidebar } from '../context/SidebarProvider.jsx';

const useCommonService = () => {
  const { accessToken, login, logout, isAuthenticated } = useAuth();
  const { vaultKey, setVaultKey, clearVaultKey } = useVaultKey();
  const { showSidebar, setShowSidebar } = useSidebar();

  const decodeJWT = () => {
    if (!accessToken) return null;
    try {
      const base64Url = accessToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(
        decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      );
    } catch {
      return null;
    }
  };

  const fullLogout = () => {
    logout();
    clearVaultKey();
    setShowSidebar(false);
  };

  return {
    isAuthenticated,
    decodeJWT,
    login,
    logout: fullLogout,
    vaultKey,
    setVaultKey,
    showSidebar,
    setShowSidebar,
  };
};

export default useCommonService;
