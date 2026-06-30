import { useEffect, useState } from 'react';
import { VaultCard } from '../../components/VaultCard/VaultCard.jsx';
import { Toast } from '../../components/Toast/Toast.jsx';
import VaultService from '../../service/domains/VaultService.jsx';
import useCommonService from '../../service/CommonService.jsx';
import { decryptVaultItem } from '../../crypto/vault.js';
import 'boxicons';
import './Trash.css';

export function Trash() {
  const { vaultKey } = useCommonService();
  const vaultService = VaultService();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { loadTrash(); }, []);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const raw = await vaultService.getTrash();
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
      showToast(err?.message || 'Error al cargar la papelera', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await vaultService.restoreItem(id);
      showToast('Credencial restaurada', 'success');
      loadTrash();
    } catch (err) { showToast(err?.message || 'Error', 'error'); }
  };

  const handlePurge = async (id) => {
    try {
      await vaultService.purgeItem(id);
      showToast('Eliminada definitivamente', 'success');
      loadTrash();
    } catch (err) { showToast(err?.message || 'Error', 'error'); }
  };

  const handlePurgeAll = async () => {
    if (!window.confirm('¿Vaciar la papelera? Esta acción no se puede deshacer.')) return;
    try {
      await vaultService.purgeTrash();
      showToast('Papelera vaciada', 'success');
      setItems([]);
    } catch (err) { showToast(err?.message || 'Error', 'error'); }
  };

  return (
    <div className="trash-page">
      <div className="trash-header">
        <div>
          <h1>Papelera</h1>
          <p>Los elementos se eliminan definitivamente después de 30 días.</p>
        </div>
        {items.length > 0 && (
          <button className="trash-purge-all" onClick={handlePurgeAll}>
            <box-icon name="trash" color="var(--color-error)" size="16px" />
            Vaciar papelera
          </button>
        )}
      </div>

      {loading ? (
        <div className="trash-loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="trash-empty">
          <box-icon name="trash" color="var(--color-border)" size="48px" />
          <p>La papelera está vacía</p>
        </div>
      ) : (
        <div className="trash-list">
          {items.map((item) => (
            <div key={item.id} className="trash-item">
              <VaultCard item={item} onEdit={() => {}} />
              <div className="trash-item-actions">
                <button className="trash-restore" onClick={() => handleRestore(item.id)}>
                  <box-icon name="undo" color="var(--color-accent)" size="14px" />
                  Restaurar
                </button>
                <button className="trash-delete" onClick={() => handlePurge(item.id)}>
                  <box-icon name="trash" color="var(--color-error)" size="14px" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
