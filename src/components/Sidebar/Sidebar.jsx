import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { URLS } from '../../const/URLs.jsx';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle.jsx';
import useCommonService from '../../service/CommonService.jsx';
import AuthService from '../../service/domains/AuthService.jsx';
import { useSidebar } from '../../context/SidebarProvider.jsx';
import { useFolders } from '../../context/FolderProvider.jsx';
import HealthService from '../../service/domains/HealthService.jsx';
import 'boxicons';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: URLS.VAULT,    icon: 'lock-alt',  label: 'Bóveda' },
  { to: URLS.SETTINGS, icon: 'cog',       label: 'Ajustes' },
  { to: URLS.TRASH,    icon: 'trash',     label: 'Papelera' },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const editingInputRef = useRef(null);
  const navigate = useNavigate();
  const { logout } = useCommonService();
  const authService = AuthService();
  const { setSidebarExpanded } = useSidebar();
  const { folders, selectedFolderId, setSelectedFolderId, createFolder, renameFolder, removeFolder } = useFolders();
  const healthService = HealthService();
  const [serverUp, setServerUp] = useState(null); // null = checking, true = up, false = down

  useEffect(() => {
    const check = () => healthService.getStatus()
      .then(() => setServerUp(true))
      .catch(() => setServerUp(false));
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    setSidebarExpanded(next);
    if (!next) { setCreatingFolder(false); setNewFolderName(''); }
  };

  const handleStartCreate = () => {
    setCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 50);
  };

  const handleConfirmCreate = async () => {
    const name = newFolderName.trim();
    if (name) await createFolder(name);
    setCreatingFolder(false);
    setNewFolderName('');
  };

  const handleFolderKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmCreate();
    if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
  };

  const handleFolderClick = (id) => {
    setSelectedFolderId(selectedFolderId === id ? null : id);
    navigate(URLS.VAULT);
  };

  const handleStartRename = (folder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
    setTimeout(() => editingInputRef.current?.focus(), 50);
  };

  const handleConfirmRename = async () => {
    const name = editingName.trim();
    if (name && name !== folders.find((f) => f.id === editingFolderId)?.name) {
      await renameFolder(editingFolderId, name);
    }
    setEditingFolderId(null);
    setEditingName('');
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmRename();
    if (e.key === 'Escape') { setEditingFolderId(null); setEditingName(''); }
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

        {/* Carpetas — solo cuando está expandido */}
        {expanded && (
          <div className="sidebar-folders">
            <div className="sidebar-folders-header">
              <span className="sidebar-folders-title">Carpetas</span>
              <button
                className="sidebar-folders-add"
                onClick={handleStartCreate}
                title="Nueva carpeta"
              >
                <box-icon name="plus" color="var(--color-muted)" size="16px" />
              </button>
            </div>

            {folders.map((folder) =>
              editingFolderId === folder.id ? (
                <input
                  key={folder.id}
                  ref={editingInputRef}
                  className="sidebar-folder-input"
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={handleConfirmRename}
                  maxLength={64}
                />
              ) : (
                <button
                  key={folder.id}
                  className={`sidebar-folder-item ${selectedFolderId === folder.id ? 'sidebar-folder-item--active' : ''}`}
                  onClick={() => handleFolderClick(folder.id)}
                >
                  <box-icon name="folder" color="currentColor" size="16px" />
                  <span className="sidebar-folder-name">{folder.name}</span>
                  <span className="sidebar-folder-actions">
                    <span
                      role="button"
                      className="sidebar-folder-action"
                      onClick={(e) => { e.stopPropagation(); handleStartRename(folder); }}
                      title="Renombrar carpeta"
                    >
                      <box-icon name="pencil" color="var(--color-muted)" size="13px" />
                    </span>
                    <span
                      role="button"
                      className="sidebar-folder-action"
                      onClick={(e) => { e.stopPropagation(); removeFolder(folder.id); }}
                      title="Eliminar carpeta"
                    >
                      <box-icon name="trash" color="var(--color-muted)" size="13px" />
                    </span>
                  </span>
                </button>
              )
            )}

            {creatingFolder && (
              <input
                ref={newFolderInputRef}
                className="sidebar-folder-input"
                type="text"
                placeholder="Nombre de carpeta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleFolderKeyDown}
                onBlur={handleConfirmCreate}
                maxLength={64}
              />
            )}
          </div>
        )}
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
        <div
          className="sidebar-health"
          title={serverUp === null ? 'Verificando…' : serverUp ? 'Servidor activo' : 'Servidor no disponible'}
        >
          <span className={`sidebar-health-dot ${serverUp === null ? '' : serverUp ? 'sidebar-health-dot--up' : 'sidebar-health-dot--down'}`} />
          {expanded && (
            <span className="sidebar-health-label">
              {serverUp === null ? 'Verificando…' : serverUp ? 'Servidor activo' : 'Sin conexión'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
