import { useEffect, useState } from 'react';
import AuthService from '../../service/domains/AuthService.jsx';
import { Toast } from '../../components/Toast/Toast.jsx';
import { Modal } from '../../components/Modal/Modal.jsx';
import 'boxicons';
import './Settings.css';

export function Settings() {
  const authService = AuthService();
  const [sessions, setSessions] = useState([]);
  const [totp, setTotp] = useState(null); // { qrCode, secret }
  const [totpVerify, setTotpVerify] = useState('');
  const [totpModal, setTotpModal] = useState(false);
  const [toast, setToast] = useState(null);

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
              onClick={async () => {
                try { await authService.deleteTotp(); showToast('2FA desactivado', 'success'); }
                catch (err) { showToast(err?.message || 'Error', 'error'); }
              }}
            >
              Desactivar 2FA
            </button>
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
            {totp.qrCodeUrl && (
              <img src={totp.qrCodeUrl} alt="QR 2FA" className="totp-qr" />
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
