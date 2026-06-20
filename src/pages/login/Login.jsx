import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle.jsx';
import { PasswordInput } from '../../components/PasswordInput/PasswordInput.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import useCommonService from '../../service/CommonService.jsx';
import { deriveMasterKey, unprotectVaultKey } from '../../crypto/kdf.js';
import 'boxicons';
import '../../styles/auth.css';
import './Login.css';

// step: 'credentials' | 'totp' | 'loading'
export function Login() {
  const navigate = useNavigate();
  const authService = AuthService();
  const { login, setVaultKey } = useCommonService();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');

  // Guardamos la encryptionKey entre el paso credentials y totp
  const [cachedEncKey, setCachedEncKey] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      // 1. Obtener parámetros KDF del servidor
      const kdfParams = await authService.getKdfParams(email);

      // 2. Derivar la master key localmente (Argon2id)
      const { encryptionKey, masterPasswordHash } = await deriveMasterKey(
        password,
        kdfParams.kdfSalt,
      );
      setCachedEncKey(encryptionKey);

      // 3. Enviar credenciales
      const response = await authService.login({
        email,
        masterPasswordHash,
        ...(totpCode ? { totpCode } : {}),
      });

      // 4. Descifrar la vault key con la master key
      const vaultKey = await unprotectVaultKey(response.protectedSymmetricKey, encryptionKey);

      // 5. Guardar tokens y vault key en contextos
      login(response.accessToken, response.refreshToken);
      setVaultKey(vaultKey);

      navigate(URLS.VAULT);
    } catch (err) {
      if (err?.requiresTotp || err?.code === 'TOTP_REQUIRED') {
        setStep('totp');
      } else {
        setError(err?.message || 'Credenciales incorrectas');
        setStep(totpCode ? 'totp' : 'credentials');
      }
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const kdfParams = await authService.getKdfParams(email);
      const { encryptionKey, masterPasswordHash } = cachedEncKey
        ? { encryptionKey: cachedEncKey, masterPasswordHash: null }
        : await deriveMasterKey(password, kdfParams.kdfSalt);

      const { masterPasswordHash: hash } = cachedEncKey
        ? await deriveMasterKey(password, kdfParams.kdfSalt)
        : { masterPasswordHash: null };

      const response = await authService.login({
        email,
        masterPasswordHash: hash,
        totpCode,
      });

      const vaultKey = await unprotectVaultKey(response.protectedSymmetricKey, encryptionKey);
      login(response.accessToken, response.refreshToken);
      setVaultKey(vaultKey);
      navigate(URLS.VAULT);
    } catch (err) {
      setError(err?.message || 'Código 2FA incorrecto');
      setStep('totp');
    }
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
            <button className="link-btn" onClick={() => { setStep('credentials'); setError(''); }}>
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
            <h1>IronKey</h1>
            <p>Accede a tu bóveda</p>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
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
            <label htmlFor="master-password">Contraseña maestra</label>
            <PasswordInput
              id="master-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña maestra"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={!email || !password}>
            Iniciar sesión
          </button>
        </form>

        <div className="auth-footer">
          ¿No tienes cuenta?{' '}
          <Link to={URLS.REGISTER}>Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
