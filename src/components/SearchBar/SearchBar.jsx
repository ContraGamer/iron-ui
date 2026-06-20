import 'boxicons';
import './SearchBar.css';

export function SearchBar({ value, onChange, placeholder = 'Buscar credenciales…' }) {
  return (
    <div className="search-bar">
      <box-icon name="search" color="var(--color-muted)" size="18px" />
      <input
        className="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Limpiar">
          <box-icon name="x" color="var(--color-muted)" size="16px" />
        </button>
      )}
    </div>
  );
}
