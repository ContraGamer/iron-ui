import { useEffect, useRef, useState } from 'react';
import AuthService from '../../service/domains/AuthService.jsx';
import VaultService from '../../service/domains/VaultService.jsx';
import useCommonService from '../../service/CommonService.jsx';
import { tokenStore } from '../../service/tokenStore.js';
import { encryptVaultItem, decryptVaultItem } from '../../crypto/vault.js';
import { Toast } from '../../components/Toast/Toast.jsx';
import { Modal } from '../../components/Modal/Modal.jsx';
import {
  generateRecoveryCode,
  formatRecoveryCode,
  deriveRecoveryKey,
  protectVaultKey,
} from '../../crypto/kdf.js';
import 'boxicons';
import './Settings.css';

export function Settings() {
  const authService  = AuthService();
  const vaultService = VaultService();
  const { vaultKey, decodeJWT } = useCommonService();

  const [sessions, setSessions] = useState([]);
  const [totp, setTotp] = useState(null); // { secret, qrCodeUri, qrCodeImage }
  const [totpVerify, setTotpVerify] = useState('');
  const [totpModal, setTotpModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Recovery setup state
  // recoveryStep: null | 'generating' | 'show' | 'saving'
  const [recoveryStep, setRecoveryStep]       = useState(null);
  const [recoveryCode, setRecoveryCode]       = useState('');
  const [recoveryTotp, setRecoveryTotp]       = useState('');
  const [recoveryPayload, setRecoveryPayload] = useState(null); // { protectedKey, iv, rawCode }
  const [recoveryCodeCopied, setRecoveryCodeCopied] = useState(false);

  // Disable 2FA state
  const [disableTotpModal, setDisableTotpModal]   = useState(false);
  const [disableTotpCode, setDisableTotpCode]     = useState('');
  const [disableTotpSaving, setDisableTotpSaving] = useState(false);

  // Estado de recovery leído del tokenStore (seteado al hacer login)
  const [recoveryActive, setRecoveryActive] = useState(tokenStore.getRecoveryEnabled() ?? false);

  // Disable recovery state
  const [disableModal, setDisableModal]   = useState(false);
  const [disableTotp, setDisableTotp]     = useState('');
  const [disableSaving, setDisableSaving] = useState(false);

  // Export / Import state
  const importInputRef                      = useRef(null);
  const [importing, setImporting]           = useState(false);
  const [importResult, setImportResult]     = useState(null); // { imported, errors } | null

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    try {
      const data = await authService.getSessions();
      setSessions(data || []);
    } catch { /* silent */ }
  };

  const revokeSession = async (id) => {
    try {
      await authService.deleteSession(id);
      showToast('Sesión cerrada', 'success');
      loadSessions();
    } catch (err) {
      showToast(err?.message || 'Error al cerrar sesión', 'error');
    }
  };

  const startTotpSetup = async () => {
    try {
      const data = await authService.setupTotp();
      setTotp(data);
      setTotpModal(true);
    } catch (err) {
      showToast(err?.message || 'Error al configurar 2FA', 'error');
    }
  };

  const verifyTotp = async () => {
    try {
      await authService.verifyTotp({ totpCode: totpVerify });
      showToast('2FA activado correctamente', 'success');
      setTotpModal(false);
      setTotp(null);
      setTotpVerify('');
    } catch (err) {
      showToast(err?.message || 'Código incorrecto', 'error');
    }
  };

  const startRecoverySetup = async () => {
    if (!vaultKey) {
      showToast('Tu sesión expiró — vuelve a iniciar sesión', 'error');
      return;
    }
    setRecoveryStep('generating');
    setRecoveryCode('');
    setRecoveryTotp('');
    setRecoveryPayload(null);
    setRecoveryCodeCopied(false);

    try {
      const email = decodeJWT()?.sub;
      const kdfParams = await authService.getKdfParams(email);
      const rawCode = generateRecoveryCode();
      const recoveryKey = await deriveRecoveryKey(rawCode, kdfParams.kdfSalt, kdfParams);
      const { protectedSymmetricKey, protectedSymmetricKeyIv } = await protectVaultKey(vaultKey, recoveryKey);

      setRecoveryCode(rawCode);
      setRecoveryPayload({
        recoveryProtectedKey:   protectedSymmetricKey,
        recoveryProtectedKeyIv: protectedSymmetricKeyIv,
        kdfSalt:                kdfParams.kdfSalt,
      });
      setRecoveryStep('show');
    } catch (err) {
      showToast(err?.message || 'Error al generar el código', 'error');
      setRecoveryStep(null);
    }
  };

  const confirmRecoverySetup = async () => {
    setRecoveryStep('saving');
    try {
      await authService.setupRecovery({
        totpCode:               recoveryTotp,
        recoveryCode:           recoveryCode,
        recoveryProtectedKey:   recoveryPayload.recoveryProtectedKey,
        recoveryProtectedKeyIv: recoveryPayload.recoveryProtectedKeyIv,
      });
      showToast('Recuperación configurada correctamente', 'success');
      tokenStore.setRecoveryEnabled(true);
      setRecoveryActive(true);
      setRecoveryStep(null);
    } catch (err) {
      showToast(err?.message || 'Error al activar la recuperación', 'error');
      setRecoveryStep('show');
    }
  };

  const copyRecoveryCode = () => {
    navigator.clipboard.writeText(recoveryCode);
    setRecoveryCodeCopied(true);
    setTimeout(() => setRecoveryCodeCopied(false), 2000);
  };

  const downloadRecoveryCode = () => {
    const content = [
      'IronKey — Código de recuperación',
      '================================',
      '',
      recoveryCode,
      '',
      `Generado: ${new Date().toLocaleString()}`,
      '',
      'Guarda este archivo en un lugar seguro.',
      'Si pierdes tu contraseña maestra, este código es la única forma de recuperar tu bóveda.',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'ironkey-recovery-code.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDisableTotp = async () => {
    setDisableTotpSaving(true);
    try {
      await authService.deleteTotp({ totpCode: disableTotpCode });
      showToast('2FA desactivado', 'success');
      setDisableTotpModal(false);
      setDisableTotpCode('');
    } catch (err) {
      showToast(err?.message || 'Código incorrecto', 'error');
    } finally {
      setDisableTotpSaving(false);
    }
  };

  const handleDisableRecovery = async () => {
    setDisableSaving(true);
    try {
      await authService.deleteRecovery({ totpCode: disableTotp });
      showToast('Recuperación desactivada', 'success');
      tokenStore.setRecoveryEnabled(false);
      setRecoveryActive(false);
      setDisableModal(false);
      setDisableTotp('');
    } catch (err) {
      showToast(err?.message || 'Error al desactivar la recuperación', 'error');
    } finally {
      setDisableSaving(false);
    }
  };

  // ── Export / Import helpers ──────────────────────────────────────────────

  const csvEscape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const parseCsvLine = (line) => {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
      else cur += c;
    }
    result.push(cur);
    return result;
  };

  const parseBitwardenCsv = (text) => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (n) => headers.indexOf(n);
    return lines.slice(1).map((l) => {
      const c = parseCsvLine(l);
      return { name: c[idx('name')] || '', url: c[idx('login_uri')] || '', username: c[idx('login_username')] || '', password: c[idx('login_password')] || '', notes: idx('notes') >= 0 ? c[idx('notes')] || '' : '', tags: [] };
    }).filter((item) => item.name);
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const datestamp = () => new Date().toISOString().slice(0, 10);

  const handleExportIronkey = async () => {
    if (!vaultKey) { showToast('Sesión expirada — vuelve a iniciar sesión', 'error'); return; }
    try {
      const raw = await vaultService.listItems();
      const items = await Promise.all(raw.map(async (item) => {
        const data = await decryptVaultItem(vaultKey, item.encryptedData, item.iv);
        return { ...data, folderId: item.folderId ?? null };
      }));
      const { encryptedData, iv } = await encryptVaultItem(vaultKey, { version: 1, items, exportedAt: new Date().toISOString() });
      const blob = new Blob([JSON.stringify({ version: 1, encryptedData, iv })], { type: 'application/json' });
      downloadBlob(blob, `ironkey-backup-${datestamp()}.ironkey`);
      showToast('Bóveda exportada correctamente', 'success');
    } catch { showToast('Error al exportar la bóveda', 'error'); }
  };

  const handleExportCsv = async () => {
    if (!vaultKey) { showToast('Sesión expirada — vuelve a iniciar sesión', 'error'); return; }
    const confirmed = window.confirm(
      '⚠️ Advertencia de seguridad\n\n' +
      'El archivo CSV contendrá tus contraseñas en TEXTO PLANO.\n' +
      'Cualquier persona con acceso al archivo podrá leerlas.\n\n' +
      '¿Deseas continuar?'
    );
    if (!confirmed) return;
    try {
      const raw = await vaultService.listItems();
      const rows = await Promise.all(raw.map(async (item) => {
        const d = await decryptVaultItem(vaultKey, item.encryptedData, item.iv);
        return ['', '', 'login', csvEscape(d.name), csvEscape(d.notes), '', '0', csvEscape(d.url), csvEscape(d.username), csvEscape(d.password), ''].join(',');
      }));
      const csv = ['folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp', ...rows].join('\n');
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `ironkey-export-${datestamp()}.csv`);
      showToast('Exportado como CSV (Bitwarden)', 'success');
    } catch { showToast('Error al exportar', 'error'); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !vaultKey) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const ext  = file.name.split('.').pop().toLowerCase();
      let items  = [];

      if (ext === 'ironkey') {
        const { encryptedData, iv } = JSON.parse(text);
        const payload = await decryptVaultItem(vaultKey, encryptedData, iv);
        items = payload.items ?? [];
      } else if (ext === 'csv') {
        items = parseBitwardenCsv(text);
      } else {
        showToast('Formato no soportado — usa .ironkey o .csv (Bitwarden)', 'error');
        return;
      }

      let imported = 0, errors = 0;
      for (const item of items) {
        try {
          const { folderId, ...data } = item;
          const encrypted = await encryptVaultItem(vaultKey, data);
          await vaultService.createItem({ ...encrypted, folderId: folderId ?? null });
          imported++;
        } catch { errors++; }
      }
      setImportResult({ imported, errors });
    } catch { showToast('Error al leer el archivo', 'error'); }
    finally { setImporting(false); e.target.value = ''; }
  };

  return (
    <div className="settings-page">
      <div className="settings-content">
        <h1 className="settings-title">Ajustes</h1>

        {/* Sesiones activas */}
        <section className="settings-section">
          <h2>Sesiones activas</h2>
          <p className="settings-desc">Cierra sesiones en dispositivos que no reconoces.</p>
          <div className="sessions-list">
            {sessions.length === 0 && (
              <p className="settings-empty">Sin sesiones adicionales</p>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="session-item">
                <div className="session-info">
                  <box-icon name="desktop" color="var(--color-muted)" size="18px" />
                  <div>
                    <p>{s.userAgent || 'Dispositivo desconocido'}</p>
                    <span>{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</span>
                  </div>
                </div>
                <button className="session-revoke" onClick={() => revokeSession(s.id)}>
                  Cerrar
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 2FA */}
        <section className="settings-section">
          <h2>Autenticación de dos factores</h2>
          <p className="settings-desc">Protege tu cuenta con Google Authenticator o Aegis.</p>
          <div className="settings-actions">
            <button className="settings-btn settings-btn--primary" onClick={startTotpSetup}>
              <box-icon name="shield-quarter" color="var(--color-bg)" size="16px" />
              Configurar 2FA
            </button>
            <button
              className="settings-btn settings-btn--danger"
              onClick={() => { setDisableTotpModal(true); setDisableTotpCode(''); }}
            >
              Desactivar 2FA
            </button>
          </div>
        </section>

        {/* Recuperación de cuenta */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2>Recuperación de cuenta</h2>
            {recoveryActive
              ? <span className="settings-badge settings-badge--active">Activo</span>
              : <span className="settings-badge settings-badge--inactive">No configurado</span>
            }
          </div>
          <p className="settings-desc">
            Genera un código de recuperación para restaurar el acceso si olvidas tu contraseña maestra.
            Requiere 2FA activo. Guarda el código en un lugar seguro — no se puede recuperar después.
          </p>
          <div className="settings-actions">
            {!recoveryActive && (
              <button
                className="settings-btn settings-btn--primary"
                onClick={startRecoverySetup}
                disabled={recoveryStep === 'generating'}
              >
                <box-icon name="key" color="var(--color-bg)" size="16px" />
                {recoveryStep === 'generating' ? 'Generando…' : 'Configurar recuperación'}
              </button>
            )}
            {recoveryActive && (
              <button
                className="settings-btn settings-btn--danger"
                onClick={() => { setDisableModal(true); setDisableTotp(''); }}
              >
                Desactivar recuperación
              </button>
            )}
          </div>
        </section>
        {/* Exportar / Importar */}
        <section className="settings-section">
          <h2>Exportar / Importar bóveda</h2>
          <p className="settings-desc">
            Exporta tus credenciales como archivo cifrado (.ironkey) o en formato CSV compatible con Bitwarden.
            Importa desde cualquiera de esos formatos.
          </p>

          <div className="settings-data-grid">
            <div className="settings-data-card">
              <p className="settings-data-label">Exportar</p>
              <div className="settings-actions">
                <button className="settings-btn settings-btn--primary" onClick={handleExportIronkey}>
                  <box-icon name="lock" color="var(--color-bg)" size="15px" />
                  .ironkey
                </button>
                <button className="settings-btn settings-btn--secondary" onClick={handleExportCsv}>
                  <box-icon name="spreadsheet" color="var(--color-text)" size="15px" />
                  CSV Bitwarden
                </button>
              </div>
            </div>

            <div className="settings-data-card">
              <p className="settings-data-label">Importar</p>
              <input
                ref={importInputRef}
                type="file"
                accept=".ironkey,.csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                className="settings-btn settings-btn--secondary"
                onClick={() => { setImportResult(null); importInputRef.current?.click(); }}
                disabled={importing}
              >
                <box-icon name="upload" color="var(--color-text)" size="15px" />
                {importing ? 'Importando…' : 'Seleccionar archivo'}
              </button>
              {importResult && (
                <p className={`settings-import-result ${importResult.errors > 0 ? 'settings-import-result--warn' : 'settings-import-result--ok'}`}>
                  {importResult.imported} importadas{importResult.errors > 0 ? `, ${importResult.errors} con error` : ' correctamente'}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal TOTP */}
      <Modal isOpen={totpModal} onClose={() => setTotpModal(false)} title="Configurar 2FA">
        {totp && (
          <div className="totp-setup">
            <p className="totp-setup-desc">
              Escanea este código QR con tu app de autenticación:
            </p>
            {totp.qrCodeImage && (
              <img
                src={`data:image/png;base64,${totp.qrCodeImage}`}
                alt="QR 2FA"
                className="totp-qr"
              />
            )}
            {totp.secret && (
              <div className="totp-secret">
                <span>Clave manual:</span>
                <code>{totp.secret}</code>
              </div>
            )}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Código de verificación</label>
              <input
                className="form-input totp-verify-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totpVerify}
                onChange={(e) => setTotpVerify(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={verifyTotp}
              disabled={totpVerify.length !== 6}
            >
              Verificar y activar
            </button>
          </div>
        )}
      </Modal>

      {/* Modal recovery setup */}
      <Modal
        isOpen={recoveryStep === 'show' || recoveryStep === 'saving'}
        onClose={() => recoveryStep !== 'saving' && setRecoveryStep(null)}
        title="Código de recuperación"
      >
        <div className="recovery-setup">
          <p className="recovery-setup-desc">
            Este es tu código de recuperación. <strong>Guárdalo ahora</strong> — solo se muestra una vez.
            Si pierdes tu contraseña maestra, este código es la única forma de recuperar tu bóveda.
          </p>

          <div className="recovery-code-display">
            <code>{formatRecoveryCode(recoveryCode)}</code>
          </div>

          <div className="recovery-code-actions">
            <button className="recovery-action-btn" onClick={copyRecoveryCode}>
              <box-icon name={recoveryCodeCopied ? 'check' : 'copy'} size="15px" color="var(--color-accent)" />
              {recoveryCodeCopied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="recovery-action-btn" onClick={downloadRecoveryCode}>
              <box-icon name="download" size="15px" color="var(--color-accent)" />
              Descargar .txt
            </button>
          </div>

          <div className="recovery-confirm-section">
            <p className="recovery-setup-desc">
              Confirma que lo guardaste ingresando tu código 2FA:
            </p>
            <div className="form-group">
              <label>Código 2FA</label>
              <input
                className="form-input totp-verify-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={recoveryTotp}
                onChange={(e) => setRecoveryTotp(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: '0.75rem' }}
              onClick={confirmRecoverySetup}
              disabled={recoveryTotp.length !== 6 || recoveryStep === 'saving'}
            >
              {recoveryStep === 'saving' ? 'Guardando…' : 'Activar recuperación'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal desactivar recovery */}
      <Modal
        isOpen={disableModal}
        onClose={() => !disableSaving && setDisableModal(false)}
        title="Desactivar recuperación"
      >
        <div className="recovery-setup">
          <p className="recovery-setup-desc">
            Se eliminará el código de recuperación almacenado. Para volver a activarlo tendrás que generar uno nuevo.
            Confirma con tu código 2FA:
          </p>
          <div className="form-group">
            <label>Código 2FA</label>
            <input
              className="form-input totp-verify-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={disableTotp}
              onChange={(e) => setDisableTotp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: '0.75rem', background: 'var(--color-error)' }}
            onClick={handleDisableRecovery}
            disabled={disableTotp.length !== 6 || disableSaving}
          >
            {disableSaving ? 'Desactivando…' : 'Desactivar'}
          </button>
        </div>
      </Modal>

      {/* Modal desactivar 2FA */}
      <Modal
        isOpen={disableTotpModal}
        onClose={() => !disableTotpSaving && setDisableTotpModal(false)}
        title="Desactivar 2FA"
      >
        <div className="recovery-setup">
          <p className="recovery-setup-desc">
            Confirma con tu código 2FA actual para desactivar la autenticación de dos factores.
          </p>
          <div className="form-group">
            <label>Código 2FA</label>
            <input
              className="form-input totp-verify-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={disableTotpCode}
              onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: '0.75rem', background: 'var(--color-error)' }}
            onClick={handleDisableTotp}
            disabled={disableTotpCode.length !== 6 || disableTotpSaving}
          >
            {disableTotpSaving ? 'Desactivando…' : 'Desactivar 2FA'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
