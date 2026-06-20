import { useState } from 'react';
import './PasswordInput.css';

export function PasswordInput({ value, onChange, placeholder = 'Contraseña', name, id }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <box-icon name={visible ? 'hide' : 'show'} color="var(--color-muted)" size="18px" />
      </button>
    </div>
  );
}
