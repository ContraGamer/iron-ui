import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle.jsx';
import { PasswordInput } from '../../components/PasswordInput/PasswordInput.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import useCommonService from '../../service/CommonService.jsx';
import { tokenStore } from '../../service/tokenStore.js';
import { deriveMasterKey, unprotectVaultKey } from '../../crypto/kdf.js';
import 'boxicons';
import '../../styles/auth.css';
import './Unlock.css';

// step: 'password' | 'totp' | 'loading'
export function Unlock() {
  const navigate   = useNavigate();
  const authService = AuthService();
  const { isAuthenticated, login, setVaultKey } = useCommonService();

  const storedEmail  = tokenStore.getEmail();
  const hasRefresh   = !!tokenStore.getRefresh();

  // Si ya está autenticado, ir directo al vault
  if (isAuthenticated()) return <Navigate to={URLS.VAULT} replace />;

  // Si no hay sesión guardada, ir al login normal
  if (!storedEmail || !hasRefresh) return <Navigate to={URLS.LOGIN} replace />;

  const [step, setStep]         = useState('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError]       = useState('');

  const [cachedEncKey, setCachedEncKey] = useState(null);
  const [cachedHash,   setCachedHash]   = useState(null);

  const doLogin = async (encryptionKey, masterPasswordHash, totpCodeValue) => {
    const response = await authService.login({
      email: storedEmail,
      masterPasswordHash,
      ...(totpCodeValue ? { totpCode: totpCodeValue } : {}),
    });

    const vaultKey = await unprotectVaultKey(
      response.protectedSymmetricKey,
      response.protectedSymmetricKeyIv,
      encryptionKey,
    );

    login(response.accessToken, response.refreshToken, storedEmail);
    setVaultKey(vaultKey);
    navigate(URLS.VAULT);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const kdfParams = await authService.getKdfParams(storedEmail);
      const { encryptionKey, masterPasswordHash } = await deriveMasterKey(
        password,
        kdfParams.kdfSalt,
        kdfParams,
      );
      setCachedEncKey(encryptionKey);
      setCachedHash(masterPasswordHash);

      await doLogin(encryptionKey, masterPasswordHash, null);
    } catch (err) {
      if (err?.requiresTotp || err?.code === 'TOTP_REQUIRED' || err?.message === 'Se requiere código 2FA') {
        setStep('totp');
      } else {
        setError(err?.message || 'Contraseña incorrecta');
        setStep('password');
      }
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      await doLogin(cachedEncKey, cachedHash, totpCode);
    } catch (err) {
      setError(err?.message || 'Código 2FA incorrecto');
      setStep('totp');
    }
  };

  const handleChangeAccount = () => {
    tokenStore.clearAll();
    navigate(URLS.LOGIN);
  };

  if (step === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-loading">
            <div className="spinner" />
            <p>Derivando clave maestra…</p>
            <span>Esto puede tomar unos segundos</span>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'totp') {
    return (
      <div className="auth-page">
        <div className="auth-theme-corner"><ThemeToggle /></div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-icon">
              <box-icon name="shield-quarter" color="var(--color-accent)" size="22px" />
            </div>
            <div>
              <h1>Verificación 2FA</h1>
              <p>Ingresa el código de tu app de autenticación</p>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleTotpSubmit}>
            <div className="form-group">
              <label htmlFor="totp">Código de 6 dígitos</label>
              <input
                id="totp"
                className="form-input totp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                autoComplete="one-time-code"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={totpCode.length !== 6}>
              Verificar
            </button>
          </form>

          <div className="auth-footer">
            <button className="link-btn" onClick={() => { setStep('password'); setError(''); }}>
              ← Volver
            </button>
          </div>
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
            <box-icon name="lock-alt" color="var(--color-accent)" size="22px" />
          </div>
          <div>
            <h1>Bienvenido de vuelta</h1>
            <p>Ingresa tu contraseña para desbloquear</p>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="unlock-email">
          <box-icon name="user-circle" color="var(--color-muted)" size="16px" />
          <span>{storedEmail}</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="master-password">Contraseña maestra</label>
            <PasswordInput
              id="master-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña maestra"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={!password}>
            Desbloquear bóveda
          </button>
        </form>

        <div className="auth-footer">
          <button className="link-btn" onClick={handleChangeAccount}>
            ¿No eres tú? Cambiar cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
