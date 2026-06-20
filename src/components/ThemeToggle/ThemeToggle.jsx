import { useTheme } from '../../context/ThemeProvider.jsx';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      <box-icon
        name={theme === 'dark' ? 'sun' : 'moon'}
        color="var(--color-muted)"
        size="20px"
      />
    </button>
  );
}
