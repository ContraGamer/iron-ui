import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle.jsx';
import { PasswordInput } from '../../components/PasswordInput/PasswordInput.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import { deriveRecoveryKey, deriveMasterKey, protectVaultKey, unprotectVaultKey } from '../../crypto/kdf.js';
import 'boxicons';
import '../../styles/auth.css';
import './Recovery.css';

// steps: 'form' | 'loading' | 'newPassword' | 'saving' | 'done'
export function Recovery() {
  const navigate = useNavigate();
  const authService = AuthService();

  const [step, setStep]               = useState('form');
  const [email, setEmail]             = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]             = useState('');

  const [cachedVaultKey,  setCachedVaultKey]  = useState(null);
  const [cachedKdfParams, setCachedKdfParams] = useState(null);
  const [cachedRawCode,   setCachedRawCode]   = useState('');

  const rawCode = (code) => code.replace(/-/g, '').toUpperCase();

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const code = rawCode(recoveryCode);
      const data = await authService.getRecoveryData(email);

      const recoveryKey = await deriveRecoveryKey(code, data.kdfSalt, data);
      const vaultKey = await unprotectVaultKey(
        data.recoveryProtectedKey,
        data.recoveryProtectedKeyIv,
        recoveryKey,
      );

      setCachedVaultKey(vaultKey);
      setCachedKdfParams(data);
      setCachedRawCode(code);
      setStep('newPassword');
    } catch {
      setError('Código de recuperación incorrecto o cuenta no encontrada');
      setStep('form');
    }
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres');
      return;
    }
    setError('');
    setStep('saving');

    try {
      const { encryptionKey, masterPasswordHash } = await deriveMasterKey(
        newPassword,
        cachedKdfParams.kdfSalt,
        cachedKdfParams,
      );
      const { protectedSymmetricKey, protectedSymmetricKeyIv } = await protectVaultKey(
        cachedVaultKey,
        encryptionKey,
      );

      await authService.recoverAccount({
        email,
        recoveryCode:              cachedRawCode,
        newMasterPasswordHash:     masterPasswordHash,
        newProtectedSymmetricKey:   protectedSymmetricKey,
        newProtectedSymmetricKeyIv: protectedSymmetricKeyIv,
      });

      setStep('done');
    } catch (err) {
      setError(err?.message || 'Error al actualizar la contraseña');
      setStep('newPassword');
    }
  };

  if (step === 'loading' || step === 'saving') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-loading">
            <div className="spinner" />
            <p>{step === 'loading' ? 'Verificando código…' : 'Actualizando contraseña…'}</p>
            <span>Esto puede tomar unos segundos</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="auth-page">
        <div className="auth-theme-corner"><ThemeToggle /></div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-icon">
              <box-icon name="check-shield" color="var(--color-accent)" size="22px" />
            </div>
            <div>
              <h1>Contraseña actualizada</h1>
              <p>Tu cuenta ha sido recuperada exitosamente</p>
            </div>
          </div>
          <p className="recovery-done-text">
            Ya puedes iniciar sesión con tu nueva contraseña maestra.
            Recuerda que tu bóveda seguirá accesible — el cifrado se mantuvo intacto.
          </p>
          <button className="btn-primary" onClick={() => navigate(URLS.LOGIN)}>
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'newPassword') {
    return (
      <div className="auth-page">
        <div className="auth-theme-corner"><ThemeToggle /></div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-icon">
              <box-icon name="lock-open-alt" color="var(--color-accent)" size="22px" />
            </div>
            <div>
              <h1>Nueva contraseña</h1>
              <p>Elige una contraseña maestra segura</p>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleNewPasswordSubmit}>
            <div className="form-group">
              <label>Nueva contraseña maestra</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={!newPassword || !confirmPassword}
            >
              Actualizar contraseña
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-corner"><ThemeToggle /></div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-icon">
            <box-icon name="key" color="var(--color-accent)" size="22px" />
          </div>
          <div>
            <h1>Recuperar cuenta</h1>
            <p>Ingresa tu email y código de recuperación</p>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="recovery-code">Código de recuperación</label>
            <input
              id="recovery-code"
              className="form-input recovery-code-input"
              type="text"
              placeholder="ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
            />
            <span className="recovery-code-hint">Con o sin guiones</span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!email || !recoveryCode}
          >
            Verificar código
          </button>
        </form>

        <div className="auth-footer">
          <Link to={URLS.LOGIN}>← Volver al login</Link>
        </div>
      </div>
    </div>
  );
}
