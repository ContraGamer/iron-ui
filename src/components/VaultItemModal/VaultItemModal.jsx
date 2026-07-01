import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal.jsx';
import { PasswordInput } from '../PasswordInput/PasswordInput.jsx';
import { CopyButton } from '../CopyButton/CopyButton.jsx';
import { useFolders } from '../../context/FolderProvider.jsx';
import { useVaultKey } from '../../context/VaultKeyProvider.jsx';
import VaultService from '../../service/domains/VaultService.jsx';
import { decryptVaultItem } from '../../crypto/vault.js';
import 'boxicons';
import './VaultItemModal.css';

const EMPTY = { name: '', url: '', username: '', password: '', notes: '', folderId: null };

const generatePassword = (length = 20) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join('');
};

export function VaultItemModal({ isOpen, onClose, onSave, initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { folders } = useFolders();
  const { vaultKey } = useVaultKey();
  const vaultService = VaultService();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setForm(initial
      ? { ...EMPTY, ...initial.decrypted, folderId: initial.folderId ?? null }
      : EMPTY
    );
    setHistoryOpen(false);
    setHistory([]);
  }, [initial, isOpen]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (history.length > 0 || !initial?.id || !vaultKey) return;
    setHistoryLoading(true);
    try {
      const entries = await vaultService.getItemHistory(initial.id);
      const decrypted = await Promise.all(
        entries.map(async (entry) => {
          try {
            const plain = await decryptVaultItem(vaultKey, entry.encryptedData, entry.iv);
            return { id: entry.id, createdAt: entry.createdAt, password: plain.password ?? '' };
          } catch {
            return { id: entry.id, createdAt: entry.createdAt, password: null };
          }
        })
      );
      setHistory(decrypted);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form, initial?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Editar credencial' : 'Nueva credencial'}
    >
      <div className="vim-form">
        <div className="form-group">
          <label>Nombre *</label>
          <input className="form-input" placeholder="GitHub, Google…" value={form.name} onChange={set('name')} autoFocus />
        </div>

        {folders.length > 0 && (
          <div className="form-group">
            <label>Carpeta</label>
            <select
              className="form-input"
              value={form.folderId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value || null }))}
            >
              <option value="">Sin carpeta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>URL</label>
          <input className="form-input" placeholder="https://github.com" value={form.url} onChange={set('url')} />
        </div>

        <div className="form-group">
          <label>Usuario / Email</label>
          <input className="form-input" placeholder="usuario@email.com" value={form.username} onChange={set('username')} />
        </div>

        <div className="form-group">
          <label>Contraseña</label>
          <div className="vim-password-row">
            <PasswordInput
              value={form.password}
              onChange={set('password')}
              placeholder="Contraseña"
            />
            <button
              className="vim-generate-btn"
              type="button"
              title="Generar contraseña"
              onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
            >
              <box-icon name="refresh" color="var(--color-muted)" size="16px" />
            </button>
            {form.password && <CopyButton text={form.password} />}
          </div>
        </div>

        <div className="form-group">
          <label>Notas</label>
          <textarea
            className="form-input vim-notes"
            placeholder="Notas opcionales…"
            value={form.notes}
            onChange={set('notes')}
            rows={3}
          />
        </div>

        {initial?.id && (
          <div className="vim-history">
            <button
              type="button"
              className="vim-history-toggle"
              onClick={toggleHistory}
            >
              <box-icon name="time-five" color="var(--color-muted)" size="15px" />
              <span>Historial de contraseñas</span>
              <box-icon
                name={historyOpen ? 'chevron-up' : 'chevron-down'}
                color="var(--color-muted)"
                size="15px"
              />
            </button>

            {historyOpen && (
              <div className="vim-history-list">
                {historyLoading && (
                  <p className="vim-history-empty">Cargando…</p>
                )}
                {!historyLoading && history.length === 0 && (
                  <p className="vim-history-empty">Sin historial de contraseñas</p>
                )}
                {!historyLoading && history.map((entry) => (
                  <div key={entry.id} className="vim-history-entry">
                    <div className="vim-history-meta">
                      <span className="vim-history-date">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.password !== null ? (
                      <div className="vim-history-password">
                        <span className="vim-history-pass-text">••••••••</span>
                        <CopyButton text={entry.password} />
                      </div>
                    ) : (
                      <span className="vim-history-pass-text vim-history-error">Error al descifrar</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="vim-actions">
          <button className="vim-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-primary vim-save" onClick={handleSave} disabled={!form.name.trim() || saving}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear credencial'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
