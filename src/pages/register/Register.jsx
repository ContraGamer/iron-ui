import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle.jsx';
import { PasswordInput } from '../../components/PasswordInput/PasswordInput.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import { deriveMasterKey, generateVaultKey, protectVaultKey } from '../../crypto/kdf.js';
import { generateSalt } from '../../crypto/utils.js';
import 'boxicons';
import '../../styles/auth.css';
import './Register.css';

const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 20) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { label: 'Muy débil', color: '#e05c5c' },
    { label: 'Débil',     color: '#e0925c' },
    { label: 'Regular',   color: '#e0c85c' },
    { label: 'Fuerte',    color: '#8EB69B' },
    { label: 'Muy fuerte', color: '#DAF1DE' },
  ];
  return { score, ...levels[Math.min(score, 4)] };
};

export function Register() {
  const navigate = useNavigate();
  const authService = AuthService();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(password);
  const passwordsMatch = password && confirm && password === confirm;
  const canSubmit = email && password.length >= 12 && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      // 1. Generar salt y vault key aleatorios en el cliente
      const kdfSalt = generateSalt(32);
      const vaultKey = await generateVaultKey();

      // 2. Derivar master key (Argon2id)
      const { encryptionKey, masterPasswordHash } = await deriveMasterKey(password, kdfSalt);

      // 3. Cifrar la vault key con la master key
      const protectedSymmetricKey = await protectVaultKey(vaultKey, encryptionKey);

      // 4. Registrar en el servidor
      await authService.register({
        email,
        masterPasswordHash,
        kdfSalt,
        protectedSymmetricKey,
      });

      navigate(URLS.LOGIN);
    } catch (err) {
      setError(err?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-loading">
            <div className="spinner" />
            <p>Creando tu bóveda…</p>
            <span>Generando claves de seguridad</span>
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
            <h1>Crear cuenta</h1>
            <p>Tu bóveda se cifra en tu dispositivo</p>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password">Contraseña maestra</label>
            <PasswordInput
              id="reg-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 12 caracteres"
            />
            {password && (
              <div className="strength-bar">
                <div className="strength-segments">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="strength-segment"
                      style={{ background: i < strength.score ? strength.color : 'var(--color-border)' }}
                    />
                  ))}
                </div>
                <span className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirmar contraseña</label>
            <PasswordInput
              id="reg-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña maestra"
            />
            {confirm && !passwordsMatch && (
              <span className="field-error">Las contraseñas no coinciden</span>
            )}
          </div>

          <div className="register-warning">
            <box-icon name="error" color="var(--color-muted)" size="16px" />
            <span>
              Si olvidas tu contraseña maestra, <strong>no podremos recuperarla</strong>.
              Guárdala en un lugar seguro.
            </span>
          </div>

          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Crear cuenta
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes cuenta? <Link to={URLS.LOGIN}>Iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
}
