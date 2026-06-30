import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { SearchBar } from '../../components/SearchBar/SearchBar.jsx';
import { VaultCard } from '../../components/VaultCard/VaultCard.jsx';
import { VaultItemModal } from '../../components/VaultItemModal/VaultItemModal.jsx';
import { Toast } from '../../components/Toast/Toast.jsx';
import VaultService from '../../service/domains/VaultService.jsx';
import useCommonService from '../../service/CommonService.jsx';
import { tokenStore } from '../../service/tokenStore.js';
import { encryptVaultItem, decryptVaultItem } from '../../crypto/vault.js';
import 'boxicons';
import './Vault.css';

export function Vault() {
  const navigate = useNavigate();
  const { vaultKey, isAuthenticated } = useCommonService();
  const vaultService = VaultService();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState(null);

  // Si no hay vault key en memoria, redirigir a login para re-derivarla
  useEffect(() => {
    if (!isAuthenticated()) { navigate(URLS.LOGIN); return; }
    if (!vaultKey) { navigate(tokenStore.getRefresh() ? URLS.UNLOCK : URLS.LOGIN); return; }
    loadItems();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const raw = await vaultService.listItems();
      const decrypted = await Promise.all(
        (raw || []).map(async (item) => {
          try {
            const data = await decryptVaultItem(vaultKey, item.encryptedData, item.iv);
            return { ...item, decrypted: data };
          } catch {
            return { ...item, decrypted: { name: '⚠ Error al descifrar', url: '', username: '', password: '' } };
          }
        }),
      );
      setItems(decrypted);
    } catch (err) {
      showToast(err?.message || 'Error al cargar la bóveda', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData, id, folderId) => {
    const { encryptedData, iv } = await encryptVaultItem(vaultKey, formData);
    if (id) {
      await vaultService.updateItem(id, { encryptedData, iv, folderId });
      showToast('Credencial actualizada', 'success');
    } else {
      await vaultService.createItem({ encryptedData, iv, folderId });
      showToast('Credencial creada', 'success');
    }
    await loadItems();
  };

  const handleDelete = async (id) => {
    try {
      await vaultService.deleteItem(id);
      showToast('Credencial movida a la papelera', 'success');
      await loadItems();
    } catch (err) {
      showToast(err?.message || 'Error al eliminar', 'error');
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditItem(null);
    setModalOpen(true);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(({ decrypted: d }) =>
      d.name?.toLowerCase().includes(q) ||
      d.url?.toLowerCase().includes(q) ||
      d.username?.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="vault-page">
      {/* Header */}
      <header className="vault-header">
        <div className="vault-search-wrap">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <button className="vault-add-btn" onClick={handleNew}>
          <box-icon name="plus" color="var(--color-bg)" size="18px" />
          <span>Nueva</span>
        </button>
      </header>

      {/* Content */}
      <main className="vault-content">
        {loading ? (
          <div className="vault-loading">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="vault-empty">
            <box-icon name="lock-open" color="var(--color-border)" size="48px" />
            <p>{search ? 'Sin resultados' : 'Tu bóveda está vacía'}</p>
            {!search && (
              <button className="vault-empty-btn" onClick={handleNew}>
                Agregar primera credencial
              </button>
            )}
          </div>
        ) : (
          <div className="vault-list">
            {filtered.map((item) => (
              <VaultCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <VaultItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editItem}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
