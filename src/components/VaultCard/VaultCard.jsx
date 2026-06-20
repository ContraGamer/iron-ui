import { useState } from 'react';
import { CopyButton } from '../CopyButton/CopyButton.jsx';
import 'boxicons';
import './VaultCard.css';

const getFavicon = (url) => {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
};

export function VaultCard({ item, onEdit }) {
  const { name, url, username, password } = item.decrypted;
  const [faviconErr, setFaviconErr] = useState(false);
  const favicon = url && !faviconErr ? getFavicon(url) : null;

  return (
    <div className="vault-card">
      {/* Icono / Favicon */}
      <div className="vault-card-icon">
        {favicon ? (
          <img
            src={favicon}
            alt=""
            width={20}
            height={20}
            onError={() => setFaviconErr(true)}
          />
        ) : (
          <span className="vault-card-letter">
            {(name || '?')[0].toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="vault-card-info">
        <p className="vault-card-name">{name}</p>
        {username && <p className="vault-card-user">{username}</p>}
        {url && (
          <p className="vault-card-url">
            {new URL(url.startsWith('http') ? url : `https://${url}`).hostname}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="vault-card-actions">
        {password && <CopyButton text={password} label="Copiar" />}
        <button
          className="vault-card-edit"
          onClick={() => onEdit(item)}
          title="Editar"
        >
          <box-icon name="edit" color="var(--color-muted)" size="16px" />
        </button>
      </div>
    </div>
  );
}
