import { Link } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle.jsx';
import 'boxicons';
import './Landing.css';

export function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-theme-corner">
        <ThemeToggle />
      </div>

      <main className="landing-main">
        <div className="landing-icon">
          <box-icon name="lock-alt" color="var(--color-accent)" size="40px" />
        </div>

        <h1 className="landing-title">IronKey</h1>
        <p className="landing-tagline">
          Tu bóveda, tus reglas.<br />Zero-knowledge, self-hosted.
        </p>

        <div className="landing-actions">
          <Link to={URLS.LOGIN} className="landing-btn landing-btn--primary">
            Iniciar sesión
          </Link>
          <Link to={URLS.REGISTER} className="landing-btn landing-btn--secondary">
            Crear cuenta
          </Link>
        </div>

        <p className="landing-note">
          <box-icon name="shield-quarter" color="var(--color-muted)" size="14px" />
          <span>Tus contraseñas nunca salen de tu dispositivo sin cifrar</span>
        </p>
      </main>
    </div>
  );
}
