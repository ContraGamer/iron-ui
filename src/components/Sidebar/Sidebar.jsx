import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle.jsx';
import useCommonService from '../../service/CommonService.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import { useSidebar } from '../../context/SidebarProvider.jsx';
import 'boxicons';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: URLS.VAULT,    icon: 'lock-alt',  label: 'Bóveda' },
  { to: URLS.SETTINGS, icon: 'cog',       label: 'Ajustes' },
  { to: URLS.TRASH,    icon: 'trash',     label: 'Papelera' },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const { logout } = useCommonService();
  const authService = AuthService();
  const { setSidebarExpanded } = useSidebar();

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    setSidebarExpanded(next);
  };

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignorar error de red */ }
    logout();
    navigate(URLS.LOGIN);
  };

  return (
    <aside className={`sidebar ${expanded ? 'sidebar--expanded' : ''}`}>
      {/* Toggle */}
      <button
        className="sidebar-toggle"
        onClick={toggle}
        aria-label={expanded ? 'Contraer menú' : 'Expandir menú'}
      >
        <box-icon
          name={expanded ? 'chevrons-left' : 'chevrons-right'}
          color="var(--color-muted)"
          size="18px"
        />
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <box-icon name="lock-alt" color="var(--color-accent)" size="20px" />
        </div>
        {expanded && <span className="sidebar-logo-name">IronKey</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
            }
          >
            <box-icon name={icon} color="currentColor" size="20px" />
            {expanded && <span className="sidebar-label">{label}</span>}
            {!expanded && <span className="sidebar-tooltip">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <ThemeToggle />
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <box-icon name="log-out" color="var(--color-muted)" size="20px" />
          {expanded && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
}
